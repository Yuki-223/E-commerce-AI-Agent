import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/http'
import { api } from '../api/endpoints'
import { CARD, PageFrame, Pills } from '../components/layout/PageFrame'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { BUTTON_PRIMARY, FIELD } from './settings/ui'
import { isSeller, useAuth } from '../stores/auth'
import { toast } from '../stores/toast'

type Mode = 'login' | 'register'

/**
 * 登录 / 注册. A shopper account gets its own cart, orders and addresses; a
 * merchant account also opens a shop and lands in the merchant console.
 * `?next=/merchant` returns there afterwards.
 */
export function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const signIn = useAuth((s) => s.signIn)
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login')
  const [role, setRole] = useState<'customer' | 'merchant'>(params.get('role') === 'merchant' ? 'merchant' : 'customer')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [shopName, setShopName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useDocumentTitle(mode === 'login' ? '登录' : '注册')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res =
        mode === 'login'
          ? await api.login(username.trim(), password)
          : await api.register({ username: username.trim(), password, nickname: nickname.trim() || null, role, shop_name: role === 'merchant' ? shopName.trim() : null })
      signIn(res.token, res.account)
      toast({ tone: 'success', title: mode === 'login' ? '登录成功' : '注册成功', detail: `欢迎，${res.account.nickname}` })
      navigate(params.get('next') || (isSeller(res.account) ? '/merchant' : '/'), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '请稍后再试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageFrame title={mode === 'login' ? '登录' : '注册账号'}>
      <form onSubmit={(e) => void submit(e)} className={`${CARD} mx-auto flex w-full max-w-[420px] flex-col gap-4 p-6`}>
        <Pills<Mode>
          label="登录或注册"
          value={mode}
          onChange={(m) => (setMode(m), setError(null))}
          options={[
            { value: 'login', label: '登录' },
            { value: 'register', label: '注册' },
          ]}
        />
        {mode === 'register' && (
          <fieldset className="m-0 flex gap-2 border-0 p-0">
            <legend className="mb-2 text-[13px] text-ink-muted">账号类型</legend>
            {(['customer', 'merchant'] as const).map((r) => (
              <label key={r} className={`flex grow cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${role === r ? 'border-primary bg-primary-soft font-semibold' : 'border-line-strong'}`}>
                <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} className="m-0 accent-[var(--primary)]" />
                {r === 'customer' ? '我是顾客' : '我是商家'}
              </label>
            ))}
          </fieldset>
        )}
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
          用户名
          <input className={FIELD} autoComplete="username" required minLength={3} maxLength={32} value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
          密码
          <input className={FIELD} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {mode === 'register' && (
          <>
            <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
              昵称（可选）
              <input className={FIELD} maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </label>
            {role === 'merchant' && (
              <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
                店铺名称
                <input className={FIELD} required maxLength={40} value={shopName} onChange={(e) => setShopName(e.target.value)} />
              </label>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="m-0 text-[13px] text-error-text">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={`${BUTTON_PRIMARY} h-10 text-[15px]`}>
          {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
        <p className="m-0 text-xs leading-[18px] text-ink-subtle">
          不登录也能直接用：购物车和订单会记在共享的体验账号下。<Link to="/">先逛逛 →</Link>
        </p>
      </form>
    </PageFrame>
  )
}
