# 天书万象 AI · 首页视觉规范与 CSS 设计系统

本文档定义了天书万象 AI（诛仙全知大模型）首页的整体视觉工程规范、CSS 设计系统、排印层级、动态周期及响应式布局规则，作为全站核心主页的标准设计资产。

---

## 一、排印与字体系统 (Typography Spec)

### 1.1 字体家族标准
- **全站主要无衬线字体（Sans-Serif）**：
  `'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  用于全页面导航、主标题、输入框、微工具药丸、页脚及常规正文。
  严禁在页脚中文英文混排时使用等宽字体（如 `font-mono` / `Consolas`），避免中文字形回退导致高低错落、大小不一。
- **古典诗句衬线字体（Serif）**：
  `'Noto Serif SC', 'Source Han Serif SC', serif`
  用于副标题诗句（`天地不仁以万物为刍狗 · 天书通晓诛仙万象规则`），增强国风玄幻与大道无形的仪式感。

### 1.2 首页字阶梯队 (Type Scale)

| 元素 | 桌面端字号 | 移动端字号 | 字重 (Weight) | 字距 (Tracking) | 色彩/渐变 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Header 品牌字** | 18px (`text-lg`) | 16px (`text-base`) | 900 (`font-black`) | `-0.025em` (`tracking-tight`) | 青-紫-金三色渐变 |
| **主标题 (H1)** | 34px (`text-[34px]`) | 24px (`text-2xl`) | 900 (`font-black`) | `-0.025em` (`tracking-tight`) | 极光流光渐变 (`aurora-text`) |
| **副标题诗句** | 14px (`text-sm`) | 12px (`text-xs`) | 400 (`font-normal`) | `0.22em` (`tracking-[0.22em]`) | `text-slate-400` + 微阴影 |
| **输入框文本** | 14px (`text-sm`) | 14px (`text-sm`) | 400 (`font-normal`) | `0` | `text-slate-100` / 占位符 `text-slate-500` |
| **快捷药丸文本** | 12px (`text-xs`) | 12px (`text-xs`) | 500 (`font-medium`) | `0` | `text-slate-300 hover:text-cyan-300` |
| **页脚版权与署名** | 12px (`text-xs`) | 12px (`text-xs`) | 400 (`font-normal`) | `0` (`tracking-normal`) | 版权 `text-slate-500`，作者 `text-slate-400 hover:text-slate-200` |

---

## 二、色彩与材质体系 (Color & Material Tokens)

### 2.1 深空背景基底
- **黑曜纯墨基底**：`#05080f`（100% 不透明，根除浏览器默认白底透光）
- **深空星云径向渐变**：
  `radial-gradient(circle at 50% 38%, #0b1325 0%, #070d19 45%, #05080f 85%)`
- **悬浮面板材质**：`rgba(9, 13, 24, 0.95)` + `backdrop-filter: blur(16px)`

### 2.2 渐变系统 (Gradients)
- **极光流光文字 (`aurora-text`)**：
  `linear-gradient(135deg, #a5f3fc 0%, #ffffff 40%, #fde68a 85%, #fbbf24 100%)`
- **玄青灵光渐变**：`linear-gradient(135deg, #67e8f9 0%, #22d3ee 50%, #0891b2 100%)`
- **浅金道芒渐变**：`linear-gradient(135deg, #fde68a 0%, #fbbf24 50%, #d97706 100%)`
- **天书混元渐变**：`linear-gradient(135deg, #22d3ee 0%, #818cf8 50%, #fbbf24 100%)`
- **发光渐变日冕光弧**：
  `linear-gradient(135deg, rgba(56, 189, 248, 0.95) 0%, rgba(129, 140, 248, 0.75) 45%, rgba(251, 191, 36, 0.25) 85%, transparent 100%)`

---

## 三、动效与天体自转周期体系 (Celestial Motion Spec)

遵循**阴阳交感与天体自转/公转对冲**的运动哲学，外环逆向公转巡弋，内芯顺向自转：

| 动效层级 | 目标元素 | 旋转方向 | 周期 / 速度 | 视觉意向 |
| :--- | :--- | :--- | :--- | :--- |
| **外层巡弋轨道** | 日全食贝利珠纯白弧 (`r=88`) | 逆时针 (CCW) | 22s 恒速 | 纯白日蚀贝利珠与耀斑引力场 |
| **内层追逐轨道** | 玄青至浅金日冕弧 (`r=78`) | 逆时针 (CCW) | 14s 恒速 | 内圈快速巡弋，与外圈形成 10px 间距的双星视差追逐 |
| **八卦星宿刻度** | 虚线金环与点状青环 | 逆时针 (CCW) | 26s 恒速 | 古代浑天仪周天星度运转 |
| **天体核心内芯** | 天书 Logo 整体矢量图腾 | 顺时针 (CW) | 18s 恒速 | 核心太极星轮阴阳平衡顺旋 |
| **微动效 1** | 神经突触数据流虚线 | 沿线流动 | 1.6s 恒速 | 量子突触数据流高速流动 (`stroke-dashoffset: -24`) |
| **微动效 2** | 神经元突触光斑节点 | 交替缩放 | 2.2s 缓动 | 神经网络激活电位呼吸交替 (`1.0x <-> 1.3x`) |
| **微动效 3** | 中央全知天目星芒 | 脉冲聚光 | 2.4s 缓动 | 全知天眼探测微聚光 (`drop-shadow` 脉动) |
| **微动效 4** | 天书竹简简牍光束 | 明暗律动 | 3.6s 缓动 | 远古竹简简牍的灵力潮汐呼吸 (`0.55 <-> 0.95 opacity`) |
| **微动效 5** | 太极双鱼玄气流水线 | 粗细与微光 | 4.0s 缓动 | 太极气脉充盈与流转 (`stroke-width: 1.4 <-> 1.9`) |

---

## 四、垂直空间与间距节奏规范 (Vertical Rhythm Spec)

从宏观意境到操作工具严格呈现**递进收敛**节奏，视觉重心微上浮 8px：

```
[ Header: ~60px (Sticky) ]
       |
       | 呼吸留白空间 (自适应)
       v
[ 浑天月相天体图腾: 288px (256px on mobile) ]
       |
       | --- 30px 光学呼吸间距 (天体神秘感 -> 品牌命名承接)
       v
[ 主副标题区: ~68px (H1 34px + 诗句 14px) ]
       |
       | --- 24px 认知与操作过渡间距
       v
[ 现代化输入框: ~56px (max-w-2xl / 3xl) ]
       |
       | --- 12px 从属辅助紧密间距
       v
[ 快捷微工具胶囊药丸: ~32px ]
       |
       | 底部留白空间 (自适应)
       v
[ 渐隐分割线 + 极简单行页脚: ~50px ]
```

---

## 五、单行页脚规范 (Single-line Apple Minimalist Footer Spec)

- **排印内容**：
  `© 2026 天书万象 AI · Created with pride by 星耀-萝卜`
- **视觉约束**：
  - 严禁出现冗余的外包边框（如 Pill 胶囊底衬、描边方框）。
  - 严禁强制弹出侵入式悬浮卡片。
  - 字体大小与粗细保持一致（`text-xs`，常规字重），`星耀-萝卜` 采用高明度对比（`text-slate-400 hover:text-slate-200`），实现高级的克制突显。
  - 顶部采用**两端渐隐细线**（`from-transparent via-white/10 to-transparent`），不阻断深空星河画布。
