# TimeBank 改造设计：迁移到 Vercel + 登录鉴权

- **日期**：2026-06-14
- **目标**：把当前"局域网服务器 + 本地 JSON 文件"的部署，改造成"Vercel 公网网站 + Upstash 云数据库"，并加入一个共享密码的全站门禁，防止外人访问和破坏数据。
- **原则**：业务功能与使用体验**完全不变**，只换部署形态、换存储、加门禁。

---

## 1. 一句话总结

把"局域网里一台一直开着的服务器 + 本地文件"，改造成"Vercel 公网网站 + Upstash 云数据库 + 一个共享密码的全站门禁"。功能体验不变，数据从老服务器原样搬过来，老服务器先留作备份。

---

## 2. 现状（改造前）

- **前端**：React 19 + Vite + Tailwind 4 + Zustand + React Router + Recharts，移动端积分管理 App（少年版时间银行）。
- **后端**：`server/server.js`（Express），数据存在单个 JSON 文件 `server/data/timebank-data.json`。
- **部署**：跑在**局域网另一台服务器** `192.168.2.105:3001` 上（不是本地）。手机/平板在家连这台机器使用。
- **前端访问地址**：`src/store.js` 中硬编码 `http://192.168.2.105:3001/api`。
- **鉴权**：无。任何人知道地址都能访问、调用 API 改数据；AdminPanel 也无保护。

### 关键问题
1. Vercel 是 Serverless，`fs.writeFileSync` 写本地文件**不持久**，Express 常驻进程模型也不适配。
2. 硬编码局域网 IP 在公网不可用。
3. 完全没有鉴权，无法满足"防止外人访问/破坏数据"。

---

## 3. 决策摘要（已与用户确认）

| 决策点 | 选择 |
| --- | --- |
| 使用范围 | 只有自己一家用，一套数据，不区分角色 |
| 登录方式 | 一个共享密码（服务端校验 + 签名 Cookie 维持登录） |
| 数据库 | Upstash Redis（整个 JSON 存在单个 key 下） |
| 后端形态 | 方案 A：改写成标准 Vercel Serverless Functions（`/api` 下独立文件 + 共享 `_lib`） |
| 数据来源 | 从正在运行的老服务器 `GET http://192.168.2.105:3001/api/data` 抓取最新数据导入 |
| 老服务器 | 先保留作备份，Vercel 验证无误后再退役 |

---

## 4. 目标架构

```
浏览器 (React 静态站，由 Vercel 托管)
   │  fetch('/api/...')   ← 改为相对路径，同源，不再有局域网 IP
   ▼
Vercel Serverless Functions  (/api/*)
   │  每个请求先过 requireAuth，校验签名 Cookie
   ▼
Upstash Redis  ← 单个 key "timebank:data" 存整个 JSON 对象
```

- 全部在同一个 Vercel 项目内，前端与 API 同源，无跨域问题。
- HTTPS 由 Vercel 自动提供。

---

## 5. 安全模型（核心：保护 API，不只是藏登录页）

1. **登录**：`POST /api/login` 接收密码 → 服务端用**常量时间比较**对比环境变量 `APP_PASSWORD` → 通过则签发 **HttpOnly + Secure + SameSite=Lax 的签名 Cookie**（用 `SESSION_SECRET` 做 HMAC 签名，含过期时间戳）。
2. **会话有效期**：30 天长效，过期自动跳登录页。便于孩子平板登录一次长期免登录。
3. **API 保护**：`/api/_lib/auth.js` 提供 `requireAuth(req, res)`，**每一个**业务接口入口先校验 Cookie，缺失/失效 → 返回 `401`。即使绕过前端直接打 API 也无法读写数据。
4. **防爆破**：登录接口加简单失败限流（基于 Redis 计数，同一 IP 连续失败 N 次后短暂锁定 + 失败响应加固定延迟），防暴力猜密码。
5. **前端守卫**：React 端加轻量 `AuthGate`，启动时调 `GET /api/data`；收到 `401` 显示登录页，登录成功后再加载 App。

### 边界（明确不做）
- 密码只存 Vercel 环境变量，不进 git、不出现在前端。忘记密码 → 改环境变量重新部署。
- 不做注册、找回密码、多账号、角色区分。
- 每日兑换上限（防沉迷）的执行口径维持现状（当前在前端 RedeemPage 内做软限制，服务端 `/api/redeem` 未强制）。本次改造**不改变该行为**，仅作记录；如需服务端强制，另开需求。

---

## 6. 后端文件结构（方案 A）

```
/api
├── _lib/
│   ├── db.js          # Redis 客户端 + readData()/saveData() + 每日重置 + 北京时区
│   ├── auth.js        # signSession() / verifySession() / requireAuth()
│   └── engine.js      # 积分计算、衰减率（与 src/engine.js 口径一致）
├── login.js           # POST  校验密码、签发 Cookie、登录限流
├── logout.js          # POST  清除 Cookie
├── data.js            # GET 读取全部数据 / POST 覆盖保存（导入用）
├── earn.js            # POST 完成任务加分
├── redeem.js          # POST 兑换、创建计时器
├── balance.js         # POST 管理员调整余额
├── tasks/
│   ├── index.js       # POST 新增任务
│   └── [taskId].js    # PUT 改任务 / DELETE 删任务
└── timers/
    ├── clear.js              # POST 清过期计时器
    └── [timerId].js          # POST 暂停/继续（body.action 区分 pause/resume）
```

### 接口统一写法（伪代码）

