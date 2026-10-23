// 无人机敌人 — 状态机（PATROL/ALERT/ATTACK/DEAD）、悬浮动画、激光攻击、爆炸。
import * as THREE from 'three';

export const EnemyState = Object.freeze({
  PATROL: 'PATROL',
  ALERT: 'ALERT',
  ATTACK: 'ATTACK',
  DEAD: 'DEAD',
});

const SENSE_DIST = 24;
const ATTACK_DIST = 20;
const SPEED_PATROL = 2.2;
const SPEED_ATTACK = 5.6;

export class Enemy {
  constructor(scene, M, spawn, particles, audio) {
    this.scene = scene;
    this.particles = particles;
    this.audio = audio;
    this.patrol = spawn.patrol;
    this.waypoint = 0;
    this.state = EnemyState.PATROL;
    this.hp = 100;
    this.dead = false;
    this.fireCd = 1.0 + Math.random();
    this.hoverT = Math.random() * 10;
    this.alertT = 0;
    this.baseY = (spawn.highAlt || 0) + 2.1;
    this.pos = spawn.pos.clone();
    this.pos.y = this.baseY;
    this._build(M);
  }

  _build(M) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 10), M.enemy);
    body.castShadow = true;
    g.add(body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M.enemyEye);
    eye.position.set(0, 0, 0.44);
    g.add(eye);
    this.eye = eye;
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.16), M.enemy);
      arm.position.set(s * 0.62, 0, 0);
      g.add(arm);
      const rotor = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 6, 18), M.hullDark);
      rotor.rotation.x = Math.PI / 2;
      rotor.position.set(s * 0.95, 0.05, 0);
      g.add(rotor);
      (s < 0 ? (this.rotorL = rotor) : (this.rotorR = rotor));
    }
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), M.hullDark);
    antenna.position.y = 0.55;
    g.add(antenna);
    this.light = new THREE.PointLight(0xff4030, 0.9, 6, 2);
    g.add(this.light);
    this.group = g;
    this.scene.add(g);
    g.position.copy(this.pos); // 出生点（勿省略：Group 默认在原点，会全员叠到玩家出生处）
  }

  get center() {
    return this.group.position;
  }

  takeDamage(n, game) {
    if (this.dead) return;
    this.hp -= n;
    game.audio.hit();
    this.particles.emit({ position: this.center, count: 10, color: 0xffc040, speed: 4, life: 0.4, size: 4 });
    if (this.hp <= 0) {
      this.explode(game);
    } else if (this.state === EnemyState.PATROL) {
      this.state = EnemyState.ATTACK; // 被打痛了直接反击
    }
  }

  explode(game) {
    this.dead = true;
    this.state = EnemyState.DEAD;
    this.group.visible = false;
    this.light.intensity = 0;
    game.audio.explosion();
    game.particles.emit({ position: this.center, count: 46, color: 0xff8030, speed: 8, life: 0.9, size: 6, gravity: -6 });
    game.particles.emit({ position: this.center, count: 20, color: 0xffe0a0, speed: 12, life: 0.5, size: 4, gravity: -4 });
    game.missions.onEnemyKilled();
  }

  update(dt, game) {
    if (this.dead) return;
    this.hoverT += dt;
    const player = game.player;
    const toPlayer = new THREE.Vector3().subVectors(player.headWorldPos, this.center);
    const dist = toPlayer.length();
    const alive = !player.dead && game.stateMachine.is('PLAYING');

    // ---- 感知与状态转移 ----
    if (this.state === EnemyState.PATROL && alive) {
      if (dist < SENSE_DIST) {
        // 面向玩家才感知（身后安静接近可以潜行一小段）
        const facing = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
        const flat = toPlayer.clone().setY(0).normalize();
        if (facing.dot(flat) > -0.1 || dist < 6) {
          this.state = EnemyState.ALERT;
          this.alertT = 0;
          game.audio.alert();
        }
      }
    } else if (this.state === EnemyState.ALERT) {
      this.alertT += dt;
      if (dist < ATTACK_DIST && this.alertT > 0.5) this.state = EnemyState.ATTACK;
      else if (dist > SENSE_DIST + 8) this.state = EnemyState.PATROL;
    }

    // ---- 行为 ----
    const moveTarget = new THREE.Vector3();
    if (this.state === EnemyState.PATROL) {
      const wp = this.patrol[this.waypoint];
      moveTarget.copy(wp).setY(this.baseY);
      if (this.center.distanceTo(moveTarget) < 1.2) this.waypoint = (this.waypoint + 1) % this.patrol.length;
      this._moveTowards(moveTarget, SPEED_PATROL, dt);
      this.light.color.set(0xff4030);
      this.light.intensity = 0.7;
    } else if (this.state === EnemyState.ALERT) {
      // 悬停观察，缓慢逼近
      moveTarget.copy(player.pos).setY(this.baseY);
      this._moveTowards(moveTarget, 1.4, dt);
      this.light.intensity = 1.2;
    } else if (this.state === EnemyState.ATTACK && alive) {
      // 保持距离环绕 + 开火
      const desired = 9 + Math.sin(this.hoverT * 0.7) * 3;
      const dir = toPlayer.clone().setY(0).normalize();
      if (dist > desired + 2) moveTarget.copy(player.pos).addScaledVector(dir, -desired).setY(this.baseY);
      else if (dist < desired - 2) moveTarget.copy(this.center).addScaledVector(dir, 4).setY(this.baseY);
      else {
        // 环绕
        const tangent = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(Math.sin(this.hoverT * 0.5) > 0 ? 1 : -1);
        moveTarget.copy(this.center).addScaledVector(tangent, 6).setY(this.baseY);
      }
      this._moveTowards(moveTarget, SPEED_ATTACK, dt);
      this.light.intensity = 1.8;

      this.fireCd -= dt;
      if (this.fireCd <= 0 && dist < ATTACK_DIST) {
        this.fireCd = 1.3 + Math.random() * 0.6;
        game.audio.enemyShoot();
        game.projectiles.spawnEnemyBolt(this.center.clone(), player.headWorldPos);
        this.particles.emit({ position: this.eye.getWorldPosition(new THREE.Vector3()), count: 4, color: 0xff3020, speed: 2, life: 0.2, size: 3 });
      }
    }

    // ---- 视觉 ----
    // 平滑朝向移动方向/玩家
    const lookAt = this.state === EnemyState.PATROL ? moveTarget : player.headWorldPos;
    const wantYaw = Math.atan2(lookAt.x - this.center.x, lookAt.z - this.center.z);
    let d = wantYaw - this.group.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.group.rotation.y += d * Math.min(1, dt * 5);
    this.rotorL.rotation.z += dt * 30;
    this.rotorR.rotation.z -= dt * 30;
    const bob = Math.sin(this.hoverT * 2.2) * 0.18;
    this.group.position.y = this.baseY + bob;
    this.eye.material.emissiveIntensity = this.state === EnemyState.ATTACK ? 3.4 + Math.sin(this.hoverT * 10) * 0.8 : 2.6;
  }

  _moveTowards(target, speed, dt) {
    const dir = new THREE.Vector3().subVectors(target, this.center);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) return;
    dir.normalize();
    const step = speed * dt;
    this.center.addScaledVector(dir, step);
    // 简易避墙：撞墙时沿切向滑动
    const probe = this.center.clone().addScaledVector(dir, 0.7);
    if (this.worldCheck && this.worldCheck(probe)) {
      this.center.addScaledVector(new THREE.Vector3(-dir.z, 0, dir.x), step);
    }
  }

  setWorldCheck(fn) { this.worldCheck = fn; }
}

