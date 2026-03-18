const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'data', 'timebank-data.json');

// 中间件
app.use(express.json());

// CORS 跨域支持
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// 确保数据目录存在
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// 初始化数据文件
const getDefaultData = () => ({
    balance: 0,
    tasks: [
        { id: 't1', name: '练字', basePoints: 3, bonusPoints: 0, dailyCount: 0, lastUpdate: getTodayStr(), icon: '🖊️', desc: '55 字练字只能在周一到周五做' },
        { id: 't2', name: '单词', basePoints: 6, bonusPoints: 0, dailyCount: 0, lastUpdate: getTodayStr(), icon: '📖', desc: '百词斩打卡' },
        { id: 't3', name: '口算', basePoints: 4, bonusPoints: 2, dailyCount: 0, lastUpdate: getTodayStr(), icon: '🔢', desc: '计算小超市 1 页' },
        { id: 't4', name: '数学题', basePoints: 4, bonusPoints: 2, dailyCount: 0, lastUpdate: getTodayStr(), icon: '📐', desc: '164 练习题' },
        { id: 't5', name: '英语学习', basePoints: 12, bonusPoints: 0, dailyCount: 0, lastUpdate: getTodayStr(), icon: '📺', desc: '满分英语 1 视频 + 练习题' },
        { id: 't6', name: '练字一页（仅周末）', basePoints: 10, bonusPoints: 1, dailyCount: 0, lastUpdate: getTodayStr(), icon: '🐅', desc: '写一页书法只能在休息日做' },
        { id: 't7', name: '英语单词复习 80 词', basePoints: 4, bonusPoints: 0, dailyCount: 0, lastUpdate: getTodayStr(), icon: '🏰', desc: '百词斩填词 80 词' },
        { id: 't8', name: '语文练习卷 1/4 页', basePoints: 8, bonusPoints: 4, dailyCount: 0, lastUpdate: getTodayStr(), icon: '📝', desc: '语文练习卷 1/4 页' },
    ],
    logs: [],
    config: {
        dailyExchangeLimitWeekday: 60,
        dailyExchangeLimitHoliday: 90,
    },
});

const getTodayStr = () => {
    // 使用本地时间（北京时间 UTC+8）
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// 读取数据（带每日重置）
const readData = () => {
    let data;
    try {
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        } else {
            data = getDefaultData();
        }
    } catch (error) {
        console.error('读取数据失败:', error);
        data = getDefaultData();
    }

    // 每日重置检查
    const today = getTodayStr();
    const needsReset = data.tasks.some((t) => t.lastUpdate !== today);
    if (needsReset) {
        console.log(`[TimeBank] ✅ 执行每日重置 - ${today}`);
        data.tasks = data.tasks.map((task) =>
            task.lastUpdate !== today
                ? { ...task, dailyCount: 0, lastUpdate: today }
                : task
        );
        saveData(data);
    }

    return data;
};

// 保存数据
const saveData = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
        console.log('[TimeBank] 数据已保存');
    } catch (error) {
        console.error('保存数据失败:', error);
    }
};

// ===== API 路由 =====

// 获取完整数据
app.get('/api/data', (req, res) => {
    const data = readData();
    res.json(data);
});

// 保存完整数据（用于导入/配置修改）
app.post('/api/data', (req, res) => {
    const newData = req.body;
    saveData(newData);
    res.json({ success: true, message: '数据已保存' });
});

// 完成任务
app.post('/api/earn', (req, res) => {
    const { taskId, isPerfect } = req.body;
    const data = readData();
    
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) {
        return res.status(404).json({ error: '任务不存在' });
    }

    // 计算积分（含衰减）
    const count = task.dailyCount + 1;
    let multiplier = 1.0;
    if (count >= 5) multiplier = 0.5;
    else if (count >= 3) multiplier = 0.75;

    let points = task.basePoints * multiplier;
    if (isPerfect) points += task.bonusPoints * multiplier;
    points = Math.round(points * 100) / 100;

    // 更新任务计数
    const today = getTodayStr();
    task.dailyCount += 1;
    task.lastUpdate = today;

    // 更新余额
    data.balance += points;

    // 添加日志
    const log = {
        id: `l_${Date.now()}`,
        type: 'EARN',
        taskId,
        taskName: task.name,
        pointsChange: points,
        timestamp: Date.now(),
        meta: {
            quality: isPerfect ? 'perfect' : 'normal',
            decayRate: multiplier,
            dailyCount: task.dailyCount,
        },
    };
    data.logs.unshift(log);

    saveData(data);
    res.json({ success: true, points, newBalance: data.balance, dailyCount: task.dailyCount });
});

