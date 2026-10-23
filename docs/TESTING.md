# 测试说明与结果

## 自动化单元测试（node --test）

```
npm test
```

覆盖纯逻辑模块（不依赖浏览器）：

| 模块 | 用例 | 结果 |
| --- | --- | --- |
| StateMachine | 状态转移/监听器携带前状态/相同状态不触发/is 多态查询/取消订阅 | PASS |
| MissionSystem | approach→collect→beacon→evacuate 全流程；倒计时归零返回 fail_timeout 且不下穿 0；平时 tick 计时；评级 S/C 边界；getStats 汇总；reset 干净 | PASS |
| SaveSystem | 默认值、设置合并持久化、未改字段保留、bestRun 更新规则（更快才覆盖） | PASS |
| CollisionWorld | 圆柱推墙；低台阶不推出且支撑面为箱顶（stepAllow 语义）；containsPoint 命中/未命中 | PASS |

**10/10 通过**（Node v24.15.0，2026-10-24）。

## 浏览器端到端验证（ZCode IAB + DOM 注入）

在真实浏览器中运行并逐项断言：

| # | 验证项 | 结果 |
| --- | --- | --- |
| 1 | 页面加载无控制台错误（bootErrors 收集器为空） | PASS |
| 2 | 标题界面渲染（标题/按钮/最佳纪录/3D 背景） | PASS（截图确认） |
| 3 | 开始行动 → PLAYING，6 架敌机在正确出生点巡逻 | PASS |
| 4 | W 前进 2s 移动 ≈10m，游戏时钟与真实时间 1:1 | PASS |
| 5 | 闸门 E 交互开启 → 任务进入 collect 阶段 | PASS |
| 6 | 三核心拾取（跨区域传送）→ 计数 3/3 → beacon 阶段 | PASS |
| 7 | 信标激活 → evacuate + 警报 + 撤离波次生成（场上 8 架） | PASS |
| 8 | 90s 倒计时 UI 显示 | PASS |
| 9 | 登船 → VICTORY + 评级 B + 结算界面 + bestRun 写入 localStorage | PASS |
| 10 | 重新开始 → 全状态重置（cores 0/HP 100/位置重置/警报关/敌机重巡逻） | PASS |
| 11 | 数据板读取 → 弹窗 + 计数 | PASS |
| 12 | 暂停菜单显示/玩家冻结；恢复回 PLAYING | PASS |
| 13 | 设置音量实时生效（masterGain 0.3 精确写入） | PASS |
| 14 | 画质/辉光设置持久化（localStorage round-trip） | PASS |
| 15 | 生产构建 `vite build` 成功（579KB / gzip 152KB） | PASS |

## 视觉验收（截图 + 视觉模型分析）

- 标题界面：星空/行星/残骸背景、霓虹标题、菜单布局 —— 通过
- 着陆平台：玩家角色（白装甲+发光腰带+青面罩）第三人称背影、灯柱引导线、闸门地标 —— 通过
- 温室：发光植物架阵列、悬浮八面体核心（青绿光环）—— 通过
- 反应堆大厅：中央反应堆柱发光环带、高顶光环、二层平台、雾效纵深 —— 通过

## 已知未验证项

- 手柄输入（未实现，非本轮目标）
- 极端低配设备帧率（未在无独显环境实测；提供三档画质降级）
