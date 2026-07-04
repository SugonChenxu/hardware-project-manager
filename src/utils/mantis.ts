/**
 * Mantis Analysis API
 * 从 analysis API 提取：Defect Index (DI值/分类分布) + 基本统计 (bug个数/遗留数/解决率)
 */

export interface MantisConfig {
  cookie: string;
  projectId: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface DefectSummary {
  diValue: number;
  totalDi: number;
  unresolvedDi: number;
  resolvedDi: number;
  resolutionRate: number;
  categories: { name: string; di: number; unresolved: number; resolved: number }[];
  /** 缺陷指数趋势（日期 + DI值） */
  trend: { date: string; value: number }[];
}

export interface BasicStats {
  totalBugs: number;
  unresolvedBugs: number;
  resolvedBugs: number;
  resolutionRate: number;
  /** Mantis 原始返回数据，供调试用 */
  raw?: unknown;
  /** 调试：实际行数据结构和列名 */
  _debug?: Record<string, unknown>;
}

// ---- 内部工具 ----

function buildUrl(config: MantisConfig, viewName: string, index: number): string {
  const projIdArr = JSON.stringify([config.projectId]);
  const params = new URLSearchParams({
    action: 'get_analysis_data',
    view_name: viewName,
    index: String(index),
    proj_id_arr: projIdArr,
    date_from: config.dateFrom || '',
    date_to: config.dateTo || '',
    ignore_privileged_projects: 'yes',
  });
  const encodedCookie = encodeURIComponent(config.cookie);
  return `/api/mantis/analysis/?${params.toString()}&_mc=${encodedCookie}`;
}

async function fetchMantisPage(config: MantisConfig, viewName: string, index: number) {
  const url = buildUrl(config, viewName, index);
  const resp = await fetch(url);
  const ct = resp.headers.get('content-type') || '';

  // 读取响应文本（仅读一次，避免 body 被消耗后无法再读）
  const text = await resp.text();

  // 非 2xx 错误
  if (!resp.ok) {
    if (ct.includes('json')) {
      const errData = JSON.parse(text);
      throw new Error(errData.error || `Mantis 请求失败 (HTTP ${resp.status})`);
    }
    if (text.includes('<!doctype') || text.includes('<html') || text.includes('login')) {
      throw new Error(
        `认证失败 (HTTP ${resp.status})：Mantis Cookie 已过期。\n`
        + '请重新获取：F12 → Application → Cookies → mantis.sugon.com → s_issue_mgmt_v3 的 Value',
      );
    }
    throw new Error(`Mantis API 异常 (HTTP ${resp.status})`);
  }

  // HTTP 200 但返回了 HTML（认证重定向后的登录页）
  if (text.includes('<!doctype') || text.includes('<html') || text.includes('<title>Redirecting')) {
    throw new Error(
      'Cookie 已过期，Mantis 返回了登录页面。\n'
      + '请重新获取：F12 → Application → Cookies → mantis.sugon.com → s_issue_mgmt_v3 的 Value',
    );
  }

  // 空响应
  if (!text.trim()) {
    throw new Error(
      'Mantis 返回了空数据。可能原因：\n'
      + '1. Cookie 已过期（请重新获取）\n'
      + '2. 项目 ID 不正确或无权访问\n'
      + '3. 未设置日期范围（Defect Index 需要指定时间区间）',
    );
  }

  // 尝试解析 JSON
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.slice(0, 300);
    throw new Error(`Mantis 返回了非 JSON 数据。前300字符:\n${snippet}`);
  }
}

// ---- 公开 API ----

/**
 * 从 Mantis 拉取项目列表
 * 自动尝试多个已知的 API 路径，直到有一个返回非空数据
 */
