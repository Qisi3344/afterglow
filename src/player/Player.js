// 玩家 — 打捞员角色：程序化模型、移动物理（走/跑/跳）、生命与能量、手脚摆动动画。
import * as THREE from 'three';

const WALK_SPEED = 5.2;
const RUN_SPEED = 8.6;
const ACCEL = 22;
const JUMP_V = 8.4;
const GRAVITY = 22;
const RADIUS = 0.45;
const HEIGHT = 1.8;

export class Player {
  constructor(scene, M, world, audio, particles, ui) {
    this.scene = scene;
    this.world = world;
    this.audio = audio;
    this.particles = particles;
    this.ui = ui;
    this.pos = world.spawnPoints.player.clone();
    this.vel = new THREE.Vector3();
    this.onGround = true;
    this.hp = 100;
    this.maxHp = 100;
    this.energy = 100;
    this.maxEnergy = 100;
    this.invulnT = 0;
    this.facing = 0;         // 模型朝向（弧度）
    this.moveAmt = 0;        // 0~1 移动强度（动画混合）
    this.running = false;
    this.dead = false;
    this.muzzle = new THREE.Object3D(); // 武器口（世界坐标由此计算）
    this._t = 0;
    this._buildModel(M);
  }

  _buildModel(M) {
    const g = new THREE.Group();
    // 躯干
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.34), M.hull);
    torso.position.y = 1.12;
    torso.castShadow = true;
    g.add(torso);
    // 胸口指示灯
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), M.glowCyan);
    chest.position.set(0.12, 1.2, 0.18);
    g.add(chest);
    // 背包
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.44, 0.22), M.hullDark);
    pack.position.set(0, 1.18, -0.26);
    pack.castShadow = true;
    g.add(pack);
    const packGlow = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.03), M.glowOrange);
    packGlow.position.set(0, 1.3, -0.38);
    g.add(packGlow);
    // 头盔
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), M.hullDark);
    helmet.position.y = 1.62;
    helmet.castShadow = true;
    g.add(helmet);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.225, 14, 10, -0.9, 1.8, 0.9, 1.1), M.glowCyan);
    visor.position.y = 1.62;
    g.add(visor);
    // 四肢（肩/髋 pivot）
    const limb = (w, h) => {
      const pivot = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), M.hull);
      mesh.position.y = -h / 2;
      mesh.castShadow = true;
      pivot.add(mesh);
      return pivot;
    };
    this.armL = limb(0.16, 0.62); this.armL.position.set(-0.36, 1.38, 0);
    this.armR = limb(0.16, 0.62); this.armR.position.set(0.36, 1.38, 0);
    this.legL = limb(0.2, 0.78); this.legL.position.set(-0.15, 0.82, 0);
    this.legR = limb(0.2, 0.78); this.legR.position.set(0.15, 0.82, 0);
    g.add(this.armL, this.armR, this.legL, this.legR);
    // 右手武器
    const gun = new THREE.Group();
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.5), M.hullDark);
    gunBody.castShadow = true;
    gun.add(gunBody);
    const gunTip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.16, 8), M.glowCyan);
    gunTip.rotation.x = Math.PI / 2;
    gunTip.position.set(0, 0.02, 0.3);
    gun.add(gunTip);
    gun.position.set(0, -0.58, 0.18);
    this.armR.add(gun);
    this.muzzleRef = gunTip;
    // 腰部灯光（角色可读性）
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.36), M.glowOrange);
    belt.position.y = 0.84;
    g.add(belt);
    this.light = new THREE.PointLight(0xffb070, 1.6, 7, 1.8);
    this.light.position.set(0, 1.4, -0.5);
    g.add(this.light);

    this.model = g;
    this.head = helmet;
    this.scene.add(g);
  }

  get headWorldPos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.55, this.pos.z);
  }

  muzzleWorldPos() {
    const p = new THREE.Vector3();
    this.muzzleRef.getWorldPosition(p);
    return p;
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
    this.ui.updateVitals(this.hp, this.maxHp, this.energy, this.maxEnergy);
  }

  damage(n, fromPos) {
    if (this.invulnT > 0 || this.dead) return;
    this.hp -= n;
    this.invulnT = 0.6;
    this.audio.playerHurt();
    this.ui.flashDamage();
    if (fromPos) {
      this.particles.emit({ position: this.headWorldPos, count: 10, color: 0xff5040, speed: 3, life: 0.5, size: 4 });
    }
    this.ui.updateVitals(this.hp, this.maxHp, this.energy, this.maxEnergy);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }

  update(dt, input, cameraRig, game) {
    if (this.dead) return;
    this._t += dt;
    this.invulnT = Math.max(0, this.invulnT - dt);

    // ---- 相机相对移动 ----
    const fwd = new THREE.Vector3(-Math.sin(cameraRig.yaw), 0, -Math.cos(cameraRig.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3();
    if (input.isDown('KeyW')) wish.add(fwd);
    if (input.isDown('KeyS')) wish.sub(fwd);
    if (input.isDown('KeyD')) wish.add(right);
    if (input.isDown('KeyA')) wish.sub(right);
    const moving = wish.lengthSq() > 0.0001;
    if (moving) wish.normalize();

    this.running = input.isDown('ShiftLeft') && moving && this.energy > 1;
    const speed = this.running ? RUN_SPEED : WALK_SPEED;
    if (this.running) this.energy = Math.max(0, this.energy - dt * 26);
    else this.energy = Math.min(this.maxEnergy, this.energy + dt * 14);

    const targetVX = wish.x * speed;
    const targetVZ = wish.z * speed;
    this.vel.x += (targetVX - this.vel.x) * Math.min(1, ACCEL * dt);
    this.vel.z += (targetVZ - this.vel.z) * Math.min(1, ACCEL * dt);

    // 跳跃与重力
    if (input.justPressedCode('Space') && this.onGround) {
      this.vel.y = JUMP_V;
      this.onGround = false;
    }
    this.vel.y -= GRAVITY * dt;

    // ---- 位移与碰撞 ----
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.world.collision.resolveCircle(this.pos, RADIUS, this.pos.y, this.pos.y + HEIGHT);
    this.pos.y += this.vel.y * dt;
    const ground = this.world.collision.supportHeight(this.pos.x, this.pos.z, RADIUS, this.pos.y);
    if (this.pos.y <= ground + 0.001 && this.vel.y <= 0) {
      this.pos.y = ground;
      this.vel.y = 0;
      this.onGround = true;
    } else if (this.pos.y > ground + 0.05) {
      this.onGround = false;
    }

    // ---- 动画 ----
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.moveAmt += ((moving ? 1 : 0) - this.moveAmt) * Math.min(1, dt * 8);
    if (moving) {
      const targetFacing = Math.atan2(this.vel.x, this.vel.z);
      let d = targetFacing - this.facing;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.facing += d * Math.min(1, dt * 12);
    }
    const swing = Math.sin(this._t * (this.running ? 13 : 9)) * this.moveAmt;
    this.armL.rotation.x = swing * 0.7;
    this.armR.rotation.x = -swing * 0.35; // 持枪手稳定
    this.legL.rotation.x = -swing * 0.85;
    this.legR.rotation.x = swing * 0.85;
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.facing;
    // 悬浮微动
    this.model.position.y = this.pos.y + (this.onGround ? Math.abs(Math.sin(this._t * (this.running ? 13 : 9))) * 0.04 * this.moveAmt : 0);

    // 脚步声
    if (this.onGround && this.moveAmt > 0.5) this.audio.footstep(this._t, this.running);

    // 低血量心跳
    if (this.hp < 30) this.audio.heartbeat(this._t);

    this.ui.updateVitals(this.hp, this.maxHp, this.energy, this.maxEnergy);
  }

  reset() {
    this.pos.copy(this.world.spawnPoints.player);
    this.vel.set(0, 0, 0);
    this.hp = this.maxHp;
    this.energy = this.maxEnergy;
    this.dead = false;
    this.invulnT = 0;
    this.model.visible = true;
    this.ui.updateVitals(this.hp, this.maxHp, this.energy, this.maxEnergy);
  }
}
