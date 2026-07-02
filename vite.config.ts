import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'
import { URL } from 'url'

// 自定义 Vite 插件：处理 Mantis API 代理
function mantisProxyPlugin(): Plugin {
  return {
    name: 'mantis-proxy',
    configureServer(server) {
      // 处理 /api/mantis/* 请求
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/mantis/') || req.method !== 'GET') {
          return next()
        }

        // 从 query string 提取 cookie（避免自定义 header 问题）
        const urlObj = new URL(req.url, 'http://localhost')
        const rawCookie = urlObj.searchParams.get('_mc') || ''
        urlObj.searchParams.delete('_mc')

        // 构建目标路径（去掉 /api/mantis 前缀）
        const targetPath = urlObj.pathname.replace(/^\/api\/mantis/, '') + urlObj.search

        // 设置 cookie
        const cookieStr = rawCookie
          ? (rawCookie.startsWith('s_issue_mgmt_v3=') ? rawCookie : `s_issue_mgmt_v3=${rawCookie}`)
          : ''

        console.log('[Mantis] Requesting:', targetPath.slice(0, 100) + '...', cookieStr ? '(with cookie)' : '(no cookie)')

        // 使用原生 https 发起请求，最多跟随 3 次重定向
        const doRequest = (path: string, redirects: number) => {
          if (redirects <= 0) {
            res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ error: '重定向次数过多，请检查 Cookie 是否有效' }))
            return
          }

          const opts: https.RequestOptions = {
            hostname: 'mantis.sugon.com',
            port: 443,
            path,
            method: 'GET',
            rejectUnauthorized: false,
            timeout: 30000,
            headers: {
              'Host': 'mantis.sugon.com',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://mantis.sugon.com/',
              'Accept': 'application/json, text/html, */*',
              'Accept-Encoding': 'identity',  // 禁用 gzip，避免浏览器收到压缩数据
            },
          }

          if (cookieStr) {
            opts.headers!['Cookie'] = cookieStr
          }

          const proxyReq = https.request(opts, (proxyRes) => {
            const status = proxyRes.statusCode || 0

            // 处理重定向
            if (status >= 300 && status < 400 && proxyRes.headers.location) {
              const loc = proxyRes.headers.location
              console.log('[Mantis] Redirect', status, '→', loc.slice(0, 80))
              // 消耗完当前响应体
              proxyRes.resume()
              // 跟随重定向
              doRequest(loc.startsWith('/') ? loc : new URL(loc).pathname + new URL(loc).search, redirects - 1)
              return
            }

            // 设置响应头，转发关键 headers
            const headers: Record<string, string> = {
              'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache',
            }
            // 转发 Content-Encoding（若有 gzip 需要传给浏览器解压）
            const contentEncoding = proxyRes.headers['content-encoding']
            if (contentEncoding) {
              headers['Content-Encoding'] = contentEncoding as string
            }
            const contentLength = proxyRes.headers['content-length']
            console.log(
              '[Mantis] Response:', status,
              'type:', headers['Content-Type'],
              'len:', contentLength || '?',
              'enc:', contentEncoding || 'none',
            )
            res.writeHead(status, headers)

            // 流式转发响应体
            proxyRes.pipe(res)
          })

          proxyReq.on('timeout', () => {
            proxyReq.destroy()
            console.error('[Mantis] Request timeout')
            res.writeHead(504, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ error: 'Mantis 请求超时（30秒），请检查网络或稍后重试' }))
          })

          proxyReq.on('error', (e) => {
            console.error('[Mantis] Error:', e.message)
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
              res.end(JSON.stringify({ error: `Mantis 连接失败: ${e.message}` }))
            }
          })

          proxyReq.end()
        }

        // 发起请求
        doRequest(targetPath || '/', 3)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), mantisProxyPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5174,
  },
})
