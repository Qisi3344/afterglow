// 音频引擎 — 全程序化 WebAudio 合成，无外部素材依赖。
// 结构：master 压缩器 → master 增益 → {音乐总线, 音效总线}；环境层常驻。
export class AudioEngine {
  constructor(save) {
    this.save = save;
    this.ctx = null;
    this.started = false;
    this._ambientNodes = [];
    this._musicTimer = null;
    this._chordIndex = 0;
    this._tension = false;
    this._lastFootstep = 0;
    this._lastHeartbeat = 0;
  }

  // 浏览器要求用户手势后才能启动音频上下文
  ensureStarted() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.ratio.value = 6;
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.comp.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.musicBus.connect(this.comp);
    this.sfxBus.connect(this.comp);
    this.applySettings();
    this._startAmbient();
    this._startMusic();
    this.started = true;
  }

  applySettings() {
    const s = this.save.settings;
    if (this.master) this.master.gain.value = s.master;
    if (this.musicBus) this.musicBus.gain.value = s.music * 0.5;
    if (this.sfxBus) this.sfxBus.gain.value = s.sfx;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  // ---------- 常驻环境层 ----------
  _startAmbient() {
    const ctx = this.ctx;
    // 低频站体嗡鸣
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 46;
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.05;
    // 缓慢呼吸调制
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(oscGain.gain);
    osc.connect(oscGain).connect(this.musicBus);
    osc.start(); lfo.start();
    // 高频风声（噪声 + 带通）
    const noise = this._noiseSource();
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 0.6;
    const nGain = ctx.createGain();
    nGain.gain.value = 0.012;
    noise.connect(band).connect(nGain).connect(this.musicBus);
    noise.start();
    this._ambientNodes.push(osc, lfo, noise);
  }

  _noiseSource() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  // ---------- 程序化音乐：慢速 pad 和弦循环 ----------
  _startMusic() {
    // 小调进行：Am - F - C - G 的低音区 voicing（频率为音名对应值）
    this._chords = this._tension
      ? [[110, 130.8, 164.8], [103.8, 123.5, 155.6], [98, 116.5, 146.8], [92.5, 110, 138.6]]
      : [[110, 164.8, 220, 261.6], [87.3, 130.8, 174.6, 220], [98, 146.8, 196, 246.9], [98, 146.8, 196, 293.7]];
    const play = () => {
      if (!this.ctx) return;
      const chord = this._chords[this._chordIndex % this._chords.length];
      this._chordIndex++;
      const now = this.ctx.currentTime;
      const dur = this._tension ? 3.2 : 7.5;
      chord.forEach((f, i) => {
        const o = this.ctx.createOscillator();
        o.type = this._tension ? 'sawtooth' : 'triangle';
        o.frequency.value = f * (this._tension && i === 0 ? 0.5 : 1);
        o.detune.value = (Math.random() - 0.5) * 8;
        const g = this.ctx.createGain();
        const peak = this._tension ? 0.05 : 0.035;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(peak, now + dur * 0.35);
        g.gain.linearRampToValueAtTime(0.0001, now + dur);
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = this._tension ? 1400 : 700;
        o.connect(g).connect(filt).connect(this.musicBus);
        o.start(now); o.stop(now + dur + 0.1);
      });
      if (this._tension) this._pulseBass(now);
      this._musicTimer = setTimeout(play, dur * 1000);
    };
    play();
  }

  _pulseBass(now) {
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.8;
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(55, t);
      o.frequency.exponentialRampToValueAtTime(30, t + 0.3);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(this.musicBus);
      o.start(t); o.stop(t + 0.4);
    }
  }

  setTension(on) {
    if (this._tension === on) return;
    this._tension = on;
    if (this._musicTimer) {
      clearTimeout(this._musicTimer);
      this._startMusicRestart();
    }
  }

  _startMusicRestart() {
    // 换和弦表后重新循环（复用 _startMusic 的定时器逻辑）
    if (this._musicTimer) clearTimeout(this._musicTimer);
    const chords = this._tension
      ? [[110, 130.8, 164.8], [103.8, 123.5, 155.6], [98, 116.5, 146.8], [92.5, 110, 138.6]]
      : [[110, 164.8, 220, 261.6], [87.3, 130.8, 174.6, 220], [98, 146.8, 196, 246.9], [98, 146.8, 196, 293.7]];
    this._chords = chords;
    this._chordIndex = 0;
    const play = () => {
      if (!this.ctx) return;
      const chord = this._chords[this._chordIndex % this._chords.length];
      this._chordIndex++;
      const now = this.ctx.currentTime;
      const dur = this._tension ? 3.2 : 7.5;
      chord.forEach((f, i) => {
        const o = this.ctx.createOscillator();
        o.type = this._tension ? 'sawtooth' : 'triangle';
        o.frequency.value = f * (this._tension && i === 0 ? 0.5 : 1);
        o.detune.value = (Math.random() - 0.5) * 8;
        const g = this.ctx.createGain();
        const peak = this._tension ? 0.05 : 0.035;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(peak, now + dur * 0.35);
        g.gain.linearRampToValueAtTime(0.0001, now + dur);
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = this._tension ? 1400 : 700;
        o.connect(g).connect(filt).connect(this.musicBus);
        o.start(now); o.stop(now + dur + 0.1);
      });
      if (this._tension) this._pulseBass(now);
      this._musicTimer = setTimeout(play, dur * 1000);
    };
    play();
  }

  // ---------- 一次性音效 ----------
  _blip({ freq = 440, end = 220, dur = 0.15, type = 'square', vol = 0.15, when = 0 }) {
    if (!this.started) return;
    const now = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, end), now + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(now); o.stop(now + dur + 0.05);
  }

  _noiseBurst({ dur = 0.3, freq = 800, q = 1, vol = 0.3, when = 0, sweepTo = null }) {
    if (!this.started) return;
    const now = this.ctx.currentTime + when;
    const src = this._noiseSource();
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(freq, now);
    if (sweepTo) filt.frequency.exponentialRampToValueAtTime(sweepTo, now + dur);
    filt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filt).connect(g).connect(this.sfxBus);
    src.start(now); src.stop(now + dur + 0.05);
  }

  uiClick() { this._blip({ freq: 660, end: 440, dur: 0.08, vol: 0.12 }); }
  uiBack() { this._blip({ freq: 330, end: 220, dur: 0.1, vol: 0.1 }); }
  interact() { this._blip({ freq: 520, end: 780, dur: 0.12, type: 'triangle', vol: 0.18 }); this._blip({ freq: 780, end: 1040, dur: 0.1, type: 'triangle', vol: 0.12, when: 0.08 }); }
  pickup() { [523, 659, 784, 1047].forEach((f, i) => this._blip({ freq: f, end: f, dur: 0.14, type: 'triangle', vol: 0.16, when: i * 0.09 })); }
  door() { this._noiseBurst({ dur: 0.7, freq: 120, q: 2, vol: 0.25, sweepTo: 60 }); this._blip({ freq: 90, end: 60, dur: 0.6, type: 'sine', vol: 0.2 }); }
  shoot() { this._blip({ freq: 880, end: 120, dur: 0.12, type: 'sawtooth', vol: 0.14 }); this._noiseBurst({ dur: 0.08, freq: 2400, q: 3, vol: 0.1 }); }
  hit() { this._noiseBurst({ dur: 0.12, freq: 1800, q: 2, vol: 0.22, sweepTo: 500 }); }
  enemyShoot() { this._blip({ freq: 320, end: 90, dur: 0.18, type: 'square', vol: 0.1 }); }
  explosion() { this._noiseBurst({ dur: 0.6, freq: 400, q: 0.8, vol: 0.45, sweepTo: 80 }); this._blip({ freq: 120, end: 30, dur: 0.5, type: 'sine', vol: 0.35 }); }
  playerHurt() { this._blip({ freq: 200, end: 70, dur: 0.25, type: 'square', vol: 0.2 }); this._noiseBurst({ dur: 0.2, freq: 600, q: 1, vol: 0.2 }); }
  alert() { this._blip({ freq: 990, end: 990, dur: 0.14, type: 'square', vol: 0.14 }); this._blip({ freq: 740, end: 740, dur: 0.14, type: 'square', vol: 0.14, when: 0.18 }); }
  alarm() { for (let i = 0; i < 4; i++) { this._blip({ freq: 620, end: 620, dur: 0.22, type: 'square', vol: 0.12, when: i * 0.32 }); } }
  victory() { [392, 494, 587, 784].forEach((f, i) => this._blip({ freq: f, end: f, dur: 0.5, type: 'triangle', vol: 0.2, when: i * 0.22 })); }
  defeat() { [330, 262, 220, 165].forEach((f, i) => this._blip({ freq: f, end: f * 0.95, dur: 0.6, type: 'sawtooth', vol: 0.15, when: i * 0.3 })); }

  footstep(now, running) {
    const interval = running ? 0.28 : 0.42;
    if (now - this._lastFootstep < interval) return;
    this._lastFootstep = now;
    this._noiseBurst({ dur: 0.07, freq: 300 + Math.random() * 150, q: 1.5, vol: running ? 0.1 : 0.06 });
  }

  heartbeat(now) {
    if (now - this._lastHeartbeat < 1.0) return;
    this._lastHeartbeat = now;
    this._blip({ freq: 60, end: 40, dur: 0.18, type: 'sine', vol: 0.3 });
    this._blip({ freq: 55, end: 38, dur: 0.15, type: 'sine', vol: 0.22, when: 0.22 });
  }

  dispose() {
    if (this._musicTimer) clearTimeout(this._musicTimer);
    if (this.ctx) this.ctx.close();
    this.started = false;
  }
}
