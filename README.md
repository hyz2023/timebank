# TimeBank (时间银行 - 少年版)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

TimeBank（时间银行）是一个基于 React 构建的家庭积分管理系统（少年版）。它专为 11-12 岁少年设计，通过正向反馈（获取积分）和延迟满足（积分兑换独立游戏时间）来管理学习习惯和日常任务。本项目采用科技感暗黑风格 UI 提升使用体验，并在数据层面支持完全离线存储，安全可靠不丢失。

---

## 🌟 核心理念与特色 (Features)

### 1. 积分经济模型 (The Economy)
- **任务防刷分机制（Anti-Grinding）**：每天重复同一任务（如口算每日多次打卡），收益率随频次递减（100% -> 75% -> 50%）。
- **质量与完美奖励**：支持一键选择“完美完成”以获得额外奖励分。
- **阶梯定价兑换**：鼓励多攒积分批量兑换，基础时间/分与进阶、高级兑换在“汇率”设计上有一定让利。

### 2. 用户体验 (UX & UI)
- **极简两步操作**：核心加分操作控制在 2 次点击内完成，最大限度降低记账成本。
- **防沉迷强管控**：针对周内/周末可设置不同兑换上限。一旦今日额度达到上限，禁止继续兑换。
- **动态动画反馈**：加分、扣分使用大数字和浮动动画，提供充分的情绪价值和游戏反馈体验。

### 3. 数据隐私与持久化
- **纯前端本地存储**：无需后端服务器和云端数据库，数据持久化保存在浏览器的本地存储或 IndexedDB 中。
- **按需重置控制**：App 启动时自动检查日期，以实现每日数据（如任务完成次数）自动跨日归零。

---

## 🛠️ 技术栈 (Tech Stack)

项目基于轻量级现代前端工具链构建，为后期可升级 PWA 留出了极佳扩展性：

- **核心库**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- **UI & 样式**: [Tailwind CSS](https://tailwindcss.com/)
- **状态管理**: Zustand 或 React Context 结合自定义 Hook，兼顾简洁与可维护性
- **持久层**: Web LocalStorage (后期可无缝切换到 `Dexie.js`/IndexedDB 支持更复杂查询)

---

## 📁 项目结构 (Project Structure)

```text
TimeBank/
├── design_prd.md           # 产品需求文档（PRD）- 详细设计与机制说明
├── index.html              # Vite HTML 模板
├── package.json            # 依赖与脚本
├── vite.config.js          # Vite 构建配置
├── tailwind.config.js      # Tailwind CSS 配置 (如有)
└── src/
    ├── App.jsx             # 路由控制与主结构
    ├── main.jsx            # React 挂载入口
    ├── index.css           # 全局样式及 Tailwind 指令引入
    ├── store.js            # 数据与状态管理 (State & Storage Logic)
    ├── engine.js           # 积分结算与时间运算的核心规则引擎
    └── components/         # 页面及各种可复用组件
        ├── EarnPage.jsx         # 任务与赚积分页面
        ├── RedeemPage.jsx       # 兑换商城页面
        ├── LogsPage.jsx         # 积分记录与流水日志页面
        ├── TimerPage.jsx        # 兑换后的倒计时/计时页面
        ├── AdminPanel.jsx       # 后台/家长设置面板（长按进入）
        └── PointsAnimation.jsx  # 数字滚动与加分特效组件
```

---

## 🚀 本地开发与部署 (Development & Deployment)

本项目开箱即用，通过 Node.js 即可运行本地开发服务器或编译打包。

### 1. 环境准备
请确保您的计算机上已经安装了 Node.js（推荐使用 `>= 18.0.0` 的 LTS 版本）和 npm/yarn。

### 2. 安装依赖并运行

```bash
# 克隆仓库到本地
git clone git@github.com:hyz2023/timebank.git
cd timebank

# 安装项目所需的依赖
npm install

# 启动本地开发服务器
npm run dev
```

该命令将在本地启动 Vite Server，通常可以通过浏览器访问 `http://localhost:5173` 来预览项目。

### 3. 构建生产环境

```bash
# 执行生产环境构建
npm run build
```

构建完成后，在根目录会生成一个 `dist` 文件夹，里面包含了所有静态文件（HTML, CSS, JS），这些文件可以直接部署在任何静态文件宿主环境中。

### 4. 项目部署 (Deployment)

由于此项目是纯前端（SPA/静态页面），无服务端依赖，因此十分适合托管在免费静态网站服务上：
- **GitHub Pages**: 使用 [gh-pages](https://www.npmjs.com/package/gh-pages) 工具或 GitHub Actions，将 `dist` 目录发布。
- **Vercel** 或者 **Netlify**: 直接绑定本代码仓库的 main 分支，构建命令设定为 `npm run build`，输出目录设定为 `dist`，即可自动触发部署。
- **本地化部署**: 如果在家中有一台 NAS 或者闲置电脑运行 Nginx/Caddy 等 Web Server，也可以直接将 `dist` 挂载访问。

部署完成后，由于未来可能引入 PWA 特性，建议使用 `HTTPS` 来让应用更安全并支持所有现代 Web API（如添加到主屏幕等）。

---

## 💡 后续规划与迭代方向

- **MVP 验证阶段**: 给孩子试用几天，通过反馈来观察基础点数模型是否偏难或偏易。
- **持久存储进阶**: 增加一键数据导出 JSON/导入功能，防误删。引入 IndexedDB 以支持大数据量操作。
- **PWA (Progressive Web App)**: 进一步支持 Service Worker 设置离线优先，并配置 Web App Manifest 使其能直接“安装”成为桌面或手机图标。

---

欢迎提出对积分规则设计上的探讨和建议，让“家庭经济管理系统”运转更流畅健康！
