import { useQuery } from '@tanstack/react-query'
import { api } from './api/endpoints'
import { USE_MOCK } from './api/http'

export function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: ({ signal }) => api.health(signal), retry: false })
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg">
      <div className="font-logo text-[34px] tracking-[0.3px]">CartPilot</div>
      <div className="text-sm font-medium text-ink-subtle">购物导购 · 网页版骨架</div>
      <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-card">
        <span className="text-ink-muted">GET /api/health → </span>
        <code className="font-semibold text-primary-text">
          {health.isPending ? '…' : health.isError ? `失败：${(health.error as Error).message}` : JSON.stringify(health.data)}
        </code>
        <span className="ml-2 rounded-md bg-soft-purple px-2 py-0.5 text-xs text-primary-text">{USE_MOCK ? '模拟数据' : '真实后端'}</span>
      </div>
    </div>
  )
}