```js
import { requireAuth } from './_lib/auth.js'
import { readData, saveData } from './_lib/db.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return        // 401 直接返回
  if (req.method !== 'POST') return res.status(405).end()
  const data = await readData()             // Redis GET + 懒惰每日重置
  // ...业务逻辑（搬现有 server.js 的算分/衰减/日志逻辑）...
  await saveData(data)                       // Redis SET
  res.json({ success: true, /* ... */ })
}
```

### 接口与原 Express 路由对应关系

| 原 Express 路由 | 新 Vercel 函数 |
| --- | --- |
| `GET /api/data` / `POST /api/data` | `api/data.js` |
| `POST /api/earn` | `api/earn.js` |
| `POST /api/redeem` | `api/redeem.js` |
| `POST /api/timers/clear` | `api/timers/clear.js` |
| `POST /api/timers/:id/pause`、`/resume` | `api/timers/[timerId].js`（body.action） |
| `POST /api/tasks` | `api/tasks/index.js` |
| `PUT/DELETE /api/tasks/:id` | `api/tasks/[taskId].js` |
| `POST /api/balance/adjust` | `api/balance.js` |
| （新增）登录/登出 | `api/login.js` / `api/logout.js` |

> 业务逻辑（算分含衰减 100%/75%/50%、完美奖励、日志、计时器、每日重置）逻辑原样保留，仅把"读写文件"换成"读写 Redis"、把"一个 Express app"拆成"多个函数 + 共享 `_lib`"。

---

## 7. 数据层（Upstash Redis）

- **存储模型**：整个数据对象（`balance` / `tasks` / `logs` / `timers` / `config`）作为一个 JSON 存在单个 key `timebank:data` 下，与现有"一个文件一个 JSON"模型 1:1 对应。
- **读写**：`readData()` = `redis.get('timebank:data')`（不存在则用默认数据初始化）；`saveData()` = `redis.set('timebank:data', json)`。
- **每日重置**：维持现有"懒惰重置"——`readData()` 时检查任务 `lastUpdate` 是否为今天，不是则把 `dailyCount` 清零。无需 cron。
- **数据量评估**：单家庭即使多年累积，JSON 仍在 MB 级以内，Upstash 免费额度足够。

### 时区处理（重点修复）
- 现状 `getTodayStr()` 用服务器本地时间当北京时间；Vercel 函数默认 UTC，会导致清零时间跑偏到北京早 8 点。
- 改为**显式按北京时区（UTC+8）计算"今天"的日期字符串**，保证仍按北京午夜清零。节假日判断（`HOLIDAY_2026`）同样基于该北京日期。

---

## 8. 前端改动

- **API 地址**：`src/store.js` 中 `API_BASE` 由 `http://192.168.2.105:3001/api` 改为相对路径 `/api`（同源）。fetch 增加 `credentials: 'include'` 以携带 Cookie。
- **AuthGate**：新增登录页组件 + 守卫逻辑：
  - App 启动调 `GET /api/data`；`401` → 渲染登录页（输入密码 → `POST /api/login`）。
  - 登录成功后加载主 App，行为与现在一致。
  - 处理 401 时清空本地状态并回到登录页。
- 其余组件（EarnPage / RedeemPage / TimerPage / LogsPage / AdminPanel / Analytics 及图表）**不改动**。

---

## 9. 部署与配置

### 用户需亲手做的事（实施时提供逐步图文步骤）
1. 注册免费账号：**Vercel**（部署）和 **Upstash**（数据库）。
2. 在 Vercel 设置 3 个环境变量（不进代码、不公开）：
   - `APP_PASSWORD`：登录密码。
   - Upstash 连接信息（注册后自动提供，如 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`）。
   - `SESSION_SECRET`：随机字符串（实施时生成），用于签名登录状态。
3. 连接 GitHub 仓库到 Vercel，点击部署。之后每次 `git push` 自动更新。

### 构建配置
- 新增/调整 `vercel.json`（如需）与构建命令，确保：前端 `vite build` 产物作为静态站托管，`/api/*` 路由到 Serverless Functions。
- 新增 Upstash Redis SDK 依赖（如 `@upstash/redis`）。
- `gitignore` 确保不提交任何密钥。

---

## 10. 数据迁移

1. **来源 = 老服务器最新数据**：从 `GET http://192.168.2.105:3001/api/data` 抓取（git 里那份 JSON 可能是旧的，不用它）。若 API 不可达，备用方案：用 SSH（`openclaw@192.168.2.105`）拷贝 `server/data/timebank-data.json`。
2. **导入**：把抓到的数据写入 Upstash 的 `timebank:data` key（一次性脚本或调用部署后的 `POST /api/data`）。
3. **凭据处理**：老服务器账号密码仅在迁移抓数那一步临时使用，不写入代码/文档/长期存储。

---

## 11. 验收标准

1. **数据一致**：公网网址打开后，余额、任务列表、历史记录与老服务器完全一致。
2. **门禁有效**：
   - 不输/输错密码 → 进不去。
   - 绕过登录界面直接访问任意数据接口 → 返回 `401`。
   - 输对密码 → 正常进入，30 天内免登录。
3. **核心功能**：加分（含递减与完美奖励）、兑换游戏时间、计时暂停/继续、管理员加减分、增删改任务、记录与图表均正常。
4. **每日清零**：按北京时间午夜清零（非早 8 点）。

全部通过后，老服务器方可退役。

---

## 12. 不在本次范围

- 多用户/多家庭、注册、找回密码、角色权限。
- 服务端强制每日兑换上限（维持现有前端软限制行为）。
- 老服务器密码加固（仅口头建议，与本次改造无关）。
- 任何 UI 视觉重设计。
