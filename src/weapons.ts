import * as THREE from 'three';
import { Arena, box } from './arena';
import { Enemies, type Enemy } from './enemies';
import { Effects } from './effects';
import { Sound } from './audio';
import { WEAPONS, TUNING } from './config';
import { canFire, reloadAmmo, type Run } from './core';
import type { Settings } from './settings';
export class Weapons {
  model = new THREE.Group();
  private models: THREE.Group[] = [];
  private flash: THREE.Mesh;
  private recoil = 0;
  private switchTime = 0;
  private ray = new THREE.Raycaster();
  private direction = new THREE.Vector3();
  private endpoint = new THREE.Vector3();
  private start = new THREE.Vector3();
  private base = new THREE.Vector3();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  onHit = (kill: boolean, amount: number, point: THREE.Vector3) => {};
  constructor(
    public camera: THREE.PerspectiveCamera,
    public arena: Arena,
    public enemies: Enemies,
    public effects: Effects,
    public sound: Sound,
  ) {
    camera.add(this.model);
    this.model.position.set(0.31, -0.3, -0.55);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      this.model.add(g);
      this.models.push(g);
      const color = WEAPONS[i].color;
      box(g, 0, 0, 0, i === 2 ? 0.27 : 0.18, 0.17, i === 0 ? 0.4 : 0.65, 0x314555);
      box(g, 0, -0.15, 0.13, 0.12, 0.3, 0.15, 0x1a2d39);
      box(g, 0, 0.065, -0.16, 0.13, 0.05, 0.4, 0x617e8f);
      box(g, 0, 0.06, -0.36, 0.075, 0.12, 0.05, color, color, 1.5);
      box(g, 0.095, 0.01, 0, 0.018, 0.05, 0.24, color, color, 1.3);
      if (i === 1) {
        box(g, 0, -0.18, -0.08, 0.12, 0.27, 0.18, 0x435869);
        box(g, 0, 0.15, 0.06, 0.07, 0.11, 0.07, 0x223949);
      }
      if (i === 2) {
        for (const s of [-1, 1]) box(g, s * 0.07, 0, -0.45, 0.1, 0.1, 0.26, 0x829aa4);
        box(g, 0, -0.1, -0.24, 0.3, 0.1, 0.3, 0x4a5060);
      }
      // Fingerless glove / forearm: original geometric viewmodel.
      box(g, 0.055, -0.18, 0.17, 0.17, 0.16, 0.2, 0x46525a);
      box(g, 0.12, -0.22, 0.35, 0.18, 0.17, 0.35, 0x162d3b);
      box(g, 0.12, -0.13, 0.38, 0.17, 0.03, 0.16, color, color, 0.25);
      g.visible = i === 0;
    }
    this.flash = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.3, 5),
      new THREE.MeshBasicMaterial({
        color: 0xc6faff,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
      }),
    );
    this.flash.rotation.x = -Math.PI / 2;
    this.flash.position.set(0, 0.01, -0.58);
    this.flash.visible = false;
    this.model.add(this.flash);
    this.model.traverse((o) => {
      o.layers.set(1);
      if (o instanceof THREE.Mesh) {
        o.frustumCulled = false;
        o.renderOrder = 10;
      }
    });
  }
  switch(index: number, run: Run) {
    if (index === run.weapon) return;
    run.weapon = index;
    run.reloadRemaining = 0;
    this.switchTime = 0.25;
    this.models.forEach((m, i) => (m.visible = i === index));
    this.sound.tone(240, 0.07, 0.035, 'triangle', 420);
  }
  reload(run: Run) {
    const w = WEAPONS[run.weapon],
      ammo = run.ammo[run.weapon];
    if (run.reloadRemaining > 0 || ammo.mag >= w.mag || ammo.reserve <= 0) return;
    run.reloadRemaining = w.reload;
    this.sound.tone(180, 0.18, 0.07, 'square', 260);
  }
  fire(run: Run, held: boolean, pressed: boolean, settings: Settings) {
    const w = WEAPONS[run.weapon],
      ammo = run.ammo[run.weapon];
    if (!(w.auto ? held : pressed)) return;
    if (
      !canFire(
        run.elapsed,
        run.lastShot[run.weapon],
        w.interval,
        ammo.mag,
        run.reloadRemaining > 0,
        true,
      ) ||
      this.switchTime > 0
    ) {
      if (pressed && ammo.mag === 0) {
        this.sound.tone(85, 0.04, 0.04, 'square');
        this.reload(run);
      }
      return;
    }
    run.lastShot[run.weapon] = run.elapsed;
    ammo.mag--;
    run.shots++;
    this.recoil = 1;
    this.sound.weapon(run.weapon);
    this.flash.visible = !settings.reduced;
    this.camera.getWorldDirection(this.base);
    this.right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const damages = new Map<Enemy, number>();
    let hitPoint: THREE.Vector3 | null = null;
    const objects = [...this.arena.world, ...this.enemies.targets];
    this.camera.updateMatrixWorld();
    this.model.getWorldPosition(this.start);
    this.start.addScaledVector(this.base, 0.5);
    for (let p = 0; p < w.pellets; p++) {
      const angle = Math.random() * Math.PI * 2,
        radius = Math.sqrt(Math.random()) * w.spread;
      this.direction
        .copy(this.base)
        .addScaledVector(this.right, Math.cos(angle) * radius)
        .addScaledVector(this.up, Math.sin(angle) * radius)
        .normalize();
      this.ray.set(this.camera.position, this.direction);
      this.ray.far = w.range;
      const result = this.ray
        .intersectObjects(objects, false)
        .find(
          (hit) =>
            !(hit.object.userData.enemy?.hp <= 0) &&
            (!hit.object.userData.weak || hit.object.visible),
        );
      this.endpoint.copy(this.camera.position).addScaledVector(this.direction, w.range);
      if (result) {
        this.endpoint.copy(result.point);
        const enemy = result.object.userData.enemy as Enemy | undefined;
        if (enemy) {
          let dealt = w.damage;
          if (w.pellets > 1) dealt *= Math.max(0.3, 1 - (result.distance / w.range) * 0.55);
          if (result.object.userData.weak && enemy.weakOpen) dealt *= TUNING.weakMultiplier;
          damages.set(enemy, (damages.get(enemy) ?? 0) + dealt);
          hitPoint = result.point.clone();
        } else this.effects.burst(result.point, 0x7fd4e8, 2);
      }
      if (p < 3) this.effects.tracer(this.start, this.endpoint, w.color);
    }
    if (damages.size) {
      run.hits++;
      let killed = false,
        total = 0;
      for (const [enemy, amount] of damages) {
        total += amount;
        killed = this.enemies.hurt(enemy, amount) || killed;
      }
      this.onHit(killed, Math.round(total), hitPoint!);
      this.sound.hit(killed);
    }
  }
  update(dt: number, run: Run, moving: boolean, settings: Settings) {
    if (run.reloadRemaining > 0) {
      run.reloadRemaining -= dt;
      if (run.reloadRemaining <= 0) {
        run.ammo[run.weapon] = reloadAmmo(run.ammo[run.weapon], WEAPONS[run.weapon].mag);
        run.reloadRemaining = 0;
        this.sound.tone(300, 0.07, 0.05, 'triangle');
      }
    }
    this.switchTime = Math.max(0, this.switchTime - dt);
    this.recoil = Math.max(0, this.recoil - dt * 10);
    this.flash.visible = this.flash.visible && this.recoil > 0.7;
    const reload =
      run.reloadRemaining > 0
        ? Math.sin((run.reloadRemaining / WEAPONS[run.weapon].reload) * Math.PI)
        : 0;
    this.model.position.set(
      0.31,
      -0.3 - reload * 0.25 - this.switchTime * 0.7,
      -0.55 + this.recoil * 0.11,
    );
    this.model.rotation.set(-this.recoil * 0.09 - reload * 0.55, 0, reload * -0.3);
    if (moving && !settings.reduced) {
      this.model.position.x += Math.sin(run.elapsed * 9) * 0.015;
      this.model.position.y += Math.sin(run.elapsed * 18) * 0.013;
    }
  }
  reset(run: Run) {
    this.recoil = this.switchTime = 0;
    this.flash.visible = false;
    this.models.forEach((m, i) => (m.visible = i === run.weapon));
  }
  dispose() {
    this.flash.geometry.dispose();
    (this.flash.material as THREE.Material).dispose();
  }
}
