// 弹道系统 — 池化管理玩家脉冲弹与敌方激光。
import * as THREE from 'three';

export class Projectiles {
  constructor(scene, particles, audio) {
    this.scene = scene;
    this.particles = particles;
    this.audio = audio;
    this.active = []; // { mesh, vel, life, from: 'player'|'enemy', damage }
    this._pool = [];
  }

  _makeMesh(from) {
    if (this._pool.length) {
      const m = this._pool.pop();
      m.visible = true;
      return m;
    }
    const geo = new THREE.SphereGeometry(0.09, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: from === 'player' ? 0x66ffe0 : 0xff4030 });
    const mesh = new THREE.Mesh(geo, mat);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({
      color: from === 'player' ? 0x2affd5 : 0xff2a20, transparent: true, opacity: 0.3,
    }));
    mesh.add(glow);
    this.scene.add(mesh);
    return mesh;
  }

  spawnPlayerBolt(pos, dir) {
    const mesh = this._makeMesh('player');
    mesh.material.color.set(0x66ffe0);
    mesh.position.copy(pos);
    this.active.push({
      mesh, vel: dir.clone().multiplyScalar(46), life: 1.4,
      from: 'player', damage: 34,
    });
  }

  spawnEnemyBolt(pos, targetPos, speed = 16) {
    const mesh = this._makeMesh('enemy');
    mesh.material.color.set(0xff4030);
    mesh.position.copy(pos);
    const dir = targetPos.clone().sub(pos).normalize();
    // 轻微散布，可躲避
    dir.x += (Math.random() - 0.5) * 0.06;
    dir.y += (Math.random() - 0.5) * 0.05;
    dir.z += (Math.random() - 0.5) * 0.06;
    this.active.push({
      mesh, vel: dir.normalize().multiplyScalar(speed), life: 2.2,
      from: 'enemy', damage: 12,
    });
  }

  update(dt, game) {
    const { player, enemies, world } = game;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const pos = p.mesh.position;
      let dead = p.life <= 0;

      if (!dead && world.collision.containsPoint(pos)) {
        dead = true;
        this.particles.emit({ position: pos, count: 6, color: p.from === 'player' ? 0x66ffe0 : 0xff5040, speed: 2.5, life: 0.3, size: 3 });
      }

      if (!dead && p.from === 'player') {
        for (const e of enemies.list) {
          if (e.dead) continue;
          if (pos.distanceToSquared(e.center) < 1.1) {
            e.takeDamage(p.damage, game);
            dead = true;
            break;
          }
        }
      } else if (!dead) {
        const dx = pos.x - player.pos.x;
        const dz = pos.z - player.pos.z;
        const dy = pos.y - (player.pos.y + 0.9);
        if (dx * dx + dz * dz + dy * dy < 0.55) {
          player.damage(p.damage, pos);
          dead = true;
        }
      }

      if (dead) {
        p.mesh.visible = false;
        this._pool.push(p.mesh);
        this.active.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.active) { p.mesh.visible = false; this._pool.push(p.mesh); }
    this.active.length = 0;
  }
}
