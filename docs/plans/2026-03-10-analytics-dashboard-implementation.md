# TimeBank 数据分析 Dashboard 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建一个独立的数据分析 Dashboard 页面，用于评估玩家的积极性和健康度。

**Architecture:** 在现有 React + Vite 项目中添加 `/analytics` 路由，使用 Recharts 图表库可视化 store.js 中的 logs 数据，包含 4 个图表组件和 3 个核心指标卡。

**Tech Stack:** React 19, Recharts 2.15+, React Router DOM 7+, Zustand, Tailwind CSS 4

---

## 依赖安装

**Step 1: 安装 Recharts 和 React Router**

```bash
cd /home/openclaw/.openclaw/workspace/timebank-app
npm install recharts react-router-dom
```

Expected: 安装成功，无错误

**Step 2: 验证安装**

```bash
npm list recharts react-router-dom
```

Expected: 显示已安装的版本号

**Step 3: 提交依赖变更**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts and react-router-dom dependencies"
```

---

### Task 1: 数据聚合工具函数

**Files:**
- Create: `src/utils/analytics.js`
- Test: 手动测试（后续集成到页面验证）

**Step 1: 创建工具函数文件**

创建 `src/utils/analytics.js`，包含以下函数：

```javascript
import { getTodayStr } from '../engine';

/**
 * 检查时间是否在 21:30 之前
 */
export const isBeforeCurfew = (timestamp) => {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const minute = date.getMinutes();
  return hour < 21 || (hour === 21 && minute < 30);
};

/**
 * 获取日期范围的时间戳
 */
export const getDateRange = (days) => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return { start: start.getTime(), end: end.getTime() };
};

/**
 * 格式化时间戳为日期字符串
 */
export const formatDate = (timestamp) => {
  return new Date(timestamp).toISOString().slice(0, 10);
};

/**
 * 格式化时间戳为小时
 */
export const formatHour = (timestamp) => {
  return new Date(timestamp).getHours();
};

/**
 * 格式化时间戳为星期几 (0-6, 0=周日)
 */
export const formatDayOfWeek = (timestamp) => {
  return new Date(timestamp).getDay();
};

/**
 * 过滤指定日期范围的 logs
 */
export const filterLogsByDateRange = (logs, startTimestamp, endTimestamp) => {
  return logs.filter(l => l.timestamp >= startTimestamp && l.timestamp <= endTimestamp);
};

/**
 * 计算每日趋势数据
 */
export const calculateDailyTrend = (logs, days) => {
  const { start, end } = getDateRange(days);
  const filteredLogs = filterLogsByDateRange(logs, start, end);
  
  // 按日期分组
  const dailyData = {};
  const dateKeys = [];
  
  // 初始化所有日期
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().slice(0, 10);
    dailyData[dateStr] = { date: dateStr, points: 0, tasks: 0, redeems: 0 };
    dateKeys.push(dateStr);
  }
  
  // 聚合数据
  filteredLogs.forEach(log => {
    const dateStr = formatDate(log.timestamp);
    if (dailyData[dateStr]) {
      if (log.type === 'EARN') {
        dailyData[dateStr].points += log.pointsChange;
        dailyData[dateStr].tasks += 1;
      } else if (log.type === 'REDEEM') {
        dailyData[dateStr].redeems += 1;
      }
    }
  });
  
  return dateKeys.map(key => dailyData[key]);
};

/**
 * 计算热力图数据（按小时和星期几）
 */
export const calculateHeatmapData = (logs, days) => {
  const { start, end } = getDateRange(days);
  const filteredLogs = filterLogsByDateRange(logs, start, end);
  
  // 初始化热力图数据 (7 天 x 24 小时)
  const heatmapData = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmapData.push({ day, hour, value: 0 });
    }
  }
  
  // 聚合数据
  filteredLogs.forEach(log => {
    const day = formatDayOfWeek(log.timestamp);
    const hour = formatHour(log.timestamp);
    const index = day * 24 + hour;
    if (heatmapData[index]) {
      heatmapData[index].value += 1;
    }
  });
  
  return heatmapData;
};

