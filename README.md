# 残响 AFTERGLOW

> 烛龙站打捞行动 — 第三人称科幻探索动作游戏 · 垂直切片

你是一名深空打捞员。废弃研究站"烛龙站"的安保网络已经失控，三枚相位核心散落在设施深处。回收它们，重启撤离信标，在安保无人机群的围攻下活着回到你的飞船。

![tech](https://img.shields.io/badge/Three.js-0.170-2affd5) ![tech](https://img.shields.io/badge/Vite-6-ff8c3a) ![lang](https://img.shields.io/badge/JavaScript-ES_Modules-blue)

## 快速开始

```bash
npm install     # 安装依赖（three + vite）
npm run dev     # 开发服务器 → http://127.0.0.1:5173
npm run build   # 生产构建 → dist/
npm run preview # 预览构建产物
npm test        # 单元测试（状态机/任务/存档/碰撞）
```

无需任何外部素材：全部模型程序化构建、全部纹理 Canvas 生成、全部音效 WebAudio 合成。

## 操作

| 按键 | 动作 |
| --- | --- |
| W A S D | 移动（相对相机方向） |
| 鼠标 | 视角（锁定模式；嵌入式视图按住左键拖动） |
| Shift | 冲刺（消耗能量） |
| 空格 | 跳跃 |
| E | 交互 / 拾取核心 / 读取数据板 |
| 鼠标左键 | 脉冲手枪 |
| Esc | 暂停 |

## 核心循环

1. **进入设施** — 从着陆平台穿过闸门进入研究舱段
2. **回收核心** — 温室、实验室、反应堆高台各一枚（自由顺序探索）
3. **重启信标** — 反应堆大厅二层平台，插入三枚核心
4. **撤离战** — 90 秒倒计时，安保无人机波次全图追击，跑回飞船登船

5 块可收集数据板补充环境叙事；结算按用时/击杀/收集给出 S~C 评级并记录最佳成绩（localStorage）。

## 技术栈与架构

Three.js 0.170 + Vite 6，纯 ES Modules 多文件工程（无单文件打包游戏）。关键模块：

```
src/
  main.js               入口与装配
  style.css             全套 UI 视觉系统（玻璃拟态 + 切角面板 + 扫描线）
  core/    Game.js      主循环、状态机流转、后处理、渲染看门狗
           StateMachine.js  输入 / 存档 / 碰撞 / 音频引擎（WebAudio 合成）
  world/   World.js     场景总装：光照体系、雾、星空、动态元素
           ZoneA_Platform.js  着陆平台（起点/教学/撤离点）
           ZoneB_Labs.js      研究舱段（走廊 + 温室/实验室/储藏室）
           ZoneC_Reactor.js   反应堆大厅（信标 / 二层平台 / 撤离战）
           Materials.js  程序化 PBR 材质与 Canvas 纹理
           Effects.js    池化粒子系统 + 环境尘埃
           Kit.js        可复用构建组件（墙/门/核心/终端/数据板）
  player/  Player.js    角色模型、移动物理、生命/能量、程序化动画
           CameraRig.js  第三人称相机（肩部偏移 + AABB 遮挡收缩 + 震动）
  gameplay/ Missions.js   任务阶段与评级
           Enemy.js      无人机 AI 状态机（PATROL/ALERT/ATTACK/DEAD）+ 波次管理
           Projectiles.js 池化弹道（玩家脉冲/敌方激光）
  ui/      UIManager.js 标题/HUD/暂停/设置/数据板/结算
tests/    logic.test.mjs  逻辑单元测试（node --test）
docs/     设计 / 架构 / 测试 / 已知问题 / 开发记录
```

详细说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 与 [docs/DESIGN.md](docs/DESIGN.md)。

## 画面与技术特性

- 程序化 PBR 材质（金属板/格栅/岩石 Canvas 纹理）+ ACES 色调映射 + UnrealBloom 辉光
- 分区光照设计：冷蓝半球光 + 投影月光 + 暖橙应急灯 + 反应堆青绿核心光，警报时全局转红
- 指数雾、星空穹顶、远景行星、漂浮岩石与尘埃粒子营造深渊感
- 池化粒子（火花/爆炸/拾取）与池化弹道，零每帧几何分配
- 无人机悬浮动画、转子旋转、受击火花、爆炸烟尘
- 程序化音频：环境低鸣、和弦 pad 音乐（撤离阶段切换紧张音色）、十余种合成音效、心跳低血量提示
- 画质分级（高/中/低：阴影与辉光）、音量/灵敏度/辉光设置，全部持久化

## 已知问题

见 [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)。简版：嵌入式浏览器视图下指针锁定不可用（已做拖动视角降级）；阴影贴图覆盖跟随相机可能在大厅边缘出现迟滞。

## License

MIT（代码全部原创；无第三方素材依赖）。
