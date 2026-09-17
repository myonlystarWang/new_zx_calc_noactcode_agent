# 网站优化方案 · 深度审计报告

> 审计时间：2026-09-16
> 审计范围：逐条核实 [`网站优化方案_20260916.md`](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/doc/网站优化方案_20260916.md) 中的每一项建议，验证代码引用、判断正误、补充遗漏

---

## 一、总体审计结论

| 维度 | 结论 |
|------|------|
| **原方案准确性** | ✅ **约 90% 属实且高质量**，代码引用行号基本准确，问题判断到位 |
| **有误/需修正项** | ⚠️ **1 处判断不准确**（彗星 Canvas rAF 问题被夸大） |
| **我新增的补充** | 📝 **7 项遗漏补充**（见下方） |
| **与用户讨论后调整** | 🔧 **5 项方向调整**（见下方） |

---

## 二、逐项核实结果

### 2.1 ✅ 全部属实的项目（无需修改）

| 方案条目 | 代码验证 | 判定 |
|----------|----------|------|
| 无路由、useState 切 tab | [App.tsx:17](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/App.tsx#L17) 确认 `useState<AppTab>` | ✅ 属实 |
| 刷新回首页 | 仅 localStorage 存 `zx_active_tab`，无 URL 状态 | ✅ 属实 |
| 无 react-router 依赖 | [package.json](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/package.json) 未列 react-router | ✅ 属实 |
| `bg-slate-850` 无效类 | [Header.tsx:67](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/layout/Header.tsx#L67) + [tailwind.config.js](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/tailwind.config.js) 未自定义 | ✅ Bug确认 |
| DataService 无 try/catch | [DataService.ts:99-108](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/services/DataService.ts#L99-L108) `Promise.all` 无错误处理；[AppContext.tsx:68-92](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/context/AppContext.tsx#L68-L92) 也无 catch | ✅ Bug确认 |
| Footer 版权写死 2024 | [Footer.tsx:53](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/layout/Footer.tsx#L53) `© 2024` | ✅ 属实 |
| Footer 仅微信 | [Footer.tsx](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/layout/Footer.tsx) 确认 | ✅ 属实 |
| Header 3 Tab vs 首页 5 卡片 | [Header.tsx:56-74](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/layout/Header.tsx#L56-L74) vs [HomePage.tsx:642-776](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/home/HomePage.tsx#L642-L776) | ✅ 属实 |
| 移动端无汉堡菜单 | [Header.tsx:55](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/layout/Header.tsx#L55) `overflow-x-auto no-scrollbar` | ✅ 属实 |
| 无导出功能 | grep `html2canvas`/`toPng`/`navigator.share` 全无结果 | ✅ 属实 |
| 无 ErrorBoundary | grep `ErrorBoundary` 全无结果 | ✅ 属实 |
| `index.html` lang="en" | [index.html:2](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/index.html#L2) `<html lang="en">` | ✅ 属实 |
| 缺 meta description/og | [index.html](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/index.html) 仅有 charset/viewport/title | ✅ 属实 |
| vite.config.ts 无分包 | [vite.config.ts](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/vite.config.ts) 仅 `plugins: [react()]`，无 `manualChunks` | ✅ 属实 |
| 无 robots.txt / sitemap.xml | [public/](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/public) 仅有 `arena/`、`game_data/`、`vite.svg`、`zhuxian.ico` | ✅ 属实 |
| 无 manifest / serviceWorker | grep 全无结果 | ✅ 属实 |
| busuanzi 第三方统计 | [Header.tsx:12-21](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/layout/Header.tsx#L12-L21) 确认注入 `busuanzi.ibruce.info` | ✅ 属实 |
| a11y 缺 aria-label | 全站仅 [SimulationArena.tsx:1163](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/arena/SimulationArena.tsx#L1163) 一处有 | ✅ 属实 |
| 仅存单套方案 | localStorage 仅存 `zx_user_character`（单套）、`zx_active_buffs`、`zx_buff_values` | ✅ 属实 |

### 2.2 ⚠️ 判断不准确的项目

#### 彗星 Canvas rAF 问题（方案第四节 🟡）

> [!WARNING]
> **原方案说法**：「切走时仅 `opacity:0`，Canvas 动画循环未停，后台持续占 CPU」——**这个描述不够准确**。

**实际代码行为**：
- [HomePage.tsx:287-290](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/home/HomePage.tsx#L287-L290)：当用户切到其他 App Tab（计算器/模拟/资料库）时，React 会**卸载 HomePage 组件**，cleanup 函数中的 `cancelAnimationFrame(animId)` 会执行，rAF 循环**完全停止**。
- [HomePage.tsx:221](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/home/HomePage.tsx#L221)：`!document.hidden` 条件会跳过绘制，但 rAF 循环本身仍在运行。
- [HomePage.tsx:296](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/home/HomePage.tsx#L296)：聚焦搜索框时设 `opacity:0`。

**修正后的判断**：
- ❌ 「切走时」→ 应改为「**用户在首页但切换到其他浏览器标签页时**」
- 影响范围比原方案描述的要**小得多**——仅限于用户停留在首页、但切到其他浏览器标签页的场景
- 仍然建议优化（监听 `visibilitychange` 事件在 `document.hidden` 时暂停 rAF），但优先级可以降到 🟢

---

## 三、我新增的补充项目（原方案遗漏）

> [!NOTE]
> 以下是原方案未提到但我在代码审计中发现的问题，建议补充到优化方案中。

### 📝 补充 1：`package.json` 版本号未维护

- **位置**：[package.json:4](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/package.json#L4)
- **问题**：版本号写死 `"version": "0.0.0"`，而 Header 显示 `V 2.1.1`。两者不一致，且 Header 中的版本号也是硬编码。
- **建议**：统一从 `package.json` 读取版本号，或至少保持两处一致。可考虑 Vite `define` 注入 `__APP_VERSION__`。

### 📝 补充 2：`localStorage.getItem` JSON.parse 无安全兜底

- **位置**：[AppContext.tsx:51-52](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/context/AppContext.tsx#L51-L52)、[55-57](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/context/AppContext.tsx#L55-L57)、[60-62](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/context/AppContext.tsx#L60-L62)
- **问题**：`JSON.parse(saved)` 无 try/catch，如果 localStorage 中存了损坏数据（如用户手动编辑/浏览器插件干扰），整个应用会白屏崩溃。
- **建议**：所有 `JSON.parse(localStorage.getItem(...))` 都应包裹 try/catch，解析失败时回退到默认值。
- **优先级**：🔴 高（与 DataService 无兜底属于同类问题）

### 📝 补充 3：DataService 各 `load*` 方法未校验 HTTP 响应状态

- **位置**：[DataService.ts:110-155](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/services/DataService.ts#L110-L155)
- **问题**：所有 `fetch` 调用后直接 `.json()`，未检查 `response.ok`。如果服务器返回 404/500，`fetch` 不会抛异常（只有网络错误才抛），但 `.json()` 会因响应体不是合法 JSON 而抛错，错误信息对用户不友好。
- **建议**：每个 fetch 后加 `if (!response.ok) throw new Error(\`...\`)`
- **优先级**：🔴 高（应与 DataService 兜底一起修复）

### 📝 补充 4：`index.html` 中 favicon 引用不一致

- **位置**：[index.html:6](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/index.html#L6)
- **问题**：favicon 链接写 `<link rel="icon" type="image/svg+xml" href="/zhuxian.ico">`，但文件是 `.ico` 格式，MIME type 却写成 `image/svg+xml`。应该是 `image/x-icon` 或 `image/vnd.microsoft.icon`。
- **建议**：修正为 `type="image/x-icon"`
- **优先级**：🟡 低（浏览器通常能正确识别，但标准写法更好）

### 📝 补充 5：搜索框无 debounce

- **位置**：[HomePage.tsx:436](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/home/HomePage.tsx#L436)
- **问题**：`onChange={(e) => setQuery(e.target.value)}` 每次按键都触发搜索索引匹配。虽然目前数据量不大（~600 条），性能尚可，但如果未来数据增长，可能出现输入卡顿。
- **建议**：可以先不改，但在数据量增长时考虑加 debounce（150ms）
- **优先级**：🟢 低（当前无性能问题）

### 📝 补充 6：Footer 的 `activeTab` 类型不一致

- **位置**：[Footer.tsx:5](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/layout/Footer.tsx#L5)
- **问题**：Footer 接受的 `activeTab` 类型包含 `'skills'`，但 App.tsx 中的 `AppTab` 类型并不包含 `'skills'`。这是一个类型不一致。
- **建议**：移除 `'skills'`，与 App.tsx 的 AppTab 类型保持一致
- **优先级**：🟡 低

### 📝 补充 7：缺少 `<noscript>` 降级提示

- **位置**：[index.html](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/index.html)
- **问题**：SPA 完全依赖 JS，但未提供 `<noscript>` 标签。如果用户禁用 JS 或 JS 加载失败，会看到空白页面。
- **建议**：在 `<div id="root">` 内部加 `<noscript>请启用 JavaScript 以使用诛仙3副本战斗实验室</noscript>`
- **优先级**：🟡 低

---

## 四、与用户讨论后的方向调整

以下项目经过与用户的 grill-me 讨论，对原方案做了方向调整：

### 🔧 调整 1：站点定位

| 原方案建议 | 调整后 |
|-----------|--------|
| 向攻略社区站（17173/NGA/小黑盒）方向发展 | **保持精品工具站定位**，逐步加攻略内容，不做重社区 |
| 评论、UGC、社区互动 | ❌ 不做。仅在 Footer 加简单的「意见反馈」入口 |
| 配装分享社区 | ❌ 不做社区功能 |

### 🔧 调整 2：路由方案

| 原方案建议 | 调整后 |
|-----------|--------|
| 推荐 History 路由 + `_redirects` | **采用 Hash 路由**（`#/compendium/boss/赤梭`），零 CF 配置，最简单稳定 |
| 三选一方案 | 选定 Hash 路由，无需 `_redirects` |

### 🔧 调整 3：导出功能

| 原方案建议 | 调整后 |
|-----------|--------|
| PNG/PDF/分享图 | **仅做 PNG 截图 + 复制链接**，不做 PDF |

### 🔧 调整 4：busuanzi vs CF Web Analytics

| 原方案建议 | 调整后 |
|-----------|--------|
| 替换为 Cloudflare Web Analytics | **保留 busuanzi**（用户需要前端展示访客数，CF Analytics 只能后台看） |

### 🔧 调整 5：用户反馈入口

| 原方案建议 | 调整后 |
|-----------|--------|
| 无（方案未涉及） | **在 Footer 微信号左边加「意见反馈」入口**，具体 UI 形式待定 |

---

## 五、修正后的落地优先级排序

基于代码审计 + 用户讨论结果，重新排列优先级：

### 🔴 P0：立即修复（Bug + 快赢，对功能无影响）

```
1. bg-slate-850 → 改为 bg-slate-800/60 等合法类
2. DataService + AppContext 加 try/catch 兜底
3. localStorage JSON.parse 加 try/catch（新增）
4. DataService fetch 加 response.ok 校验（新增）
5. Footer 版权年份 → new Date().getFullYear()
6. index.html: lang="zh-CN"、补 meta description/og/theme-color
7. index.html: favicon type 修正（新增）
8. index.html: 加 <noscript> 降级提示（新增）
9. robots.txt + sitemap.xml 放 public/
10. ErrorBoundary 包裹 AppProvider
11. 补全 aria-label
```

### 🟠 P1：高影响中工作量

```
12. Hash 路由 + 深链
13. vite.config.ts manualChunks 分包
14. 多套方案保存/切换
15. PNG 截图导出 + 复制链接
16. 更新日志页面 + 版本号角标
17. Footer 加「意见反馈」入口
```

### 🟡 P2：中影响中工作量

```
18. A/B 方案并排对比视图
19. 面包屑导航（资料库内层级）
20. Header 导航 vs 首页卡片信息架构对齐
21. 移动端汉堡菜单（优先级因用户反馈降低，手机端过得去就行）
22. Footer 补站内导航 + 数据来源/免责声明
```

### 🟢 P3：长期/低优先级

```
23. 彗星 Canvas 优化（visibilitychange 暂停 rAF，实际影响很小）
24. 攻略长文 + TOC（逐步扩展）
25. PWA / 离线
26. 搜索 debounce（当前无性能问题）
27. package.json 版本号与 Header 统一
28. Footer activeTab 类型修正
```

---

## 六、对原方案第八节 Cloudflare 部分的补充

原方案的 CF 分析非常全面。基于路由方案确定为 Hash 路由后，以下调整：

| 原方案建议 | 调整 |
|-----------|------|
| 需要 `public/_redirects` | ❌ **不需要了**——Hash 路由完全不需要任何 CF 侧配置 |
| 替换 busuanzi | ❌ **不替换**——保留 busuanzi |
| CF Cache Rule 对 `game_data/*` bypass | ✅ 保留建议，仍然需要 |
| 确认 `NODE_VERSION=22` | ✅ 保留建议 |
| `og:image` 用绝对 URL | ✅ 保留建议 |

---

## 七、原方案未涉及但值得关注的技术债

> [!TIP]
> 以下不紧急但值得记录的技术债：

1. **DataService 单例模式的可测试性**：当前的单例 + 全局状态让单元测试困难，但对当前项目规模来说可以接受。
2. **组件文件过大**：[CompendiumView.tsx](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/compendium/CompendiumView.tsx) 有 1562 行，[HomePage.tsx](file:///d:/工作/ww/personal_work/new_zx_calc_noactcode_agent/web_app/src/components/home/HomePage.tsx) 有 844 行，未来可考虑拆分。
3. **无 TypeScript strict mode**：`tsconfig.app.json` 中的 strict 设置未检查，建议确认开启以减少类型错误。

