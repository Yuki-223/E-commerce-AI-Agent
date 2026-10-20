import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/http'
import type { Address, AddressRequest } from '../../api/types'
import { useAddresses, useAddressMutations } from '../../hooks/useCommerce'
import { useAuth } from '../../stores/auth'
import { useSettings } from '../../stores/ui'
import { toast } from '../../stores/toast'
import { BUTTON, BUTTON_DANGER, BUTTON_PRIMARY, FIELD, SECTIONS, Section } from './ui'

const EMPTY: AddressRequest = { recipient: '', phone: '', region: '', detail: '', is_default: false }

function AddressForm({ initial, onDone }: { initial?: Address; onDone: () => void }) {
  const [draft, setDraft] = useState<AddressRequest>(initial ? { ...initial } : EMPTY)
  const { create, update } = useAddressMutations()
  const busy = create.isPending || update.isPending
  const set = (key: keyof AddressRequest) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [key]: key === 'is_default' ? e.target.checked : e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (initial) await update.mutateAsync({ id: initial.address_id, req: draft })
      else await create.mutateAsync(draft)
      onDone()
    } catch (err) {
      toast({ tone: 'error', title: '保存地址失败', detail: err instanceof ApiError ? err.message : '请检查填写内容' })
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 rounded-xl border border-line-strong p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={FIELD} placeholder="收货人" required maxLength={32} value={draft.recipient} onChange={set('recipient')} aria-label="收货人" />
        <input className={FIELD} placeholder="手机号" required minLength={5} maxLength={20} inputMode="tel" value={draft.phone} onChange={set('phone')} aria-label="手机号" />
      </div>
      <input className={FIELD} placeholder="所在地区，如 北京市朝阳区" maxLength={64} value={draft.region} onChange={set('region')} aria-label="所在地区" />
      <input className={FIELD} placeholder="详细地址" required maxLength={200} value={draft.detail} onChange={set('detail')} aria-label="详细地址" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={draft.is_default} onChange={set('is_default')} className="m-0 h-4 w-4 accent-[var(--primary)]" />
        设为默认地址
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className={BUTTON} onClick={onDone}>
          取消
        </button>
        <button type="submit" disabled={busy} className={BUTTON_PRIMARY}>
          保存
        </button>
      </div>
    </form>
  )
}

/** 收货地址 settings tab: the address book checkout picks from (/addresses). */
export function AddressSettings() {
  const account = useAuth((s) => s.account)
  const closeSettings = useSettings((s) => s.close)
  const { data, isPending } = useAddresses()
  const { update, remove } = useAddressMutations()
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const addresses = data?.addresses ?? []

  return (
    <div className={SECTIONS}>
      <Section
        title="收货地址"
        description={account ? `账号 ${account.username} 的地址簿，结算时默认使用默认地址。` : '未登录时地址记在共享体验账号下，登录后各自独立。'}
        action={
          editing === null && (
            <button type="button" className={BUTTON_PRIMARY} onClick={() => setEditing('new')}>
              新增地址
            </button>
          )
        }
      >
        {!account && (
          <p className="m-0 text-[13px] text-ink-muted">
            <Link to="/login?next=/orders" onClick={closeSettings}>
              登录或注册
            </Link>
            后可以保存自己的地址。
          </p>
        )}
        {editing === 'new' && <AddressForm onDone={() => setEditing(null)} />}
        {isPending ? (
          <p className="m-0 text-sm text-ink-muted">正在加载…</p>
        ) : addresses.length === 0 && editing !== 'new' ? (
          <p className="m-0 text-sm text-ink-muted">还没有收货地址。</p>
        ) : (
          addresses.map((a) =>
            editing === a.address_id ? (
              <AddressForm key={a.address_id} initial={a} onDone={() => setEditing(null)} />
            ) : (
              <div key={a.address_id} className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="text-[15px] font-medium">
                    {a.recipient} · {a.phone}
                    {a.is_default && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary-text">默认</span>}
                  </span>
                  <span className="text-[13px] text-ink-muted">{`${a.region} ${a.detail}`.trim()}</span>
                </div>
                {!a.is_default && (
                  <button type="button" className={BUTTON} onClick={() => update.mutate({ id: a.address_id, req: { is_default: true } })}>
                    设为默认
                  </button>
                )}
                <button type="button" className={BUTTON} onClick={() => setEditing(a.address_id)}>
                  编辑
                </button>
                <button type="button" className={BUTTON_DANGER} onClick={() => remove.mutate(a.address_id)}>
                  删除
                </button>
              </div>
            ),
          )
        )}
      </Section>
    </div>
  )
}
