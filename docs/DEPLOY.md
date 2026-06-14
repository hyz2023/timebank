# TimeBank 部署到 Vercel 指南

## 一、注册账号（免费）
注册 [Vercel](https://vercel.com)（用 GitHub 登录最方便）。Redis 数据库在下一步通过 Vercel 集成创建，无需单独注册 Upstash。

## 二、创建 Redis 数据库（Vercel 集成，自动注入连接变量）
方式 A（命令行，已采用）：
```bash
npx vercel link            # 关联项目
npx vercel integration add upstash/upstash-kv --name timebank-redis
```
方式 B（网页）：项目页 → **Storage** → **Create Database** → 选 **Upstash for Redis** → 接受条款并创建。

无论哪种方式，集成会自动把 `KV_REST_API_URL` / `KV_REST_API_TOKEN` 注入到项目环境变量里，**你不用手动复制**。（代码同时兼容 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`。）

## 三、设置另外两个环境变量
只需手动加这两个（Production 和 Preview 都勾）：
- `APP_PASSWORD`：你的登录密码
- `SESSION_SECRET`：随机字符串（终端运行 `openssl rand -base64 32` 生成）

命令行方式：
```bash
printf '你的密码' | npx vercel env add APP_PASSWORD production
openssl rand -base64 32 | npx vercel env add SESSION_SECRET production
```
然后部署：`npx vercel deploy --prod`，得到公网网址（如 `https://timebank-xxx.vercel.app`）。

## 四、迁移老数据（一次性）
在一台能访问局域网老服务器（192.168.2.105）的电脑上，于项目目录运行：

```bash
npm install
npx vercel env pull .env.local            # 拉取 Redis 连接变量到本地
node --env-file=.env.local scripts/migrate-from-lan.mjs
```

看到 `✅ 已导入 Upstash` 即成功。若老服务器 API 不可达，可改用 SSH 取回 `server/data/timebank-data.json` 后，把脚本里的 `fetch` 换成读取该文件（或临时 `node -e` 读文件再 `redis.set`）。

## 五、验收（对照设计文档的验收标准）
1. 打开公网网址 → 应弹出登录页。
2. 输错密码进不去；输对密码进入，数据（余额/任务/记录）与老服务器一致。
3. 浏览器无痕窗口直接访问 `https://你的网址/api/data` → 应返回 `{"error":"未授权"}`（401）。
4. 走一遍：加分、兑换、计时暂停/继续、管理员加减分、增删改任务、查看图表。
5. 跨日观察任务次数是否在北京午夜清零。

## 六、退役老服务器
以上全部通过、稳定使用几天后，再关停 192.168.2.105 上的老服务（保留数据文件作离线备份）。

## 修改密码
改 Vercel 环境变量 `APP_PASSWORD` → 重新 Deploy 即可。
