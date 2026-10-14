import * as THREE from 'three';
import { type Difficulty, DIFFICULTIES, TUNING } from './config';
import { waveComplete, waveRoster, type Run } from './core';
import { Enemies, type EnemyKind } from './enemies';
import { Arena } from './arena';
import { Pickups } from './pickups';
const spawnPoints = [
  [-20, -20],
  [20, -20],
  [-20, 20],
  [20, 20],
  [0, -20],
  [-20, 0],
  [20, 0],
  [0, 20],
];
export class Waves {
  queue: EnemyKind[] = [];
  preparation = TUNING.firstPrepareTime;
  active = false;
  spawnTimer = 0;
  onAnnouncement = (title: string, subtitle: string) => {};
  onComplete = () => {};
  constructor(
    public enemies: Enemies,
    public arena: Arena,
    public pickups: Pickups,
  ) {}
  get remaining() {
    return this.queue.length + this.enemies.active.length;
  }
  reset() {
    this.queue = [];
    this.preparation = TUNING.firstPrepareTime;
    this.active = false;
    this.spawnTimer = 0;
  }
  update(dt: number, run: Run, player: THREE.Vector3, difficulty: Difficulty) {
    if (!this.active) {
      this.preparation -= dt;
      if (this.preparation <= 0) {
        run.wave++;
        this.queue = waveRoster(run.wave, DIFFICULTIES[difficulty].count) as EnemyKind[];
        this.active = true;
        this.spawnTimer = 0;
        this.onAnnouncement(
          run.wave % 5 === 0 ? 'THE OVERSEER' : `WAVE ${String(run.wave).padStart(2, '0')}`,
          run.wave % 5 === 0 ? 'WEAK POINT OPENS FOR 3s · 2.5× DAMAGE' : 'HOSTILE SIGNAL DETECTED',
        );
      }
      return;
    }
    this.spawnTimer -= dt;
    if (
      this.queue.length &&
      this.enemies.active.length < TUNING.maxEnemies &&
      this.spawnTimer <= 0
    ) {
      const points = spawnPoints
        .map((p) => new THREE.Vector3(p[0], 0, p[1]))
        .filter((p) => p.distanceTo(player) > 10 && !this.arena.blocked(p.x, p.z, 1.3));
      const point = points[Math.floor(Math.random() * points.length)];
      if (point) {
        if (this.enemies.spawn(this.queue[0], point, run.wave)) this.queue.shift();
        this.spawnTimer = run.wave === 1 ? 1.2 : 0.65;
      }
    }
    if (waveComplete(this.queue.length, this.enemies.active.length)) {
      this.active = false;
      this.preparation = TUNING.prepareTime;
      run.score += run.wave * 250;
      this.enemies.clearAttacks();
      this.onComplete();
      this.onAnnouncement(
        `WAVE ${String(run.wave).padStart(2, '0')} CLEAR`,
        `+${run.wave * 250} POINTS · RESUPPLY & REPOSITION`,
      );
      for (const [kind, x, z] of [
        ['health', -5, 6],
        ['shield', 5, 6],
        ['rifle', -5, -6],
        ['shotgun', 5, -6],
      ] as const)
        this.pickups.add(kind, new THREE.Vector3(x, 0, z));
    }
  }
}
