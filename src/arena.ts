import * as THREE from 'three';
export interface Obstacle {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}
const geometries = new Map<string, THREE.BufferGeometry>(),
  materials = new Map<string, THREE.MeshStandardMaterial>();
export function boxGeo(w: number, h: number, d: number) {
  const key = `${w},${h},${d}`;
  if (!geometries.has(key)) geometries.set(key, new THREE.BoxGeometry(w, h, d));
  return geometries.get(key)!;
}
export function material(color: number, emissive = 0, intensity = 1, metalness = 0.65) {
  const key = `${color},${emissive},${intensity},${metalness}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: intensity,
        roughness: 0.55,
        metalness,
      }),
    );
  return materials.get(key)!;
}
export function box(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color = 0x202e3a,
  glow = 0,
  intensity = 1,
) {
  const mesh = new THREE.Mesh(boxGeo(w, h, d), material(color, glow, intensity));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
export class Arena {
  group = new THREE.Group();
  world: THREE.Object3D[] = [];
  obstacles: Obstacle[] = [];
  rotor = new THREE.Group();
  rings: THREE.Mesh[] = [];
  private clock = 0;
  private atmosphere: THREE.Points;
  constructor(public scene: THREE.Scene) {
    scene.add(this.group);
    scene.background = new THREE.Color(0x07101d);
    scene.fog = new THREE.FogExp2(0x0b1523, 0.014);
    scene.add(new THREE.HemisphereLight(0x9dcfe5, 0x172130, 2.1));
    const moon = new THREE.DirectionalLight(0xb1d9ff, 2.5);
    moon.position.set(-12, 30, 15);
    scene.add(moon);
    for (const [x, z, c] of [
      [0, 0, 0x17daff],
      [-17, -16, 0x23e6ff],
      [17, 16, 0xff3377],
    ] as const) {
      const light = new THREE.PointLight(c, 70, 24, 2);
      light.position.set(x, 4, z);
      scene.add(light);
    }
    const floor = box(this.group, 0, -0.22, 0, 48, 0.4, 48, 0x152332);
    this.world.push(floor);
    for (let i = -24; i <= 24; i += 4) {
      box(this.group, i, 0.003, 0, 0.018, 0.012, 48, 0x365161);
      box(this.group, 0, 0.003, i, 48, 0.012, 0.018, 0x365161);
    }
    for (const s of [-1, 1]) {
      this.solid(0, s * 24, 48, 1, 6, 0x182733);
      this.solid(s * 24, 0, 1, 48, 6, 0x182733);
      for (let i = -20; i <= 20; i += 8) {
        box(this.group, i, 3, s * 23.44, 0.12, 5, 0.15, 0x319da7, 0x12b6cb, 1.4);
        box(this.group, s * 23.44, 3, i, 0.15, 5, 0.12, 0x319da7, 0x12b6cb, 1.4);
      }
      box(this.group, 0, 0.025, s * 22, 44, 0.04, 0.1, 0x52f9ff, 0x13dbff, 2);
      box(this.group, s * 22, 0.025, 0, 0.1, 0.04, 44, 0x52f9ff, 0x13dbff, 2);
      for (const z of [-10, 10])
        box(this.group, s * 5, 0.028, z, 10, 0.04, 0.12, 0x42d9e8, 0x15b5cb, 1.3);
    }
    // The reactor is a readable physical obstacle and the arena's central landmark.
    this.solid(0, 0, 5, 5, 1.1, 0x273b4a);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 1, 8), material(0x283d4d));
    pedestal.position.y = 0.8;
    this.group.add(pedestal);
    this.world.push(pedestal);
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 6, 12),
      material(0x69f5ff, 0x21d5ec, 2.5),
    );
    core.position.y = 4;
    this.group.add(core);
    this.world.push(core);
    this.group.add(this.rotor);
    this.rotor.position.y = 4;
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.8 + i * 0.28, 0.07, 8, 48),
        material(0xa1fcff, 0x2bcff0, 2),
      );
      ring.rotation.x = Math.PI / 2 + (i - 1) * 0.4;
      ring.position.y = (i - 1) * 1.4;
      this.rotor.add(ring);
      this.rings.push(ring);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      box(this.group, Math.cos(a) * 2, 4, Math.sin(a) * 2, 0.4, 7, 0.4, 0x223846);
    }
    box(this.group, 0, 7.4, 0, 5, 0.6, 5, 0x263d4c);
    this.label('REACTOR // 07', 0, 7.9, 0, 5, 1);
    // Containers, pylons and low barriers form two loops around the reactor.
    for (const [x, z, rot, c] of [
      [-11, -9, 0, 0x245566],
      [12, 8, 0, 0x4a334b],
      [-13, 11, 1, 0x314955],
      [13, -12, 1, 0x254e5e],
    ] as const) {
      const w = rot ? 3.4 : 7,
        d = rot ? 7 : 3.4;
      this.solid(x, z, w, d, 3.2, c);
      for (let i = -3; i <= 3; i++)
        rot
          ? box(this.group, x + w / 2 + 0.015, 1.6, z + i, 0.05, 2.9, 0.06, 0x5c7182)
          : box(this.group, x + i, 1.6, z + d / 2 + 0.015, 0.06, 2.9, 0.05, 0x5c7182);
      box(this.group, x, 3.22, z, w, 0.045, d, 0x365769);
      box(this.group, x, 3.3, z, w + 0.1, 0.06, 0.08, 0x65ebf2, 0x16b3c9, 1.6);
      this.label(rot ? 'SECTOR 03' : 'FREIGHT / 04', x, 2.5, z + d / 2 + 0.035, rot ? 2.9 : 5, 0.6);
    }
    for (const [x, z] of [
      [-6, 13],
      [6, -13],
      [-17, -2],
      [17, 2],
    ]) {
      this.solid(x, z, 4, 1, 1.25, 0x3b4a57);
      box(this.group, x, 1.29, z, 3.8, 0.07, 0.8, 0xeabb62, 0xb7792c, 0.65);
    }
    for (const [x, z] of [
      [-8, -18],
      [8, 18],
      [-19, 18],
      [19, -18],
    ]) {
      this.solid(x, z, 1.4, 1.4, 7, 0x2c3f4d);
      box(this.group, x, 4, z + 0.72, 0.15, 5, 0.035, 0x56dff6, 0x21c7eb, 1.7);
    }
    // Unreachable structures sit beyond the enclosing walls.
    for (let i = 0; i < 16; i++) {
      const x = ((i % 8) - 3.5) * 9,
        z = i < 8 ? -33 : 33,
        height = 8 + ((i * 7) % 13);
      box(this.group, x, height / 2, z, 6, height, 7, 0x12202d);
      for (let y = 3; y < height; y += 3)
        box(this.group, x, y, z + (i < 8 ? 3.51 : -3.51), 4, 0.09, 0.035, 0x51808a, 0x1b697d, 0.8);
    }
    for (const s of [-1, 1]) {
      box(this.group, s * 23, 9, 0, 1.5, 0.8, 49, 0x243b4b);
      box(this.group, 0, 9, s * 23, 49, 0.8, 1.5, 0x243b4b);
    }
    this.label('NEON SIEGE', 0, 4.5, -23.4, 13, 2.4);
    this.label('07 // CONTAINMENT', -23.4, 4.5, 0, 11, 1.6, Math.PI / 2);
    this.label('NO SIGNAL · NO SURRENDER', 0, 3, 23.4, 12, 1, Math.PI);
    const data = new Float32Array(120 * 3);
    for (let i = 0; i < 120; i++) {
      data[i * 3] = (Math.random() - 0.5) * 46;
      data[i * 3 + 1] = 2 + Math.random() * 12;
      data[i * 3 + 2] = (Math.random() - 0.5) * 46;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data, 3));
    this.atmosphere = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0x7bcdde,
        size: 0.035,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.group.add(this.atmosphere);
  }
  solid(x: number, z: number, w: number, d: number, h: number, c: number) {
    this.obstacles.push({ x, z, w, d, h });
    this.world.push(box(this.group, x, h / 2, z, w, h, d, c));
  }
  label(text: string, x: number, y: number, z: number, w: number, h: number, rotation = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#102534';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = '#368692';
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, 1000, 232);
    ctx.fillStyle = '#9adcdf';
    ctx.font = 'bold 60px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    this.group.add(mesh);
  }
  blocked(x: number, z: number, r: number, y = 0) {
    return this.obstacles.some(
      (o) =>
        y < o.h &&
        x + r > o.x - o.w / 2 &&
        x - r < o.x + o.w / 2 &&
        z + r > o.z - o.d / 2 &&
        z - r < o.z + o.d / 2,
    );
  }
  move(position: THREE.Vector3, dx: number, dz: number, r: number, y = 0) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.15));
    for (let i = 0; i < steps; i++) {
      if (!this.blocked(position.x + dx / steps, position.z, r, y)) position.x += dx / steps;
      if (!this.blocked(position.x, position.z + dz / steps, r, y)) position.z += dz / steps;
    }
  }
  update(dt: number, reduced: boolean) {
    this.clock += dt;
    if (!reduced) {
      this.rotor.rotation.y += dt * 0.28;
      this.rings.forEach((r, i) => (r.rotation.z += dt * (i % 2 ? -0.2 : 0.2)));
      this.atmosphere.rotation.y += dt * 0.008;
    }
  }
  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh && ![...geometries.values()].includes(o.geometry)) {
        o.geometry.dispose();
        if (o.material instanceof THREE.MeshBasicMaterial) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      }
    });
    this.atmosphere.geometry.dispose();
    (this.atmosphere.material as THREE.Material).dispose();
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }
}
