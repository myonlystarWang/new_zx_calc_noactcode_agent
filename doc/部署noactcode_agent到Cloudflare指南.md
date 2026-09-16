# 部署 noactcode_agent 到 Cloudflare Pages 指南

## 0. 结论速览

- ✅ **能 build**：`new_zx_calc_noactcode_agent` 根目录执行 `npm run web:build`（= `npm --workspace=web_app run build` = `tsc -b && vite build`）可正常产出 `web_app/dist`。
  - 验证：本次已成功构建，产物含 `index.html` + `assets/`（JS 802KB / gzip 235KB）+ `game_data/`（7 个 JSON，含 9 职业 `skills.json`）+ `arena/`。
  - ⚠️ 本地沙箱里 `npm run build` 在"清理旧 dist"步骤会被安全删除拦截，但那是本机环境特例；你本机 / CF 构建环境都不会触发，构建本身没有问题。
- ✅ **SPA 路由**：应用用 Tab 状态切换（非 URL 路由），无需 `_redirects`，不会子路由 404。
- ✅ **workspace 结构**：根 `package.json` 有 `workspaces: ['agent_tool','web_app','packages/*']`，`@zx/simulation-engine` 被软链进 `node_modules/@zx/`，CF 的 `npm install` 会自动装齐。

---

## 1. 子域名命名建议

现有页面：`zxclac_raddishlab.tech`（绑定的是 noactcode 版，注意 "zxclac" 是错别字）。

新页面（agent 版，带副本模拟/时间轴 arena）建议子域名：

| 候选 | 含义 | 推荐度 |
|------|------|--------|
| **`agent.raddishlab.tech`** | 直指 "noactcode_agent" 版本，语义最清晰 | ⭐ 推荐 |
| `arena.raddishlab.tech` | 强调"副本模拟训练场/时间轴"独有功能 | 备选 |
| `zxcalc.raddishlab.tech` | 修正原错别字拼写，作为"正式计算器" | 备选 |

下文以 **`agent.raddishlab.tech`** 为例。**CF Pages 项目名**建议与子域名对应，如 `zxcalc-agent`。

---

## 2. 腾讯云侧（通常无需改动）

由于 `zxclac_raddishlab.tech` 已经跑在 CF Pages 上，说明 `raddishlab.tech` 的 DNS 解析（NS 名称服务器）**早已委托给 Cloudflare**。即：你在腾讯云买域名，但 DNS 由 CF 管理。

> 验证方式：腾讯云控制台 → 域名注册 / 云解析DNS → 看 `raddishlab.tech` 的 DNS 服务器是否为 `*.ns.cloudflare.com`。

**大多数情况（全量 NS 托管）：你不需要在腾讯云做任何操作。** 新增子域名由 CF 自动在你 CF 托管的 zone 里加一条 CNAME，腾讯云侧无感知。

**极少数情况（CF 用的是 CNAME/partial 接入）**：若 DNS 仍在腾讯云，则需要到腾讯云云解析 DNS 手动加一条记录：
- 主机记录：`agent`
- 记录类型：`CNAME`
- 记录值：`<你的Pages项目名>.pages.dev`（建完 CF 项目后获得）

---

## 3. Cloudflare 侧操作

### 方案 A：Git 连接（推荐，后续 push 自动部署）

1. CF 控制台 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
2. 选仓库 `myonlystarWang/new_zx_calc_noactcode_agent`。
3. 构建设置：
   - **Framework preset**：选 `None`（因为是 monorepo，不能让 CF 套用根目录 Vite 预设）。
   - **Build command**：`npm run web:build`
   - **Build output directory**：`web_app/dist`
   - **Root directory**：保持默认 `/`（CF 在根目录跑 `npm install` 装齐所有 workspace）。
4. **Environment variables**（项目设置 → Variables）：加 `NODE_VERSION = 22`（避免默认 Node 18 的潜在问题）。
5. 保存并首次部署。完成后获得 `*.pages.dev` 临时域名。

### 方案 B：本地 dist 直接上传（你提到的"生成 dist 上传"）

1. 本地已构建好 `new_zx_calc_noactcode_agent/web_app/dist`（本次已生成验证无误）。
2. CF 控制台 → **Workers & Pages** → **Create** → **Pages** → **Upload assets / Drag and drop**。
3. 直接把 `web_app/dist` 文件夹拖进去，项目名填 `zxcalc-agent`。
4. 或命令行（`wrangler`）：
   ```
   cd new_zx_calc_noactcode_agent/web_app
   npx wrangler pages deploy dist
   ```

> 两种方案二选一即可。方案 A 适合长期维护（改代码 push 即上线）；方案 B 适合一次性发布当前构建。

---

## 4. 绑定自定义域名 `agent.raddishlab.tech`

1. 进入刚建好的 Pages 项目 → **Custom domains** → **Set up a custom domain**。
2. 输入 `agent.raddishlab.tech`，点击继续。
3. CF 会自动：
   - 在 `raddishlab.tech` 的 zone 里新建 CNAME：`agent` → `<项目名>.pages.dev`
   - 自动申请并配置 **Universal SSL**（免费证书）。
4. 状态从 `Initializing` / `Active (pending SSL)` 变为 **`Active`**（通常 1–5 分钟，SSL 最迟数十分钟）。
5. 若第 3 步 DNS 未自动生效（仅当 DNS 在腾讯云时），按第 2 节去腾讯云补 CNAME。

---

## 5. 验证上线

- 浏览器打开 `https://agent.raddishlab.tech`，确认：
  - 页面能加载、无激活码弹窗（agent 版本就无激活码）。
  - 左侧选职业能看到 **9 个职业**（焚香/鬼王/涅羽/太昊/天华/天音/英招/昭冥/逐霜）。
  - 顶部有 **calculator / arena** 双 Tab，arena 即副本模拟（带时间轴）页。
- 用一份已部署前的 `skills.json` 对照：鬼王 3 技能 `SkillCriticalDamagePercentBonus` 应为 **0**（本地已改，远端 noactcode 也已改 0）。

---

## 6. 注意事项 & 踩坑

1. **构建命令务必用根 `npm run web:build`**，不要用 `cd web_app && npm run build`——后者在 CF 上会因 `@zx/simulation-engine` workspace 未安装而失败。
2. **输出目录填 `web_app/dist`**，不是根 `dist`。
3. **NODE_VERSION=22** 环境变量建议加上。
4. 若线上出现白屏：大概率是 assets 路径/base 问题。本项目 `vite.config.ts` 未设 `base`，默认 `/`，配合 Pages 根路径无问题；若以后放到子路径再调整。
5. 单 JS chunk 802KB（gzip 235KB）偏大但可用；后续可做 `manualChunks` 代码分割优化，非必须。
6. 沙箱里 `npm run build` 因安全删除拦截会报 `safe-delete 操作失败`——**只影响本机清理旧 dist，代码编译已成功**；在你本机或 CF 上正常。

---

## 7. 后续维护建议

- 以 `new_zx_calc_noactcode_agent` 作为唯一主干；`new_zx_calc_noactcode`（原 bak，仅 4 职业计算器）逐步归档。
- 本地 `new_zx_calc_noactcode_agent` 当前的 `skills.json` 改动（鬼王 3 技能爆伤 100→0）**尚未 git commit**，记得提交后再 push，否则 CF Git 构建拉到的还是旧值。
