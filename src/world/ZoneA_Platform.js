// 区域A — 着陆平台（起点、教学、撤离点）
import * as THREE from 'three';
import { addBox, addDatalog, makeCrate, makeLightPost, makeRail } from './Kit.js';

export function buildZoneA(scene, M, world) {
  // ---- 主平台 ----
  const platform = new THREE.Mesh(new THREE.BoxGeometry(34, 1, 56), M.floor);
  platform.position.set(0, -0.5, -17); // z 覆盖 +11 ~ -45
  platform.receiveShadow = true;
  scene.add(platform);
  world.collision.addBox(new THREE.Box3(new THREE.Vector3(-17, -1, -45), new THREE.Vector3(17, 0, 11)));

  // 平台下的支撑结构与深渊感
  for (const [x, z] of [[-13, -38], [13, -38], [-13, 4], [13, 4], [0, -20]]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 40, 10), M.hullDark);
    pillar.position.set(x, -21, z);
    scene.add(pillar);
  }

  // ---- 打捞飞船（撤离点地标）----
  const ship = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(2.2, 5.2, 6, 12), M.shipHull);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  ship.add(body);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.glass);
  cockpit.position.set(-3.6, 0.9, 0);
  cockpit.rotation.z = Math.PI / 2;
  ship.add(cockpit);
  for (const s of [-1, 1]) {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, 2.4, 10), M.hullDark);
    engine.rotation.z = Math.PI / 2;
    engine.position.set(4.2, 0.2, s * 1.9);
    ship.add(engine);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.75, 12), M.glowCyan);
    glow.rotation.y = Math.PI / 2;
    glow.position.set(5.45, 0.2, s * 1.9);
    ship.add(glow);
    // 起落架
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.6, 0.28), M.hullDark);
    leg.position.set(-1.2, -1.9, s * 1.5);
    ship.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 1.8), M.hullDark);
    foot.position.set(-1.2, -2.7, s * 1.5);
    ship.add(foot);
  }
  ship.position.set(10, 3.4, 4);
  ship.rotation.y = -0.5;
  scene.add(ship);
  world.collision.addBox(new THREE.Box3(new THREE.Vector3(6, 0, 0), new THREE.Vector3(14.4, 3, 8)));
  world.updateFns.push((dt, t) => { ship.position.y = 3.4 + Math.sin(t * 0.8) * 0.12; });
  const shipLight = new THREE.PointLight(0x2affd5, 6, 18, 1.6);
  shipLight.position.set(10, 4.2, 4);
  scene.add(shipLight);

  // ---- 边缘栏杆（挡住玩家）----
  makeRail(scene, world, M, -17, 17, -45, 'z');   // 北缘（门口留缺）
  makeRail(scene, world, M, -17, -7.5, 11, 'x');  // 南缘（留飞船登机口）
  makeRail(scene, world, M, 7.5, 17, 11, 'x');
  makeRail(scene, world, M, -17, 17, 11, 'z');

  // ---- 灯柱 ----
  for (const [x, z] of [[-13, -40], [13, -40], [-13, -4], [13, -4], [-13, 6], [13, 6]]) {
    makeLightPost(scene, world, M, x, z, 0xff8c3a, world.lampLights);
  }

  // ---- 板条箱与掩体 ----
  makeCrate(scene, world, M, -6, -14, 0, 1.4);
  makeCrate(scene, world, M, -4.4, -15.2, 1, 1.0);
  makeCrate(scene, world, M, -6.2, -15.6, 2.2, 1.2);
  makeCrate(scene, world, M, 7, -26, 0, 1.6);
  makeCrate(scene, world, M, 8.6, -26.6, 1, 1.1);
  makeCrate(scene, world, M, -9, -33, 0, 1.3);
  // 燃料罐
  for (const [x, z] of [[4.5, -12], [6.3, -12.8]]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.6, 14), M.crate);
    tank.position.set(x, 1.3, z);
    tank.castShadow = true;
    scene.add(tank);
    world.collision.addBox(new THREE.Box3(new THREE.Vector3(x - 0.9, 0, z - 0.9), new THREE.Vector3(x + 0.9, 2.6, z + 0.9)));
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.07, 8, 20), M.glowOrange);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.6;
    tank.add(band);
  }

  // ---- 倒塌的天线桁架（环境叙事：这里出过事）----
  const mast = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.6), M.hullDark);
    seg.position.set(0, 0, i * 1.7);
    mast.add(seg);
  }
  mast.rotation.set(Math.PI / 2 - 0.4, 0.6, 0);
  mast.position.set(-11, 1.4, -22);
  scene.add(mast);
  world.collision.addBox(new THREE.Box3(new THREE.Vector3(-14.5, 0, -24), new THREE.Vector3(-7.5, 1.8, -18)));

  // ---- 北端大门（A→B，可交互）----
  const doorGroup = new THREE.Group();
  addBox(doorGroup, M.hull, 10, 7, 0.8, 0, 3.5, 0);
  // 门框
  addBox(scene, M.hullDark, 2, 7.4, 2, -6, 3.7, -45);
  addBox(scene, M.hullDark, 2, 7.4, 2, 6, 3.7, -45);
  addBox(scene, M.hullDark, 14, 2, 2, 0, 7.6, -45);
  const lintelGlow = addBox(scene, M.glowOrange, 10, 0.3, 0.3, 0, 6.4, -44.2);
  world.collision.addBox(new THREE.Box3(new THREE.Vector3(-7, 0, -46), new THREE.Vector3(-5, 7.4, -44)));
  world.collision.addBox(new THREE.Box3(new THREE.Vector3(5, 0, -46), new THREE.Vector3(7, 7.4, -44)));
  world.collision.addBox(new THREE.Box3(new THREE.Vector3(-7, 7, -46), new THREE.Vector3(7, 8.6, -44)));
  doorGroup.position.set(0, 0, -45);
  scene.add(doorGroup);
  world.collision.addBox(new THREE.Box3(new THREE.Vector3(-5, 0, -45.4), new THREE.Vector3(5, 7, -44.6)));
  const doorCollider = world.collision.boxes[world.collision.boxes.length - 1];

  const doorAB = {
    group: doorGroup,
    collider: doorCollider,
    open: false,
    t: 0,
    update(dt) {
      const target = this.open ? 1 : 0;
      this.t += (target - this.t) * Math.min(1, dt * 2.5);
      // 门上滑开启
      this.group.position.y = this.t * 6.6;
      this.collider.min.y = this.t * 6.6;
      this.collider.max.y = this.t * 6.6 + 7;
    },
  };
  world.doors.push(doorAB);
  world.interactables.push({
    id: 'door_ab',
    type: 'door',
    position: new THREE.Vector3(0, 2, -44.2),
    radius: 4.5,
    label: '舱段闸门',
    hint: '开启闸门',
    once: true,
    active: true,
    onInteract(game) {
      doorAB.open = true;
      this.active = false;
      game.audio.door();
      game.missions.onDoorOpened();
      game.ui.toast('闸门已开启 — 进入研究舱段', 'info');
    },
  });

  // ---- 教学数据板 ----
  addDatalog(scene, world, M, 2.5, -8, 'log_a1', '打捞员备忘', '合同目标：回收三枚相位核心，重启撤离信标。站内安保无人机已失控——它们会把任何热源当目标。别逞英雄，拿完东西就走。');

  // ---- 撤离触发区（飞船）----
  world.interactables.push({
    id: 'evac',
    type: 'evac',
    position: new THREE.Vector3(10, 1, 4),
    radius: 5,
    label: '打捞飞船「汐号」',
    hint: '登船撤离',
    active: false, // 信标激活后可用
    onInteract(game) {
      if (game.missions.state.phase === 'evacuate') game.victory();
      else game.ui.toast('信标未激活，导航台无法定位跳跃窗口', 'warn');
    },
  });

  // ---- 平台外的漂浮岩石 ----
  for (let i = 0; i < 16; i++) {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + Math.random() * 5, 1), M.rock);
    const ang = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 120;
    rock.position.set(Math.cos(ang) * dist, -20 + Math.random() * 55, -17 + Math.sin(ang) * dist * 0.8);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    scene.add(rock);
  }
}