// 兑换积分
app.post('/api/redeem', (req, res) => {
    const { tier } = req.body;
    const data = readData();

    if (data.balance < tier.cost) {
        return res.status(400).json({ error: '积分不足' });
    }

    // 扣除积分
    data.balance -= tier.cost;

    // 添加日志
    const log = {
        id: `l_${Date.now()}`,
        type: 'REDEEM',
        taskId: null,
        taskName: tier.label,
        pointsChange: -tier.cost,
        minutes: tier.totalMinutes,
        baseMinutes: tier.baseMinutes,
        timestamp: Date.now(),
        meta: { tier: tier.id },
    };
    data.logs.unshift(log);

    // 创建计时器
    const timer = {
        id: `timer_${Date.now()}`,
        minutes: tier.totalMinutes,
        startTime: Date.now(),
        endTime: Date.now() + tier.totalMinutes * 60 * 1000,
        label: tier.label,
    };
    data.timers = data.timers || [];
    data.timers.unshift(timer);

    saveData(data);
    res.json({ success: true, newBalance: data.balance, timer });
});

// 清除已过期计时器
app.post('/api/timers/clear', (req, res) => {
    const data = readData();
    const now = Date.now();
    const before = data.timers?.length || 0;
    data.timers = (data.timers || []).filter((t) => t.endTime > now);
    const removed = before - data.timers.length;
    saveData(data);
    res.json({ success: true, removed });
});

// 暂停计时器
app.post('/api/timers/:timerId/pause', (req, res) => {
    const { timerId } = req.params;
    const data = readData();
    const now = Date.now();
    
    const timer = data.timers?.find((t) => t.id === timerId);
    if (!timer || timer.endTime <= now) {
        return res.status(404).json({ error: '计时器不存在或已过期' });
    }

    timer.remainingMs = timer.endTime - now;
    timer.paused = true;
    timer.endTime = null;

    saveData(data);
    res.json({ success: true, timer });
});

// 继续计时器
app.post('/api/timers/:timerId/resume', (req, res) => {
    const { timerId } = req.params;
    const data = readData();
    const now = Date.now();
    
    const timer = data.timers?.find((t) => t.id === timerId);
    if (!timer || !timer.paused || !timer.remainingMs) {
        return res.status(404).json({ error: '计时器不存在或无法继续' });
    }

    timer.endTime = now + timer.remainingMs;
    timer.paused = false;
    timer.remainingMs = null;

    saveData(data);
    res.json({ success: true, timer });
});

// 更新任务配置
app.put('/api/tasks/:taskId', (req, res) => {
    const { taskId } = req.params;
    const updates = req.body;
    const data = readData();
    
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) {
        return res.status(404).json({ error: '任务不存在' });
    }

    Object.assign(task, updates);
    saveData(data);
    res.json({ success: true, task });
});

// 添加任务
app.post('/api/tasks', (req, res) => {
    const { name, basePoints, bonusPoints, icon, desc } = req.body;
    const data = readData();
    
    const newTask = {
        id: `t_${Date.now()}`,
        name: name.trim(),
        basePoints: parseInt(basePoints) || 4,
        bonusPoints: parseInt(bonusPoints) || 2,
        icon: icon || '📝',
        desc: desc || name.trim(),
        dailyCount: 0,
        lastUpdate: getTodayStr(),
    };
    
    data.tasks.push(newTask);
    saveData(data);
    res.json({ success: true, task: newTask });
});

// 删除任务
app.delete('/api/tasks/:taskId', (req, res) => {
    const { taskId } = req.params;
    const data = readData();
    data.tasks = data.tasks.filter((t) => t.id !== taskId);
    saveData(data);
    res.json({ success: true });
});

// 调整余额
app.post('/api/balance/adjust', (req, res) => {
    const { amount } = req.body;
    const data = readData();
    
    const log = {
        id: `l_${Date.now()}`,
        type: amount >= 0 ? 'EARN' : 'REDEEM',
        taskId: null,
        taskName: '管理员调整',
        pointsChange: amount,
        timestamp: Date.now(),
        meta: { admin: true },
    };
    
    data.balance = Math.max(0, data.balance + amount);
    data.logs.unshift(log);
    saveData(data);
    
    res.json({ success: true, newBalance: data.balance });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TimeBank Server running on http://0.0.0.0:${PORT}`);
    console.log(`📁 数据文件：${DATA_FILE}`);
});
