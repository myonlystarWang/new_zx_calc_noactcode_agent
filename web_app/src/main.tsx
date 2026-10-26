import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { reportFontHealth } from './utils/track'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 字体健康度上报：判断 Google Fonts 在国内到底能不能加载（每次会话一次）
reportFontHealth()
