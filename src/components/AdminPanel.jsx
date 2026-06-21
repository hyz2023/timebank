import { useState, useRef } from 'react';
import useStore from '../store';
import { CATEGORIES } from '../engine';
import { enablePush, pushSupported, isIos, isStandalone } from '../utils/push-client';

export default function AdminPanel({ onClose }) {
    const tasks = useStore((s) => s.tasks);
    const balance = useStore((s) => s.balance);
    const updateTask = useStore((s) => s.updateTask);
    const addTask = useStore((s) => s.addTask);
    const removeTask = useStore((s) => s.removeTask);
    const adjustBalance = useStore((s) => s.adjustBalance);
    const exportData = useStore((s) => s.exportData);
    const importData = useStore((s) => s.importData);
    const loadData = useStore((s) => s.loadData);

    const [activeSection, setActiveSection] = useState('tasks');
    const [adjustAmount, setAdjustAmount] = useState('');
    const [newTaskName, setNewTaskName] = useState('');
    const [newTaskBase, setNewTaskBase] = useState('4');
    const [newTaskBonus, setNewTaskBonus] = useState('2');
    const [newTaskIcon, setNewTaskIcon] = useState('📝');
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [newTaskCategory, setNewTaskCategory] = useState('other');
    const [importMsg, setImportMsg] = useState('');
    const [balanceSubmitting, setBalanceSubmitting] = useState(false);
    const [balanceMsg, setBalanceMsg] = useState('');
    const [editingDesc, setEditingDesc] = useState({}); // 本地编辑状态
    const [editingPoints, setEditingPoints] = useState({}); // 本地积分编辑状态
    const [editingName, setEditingName] = useState({}); // 本地任务名编辑状态
    const [editingIcon, setEditingIcon] = useState({}); // 本地图标编辑状态
    const [editingCategory, setEditingCategory] = useState({}); // 本地分类编辑状态
    const fileInputRef = useRef(null);
    const config = useStore((s) => s.config);
    const setNotifyOnExpire = useStore((s) => s.setNotifyOnExpire);
    const [pushMsg, setPushMsg] = useState('');
    const iosNeedsInstall = isIos() && !isStandalone();

    const handleEnablePush = async () => {
        setPushMsg('正在开启…');
        try {
            await enablePush();
            setPushMsg('✅ 已开启后台到站提醒');
        } catch (e) {
            setPushMsg('❌ ' + (e?.message || '开启失败'));
        }
    };

    const handleExport = () => {
        const data = exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timebank_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const ok = importData(ev.target.result);
            setImportMsg(ok ? '✅ 导入成功！' : '❌ 导入失败，文件格式不正确');
            setTimeout(() => setImportMsg(''), 3000);
        };
        reader.readAsText(file);
    };

    const handleAddTask = () => {
        if (!newTaskName.trim()) return;
        addTask({
            name: newTaskName.trim(),
            basePoints: parseInt(newTaskBase) || 4,
            bonusPoints: parseInt(newTaskBonus) || 2,
            icon: newTaskIcon || '📝',
            desc: newTaskDesc || newTaskName.trim(),
            category: newTaskCategory || 'other',
        });
        setNewTaskName('');
        setNewTaskBase('4');
        setNewTaskBonus('2');
        setNewTaskIcon('📝');
        setNewTaskDesc('');
        setNewTaskCategory('other');
    };

    // 描述输入框失去焦点时保存
    const handleDescBlur = (taskId, value) => {
        const task = tasks.find(t => t.id === taskId);
        if (task && value !== task.desc) {
            updateTask(taskId, { desc: value });
        }
        setEditingDesc(prev => {
            const next = { ...prev };
            delete next[taskId];
            return next;
        });
    };

    // 任务名输入框失去焦点时保存
    const handleNameBlur = (taskId, value) => {
        const task = tasks.find(t => t.id === taskId);
        if (task && value.trim() && value !== task.name) {
            updateTask(taskId, { name: value.trim() });
        }
        setEditingName(prev => {
            const next = { ...prev };
            delete next[taskId];
            return next;
        });
    };

    // 图标输入框失去焦点时保存
    const handleIconBlur = (taskId, value) => {
        const task = tasks.find(t => t.id === taskId);
        if (task && value && value !== task.icon) {
            updateTask(taskId, { icon: value });
        }
        setEditingIcon(prev => {
            const next = { ...prev };
            delete next[taskId];
            return next;
        });
    };

    // 分类选择时保存
    const handleCategoryChange = (taskId, value) => {
        const task = tasks.find(t => t.id === taskId);
        if (task && value !== task.category) {
            updateTask(taskId, { category: value });
        }
        setEditingCategory(prev => {
            const next = { ...prev };
            delete next[taskId];
            return next;
        });
    };

    // 积分输入框失去焦点时保存
    const handlePointsBlur = (taskId, field, value) => {
        const task = tasks.find(t => t.id === taskId);
        const numValue = parseInt(value) || 0;
        if (task && task[field] !== numValue) {
            updateTask(taskId, { [field]: numValue });
        }
        setEditingPoints(prev => {
            const next = { ...prev };
            if (next[taskId]) {
                delete next[taskId][field];
                if (Object.keys(next[taskId]).length === 0) {
                    delete next[taskId];
                }
            }
            return next;
        });
    };

    const handleAdjustBalance = async (amount) => {
        const amt = parseFloat(amount);
        if (balanceSubmitting || isNaN(amt) || amt === 0) return;
        setBalanceSubmitting(true);
        setBalanceMsg('');
        try {
            await adjustBalance(amt);
            setAdjustAmount('');
            const label = amt > 0 ? `增加 ${amt} 分` : `扣减 ${Math.abs(amt)} 分`;
            setBalanceMsg(`✅ 已${label}，请勿重复点击`);
            window.setTimeout(() => setBalanceMsg(''), 2600);
        } catch (e) {
            setBalanceMsg(`❌ 调整失败：${e?.message || '请稍后重试'}`);
        } finally {
            setBalanceSubmitting(false);
        }
    };

    const sections = [
        { id: 'tasks', label: '任务', icon: '📋' },
        { id: 'balance', label: '积分', icon: '💰' },
        { id: 'data', label: '数据', icon: '💾' },
    ];

    return (
        <div
            className="fixed inset-0 z-[250] flex items-end justify-center bg-black/60 overlay-enter"
            onClick={onClose}
        >
            <div
                className="modal-enter w-full max-w-[480px] rounded-t-2xl max-h-[85vh] overflow-y-auto"
                style={{ background: 'linear-gradient(135deg, #16213e, #1a1a2e)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-50 px-5 pt-5 pb-3" style={{ background: 'linear-gradient(180deg, #16213e, rgba(22,33,62,0.98))' }}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🔧</span>
                            <h2 className="text-white font-bold text-lg">管理面板</h2>
                        </div>
                        <button className="text-cloud-dark text-2xl" onClick={onClose}>×</button>
                    </div>

                    {/* Section Tabs */}
                    <div className="flex gap-1 bg-navy-dark rounded-xl p-1">
                        {sections.map((s) => (
                            <button
                                key={s.id}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeSection === s.id
                                        ? 'bg-sky/20 text-sky'
                                        : 'text-cloud-dark'
                                    }`}
                                onClick={() => setActiveSection(s.id)}
                            >
                                {s.icon} {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-5 pb-8 pt-3 space-y-4">
                    {/* ===== 任务管理 ===== */}
                    {activeSection === 'tasks' && (
                        <>
                            {tasks.map((task) => (
                                <div key={task.id} className="card-comic">
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-3">
                                            <input
                                                type="text"
                                                className="w-10 bg-navy-dark text-white rounded-lg px-1 py-1 text-xl text-center border border-sky/20 focus:border-sky/50 outline-none"
                                                value={editingIcon.hasOwnProperty(task.id) ? editingIcon[task.id] : task.icon}
                                                onChange={(e) => setEditingIcon(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                onBlur={(e) => handleIconBlur(task.id, e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                className="flex-1 min-w-0 bg-navy-dark text-white rounded-lg px-2 py-1 text-sm font-bold border border-sky/20 focus:border-sky/50 outline-none"
                                                value={editingName.hasOwnProperty(task.id) ? editingName[task.id] : task.name}
                                                onChange={(e) => setEditingName(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                onBlur={(e) => handleNameBlur(task.id, e.target.value)}
                                            />
                                            <button
                                                className="text-red text-xs px-3 py-1 rounded bg-red/10 whitespace-nowrap"
                                                onClick={() => {
                                                    if (confirm(`确认删除任务「${task.name}」？`)) removeTask(task.id);
                                                }}
                                            >
                                                删除
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-cloud-dark block mb-1">基础分</label>
                                                <input
                                                    type="number" step="0.01"
                                                    className="w-full bg-navy-dark text-white rounded-lg px-3 py-2 text-sm border border-sky/20 focus:border-sky/50 outline-none"
                                                    value={editingPoints[task.id]?.basePoints ?? task.basePoints}
                                                    onChange={(e) => setEditingPoints(prev => ({
                                                        ...prev,
                                                        [task.id]: { ...prev[task.id], basePoints: e.target.value }
                                                    }))}
                                                    onBlur={(e) => handlePointsBlur(task.id, 'basePoints', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-cloud-dark block mb-1">奖励分</label>
                                                <input
                                                    type="number" step="0.01"
                                                    className="w-full bg-navy-dark text-white rounded-lg px-3 py-2 text-sm border border-sky/20 focus:border-sky/50 outline-none"
                                                    value={editingPoints[task.id]?.bonusPoints ?? task.bonusPoints}
                                                    onChange={(e) => setEditingPoints(prev => ({
                                                        ...prev,
                                                        [task.id]: { ...prev[task.id], bonusPoints: e.target.value }
                                                    }))}
                                                    onBlur={(e) => handlePointsBlur(task.id, 'bonusPoints', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs text-cloud-dark block mb-1">分类</label>
                                            <div className="flex gap-1.5">
                                                {Object.entries(CATEGORIES).map(([key, cat]) => (
                                                    <button
                                                        key={key}
                                                        className={`flex-1 text-xs py-2 rounded-lg font-bold transition-all ${
                                                            (editingCategory.hasOwnProperty(task.id) ? editingCategory[task.id] : task.category) === key
                                                                ? 'bg-sky/20 text-sky border border-sky/30'
                                                                : 'bg-navy-dark text-cloud-dark border border-transparent'
                                                        }`}
                                                        onClick={() => handleCategoryChange(task.id, key)}
                                                    >
                                                        {cat.icon} {cat.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs text-cloud-dark block mb-1">描述</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="w-full bg-navy-dark text-white rounded-lg px-3 py-2 text-sm border border-sky/20 focus:border-sky/50 outline-none"
                                                    value={editingDesc.hasOwnProperty(task.id) ? editingDesc[task.id] : (task.desc || '')}
                                                    onChange={(e) => setEditingDesc(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                    onBlur={(e) => handleDescBlur(task.id, e.target.value)}
                                                    placeholder="例如：55 字练字只能在周一到周五做"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* 新增任务 */}
                            <div className="card-comic border-dashed border-sky/20">
                                <div className="relative z-10">
                                    <p className="text-sm font-bold text-sky mb-3">➕ 添加新任务</p>
                                    <div className="grid grid-cols-4 gap-2 mb-3">
                                        <input
                                            type="text"
                                            placeholder="图标"
                                            className="bg-navy-dark text-white rounded-lg px-3 py-2 text-sm border border-sky/20 outline-none text-center"
                                            value={newTaskIcon}
                                            onChange={(e) => setNewTaskIcon(e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            placeholder="任务名"
                                            className="col-span-3 bg-navy-dark text-white rounded-lg px-3 py-2 text-sm border border-sky/20 outline-none"
                                            value={newTaskName}
                                            onChange={(e) => setNewTaskName(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                        <input
                                            type="number" step="0.01"
                                            placeholder="基础分"
                                            className="bg-navy-dark text-white rounded-lg px-3 py-2 text-sm border border-sky/20 outline-none"
                                            value={newTaskBase}
                                            onChange={(e) => setNewTaskBase(e.target.value)}
                                        />
                                        <input
                                            type="number" step="0.01"
                                            placeholder="奖励分"
                                            className="bg-navy-dark text-white rounded-lg px-3 py-2 text-sm border border-sky/20 outline-none"
                                            value={newTaskBonus}
                                            onChange={(e) => setNewTaskBonus(e.target.value)}
                                        />
                                        <button className="btn-primary text-sm py-2" onClick={handleAddTask}>
                                            添加
                                        </button>
                                    </div>
                                    <div className="mb-3">
                                        <input
                                            type="text"
                                            placeholder="任务描述（可选）"
                                            className="w-full bg-navy-dark text-white rounded-lg px-3 py-2 text-sm border border-sky/20 focus:border-sky/50 outline-none"
                                            value={newTaskDesc || ''}
                                            onChange={(e) => setNewTaskDesc(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-cloud-dark block mb-1">分类</label>
                                        <div className="flex gap-1.5">
                                            {Object.entries(CATEGORIES).map(([key, cat]) => (
                                                <button
                                                    key={key}
                                                    className={`flex-1 text-xs py-2 rounded-lg font-bold transition-all ${
                                                        newTaskCategory === key
                                                            ? 'bg-sky/20 text-sky border border-sky/30'
                                                            : 'bg-navy-dark text-cloud-dark border border-transparent'
                                                    }`}
                                                    onClick={() => setNewTaskCategory(key)}
                                                >
                                                    {cat.icon} {cat.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ===== 积分调整 ===== */}
                    {activeSection === 'balance' && (
                        <div className="card-comic">
                            <div className="relative z-10">
                                <p className="text-sm text-cloud-dark mb-2">当前余额</p>
                                <p className="text-3xl font-black text-gold mb-4">{balance} pts</p>
                                {balanceMsg && (
                                    <div className={`mb-3 rounded-xl px-3 py-2 text-sm font-bold ${balanceMsg.startsWith('✅') ? 'bg-green/15 text-green border border-green/20' : 'bg-red/15 text-red border border-red/20'}`}>
                                        {balanceMsg}
                                    </div>
                                )}

                                <label className="text-xs text-cloud-dark block mb-1">调整数额（正数加分，负数减分）</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number" step="0.01"
                                        className="flex-[2] min-w-0 bg-navy-dark text-white rounded-lg px-3 py-2 text-sm border border-sky/20 focus:border-sky/50 outline-none"
                                        placeholder="例如: 10 或 -5"
                                        value={adjustAmount}
                                        onChange={(e) => setAdjustAmount(e.target.value)}
                                        disabled={balanceSubmitting}
                                    />
                                    <button
                                        className="btn-primary text-sm whitespace-nowrap flex-[1] max-w-fit disabled:opacity-60"
                                        onClick={() => handleAdjustBalance(adjustAmount)}
                                        disabled={balanceSubmitting}
                                    >
                                        {balanceSubmitting ? '调整中…' : '调整'}
                                    </button>
                                </div>

                                <div className="flex gap-2 mt-3">
                                    {[5, 10, 20, -5, -10].map((v) => (
                                        <button
                                            key={v}
                                            className={`flex-1 text-xs py-2 rounded-lg font-bold disabled:opacity-60 ${v > 0
                                                    ? 'bg-green/15 text-green border border-green/20'
                                                    : 'bg-red/15 text-red border border-red/20'
                                                }`}
                                            onClick={() => handleAdjustBalance(v)}
                                            disabled={balanceSubmitting}
                                        >
                                            {v > 0 ? '+' : ''}{v}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== 数据管理 ===== */}
                    {activeSection === 'data' && (
                        <div className="space-y-4">
                            <div className="card-comic border-sky/20">
                                <div className="relative z-10">
                                    <p className="text-sm font-bold text-sky mb-2">🔄 刷新数据</p>
                                    <p className="text-xs text-cloud-dark mb-3">从服务端重新加载最新数据（每日计数会自动重置）。</p>
                                    <button
                                        className="btn-primary w-full text-sm"
                                        onClick={async () => {
                                            await loadData();
                                            alert('✅ 数据已刷新！');
                                        }}
                                    >
                                        立即刷新
                                    </button>
                                </div>
                            </div>

                            <div className="card-comic">
                                <div className="relative z-10">
                                    <p className="text-sm font-bold text-white mb-2">📤 导出备份</p>
                                    <p className="text-xs text-cloud-dark mb-3">将所有数据导出为 JSON 文件，防止数据丢失。</p>
                                    <button className="btn-primary w-full text-sm" onClick={handleExport}>
                                        下载备份文件
                                    </button>
                                </div>
                            </div>

                            <div className="card-comic">
                                <div className="relative z-10">
                                    <p className="text-sm font-bold text-white mb-2">📥 导入恢复</p>
                                    <p className="text-xs text-cloud-dark mb-3">选择之前导出的 JSON 文件进行数据恢复。</p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".json"
                                        className="hidden"
                                        onChange={handleImport}
                                    />
                                    <button
                                        className="btn-secondary w-full text-sm"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        选择备份文件
                                    </button>
                                    {importMsg && (
                                        <p className="text-sm text-center mt-2">{importMsg}</p>
                                    )}
                                </div>
                            </div>

                            <div className="card-comic">
                                <div className="relative z-10 space-y-3">
                                    <h3 className="text-sky font-bold text-sm">🔔 到站提醒</h3>

                                    <label className="flex items-center justify-between text-sm text-cloud">
                                        <span>后台系统通知（锁屏/切走时）</span>
                                        <input
                                            type="checkbox"
                                            checked={config?.notifyOnExpire !== false}
                                            onChange={(e) => setNotifyOnExpire(e.target.checked)}
                                        />
                                    </label>

                                    {iosNeedsInstall ? (
                                        <p className="text-xs text-cloud-dark leading-relaxed">
                                            📱 iPhone/iPad 需先把本应用「添加到主屏幕」：点浏览器分享按钮 → 添加到主屏幕 → 从主屏幕图标打开后，再回到这里开启提醒。
                                        </p>
                                    ) : pushSupported() ? (
                                        <button className="btn-primary w-full" onClick={handleEnablePush}>
                                            开启本设备的到站提醒
                                        </button>
                                    ) : (
                                        <p className="text-xs text-cloud-dark">当前环境不支持后台通知。</p>
                                    )}

                                    {pushMsg && <p className="text-xs text-cloud-dark">{pushMsg}</p>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
