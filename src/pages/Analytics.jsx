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

  // 空数据状态
  if (!logs || logs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="mb-6">
          <Link to="/" className="text-blue-400 hover:text-blue-300">
            ← 返回主页
          </Link>
        </div>
        <div className="card-comic text-center py-20">
          <div className="text-6xl mb-4 opacity-40">📊</div>
          <h2 className="text-2xl font-bold text-white mb-2">暂无数据</h2>
          <p className="text-cloud-dark text-sm mb-4">完成任务或兑换后，数据分析会出现在这里</p>
          <Link to="/" className="inline-block bg-sky text-white px-6 py-2 rounded-lg font-bold">
            去赚积分 ✈️
          </Link>
        </div>
      </div>
    );
  }

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
          onClick={() => setDays(14)}
          className={`px-4 py-2 rounded-lg ${days === 14 ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          最近 14 天
        </button>
        <button
          onClick={() => setDays(30)}
          className={`px-4 py-2 rounded-lg ${days === 30 ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          最近 30 天
        </button>
        <button
          onClick={() => setDays(null)}
          className={`px-4 py-2 rounded-lg ${days === null ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          全部数据
        </button>
      </div>

      {/* 核心指标卡 */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-2">总积分</div>
            <div className="text-3xl font-bold text-white">{metrics.points.value}</div>
            <div className={`text-sm mt-2 ${getTrendColorClass(metrics.points.trend)}`}>
              {metrics.points.trend && (
                <>
                  {getTrendIcon(metrics.points.trend)} {metrics.points.change}% 较上期
                </>
              )}
              {!metrics.points.trend && (
                <span className="text-gray-500">全部数据</span>
              )}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-2">任务完成</div>
            <div className="text-3xl font-bold text-white">{metrics.tasks.value} 次</div>
            <div className={`text-sm mt-2 ${getTrendColorClass(metrics.tasks.trend)}`}>
              {metrics.tasks.trend && (
                <>
                  {getTrendIcon(metrics.tasks.trend)} {metrics.tasks.change}% 较上期
                </>
              )}
              {!metrics.tasks.trend && (
                <span className="text-gray-500">全部数据</span>
              )}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-gray-400 text-sm mb-2">兑换次数</div>
            <div className="text-3xl font-bold text-white">{metrics.redeems.value} 次</div>
            <div className={`text-sm mt-2 ${getTrendColorClass(metrics.redeems.trend)}`}>
              {metrics.redeems.trend && (
                <>
                  {getTrendIcon(metrics.redeems.trend)} {metrics.redeems.change}% 较上期
                </>
              )}
              {!metrics.redeems.trend && (
                <span className="text-gray-500">全部数据</span>
              )}
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
              {healthScore.ratio}% 的活动在 21:00 之前
            </div>
          </div>
          <div className="text-right">
            <div className="text-gray-400 text-sm">14:00 前</div>
            <div className="text-lg font-bold text-emerald-400">{redeemTimeData.before14} 次</div>
            <div className="text-gray-400 text-sm">14:00-19:00</div>
            <div className="text-lg font-bold text-blue-400">{redeemTimeData.before19} 次</div>
            <div className="text-gray-400 text-sm">19:00-21:00</div>
            <div className="text-lg font-bold text-amber-400">{redeemTimeData.before21} 次</div>
            <div className="text-gray-400 text-sm">21:00 后</div>
            <div className="text-lg font-bold text-red-400">{redeemTimeData.after21} 次</div>
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