/**
 * 计算任务分布数据
 */
export const calculateTaskDistribution = (logs, days) => {
  const { start, end } = getDateRange(days);
  const filteredLogs = filterLogsByDateRange(logs, start, end);
  
  // 按任务分组
  const taskMap = {};
  let totalPoints = 0;
  
  filteredLogs
    .filter(l => l.type === 'EARN' && l.taskId)
    .forEach(log => {
      if (!taskMap[log.taskName]) {
        taskMap[log.taskName] = 0;
      }
      taskMap[log.taskName] += log.pointsChange;
      totalPoints += log.pointsChange;
    });
  
  // 转换为数组并计算百分比
  return Object.entries(taskMap)
    .map(([name, value]) => ({
      name,
      value,
      percentage: totalPoints > 0 ? ((value / totalPoints) * 100).toFixed(1) : 0
    }))
    .sort((a, b) => b.value - a.value);
};

/**
 * 计算兑换时间分析数据
 */
export const calculateRedeemTimeAnalysis = (logs, days) => {
  const { start, end } = getDateRange(days);
  const filteredLogs = filterLogsByDateRange(logs, start, end);
  
  const beforeCurfew = filteredLogs
    .filter(l => l.type === 'REDEEM' && isBeforeCurfew(l.timestamp))
    .length;
  
  const afterCurfew = filteredLogs
    .filter(l => l.type === 'REDEEM' && !isBeforeCurfew(l.timestamp))
    .length;
  
  return {
    beforeCurfew,
    afterCurfew,
    total: beforeCurfew + afterCurfew
  };
};

/**
 * 计算健康度评分
 */
export const calculateHealthScore = (logs, days) => {
  const { start, end } = getDateRange(days);
  const filteredLogs = filterLogsByDateRange(logs, start, end);
  
  if (filteredLogs.length === 0) {
    return { label: '无数据', color: 'gray', ratio: 0 };
  }
  
  const beforeCurfew = filteredLogs.filter(l => isBeforeCurfew(l.timestamp)).length;
  const ratio = beforeCurfew / filteredLogs.length;
  
  if (ratio >= 0.8) return { label: '健康', color: 'green', ratio: (ratio * 100).toFixed(0) };
  if (ratio >= 0.6) return { label: '注意', color: 'yellow', ratio: (ratio * 100).toFixed(0) };
  return { label: '警示', color: 'red', ratio: (ratio * 100).toFixed(0) };
};

/**
 * 计算核心指标
 */
