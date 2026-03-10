# TimeBank 数据分析 Dashboard 设计文档

**日期:** 2026-03-10  
**版本:** v1.0  
**状态:** 待实现

---

## 1. 产品概述

### 1.1 目标
创建一个独立的数据分析 Dashboard，用于评估玩家的**积极性**和**健康度**。

### 1.2 分析维度
- **任务完成分析** - 完成量、完成时间分布
- **兑换行为分析** - 兑换时长、兑换时间点（21:30 前后）
- **每日趋势** - 积分获取趋势、活跃度热力图

### 1.3 评估目标
- **积极性**: 积分获取量、任务完成频率
- **健康度**: 是否在 21:30 前完成活动（小学生不应太晚）

---

## 2. 页面设计

### 2.1 页面布局

```
┌─────────────────────────────────────────────┐
│  TimeBank 数据分析看板                      │
├─────────────────────────────────────────────┤
│  [日期筛选器：最近 7 天/最近 30 天/自定义]     │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 总积分   │  │ 任务完成 │  │ 兑换次数 │  │
│  │  1,240   │  │   42 次   │  │   15 次   │  │
│  │  (同期)  │  │  (同期)   │  │  (同期)   │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  📈 每日积分趋势 (折线图)              │  │
│  │  [显示 7 天/30 天的积分获取曲线]          │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  🔥 活跃热力图 (按小时)                │  │
│  │  [横轴：0-23 点，纵轴：周一 - 周日]      │  │
│  │  [21:30 后用红色标记警示]               │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  📊 任务类型分布 (饼图)                │  │
│  │  [各任务的积分占比]                    │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  ⏰ 兑换时间分析 (柱状图)              │  │
│  │  [21:30 前 vs 21:30 后 的兑换次数对比]    │  │
│  └───────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

### 2.2 核心指标卡

| 指标 | 计算逻辑 | 对比 |
|------|---------|------|
| 总积分 | 选定周期内 `logs` 中 `type='EARN'` 的 `pointsChange` 总和 | 与上一周期对比（↑↓百分比） |
| 任务完成 | 选定周期内 `logs` 中 `type='EARN'` 的记录数 | 与上一周期对比 |
| 兑换次数 | 选定周期内 `logs` 中 `type='REDEEM'` 的记录数 | 与上一周期对比 |

### 2.3 健康度评估标签

基于 21:30 前后的活动比例：

| 标签 | 条件 | 颜色 |
|------|------|------|
| 🟢 健康 | 80%+ 活动在 21:30 前 | 绿色 |
| 🟡 注意 | 60-80% 活动在 21:30 前 | 黄色 |
| 🔴 警示 | <60% 活动在 21:30 前 | 红色 |

---

## 3. 技术设计

### 3.1 技术栈

| 组件 | 技术选型 |
|------|---------|
| 框架 | React 19 (沿用现有) |
| 图表库 | Recharts (^2.15.0) |
| 路由 | React Router DOM (^7.0.0) |
| 状态管理 | 直接读取 store.js (zustand) |
| 样式 | Tailwind CSS 4 (沿用现有) |

### 3.2 路由设计

```
/           → 主站（现有 App.jsx）
/analytics  → 数据分析 Dashboard（新增）
```

### 3.3 文件结构

```
src/
├── pages/
│   └── Analytics.jsx        # 数据分析主页面
├── components/
│   └── charts/
│       ├── TrendChart.jsx   # 趋势折线图
│       ├── HeatmapChart.jsx # 活跃热力图
│       ├── TaskPieChart.jsx # 任务分布饼图
│       └── TimeBarChart.jsx # 兑换时间柱状图
├── utils/
│   └── analytics.js         # 数据聚合工具函数
└── main.jsx                 # 添加路由支持
```

### 3.4 数据流

```
store.js (logs 数组)
    ↓
Analytics.jsx 直接读取 useStore()
    ↓
analytics.js 聚合工具函数
    - 按日期过滤
    - 按任务类型分组
    - 按小时统计
    - 计算健康度指标
    ↓
图表组件接收聚合后的数据
    ↓
Recharts 渲染可视化
```

### 3.5 核心数据结构

**输入:** `logs` 数组（来自 store.js）
```javascript
{
  id: 'l_1234567890',
  type: 'EARN' | 'REDEEM',
  taskId: 't1' | null,
  taskName: '练字' | '短途飞行' | ...,
  pointsChange: number,
  timestamp: number, // Date.now()
  meta: { ... }
}
```

**输出:** 聚合后的图表数据
```javascript
// 每日趋势数据
[
  { date: '2026-03-01', points: 120, tasks: 15, redeems: 3 },
  { date: '2026-03-02', points: 95, tasks: 12, redeems: 2 },
  ...
]

// 热力图数据
[
  { day: 0, hour: 18, value: 5 }, // 周日 18 点 5 次活动
  { day: 0, hour: 19, value: 8 },
  ...
]

// 任务分布数据
[
  { name: '练字', value: 320, percentage: 35 },
  { name: '单词', value: 180, percentage: 20 },
  ...
]
```

---

## 4. 关键实现细节

### 4.1 日期筛选器

- **预设选项:** 最近 7 天、最近 30 天
- **自定义:** 日期范围选择器（可选）
- **默认:** 最近 7 天

### 4.2 21:30 时间切分

```javascript
const isBeforeCurfew = (timestamp) => {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const minute = date.getMinutes();
  return hour < 21 || (hour === 21 && minute < 30);
};
```

### 4.3 健康度计算

```javascript
const calculateHealthScore = (logs, startDate, endDate) => {
  const filteredLogs = logs.filter(l => 
    l.timestamp >= startDate && l.timestamp <= endDate
  );
  
  const beforeCurfew = filteredLogs.filter(l => isBeforeCurfew(l.timestamp)).length;
  const ratio = beforeCurfew / filteredLogs.length;
  
  if (ratio >= 0.8) return { label: '健康', color: 'green' };
  if (ratio >= 0.6) return { label: '注意', color: 'yellow' };
  return { label: '警示', color: 'red' };
};
```

### 4.4 周期对比逻辑

```javascript
const compareWithPreviousPeriod = (current, previous) => {
  if (previous === 0) return { change: 100, trend: 'up' };
  const change = ((current - previous) / previous) * 100;
  return {
    change: Math.abs(change).toFixed(1),
    trend: change >= 0 ? 'up' : 'down'
  };
};
```

---

## 5. 验收标准

### 5.1 功能验收

- [ ] 页面可独立访问 (`/analytics`)
- [ ] 日期筛选器正常工作
- [ ] 3 个核心指标卡显示正确
- [ ] 4 个图表正确渲染
- [ ] 健康度标签准确
- [ ] 周期对比数据准确

### 5.2 性能验收

- [ ] 页面加载时间 < 2s
- [ ] 图表渲染流畅（无卡顿）
- [ ] 大数据量（1000+ logs）下性能正常

### 5.3 视觉验收

- [ ] 深色模式适配
- [ ] 响应式布局（移动端可用）
- [ ] 图表颜色与主站风格一致

---

## 6. 后续优化（V2）

- [ ] 科目维度分析（需扩展任务数据结构）
- [ ] 数据导出功能（CSV/PDF）
- [ ] 周报自动生成
- [ ] 游戏化元素（成就徽章、排行榜）

---

## 7. 依赖安装

```bash
cd timebank-app
npm install recharts react-router-dom
```

---

**设计确认:** 待用户批准  
**下一步:** 调用 `writing-plans` skill 创建实现计划
