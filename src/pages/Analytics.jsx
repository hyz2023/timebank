import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useStore from '../store';
import {
  calculateMetrics,
  calculateDailyTrend,
  calculateHeatmapData,
  calculateTaskDistribution,
  calculateRedeemTimeAnalysis,
  calculateHealthScore,
  calculateDailyGameTime
} from '../utils/analytics';
import { getTodayStr } from '../engine';
import { TrendChart } from '../components/charts/TrendChart';
import { TaskPieChart } from '../components/charts/TaskPieChart';
import { HeatmapChart } from '../components/charts/HeatmapChart';
import { TimeBarChart } from '../components/charts/TimeBarChart';
import { DailyGameTimeChart } from '../components/charts/DailyGameTimeChart';

export const Analytics = () => {
  const logs = useStore((state) => state.logs);
  const loading = useStore((state) => state.loading);
  const loadData = useStore((state) => state.loadData);
  const [days, setDays] = useState(7);
  // 自定义日期区间
  const [customRange, setCustomRange] = useState(null); // null 或 { startDate, endDate }
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  
  const [metrics, setMetrics] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [earnHeatmapData, setEarnHeatmapData] = useState([]);
  const [redeemHeatmapData, setRedeemHeatmapData] = useState([]);
  const [activeHeatmap, setActiveHeatmap] = useState('earn');
  const [taskDistribution, setTaskDistribution] = useState([]);
  const [healthScore, setHealthScore] = useState({ label: '-', color: 'gray', ratio: 0 });
  const [redeemMinutes, setRedeemMinutes] = useState(0);
  const [redeemTimeAnalysis, setRedeemTimeAnalysis] = useState(null);
  const [dailyGameTime, setDailyGameTime] = useState([]);

  // 确保数据已加载
  useEffect(() => {
    console.log('[Analytics] 检查数据加载', { loading, logsLength: logs?.length });
    if (!loading && (!logs || logs.length === 0)) {
      console.log('[Analytics] 调用 loadData()');
      loadData();
    }
  }, [loading, logs, loadData]);

  // 计算数据
  useEffect(() => {
    console.log('[Analytics] 开始计算数据', { logsLength: logs?.length, days, customRange });
    if (logs && logs.length > 0) {
      try {
        const range = customRange || null;
        const metricsData = calculateMetrics(logs, days, range);
        setMetrics(metricsData);
        setRedeemMinutes(metricsData.redeemMinutes?.value || 0);
        setTrendData(calculateDailyTrend(logs, days, range));
        setEarnHeatmapData(calculateHeatmapData(logs, days, 'EARN', range));
        setRedeemHeatmapData(calculateHeatmapData(logs, days, 'REDEEM', range));
        setTaskDistribution(calculateTaskDistribution(logs, days, range));
        setHealthScore(calculateHealthScore(logs, days, range));
        setRedeemTimeAnalysis(calculateRedeemTimeAnalysis(logs, days, range));
        setDailyGameTime(calculateDailyGameTime(logs, days, range));
        console.log('[Analytics] 数据计算完成');
      } catch (err) {
        console.error('[Analytics] 计算错误:', err);
      }
    }
  }, [logs, days, customRange]);

  console.log('[Analytics] 渲染', { loading, logsLength: logs?.length, hasMetrics: !!metrics });

  // 数据加载中
  if (loading) {
    console.log('[Analytics] 显示加载中');
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  // 空数据状态
  if (!logs || logs.length === 0) {
    console.log('[Analytics] 显示暂无数据');
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="mb-4">
          <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm">
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

  // 主渲染
  console.log('[Analytics] 渲染主界面');
  return (
    <div className="min-h-screen bg-gray-900 text-white p-3 pb-20">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">📊 数据分析</h1>
          <p className="text-gray-400 text-xs mt-0.5">评估玩家的积极性和健康度</p>
        </div>
        <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm">
          返回
        </Link>
      </div>

      {/* 日期筛选器 */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => { setDays(7); setCustomRange(null); setIsCustomPickerOpen(false); }}
          className={`px-3 py-1.5 rounded text-xs whitespace-nowrap ${days === 7 && !customRange ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          7 天
        </button>
        <button
          onClick={() => { setDays(14); setCustomRange(null); setIsCustomPickerOpen(false); }}
          className={`px-3 py-1.5 rounded text-xs whitespace-nowrap ${days === 14 && !customRange ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          14 天
        </button>
        <button
          onClick={() => { setDays(30); setCustomRange(null); setIsCustomPickerOpen(false); }}
          className={`px-3 py-1.5 rounded text-xs whitespace-nowrap ${days === 30 && !customRange ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          30 天
        </button>
        <button
          onClick={() => { setDays(null); setCustomRange(null); setIsCustomPickerOpen(false); }}
          className={`px-3 py-1.5 rounded text-xs whitespace-nowrap ${days === null && !customRange ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          全部
        </button>
        <button
          onClick={() => {
            if (customRange) {
              setCustomRange(null);
              setIsCustomPickerOpen(false);
              setDays(7);
            } else {
              setIsCustomPickerOpen(!isCustomPickerOpen);
            }
          }}
          className={`px-3 py-1.5 rounded text-xs whitespace-nowrap ${customRange || isCustomPickerOpen ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          {customRange ? '📅 自定义中' : '📅 自定义'}
        </button>
      </div>

      {/* 自定义日期区间选择器 */}
      {isCustomPickerOpen && (
        <div className="mb-3 bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-gray-400">起</label>
            <input
              type="date"
              value={tempStartDate}
              onChange={e => setTempStartDate(e.target.value)}
              className="bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600"
            />
            <span className="text-gray-500">→</span>
            <label className="text-xs text-gray-400">止</label>
            <input
              type="date"
              value={tempEndDate}
              onChange={e => setTempEndDate(e.target.value)}
              className="bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600"
            />
            <button
              onClick={() => {
                if (tempStartDate && tempEndDate) {
                  setDays(null);
                  setCustomRange({ startDate: tempStartDate, endDate: tempEndDate });
                  setIsCustomPickerOpen(false);
                }
              }}
              disabled={!tempStartDate || !tempEndDate}
              className="ml-auto px-3 py-1 rounded text-xs font-semibold disabled:opacity-40 bg-blue-600 hover:bg-blue-500"
            >
              确认
            </button>
          </div>
        </div>
      )}

      {/* 自定义区间提示 */}
      {customRange && (
        <div className="mb-3 bg-blue-900/40 rounded-lg p-2 flex items-center justify-between">
          <span className="text-xs text-blue-300">📅 {customRange.startDate} → {customRange.endDate}</span>
          <button
            onClick={() => { setCustomRange(null); setDays(7); }}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            取消
          </button>
        </div>
      )}

      {/* 核心指标卡 - 2x2 网格 */}
      {metrics && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">总积分</div>
            <div className="text-2xl font-bold text-white">{metrics.points.value}</div>
            <div className={`text-xs mt-1 ${getTrendColorClass(metrics.points.trend)}`}>
              {metrics.points.trend && (
                <>{getTrendIcon(metrics.points.trend)} {metrics.points.change}%</>
              )}
              {!metrics.points.trend && <span className="text-gray-500">全部数据</span>}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">任务数</div>
            <div className="text-2xl font-bold text-white">{metrics.tasks.value}</div>
            <div className={`text-xs mt-1 ${getTrendColorClass(metrics.tasks.trend)}`}>
              {metrics.tasks.trend && (
                <>{getTrendIcon(metrics.tasks.trend)} {metrics.tasks.change}%</>
              )}
              {!metrics.tasks.trend && <span className="text-gray-500">全部数据</span>}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">总兑换时长</div>
            <div className="text-2xl font-bold text-white">{redeemMinutes} <span className="text-sm text-gray-400">分钟</span></div>
            <div className={`text-xs mt-1 ${getTrendColorClass(metrics.redeemMinutes?.trend)}`}>
              {metrics.redeemMinutes?.trend && (
                <>{getTrendIcon(metrics.redeemMinutes.trend)} {metrics.redeemMinutes.change}%</>
              )}
              {!metrics.redeemMinutes?.trend && <span className="text-gray-500">全部数据</span>}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">兑换次数</div>
            <div className="text-2xl font-bold text-white">{metrics.redeems.value}</div>
            <div className={`text-xs mt-1 ${getTrendColorClass(metrics.redeems.trend)}`}>
              {metrics.redeems.trend && (
                <>{getTrendIcon(metrics.redeems.trend)} {metrics.redeems.change}%</>
              )}
              {!metrics.redeems.trend && <span className="text-gray-500">全部数据</span>}
            </div>
          </div>
        </div>
      )}

      {/* 图表区域 - 完整布局 */}
      <div className="space-y-3">
        <TrendChart data={trendData} />
        <TaskPieChart data={taskDistribution} />
        <DailyGameTimeChart data={dailyGameTime} />
        
        {/* 健康度 - 兑换时间分布 */}
        {redeemTimeAnalysis && <TimeBarChart data={redeemTimeAnalysis} />}
        
        {/* 热力图 - 左右并排 */}
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-sm font-semibold text-white mb-2">🔥 活跃热力图</h3>
          <div className="flex gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-400 mb-2 text-center">💰 赚积分</div>
              <HeatmapChart data={earnHeatmapData} compact />
            </div>
            <div className="w-px bg-gray-700"></div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-400 mb-2 text-center">🎁 兑换</div>
              <HeatmapChart data={redeemHeatmapData} compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
