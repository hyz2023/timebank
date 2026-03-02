这是一个为您量身定制的《家庭积分管理系统（少年版）》产品需求文档（PRD）。考虑到用户不仅是家长，也是一位资深的互联网产品经理/总监，本PRD将采用专业、严谨的结构，重点突出了**核心逻辑（Economy）、用户体验（UX）和持久化存储（Storage）**的设计。

---

# 产品需求文档 (PRD): Project "TimeBank" (代号：时间银行)

| 版本 | 日期 | 修改人 | 备注 |
| --- | --- | --- | --- |
| v1.0 | 2026-03-03 | Gemini | 初始版本，基于小学6年级男生场景设计 |

## 1. 产品概述 (Overview)

### 1.1 背景

目标用户为一名小学6年级男生（约11-12岁）。该年龄段孩子具备较强的逻辑思维和规则意识，对“公平性”敏感，且处于从儿童向少年过渡期，UI风格需避免低幼化。当前需求是建立一套数字化、离线可用的积分管理系统，通过正向反馈（积分）和延迟满足（兑换游戏时间）来管理学习习惯。

### 1.2 核心目标

1. **极简录入**：将记账成本降至最低，确保家长/孩子能坚持使用。
2. **规则透明**：自动计算递减收益（Diminishing Returns）和奖励倍率，消除人为计算的主观分歧。
3. **风控管理**：严格控制游戏时间上限（防沉迷）。
4. **闭环激励**：通过“积分-时间”的汇率优惠，引导孩子进行大额兑换（延迟满足）。

---

## 2. 核心机制设计 (Core Mechanics)

### 2.1 积分经济模型 (The Economy)

#### A. 获取规则 (Earning Rules)

系统支持配置任务（Task），每个任务包含基础分（Base Points）和衰减策略。

* **衰减逻辑（Anti-Grinding）**：防止通过简单任务刷分。
* 第 1-2 次/天：100% 收益
* 第 3-4 次/天：75% 收益
* 第 5+ 次/天：50% 收益


* **质量奖励（Quality Bonus）**：
* 触发条件：手动勾选“完美完成”（如：计算题全对）。
* 奖励：固定数值加成（如：+2分）。



#### B. 兑换规则 (Burning Rules)

采用“阶梯定价”策略，鼓励积攒积分批量兑换。

| 档位 | 消耗积分 | 获得时长 | 赠送时长 | 总时长 | 汇率 (分/积分) |
| --- | --- | --- | --- | --- | --- |
| **基础档** | 10 pts | 15 min | 0 min | 15 min | 1.5 |
| **进阶档** | 20 pts | 30 min | 2 min | 32 min | 1.6 |
| **高级档** | 30 pts | 45 min | 4 min | 49 min | 1.63 |

#### C. 限制规则 (Constraints)

* **工作日 (Mon-Fri)**：每日兑换总时长上限 **60分钟**。
* **周末 (Sat-Sun)**：每日兑换总时长上限 **120分钟**。
* *注：系统需在兑换时校验当日已兑换时长，若超出则按钮置灰或弹窗提示。*

---

## 3. 功能需求 (Functional Requirements)

### 3.1 模块一：积分获取 (Earn)

* **P0 - 任务卡片流**：
* 首页展示预设任务卡片（练字、单词、计算、数学题）。
* 卡片显示：任务名、当前基础分、今日已完成次数、下一次完成的收益率（如 "Next: 75%"）。


* **P0 - 快速结算弹窗**：
* 点击卡片 -> 弹出确认框。
* 选项：[普通完成] / [完美完成 (+2分)]。
* 反馈：全屏动画展示 "+X 积分"，音效反馈（类似于游戏金币入账）。



### 3.2 模块二：积分兑换 (Redeem)

* **P0 - 兑换商城**：
* 展示三个商品卡片（15min, 30min, 45min）。
* 状态判断：如果积分不足或今日额度已满，卡片置灰并显示原因（"积分不足" 或 "今日额度已达上限"）。


* **P0 - 核销记录**：
* 点击兑换 -> 扣除积分 -> 记录兑换时间、时长。
* **可选功能**：兑换后直接生成一个倒计时器（Timer），到点报警。



### 3.3 模块三：管理与配置 (Admin)

* **P1 - 每周复盘模式**：
* 支持对任务的基础分、奖励分进行编辑。
* 支持修改兑换汇率。
* *交互*：长按“设置”图标进入（防止孩子误操作）。



### 3.4 模块四：数据持久化 (Persistence)

* **P0 - 本地存储**：
* 所有数据（积分余额、流水日志、配置项）存入 **IndexedDB** 或 **LocalStorage**。
* **无需联网**，刷新页面数据不丢失。


* **P2 - 数据导出**：
* 支持导出 JSON 文件（备份用），防止清理浏览器缓存导致数据丢失。



---

