// 单元测试 — 纯逻辑模块：状态机 / 任务系统 / 存档 / 碰撞世界。
// 运行：npm test （node --test tests/）
import test from 'node:test';
import assert from 'node:assert/strict';

// ---- 为无浏览器环境准备最小 stub ----
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

const { GameState, StateMachine } = await import('../src/core/StateMachine.js');
const { MissionSystem, Phase, EVAC_TIME } = await import('../src/gameplay/Missions.js');
const { SaveSystem } = await import('../src/core/Save.js');

// three 的 Box3/Vector3 在 node 下可用（无 DOM 依赖）
const THREE = await import('three');
const { CollisionWorld } = await import('../src/core/Collision.js');

// ---------- StateMachine ----------
test('StateMachine: 初始为 TITLE，transition 触发监听并携带前状态', () => {
  const sm = new StateMachine();
  assert.equal(sm.state, GameState.TITLE);
  let seen = null;
  sm.on(GameState.PLAYING, (prev) => { seen = prev; });
  sm.transition(GameState.PLAYING);
  assert.equal(sm.state, GameState.PLAYING);
  assert.equal(seen, GameState.TITLE);
  // 相同状态不触发
  let again = false;
  sm.on(GameState.PLAYING, () => { again = true; });
  sm.transition(GameState.PLAYING);
  assert.equal(again, false);
});

test('StateMachine: is() 多状态查询与取消订阅', () => {
  const sm = new StateMachine();
  sm.transition(GameState.PAUSED);
  assert.ok(sm.is(GameState.PAUSED, GameState.VICTORY));
  assert.ok(!sm.is(GameState.PLAYING));
  let called = 0;
  const off = sm.on(GameState.VICTORY, () => called++);
  off();
  sm.transition(GameState.VICTORY);
  assert.equal(called, 0);
});

// ---------- MissionSystem ----------
function mockUI() {
  return {
    objectives: [], toasts: [], timers: [],
    updateObjective(o, s) { this.objectives.push([o.text, s.cores]); },
    updateEvacTimer(t) { this.timers.push(t); },
    toast(msg) { this.toasts.push(msg); },
  };
}

test('MissionSystem: 完整流程 approach→collect→beacon→evacuate', () => {
  const ui = mockUI();
  const m = new MissionSystem(ui, {});
  assert.equal(m.state.phase, Phase.APPROACH);
  m.onDoorOpened();
  assert.equal(m.state.phase, Phase.COLLECT);
  m.onCoreCollected();
  m.onCoreCollected();
  assert.equal(m.state.phase, Phase.COLLECT, '两枚核心后仍在收集阶段');
  m.onCoreCollected();
  assert.equal(m.state.phase, Phase.BEACON, '三枚核心后转信标阶段');
  m.onBeaconActivated();
  assert.equal(m.state.phase, Phase.EVACUATE);
  assert.equal(m.state.evacT, EVAC_TIME);
});

test('MissionSystem: 撤离倒计时归零返回失败信号', () => {
  const ui = mockUI();
  const m = new MissionSystem(ui, {});
  m.onDoorOpened();
  m.onCoreCollected(); m.onCoreCollected(); m.onCoreCollected();
  m.onBeaconActivated();
  m.state.evacT = 0.5;
  assert.equal(m.tick(0.6), 'fail_timeout');
  assert.equal(m.state.evacT, 0, '倒计时不下穿 0');
});

test('MissionSystem: 平时 tick 累计用时；评级逻辑合理', () => {
  const ui = mockUI();
  const m = new MissionSystem(ui, {});
  m.onDoorOpened();
  assert.equal(m.tick(10), null);
  assert.equal(m.state.timeSec, 10);
  // 快速通关 + 高击杀 + 全数据板 → S
  m.state.timeSec = 300; m.state.kills = 12; m.state.datalogsRead = 5; m.state.evacT = 60;
  assert.equal(m.computeRank(), 'S');
  // 慢速 + 无击杀 → C
  const m2 = new MissionSystem(mockUI(), {});
  m2.state.timeSec = 900;
  assert.equal(m2.computeRank(), 'C');
});

test('MissionSystem: getStats 汇总与重置', () => {
  const m = new MissionSystem(mockUI(), {});
  m.onDatalogRead(); m.onDatalogRead(); m.onEnemyKilled();
  const s = m.getStats();
  assert.equal(s.dataLogs, 2);
  assert.equal(s.kills, 1);
  assert.ok(['S', 'A', 'B', 'C'].includes(s.rank));
  m.reset();
  assert.equal(m.state.datalogsRead, 0);
  assert.equal(m.state.phase, Phase.APPROACH);
});

// ---------- SaveSystem ----------
test('SaveSystem: 设置读写合并、持久化、纪录更新', () => {
  globalThis.localStorage.clear?.();
  const save = new SaveSystem();
  assert.equal(save.settings.master, 0.8, '默认主音量');
  save.updateSettings({ master: 0.5, bloom: false });
  const reloaded = new SaveSystem();
  assert.equal(reloaded.settings.master, 0.5);
  assert.equal(reloaded.settings.bloom, false);
  assert.equal(reloaded.settings.sfx, 0.8, '未改字段保留默认');

  const first = { timeSec: 300, kills: 5, dataLogs: 3, rank: 'A' };
  assert.equal(reloaded.recordRun(first), true, '首次纪录');
  assert.equal(reloaded.recordRun({ timeSec: 400, kills: 9, dataLogs: 5, rank: 'A' }), false, '更慢不覆盖');
  assert.equal(reloaded.recordRun({ timeSec: 200, kills: 1, dataLogs: 1, rank: 'B' }), true, '更快覆盖');
  assert.equal(new SaveSystem().data.bestRun.timeSec, 200, '持久化生效');
});

// ---------- CollisionWorld ----------
test('CollisionWorld: 圆柱体水平推出墙体', () => {
  const cw = new CollisionWorld();
  cw.addBox(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 3, 4)));
  const pos = new THREE.Vector3(2, 0, 4.3); // 距墙面 0.3，半径 0.45 应被推到 4.45
  cw.resolveCircle(pos, 0.45, 0, 1.8);
  assert.ok(pos.z >= 4.44 && pos.z <= 4.46, `推出后 z=${pos.z}`);
});

test('CollisionWorld: 可跨越低台阶不推出，支撑面返回箱顶', () => {
  const cw = new CollisionWorld();
  cw.addBox(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 0.4, 2))); // 0.4 高台阶
  const pos = new THREE.Vector3(1, 0, 1); // 圆心在箱内，但低于 stepAllow
  cw.resolveCircle(pos, 0.45, 0, 1.8, 0.55);
  assert.equal(pos.x, 1, '低台阶不水平推出');
  const h = cw.supportHeight(1, 1, 0.45, 0.1);
  assert.equal(h, 0.4, '站上台阶顶面');
});

test('CollisionWorld: containsPoint 命中与未命中', () => {
  const cw = new CollisionWorld();
  cw.addBox(new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1)));
  assert.ok(cw.containsPoint(new THREE.Vector3(0, 1, 0)));
  assert.ok(!cw.containsPoint(new THREE.Vector3(2, 1, 0)));
});
