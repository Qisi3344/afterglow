// 第三人称相机 — 鼠标控制偏航/俯仰，肩部偏移，AABB 遮挡收缩。
import * as THREE from 'three';

const DIST = 4.8;
const SHOULDER = 0.55;
const PITCH_MIN = -0.55;
const PITCH_MAX = 1.15;

export class CameraRig {
  constructor(camera, world, input, settings) {
    this.camera = camera;
    this.world = world;
    this.input = input;
    this.settings = settings;
    this.yaw = 0;
    this.pitch = 0.32;
    this.dist = DIST;
    this.smoothPos = new THREE.Vector3();
    this._ray = new THREE.Ray();
    this._tmp = new THREE.Vector3();
  }

  update(dt, player) {
    const sens = 0.0022 * this.settings.sensitivity;
    this.yaw -= this.input.mouseDX * sens;
    this.pitch += this.input.mouseDY * sens;
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch));
    // 归一化 yaw
    if (this.yaw > Math.PI * 2) this.yaw -= Math.PI * 2;
    if (this.yaw < -Math.PI * 2) this.yaw += Math.PI * 2;

    // 目标点：头部 + 肩偏移
    const target = player.headWorldPos;
    const right = this._tmp.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const focus = target.clone().addScaledVector(right, SHOULDER);

    // 理想相机位置
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    const ideal = focus.clone().addScaledVector(dir, DIST);

    // 遮挡检测：从焦点向相机方向射线，碰到墙则拉近
    let allowed = DIST;
    this._ray.origin.copy(focus);
    this._ray.direction.copy(dir);
    for (const b of this.world.collision.boxes) {
      const hit = this._ray.intersectBox(b, new THREE.Vector3());
      if (hit) {
        const d = hit.distanceTo(focus);
        if (d < allowed) allowed = Math.max(0.8, d - 0.25);
      }
    }
    this.dist += (allowed - this.dist) * Math.min(1, dt * 10);

    const camPos = focus.clone().addScaledVector(dir, this.dist);
    // 相机不穿地面
    if (camPos.y < 0.35) camPos.y = 0.35;
    this.camera.position.copy(camPos);
    this.camera.lookAt(focus);
  }

  resetBehindPlayer() {
    this.yaw = 0;
    this.pitch = 0.32;
    this.dist = DIST;
  }
}
