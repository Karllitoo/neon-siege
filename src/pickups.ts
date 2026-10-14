import * as THREE from 'three';
import { material } from './arena';
import type { Run } from './core';
import { Sound } from './audio';
export type PickupKind = 'health' | 'shield' | 'rifle' | 'shotgun';
const colors = { health: 0x89ffab, shield: 0x67e6ff, rifle: 0x59ffcf, shotgun: 0xffcb75 };
interface Pickup {
  group: THREE.Group;
  kind: PickupKind;
  life: number;
  phase: number;
}
export class Pickups {
  items: Pickup[] = [];
  geometries = {
    health: new THREE.BoxGeometry(0.16, 0.55, 0.16),
    shield: new THREE.OctahedronGeometry(0.33),
    rifle: new THREE.BoxGeometry(0.35, 0.4, 0.25),
    shotgun: new THREE.CylinderGeometry(0.15, 0.15, 0.4, 8),
  };
  onPickup = (text: string) => {};
  constructor(
    public scene: THREE.Scene,
    public sound: Sound,
  ) {}
  add(kind: PickupKind, position: THREE.Vector3) {
    if (this.items.length >= 20) this.remove(this.items[0]);
    const group = new THREE.Group();
    group.position.copy(position).setY(0.75);
    const mat = material(colors[kind], colors[kind], 0.65);
    group.add(new THREE.Mesh(this.geometries[kind], mat));
    if (kind === 'health') {
      const cross = new THREE.Mesh(this.geometries.health, mat);
      cross.rotation.z = Math.PI / 2;
      group.add(cross);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.025, 6, 20), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.45;
    group.add(ring);
    if (kind === 'rifle' || kind === 'shotgun') {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.3), material(0x102332));
      group.add(stripe);
    }
    this.scene.add(group);
    this.items.push({ group, kind, life: 45, phase: Math.random() * 6 });
  }
  update(dt: number, position: THREE.Vector3, run: Run, reduced: boolean) {
    for (const p of [...this.items]) {
      p.life -= dt;
      p.phase += dt;
      if (!reduced) {
        p.group.rotation.y += dt;
        p.group.position.y = 0.75 + Math.sin(p.phase * 2) * 0.1;
      }
      if (p.life <= 0) {
        this.remove(p);
        continue;
      }
      if (Math.hypot(position.x - p.group.position.x, position.z - p.group.position.z) < 1.1) {
        let used = true;
        let text = '';
        switch (p.kind) {
          case 'health':
            used = run.health < 100;
            run.health = Math.min(100, run.health + 30);
            text = '+30 HEALTH';
            break;
          case 'shield':
            used = run.shield < 50;
            run.shield = Math.min(50, run.shield + 25);
            text = '+25 SHIELD';
            break;
          case 'rifle':
            run.ammo[1].reserve = Math.min(300, run.ammo[1].reserve + 45);
            text = '+45 ARC AMMO';
            break;
          case 'shotgun':
            run.ammo[2].reserve = Math.min(72, run.ammo[2].reserve + 12);
            text = '+12 SHELLS';
            break;
        }
        if (used) {
          this.remove(p);
          this.sound.pickup();
          this.onPickup(text);
        }
      }
    }
  }
  private remove(p: Pickup) {
    this.scene.remove(p.group);
    p.group.traverse((o) => {
      if (
        o instanceof THREE.Mesh &&
        !Object.values(this.geometries).includes(o.geometry as typeof this.geometries.health)
      )
        o.geometry.dispose();
    });
    this.items = this.items.filter((i) => i !== p);
  }
  reset() {
    for (const p of [...this.items]) this.remove(p);
  }
  dispose() {
    this.reset();
    Object.values(this.geometries).forEach((g) => g.dispose());
  }
}
