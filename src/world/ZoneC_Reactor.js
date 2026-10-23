// 区域C — 反应堆大厅：中央反应堆、二层平台、信标终端与最终撤离战舞台。
import * as THREE from 'three';
import { addBox, addCollider, addDatalog, makeCore, makeTerminal } from './Kit.js';

export function buildZoneC(scene, M, world) {
  const H = 14;
  // ---- 外壳 ----
  const floor = new THREE.Mesh(new THREE.BoxGeometry(42, 0.6, 72), M.floor);
  floor.position.set(0, -0.3, -142); // x -21..21, z -178..-106
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = M.hull;
  const mkWall = (x1, z1, x2, z2) => {
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const len = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1));
    const along = Math.abs(x2 - x1) > Math.abs(z2 - z1) ? 'x' : 'z';
    const m = new THREE.Mesh(new THREE.BoxGeometry(along === 'x' ? len : 1, H, along === 'z' ? len : 1), wallMat);
    m.position.set(cx, H / 2, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    addCollider(world, Math.min(x1, x2) - 0.5, 0, Math.min(z1, z2) - 0.5, Math.max(x1, x2) + 0.5, H, Math.max(z1, z2) + 0.5);
  };
  mkWall(-20.5, -107.5, -20.5, -176.5);
  mkWall(20.5, -107.5, 20.5, -176.5);
  mkWall(-20.5, -176.5, 20.5, -176.5);
  mkWall(-20.5, -107.5, -2.5, -107.5); // 南墙留 B 门缺口
  mkWall(2.5, -107.5, 20.5, -107.5);

  // 高窗与天花
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(42, 0.6, 72), M.hullDark);
  ceil.position.set(0, H + 0.3, -142);
  scene.add(ceil);
  const oculus = new THREE.Mesh(new THREE.TorusGeometry(5, 0.5, 12, 40), M.glowCyan);
  oculus.position.set(0, H - 0.1, -140);
  oculus.rotation.x = Math.PI / 2;
  scene.add(oculus);
  const oculusLight = new THREE.PointLight(0x9fe8ff, 2.5, 40, 1.6);
  oculusLight.position.set(0, H - 2, -140);
  scene.add(oculusLight);

  // ---- 中央反应堆 ----
  const reactor = new THREE.Group();
  const column = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, H, 16), M.hullDark);
  column.position.y = H / 2;
  column.castShadow = true;
  reactor.add(column);
  const coreGlowMat = new THREE.MeshStandardMaterial({ color: 0x06231f, emissive: 0x39ffd0, emissiveIntensity: 2.6, roughness: 0.3 });
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.16, 8, 36), coreGlowMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 2.2 + i * 2.8;
    reactor.add(band);
  }
  const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 0.6, 24), M.hull);
  baseRing.position.y = 0.3;
  baseRing.receiveShadow = true;
  reactor.add(baseRing);
  reactor.position.set(0, 0, -140);
  scene.add(reactor);
  addCollider(world, -3.4, 0, -143.4, 3.4, H, -136.6);
  const reactorLight = new THREE.PointLight(0x39ffd0, 8, 34, 1.5);
  reactorLight.position.set(0, 6, -140);
  scene.add(reactorLight);
  const lightRing1 = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.08, 6, 42), coreGlowMat);
  lightRing1.rotation.x = Math.PI / 2;
  lightRing1.position.set(0, 0.1, -140);
  scene.add(lightRing1);
  world.updateFns.push((dt, t) => {
    reactorLight.intensity = world.alarm ? 4 + Math.sin(t * 8) * 2 : 7 + Math.sin(t * 1.2) * 1.2;
    coreGlowMat.emissiveIntensity = world.alarm ? 1.6 + Math.sin(t * 9) * 0.9 : 2.6 + Math.sin(t * 1.2) * 0.4;
    lightRing1.rotation.z = t * 0.4;
  });
  world.reactorGlowMat = coreGlowMat;

  // ---- 四角支撑柱 ----
  for (const [px, pz] of [[-15, -114], [15, -114], [-15, -170], [15, -170]]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(2.4, H, 2.4), M.hullDark);
    col.position.set(px, H / 2, pz);
    col.castShadow = true;
    scene.add(col);
    addCollider(world, px - 1.2, 0, pz - 1.2, px + 1.2, H, pz + 1.2);
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 2.6), M.glowOrange);
    band.position.set(px, 3.4, pz);
    scene.add(band);
  }

  // ---- 二层平台（北+西 L 形，y=4）----
  const deckMat = M.hull;
  const deckN = new THREE.Mesh(new THREE.BoxGeometry(34, 0.5, 6), deckMat); // 北侧
  deckN.position.set(0, 3.85, -170);
  deckN.castShadow = deckN.receiveShadow = true;
  scene.add(deckN);
  addCollider(world, -17, 3.6, -173, 17, 4.1, -167);
  const deckW = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 22), deckMat); // 西侧
  deckW.position.set(-17, 3.85, -157);
  deckW.castShadow = deckW.receiveShadow = true;
  scene.add(deckW);
  addCollider(world, -20, 3.6, -168, -14, 4.1, -146);
  // 平台栏杆
  const railN = new THREE.Mesh(new THREE.BoxGeometry(34, 0.06, 0.06), M.glowCyan);
  railN.position.set(0, 4.75, -167.2);
  scene.add(railN);
  const railW = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 22), M.glowCyan);
  railW.position.set(-14.2, 4.75, -157);
  scene.add(railW);

  // 楼梯（东侧上行，台阶每级 0.37 高）
  for (let i = 0; i < 11; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.37, 1.05), deckMat);
    step.position.set(14.2, 0.185 + i * 0.37, -164 + i * 1.05);
    step.castShadow = step.receiveShadow = true;
    scene.add(step);
    addCollider(world, 12.6, 0 + i * 0.37, -164.55 + i * 1.05, 15.8, 0.37 + i * 0.37, -163.45 + i * 1.05);
  }
  // 平台间连桥（楼梯顶 y≈4.07 与北侧平台 4.1 平齐）
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.4, 8), deckMat);
  bridge.position.set(14.2, 3.9, -170);
  bridge.castShadow = bridge.receiveShadow = true;
  scene.add(bridge);
  addCollider(world, 12.6, 3.6, -174, 15.8, 4.1, -166);

  // ---- 高台上的核心 ----
  makeCore(scene, world, M, 'core_reactor', -17, 5.3, -157, '反应堆相位核心');
  // 高台哨机
  world.enemySpawns.push({
    pos: new THREE.Vector3(-17, 4.4, -160),
    patrol: [
      new THREE.Vector3(-17, 4.4, -170), new THREE.Vector3(-17, 4.4, -148),
    ],
    highAlt: 4.4,
  });
  // 大厅地面巡逻机
  world.enemySpawns.push({
    pos: new THREE.Vector3(10, 0, -130),
    patrol: [
      new THREE.Vector3(-12, 0, -116), new THREE.Vector3(12, 0, -116),
      new THREE.Vector3(12, 0, -166), new THREE.Vector3(-12, 0, -166),
    ],
  });

  // ---- 信标终端（北侧平台中央）----
  const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 1.1, 8), M.hull);
  beaconBase.position.set(0, 4.65, -170);
  beaconBase.castShadow = true;
  scene.add(beaconBase);
  const beaconAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 4.2, 8), M.hullDark);
  beaconAntenna.position.set(0, 7.2, -170);
  scene.add(beaconAntenna);
  const beaconTipMat = new THREE.MeshStandardMaterial({ color: 0x1a0808, emissive: 0xff3b30, emissiveIntensity: 2.2, roughness: 0.4 });
  const beaconTip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), beaconTipMat);
  beaconTip.position.set(0, 9.4, -170);
  scene.add(beaconTip);
  world.beaconTipMat = beaconTipMat;
  world.updateFns.push((dt, t) => {
    beaconTipMat.emissiveIntensity = world.alarm ? 3 + Math.sin(t * 10) * 1.5 : 1.2 + Math.sin(t * 2) * 0.5;
  });
  const beaconLight = new THREE.PointLight(0xff3b30, 0, 30, 1.6);
  beaconLight.position.set(0, 9.4, -170);
  scene.add(beaconLight);
  world.beaconLight = beaconLight;

  world.interactables.push({
    id: 'beacon',
    type: 'beacon',
    position: new THREE.Vector3(0, 5.2, -170),
    radius: 3.4,
    label: '撤离信标',
    hint: '插入相位核心',
    active: true,
    onInteract(game) {
      if (game.missions.state.cores >= 3) {
        game.activateBeacon();
      } else {
        game.ui.toast(`核心不足：${game.missions.state.cores}/3`, 'warn');
        game.audio.uiBack();
      }
    },
  });

  // 值班台数据板
  addDatalog(scene, world, M, -6, -148, 'log_c1', '反应堆值班台·交接班', '如果读到这里说明反应堆还密封。三枚核心弹出后大厅的屏蔽层撑不了九十秒以上——重新插入核心只是重启信标，不是修反应堆。启动信标的那一刻，安保网会知道你在哪。祝你好运，打捞员。跑的时候别回头。');

  // 大厅氛围点光
  const amb1 = new THREE.PointLight(0x9fbfff, 3, 40, 1.8);
  amb1.position.set(-12, 10, -120);
  scene.add(amb1);
  const amb2 = new THREE.PointLight(0xff8c3a, 2.5, 30, 1.8);
  amb2.position.set(12, 8, -160);
  scene.add(amb2);

  // ---- 撤离战生成点 ----
  world.evacSpawnPoints = [
    new THREE.Vector3(-10, 0, -150),
    new THREE.Vector3(10, 0, -150),
    new THREE.Vector3(0, 0, -120),
    new THREE.Vector3(-15, 0, -112),
    new THREE.Vector3(15, 0, -112),
  ];
}
