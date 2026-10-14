import * as THREE from 'three';
import { Arena } from './arena';
import { Player } from './player';
import { Input } from './input';
import { Weapons } from './weapons';
import { Enemies, enemyPoints } from './enemies';
import { Navigation } from './navigation';
import { Waves } from './waves';
import { Pickups, type PickupKind } from './pickups';
import { Sound } from './audio';
import { HUD, type State } from './hud';
import { loadSettings, writeStorage, readStorage } from './settings';
import { saveRecord } from './records';
import { freshRun, damage, killPoints } from './core';
import { TUNING, type Difficulty } from './config';
import { Effects } from './effects';
export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(80, 1, 0.06, 140);
  settings = loadSettings();
  state: State = 'loading';
  run = freshRun();
  difficulty: Difficulty = 'operative';
  arena: Arena;
  player: Player;
  input: Input;
  weapons: Weapons;
  enemies: Enemies;
  nav: Navigation;
  waves: Waves;
  pickups: Pickups;
  sound: Sound;
  hud: HUD;
  effects: Effects;
  private frame = 0;
  private previous = 0;
  private menuTime = 0;
  private lastDamage = -100;
  private shake = 0;
  private hudAccumulator = 0;
  private resizeHandler = () => this.resize();
  private beforeUnload = () => this.dispose();
  private lockPending = false;
  constructor(public app: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.13;
    app.prepend(this.renderer.domElement);
    this.scene.add(this.camera);
    this.arena = new Arena(this.scene);
    this.nav = new Navigation(this.arena);
    this.input = new Input(this.renderer.domElement);
    this.player = new Player(this.camera, this.arena, this.input);
    this.sound = new Sound(this.settings);
    this.effects = new Effects(this.scene);
    this.enemies = new Enemies(this.scene, this.arena, this.nav, this.effects, this.sound);
    this.pickups = new Pickups(this.scene, this.sound);
    this.waves = new Waves(this.enemies, this.arena, this.pickups);
    this.weapons = new Weapons(this.camera, this.arena, this.enemies, this.effects, this.sound);
    this.hud = new HUD(app, this.settings);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Light) o.layers.enable(1);
    });
    this.input.bindMobile(this.hud.root);
    this.input.onPause = () => {
      if (this.state === 'playing') this.pause();
    };
    this.input.onLockLost = () => {
      if (this.state === 'playing') this.pause();
    };
    this.hud.onPlay = () => this.newRun();
    this.hud.onBegin = () => {
      writeStorage('neon-siege-tutorial', true);
      void this.enter();
    };
    this.hud.onRetry = () => this.newRun(true);
    this.hud.onResume = () => void this.enter();
    this.hud.onMenu = () => this.mainMenu();
    this.hud.onPause = () => this.pause();
    this.hud.onDifficulty = (d) => (this.difficulty = d);
    this.hud.onSettings = () => {
      writeStorage('neon-siege-settings', this.settings);
      this.applySettings();
      this.sound.apply();
    };
    this.hud.root.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach((button) =>
      button.addEventListener('click', () => {
        if (this.state === 'playing') this.weapons.switch(Number(button.dataset.weapon), this.run);
      }),
    );
    this.enemies.onDamage = (amount, origin) => this.takeDamage(amount, origin);
    this.enemies.onKill = (enemy) => {
      this.run.kills++;
      if (this.run.elapsed > this.run.streakUntil) this.run.streak = 0;
      this.run.streak++;
      this.run.streakUntil = this.run.elapsed + TUNING.streakDuration;
      const points = killPoints(enemyPoints(enemy), this.run.streak);
      this.run.score += points;
      this.effects.burst(
        enemy.group.position.clone().setY(1.5),
        enemy.kind === 'boss' ? 0xff6198 : 0xffba6e,
        enemy.kind === 'boss' ? 40 : 14,
      );
      if (enemy.kind === 'boss') {
        this.pickups.add('health', enemy.group.position);
        this.pickups.add('rifle', enemy.group.position.clone().add(new THREE.Vector3(1, 0, 0)));
        this.hud.announce('OVERSEER DOWN', `+${points} POINTS · SIGNAL RESTORED`);
      } else if (Math.random() < 0.4) {
        const kinds: PickupKind[] = ['health', 'shield', 'rifle', 'shotgun'];
        this.pickups.add(kinds[Math.floor(Math.random() * 4)], enemy.group.position);
      }
    };
    this.weapons.onHit = (kill, amount, point) => {
      const projected = point.clone().project(this.camera);
      this.hud.hit(
        kill,
        amount,
        (projected.x * 0.5 + 0.5) * innerWidth,
        (-projected.y * 0.5 + 0.5) * innerHeight,
      );
      this.shake = Math.max(this.shake, kill ? 0.025 : 0.012);
    };
    this.pickups.onPickup = (text) => this.hud.toast(text);
    this.waves.onAnnouncement = (title, subtitle) => {
      this.hud.announce(title, subtitle);
      if (title === 'THE OVERSEER') this.sound.warning();
      else this.sound.wave();
    };
    this.waves.onComplete = () => {
      this.sound.pickup();
      this.hud.toast('SUPPLIES AT THE REACTOR · 7s TO REGROUP');
    };
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('pagehide', this.beforeUnload);
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.pause();
      this.hud.toast('GRAPHICS CONTEXT LOST · RELOAD THE PAGE TO RESTORE');
    });
    this.applySettings();
    this.mainMenu();
    document.querySelector('#boot')?.remove();
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }
  applySettings() {
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
    const cap =
      this.settings.quality === 'low'
        ? 1
        : this.settings.quality === 'medium'
          ? 1.35
          : this.input.mobile
            ? 1.5
            : 1.8;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, cap));
    this.hud.root.classList.toggle('reduced-motion', this.settings.reduced);
    this.resize();
  }
  resize() {
    const width = this.app.clientWidth,
      height = this.app.clientHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  private stateTo(state: State) {
    this.state = state;
    this.hud.stateTo(state, this.input.mobile);
    this.weapons.model.visible = state === 'playing' || state === 'paused';
  }
  newRun(skipTutorial = false) {
    this.input.reset();
    this.enemies.reset();
    this.pickups.reset();
    this.effects.reset();
    this.waves.reset();
    this.run = freshRun();
    this.player.reset();
    this.weapons.reset(this.run);
    this.hud.reset();
    this.lastDamage = -100;
    this.shake = 0;
    this.hudAccumulator = 1;
    if (!skipTutorial && !readStorage('neon-siege-tutorial', false)) this.stateTo('tutorial');
    else {
      this.stateTo('paused');
      void this.enter();
    }
  }
  async enter() {
    if (this.lockPending || !['paused', 'tutorial'].includes(this.state)) return;
    this.lockPending = true;
    this.sound.unlock();
    this.input.reset();
    if (!this.input.mobile) {
      try {
        if (!this.renderer.domElement.requestPointerLock)
          throw new Error('Pointer lock unsupported');
        await this.renderer.domElement.requestPointerLock();
        if (document.pointerLockElement !== this.renderer.domElement)
          throw new Error('Mouse capture rejected');
      } catch {
        this.stateTo('paused');
        this.hud.lockError();
        this.sound.pause();
        this.lockPending = false;
        return;
      }
    }
    this.stateTo('playing');
    this.lockPending = false;
    this.previous = performance.now();
    if (this.run.wave === 0)
      this.hud.announce('ESTABLISH YOUR POSITION', 'REACTOR COMPLEX / SECTOR 07');
  }
  pause() {
    if (this.state !== 'playing') return;
    this.stateTo('paused');
    this.input.reset();
    this.sound.pause();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  mainMenu() {
    this.stateTo('menu');
    this.input.reset();
    this.sound.pause();
    if (document.pointerLockElement) document.exitPointerLock();
    this.enemies.reset();
    this.pickups.reset();
    this.effects.reset();
    this.hud.reset();
    this.camera.rotation.order = 'YXZ';
  }
  takeDamage(amount: number, origin: THREE.Vector3) {
    if (this.state !== 'playing' || this.run.health <= 0) return;
    Object.assign(this.run, damage(this.run, amount));
    this.lastDamage = this.run.elapsed;
    this.shake = 0.045;
    const angle =
      Math.atan2(origin.x - this.player.position.x, origin.z - this.player.position.z) -
      this.player.yaw;
    this.hud.damage(angle);
    this.sound.tone(75, 0.1, 0.08, 'triangle', 45);
    if (this.run.health <= 0) this.gameOver();
  }
  private gameOver() {
    this.state = 'over';
    this.input.reset();
    if (document.pointerLockElement) document.exitPointerLock();
    this.sound.warning();
    this.sound.pause();
    const result = saveRecord({
      score: this.run.score,
      wave: this.run.wave,
      difficulty: this.difficulty,
      date: new Date().toISOString(),
    });
    this.weapons.model.visible = false;
    this.hud.gameOver(this.run, result.best, result.saved);
  }
  private tick(time: number) {
    const dt = Math.min(0.04, Math.max(0, (time - this.previous) / 1000));
    this.previous = time;
    if (this.state === 'menu' || this.state === 'tutorial') {
      this.menuTime += dt;
      const t = this.settings.reduced ? 0 : this.menuTime;
      this.camera.position.set(16 + Math.sin(t * 0.1) * 1.5, 10.5, 17 + Math.cos(t * 0.1) * 1.5);
      this.camera.lookAt(-1, 2.6, 0);
      this.arena.update(dt, this.settings.reduced);
    }
    if (this.state === 'playing') {
      this.run.elapsed += dt;
      this.player.update(dt, this.settings);
      this.arena.update(dt, this.settings.reduced);
      for (let i = 0; i < 3; i++)
        if (this.input.take(`Digit${i + 1}`)) this.weapons.switch(i, this.run);
      if (this.input.take('Tab')) this.weapons.switch((this.run.weapon + 1) % 3, this.run);
      if (this.input.take('KeyR')) this.weapons.reload(this.run);
      this.weapons.update(dt, this.run, this.player.moving, this.settings);
      this.enemies.update(
        dt,
        this.player.position,
        this.camera.position,
        this.run.wave,
        this.difficulty,
        this.settings.reduced,
      );
      // Refresh robot transforms before hitscan queries, including a newly spawned wave.
      this.scene.updateMatrixWorld(true);
      if (this.state === 'playing') {
        this.weapons.fire(this.run, this.input.fire, this.input.firePress, this.settings);
        this.waves.update(dt, this.run, this.player.position, this.difficulty);
        this.pickups.update(dt, this.player.position, this.run, this.settings.reduced);
        if (this.run.elapsed - this.lastDamage > TUNING.shieldDelay)
          this.run.shield = Math.min(50, this.run.shield + TUNING.shieldRate * dt);
      }
      this.effects.update(dt);
      this.hud.animate(dt);
      this.shake = Math.max(0, this.shake - dt * 0.1);
      if (!this.settings.reduced && this.settings.shake > 0) {
        this.camera.rotation.x += (Math.random() - 0.5) * this.shake * this.settings.shake;
        this.camera.rotation.z = (Math.random() - 0.5) * this.shake * this.settings.shake;
      }
      this.hudAccumulator += dt;
      if (this.hudAccumulator > 0.075) {
        this.hudAccumulator = 0;
        this.hud.update(
          this.run,
          this.waves.remaining,
          this.waves.preparation,
          this.waves.active,
          this.player.dashCooldown,
          this.enemies.active.find((e) => e.kind === 'boss'),
        );
      }
    }
    this.input.frameEnd();
    this.renderer.clear();
    this.camera.layers.set(0);
    this.renderer.render(this.scene, this.camera);
    if (this.weapons.model.visible) {
      this.renderer.clearDepth();
      this.camera.layers.set(1);
      const background = this.scene.background;
      this.scene.background = null;
      this.renderer.render(this.scene, this.camera);
      this.scene.background = background;
      this.camera.layers.set(0);
    }
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('pagehide', this.beforeUnload);
    this.input.dispose();
    this.enemies.dispose();
    this.pickups.dispose();
    this.effects.dispose();
    this.weapons.dispose();
    this.arena.dispose();
    this.sound.dispose();
    this.renderer.dispose();
  }
}
