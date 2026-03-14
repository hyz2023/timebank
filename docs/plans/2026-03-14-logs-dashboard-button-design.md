# LogsPage 数据看板入口按钮设计

## 目标

在数据记录页面（LogsPage）添加一个前往数据看板（Analytics）的按钮，提升用户在数据记录和数据分析之间的导航体验。

## 设计方案

### 位置
在"飞行日志"标题右侧添加按钮，与标题同行。

### 视觉设计
- **图标**: 📊
- **样式**: 图标按钮，带悬停/点击反馈
- **对齐**: 与标题垂直居中对齐
- **间距**: 与标题保持适当间距（gap-2）

### 交互
- 点击后跳转到 `/analytics` 路由
- 使用 React Router 的 `useNavigate` hook 进行导航

### 布局结构
```jsx
<div className="flex items-center gap-2">
    <span className="text-lg">📋</span>
    <h2 className="text-sky font-bold text-lg">飞行日志</h2>
    <span className="text-xs text-cloud-dark ml-auto">共 {logs.length} 条</span>
    {/* 新增 */}
    <button onClick={() => navigate('/analytics')} className="...">
        📊
    </button>
</div>
```

## 技术实现

### 修改文件
- `src/components/LogsPage.jsx`

### 依赖
- `useNavigate` from `react-router-dom`

### 样式
- 使用现有主题色（sky/gold）
- 保持与项目一致的卡片和按钮风格
- 添加适当的 transition 动画

## 验收标准

1. 按钮在页面顶部标题栏正确显示
2. 点击按钮能成功跳转到数据分析页面
3. 按钮样式与整体 UI 风格一致
4. 响应式设计良好（移动端友好）
