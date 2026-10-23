// Game — 主控类：渲染器、后处理、子系统装配、游戏循环与状态流转。
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GameState, StateMachine } from './StateMachine.js';
import { Input } from './Input.js';
import { createMaterials } from '../world/Materials.js';
import { createWorld } from '../world/World.js';
import { ParticleSystem } from '../world/Effects.js';
import { Player } from '../player/Player.js';
import { CameraRig } from '../player/CameraRig.js';
import { Projectiles } from '../gameplay/Projectiles.js';
import { EnemyManager } from '../gameplay/Enemy.js';
import { MissionSystem, Phase } from '../gameplay/Missions.js';
import { UIManager } from '../ui/UIManager.js';

export class Game {
  constructor({ canvas, uiRoot, audio, save }) {
    this.canvas = canvas;
    this.audio = audio;
    this.save = save;
    this.stateMachine = new StateMachine();

    // ---- 渲染器 ----
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ---- 场景 ----
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 3, 6);

    const materials = createMaterials();
    this.materials = materials;
    this.world = createWorld(this.scene, materials, save.settings.quality);
    this.particles = new ParticleSystem(this.scene);

    // ---- UI 与子系统 ----
    this.ui = new UIManager(uiRoot, audio, save);
    this.missions = new MissionSystem(this.ui, audio);
    this.input = new Input(canvas);
    this.cameraRig = new CameraRig(this.camera, this.world, this.input, save.settings);
    this.projectiles = new Projectiles(this.scene, this.particles, audio);
    this.enemies = new EnemyManager(this.scene, materials, this.world, this.particles, audio);
    this.player = new Player(this.scene, materials, this.world, audio, this.particles, this.ui);

    // ---- 后处理 ----
    this._setupComposer(save.settings.bloom);

    // ---- 武器状态 ----
    this.fireCd = 0;
    this.shake = 0;

    this._wireUI();
    this._wireStateMachine();
    this._wireInput();

    this.ui.showTitle();
    this.ui.updateVitals(100, 100, 100, 100);

