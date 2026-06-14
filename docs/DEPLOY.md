# TimeBank 部署到 Vercel 指南

## 一、注册账号（都免费）
1. 注册 [Vercel](https://vercel.com)（用 GitHub 登录最方便）。
2. 注册 [Upstash](https://upstash.com)，创建一个 **Redis** 数据库（地区选离你近的，如 `ap-` 亚太）。

## 二、拿到 Upstash 连接信息
在 Upstash 数据库详情页，找到 **REST API** 区块，复制：
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## 三、在 Vercel 导入项目并配置环境变量
1. Vercel → Add New → Project → 选择本仓库（GitHub）。
2. 进入 Project Settings → Environment Variables，添加 4 个变量（Production 和 Preview 都勾）：
   - `APP_PASSWORD`：你的登录密码
   - `SESSION_SECRET`：随机字符串（终端运行 `openssl rand -base64 32` 生成）
   - `UPSTASH_REDIS_REST_URL`：上一步复制的 URL
   - `UPSTASH_REDIS_REST_TOKEN`：上一步复制的 Token
3. 点 Deploy，等待部署完成，得到公网网址（如 `https://timebank-xxx.vercel.app`）。

## 四、迁移老数据（一次性）
在一台能访问局域网老服务器（192.168.2.105）的电脑上，于项目目录运行：

```bash
npm install
UPSTASH_REDIS_REST_URL="刚才的URL" UPSTASH_REDIS_REST_TOKEN="刚才的TOKEN" node scripts/migrate-from-lan.mjs
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
