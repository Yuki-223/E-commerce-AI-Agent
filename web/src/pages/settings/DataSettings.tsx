import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClearHistoryDialog } from '../../components/layout/ClearHistoryDialog'
import { HistoryManagerDialog } from '../../components/layout/HistoryManagerDialog'
import { useCart } from '../../hooks/useCart'
import { useConversations } from '../../stores/conversations'
import { useSettings } from '../../stores/ui'
import { BUTTON, BUTTON_DANGER, Row, Section } from './ui'

/** 数据与存储: what lives on this device, in the spirit of claude.ai's privacy tab. */
export function DataSettings() {
  const navigate = useNavigate()
  const closeSettings = useSettings((s) => s.close)
  const { data: cart } = useCart()
  const count = useConversations((s) => Object.values(s.conversations).filter((c) => c.messages.length).length)
  const [manage, setManage] = useState(false)
  const [clear, setClear] = useState(false)

  return (
    <>
      <Section title="历史对话" description="历史对话只保存在这台设备的浏览器里，换设备或清除网站数据后不会保留。">
        <Row label="管理历史对话" hint={count ? `共 ${count} 段对话` : '还没有历史对话'}>
          <button type="button" disabled={!count} onClick={() => setManage(true)} className={BUTTON}>
            管理
          </button>
        </Row>
        <Row label="清空全部历史" hint="删除这台设备上的所有对话，不能撤销">
          <button type="button" disabled={!count} onClick={() => setClear(true)} className={BUTTON_DANGER}>
            全部清空
          </button>
        </Row>
      </Section>
      <Section title="购物车">
        <Row label="共用购物车" hint={`所有偏好档案共用一个购物车，现有 ${cart?.cart.item_count ?? 0} 件商品`}>
          <button type="button" onClick={() => (closeSettings(), navigate('/cart'))} className={BUTTON}>
            查看购物车
          </button>
        </Row>
      </Section>
      {manage && <HistoryManagerDialog onClose={() => setManage(false)} />}
      {clear && <ClearHistoryDialog onClose={() => setClear(false)} />}
    </>
  )
}
