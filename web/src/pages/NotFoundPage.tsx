import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex grow flex-col items-center justify-center gap-3">
      <h1 className="m-0 text-xl font-semibold">页面不存在</h1>
      <Link to="/" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary no-underline hover:text-on-primary">回到首页</Link>
    </div>
  )
}
