import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { reportFontHealth, trackSessionStart } from './utils/track'

// 会话基线：每会话一次，是所有比例的分母（也是 PWA 装机率的唯一来源）
trackSessionStart()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 字体健康度上报：Serif（主标题）分片是否加载，每会话一次
reportFontHealth()
