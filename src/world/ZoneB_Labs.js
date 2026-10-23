// 区域B — 研究舱段：门厅 + 主走廊 + 温室/实验室/储藏室三房间。
import * as THREE from 'three';
import { addBox, addCollider, addDatalog, makeCrate, makeCore, makeTerminal, wall } from './Kit.js';

const CORRIDOR_H = 4.6;

function ceilingLamp(scene, world, M, x, y, z, len = 3, color = 0xbfe8ff, intensity = 4, dist = 16) {
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.5), new THREE.MeshStandardMaterial({
    color: 0x0a0f14, emissive: color, emissiveIntensity: 2.0, roughness: 0.4,
  }));
  lamp.position.set(x, y, z);
  scene.add(lamp);
  if (intensity > 0) {
    const light = new THREE.PointLight(color, intensity, dist, 1.8);
    light.position.set(x, y - 0.4, z);
    scene.add(light);
    world.lampLights.push({ light, mat: lamp.material, baseI: intensity, phase: Math.random() * 10 });
  }
  return lamp;
}

// 可开启的室内滑门（两侧对开）
function slidingDoor(scene, world, M, id, x, z, axis, game, label, onOpen) {
  const g = new THREE.Group();
  const panelL = new THREE.Mesh(new THREE.BoxGeometry(axis === 'z' ? 2.4 : 0.3, 3.4, axis === 'z' ? 0.3 : 2.4), M.hullDark);
  const panelR = panelL.clone();
  const edgeL = new THREE.Mesh(new THREE.BoxGeometry(axis === 'z' ? 0.12 : 0.34, 2.6, axis === 'z' ? 0.34 : 0.12), M.glowCyan);
  const edgeR = edgeL.clone();
  panelL.castShadow = panelR.castShadow = true;
  g.add(panelL, panelR, edgeL, edgeR);
  g.position.set(x, 0, z);
  scene.add(g);

  const half = 1.25;
  const state = { open: false, t: 0 };
  const collider = axis === 'z'
    ? world.collision.addBox(new THREE.Box3(new THREE.Vector3(x - 2.5, 0, z - 0.2), new THREE.Vector3(x + 2.5, 3.4, z + 0.2)))
    : world.collision.addBox(new THREE.Box3(new THREE.Vector3(x - 0.2, 0, z - 2.5), new THREE.Vector3(x + 0.2, 3.4, z + 2.5)));

  world.updateFns.push((dt) => {
    const target = state.open ? 1 : 0;
    state.t += (target - state.t) * Math.min(1, dt * 3);
    const off = state.t * 2.3;
    if (axis === 'z') {
      panelL.position.x = -half - off; panelR.position.x = half + off;
      edgeL.position.set(-half - off + (off > 0.1 ? 0 : -1.2), 1.5, 0); edgeR.position.set(half + off - (off > 0.1 ? 0 : 1.2), 1.5, 0);
    } else {
      panelL.position.z = -half - off; panelR.position.z = half + off;
      edgeL.position.set(0, 1.5, -half - off); edgeR.position.set(0, 1.5, half + off);
    }
    panelL.position.y = panelR.position.y = 1.7;
    collider.max.x = axis === 'z' ? (state.t > 0.5 ? x - 2.5 : x + 2.5) : collider.max.x;
    collider.max.z = axis === 'x' ? (state.t > 0.5 ? z - 2.5 : z + 2.5) : collider.max.z;
    if (state.t > 0.5) { collider.max.x = Math.min(collider.max.x, axis === 'z' ? x - 2.5 : collider.max.x); collider.max.z = Math.min(collider.max.z, axis === 'x' ? z - 2.5 : collider.max.z); }
    else { collider.max.x = axis === 'z' ? x + 2.5 : collider.max.x; collider.max.z = axis === 'x' ? z + 2.5 : collider.max.z; }
  });

  world.interactables.push({
    id,
    type: 'door',
    position: new THREE.Vector3(x, 1.6, z),
    radius: 3.4,
    label,
    hint: '开启舱门',
    active: true,
    _doorState: state,
    onInteract(gm) {
      if (state.open) return;
      state.open = true;
      gm.audio.door();
      if (onOpen) onOpen(gm);
    },
  });
}