export class EnemyManager {
  constructor(scene, materials, world, particles, audio) {
    this.scene = scene;
    this.materials = materials;
    this.world = world;
    this.particles = particles;
    this.audio = audio;
    this.list = [];
    this.evacMode = false;
    this.waveTimer = 0;
    this.spawnBudget = 999;
    this.killsTotal = 0;
  }

  spawnInitial() {
    for (const s of this.world.enemySpawns) this._spawn(s);
  }

  _spawn(spawn) {
    const e = new Enemy(this.scene, this.materials, spawn, this.particles, this.audio);
    e.setWorldCheck((p) => this.world.collision.containsPoint(new THREE.Vector3(p.x, 1.2, p.z)));
    this.list.push(e);
    return e;
  }

  startEvacAssault() {
    this.evacMode = true;
    this.waveTimer = 0;
    // 已有机全部转为攻击
    for (const e of this.list) { if (!e.dead) e.state = 'ATTACK'; }
  }

  update(dt, game) {
    for (const e of this.list) e.update(dt, game);

    if (this.evacMode && game.stateMachine.is('PLAYING')) {
      this.waveTimer -= dt;
      const aliveCount = this.list.filter((e) => !e.dead).length;
      if (this.waveTimer <= 0 && aliveCount < 7) {
        this.waveTimer = 7;
        const pts = this.world.evacSpawnPoints;
        // 交替在玩家远处生成
        for (let i = 0; i < 2; i++) {
          const p = pts[Math.floor(Math.random() * pts.length)].clone();
          p.y = 2.1;
          const e = this._spawn({ pos: p, patrol: [p.clone(), p.clone().add(new THREE.Vector3(2, 0, 2))] });
          e.state = 'ATTACK';
          this.particles.emit({ position: p, count: 20, color: 0xff3020, speed: 4, life: 0.6, size: 4 });
        }
      }
    }
  }

  clear() {
    for (const e of this.list) this.scene.remove(e.group);
    this.list.length = 0;
    this.evacMode = false;
    this.killsTotal = 0;
  }
}