export async function fetchProjectList(cookie: string): Promise<{ id: string; name: string }[]> {
  const encodedCookie = encodeURIComponent(cookie);

  // ── 策略 A: 先尝试 get_recent_projects（最近使用的项目） ──
  try {
    const url = `/api/mantis/projects?action=get_recent_projects&_mc=${encodedCookie}`;
    console.log('[Mantis] 尝试: get_recent_projects');
    const resp = await fetch(url);
    const text = await resp.text();

    if (resp.ok && text.trim()) {
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        // 不是 JSON，可能是 HTML，忽略
      }

      if (data) {
        console.log('[Mantis] get_recent_projects 响应:', JSON.stringify(data).slice(0, 500));

        // 尝试解析多种结构
        const projects: { id: string; name: string }[] = [];
        let items: unknown[] = [];

        if (Array.isArray(data)) {
          items = data;
        } else if (typeof data === 'object' && data !== null) {
          const obj = data as Record<string, unknown>;
          const raw = obj.data ?? obj.projects ?? obj.collection ?? obj.items ?? obj.results ?? obj;
          items = Array.isArray(raw) ? raw : [];
        }

        for (const item of items) {
          if (typeof item !== 'object' || item === null) continue;
          const obj = item as Record<string, unknown>;

          // 处理嵌套结构: item.projects[0].id / item.projects[0].name
          const subProjects = obj.projects as Record<string, unknown>[] | undefined;
          if (Array.isArray(subProjects) && subProjects.length > 0) {
            for (const sp of subProjects) {
              const id = String(sp.id || sp.project_id || sp.proj_id || '');
              const name = String(sp.name || sp.project_name || '');
              if (id && name) projects.push({ id, name });
            }
          } else {
            // 扁平结构: item.id / item.name
            const id = String(obj.id || obj.project_id || obj.proj_id || '');
            const name = String(obj.name || obj.project_name || obj.title || '');
            if (id && name) projects.push({ id, name });
          }
        }

        if (projects.length > 0) {
          console.log(`[Mantis] ✅ get_recent_projects 成功，${projects.length} 个项目`);
          return projects;
        }
      }
    }
  } catch {
    // 忽略，继续尝试下一种
  }

  // ── 策略 B: 尝试 get_project_collection（兼容之前） ──
  try {
    const url = `/api/mantis/projects?action=get_project_collection&_mc=${encodedCookie}`;
    console.log('[Mantis] 尝试: get_project_collection');
    const resp = await fetch(url);
    const text = await resp.text();

    if (resp.ok && text.trim()) {
      let data: unknown;
      try { data = JSON.parse(text); } catch { /* ignore */ }

      if (data) {
        console.log('[Mantis] get_project_collection 响应:', JSON.stringify(data).slice(0, 500));

        const projects: { id: string; name: string }[] = [];
        let items: unknown[] = [];

        if (Array.isArray(data)) {
          items = data;
        } else if (typeof data === 'object' && data !== null) {
          const obj = data as Record<string, unknown>;
          const raw = obj.data ?? obj.projects ?? obj.collection ?? obj.items ?? obj.results ?? obj;
          items = Array.isArray(raw) ? raw : [];
        }

        for (const item of items) {
          if (typeof item !== 'object' || item === null) continue;
          const obj = item as Record<string, unknown>;
          const id = String(obj.id || obj.project_id || obj.proj_id || '');
          const name = String(obj.name || obj.project_name || obj.title || '');
          if (id && name) projects.push({ id, name });
        }

        if (projects.length > 0) {
          console.log(`[Mantis] ✅ get_project_collection 成功，${projects.length} 个项目`);
          return projects;
        }
      }
    }
  } catch {
    // 忽略
  }

  // ── 策略 C: 解析 HTML 页面中的项目下拉框 ──
  const scrapeHtml = (html: string): { id: string; name: string }[] => {
    const projects: { id: string; name: string }[] = [];
    const optionRegex = /<option\s+value\s*=\s*["'](\w+)["'][^>]*>([^<]+)<\/option>/gi;
    let match: RegExpExecArray | null;
    while ((match = optionRegex.exec(html)) !== null) {
      const id = match[1];
      const name = match[2].trim();
      if (id === '0' || id === '-1' || id === 'ALL' || name === '所有项目' || name === 'All Projects') continue;
      projects.push({ id, name });
    }
    return projects;
  };

  const htmlPages = [
    '/my_view_page.php',
    '/',
  ];

  for (const page of htmlPages) {
    const url = `/api/mantis${page}?_mc=${encodedCookie}`;
    console.log(`[Mantis] 抓取 HTML: ${page}`);
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      if (!resp.ok || !html.trim()) continue;
      if (html.includes('login_page.php') || html.includes('username-field')) {
        throw new Error('Cookie 已过期，被重定向到登录页');
      }
      const projects = scrapeHtml(html);
      if (projects.length > 0) {
        console.log(`[Mantis] ✅ 从 ${page} HTML 提取到 ${projects.length} 个项目`);
        return projects;
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('Cookie 已过期')) throw e;
    }
  }

  throw new Error(
    '未能获取项目列表。请尝试：\n'
    + '1. 刷新 Mantis 页面后重新获取 Cookie\n'
    + '2. 或手动添加项目（点下拉框"手动添加项目"）',
  );
}

