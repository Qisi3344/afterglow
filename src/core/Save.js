// 存档系统 — 设置与最佳纪录持久化到 localStorage。
const KEY = 'afterglow_save_v1';

export class SaveSystem {
  constructor() {
    this.data = this._load();
  }

  _defaults() {
    return {
      settings: {
        master: 0.8,
        music: 0.6,
        sfx: 0.8,
        sensitivity: 1.0,
        quality: 'high',   // high | medium | low
        bloom: true,
      },
      bestRun: null, // { timeSec, kills, dataLogs, rank }
      seenIntro: false,
    };
  }

  _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return this._defaults();
      const parsed = JSON.parse(raw);
      return { ...this._defaults(), ...parsed, settings: { ...this._defaults().settings, ...(parsed.settings || {}) } };
    } catch {
      return this._defaults();
    }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* 隐私模式等情况下静默失败 */ }
  }

  get settings() { return this.data.settings; }

  updateSettings(partial) {
    Object.assign(this.data.settings, partial);
    this.save();
  }

  recordRun(stats) {
    const prev = this.data.bestRun;
    if (!prev || stats.timeSec < prev.timeSec) {
      this.data.bestRun = { timeSec: stats.timeSec, kills: stats.kills, dataLogs: stats.dataLogs, rank: stats.rank };
      this.save();
      return true;
    }
    return false;
  }
}
