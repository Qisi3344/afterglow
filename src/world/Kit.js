// 场景构建套件 — 各区域共享的可复用组件。
import * as THREE from 'three';

export function addBox(parent, mat, w, h, d, x, y, z, castShadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (castShadow) { m.castShadow = true; m.receiveShadow = true; }
  parent.add(m);
  return m;
}

export function addCollider(world, x1, y1, z1, x2, y2, z2) {
  world.collision.addBox(new THREE.Box3(new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)));
}

// 板条箱 — 可跳上的掩体
export function makeCrate(scene, world, M, x, z, rotY, size = 1.2) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), M.crate);
  box.position.y = size / 2;
  box.castShadow = true;
  g.add(box);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(size * 1.02, size * 0.14, size * 1.02), M.glowOrange);
  strap.position.y = size / 2;
  g.add(strap);
  const h = size;
  const s = size / 2;
  addCollider(world, x - s, 0, z - s, x + s, h, z + s);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
  return g;
}

// 暖橙灯柱 — 点光 + 灯罩发光体 + 闪烁支持
export function makeLightPost(scene, world, M, x, z, color, lampList) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 4.2, 8), M.hullDark);
  pole.position.y = 2.1;
  pole.castShadow = true;
  g.add(pole);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, emissive: color, emissiveIntensity: 2.2, roughness: 0.4 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), lampMat);
  lamp.position.y = 4.35;
  g.add(lamp);
  g.position.set(x, 0, z);
  scene.add(g);
  const light = new THREE.PointLight(color, 5, 15, 1.8);
  light.position.set(x, 4.3, z);
  scene.add(light);
  addCollider(world, x - 0.2, 0, z - 0.2, x + 0.2, 4.2, z + 0.2);
  if (lampList) lampList.push({ light, mat: lampMat, baseI: 5, phase: Math.random() * 10 });
  return g;
}

// 栏杆 — 边界（a,b 为沿轴向的区间，axis 为延伸轴；fixed=港向坐标）
export function makeRail(scene, world, M, a, b, fixed, axis) {
  const len = b - a;
  if (len <= 0) return;
  const mid = (a + b) / 2;
  const g = new THREE.Group();
  for (const h of [0.55, 1.05]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? len : 0.07, 0.07, axis === 'x' ? 0.07 : len), M.hullDark);
    bar.position.y = h;
    g.add(bar);
  }
  const n = Math.ceil(len / 2.2);
  for (let i = 0; i <= n; i++) {
    const t = a + (len * i) / n;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.15, 0.09), M.hullDark);
    post.position.set(axis === 'x' ? t : 0, 0.55, axis === 'x' ? 0 : t);
    g.add(post);
  }
  g.position.set(axis === 'x' ? mid : fixed, 0, axis === 'x' ? fixed : mid);
  scene.add(g);
  const min = axis === 'x' ? new THREE.Vector3(Math.min(a, b), 0, fixed - 0.12) : new THREE.Vector3(fixed - 0.12, 0, Math.min(a, b));
  const max = axis === 'x' ? new THREE.Vector3(Math.max(a, b), 1.1, fixed + 0.12) : new THREE.Vector3(fixed + 0.12, 1.1, Math.max(a, b));
  world.collision.addBox(new THREE.Box3(min, max));
}

// 相位核心 — 可拾取的发光八面体
export function makeCore(scene, world, M, id, x, y, z, name) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), M.coreCyan);
  core.castShadow = true;
  g.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 8, 28), M.glowCyan);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const ring2 = ring.clone();
  ring2.rotation.set(Math.PI / 3, Math.PI / 4, 0);
  g.add(ring2);
  g.position.set(x, y, z);
  scene.add(g);
  const light = new THREE.PointLight(0x39ffd0, 3.5, 9, 1.8);
  light.position.copy(g.position);
  scene.add(light);
  world.updateFns.push((dt, t) => {
    core.rotation.y = t * 1.4;
    core.rotation.x = Math.sin(t * 0.8) * 0.3;
    ring.rotation.z = t * 0.9;
    ring2.rotation.y = -t * 1.1;
    g.position.y = y + Math.sin(t * 2) * 0.12;
    light.position.copy(g.position);
  });
  const inter = {
    id,
    type: 'core',
    position: g.position.clone(),
    radius: 2.2,
    label: name,
    hint: '回收相位核心',
    active: true,
    _group: g,
    _light: light,
    onInteract(game) {
      this.active = false;
      g.visible = false;
      light.intensity = 0;
      game.missions.onCoreCollected(id);
      game.audio.pickup();
      game.particles.emit({ position: g.position, count: 40, color: 0x39ffd0, speed: 5, life: 1.0, size: 6, up: 2 });
      game.ui.toast('相位核心已回收', 'good');
    },
  };
  world.interactables.push(inter);
  return g;
}

// 终端 — 带屏幕的立式操作台
export function makeTerminal(scene, M, x, z, rotY = 0, screenMat = null) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.6), M.hullDark);
  base.position.y = 0.52;
  base.castShadow = true;
  g.add(base);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.5, 0.06), screenMat || M.glowCyan);
  screen.position.set(0, 1.1, -0.02);
  screen.rotation.x = -0.28;
  g.add(screen);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
  return g;
}

// 数据板 — 可读取的叙事终端
export function addDatalog(scene, world, M, x, z, id, title, text) {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.0, 8), M.hullDark);
  stand.position.y = 0.5;
  g.add(stand);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.44, 0.05), M.glowCyan);
  screen.position.y = 1.15;
  g.add(screen);
  g.position.set(x, 0, z);
  scene.add(g);
  world.interactables.push({
    id,
    type: 'datalog',
    position: new THREE.Vector3(x, 1.1, z),
    radius: 2.6,
    label: `数据板：${title}`,
    hint: '读取数据板',
    active: true,
    read: false,
    text,
    onInteract(game) {
      this.read = true;
      game.missions.onDatalogRead(this.id);
      game.audio.interact();
      game.ui.showDatalog(title, text);
    },
  });
  // 屏幕微闪
  const blink = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.06), M.glowOrange);
  blink.position.set(-0.2, 1.3, 0.04);
  g.add(blink);
  world.updateFns.push((dt, t) => { blink.visible = Math.sin(t * 3 + x) > -0.5; });
}

// 室内墙段 — 带碰撞，返回 mesh（可作 raycast 遮挡）
export function wall(scene, world, M, x1, z1, x2, z2, h = 5, thick = 0.5, mat = null) {
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const len = Math.hypot(x2 - x1, z2 - z1);
  const ang = Math.atan2(z1 - z2, x2 - x1); // 墙沿 X 轴放置后旋转
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, thick), mat || M.hull);
  m.position.set(cx, h / 2, cz);
  m.rotation.y = ang;
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  // 旋转墙的 AABB 用包围盒（角度都为 90° 倍数或小角度，近似可行；本项目墙均为正交）
  const hw = Math.abs(x2 - x1) / 2 + thick / 2 + 0.001;
  const hd = Math.abs(z2 - z1) / 2 + thick / 2 + 0.001;
  world.collision.addBox(new THREE.Box3(
    new THREE.Vector3(Math.min(x1, x2) - thick / 2, 0, Math.min(z1, z2) - thick / 2),
    new THREE.Vector3(Math.max(x1, x2) + thick / 2, h, Math.max(z1, z2) + thick / 2)
  ));
  return m;
}
