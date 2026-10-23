// UI 管理器 — 所有 DOM 界面：标题/暂停/设置/HUD/数据板/结算/Toast。
// 风格：深色玻璃 + 青橙双色 + 切角面板 + 扫描线。
export class UIManager {
  constructor(uiRoot, audio, save) {
    this.root = uiRoot;
    this.audio = audio;
    this.save = save;
    this._toastCount = 0;
    this.root.innerHTML = TEMPLATE;
    this._cache = {};
    for (const id of ['hud', 'hp-fill', 'hp-text', 'en-fill', 'obj-text', 'obj-detail', 'obj-progress', 'core-count',
      'evac-timer', 'interact-hint', 'toasts', 'damage-vignette', 'title-screen', 'pause-screen', 'end-screen',
      'settings-modal', 'datalog-modal', 'datalog-title', 'datalog-body', 'end-title', 'end-subtitle', 'end-stats',
      'best-record', 'hitmarker', 'lowhp-vignette']) {
      this._cache[id] = this.root.querySelector(`#${id}`);
    }
    this._wireButtons();
    this._initSettings();
  }

  el(id) { return this._cache[id]; }

  show(id) { this.el(id).classList.remove('hidden'); }
  hide(id) { this.el(id).classList.add('hidden'); }

  // ---------- 按钮 ----------
  _wireButtons() {
    const bind = (id, fn) => this.root.querySelector(`#${id}`)?.addEventListener('click', () => { this.audio.uiClick(); fn(); });
    this.onClick = {}; // Game 层注入
    bind('btn-start', () => this.onClick.start?.());
    bind('btn-resume', () => this.onClick.resume?.());
    bind('btn-restart', () => this.onClick.restart?.());
    bind('btn-restart-end', () => this.onClick.restart?.());
    bind('btn-title-from-pause', () => this.onClick.toTitle?.());
    bind('btn-title-from-end', () => this.onClick.toTitle?.());
    bind('btn-settings-title', () => this.openSettings());
    bind('btn-settings-pause', () => this.openSettings());
    bind('btn-howto', () => this.toggleHowto());
    bind('btn-close-settings', () => this.closeSettings());
    bind('btn-close-datalog', () => this.closeDatalog());
    // 设置控件
    const s = this.save.settings;
    const wireSlider = (id, key, apply) => {
      const input = this.root.querySelector(`#${id}`);
      input.value = s[key];
      input.addEventListener('input', () => {
        s[key] = parseFloat(input.value);
        this.save.updateSettings({ [key]: s[key] });
        apply?.();
      });
    };
    wireSlider('set-master', 'master', () => this.audio.applySettings());
    wireSlider('set-music', 'music', () => this.audio.applySettings());
    wireSlider('set-sfx', 'sfx', () => this.audio.applySettings());
    wireSlider('set-sens', 'sensitivity');
    const qualitySel = this.root.querySelector('#set-quality');
    qualitySel.value = s.quality;
    qualitySel.addEventListener('change', () => {
      this.save.updateSettings({ quality: qualitySel.value });
      this.onClick.applyQuality?.();
    });
    const bloomChk = this.root.querySelector('#set-bloom');
    bloomChk.checked = s.bloom;
    bloomChk.addEventListener('change', () => {
      this.save.updateSettings({ bloom: bloomChk.checked });
      this.onClick.applyQuality?.();
    });
  }

  _initSettings() {
    const best = this.save.data.bestRun;
    if (best) {
      this.el('best-record').textContent = `最佳纪录 ${fmtTime(best.timeSec)} · 评级 ${best.rank} · 击杀 ${best.kills} · 数据板 ${best.dataLogs}/5`;
    } else {
      this.el('best-record').textContent = '暂无通关纪录 — 成为第一个活着回来的人';
    }
  }

  // ---------- 状态切换 ----------
  showTitle() {
    this.hide('hud'); this.hide('pause-screen'); this.hide('end-screen');
    this.show('title-screen');
    this._initSettings();
  }
  startRun() {
    this.hide('title-screen'); this.hide('end-screen'); this.hide('pause-screen');
    this.show('hud');
    this.hide('evac-timer'); this.hide('interact-hint'); this.hide('datalog-modal');
    this.el('toasts').innerHTML = '';
  }
  showPause() { this.show('pause-screen'); }
  hidePause() { this.hide('pause-screen'); }