// ---- 日期工具 ----

/**
 * 将 Mantis 图表日期标签转为 ISO 周格式 (2026-W01)
 * 兼容: 2026-01-01, 2026-01, 2026/01, Jan 01 等，无法解析返回原值
 */
function toISOWeek(dateStr: string): string {
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const target = new Date(d.valueOf());
    const dayNr = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setUTCMonth(0, 1);
    if (target.getUTCDay() !== 4) {
      target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
    }
    const weekNo = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    const year = new Date(firstThursday).getUTCFullYear();
    return `${year}-W${String(weekNo).padStart(2, '0')}`;
  }
  const m = dateStr.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return toISOWeek(`${m[1]}-${m[2].padStart(2, '0')}-15`);
  const s = dateStr.match(/^(\d{4})\/(\d{1,2})$/);
  if (s) return toISOWeek(`${s[1]}-${s[2].padStart(2, '0')}-15`);
  return dateStr;
}

/**
 * 拉取 Defect Index 摘要（DI值 + 分类分布）
 */
export async function fetchDefectSummary(config: MantisConfig): Promise<DefectSummary> {
  const [page0, page1] = await Promise.all([
    fetchMantisPage(config, 'Defect Index', 0),
    fetchMantisPage(config, 'Defect Index', 1),
  ]);

  // 从图表提取趋势数据（日期 + DI值）
  let diValue = 0;
  const trend: DefectSummary['trend'] = [];
  const chartData = page0?.data?.[0]?.data as Record<string, unknown> | undefined;
  const chartSeries = chartData?.series as Record<string, unknown>[] | undefined;
  const chartCategories = chartData?.categories as string[] | undefined;
  const seriesData = chartSeries?.[0]?.data as number[] | undefined;

  if (Array.isArray(chartCategories) && Array.isArray(seriesData)) {
    const len = Math.min(chartCategories.length, seriesData.length);
    for (let i = 0; i < len; i++) {
      trend.push({ date: toISOWeek(chartCategories[i]), value: Math.round(seriesData[i] * 10) / 10 });
    }
    diValue = seriesData[seriesData.length - 1] || 0;
  } else if (Array.isArray(seriesData) && seriesData.length > 0) {
    // 没有 categories 但有 series，用索引作为日期
    diValue = seriesData[seriesData.length - 1] || 0;
    for (let i = 0; i < seriesData.length; i++) {
      trend.push({ date: `#${i + 1}`, value: Math.round(seriesData[i] * 10) / 10 });
    }
  }

  console.log('[Mantis] Defect Index 趋势:', JSON.stringify(trend.slice(0, 10)).slice(0, 500));

  // 从表格提取 DI 分类分布
  const categories: DefectSummary['categories'] = [];
  const tableData = page1?.data?.[0]?.data;
  const rows: Record<string, number | string>[] = tableData?.data || [];

  const resolvedKeys = ['已解决', '已关闭', 'closed', 'resolved'];

  for (const row of rows) {
    const name = String(row.category || row.handler || Object.values(row)[0] || '');
    let total = 0;
    let unresolved = 0;
    let resolved = 0;

    for (const key of Object.keys(row)) {
      if (key === 'category' || key === 'handler' || key === 'desc') continue;
      const val = Number(row[key]) || 0;
      if (key === 'all_status') {
        total = val;
      } else if (resolvedKeys.some((k) => key.includes(k))) {
        resolved += val;
      } else {
        unresolved += val;
      }
    }

    categories.push({ name, di: total, unresolved, resolved });
  }

  const totalDi = categories.reduce((s, c) => s + c.di, 0);
  const unresolvedDi = categories.reduce((s, c) => s + c.unresolved, 0);
  const resolvedDi = categories.reduce((s, c) => s + c.resolved, 0);
  const resolutionRate = totalDi > 0 ? Math.round((resolvedDi / totalDi) * 1000) / 10 : 0;

  return {
    diValue: Math.round(diValue * 10) / 10,
    totalDi: Math.round(totalDi * 10) / 10,
    unresolvedDi: Math.round(unresolvedDi * 10) / 10,
    resolvedDi: Math.round(resolvedDi * 10) / 10,
    resolutionRate,
    categories,
    trend,
  };
}

