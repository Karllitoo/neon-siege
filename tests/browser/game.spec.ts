import { test, expect, type Page } from '@playwright/test';
import type { Game } from '../../src/game';
declare global {
  interface Window {
    testGame: Game;
  }
}
async function harness(page: Page) {
  await page.goto('/tests/harness.html');
  await expect(page.locator('#play')).toBeVisible();
}
test('movement normalization, grounding, obstacle collision and dash', async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(() => {
    const g = window.testGame,
      p = g.player;
    p.reset();
    g.input.keys.add('KeyW');
    p.update(0.1, g.settings);
    const straight = p.position.distanceTo({ x: 0, y: 0, z: 17 } as never);
    p.reset();
    g.input.keys.add('KeyD');
    p.update(0.1, g.settings);
    const diagonal = Math.hypot(p.position.x, p.position.z - 17);
    g.input.reset();
    p.position.set(0, 0, 4);
    g.input.keys.add('KeyW');
    g.input.pressed.add('KeyQ');
    for (let i = 0; i < 30; i++) p.update(0.04, g.settings);
    const stop = p.position.z;
    g.input.reset();
    g.input.pressed.add('Space');
    p.update(0.04, g.settings);
    const first = p.vy;
    g.input.pressed.add('Space');
    p.update(0.04, g.settings);
    const second = p.vy;
    for (let i = 0; i < 100; i++) p.update(0.04, g.settings);
    return { straight, diagonal, stop, first, second, y: p.position.y, grounded: p.grounded };
  });
  expect(result.diagonal).toBeCloseTo(result.straight, 3);
  expect(result.stop).toBeGreaterThanOrEqual(2.88);
  expect(result.second).toBeLessThan(result.first);
  expect(result.y).toBe(0);
  expect(result.grounded).toBe(true);
});
test('weapons enforce single presses, automatic fire, reload transfer and cancellation', async ({
  page,
}) => {
  await harness(page);
  const r = await page.evaluate(() => {
    const g = window.testGame;
    g.player.reset();
    g.scene.updateMatrixWorld(true);
    g.weapons.fire(g.run, true, true, g.settings);
    for (let i = 0; i < 3; i++) {
      g.run.elapsed += 0.3;
      g.weapons.update(0.3, g.run, false, g.settings);
      g.weapons.fire(g.run, true, false, g.settings);
    }
    const pistol = g.run.ammo[0].mag;
    g.weapons.switch(1, g.run);
    g.weapons.update(0.3, g.run, false, g.settings);
    for (let i = 0; i < 3; i++) {
      g.run.elapsed += 0.12;
      g.weapons.fire(g.run, true, false, g.settings);
    }
    const rifle = g.run.ammo[1].mag;
    g.run.ammo[1] = { mag: 0, reserve: 5 };
    g.weapons.reload(g.run);
    g.weapons.update(0.5, g.run, false, g.settings);
    g.weapons.switch(0, g.run);
    g.weapons.update(2, g.run, false, g.settings);
    const canceled = { ...g.run.ammo[1] };
    g.weapons.switch(1, g.run);
    g.weapons.reload(g.run);
    g.weapons.update(2, g.run, false, g.settings);
    g.weapons.update(2, g.run, false, g.settings);
    return { pistol, rifle, canceled, reloaded: g.run.ammo[1] };
  });
  expect(r.pistol).toBe(11);
  expect(r.rifle).toBe(27);
  expect(r.canceled).toEqual({ mag: 0, reserve: 5 });
  expect(r.reloaded).toEqual({ mag: 5, reserve: 0 });
});
test('hitscan respects cover; multiple pellets award one elimination', async ({ page }) => {
  await harness(page);
  const r = await page.evaluate(() => {
    const g = window.testGame;
    g.player.reset();
    g.player.position.set(0, 0, 6);
    g.player.update(0, g.settings);
    g.enemies.spawn('chaser', g.player.position.clone().set(0, 0, -6), 1);
    g.scene.updateMatrixWorld(true);
    g.weapons.fire(g.run, true, true, g.settings);
    const blocked = g.enemies.active[0].hp;
    g.enemies.reset();
    g.player.position.set(0, 0, 15);
    g.player.update(0, g.settings);
    g.enemies.spawn('chaser', g.player.position.clone().set(0, 0, 12), 1);
    g.weapons.switch(2, g.run);
    g.weapons.update(0.3, g.run, false, g.settings);
    g.run.elapsed += 1;
    g.scene.updateMatrixWorld(true);
    g.weapons.fire(g.run, true, true, g.settings);
    return {
      blocked,
      kills: g.run.kills,
      active: g.enemies.active.length,
      shots: g.run.shots,
      hits: g.run.hits,
    };
  });
  expect(r.blocked).toBe(60);
  expect(r.kills).toBe(1);
  expect(r.active).toBe(0);
  expect(r.shots).toBe(2);
  expect(r.hits).toBe(1);
});
test('navigation routes around cover and projectiles stop on the reactor', async ({ page }) => {
  await harness(page);
  const r = await page.evaluate(() => {
    const g = window.testGame;
    const from = g.player.position.clone().set(0, 0, 7),
      to = from.clone().set(0, 0, -7);
    const path = g.nav.path(from, to);
    const coverHugPath = g.nav.path(from, to.clone().set(0, 0, 2.9));
    const blocked = path.some((p) => g.arena.blocked(p.x, p.z, 0.7));
    g.enemies.shoot(from.clone().setY(1.6), to.clone().setY(1.6), 12, 10);
    for (let i = 0; i < 40; i++)
      g.enemies.update(0.04, g.player.position, g.camera.position, 1, 'operative', true);
    return {
      pathLength: path.length,
      coverHugLength: coverHugPath.length,
      blocked,
      projectiles: g.enemies.projectiles.filter((p) => p.life > 0).length,
    };
  });
  expect(r.pathLength).toBeGreaterThan(14);
  expect(r.coverHugLength).toBeGreaterThan(0);
  expect(r.blocked).toBe(false);
  expect(r.projectiles).toBe(0);
});
test('waves keep pending spawns, supply the break, and schedule the boss', async ({ page }) => {
  await harness(page);
  const r = await page.evaluate(() => {
    const g = window.testGame;
    g.waves.update(6, g.run, g.player.position, 'operative');
    const count = g.waves.remaining;
    g.waves.update(0.1, g.run, g.player.position, 'operative');
    const pending = g.waves.queue.length,
      active = g.enemies.active.length;
    g.enemies.reset();
    g.waves.queue = [];
    g.waves.update(0.1, g.run, g.player.position, 'operative');
    const bonus = g.run.score,
      supplies = g.pickups.items.length;
    g.run.wave = 4;
    g.waves.update(8, g.run, g.player.position, 'operative');
    g.waves.update(0.1, g.run, g.player.position, 'operative');
    const boss = g.enemies.active.find((e) => e.kind === 'boss');
    return { count, pending, active, bonus, supplies, boss: !!boss };
  });
  expect(r.count).toBe(5);
  expect(r.pending).toBe(4);
  expect(r.active).toBe(1);
  expect(r.bonus).toBe(250);
  expect(r.supplies).toBe(4);
  expect(r.boss).toBe(true);
});
test('boss telegraphs, weak point phases, summon limit, and death cleanup', async ({ page }) => {
  await harness(page);
  const r = await page.evaluate(() => {
    const g = window.testGame;
    g.enemies.spawn('boss', g.player.position.clone().set(0, 0, -15), 5);
    const boss = g.enemies.active[0];
    g.enemies.update(0.04, g.player.position, g.camera.position, 5, 'rookie', true);
    const open = boss.weakOpen;
    boss.phase = 0;
    g.enemies.update(0.04, g.player.position, g.camera.position, 5, 'rookie', true);
    const telegraph = g.enemies.areas.some((a) => a.remaining > 2);
    for (let i = 0; i < 5; i++) {
      boss.phase = 0;
      g.enemies.update(0.04, g.player.position, g.camera.position, 5, 'rookie', true);
    }
    const summons = boss.summons;
    g.enemies.hurt(boss, 10000);
    return {
      open,
      telegraph,
      summons,
      active: g.enemies.active.length,
      attacks: g.enemies.areas.filter((a) => a.remaining > 0).length,
    };
  });
  expect(r.open).toBe(true);
  expect(r.telegraph).toBe(true);
  expect(r.summons).toBeLessThanOrEqual(3);
  expect(r.active).toBe(0);
  expect(r.attacks).toBe(0);
});
test('pause clears held inputs; damage and pickups work; retry resets the run', async ({
  page,
}) => {
  await harness(page);
  await page.evaluate(async () => {
    const g = window.testGame;
    g.input.mobile = true;
    g.newRun(true);
    await g.enter();
  });
  await expect(page.locator('#hud')).toBeVisible();
  const r = await page.evaluate(() => {
    const g = window.testGame;
    g.takeDamage(70, g.player.position.clone());
    const damage = { health: g.run.health, shield: g.run.shield };
    g.pickups.add('health', g.player.position);
    g.pickups.add('shield', g.player.position);
    g.pickups.update(0, g.player.position, g.run, true);
    const healing = { health: g.run.health, shield: g.run.shield };
    g.input.keys.add('KeyW');
    g.input.fire = true;
    g.pause();
    return { damage, healing, state: g.state, held: g.input.keys.size, fire: g.input.fire };
  });
  expect(r.damage).toEqual({ health: 80, shield: 0 });
  expect(r.healing).toEqual({ health: 100, shield: 25 });
  expect(r.state).toBe('paused');
  expect(r.held).toBe(0);
  expect(r.fire).toBe(false);
  await page.getByRole('button', { name: 'RESUME', exact: true }).click();
  await page.evaluate(() => window.testGame.takeDamage(999, window.testGame.player.position));
  await expect(page.getByRole('heading', { name: 'End of the signal.' })).toBeVisible();
  await page.getByRole('button', { name: 'TRY AGAIN' }).click();
  const fresh = await page.evaluate(() => {
    const g = window.testGame;
    return {
      health: g.run.health,
      shield: g.run.shield,
      kills: g.run.kills,
      score: g.run.score,
      wave: g.run.wave,
      weapon: g.run.weapon,
      ammo: g.run.ammo[1].mag,
      items: g.pickups.items.length,
      robots: g.enemies.active.length,
    };
  });
  expect(fresh).toEqual({
    health: 100,
    shield: 50,
    kills: 0,
    score: 0,
    wave: 0,
    weapon: 0,
    ammo: 30,
    items: 0,
    robots: 0,
  });
});
test('production build renders, keyboard menus work, settings and records persist', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:4173/');
  await expect(page.locator('#play')).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Graphics quality').selectOption('low');
  await page.getByLabel('Reduced motion').check();
  await page.getByRole('button', { name: 'DONE' }).click();
  await page.getByRole('button', { name: 'Local records' }).click();
  await expect(
    page.getByText('Records do not sync across devices.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'BACK', exact: true }).click();
  await page.reload();
  await expect(page.locator('#play')).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Graphics quality')).toHaveValue('low');
  await expect(page.getByLabel('Reduced motion')).toBeChecked();
  await page.getByRole('button', { name: 'DONE' }).click();
  await page.screenshot({ path: 'test-results/menu.png' });
  expect(errors).toEqual([]);
});
test('production desktop mouse capture, all weapons, reload, Escape and intentional resume', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:4173/');
  await page.locator('#play').click();
  await page.getByRole('button', { name: 'I’M READY' }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement !== null)).toBe(true);
  await page.mouse.click(640, 360);
  await expect(page.locator('#mag-value')).toHaveText('11');
  await page.keyboard.press('2');
  await expect(page.locator('#weapon-name')).toHaveText('ARC RIFLE');
  await page.waitForTimeout(300);
  await page.mouse.down();
  await expect
    .poll(async () => Number(await page.locator('#mag-value').textContent()))
    .toBeLessThan(30);
  await page.mouse.up();
  await page.keyboard.press('r');
  await expect(page.locator('#reload-label')).toContainText('RELOADING');
  await page.keyboard.press('3');
  await expect(page.locator('#weapon-name')).toHaveText('SCATTERGUN');
  await page.waitForTimeout(300);
  await page.mouse.click(640, 360);
  await expect(page.locator('#mag-value')).toHaveText('05');
  await page.screenshot({ path: 'test-results/desktop-gameplay.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'RESUME', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'RESUME', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement !== null)).toBe(true);
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});
test('losing focus freezes the simulation and clears controls until resume', async ({ page }) => {
  await harness(page);
  await page.evaluate(async () => {
    const g = window.testGame;
    g.input.mobile = true;
    g.newRun(true);
    await g.enter();
    g.input.keys.add('KeyW');
    g.input.fire = true;
    window.dispatchEvent(new Event('blur'));
  });
  const before = await page.evaluate(() => ({
    state: window.testGame.state,
    time: window.testGame.run.elapsed,
    keys: window.testGame.input.keys.size,
    fire: window.testGame.input.fire,
  }));
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.testGame.run.elapsed)).toBe(before.time);
  expect(before.state).toBe('paused');
  expect(before.keys).toBe(0);
  expect(before.fire).toBe(false);
  await page.getByRole('button', { name: 'RESUME', exact: true }).click();
  expect(await page.evaluate(() => window.testGame.state)).toBe('playing');
});
test('corrupted browser storage does not prevent initialization or records', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('neon-siege-settings', 'null');
    localStorage.setItem('neon-siege-records', '{}');
  });
  await harness(page);
  await page.getByRole('button', { name: 'Local records' }).click();
  await expect(page.getByText('No transmissions yet.', { exact: false })).toBeVisible();
});
test('mobile layout supports simultaneous joystick, look and fire pointers', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await harness(page);
  await page.getByRole('button', { name: 'ENTER THE ARENA PLAY' }).click();
  if (await page.getByRole('button', { name: 'I’M READY' }).isVisible())
    await page.getByRole('button', { name: 'I’M READY' }).click();
  await expect(page.locator('#mobile-controls')).toBeVisible();
  const stick = (await page.locator('#joystick').boundingBox())!,
    fire = (await page.locator('[data-touch="fire"]').boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const finger1 = { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2, id: 1 },
    finger2 = { x: 500, y: 100, id: 2 },
    finger3 = { x: fire.x + fire.width / 2, y: fire.y + fire.height / 2, id: 3 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger1] });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [finger1, finger2],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [finger1, finger2, finger3],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { ...finger1, x: finger1.x + 40, y: finger1.y - 20 },
      { ...finger2, x: 550, y: 120 },
      finger3,
    ],
  });
  const r = await page.evaluate(() => ({
    move: window.testGame.input.moveX,
    look: window.testGame.player.yaw,
    fire: window.testGame.input.fire,
  }));
  expect(r.move).toBeGreaterThan(0);
  expect(Math.abs(r.look)).toBeGreaterThan(0);
  expect(r.fire).toBe(true);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.screenshot({ path: 'test-results/mobile-landscape.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'RESUME', exact: true })).toBeVisible();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const bounds = await page.locator('.panel').boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(
    await page.evaluate(() => document.querySelector('canvas')!.getBoundingClientRect().width),
  ).toBe(390);
  await page.screenshot({ path: 'test-results/mobile-portrait.png' });
  await context.close();
});