    this._raf = this._loop.bind(this);
    this._clock = new THREE.Clock();
    this._running = true;
    this._lastFrameAt = performance.now();
    this._inFrame = false;
    requestAnimationFrame(this._raf);
    // 看门狗：嵌入式视图（IAB）可能节流 rAF；停摆时以 ~60fps 兜底驱动，
    // rAF 正常时 _lastFrameAt 持续刷新、此定时器空转，开销可忽略。
    this._watchdog = setInterval(() => {
      if (performance.now() - this._lastFrameAt > 50) this._raf();
    }, 17);
  }

  // 入口调用：渲染循环已在构造中启动；音频将在玩家首次点击"开始行动"时由浏览器手势解锁。
  start() {}

  _setupComposer(bloomOn) {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloomOn ? 0.55 : 0, 0.6, 0.82
    );
    this.composer.addPass(this.bloomPass);
    this.bloomOn = bloomOn;
  }

  applyQuality() {
    const q = this.save.settings.quality;
    this.renderer.shadowMap.enabled = q !== 'low';
    const moon = this.scene.children.find((c) => c.isDirectionalLight);
    if (moon) moon.castShadow = q === 'high';
    this.bloomPass.strength = this.save.settings.bloom ? 0.55 : 0;
    this.scene.traverse((o) => {
      if (o.isMesh && o.material) o.material.needsUpdate = true;
    });
  }

  // ---------- UI 绑定 ----------
  _wireUI() {
    this.ui.onClick = {
      start: () => this.startRun(),
      resume: () => this.resume(),
      restart: () => this.startRun(),
      toTitle: () => this.toTitle(),
      applyQuality: () => this.applyQuality(),
    };
  }

  // ---------- 状态机 ----------
  _wireStateMachine() {
    const sm = this.stateMachine;
    sm.on(GameState.PLAYING, () => {
      this.ui.startRun();
    });
    sm.on(GameState.PAUSED, () => {
      this.ui.showPause();
      this.input.exitPointerLock();
    });
    sm.on(GameState.VICTORY, () => {
      const stats = this.missions.getStats();
      const isBest = this.save.recordRun(stats);
      this.ui.showVictory(stats, isBest);
      this.audio.setTension(false);
      this.audio.victory();
      this.input.exitPointerLock();
      this.particles.emit({ position: new THREE.Vector3(10, 4, 4), count: 120, color: 0x39ffd0, speed: 8, life: 1.6, size: 6, up: 5 });
    });
    sm.on(GameState.DEFEAT, (prev) => {
      this.ui.showDefeat(this._defeatReason);
      this.audio.setTension(false);
      this.audio.defeat();
      this.input.exitPointerLock();
      this.player.model.visible = false;
      this.particles.emit({ position: this.player.headWorldPos, count: 60, color: 0xff5040, speed: 6, life: 1.2, size: 5, up: 3 });
    });
  }

  _wireInput() {
    // 点击画布：播放中锁定鼠标
    this.canvas.addEventListener('click', () => {
      if (this.stateMachine.is('PLAYING') && !this.input.pointerLocked) {
        this.input.requestPointerLock();
      }
    });
    // 浏览器 Esc 自动退锁 → 若在游玩则暂停
    document.addEventListener('pointerlockchange', () => {
      if (!this.input.pointerLocked && this.stateMachine.is('PLAYING')) {
        this.stateMachine.transition(GameState.PAUSED);
      }
    });
    window.addEventListener('resize', () => this._resize());
  }

  // 信标激活 — 最终阶段的总开关：警报、门全开、无人机波次、紧张音乐
  activateBeacon() {
    this.missions.onBeaconActivated();
    this.world.alarm = true;
    this.world.beaconLight.intensity = 4;
    for (const d of this.world.doors) d.open = true;
    for (const it of this.world.interactables) {
      if (it.type === 'door' && it._doorState) it._doorState.open = true;
    }
    this.enemies.startEvacAssault();
    this.audio.alarm();
    this.audio.setTension(true);
    this.ui.toast('信标已激活 — 安保网全面苏醒！90 秒内回到飞船！', 'warn');
    this.shake = 1;
  }

  startRun() {
    this.audio.ensureStarted();
    this.audio.resume();
    this.audio.setTension(false);
    // 重置全部运行时状态
    this.missions.reset();
    this.projectiles.clear();
    this.enemies.clear();
    this.enemies.spawnInitial();
    this.player.reset();
    this.player.model.visible = true;
    this.cameraRig.resetBehindPlayer();
    this.world.alarm = false;
    this.world.beaconLight.intensity = 0;
    // 门与交互物重置
    for (const d of this.world.doors) d.open = false;
    for (const it of this.world.interactables) {
      if (it.type === 'door') { it.active = true; if (it._doorState) it._doorState.open = false; }
      if (it.type === 'core') {
        it.active = true;
        if (it._group) { it._group.visible = true; if (it._light) it._light.intensity = 3.5; }
      }
      if (it.type === 'datalog') it.read = false;
      if (it.type === 'repair' && it.id === 'repair_station') it.active = true;
    }
    this._timePlayed = 0;
    this.stateMachine.transition(GameState.PLAYING);
    this.ui.toast('目标：回收三枚相位核心并重启撤离信标', 'info');
    setTimeout(() => { if (this.stateMachine.is('PLAYING')) this.ui.toast('点击画面锁定鼠标视角', 'info'); }, 1500);
  }

  resume() {
    // 玩家已死亡时不存在"继续"语义
    if (this.player.dead) return;
    this.stateMachine.transition(GameState.PLAYING);
    this.ui.hidePause();
    this.audio.resume();
    this.input.requestPointerLock();
  }

  toTitle() {
    this.stateMachine.transition(GameState.TITLE);
    this.ui.showTitle();
    this.audio.setTension(false);
    this.player.model.visible = true;
  }

  victory() {
    if (!this.stateMachine.is('PLAYING')) return;
    this.stateMachine.transition(GameState.VICTORY);
  }

  defeat(reason) {
    if (!this.stateMachine.is('PLAYING')) return;
    this._defeatReason = reason;
    this.stateMachine.transition(GameState.DEFEAT);
  }

  // ---------- 交互检测 ----------
  _nearestInteractable() {
    let best = null;
    let bestD = Infinity;
    const pp = this.player.pos;
    for (const it of this.world.interactables) {
      if (it.active === false) continue;
      if (it.type === 'datalog' && !document.getElementById('datalog-modal').classList.contains('hidden')) continue;
      const d = it.position.distanceTo(new THREE.Vector3(pp.x, it.position.y, pp.z));
      if (d < it.radius && d < bestD) { best = it; bestD = d; }
    }
    return best;
  }

  _fireWeapon(dt) {
    this.fireCd -= dt;
    // 锁定模式按左键射击；未锁定（嵌入式视图）时按住左键同样可射击
    if (this.input.mouseDown && this.fireCd <= 0) {
      this.fireCd = 0.22;
      const origin = this.player.muzzleWorldPos();
      // 射向准星方向：从相机穿过屏幕中心
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      // 枪口对齐视线：从枪口沿视线方向前方的点
      const target = this.camera.position.clone().addScaledVector(dir, 30);
      const shootDir = target.sub(origin).normalize();
      this.projectiles.spawnPlayerBolt(origin, shootDir);
      this.audio.shoot();
      this.shake = Math.min(1, this.shake + 0.12);
      this.particles.emit({ position: origin, count: 5, color: 0x66ffe0, speed: 2, life: 0.15, size: 3 });
    }
  }

  _updateBeaconEvac(dt) {
    // 倒计时/用时统计统一由 MissionSystem.tick 负责
    if (this.missions.tick(dt) === 'fail_timeout') {
      this.defeat('屏蔽层失效。大厅在白光中坍缩——这次没有人收到求救信号。');
    }
  }

  // ---------- 主循环 ----------
  _loop() {
    if (!this._running || this._inFrame) return;
    this._inFrame = true;
    try {
      requestAnimationFrame(this._raf);
      this._lastFrameAt = performance.now();
      // 视口自愈：IAB/嵌入式视图初始 innerWidth 可能为 0，布局完成后自动恢复
      const vw = window.innerWidth, vh = window.innerHeight;
      if (vw > 0 && (this.canvas.width === 0 || this._lastW !== vw || this._lastH !== vh)) this._resize();
      const dt = Math.min(this._clock.getDelta(), 0.05);
      const t = this._clock.elapsedTime;
      const sm = this.stateMachine;

    // 世界动画常开（标题页也有活场景）
    this.world.update(dt, t, this.camera);
    this.particles.update(dt);
    // 灯光闪烁
    for (const lamp of this.world.lampLights) {
      const flicker = 0.92 + Math.sin(t * 13.7 + lamp.phase) * 0.05 + Math.sin(t * 31 + lamp.phase * 2) * 0.03;
      lamp.light.intensity = lamp.baseI * flicker;
      lamp.mat.emissiveIntensity = 2.0 * flicker;
    }
    if (this.world.alarm) {
      this.scene.fog.color.setHex(0x2a0e10);
      this.scene.fog.density = 0.02;
    } else {
      this.scene.fog.color.setHex(0x0a1420);
      this.scene.fog.density = 0.016;
    }

    if (sm.is(GameState.PLAYING)) {
      this.player.update(dt, this.input, this.cameraRig, this);
      this.cameraRig.update(dt, this.player);
      this.enemies.update(dt, this);
      this.projectiles.update(dt, this);
      this._fireWeapon(dt);
      this._updateBeaconEvac(dt);

      // 交互提示
      const near = this._nearestInteractable();
      if (near) this.ui.showInteractHint(near.label, near.hint);
      else this.ui.hideInteractHint();
      let interacted = false;
      if (near && this.input.justPressedCode('KeyE')) {
        near.onInteract(this);
        interacted = true;
      }
      // 数据板阅读时按 E 关闭（刚打开的不算）
      if (!interacted && this.input.justPressedCode('KeyE') && !this.elHidden('datalog-modal')) {
        this.ui.closeDatalog();
      }

      // 死亡判定
      if (this.player.dead) {
        this.defeat('装甲完全失效。安保网将你标记为"已清除目标"。');
      }
    } else if (sm.is(GameState.TITLE)) {
      // 标题页：相机绕出生点缓慢环绕
      const ang = t * 0.12;
      this.camera.position.set(Math.sin(ang) * 14, 6.5 + Math.sin(t * 0.3), -6 + Math.cos(ang) * 14);
      this.camera.lookAt(0, 2.2, -12);
      this.enemies.update(dt, this); // 让巡逻机在标题页活着
    } else if (sm.is(GameState.PAUSED, GameState.VICTORY, GameState.DEFEAT)) {
      // 冻结玩法，但保留相机与粒子
      if (sm.is(GameState.VICTORY, GameState.DEFEAT)) {
        this.cameraRig.update(dt * 0.4, this.player);
        this.projectiles.update(dt, this);
      }
    }

    // 相机震动
    if (this.shake > 0.001) {
      this.shake *= Math.pow(0.001, dt);
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.35;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.3;
      this.camera.position.z += (Math.random() - 0.5) * this.shake * 0.35;
    }

    this.input.endFrame();
    if (this.bloomOn) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    } finally {
      this._inFrame = false;
    }
  }

  elHidden(id) { return document.getElementById(id).classList.contains('hidden'); }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (w <= 0 || h <= 0) return;
    this._lastW = w;
    this._lastH = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  dispose() {
    this._running = false;
    if (this._watchdog) clearInterval(this._watchdog);
    this.input.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }
}
