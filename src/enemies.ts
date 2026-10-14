import * as THREE from 'three';
import { Arena, box, material } from './arena';
import { Navigation } from './navigation';
import { TUNING, DIFFICULTIES, type Difficulty } from './config';
import { Effects } from './effects';
import { Sound } from './audio';
export type EnemyKind = 'chaser' | 'sentinel' | 'heavy' | 'boss';
const STATS = {
  chaser: { hp: 60, speed: 3.2, range: 1.7, damage: 12, points: 100, radius: 0.48 },
  sentinel: { hp: 110, speed: 2, range: 14, damage: 12, points: 180, radius: 0.5 },
  heavy: { hp: 250, speed: 1.2, range: 17, damage: 23, points: 350, radius: 0.75 },
  boss: { hp: 1350, speed: 1.05, range: 25, damage: 24, points: 2500, radius: 1.2 },
};
export interface Enemy {
  id: number;
  kind: EnemyKind;
  group: THREE.Group;
  hp: number;
  maxHp: number;
  cooldown: number;
  path: THREE.Vector3[];
  pathTime: number;
  flash: number;
  age: number;
  phase: number;
  summons: number;
  summoned: boolean;
  weak: THREE.Mesh | null;
  weakOpen: boolean;
}
interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  damage: number;
}
interface Area {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  remaining: number;
}
export class Enemies {
  active: Enemy[] = [];
  targets: THREE.Object3D[] = [];
  projectiles: Projectile[] = [];
  areas: Area[] = [];
  private nextId = 1;
  private ray = new THREE.Raycaster();
  private direction = new THREE.Vector3();
  private delta = new THREE.Vector3();
  private goal = new THREE.Vector3();
  private timer = 0;
  onDamage = (amount: number, origin: THREE.Vector3) => {};
  onKill = (enemy: Enemy) => {};
  constructor(
    public scene: THREE.Scene,
    public arena: Arena,
    public nav: Navigation,
    public effects: Effects,
    public sound: Sound,
  ) {
    const geometry = new THREE.SphereGeometry(0.14, 6, 4),
      mat = new THREE.MeshBasicMaterial({ color: 0xff567e });
    for (let i = 0; i < TUNING.maxProjectiles; i++) {
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.projectiles.push({ mesh, velocity: new THREE.Vector3(), life: 0, damage: 0 });
    }
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.05, 4, 64),
        new THREE.MeshBasicMaterial({
          color: 0xff456e,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.04;
      mesh.visible = false;
      scene.add(mesh);
      this.areas.push({ mesh, position: new THREE.Vector3(), remaining: 0 });
    }
  }
  spawn(kind: EnemyKind, position: THREE.Vector3, wave: number, summoned = false) {
    if (this.active.length >= TUNING.maxEnemies) return false;
    const stats = STATS[kind],
      group = new THREE.Group();
    group.position.copy(position);
    const hp = stats.hp * (1 + Math.min(0.8, (wave - 1) * 0.035));
    const enemy: Enemy = {
      id: this.nextId++,
      kind,
      group,
      hp,
      maxHp: hp,
      cooldown: 1.3 + Math.random(),
      path: [],
      pathTime: Math.random(),
      flash: 0,
      age: 0,
      phase: 5,
      summons: 0,
      summoned,
      weak: null,
      weakOpen: false,
    };
    const accent =
      kind === 'chaser'
        ? 0xff407c
        : kind === 'sentinel'
          ? 0xf06cff
          : kind === 'heavy'
            ? 0xff9956
            : 0xff335f;
    const size = kind === 'boss' ? 2.2 : kind === 'heavy' ? 1.4 : 1;
    box(group, 0, 1.1 * size, 0, 0.8 * size, 0.8 * size, 0.5 * size, 0x334250);
    box(group, 0, 1.72 * size, 0, 0.62 * size, 0.42 * size, 0.56 * size, 0x46586b);
    box(group, 0, 1.76 * size, 0.295 * size, 0.48 * size, 0.12 * size, 0.045, accent, accent, 1.3);
    box(group, 0, 1.15 * size, 0.27 * size, 0.32 * size, 0.22 * size, 0.06, accent, accent, 0.75);
    for (const side of [-1, 1]) {
      const leg = box(
        group,
        side * 0.25 * size,
        0.4 * size,
        0,
        0.24 * size,
        0.75 * size,
        0.26 * size,
        0x273946,
      );
      leg.userData.leg = side;
      box(
        group,
        side * 0.28 * size,
        0.12 * size,
        0.1,
        0.3 * size,
        0.22 * size,
        0.48 * size,
        0x354b58,
      );
      box(
        group,
        side * 0.59 * size,
        1.18 * size,
        0,
        0.29 * size,
        0.75 * size,
        0.32 * size,
        0x485a69,
      );
      box(
        group,
        side * 0.62 * size,
        1.6 * size,
        0,
        0.4 * size,
        0.18 * size,
        0.42 * size,
        accent,
        accent,
        0.35,
      );
      if (kind !== 'chaser')
        box(
          group,
          side * 0.6 * size,
          0.98 * size,
          0.34 * size,
          0.23 * size,
          0.27 * size,
          0.9 * size,
          0x223644,
        );
    }
    if (kind === 'chaser') {
      for (const side of [-1, 1])
        box(group, side * 0.6, 0.74, 0.5, 0.1, 0.4, 0.8, 0x84d3de, accent, 0.6);
    }
    if (kind === 'boss') {
      for (const side of [-1, 1]) {
        box(group, side * 1.65, 3.45, 0, 0.65, 0.9, 0.8, 0x425260);
        box(group, side * 1.65, 3.6, 0.42, 0.45, 0.35, 0.08, accent, accent, 1);
      }
      enemy.weak = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 12, 8),
        material(0x44f9ed, 0x22ffed, 2),
      );
      enemy.weak.position.set(0, 2.5, 0.72);
      group.add(enemy.weak);
      enemy.weak.userData.weak = true;
      box(group, 0, 4.7, 0, 1.6, 0.2, 0.7, 0x6a5161, accent, 0.5);
    }
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.userData.enemy = enemy;
        this.targets.push(obj);
      }
    });
    this.scene.add(group);
    this.active.push(enemy);
    return true;
  }
  lineOfSight(from: THREE.Vector3, to: THREE.Vector3) {
    this.direction.subVectors(to, from);
    const distance = this.direction.length();
    if (distance < 0.01) return true;
    this.ray.set(from, this.direction.normalize());
    this.ray.far = distance;
    return this.ray.intersectObjects(this.arena.world, false).length === 0;
  }
  shoot(from: THREE.Vector3, to: THREE.Vector3, damage: number, speed = 9) {
    const p = this.projectiles.find((p) => p.life <= 0);
    if (!p) return;
    p.mesh.position.copy(from);
    p.velocity.subVectors(to, from).normalize().multiplyScalar(speed);
    p.life = 6;
    p.damage = damage;
    p.mesh.visible = true;
  }
  hurt(enemy: Enemy, amount: number) {
    if (enemy.hp <= 0) return false;
    enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.flash = 0.16;
    this.effects.burst(enemy.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffc463, 5);
    if (enemy.hp === 0) {
      this.remove(enemy);
      this.onKill(enemy);
      if (enemy.kind === 'boss') {
        for (const minion of [...this.active]) if (minion.summoned) this.remove(minion);
        this.clearAttacks();
      }
      return true;
    }
    return false;
  }
  remove(enemy: Enemy) {
    this.scene.remove(enemy.group);
    this.active = this.active.filter((e) => e !== enemy);
    this.targets = this.targets.filter((obj) => obj.userData.enemy !== enemy);
    enemy.group.traverse((o) => {
      if (o instanceof THREE.Mesh && o.geometry instanceof THREE.SphereGeometry)
        o.geometry.dispose();
    });
  }
  update(
    dt: number,
    player: THREE.Vector3,
    eye: THREE.Vector3,
    wave: number,
    difficulty: Difficulty,
    reduced: boolean,
  ) {
    this.timer += dt;
    const scale = DIFFICULTIES[difficulty],
      strength = scale.damage * (1 + Math.min(0.65, (wave - 1) * 0.025));
    let searches = 0;
    for (const e of this.active) {
      const st = STATS[e.kind],
        position = e.group.position;
      const distance = position.distanceTo(player);
      e.age += dt;
      e.cooldown -= dt;
      e.pathTime -= dt;
      if (e.pathTime <= 0 && searches < 2) {
        e.pathTime = 0.9 + Math.random() * 0.65;
        e.path = this.nav.path(position, player);
        searches++;
      }
      const desired = e.kind === 'chaser' ? 1.15 : e.kind === 'boss' ? 10 : 8;
      if (
        distance > desired ||
        (e.kind !== 'chaser' &&
          !this.lineOfSight(this.goal.copy(position).setY(e.kind === 'boss' ? 3 : 1.5), eye))
      ) {
        while (e.path.length && e.path[0].distanceTo(position) < 0.65) e.path.shift();
        if (e.path.length) {
          this.delta.subVectors(e.path[0], position);
          this.delta.y = 0;
          this.delta.normalize().multiplyScalar(st.speed * scale.speed * dt);
          this.arena.move(position, this.delta.x, this.delta.z, st.radius);
        }
      }
      // Separation prevents robot piles, including robots sharing a nav cell.
      for (const other of this.active)
        if (other !== e) {
          this.delta.subVectors(position, other.group.position);
          this.delta.y = 0;
          const length = this.delta.length(),
            minimum = st.radius + STATS[other.kind].radius + 0.12;
          if (length > 0 && length < minimum) {
            this.delta.multiplyScalar(((minimum - length) * dt * 2) / length);
            this.arena.move(position, this.delta.x, this.delta.z, st.radius);
          }
        }
      e.group.rotation.y = Math.atan2(player.x - position.x, player.z - position.z);
      if (!reduced)
        e.group.children.forEach((o) => {
          if (o.userData.leg) o.rotation.x = Math.sin(e.age * st.speed * 3) * 0.22 * o.userData.leg;
        });
      e.flash = Math.max(0, e.flash - dt);
      e.group.scale.setScalar(e.flash > 0 ? 1.025 : 1);
      if (e.kind === 'chaser') {
        if (distance < st.range && Math.abs(player.y) < 1.3 && e.cooldown <= 0) {
          this.onDamage(st.damage * strength, position);
          e.cooldown = 1.2;
          this.sound.tone(170, 0.09, 0.05, 'triangle');
        }
      } else {
        this.goal.copy(position).setY(e.kind === 'boss' ? 3.1 : 1.55);
        if (distance < st.range && e.cooldown <= 0 && this.lineOfSight(this.goal, eye)) {
          if (e.kind === 'boss') {
            for (let i = -1; i <= 1; i++) {
              this.delta.copy(eye);
              this.delta.x += i * 1.4;
              this.shoot(this.goal, this.delta, st.damage * strength, 8);
            }
            e.cooldown = 2.8;
            this.sound.tone(110, 0.2, 0.1, 'sawtooth');
          } else {
            this.shoot(this.goal, eye, st.damage * strength, e.kind === 'heavy' ? 7 : 10);
            e.cooldown = e.kind === 'heavy' ? 2.8 : 2.1;
            this.sound.tone(250, 0.1, 0.035, 'triangle');
          }
        }
      }
      if (e.kind === 'boss') {
        e.phase -= dt;
        e.weakOpen = e.age % 8 < 3;
        if (e.weak) {
          e.weak.visible = e.weakOpen;
        }
        if (e.phase <= 0) {
          const area = this.areas.find((a) => a.remaining <= 0);
          if (area) {
            area.position.copy(player);
            area.position.y = 0.045;
            area.mesh.position.copy(area.position);
            area.mesh.visible = true;
            area.remaining = 2.5;
            this.sound.warning();
          }
          e.phase = 8;
          if (e.summons < 3 && this.active.length < TUNING.maxEnemies) {
            this.delta.copy(position);
            this.delta.x += 3;
            if (!this.arena.blocked(this.delta.x, this.delta.z, 0.5)) {
              this.spawn('chaser', this.delta, wave, true);
              e.summons++;
            }
          }
        }
      }
    }
    // Swept projectile collisions prevent tunnelling even when a frame stalls.
    for (const p of this.projectiles)
      if (p.life > 0) {
        p.life -= dt;
        this.direction.copy(p.velocity).normalize();
        const travel = p.velocity.length() * dt;
        this.ray.set(p.mesh.position, this.direction);
        this.ray.far = travel + 0.15;
        const obstructed = this.ray.intersectObjects(this.arena.world, false).length > 0;
        this.delta.copy(eye).sub(p.mesh.position);
        const along = THREE.MathUtils.clamp(this.delta.dot(this.direction), 0, travel);
        this.goal.copy(p.mesh.position).addScaledVector(this.direction, along);
        const hit = this.goal.distanceTo(eye) < 0.62;
        if (obstructed || hit || p.life <= 0) {
          if (hit && !obstructed) this.onDamage(p.damage, p.mesh.position);
          this.effects.burst(p.mesh.position, 0xff6389, 3);
          p.life = 0;
          p.mesh.visible = false;
        } else p.mesh.position.addScaledVector(p.velocity, dt);
      }
    for (const a of this.areas)
      if (a.remaining > 0) {
        a.remaining -= dt;
        (a.mesh.material as THREE.MeshBasicMaterial).opacity = 0.18 + (1 - a.remaining / 2.5) * 0.3;
        if (a.remaining <= 0) {
          a.mesh.visible = false;
          this.effects.burst(a.position, 0xff557e, 28);
          if (Math.hypot(player.x - a.position.x, player.z - a.position.z) < 4 && player.y < 1.6)
            this.onDamage(45 * strength, a.position);
        }
      }
  }
  clearAttacks() {
    for (const p of this.projectiles) {
      p.life = 0;
      p.mesh.visible = false;
    }
    for (const a of this.areas) {
      a.remaining = 0;
      a.mesh.visible = false;
    }
  }
  reset() {
    for (const e of [...this.active]) this.remove(e);
    this.clearAttacks();
    this.nextId = 1;
    this.timer = 0;
  }
  dispose() {
    this.reset();
    this.projectiles[0].mesh.geometry.dispose();
    (this.projectiles[0].mesh.material as THREE.Material).dispose();
    this.areas.forEach((a) => {
      a.mesh.geometry.dispose();
      (a.mesh.material as THREE.Material).dispose();
    });
  }
}
export function enemyPoints(e: Enemy) {
  return STATS[e.kind].points;
}
