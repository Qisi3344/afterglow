// 任务系统 — 阶段推进、核心收集、倒计时、结算统计与评级。
export const Phase = Object.freeze({
  APPROACH: 'approach',   // 前往设施
  COLLECT: 'collect',     // 回收三枚核心
  BEACON: 'beacon',       // 前往信标
  EVACUATE: 'evacuate',   // 撤离倒计时
});

export const EVAC_TIME = 90;

export class MissionSystem {
  constructor(ui, audio) {
    this.ui = ui;
    this.audio = audio;
    this.reset();
  }

  reset() {
    this.state = {
      phase: Phase.APPROACH,
      cores: 0,
      coresTotal: 3,
      datalogsRead: 0,
      datalogsTotal: 5,
      kills: 0,
      timeSec: 0,
      evacT: EVAC_TIME,
      beaconActive: false,
    };
    this._sync();
  }

  _sync() {
    const s = this.state;
    const objectives = {
      [Phase.APPROACH]: { text: '进入烛龙站研究舱段', detail: '穿过着陆平台，开启北侧闸门', progress: null },
      [Phase.COLLECT]: { text: `回收相位核心 ${s.cores}/${s.coresTotal}`, detail: '温室 · 实验室 · 反应堆高台', progress: s.cores / s.coresTotal },
      [Phase.BEACON]: { text: '重启撤离信标', detail: '反应堆大厅北侧二层平台', progress: null },
      [Phase.EVACUATE]: { text: '撤离！返回打捞飞船', detail: '沿着陆平台方向一路向南', progress: null, urgent: true },
    };
    this.ui.updateObjective(objectives[s.phase], s);
  }

  tick(dt) {
    if (this.state.phase === Phase.EVACUATE) {
      this.state.evacT = Math.max(0, this.state.evacT - dt);
      this.ui.updateEvacTimer(this.state.evacT);
      if (this.state.evacT <= 0) {
        return 'fail_timeout'; // Game 层处理失败
      }
    } else {
      this.state.timeSec += dt;
    }
    return null;
  }

  onDoorOpened() {
    if (this.state.phase === Phase.APPROACH) {
      this.state.phase = Phase.COLLECT;
      this._sync();
    }
  }

  onCoreCollected() {
    this.state.cores++;
    if (this.state.cores >= this.state.coresTotal) {
      this.state.phase = Phase.BEACON;
      this.ui.toast('三枚核心集齐 — 前往反应堆大厅重启信标', 'good');
    }
    this._sync();
  }

  onDatalogRead() {
    this.state.datalogsRead++;
    this._sync();
  }

  onEnemyKilled() {
    this.state.kills++;
  }

  onBeaconActivated() {
    this.state.phase = Phase.EVACUATE;
    this.state.beaconActive = true;
    this._sync();
    return true;
  }

  // 结算评级：时间短、击杀多、数据板全 → 高评
  computeRank() {
    const s = this.state;
    let score = 0;
    if (s.timeSec < 420) score += 2;
    else if (s.timeSec < 600) score += 1;
    if (s.kills >= 10) score += 2;
    else if (s.kills >= 5) score += 1;
    if (s.datalogsRead >= 5) score += 2;
    else if (s.datalogsRead >= 3) score += 1;
    if (s.evacT > 40) score += 1;
    return score >= 7 ? 'S' : score >= 5 ? 'A' : score >= 3 ? 'B' : 'C';
  }

  getStats() {
    const s = this.state;
    return {
      timeSec: s.timeSec,
      kills: s.kills,
      dataLogs: s.datalogsRead,
      rank: this.computeRank(),
    };
  }
}
