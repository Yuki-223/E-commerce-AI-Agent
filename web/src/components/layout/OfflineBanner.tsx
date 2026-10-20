import { useBackendHealth } from '../../hooks/useBackendHealth'
import { Collapse } from '../Collapse'
import { IconWifiOff } from '../Icons'

/** WebStates ⑤: shown while /health fails, removed automatically on recovery; opens and closes its height. */
export function OfflineBanner() {
  const { unreachable, checking, recheck } = useBackendHealth()
  return (
    <Collapse show={unreachable} className="shrink-0">
      <div
        role="alert"
        className="mx-3 mt-3 flex items-center gap-2.5 rounded-[14px] md:mx-6 border border-[rgba(194,78,58,0.35)] bg-surface px-3.5 py-3 shadow-[0_4px_12px_rgba(43,30,18,0.04)]"
      >
        <IconWifiOff className="shrink-0 text-error-text" />
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <div className="text-sm font-semibold">后端服务未连接</div>
          <div className="text-xs leading-[17px] text-ink-muted">请在电脑上运行 ./scripts/dev.sh 启动后端（支持热重载）。</div>
        </div>
        <button
          type="button"
          onClick={() => recheck()}
          disabled={checking}
          className="h-8 shrink-0 rounded-2xl bg-primary px-3.5 text-[13px] font-semibold text-on-primary disabled:opacity-70"
        >
          {checking ? '检测中…' : '重试连接'}
        </button>
      </div>
    </Collapse>
  )
}
