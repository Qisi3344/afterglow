# 架构说明

## 模块依赖图

```
main.js
  └─ core/Game.js  ──────────────┬──────────────────────────────┐
       ├─ core/StateMachine.js   │ 装配并驱动以下子系统          │
       ├─ core/Input.js          │                               │
       ├─ core/Audio.js          ▼                               │
       ├─ core/Save.js     world/World.js ── ZoneA/B/C + Kit     │
       ├─ core/Collision.js     (静态 AABB 碰撞世界，被各方共享) │
       ├─ world/Materials.js    world/Effects.js (粒子)          │
       ├─ player/Player.js      player/CameraRig.js              │
       ├─ gameplay/Missions.js  gameplay/Enemy.js (含 Manager)   │
       │                        gameplay/Projectiles.js          │
       └─ ui/UIManager.js  (DOM 模板注入 + 事件绑定)             │
                                  ───────────────────────────────┘
```

依赖方向单向：Game 装配一切；World 构建时产出 collision/interactables/doors/enemySpawns 等数据，供 Player/Enemy/Missions 消费；UI 只被调用不主动访问玩法。

## 关键设计

### 渲染循环与看门狗
`Game._loop`：rAF 驱动 + 17ms setInterval 看门狗。嵌入式视图（ZCode IAB）会节流 rAF，看门狗检测 50ms 无帧即兜底驱动，保证任何宿主环境 ~60fps；rAF 正常时看门狗空转。视口自愈：首帧 innerWidth=0 时延迟到布局完成再 resize。

### 状态机
`StateMachine` 提供 `transition/on/is`。GameState：TITLE / PLAYING / PAUSED / VICTORY / DEFEAT。暂停由 pointer lock 丢失自动触发（浏览器 Esc 语义）。`Game.startRun()` 负责完整重置（任务/敌人/弹道/玩家/门/交互物/警报），保证重开零残留。

### 碰撞
`CollisionWorld` 维护静态 `THREE.Box3` 列表：
- `resolveCircle(pos, r, footY, headY, stepAllow)` — 圆柱水平推出；低于 stepAllow(0.55m) 的障碍不推出（自动跨台阶）
- `supportHeight(x, z, r, footY)` — 支撑面查询（地面/箱顶/二层平台统一处理）
- `containsPoint` — 弹道撞墙判定
旋转墙均限制正交，AABB 近似即可。

### 对象池
粒子（`ParticleSystem`：预分配 1500 槽位 swap-back 回收）与弹道（`Projectiles._pool` mesh 复用）均零每帧分配。

### 敌人 AI
`Enemy` 状态机见 DESIGN.md；`EnemyManager` 管理常规生成与撤离波次。敌人移动带切向避墙探测。

### 交互
World 构建时注册 `interactables[]`（type: door/core/datalog/beacon/evac/repair），每帧 Game 取最近可交互项显示提示，E 键触发 `onInteract(game)`——交互逻辑闭包引用局部状态（门滑轨、核心可见性），通过 `Game` 门面访问全局系统。

### 音频
`AudioEngine` 三总线（master 压缩器 → music/sfx）。音乐为程序化和弦循环（setTimeout 重排），`setTension(true)` 切换紧张音色。全部合法自研合成，无外部素材。

## 扩展方式

- **新区域**：新建 `ZoneX.js` 导出 `buildZoneX(scene, M, world)`，在 `World.js` 注册；使用 `Kit.js` 组件保证风格统一
- **新敌人**：在 `Enemy` 状态机中加状态，或派生类替换 `_build` 与行为
- **新任务阶段**：`Missions.js` 的 Phase 枚举 + objectives 文案 + 对应触发钩子
- **手柄支持**：`Input.js` 加 Gamepad 轮询，映射到相同 wish/mouseDX 接口即可
