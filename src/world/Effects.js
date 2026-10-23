// 粒子特效系统 — 一个 Points 池统一管理所有短命粒子（火花/爆炸/拾取/环境尘），
// 避免每帧分配几何体。每粒子属性：位置、速度、寿命、颜色、大小。
import * as THREE from 'three';

const MAX_PARTICLES = 1500;

export class ParticleSystem {
  constructor(scene) {
    this.pool = [];
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);
    this.alive = 0; // 前 alive 个槽位活跃（swap-back 回收）

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    geo.setDrawRange(0, 0);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {},
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (140.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.05, d);
          gl_FragColor = vec4(vColor, a);
        }`,
      vertexColors: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this._grav = new THREE.Vector3();
  }

  emit({ position, count = 12, color = 0xffaa44, speed = 4, life = 0.6, size = 5, spread = 1, gravity = -3, up = 0 }) {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      if (this.alive >= MAX_PARTICLES) return;
      const i = this.alive++;
      this.positions[i * 3] = position.x + (Math.random() - 0.5) * 0.2;
      this.positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.2;
      this.positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * spread;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.pool[i] = {
        vx: Math.cos(theta) * Math.cos(phi) * v,
        vy: Math.sin(phi) * v + up,
        vz: Math.sin(theta) * Math.cos(phi) * v,
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
        gravity,
        size: size * (0.6 + Math.random() * 0.8),
        r: c.r, g: c.g, b: c.b,
      };
      this.colors[i * 3] = c.r; this.colors[i * 3 + 1] = c.g; this.colors[i * 3 + 2] = c.b;
      this.sizes[i] = this.pool[i].size;
    }
  }

  update(dt) {
    for (let i = 0; i < this.alive; i++) {
      const p = this.pool[i];
      p.life -= dt;
      if (p.life <= 0) {
        // swap-back 回收
        const last = --this.alive;
        if (i !== last) {
          this.pool[i] = this.pool[last];
          this.positions[i * 3] = this.positions[last * 3];
          this.positions[i * 3 + 1] = this.positions[last * 3 + 1];
          this.positions[i * 3 + 2] = this.positions[last * 3 + 2];
          const q = this.pool[i];
          this.colors[i * 3] = q.r; this.colors[i * 3 + 1] = q.g; this.colors[i * 3 + 2] = q.b;
          this.sizes[i] = q.size;
        }
        i--;
        continue;
      }
      p.vy += p.gravity * dt;
      this.positions[i * 3] += p.vx * dt;
      this.positions[i * 3 + 1] += p.vy * dt;
      this.positions[i * 3 + 2] += p.vz * dt;
      if (this.positions[i * 3 + 1] < 0.03) { // 地面反弹衰减
        this.positions[i * 3 + 1] = 0.03;
        p.vy *= -0.3;
        p.vx *= 0.7; p.vz *= 0.7;
      }
      // 淡出
      this.sizes[i] = p.size * Math.min(1, p.life / p.maxLife * 1.5);
    }
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
    geo.setDrawRange(0, this.alive);
  }
}

// 环境漂浮尘埃 — 独立的静态点云，玩家周围缓慢漂移
export function createDustMotes(scene, radius = 60, count = 260) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * radius * 2;
    pos[i * 3 + 1] = Math.random() * 14 + 0.5;
    pos[i * 3 + 2] = (Math.random() - 0.5) * radius * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x9fc8d8, size: 0.06, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
}
