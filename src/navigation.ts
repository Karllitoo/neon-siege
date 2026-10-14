import { Arena } from './arena';
import * as THREE from 'three';
// Static occupancy plus A*: enemy searches are staggered by the enemy manager.
export class Navigation {
  size = 47;
  offset = 23;
  walk = new Uint8Array(47 * 47);
  private costs = new Float32Array(47 * 47);
  private parents = new Int32Array(47 * 47);
  private closed = new Uint8Array(47 * 47);
  constructor(arena: Arena) {
    for (let z = 0; z < this.size; z++)
      for (let x = 0; x < this.size; x++)
        this.walk[z * this.size + x] = arena.blocked(x - this.offset, z - this.offset, 0.7) ? 0 : 1;
  }
  cell(x: number, z: number) {
    return (
      Math.min(46, Math.max(0, Math.round(z) + this.offset)) * this.size +
      Math.min(46, Math.max(0, Math.round(x) + this.offset))
    );
  }
  path(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    const start = this.cell(from.x, from.z);
    let goal = this.cell(to.x, to.z);
    // Player clearance is smaller than the grid clearance. Target a nearby
    // walkable cell when the player hugs cover, rather than losing the path.
    if (!this.walk[goal]) {
      let nearest = -1,
        bestDistance = Infinity;
      const gx = goal % this.size,
        gz = Math.floor(goal / this.size);
      for (let dz = -3; dz <= 3; dz++)
        for (let dx = -3; dx <= 3; dx++) {
          const x = gx + dx,
            z = gz + dz;
          if (x < 0 || z < 0 || x >= this.size || z >= this.size) continue;
          const candidate = z * this.size + x;
          const distance = (x - this.offset - to.x) ** 2 + (z - this.offset - to.z) ** 2;
          if (this.walk[candidate] && distance < bestDistance) {
            nearest = candidate;
            bestDistance = distance;
          }
        }
      if (nearest < 0) return [];
      goal = nearest;
    }
    this.costs.fill(Infinity);
    this.parents.fill(-1);
    this.closed.fill(0);
    this.costs[start] = 0;
    const open = [start];
    let visits = 0;
    const heuristic = (n: number) =>
      Math.abs((n % this.size) - (goal % this.size)) +
      Math.abs(Math.floor(n / this.size) - Math.floor(goal / this.size));
    while (open.length && visits++ < 2000) {
      let best = 0;
      for (let i = 1; i < open.length; i++)
        if (
          this.costs[open[i]] + heuristic(open[i]) <
          this.costs[open[best]] + heuristic(open[best])
        )
          best = i;
      const node = open.splice(best, 1)[0];
      if (node === goal) {
        const path: THREE.Vector3[] = [];
        let n = goal;
        while (n !== start && n >= 0) {
          path.push(
            new THREE.Vector3(
              (n % this.size) - this.offset,
              0,
              Math.floor(n / this.size) - this.offset,
            ),
          );
          n = this.parents[n];
        }
        return path.reverse();
      }
      this.closed[node] = 1;
      const x = node % this.size,
        z = Math.floor(node / this.size);
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= this.size || nz >= this.size) continue;
        const n = nz * this.size + nx;
        if (!this.walk[n] || this.closed[n]) continue;
        const cost = this.costs[node] + 1;
        if (cost < this.costs[n]) {
          this.costs[n] = cost;
          this.parents[n] = node;
          if (!open.includes(n)) open.push(n);
        }
      }
    }
    return [];
  }
}