  toggleHowto() {
    const panel = this.root.querySelector('#howto-panel');
    panel.classList.toggle('hidden');
  }

  openSettings() { this.show('settings-modal'); }
  closeSettings() { this.hide('settings-modal'); }

  // ---------- HUD ----------
  updateVitals(hp, maxHp, en, maxEn) {
    this.el('hp-fill').style.width = `${(hp / maxHp) * 100}%`;
    this.el('hp-text').textContent = `${Math.ceil(hp)}`;
    this.el('en-fill').style.width = `${(en / maxEn) * 100}%`;
    this.el('lowhp-vignette').style.opacity = hp < 30 ? '1' : '0';
  }

  updateObjective(obj, state) {
    this.el('obj-text').textContent = obj.text;
    this.el('obj-detail').textContent = obj.detail || '';
    this.el('obj-text').classList.toggle('urgent', !!obj.urgent);
    this.el('core-count').textContent = `核心 ${state.cores}/3　数据板 ${state.datalogsRead}/5`;
    if (obj.progress != null) {
      this.el('obj-progress').style.width = `${obj.progress * 100}%`;
      this.el('obj-progress').parentElement.classList.remove('hidden');
    } else {
      this.el('obj-progress').parentElement.classList.add('hidden');
    }
  }

  updateEvacTimer(t) {
    this.show('evac-timer');
    this.el('evac-timer').textContent = `${Math.ceil(t)}`;
    this.el('evac-timer').classList.toggle('danger', t < 20);
  }

  showInteractHint(label, hint) {
    this.el('interact-hint').innerHTML = `<span class="key">E</span>${hint} <span class="dim">· ${label}</span>`;
    this.show('interact-hint');
  }
  hideInteractHint() { this.hide('interact-hint'); }

  hitmarker() {
    const h = this.el('hitmarker');
    h.classList.remove('pop');
    void h.offsetWidth; // 重启动画
    h.classList.add('pop');
  }

  flashDamage() {
    const v = this.el('damage-vignette');
    v.classList.remove('flash');
    void v.offsetWidth;
    v.classList.add('flash');
  }