export function buildZoneB(scene, M, world) {
  // ===== 地板与地板 =====
  // 门厅 + 走廊 + 房间统一地壳
  const floor = new THREE.Mesh(new THREE.BoxGeometry(60, 0.6, 70), M.hullDark);
  floor.position.set(0, -0.3, -77); // x -30..30, z -112..-42
  floor.receiveShadow = true;
  scene.add(floor);

  const makeRoom = (x1, z1, x2, z2, h) => {
    wall(scene, world, M, x1, z1, x2, z1, h); // 北
    wall(scene, world, M, x1, z2, x2, z2, h); // 南
    wall(scene, world, M, x1, z1, x1, z2, h); // 西
    wall(scene, world, M, x2, z1, x2, z2, h); // 东
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, 0.4, z2 - z1), M.hullDark);
    ceil.position.set((x1 + x2) / 2, h + 0.2, (z1 + z2) / 2);
    scene.add(ceil);
  };

  // 门厅（承接区域A大门）
  makeRoom(-5.5, -50.5, 5.5, -43, CORRIDOR_H);
  ceilingLamp(scene, world, M, 0, CORRIDOR_H - 0.15, -46.5, 3);

  // 主走廊 x -3..3, z -108..-50
  wall(scene, world, M, -3, -50, -3, -62, CORRIDOR_H);
  wall(scene, world, M, -3, -66, -3, -86, CORRIDOR_H);
  wall(scene, world, M, -3, -90, -3, -108, CORRIDOR_H);
  wall(scene, world, M, 3, -50, 3, -57, CORRIDOR_H);
  wall(scene, world, M, 3, -61, 3, -88, CORRIDOR_H);
  wall(scene, world, M, 3, -92, 3, -108, CORRIDOR_H);
  const corrCeil = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 58), M.hullDark);
  corrCeil.position.set(0, CORRIDOR_H + 0.2, -79);
  scene.add(corrCeil);
  ceilingLamp(scene, world, M, 0, CORRIDOR_H - 0.15, -55);
  ceilingLamp(scene, world, M, 0, CORRIDOR_H - 0.15, -68);
  ceilingLamp(scene, world, M, 0, CORRIDOR_H - 0.15, -80);
  ceilingLamp(scene, world, M, 0, CORRIDOR_H - 0.15, -94);
  ceilingLamp(scene, world, M, 0, CORRIDOR_H - 0.15, -104);

  // 走廊地面导光条
  for (const z of [-55, -68, -80, -94, -104]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 8), M.glowCyan);
    strip.position.set(0, 0.02, z);
    scene.add(strip);
  }

  // ===== 温室（东，z -78..-52，x 3..27）=====
  makeRoom(3.5, -78.5, 26.5, -51.5, 5.2);
  const glassRoof = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 25), M.glass);
  glassRoof.position.set(15, 5.0, -65);
  scene.add(glassRoof);
  // 上面天花留玻璃观星
  ceilingLamp(scene, world, M, 15, 4.9, -65, 8, 0x9fe8c8, 3.5, 26);
  // 植物架
  for (const [px, pz] of [[8, -58], [8, -64], [8, -70], [14, -56], [14, -74], [20, -58], [20, -64], [20, -70]]) {
    const rack = new THREE.Group();
    for (let s = 0; s < 3; s++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.6), M.hullDark);
      shelf.position.y = 0.7 + s * 0.85;
      shelf.castShadow = true;
      rack.add(shelf);
      for (let p = 0; p < 4; p++) {
        const plant = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 6), M.plant);
        stem.position.y = 0.3;
        plant.add(stem);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), M.plantGlow);
        bulb.position.y = 0.6;
        plant.add(bulb);
        plant.position.set(-1.2 + p * 0.8, 0.06, 0);
        plant.userData.baseY = 0.7 + s * 0.85 + 0.06;
        rack.add(plant);
        world.updateFns.push((dt, t) => { bulb.material.emissiveIntensity = 1.1 + Math.sin(t * 2 + p * 1.3 + s) * 0.4; });
      }
    }
    rack.position.set(px, 0, pz);
    scene.add(rack);
    addCollider(world, px - 1.7, 0, pz - 0.9, px + 1.7, 2.6, pz + 0.9);
  }
  makeCore(scene, world, M, 'core_green', 15, 1.1, -65, '温室相位核心');
  addDatalog(scene, world, M, 24.5, -60, 'log_b1', '首席植物学家·录音', '第 214 天。作物还活着，靠备用电源撑着。可是安保网把温室划成了"污染区"——它们在焚毁一切之前，谁也进不来。如果有人读到这条：核心在中央培育台，别管这些植物了。它们不会怪你。');
  world.enemySpawns.push({
    pos: new THREE.Vector3(11, 0, -66),
    patrol: [
      new THREE.Vector3(8, 0, -58), new THREE.Vector3(22, 0, -58),
      new THREE.Vector3(22, 0, -72), new THREE.Vector3(8, 0, -72),
    ],
  });

  // 温室门（走廊东侧 x=3, z=-59）
  slidingDoor(scene, world, M, 'door_green', 3, -59, 'z', null, '温室舱门');

  // ===== 实验室（西，x -27..-3.5, z -78..-52）=====
  makeRoom(-26.5, -78.5, -3.5, -51.5, 5);
  ceilingLamp(scene, world, M, -15, 4.7, -65, 8, 0xbfd4ff, 3.2, 26);
  // 实验台阵列
  for (const [tx, tz] of [[-9, -58], [-9, -66], [-16, -58], [-16, -66], [-22, -62]]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.0, 2.2), M.hullDark);
    bench.position.set(tx, 0.5, tz);
    bench.castShadow = true;
    scene.add(bench);
    addCollider(world, tx - 2.3, 0, tz - 1.1, tx + 2.3, 1.0, tz + 1.1);
    // 台面上的观察罐
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 12), M.glass);
    jar.position.set(tx + 1, 1.4, tz);
    scene.add(jar);
    const spec = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), M.glowOrange);
    spec.position.set(tx + 1, 1.4, tz);
    scene.add(spec);
  }
  // 中央隔离柱与核心
  const isoRing = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 10, 32), M.glowCyan);
  isoRing.rotation.x = Math.PI / 2;
  isoRing.position.set(-15, 0.15, -65);
  scene.add(isoRing);
  world.updateFns.push((dt, t) => { isoRing.rotation.z = t * 0.5; });
  makeCore(scene, world, M, 'core_lab', -15, 1.15, -65, '实验室相位核心');
  addDatalog(scene, world, M, -24, -74, 'log_b2', '安保主管·最后指令', '命令已经没意义了。反应堆保护协议把三枚核心弹出主炉，安保网随之转入"敌对清除"模式。我把最后一架无人机的钥匙锁在储藏室。如果还有人活着：核心重启信标，别试图跟整个安保网打消耗战。跑。');
  world.enemySpawns.push({
    pos: new THREE.Vector3(-20, 0, -70),
    patrol: [
      new THREE.Vector3(-8, 0, -56), new THREE.Vector3(-24, 0, -56),
      new THREE.Vector3(-24, 0, -74), new THREE.Vector3(-8, 0, -74),
    ],
  });

  slidingDoor(scene, world, M, 'door_lab', -3, -59, 'z', null, '实验室舱门');

  // ===== 储藏室（东，x 3.5..21, z -104..-82）=====
  makeRoom(3.5, -104.5, 21.5, -81.5, 4.6);
  ceilingLamp(scene, world, M, 12.5, 4.3, -93, 6, 0xffd9a0, 3, 22);
  makeCrate(scene, world, M, 6, -86, 0.2, 1.5);
  makeCrate(scene, world, M, 8, -87, -0.3, 1.2);
  makeCrate(scene, world, M, 6.5, -90, 0.1, 1.3);
  makeCrate(scene, world, M, 17, -98, 0.4, 1.6);
  makeCrate(scene, world, M, 19, -97, 0, 1.1);
  makeCrate(scene, world, M, 18, -101, 0.3, 1.4);
  makeCrate(scene, world, M, 12, -96, 0, 1.2);
  // 货架
  for (const sx of [5, 10, 15, 20]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 6), M.hullDark);
    shelf.position.set(sx, 1.6, -99);
    shelf.castShadow = true;
    scene.add(shelf);
    addCollider(world, sx - 0.6, 0, -102, sx + 0.6, 3.2, -96);
  }
  // 维修站 — 恢复生命（一次性）
  const repair = makeTerminal(scene, M, 19, -88, -2.4, M.glowOrange);
  world.interactables.push({
    id: 'repair_station',
    type: 'repair',
    position: new THREE.Vector3(19, 1.1, -88),
    radius: 2.6,
    label: '应急维修站',
    hint: '修复外装甲（+50）',
    active: true,
    onInteract(game) {
      this.active = false;
      game.player.heal(50);
      game.audio.interact();
      game.ui.toast('装甲修复 +50', 'good');
      game.particles.emit({ position: this.position, count: 24, color: 0xffa040, speed: 3, life: 0.8, size: 4, up: 2 });
    },
  });
  addDatalog(scene, world, M, 8, -100, 'log_b3', '轮机长·货单备注', '谁看到这批货记一笔：三号集装箱里的"地质样本"半夜在发光。港口那帮人肯定知道些什么。另外储藏室的备件柜是我焊死的——钥匙在反应堆大厅的值班台上，别问为什么，问就是有人偷备件去赌星星。');
  world.enemySpawns.push({
    pos: new THREE.Vector3(16, 0, -90),
    patrol: [
      new THREE.Vector3(7, 0, -85), new THREE.Vector3(19, 0, -85),
      new THREE.Vector3(19, 0, -100), new THREE.Vector3(7, 0, -100),
    ],
  });

  slidingDoor(scene, world, M, 'door_store', 3, -90, 'z', null, '储藏室舱门');

  // 走廊巡逻机
  world.enemySpawns.push({
    pos: new THREE.Vector3(0, 0, -75),
    patrol: [
      new THREE.Vector3(0, 0, -52), new THREE.Vector3(0, 0, -106),
    ],
  });

  // ===== 尽头大门 B→C =====
  wall(scene, world, M, -3, -108, 3, -108, CORRIDOR_H);
  // 门洞
  const doorBCE = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4.2, 0.5), M.hullDark);
  panel.position.set(0, 2.1, 0);
  panel.castShadow = true;
  doorBCE.add(panel);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.24, 0.56), M.glowRed);
  stripe.position.set(0, 3.9, 0);
  doorBCE.add(stripe);
  doorBCE.position.set(0, 0, -108);
  scene.add(doorBCE);
  const doorBCCol = world.collision.addBox(new THREE.Box3(new THREE.Vector3(-2.3, 0, -108.3), new THREE.Vector3(2.3, 4.2, -107.7)));
  const doorBC = {
    group: doorBCE,
    collider: doorBCCol,
    open: false,
    t: 0,
    update(dt) {
      const target = this.open ? 1 : 0;
      this.t += (target - this.t) * Math.min(1, dt * 2);
      this.group.position.y = this.t * 4.1;
      this.collider.min.y = this.t * 4.1;
      this.collider.max.y = this.t * 4.1 + 4.2;
    },
  };
  world.doors.push(doorBC);
  world.interactables.push({
    id: 'door_bc',
    type: 'door',
    position: new THREE.Vector3(0, 2, -107.5),
    radius: 4,
    label: '反应堆大厅闸门',
    hint: '开启闸门',
    active: true,
    onInteract(game) {
      doorBC.open = true;
      this.active = false;
      game.audio.door();
      game.ui.toast('反应堆大厅已解锁', 'info');
    },
  });
}
