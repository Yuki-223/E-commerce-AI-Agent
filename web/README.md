# CartPilot 网页版

React + Vite + TypeScript + Tailwind。安装和运行见仓库根目录 README.zh-CN.md 的「6. 运行网页版」。

## 在模拟模式下复现各种状态（对照 WebStates.dc.html）

模拟模式（`VITE_USE_MOCK=1`）下，在任意地址后加 `?mock=…`，或在浏览器控制台调用 `__cartpilotMock`：

| 状态 | 怎么触发 |
| --- | --- |
| ① 加载中 | 正常发送一条消息；`?mock=slow` 或 `__cartpilotMock.slow(true)` 让每一步慢 4 倍，方便观察。上传图片时显示「正在识别图片…」 |
| ② 流式中 · 回到最新 | 回答还在输出时向上滚动，底部出现「回到最新」 |
| ③ 出错可重试 | `?mock=fail` 或 `__cartpilotMock.failNext()`：下一次对话返回 SSE `error` 事件，点「重新尝试」 |
| ④ 连接中断自动重试 | 发送前 `__cartpilotMock.offline(true)`，几秒内再 `offline(false)`：显示「连接中断，正在第 N 次重试」后自动恢复 |
| ⑤ 后端未连接 | `?mock=offline` 或 `__cartpilotMock.offline(true)`；`offline(false)` 后横条自动消失 |
| ⑥ 历史管理 | 侧栏对话行的 ⋯ 菜单（重命名 / 删除），侧栏底部「清空全部历史」，或账户菜单「管理历史对话」 |
| ⑦ 购物车为空 | 打开 `/cart`，或 `__cartpilotMock.reset()` 清空所有模拟数据 |
| ⑧ 偏好撤销 | 说「我预算 500 以内」后点「撤销」；先 `offline(true)` 再点撤销可看到「撤销失败」 |

`__cartpilotMock.reset()` 会清掉模拟的购物车、偏好、会话和开关。