  toast(text, kind = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = text;
    this.el('toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3200);
  }

  showDatalog(title, body) {
    this.el('datalog-title').textContent = title;
    this.el('datalog-body').textContent = body;
    this.show('datalog-modal');
  }
  closeDatalog() { this.hide('datalog-modal'); }

  showVictory(stats, isBest) {
    this.el('end-title').textContent = '撤离成功';
    this.el('end-title').className = 'end-title good';
    this.el('end-subtitle').textContent = '跳跃窗口已捕获。烛龙站在身后熄灭，而你还活着。';
    this._fillStats(stats, isBest);
    this.show('end-screen');
  }

  showDefeat(reason) {
    this.el('end-title').textContent = '信号丢失';
    this.el('end-title').className = 'end-title bad';
    this.el('end-subtitle').textContent = reason || '打捞员的信标熄灭了。烛龙站又归于寂静。';
    this._fillStats(null);
    this.show('end-screen');
  }

  _fillStats(stats, isBest) {
    if (!stats) {
      this.el('end-stats').innerHTML = '';
      return;
    }
    this.el('end-stats').innerHTML = `
      <div class="stat"><span class="k">通关用时</span><span class="v">${fmtTime(stats.timeSec)}</span></div>
      <div class="stat"><span class="k">击毁无人机</span><span class="v">${stats.kills}</span></div>
      <div class="stat"><span class="k">数据板</span><span class="v">${stats.dataLogs}/5</span></div>
      <div class="stat rank"><span class="k">评级</span><span class="v big">${stats.rank}</span></div>
      ${isBest ? '<div class="newbest">★ 新纪录</div>' : ''}`;
  }
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const TEMPLATE = `
<div id="title-screen" class="screen">
  <div class="title-inner">
    <div class="logo-sub">烛龙站打捞行动</div>
    <h1 class="logo">残响<span class="logo-en">AFTERGLOW</span></h1>
    <div class="logo-tag">回收三枚相位核心 · 重启信标 · 在安保网苏醒之前离开</div>
    <div class="menu">
      <button id="btn-start" class="ag-btn primary">开始行动</button>
      <button id="btn-howto" class="ag-btn">操作说明</button>
      <button id="btn-settings-title" class="ag-btn">设置</button>
    </div>
    <div id="howto-panel" class="hidden panel">
      <div class="howto-grid">
        <span class="key">W A S D</span><span>移动</span>
        <span class="key">Shift</span><span>冲刺（消耗能量）</span>
        <span class="key">空格</span><span>跳跃</span>
        <span class="key">E</span><span>交互 / 拾取 / 读取</span>
        <span class="key">鼠标左键</span><span>脉冲手枪</span>
        <span class="key">Esc</span><span>暂停</span>
      </div>
    </div>
    <div id="best-record" class="best-record"></div>
  </div>
</div>

<div id="hud" class="screen hidden">
  <div id="crosshair"><i></i></div>
  <div id="hitmarker"></div>
  <div id="vitals">
    <div class="bar hp"><div id="hp-fill" class="fill"></div><span id="hp-text" class="bar-text">100</span></div>
    <div class="bar en"><div id="en-fill" class="fill"></div></div>
  </div>
  <div id="objective-panel" class="panel cut">
    <div class="obj-head">当前目标</div>
    <div id="obj-text">进入烛龙站研究舱段</div>
    <div id="obj-detail"></div>
    <div class="obj-progress-wrap hidden"><div id="obj-progress"></div></div>
    <div id="core-count"></div>
  </div>
  <div id="evac-timer" class="hidden">90</div>
  <div id="interact-hint" class="hidden"></div>
  <div id="toasts"></div>
  <div id="damage-vignette"></div>
  <div id="lowhp-vignette"></div>
</div>

<div id="pause-screen" class="screen hidden">
  <div class="overlay-panel">
    <h2>行动暂停</h2>
    <div class="menu">
      <button id="btn-resume" class="ag-btn primary">继续</button>
      <button id="btn-settings-pause" class="ag-btn">设置</button>
      <button id="btn-restart" class="ag-btn">重新开始</button>
      <button id="btn-title-from-pause" class="ag-btn">返回标题</button>
    </div>
  </div>
</div>

<div id="end-screen" class="screen hidden">
  <div class="overlay-panel">
    <h2 id="end-title" class="end-title">撤离成功</h2>
    <p id="end-subtitle" class="end-subtitle"></p>
    <div id="end-stats"></div>
    <div class="menu">
      <button id="btn-restart-end" class="ag-btn primary">再次出击</button>
      <button id="btn-title-from-end" class="ag-btn">返回标题</button>
    </div>
  </div>
</div>

<div id="datalog-modal" class="modal hidden">
  <div class="modal-box panel cut">
    <div class="modal-head">数据板</div>
    <div id="datalog-title" class="datalog-title"></div>
    <div id="datalog-body" class="datalog-body"></div>
    <button id="btn-close-datalog" class="ag-btn primary">关闭 [E]</button>
  </div>
</div>

<div id="settings-modal" class="modal hidden">
  <div class="modal-box panel cut">
    <div class="modal-head">设置</div>
    <div class="settings-grid">
      <label>主音量</label><input id="set-master" type="range" min="0" max="1" step="0.05">
      <label>音乐音量</label><input id="set-music" type="range" min="0" max="1" step="0.05">
      <label>音效音量</label><input id="set-sfx" type="range" min="0" max="1" step="0.05">
      <label>鼠标灵敏度</label><input id="set-sens" type="range" min="0.3" max="2.5" step="0.1">
      <label>画质</label>
        <select id="set-quality">
          <option value="high">高（阴影 + 全特效）</option>
          <option value="medium">中（阴影低配）</option>
          <option value="low">低（无阴影）</option>
        </select>
      <label>辉光 (Bloom)</label><input id="set-bloom" type="checkbox" class="chk">
    </div>
    <button id="btn-close-settings" class="ag-btn primary">关闭</button>
  </div>
</div>
`;
