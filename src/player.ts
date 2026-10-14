import * as THREE from 'three';
import { Arena } from './arena';
import { Input } from './input';
import { Settings } from './settings';
import { TUNING } from './config';
export class Player {
  position = new THREE.Vector3(0, 0, 17);
  yaw = 0;
  pitch = 0;
  vy = 0;
  grounded = true;
  dashCooldown = 0;
  private dashTime = 0;
  private dashDirection = new THREE.Vector3();
  moving = false;
  private bob = 0;
  constructor(
    public camera: THREE.PerspectiveCamera,
    public arena: Arena,
    public input: Input,
  ) {
    camera.rotation.order = 'YXZ';
  }
  reset() {
    this.position.set(0, 0, 17);
    this.yaw = 0;
    this.pitch = 0;
    this.vy = 0;
    this.grounded = true;
    this.dashCooldown = this.dashTime = this.bob = 0;
    this.camera.position.set(0, TUNING.playerEye, 17);
    this.camera.rotation.set(0, 0, 0);
  }
  update(dt: number, settings: Settings) {
    this.yaw -= this.input.yaw * 0.002 * settings.sensitivity;
    this.pitch -= this.input.pitch * 0.002 * settings.sensitivity * (settings.invert ? -1 : 1);
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
    let x =
      (this.input.keys.has('KeyD') ? 1 : 0) -
      (this.input.keys.has('KeyA') ? 1 : 0) +
      this.input.moveX;
    let forward =
      (this.input.keys.has('KeyW') ? 1 : 0) -
      (this.input.keys.has('KeyS') ? 1 : 0) +
      this.input.moveY;
    const len = Math.hypot(x, forward);
    if (len > 1) {
      x /= len;
      forward /= len;
    }
    this.moving = len > 0.05;
    const sin = Math.sin(this.yaw),
      cos = Math.cos(this.yaw);
    let dx = x * cos - forward * sin,
      dz = -x * sin - forward * cos;
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.input.take('KeyQ') && this.dashCooldown <= 0) {
      if (!this.moving) {
        dx = -sin;
        dz = -cos;
      }
      this.dashDirection.set(dx, 0, dz).normalize();
      this.dashTime = TUNING.dashDuration;
      this.dashCooldown = TUNING.dashCooldown;
    }
    if (this.input.take('Space') && this.grounded) {
      this.vy = TUNING.jump;
      this.grounded = false;
    }
    // Cover is deliberately impassable: jumps clear attacks, not the navigation boundary.
    const speed = this.input.keys.has('ShiftLeft') ? TUNING.sprint : TUNING.speed;
    if (this.dashTime > 0) {
      this.arena.move(
        this.position,
        this.dashDirection.x * TUNING.dashSpeed * dt,
        this.dashDirection.z * TUNING.dashSpeed * dt,
        TUNING.playerRadius,
      );
      this.dashTime -= dt;
    } else this.arena.move(this.position, dx * speed * dt, dz * speed * dt, TUNING.playerRadius);
    this.vy -= TUNING.gravity * dt;
    this.position.y += this.vy * dt;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.vy = 0;
      this.grounded = true;
    }
    if (this.moving) this.bob += dt * speed * 1.7;
    this.camera.position.set(
      this.position.x,
      this.position.y +
        TUNING.playerEye +
        (settings.reduced ? 0 : Math.sin(this.bob) * 0.025 * (this.moving ? 1 : 0)),
      this.position.z,
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
