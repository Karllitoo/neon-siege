import { WEAPONS, TUNING } from './config';
export type Vital = { health: number; shield: number };
export function damage(v: Vital, amount: number): Vital {
  const hit = Math.max(0, amount),
    absorbed = Math.min(v.shield, hit);
  return { shield: v.shield - absorbed, health: Math.max(0, v.health - (hit - absorbed)) };
}
export type Ammo = { mag: number; reserve: number };
export function reloadAmmo(ammo: Ammo, capacity: number): Ammo {
  const transferred = Math.min(Math.max(0, capacity - ammo.mag), ammo.reserve);
  return { mag: ammo.mag + transferred, reserve: ammo.reserve - transferred };
}
export function canFire(
  now: number,
  last: number,
  interval: number,
  ammo: number,
  reloading: boolean,
  playing: boolean,
) {
  return playing && !reloading && ammo > 0 && now - last + 1e-8 >= interval;
}
export function waveComplete(pending: number, active: number) {
  return pending === 0 && active === 0;
}
export function killPoints(base: number, streak: number) {
  return Math.round(base * Math.min(3, 1 + Math.floor(Math.max(0, streak - 1) / 3) * 0.5));
}
export function accuracy(hits: number, shots: number) {
  return shots ? Math.round((hits / shots) * 100) : 0;
}
export function freshRun() {
  return {
    score: 0,
    kills: 0,
    shots: 0,
    hits: 0,
    elapsed: 0,
    streak: 0,
    streakUntil: 0,
    wave: 0,
    health: 100,
    shield: 50,
    ammo: WEAPONS.map((w): Ammo => ({ mag: w.mag, reserve: w.reserve })),
    weapon: 0,
    reloadRemaining: 0,
    lastShot: WEAPONS.map(() => -100),
    dash: 0,
  };
}
export type Run = ReturnType<typeof freshRun>;
export function waveRoster(wave: number, countScale: number): string[] {
  const count = Math.min(52, Math.ceil((3 + wave * 2) * countScale));
  const roster: string[] = Array.from({ length: count }, (_, i) =>
    wave >= 3 && i % 5 === 4 ? 'heavy' : wave >= 2 && i % 3 === 2 ? 'sentinel' : 'chaser',
  );
  if (wave % 5 === 0) roster.unshift('boss');
  return roster;
}
export const MAX_HEALTH = 100,
  MAX_SHIELD = 50;
export const DASH_COOLDOWN = TUNING.dashCooldown;