export const calculateMetrics = (logs, days) => {
  const { start, end } = getDateRange(days);
  const currentLogs = filterLogsByDateRange(logs, start, end);
  
  // 计算上一周期
  const prevStart = start - (end - start + 1);
  const prevEnd = start - 1;
  const prevLogs = filterLogsByDateRange(logs, prevStart, prevEnd);
  
  // 当前周期数据
  const currentPoints = currentLogs
    .filter(l => l.type === 'EARN')
    .reduce((sum, l) => sum + l.pointsChange, 0);
  
  const currentTasks = currentLogs.filter(l => l.type === 'EARN').length;
  const currentRedeems = currentLogs.filter(l => l.type === 'REDEEM').length;
  
  // 上一周期数据
  const prevPoints = prevLogs
    .filter(l => l.type === 'EARN')
    .reduce((sum, l) => sum + l.pointsChange, 0);
  
  const prevTasks = prevLogs.filter(l => l.type === 'EARN').length;
  const prevRedeems = prevLogs.filter(l => l.type === 'REDEEM').length;
  
  // 计算变化百分比
  const calcChange = (current, prev) => {
    if (prev === 0) return { change: 100, trend: 'up' };
    const change = ((current - prev) / prev) * 100;
    return {
      change: Math.abs(change).toFixed(1),
      trend: change >= 0 ? 'up' : 'down'
    };
  };
  
  return {
    points: {
      value: currentPoints,
      ...calcChange(currentPoints, prevPoints)
    },
    tasks: {
      value: currentTasks,
      ...calcChange(currentTasks, prevTasks)
    },
    redeems: {
      value: currentRedeems,
      ...calcChange(currentRedeems, prevRedeems)
    }
  };
};
```

**Step 2: 验证文件创建**

```bash
ls -la /home/openclaw/.openclaw/workspace/timebank-app/src/utils/
```

Expected: 显示 `analytics.js` 文件

**Step 3: 提交**

```bash
cd /home/openclaw/.openclaw/workspace/timebank-app
git add src/utils/analytics.js
git commit -m "feat: add analytics utility functions for data aggregation"
```

---

### Task 2: 创建图表组件

**Files:**
- Create: `src/components/charts/TrendChart.jsx`
- Create: `src/components/charts/HeatmapChart.jsx`
- Create: `src/components/charts/TaskPieChart.jsx`
- Create: `src/components/charts/TimeBarChart.jsx`

**Step 1: 创建图表组件目录**

```bash
mkdir -p /home/openclaw/.openclaw/workspace/timebank-app/src/components/charts
```

**Step 2: 创建 TrendChart.jsx (每日趋势折线图)**

```jsx
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const TrendChart = ({ data }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">📈 每日积分趋势</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
          <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#F3F4F6' }}
          />
          <Legend />
          <Line type="monotone" dataKey="points" stroke="#10B981" strokeWidth={2} name="积分" />
          <Line type="monotone" dataKey="tasks" stroke="#3B82F6" strokeWidth={2} name="任务数" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
```

**Step 3: 创建 HeatmapChart.jsx (活跃热力图)**

```jsx
import React from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export const HeatmapChart = ({ data }) => {
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  
  // 颜色映射（根据活跃度）
  const getColor = (value) => {
    if (value === 0) return '#374151';
    if (value <= 2) return '#10B981';
    if (value <= 5) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">🔥 活跃热力图</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          <XAxis 
            type="number" 
            dataKey="hour" 
            domain={[0, 23]} 
            stroke="#9CA3AF"
            tick={{ fontSize: 10 }}
            label={{ value: '小时', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }}
          />
          <YAxis 
            type="category" 
            dataKey="day" 
            domain={[0, 6]}
            stroke="#9CA3AF"
            tick={{ fontSize: 10 }}
            tickFormatter={(val) => dayNames[val]}
          />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#F3F4F6' }}
            formatter={(value, name, props) => [`${value.payload.value} 次活动`, '活跃度']}
          />
          <Scatter data={data} fill="#8884d8">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.value)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-500"></div> 低 (1-2)
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-500"></div> 中 (3-5)
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500"></div> 高 (6+)
        </span>
      </div>
    </div>
  );
};
```

**Step 4: 创建 TaskPieChart.jsx (任务分布饼图)**

```jsx
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

