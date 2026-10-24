# AGENTS.md

本文件是给所有 AI/人类协作者的**方向约束**。动手前先读，否则会把力气花在已经不用的页面上。

---

## 1. 产品形态：只有一个主入口

```
首页（聊天窗口）
   └─ 输入问题 / 点药丸 / 点卡片
        └─ 右侧双轨工作区 SplitScreenWorkspace（calc / arena / server / xyc / newtianyuan / ninglingqi / yunling）
```

- **所有功能都在右侧分屏里跑**，用户不再进入独立页面。
- `/calculator`、`/arena`、`/compendium/*`、`/tools/*` 这些路由页**产品上已停用**：Header 没有入口，聊天卡片一律走 `onOpenSplitWorkspace(mode)`。
- 代码里仍有 2 处 fallback 跳路由：`HomeAIChatStage.tsx` 第 85、224 行（`if (onOpenSplitWorkspace) {...} else { navigate('/calculator') }`）。`HomePage` 一定会传 `onOpenSplitWorkspace`，所以实际不会触发；**但不要以这两处为理由去改路由页**。

### 结论
> 任何 UI 改动、任何移动端适配，**验收对象是「聊天 + 右分屏」这条路径**，不是路由页。
> 只改路由页 = 用户看不见。

---

## 2. 分屏面板的布局约束（最容易踩的坑）

- 面板宽度 = 视口宽 − 左栏宽。左栏初始 460/480/500，可拖到 760；**实测面板宽度区间 394 ~ 934px**。
- 视口宽 ≠ 面板宽。**禁止在面板内只用视口断点（`sm:` / `md:` / `lg:` / `xl:`）做布局**：
  - 反例：视口 1440 时面板可能只有 500px，但 `sm:grid-cols-4` 照样触发 → 4 列挤进 500px。
  - 实测：分屏内计算器在视口 900 / 面板 394 时横向溢出 **116px**，在视口 1024 / 面板 518 时溢出 **54px**。
- 面板内一律用**容器查询**：`@container` + `@[NNNpx]:`，或沿用 `calc-container-root`（`container-name: calcPanel`）。
- 已知反例（待修）：`AttributePanel.tsx` 的两处属性卡栅格只写了 `sm:grid-cols-4`，**没有挂 `.calc-attr-grid`**，所以 `index.css` 里针对它的 `@container calcPanel` 规则完全不生效；容器查询类目前只挂在 `BuffSelector.tsx` 上。
- 同类问题也出现在 `SimulationArena`：主网格用 `xl:grid-cols-[286px_1fr_314px]`（视口断点），视口 1280 时面板只有 774，中栏被压到 **149px**。

---

## 3. 移动端（≤767px）的目标形态

- 聊天占满屏；工作区用**全屏 Sheet**（`h-[92dvh]`）从底部升起，不再做左右分屏。
- 手机判定必须带横屏条件：`(max-width: 767px), (max-height: 500px) and (pointer: coarse)`。
- 面板内组件在移动端等于「容器宽 ≈ 视口宽」，但仍建议统一走容器查询，避免两套逻辑。

---

## 4. 改动验收（缺一不可）

1. 路径必须是：首页 → 输入/点药丸 → 聊天 → `+` → 选工具 → 右分屏。
2. 至少测 **4 档面板宽度**：约 400 / 520 / 780 / 934（用 900 / 1024 / 1280 / 1440 视口即可得到）。
3. 每档检查：面板内容 `scrollWidth === clientWidth`（无横向溢出）、`scrollHeight` 可达底部、桌面 ≥1280 时三栏/两栏布局未回退。
4. 类型与回归：
   ```bash
   cd web_app && node ../node_modules/typescript/bin/tsc -b
   node scripts/l1_intent_fixture.mjs        # 期望 1024/1024 PASS
   ```
5. 审计脚本（本地、不入库，`scratch/` 已被 gitignore）：
   - `scratch/mobile_audit/audit.mjs <url> [w] [h]` — 溢出/滚动/触控目标
   - `scratch/mobile_audit/split_probe.mjs <w> <h> <菜单项> <out.png>` — 直接开分屏并量面板
   - `scratch/mobile_audit/shot_desktop.mjs` — 桌面截图

---

## 5. 工程约定

- 路由是 HashRouter：`http://localhost:5173/#/arena`，直接开 `/arena` 会落到首页。
- `scratch/`、`dist/`、`films/` 均被 gitignore；需要留存的分析脚本放 `scripts/`。
- 提交只入本地库；**push 必须等用户明确说「推送」**。
- 当前开发分支：`feat/ai-copilot-tools`（2026-10-24 已并入移动端改造；原 `feat/mobile-responsive` 已删除，后续都在这条分支上开发）。
- 移动端方案文档：`doc/移动端全面支持_评估与改造方案_20261023.md`。
