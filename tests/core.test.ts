import { describe, it, expect } from 'vitest';
import {
  damage,
  reloadAmmo,
  canFire,
  waveComplete,
  killPoints,
  freshRun,
  accuracy,
  waveRoster,
} from '../src/core';
describe('ammunition and firing invariants', () => {
  it('transfers only the missing rounds and cannot duplicate ammunition', () => {
    const ammo = { mag: 24, reserve: 4 };
    const after = reloadAmmo(ammo, 30);
    expect(after).toEqual({ mag: 28, reserve: 0 });
    expect(reloadAmmo(after, 30)).toEqual(after);
    expect(ammo).toEqual({ mag: 24, reserve: 4 });
  });
  it('keeps the fallback reserve unlimited', () =>
    expect(reloadAmmo({ mag: 0, reserve: Infinity }, 12)).toEqual({ mag: 12, reserve: Infinity }));
  it('enforces fire interval, ammo, reload and lifecycle gates', () => {
    expect(canFire(0.1, 0, 0.2, 12, false, true)).toBe(false);
    expect(canFire(0.2, 0, 0.2, 12, false, true)).toBe(true);
    for (const [ammo, reloading, playing] of [
      [0, false, true],
      [1, true, true],
      [1, false, false],
    ] as const)
      expect(canFire(2, 0, 0.2, ammo, reloading, playing)).toBe(false);
  });
});
describe('survival and scoring invariants', () => {
  it('absorbs shield first and clamps lethal damage', () => {
    expect(damage({ health: 100, shield: 50 }, 20)).toEqual({ health: 100, shield: 30 });
    expect(damage({ health: 100, shield: 30 }, 50)).toEqual({ health: 80, shield: 0 });
    expect(damage({ health: 10, shield: 0 }, 100)).toEqual({ health: 0, shield: 0 });
  });
  it('ignores negative damage', () =>
    expect(damage({ health: 100, shield: 50 }, -10)).toEqual({ health: 100, shield: 50 }));
  it('waits for both the pending queue and active robots', () => {
    expect(waveComplete(1, 0)).toBe(false);
    expect(waveComplete(0, 1)).toBe(false);
    expect(waveComplete(0, 0)).toBe(true);
  });
  it('caps the streak multiplier at 3x', () => {
    expect(killPoints(100, 1)).toBe(100);
    expect(killPoints(100, 4)).toBe(150);
    expect(killPoints(100, 99)).toBe(300);
  });
  it('documents accuracy as successful shots / all shots', () => {
    expect(accuracy(3, 4)).toBe(75);
    expect(accuracy(0, 0)).toBe(0);
  });
  it('creates isolated reset state with fresh ammo and timing', () => {
    const first = freshRun();
    first.ammo[1].mag = 0;
    first.score = 800;
    first.reloadRemaining = 1;
    first.lastShot[2] = 20;
    const second = freshRun();
    expect(second.score).toBe(0);
    expect(second.ammo[1].mag).toBe(30);
    expect(second.reloadRemaining).toBe(0);
    expect(second.lastShot).toEqual([-100, -100, -100]);
    expect(second.health).toBe(100);
    expect(second.shield).toBe(50);
  });
  it('introduces enemy types progressively, bounds waves, and schedules bosses', () => {
    expect(waveRoster(1, 1).every((e) => e === 'chaser')).toBe(true);
    expect(waveRoster(2, 1)).toContain('sentinel');
    expect(waveRoster(3, 1)).toContain('heavy');
    expect(waveRoster(5, 1)[0]).toBe('boss');
    expect(waveRoster(6, 1)).not.toContain('boss');
    expect(waveRoster(999, 1)).toHaveLength(52);
  });
});