export const TaskPieChart = ({ data }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">📊 任务类型分布</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percentage }) => `${name} (${percentage}%)`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#F3F4F6' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
```

**Step 5: 创建 TimeBarChart.jsx (兑换时间柱状图)**

```jsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

export const TimeBarChart = ({ data }) => {
  const chartData = [
    { name: '21:30 前', value: data.beforeCurfew },
    { name: '21:30 后', value: data.afterCurfew }
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">⏰ 兑换时间分析</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
          <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#F3F4F6' }}
          />
          <Legend />
          <Bar dataKey="value" fill="#8884d8">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? '#10B981' : '#EF4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
```

**Step 6: 验证文件创建**

```bash
ls -la /home/openclaw/.openclaw/workspace/timebank-app/src/components/charts/
```

Expected: 显示 4 个图表组件文件

**Step 7: 提交**

```bash
cd /home/openclaw/.openclaw/workspace/timebank-app
git add src/components/charts/
git commit -m "feat: add 4 chart components (Trend, Heatmap, Pie, TimeBar)"
```

---

### Task 3: 创建 Analytics 主页面

**Files:**
- Create: `src/pages/Analytics.jsx`

**Step 1: 创建 pages 目录**

```bash
mkdir -p /home/openclaw/.openclaw/workspace/timebank-app/src/pages
```

**Step 2: 创建 Analytics.jsx 主页面**

```jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useStore from '../store';
import {
  calculateMetrics,
  calculateDailyTrend,
  calculateHeatmapData,
  calculateTaskDistribution,
  calculateRedeemTimeAnalysis,
  calculateHealthScore
} from '../utils/analytics';
import { TrendChart } from '../components/charts/TrendChart';
import { HeatmapChart } from '../components/charts/HeatmapChart';
import { TaskPieChart } from '../components/charts/TaskPieChart';
import { TimeBarChart } from '../components/charts/TimeBarChart';

export const Analytics = () => {
  const logs = useStore((state) => state.logs);
  const [days, setDays] = useState(7);
  const [metrics, setMetrics] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [taskDistribution, setTaskDistribution] = useState([]);
  const [redeemTimeData, setRedeemTimeData] = useState({ beforeCurfew: 0, afterCurfew: 0, total: 0 });
  const [healthScore, setHealthScore] = useState({ label: '-', color: 'gray', ratio: 0 });

  useEffect(() => {
    if (logs && logs.length > 0) {
      setMetrics(calculateMetrics(logs, days));
      setTrendData(calculateDailyTrend(logs, days));
      setHeatmapData(calculateHeatmapData(logs, days));
      setTaskDistribution(calculateTaskDistribution(logs, days));
      setRedeemTimeData(calculateRedeemTimeAnalysis(logs, days));
      setHealthScore(calculateHealthScore(logs, days));
    }
  }, [logs, days]);

  const getHealthColorClass = (color) => {
    switch (color) {
      case 'green': return 'bg-emerald-500';
      case 'yellow': return 'bg-amber-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTrendIcon = (trend) => {
    return trend === 'up' ? '↑' : '↓';
  };

  const getTrendColorClass = (trend) => {
    return trend === 'up' ? 'text-emerald-400' : 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">TimeBank 数据分析看板</h1>
          <p className="text-gray-400 mt-1">评估玩家的积极性和健康度</p>
        </div>
        <Link to="/" className="text-blue-400 hover:text-blue-300">
          ← 返回主页
        </Link>
      </div>

      {/* 日期筛选器 */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setDays(7)}
          className={`px-4 py-2 rounded-lg ${days === 7 ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          最近 7 天
        </button>
        <button
          onClick={() => setDays(30)}
          className={`px-4 py-2 rounded-lg ${days === 30 ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          最近 30 天
        </button>
      </div>

      {/* 核心指标卡 */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-2">总积分</div>
            <div className="text-3xl font-bold text-white">{metrics.points.value}</div>
            <div className={`text-sm mt-2 ${getTrendColorClass(metrics.points.trend)}`}>
              {getTrendIcon(metrics.points.trend)} {metrics.points.change}% 较上期
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-2">任务完成</div>
            <div className="text-3xl font-bold text-white">{metrics.tasks.value} 次</div>
            <div className={`text-sm mt-2 ${getTrendColorClass(metrics.tasks.trend)}`}>
              {getTrendIcon(metrics.tasks.trend)} {metrics.tasks.change}% 较上期
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-2">兑换次数</div>
            <div className="text-3xl font-bold text-white">{metrics.redeems.value} 次</div>
            <div className={`text-sm mt-2 ${getTrendColorClass(metrics.redeems.trend)}`}>
              {getTrendIcon(metrics.redeems.trend)} {metrics.redeems.change}% 较上期
            </div>
          </div>
        </div>
      )}

      {/* 健康度指标 */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-gray-400 text-sm mb-2">健康度评估</div>
            <div className="text-2xl font-bold text-white">
              <span className={`inline-block w-3 h-3 rounded-full mr-2 ${getHealthColorClass(healthScore.color)}`}></span>
              {healthScore.label}
            </div>
            <div className="text-gray-400 text-sm mt-1">
              {healthScore.ratio}% 的活动在 21:30 之前
            </div>
          </div>
          <div className="text-right">
            <div className="text-gray-400 text-sm">21:30 前兑换</div>
            <div className="text-xl font-bold text-emerald-400">{redeemTimeData.beforeCurfew} 次</div>
            <div className="text-gray-400 text-sm mt-1">21:30 后兑换</div>
            <div className="text-xl font-bold text-red-400">{redeemTimeData.afterCurfew} 次</div>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart data={trendData} />
        <TaskPieChart data={taskDistribution} />
        <HeatmapChart data={heatmapData} />
        <TimeBarChart data={redeemTimeData} />
      </div>
    </div>
  );
};

export default Analytics;
```

**Step 3: 验证文件创建**

```bash
ls -la /home/openclaw/.openclaw/workspace/timebank-app/src/pages/
```

Expected: 显示 `Analytics.jsx` 文件

**Step 4: 提交**

```bash
cd /home/openclaw/.openclaw/workspace/timebank-app
git add src/pages/Analytics.jsx
git commit -m "feat: create Analytics dashboard page with metrics and charts"
```

---

### Task 4: 配置路由

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/App.jsx`

**Step 1: 修改 main.jsx 添加路由支持**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

**Step 2: 修改 App.jsx 添加路由**

在 `src/App.jsx` 顶部添加导入：

```jsx
import { Routes, Route } from 'react-router-dom';
import Analytics from './pages/Analytics';
```

在 App 组件的 return 中，用 Routes 包裹现有内容：

```jsx
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/analytics" element={<Analytics />} />
    </Routes>
  );
}
```

（注意：保持现有的 Home 组件逻辑不变，只是用 Routes 包裹）

**Step 3: 验证修改**

```bash
cd /home/openclaw/.openclaw/workspace/timebank-app
npm run build
```

Expected: 构建成功，无错误

**Step 4: 提交**

```bash
git add src/main.jsx src/App.jsx
git commit -m "feat: add react-router-dom routing for analytics page"
```

---

### Task 5: 测试与验证

**Files:**
- 测试：浏览器手动测试

**Step 1: 启动开发服务器**

```bash
cd /home/openclaw/.openclaw/workspace/timebank-app
npm run dev
```

Expected: 服务器启动，显示本地访问地址

**Step 2: 访问主页验证**

访问 `http://localhost:5173/`
Expected: 主页正常显示，无错误

**Step 3: 访问分析页面验证**

访问 `http://localhost:5173/analytics`
Expected:
- 数据分析看板正常显示
- 3 个核心指标卡显示数据
- 健康度指标显示
- 4 个图表正常渲染
- 日期筛选器可切换（7 天/30 天）

**Step 4: 验证数据准确性**

- 检查指标卡数据是否与 logs 一致
- 检查图表数据是否合理
- 检查健康度计算是否正确

**Step 5: 提交最终版本**

```bash
git add .
git commit -m "feat: complete analytics dashboard with full testing"
```

---

## 验收清单

- [ ] 页面可独立访问 (`/analytics`)
- [ ] 日期筛选器正常工作（7 天/30 天切换）
- [ ] 3 个核心指标卡显示正确（含周期对比）
- [ ] 健康度指标准确（基于 21:30 切分）
- [ ] 4 个图表正确渲染（趋势、热力图、饼图、柱状图）
- [ ] 深色模式适配
- [ ] 响应式布局（移动端可用）
- [ ] 构建无错误

---

**计划完成！** 📋

下一步执行选项：

**1. 子代理驱动（当前会话）** - 我 dispatch 子代理按任务执行，每个任务后审查

**2. 并行会话（单独会话）** - 新开会话用 executing-plans 执行

选哪个？
