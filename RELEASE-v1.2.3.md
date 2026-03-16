# TimeBank v1.2.3

**发布日期：** 2026-03-16  
**版本类型：** Bug 修复补丁

---

## 修复内容

### 🔧 积分衰减逻辑修正

- **问题：** 完美奖励（bonusPoints）未参与衰减计算，导致高次数任务收益偏高
- **修复：** bonusPoints 现在也参与衰减
- **影响范围：** 所有任务的 Perfect 奖励

### 衰减规则（全部得分参与衰减）

| 次数 | 收益率 | 计算方式 |
|------|--------|----------|
| 第 1-2 次 | 100% | (base + bonus) × 1.0 |
| 第 3-4 次 | 75% | (base + bonus) × 0.75 |
| 第 5+ 次 | 50% | (base + bonus) × 0.50 |

### 示例（数学题 base=5, bonus=2）

| 次数 | Perfect 得分 | 计算 |
|------|-------------|------|
| 第 1-2 次 | 7.00 分 | (5+2) × 1.0 |
| 第 3-4 次 | 5.25 分 | (5+2) × 0.75 |
| 第 5+ 次 | 3.50 分 | (5+2) × 0.50 |

### 技术改动

- `src/engine.js`: `calculatePoints` 函数
  - 从 `basePoints * multiplier + bonusPoints` 
  - 改为 `(basePoints + bonusPoints) * multiplier`
- `src/components/EarnPage.jsx`: Perfect 按钮显示同步更新

---

## 升级说明

刷新浏览器即可生效。

---

## 变更统计

- 2 个文件修改
- +3 行，-2 行