## 4. 详细设计 (Detailed Design)

### 4.1 页面流程图 (User Flow)

```mermaid
graph TD
    A[首页 Dashboard] --> B{操作类型}
    B -->|赚积分| C[点击任务卡片]
    C --> D[选择完成质量\n(普通/完美)]
    D --> E[系统计算衰减与奖励]
    E --> F[更新余额 & 写入日志]
    
    B -->|花积分| G[点击兑换商城]
    G --> H{校验规则}
    H -->|积分不足| I[提示报错]
    H -->|超今日上限| I
    H -->|通过| J[扣除积分 & 写入日志]
    J --> K[展示剩余可用额度]

```

### 4.2 数据结构 (Data Schema)

为确保极简与扩展性，建议采用以下 JSON 结构存储在本地：

```json
{
  "userProfile": {
    "balance": 120, // 当前积分
    "dailyExchangeLimitWeekday": 60,
    "dailyExchangeLimitWeekend": 120
  },
  "tasks": [
    {
      "id": "t1",
      "name": "口算一页",
      "basePoints": 4,
      "bonusPoints": 2, // 全对奖励
      "dailyCount": 2, // 今日已完成次数
      "lastUpdate": "2026-03-03" // 用于重置每日计数
    }
  ],
  "logs": [
    {
      "id": "l_1001",
      "type": "EARN", // or "REDEEM"
      "taskId": "t1",
      "pointsChange": 6, // 4 * 100% + 2
      "timestamp": 1741021200000,
      "meta": { "quality": "perfect", "decayRate": 1.0 }
    }
  ]
}

```

---

## 5. 用户体验与UI设计 (UX/UI Guidelines)

针对6年级男生，风格需偏向 **“科技感”** 或 **“游戏化”**，避免卡通化。

1. **视觉风格 (Visuals)**：
* **深色模式 (Dark Mode)**：默认深色背景，霓虹色（青色、紫色）作为高亮色。
* **大数字**：积分余额要巨大、醒目，位于屏幕上方中央。


2. **交互细节 (Interaction)**：
* **极简操作**：核心操作（加分）要在 **2次点击** 内完成。
* **防误触**：扣分（兑换）操作需要“滑动确认”或“二次弹窗”。
* **反馈感**：
* 加分时：数字滚动上升动画。
* 衰减提示：如果在第3次打卡，UI上要显式标记 "收益 75%"（让孩子理解规则的运行）。





---

## 6. 技术实现方案 (Technical Stack)

鉴于您是互联网大厂背景，建议采用轻量级的前端技术栈，构建为一个 **PWA (Progressive Web App)**，既可以作为网页运行，也可以添加到手机主屏幕像原生App一样使用。

* **框架**：**React** (逻辑清晰，组件化) + **Tailwind CSS** (快速构建UI)。
* **状态管理**：React Context 或 Zustand。
* **持久化存储**：
* 使用 **Dexie.js** (IndexedDB 的包装库)，比 LocalStorage 更稳定，支持更大数据量和查询。
* *关键逻辑*：每次启动 App 时，检查 `lastUpdate` 日期。如果日期跨天，自动重置所有任务的 `dailyCount` 为 0。


* **部署**：
* GitHub Pages 或 Vercel (免费、HTTPS)。
* 即使断网，Service Worker 也能让 PWA 正常运行。



### 6.1 核心代码逻辑片段 (伪代码)

```javascript
// 计算本次任务得分
const calculatePoints = (task, isPerfect) => {
  const count = task.dailyCount + 1;
  let multiplier = 1.0;
  
  if (count >= 5) multiplier = 0.5;
  else if (count >= 3) multiplier = 0.75;
  
  let points = task.basePoints * multiplier;
  if (isPerfect) points += task.bonusPoints;
  
  return Math.floor(points); // 向下取整或保留一位小数
};

// 校验兑换限制
const canRedeem = (minutesToRedeem) => {
  const isWeekend = [0, 6].includes(new Date().getDay());
  const limit = isWeekend ? 120 : 60;
  
  // 从日志中聚合今日已兑换时长
  const todayRedeemed = logs
    .filter(l => l.type === 'REDEEM' && isToday(l.timestamp))
    .reduce((sum, l) => sum + l.minutes, 0);
    
  return (todayRedeemed + minutesToRedeem) <= limit;
};

```

---

## 7. 下一步行动建议

1. **MVP 开发**：先用 React + Tailwind + LocalStorage 写一个最简单的版本，只包含“加分”和“显示余额”功能，给孩子试用两天。
2. **规则校准**：第一周可能需要频繁调整分数。建议在代码中将配置项（Config）提取出来，或者在界面上做一个隐藏的 "Admin Panel"。
3. **仪式感**：虽然系统是自动的，但建议每周日晚上有一个“周结算”仪式，和孩子一起看这周赚了多少分，是否要调整下周的策略。