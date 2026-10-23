// 游戏状态机 — 管理标题/游玩/暂停/胜负等状态的转移与进入/退出回调。
export const GameState = Object.freeze({
  TITLE: 'TITLE',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT',
});

export class StateMachine {
  constructor() {
    this.state = GameState.TITLE;
    this.listeners = new Map(); // state -> [fn]
    this.data = { runStats: null };
  }

  on(state, fn) {
    if (!this.listeners.has(state)) this.listeners.set(state, []);
    this.listeners.get(state).push(fn);
    return () => {
      const arr = this.listeners.get(state);
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    };
  }

  transition(next) {
    if (next === this.state) return;
    const prev = this.state;
    this.state = next;
    for (const fn of this.listeners.get(next) || []) fn(prev);
  }

  is(...states) {
    return states.includes(this.state);
  }
}
