import { useAddresses } from '../../hooks/useCommerce'
import { useSettings } from '../../stores/ui'

/**
 * Checkout address choice. `null` lets the backend use the default
 * address-book entry (or the demo address when the book is empty).
 */
export function AddressPicker({ value, onChange }: { value: number | null; onChange: (id: number | null) => void }) {
  const { data } = useAddresses()
  const openSettings = useSettings((s) => s.open)
  const addresses = data?.addresses ?? []
  return (
    <div className="flex flex-col gap-1.5 text-[13px]">
      <div className="flex items-center">
        <span className="grow text-ink-muted">收货地址</span>
        <button type="button" onClick={() => openSettings('addresses')} className="p-0 text-[13px] text-primary-text">
          {addresses.length ? '管理' : '添加地址'}
        </button>
      </div>
      {addresses.length ? (
        <select
          aria-label="收货地址"
          value={value ?? addresses.find((a) => a.is_default)?.address_id ?? addresses[0].address_id}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-[13px] text-ink outline-none focus:border-primary"
        >
          {addresses.map((a) => (
            <option key={a.address_id} value={a.address_id}>
              {a.recipient} · {`${a.region} ${a.detail}`.trim()}
              {a.is_default ? '（默认）' : ''}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-xs leading-[18px] text-ink-subtle">还没有收货地址，将寄往演示地址。</span>
      )}
    </div>
  )
}
