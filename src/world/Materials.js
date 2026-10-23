// 程序化材质工厂 — 所有纹理用 Canvas 生成，零外部素材，风格统一：
// 深色金属船体 + 冷蓝环境 + 暖橙应急灯 + 青绿能量色。
import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, ctx: c.getContext('2d') };
}

function toTexture(c, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 金属壁板：板缝 + 铆钉 + 磨损污渍
function metalPlateCanvas(base, plateSize = 128, plates = 4) {
  const size = plateSize * plates;
  const { c, ctx } = makeCanvas(size, size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let py = 0; py < plates; py++) {
    for (let px = 0; px < plates; px++) {
      const x = px * plateSize, y = py * plateSize;
      // 每块板亮度微差
      const shade = (Math.random() - 0.5) * 10;
      ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade / 100})` : `rgba(0,0,0,${-shade / 100})`;
      ctx.fillRect(x + 2, y + 2, plateSize - 4, plateSize - 4);
      // 板缝
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, plateSize - 3, plateSize - 3);
      // 铆钉
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      const r = 5;
      for (const [rx, ry] of [[14, 14], [plateSize - 14, 14], [14, plateSize - 14], [plateSize - 14, plateSize - 14]]) {
        ctx.beginPath();
        ctx.arc(x + rx, y + ry, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // 污渍噪点
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '0,0,0' : '120,140,150'},${Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 18 + 4, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

// 格栅地板
function gratingCanvas() {
  const { c, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#14181d';
  ctx.fillRect(0, 0, 256, 256);
  // 斜向格栅条
  ctx.strokeStyle = '#232a32';
  ctx.lineWidth = 7;
  for (let i = -256; i < 512; i += 24) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 256, 256); ctx.stroke();
  }
  ctx.strokeStyle = '#0b0e12';
  ctx.lineWidth = 2;
  for (let i = -256; i < 512; i += 24) {
    ctx.beginPath(); ctx.moveTo(i + 256, 0); ctx.lineTo(i, 256); ctx.stroke();
  }
  // 边框
  ctx.strokeStyle = '#2c3540';
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, 256, 256);
  return c;
}

// 混凝土/岩石面
function rockCanvas() {
  const { c, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#1a1e24';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const g = 20 + Math.random() * 30;
    ctx.fillStyle = `rgba(${g},${g + 4},${g + 10},${0.25 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, Math.random() * 9 + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  // 裂纹
  ctx.strokeStyle = 'rgba(5,7,10,0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    let x = Math.random() * 256, y = Math.random() * 256;
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (Math.random() - 0.5) * 60;
      y += (Math.random() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return c;
}

export function createMaterials() {
  const hullTex = toTexture(metalPlateCanvas('#39424d'), 2);
  const hullDarkTex = toTexture(metalPlateCanvas('#242a32', 128, 5), 2);
  const gratingTex = toTexture(gratingCanvas(), 6);
  const rockTex = toTexture(rockCanvas(), 3);

  const M = {
    hull: new THREE.MeshStandardMaterial({ map: hullTex, roughness: 0.55, metalness: 0.75 }),
    hullDark: new THREE.MeshStandardMaterial({ map: hullDarkTex, roughness: 0.6, metalness: 0.7 }),
    floor: new THREE.MeshStandardMaterial({ map: gratingTex, roughness: 0.7, metalness: 0.5 }),
    rock: new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.95, metalness: 0.05 }),
    crate: new THREE.MeshStandardMaterial({ color: 0x4a5361, roughness: 0.5, metalness: 0.6 }),
    glowCyan: new THREE.MeshStandardMaterial({ color: 0x0b1616, emissive: 0x2affd5, emissiveIntensity: 2.2, roughness: 0.4 }),
    glowOrange: new THREE.MeshStandardMaterial({ color: 0x1a1008, emissive: 0xff8c3a, emissiveIntensity: 2.0, roughness: 0.4 }),
    glowRed: new THREE.MeshStandardMaterial({ color: 0x180808, emissive: 0xff3b30, emissiveIntensity: 2.4, roughness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x88bccc, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22 }),
    coreCyan: new THREE.MeshStandardMaterial({ color: 0x06231f, emissive: 0x39ffd0, emissiveIntensity: 3.2, roughness: 0.2 }),
    shipHull: new THREE.MeshStandardMaterial({ color: 0x5a6470, roughness: 0.4, metalness: 0.85 }),
    plant: new THREE.MeshStandardMaterial({ color: 0x2d5a3a, roughness: 0.9, metalness: 0 }),
    plantGlow: new THREE.MeshStandardMaterial({ color: 0x123028, emissive: 0x37c58f, emissiveIntensity: 1.4, roughness: 0.8 }),
    enemy: new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.35, metalness: 0.85 }),
    enemyEye: new THREE.MeshStandardMaterial({ color: 0x200505, emissive: 0xff2a20, emissiveIntensity: 3.0, roughness: 0.3 }),
  };
  return M;
}
