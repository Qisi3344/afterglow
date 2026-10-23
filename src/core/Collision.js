// 静态碰撞世界 — AABB 列表。支持：
//  - 圆柱体（玩家/敌人）水平推离
//  - 站立面高度查询（地面/箱子顶/二层平台）
//  - 点包含查询（子弹撞墙）
import * as THREE from 'three';

export class CollisionWorld {
  constructor() {
    this.boxes = []; // THREE.Box3 列表
  }

  addBox(box3) {
    this.boxes.push(box3);
    return box3;
  }

  addFromMesh(mesh) {
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(mesh);
    this.boxes.push(box);
    return box;
  }

  // 水平推离：把圆（pos.xz，半径 r，脚底 footY 头顶 headY）从 AABB 中推出
  resolveCircle(pos, r, footY, headY, stepAllow = 0.55) {
    let grounded = false;
    for (const b of this.boxes) {
      if (b.max.y <= footY + stepAllow || b.min.y >= headY) continue; // 可踏上或完全高于头顶
      const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
      const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 1e-8) {
          // 圆心在盒内，沿最浅轴推出
          const px = Math.min(pos.x - b.min.x, b.max.x - pos.x);
          const pz = Math.min(pos.z - b.min.z, b.max.z - pos.z);
          if (px < pz) pos.x += (pos.x - (b.min.x + b.max.x) / 2 > 0 ? px + r : -(px + r));
          else pos.z += (pos.z - (b.min.z + b.max.z) / 2 > 0 ? pz + r : -(pz + r));
        } else {
          const d = Math.sqrt(d2);
          const push = (r - d) / d;
          pos.x += dx * push;
          pos.z += dz * push;
        }
      }
    }
    return grounded;
  }

  // 站立面高度：脚部附近 AABB 的最高顶面
  supportHeight(x, z, r, footY) {
    let h = 0; // 默认地面
    for (const b of this.boxes) {
      if (x > b.min.x - r * 0.5 && x < b.max.x + r * 0.5 && z > b.min.z - r * 0.5 && z < b.max.z + r * 0.5) {
        if (b.max.y <= footY + 0.35 && b.max.y > h) h = b.max.y;
      }
    }
    return h;
  }

  containsPoint(p) {
    for (const b of this.boxes) {
      if (p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y && p.z > b.min.z && p.z < b.max.z) return true;
    }
    return false;
  }
}
