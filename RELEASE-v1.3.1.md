# TimeBank 发布说明 v1.3.1

**发布日期：** 2026-03-29  
**版本：** v1.3.1  
**Git 标签：** v1.3.1  
**类型：** 补丁版本（Bug Fix）

---

## ✅ 核心功能清单

- [x] 管理员面板功能优化
- [x] 数据存储结构改进
- [x] 系统稳定性提升

---

## 🛠️ 技术栈

- **前端：** React + Vite
- **后端：** Node.js + Express
- **数据存储：** JSON 文件存储
- **部署：** LAN 内部署 (192.168.2.105:5173)

---

## 📦 本次变更

### 修改文件：
- `server/data/timebank-data.json` - 数据结构优化
- `src/components/AdminPanel.jsx` - 管理员面板功能改进

### 新增文件：
- `docs/plans/2026-03-14-analytics-time-range-design.md` - 分析功能时间范围设计文档
- `public/` - 静态资源目录

---

## 🚀 部署说明

1. 拉取最新代码：
   ```bash
   git pull origin main
   ```

2. 安装依赖（如有更新）：
   ```bash
   npm install
   ```

3. 启动服务：
   ```bash
   npm run dev
   ```

4. 访问：http://192.168.2.105:5173

---

## 📝 重要修复

- 优化管理员面板交互体验
- 改进数据存储结构，提升查询效率

---

## 🔙 回滚方法

如需回滚到 v1.3.0：

```bash
git checkout v1.3.0
npm install
npm run dev
```

---

## 📌 后续优化方向

- 继续完善数据分析功能
- 优化用户界面体验
- 增强系统性能

---

**发布人：** 小 U 🤖  
**审核状态：** 已验证