// ---- 基本统计 ----

/**
 * 拉取基本统计：bug 总个数、遗留个数、解决率
 *
 * Mantis 返回结构：
 *   data[0].data = { columns, headers, data_schema, data: [{ total, status_distribution, resolved_pct }] }
 *   data[0].data.data[0].total                               → 14
 *   data[0].data.data[0].status_distribution.已解决.c         → 1
 *   data[0].data.data[0].resolved_pct                        → "7.14%"
 *   遗留 = total - 已解决.c
 */
/**
 * 从单页 Mantis 响应中提取基本统计数据
 */
function extractBasicStatsFromPage(page: Record<string, unknown>): {
  totalBugs: number; resolvedBugs: number; unresolvedBugs: number; resolutionRate: number;
} | null {
  const dataEntries = page?.data as unknown[] | undefined;
  if (!Array.isArray(dataEntries)) return null;

  for (let i = 0; i < dataEntries.length; i++) {
    const entry = dataEntries[i] as Record<string, unknown> | undefined;
    const wrapper = entry?.data as Record<string, unknown> | undefined;
    if (!wrapper) continue;

    for (const fieldName of ['data', 'merged_data']) {
      const rows = wrapper[fieldName] as Record<string, unknown>[] | undefined;
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const row0 = rows[0];
      if (!row0) continue;

      const rowTotal = Number(row0.total);
      if (rowTotal > 0) {
        const sd = row0.status_distribution as Record<string, { c: number }> | undefined;
        const resolved = Number(sd?.['已解决']?.c) || 0;
        const unresolved = Math.max(0, rowTotal - resolved);
        const pctStr = String(row0.resolved_pct || '');
        const pctMatch = pctStr.match(/([\d.]+)/);
        const rate = pctMatch ? parseFloat(pctMatch[1]) : (rowTotal > 0 ? Math.round((resolved / rowTotal) * 1000) / 10 : 0);
        console.log(`[Mantis] ✅ 基本统计解析成功 (dataEntries[${i}].${fieldName}[0]) → total=${rowTotal}, resolved=${resolved}, rate=${rate}%`);
        return { totalBugs: rowTotal, resolvedBugs: resolved, unresolvedBugs: unresolved, resolutionRate: rate };
      }
    }
  }
  return null;
}

export async function fetchBasicStats(config: MantisConfig): Promise<BasicStats> {
  // 先取 index=0
  let page = await fetchMantisPage(config, '基本统计', 0);
  console.log('[Mantis] 基本统计 原始响应(index=0):', JSON.stringify(page).slice(0, 2000));

  let result = extractBasicStatsFromPage(page);

  // 如果 index=0 没数据但 next_index 不为 null，继续翻页
  let nextIndex = page?.next_index as number | null | undefined;
  let pageIdx = 0;
  while (!result && nextIndex != null) {
    pageIdx++;
    console.log(`[Mantis] 基本统计 index=${pageIdx - 1} 无数据，尝试 next_index=${nextIndex}`);
    page = await fetchMantisPage(config, '基本统计', nextIndex);
    console.log(`[Mantis] 基本统计 原始响应(index=${nextIndex}):`, JSON.stringify(page).slice(0, 2000));
    result = extractBasicStatsFromPage(page);
    nextIndex = page?.next_index as number | null | undefined;
    if (pageIdx > 5) break; // 安全上限
  }

  if (result) {
    return { ...result, raw: page };
  }

  console.log('[Mantis] ⚠️ 基本统计遍历所有分页未找到有效数据，返回全零');
  return { totalBugs: 0, unresolvedBugs: 0, resolvedBugs: 0, resolutionRate: 0, raw: page };
}
