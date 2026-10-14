import * as THREE from 'three';
interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  max: number;
}
export class Effects {
  private particles: Particle[] = [];
  private cursor = 0;
  private traces: { line: THREE.Line; life: number }[] = [];
  private traceCursor = 0;
  constructor(scene: THREE.Scene) {
    const geometry = new THREE.BoxGeometry(0.055, 0.055, 0.055);
    for (let i = 0; i < 180; i++) {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: 0xffbc68, transparent: true }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.particles.push({ mesh, velocity: new THREE.Vector3(), life: 0, max: 0 });
    }
    for (let i = 0; i < 32; i++) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x81eaff, transparent: true, opacity: 0.55 }),
      );
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      this.traces.push({ line, life: 0 });
    }
  }
  burst(position: THREE.Vector3, color = 0xffbb55, count = 8) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.cursor++ % this.particles.length];
      p.mesh.position.copy(position);
      p.mesh.visible = true;
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      p.velocity.set((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5);
      p.life = p.max = 0.2 + Math.random() * 0.3;
    }
  }
  tracer(from: THREE.Vector3, to: THREE.Vector3, color: number) {
    const t = this.traces[this.traceCursor++ % this.traces.length],
      positions = t.line.geometry.attributes.position;
    positions.setXYZ(0, from.x, from.y, from.z);
    positions.setXYZ(1, to.x, to.y, to.z);
    positions.needsUpdate = true;
    (t.line.material as THREE.LineBasicMaterial).color.setHex(color);
    t.line.visible = true;
    t.life = 0.055;
  }
  update(dt: number) {
    for (const p of this.particles)
      if (p.life > 0) {
        p.life -= dt;
        if (p.life <= 0) {
          p.mesh.visible = false;
          continue;
        }
        p.velocity.y -= dt * 10;
        p.mesh.position.addScaledVector(p.velocity, dt);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.life / p.max;
      }
    for (const t of this.traces)
      if (t.life > 0) {
        t.life -= dt;
        if (t.life <= 0) t.line.visible = false;
      }
  }
  reset() {
    for (const p of this.particles) {
      p.life = 0;
      p.mesh.visible = false;
    }
    for (const t of this.traces) {
      t.life = 0;
      t.line.visible = false;
    }
  }
  dispose() {
    const geometry = this.particles[0].mesh.geometry;
    geometry.dispose();
    this.particles.forEach((p) => (p.mesh.material as THREE.Material).dispose());
    this.traces.forEach((t) => {
      t.line.geometry.dispose();
      (t.line.material as THREE.Material).dispose();
    });
  }
}
