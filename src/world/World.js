// 世界总装 — 汇集三个区域、光照、雾、星空与动态元素。
// 布局（+Y 上，玩家朝 -Z 前进）：
//   区域A 着陆平台   z: +10 ~ -44   开阔，教学与起点
//   区域B 研究舱段   z: -44 ~ -108  室内走廊 + 温室/实验室/储藏室
//   区域C 反应堆大厅 z: -108 ~ -176  大穹顶空间，信标与最终撤离战
import * as THREE from 'three';
import { CollisionWorld } from '../core/Collision.js';
import { buildZoneA } from './ZoneA_Platform.js';
import { buildZoneB } from './ZoneB_Labs.js';
import { buildZoneC } from './ZoneC_Reactor.js';
import { createDustMotes } from './Effects.js';

export function createWorld(scene, materials, quality) {
  const world = {
    collision: new CollisionWorld(),
    interactables: [],   // { id, type, position, radius, label, hint, mesh?, active, onInteract(game) }
    doors: [],           // { group, open, t, baseY, update(dt) }
    spawnPoints: { player: new THREE.Vector3(0, 0, -6) },
    enemySpawns: [],     // { pos, patrol: [Vector3...] }
    updateFns: [],       // (dt, t) 动态元素
    lampLights: [],      // 可闪烁的灯
  };

  // ===== 全局氛围 =====
  scene.background = new THREE.Color(0x050a12);
  scene.fog = new THREE.FogExp2(0x0a1420, 0.016);

  // ===== 星空 =====
  const starGeo = new THREE.BufferGeometry();
  const starCount = 1400;
  const sp = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const R = 400;
    sp[i * 3] = R * Math.sin(phi) * Math.cos(theta);
    sp[i * 3 + 1] = Math.abs(R * Math.cos(phi)) * 0.9 + 10;
    sp[i * 3 + 2] = R * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbfd8ff, size: 1.4, sizeAttenuation: false, fog: false }));
  scene.add(stars);

  // 远景行星 — 大气感地标
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(120, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x1a2f4a, fog: false })
  );
  planet.position.set(-260, 90, -420);
  scene.add(planet);
  const planetGlow = new THREE.Mesh(
    new THREE.SphereGeometry(126, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x3d6a8f, transparent: true, opacity: 0.18, fog: false, side: THREE.BackSide })
  );
  planetGlow.position.copy(planet.position);
  scene.add(planetGlow);

  // ===== 光照体系 =====
  // 冷蓝半球底光 + 低角度月光主光 + 各区域点光（在各 zone 内加）
  const hemi = new THREE.HemisphereLight(0x3a5a7a, 0x0c1016, 0.55);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0x9fbfff, 1.0);
  moon.position.set(40, 60, 30);
  moon.castShadow = quality === 'high';
  if (quality === 'high') {
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -90;
    moon.shadow.camera.right = 90;
    moon.shadow.camera.top = 60;
    moon.shadow.camera.bottom = -80;
    moon.shadow.camera.far = 220;
    moon.shadow.bias = -0.0004;
  }
  scene.add(moon);
  scene.add(moon.target);

  // ===== 区域构建 =====
  buildZoneA(scene, materials, world);
  buildZoneB(scene, materials, world);
  buildZoneC(scene, materials, world);

  // 尘埃（区域A 上空）
  const dust = createDustMotes(scene, 55, quality === 'low' ? 120 : 260);

  world.update = (dt, t, camera) => {
    for (const fn of world.updateFns) fn(dt, t);
    // 月光跟随玩家保持阴影覆盖
    if (camera) {
      moon.position.set(camera.position.x + 40, 60, camera.position.z + 30);
      moon.target.position.set(camera.position.x, 0, camera.position.z - 10);
    }
    // 尘埃跟随玩家附近缓慢漂移
    dust.position.y = Math.sin(t * 0.1) * 0.4;
  };

  return world;
}
