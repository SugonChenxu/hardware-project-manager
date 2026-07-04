export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">硬件项目管理系统</h1>
      <p className="mt-4 text-xl">基于 PLM 逻辑的项目计划与进度跟踪工具</p>
      <a
        href="/plan"
        className="mt-8 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        进入项目计划
      </a>
    </main>
  )
}
