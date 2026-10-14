import type { Run } from './core';
import { accuracy } from './core';
import { WEAPONS, DIFFICULTIES, type Difficulty } from './config';
import { records, highestWave } from './records';
import { type Settings } from './settings';
export type State = 'loading' | 'menu' | 'tutorial' | 'playing' | 'paused' | 'over';
const icon = (name: string) => {
  const paths: Record<string, string> = {
    bolt: 'm13 2-3 8H5l6 12 3-8h5L13 2Z',
    shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z',
    health: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4Z',
    cross: 'M12 2v5m0 10v5M2 12h5m10 0h5M8 8l8 8m0-8-8 8',
    arrow: 'm5 12h14m-5-5 5 5-5 5',
    pause: 'M8 5v14m8-14v14',
    sound: 'm3 9h4l5-5v16l-5-5H3V9Zm13-2c4 2 4 8 0 10',
    target: 'M21 12a9 9 0 1 1-9-9m0 5a4 4 0 1 0 4 4m-4 0 9-9m-1 0v4m0-4h-4',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${name === 'bolt' || name === 'health' ? `<path d="${paths[name]}" fill="currentColor" stroke="none"/>` : `<path d="${paths[name] ?? paths.target}"/>`}</svg>`;
};
export class HUD {
  root: HTMLElement;
  menu: HTMLElement;
  hud: HTMLElement;
  panels: HTMLElement;
  private values = new Map<string, string>();
  private hitTimer = 0;
  private announceTimer = 0;
  private toastTimer = 0;
  private damageTimer = 0;
  onPlay = () => {};
  onBegin = () => {};
  onResume = () => {};
  onMenu = () => {};
  onRetry = () => {};
  onPause = () => {};
  onDifficulty = (d: Difficulty) => {};
  onSettings = (s: Settings) => {};
  private panelReturn: State = 'menu';
  state: State = 'loading';
  difficulty: Difficulty = 'operative';
  constructor(
    app: HTMLElement,
    public settings: Settings,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'interface';
    app.append(this.root);
    this.root.innerHTML = `
    <div id="menu" class="menu-screen">
      <header class="masthead"><a class="brand" href="#" aria-label="NEON SIEGE home"><span class="brand-mark">N<span>/</span>S</span><span>NEON SIEGE<span class="brand-sub">TACTICAL SURVIVAL SYSTEM</span></span></a><div class="mast-status"><i></i> SYSTEM ONLINE <span class="divider">/</span> BUILD 1.0</div></header>
      <main class="menu-main"><div class="menu-content"><div class="eyebrow"><span class="line"></span> SECTOR 07 / REACTOR COMPLEX</div><h1>NEON<br><span>SIEGE<span class="title-dot">.</span></span></h1><p class="tagline">Survive the signal.</p><p class="menu-description">The city went silent. The machines didn’t.<br>Hold the arena. Break the swarm. Stay alive.</p>
        <div class="difficulty-label"><span>SELECT DIFFICULTY</span><span id="difficulty-index">02 / 03</span></div><div class="difficulty-picker" role="group" aria-label="Difficulty"><button data-difficulty="rookie">01 <strong>Rookie</strong></button><button class="selected" data-difficulty="operative" aria-pressed="true">02 <strong>Operative</strong></button><button data-difficulty="nightmare">03 <strong>Nightmare</strong></button></div>
        <button id="play" class="button-primary"><span>${icon('bolt')} ENTER THE ARENA</span><span class="key-hint">PLAY ${icon('arrow')}</span></button>
        <div class="menu-links"><button data-panel="how">How to play ${icon('arrow')}</button><button data-panel="settings">Settings</button><button data-panel="records">Local records</button></div>
        <div class="menu-note"><i></i> SINGLE PLAYER <span>·</span> WAVE SURVIVAL <span>·</span> NO SIGNAL REQUIRED</div>
      </div><aside class="arena-card"><div class="arena-card-top"><span class="tiny-dot"></span> LIVE ARENA FEED <span class="rec">REC <i></i></span></div><div class="arena-card-body"><span class="arena-number">07</span><div><span class="eyebrow">COMBAT ZONE</span><h2>The Reactor</h2><p>Industrial district / Night cycle</p></div>${icon('target')}</div><div class="arena-card-bottom"><span>THREAT LEVEL <b>ESCALATING</b></span><span>48 × 48 M</span></div></aside></main>
      <footer class="menu-footer"><div><span class="footer-label">QUICK CONTROLS</span><span><kbd>W A S D</kbd> MOVE</span><span><kbd>MOUSE</kbd> AIM / FIRE</span><span><kbd>Q</kbd> DASH</span></div><p>DESKTOP RECOMMENDED <span>© 2026 NEON SIEGE</span></p></footer>
    </div>
    <div id="hud" hidden>
      <div class="hud-top"><div class="sector-hud"><span class="brand-mark">N<span>/</span>S</span><div><b>SECTOR 07</b><span>REACTOR COMPLEX</span></div></div><div class="wave-hud"><span id="wave-label">PREPARATION</span><strong id="wave-value">05</strong><small id="enemy-count">GET READY</small></div><div class="score-hud"><span>SCORE</span><b id="score-value">000000</b><small id="streak-value"></small></div></div>
      <div class="crosshair" id="crosshair"><i></i><i></i><i></i><i></i><b></b></div><div id="hitmarker" class="hitmarker">×</div><div id="damage-vignette"></div><div id="damage-direction">▼</div>
      <div id="announcement"><span id="announcement-sub"></span><h2 id="announcement-title"></h2><i></i></div><div id="toast" role="status"></div>
      <div id="boss-hud" hidden><div><b>THE OVERSEER</b><span id="boss-phase">ARMORED</span></div><div class="boss-track"><i id="boss-fill"></i></div><small>CYAN CORE OPEN = 2.5× DAMAGE · EVADE RED ZONES</small></div>
      <div class="hud-bottom"><div class="vitals"><div class="vital-row">${icon('health')}<b id="health-value">100</b><span>HEALTH</span><div class="vital-track"><i id="health-fill"></i></div></div><div class="vital-row shield">${icon('shield')}<b id="shield-value">50</b><span>SHIELD</span><div class="vital-track"><i id="shield-fill"></i></div></div><div class="dash-row">${icon('bolt')}<span><kbd>Q</kbd> DASH</span><div><i id="dash-fill"></i></div><b id="dash-value">READY</b></div></div>
      <div class="hud-controls"><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> WEAPONS</span><span><kbd>R</kbd> RELOAD</span><span><kbd>ESC</kbd> PAUSE</span></div>
      <div class="ammo"><div class="weapon-name"><span id="weapon-tag">PULSE / 01</span><b id="weapon-name">PULSE PISTOL</b></div><div class="ammo-count"><strong id="mag-value">12</strong><span>/ <b id="reserve-value">∞</b></span></div><div class="weapon-slots"><button data-weapon="0" class="selected"><kbd>1</kbd> PULSE</button><button data-weapon="1"><kbd>2</kbd> ARC</button><button data-weapon="2"><kbd>3</kbd> SCATTER</button></div><span id="reload-label"></span></div></div>
      <button id="pause-button" class="mobile-pause" aria-label="Pause">${icon('pause')}</button>
    </div>
    <div id="mobile-controls" hidden><div id="look-zone" aria-label="Swipe to look"></div><div id="joystick" aria-label="Movement joystick"><span id="stick-knob"></span></div><div class="touch-actions"><button data-touch="KeyR">R<span>RELOAD</span></button><button data-touch="Space">↑<span>JUMP</span></button><button data-touch="KeyQ">↗<span>DASH</span></button><button data-touch="Tab">⇄<span>WEAPON</span></button><button data-touch="fire" class="touch-fire">${icon('cross')}<span>FIRE</span></button></div><div class="orientation-note">LANDSCAPE RECOMMENDED · DESKTOP OFFERS THE BEST EXPERIENCE</div></div>
    <div id="panels" hidden></div><div id="damage-numbers"></div>`;
    this.menu = this.root.querySelector('#menu')!;
    this.hud = this.root.querySelector('#hud')!;
    this.panels = this.root.querySelector('#panels')!;
    this.root.querySelector('#play')!.addEventListener('click', () => this.onPlay());
    this.root.querySelector('.brand')!.addEventListener('click', (e) => {
      e.preventDefault();
      this.onMenu();
    });
    this.root.querySelector('#pause-button')!.addEventListener('click', () => this.onPause());
    this.root.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach((b) =>
      b.addEventListener('click', () => {
        this.difficulty = b.dataset.difficulty as Difficulty;
        this.root.querySelectorAll('[data-difficulty]').forEach((el) => {
          const selected = el === b;
          el.classList.toggle('selected', selected);
          el.setAttribute('aria-pressed', String(selected));
        });
        this.set(
          'difficulty-index',
          `${this.difficulty === 'rookie' ? '01' : this.difficulty === 'operative' ? '02' : '03'} / 03`,
        );
        this.onDifficulty(this.difficulty);
      }),
    );
    this.root
      .querySelectorAll<HTMLButtonElement>('[data-panel]')
      .forEach((b) => b.addEventListener('click', () => this.panel(b.dataset.panel!)));
  }
  set(id: string, value: string) {
    if (this.values.get(id) === value) return;
    this.values.set(id, value);
    const element = this.root.querySelector<HTMLElement>(`#${id}`);
    if (element) element.textContent = value;
  }
  stateTo(state: State, mobile = false) {
    this.state = state;
    this.menu.inert = false;
    this.hud.inert = state === 'paused';
    this.menu.hidden = state !== 'menu';
    this.hud.hidden = !['playing', 'paused'].includes(state);
    (this.root.querySelector('#mobile-controls') as HTMLElement).hidden =
      state !== 'playing' || !mobile;
    this.root.classList.toggle('is-mobile', mobile);
    this.panels.hidden = !['paused', 'tutorial', 'over'].includes(state);
    if (state === 'paused') this.pausePanel();
    if (state === 'tutorial') this.tutorial();
    if (state === 'menu' || state === 'playing') this.panels.innerHTML = '';
  }
  shell(eyebrow: string, title: string, content: string) {
    this.panels.hidden = false;
    this.menu.inert = true;
    this.hud.inert = true;
    this.panels.innerHTML = `<section class="panel" role="dialog" aria-modal="true" aria-label="${title}"><div class="panel-top"><span class="eyebrow">${eyebrow}</span><span>N / S</span></div><h2>${title}</h2>${content}</section>`;
    this.panels.querySelector<HTMLButtonElement>('button')?.focus();
  }
  pausePanel() {
    this.shell(
      'CONNECTION SUSPENDED',
      'Signal paused.',
      `<p class="panel-copy">Simulation stopped. Click resume to return to the arena.<br><small>Pointer lock is released while paused.</small></p><button id="resume" class="button-primary">RESUME ${icon('arrow')}</button><div class="panel-buttons"><button data-panel="settings">Settings</button><button data-panel="how">Controls</button><button id="quit">Main menu</button></div><p id="lock-message" class="panel-note"></p>`,
    );
    this.panels.querySelector('#resume')!.addEventListener('click', () => this.onResume());
    this.panels.querySelector('#quit')!.addEventListener('click', () => this.onMenu());
    this.bindPanelLinks();
  }
  lockError() {
    this.set(
      'lock-message',
      'Mouse capture is unavailable. Allow pointer lock for this site, or use a desktop browser that supports it, then click Resume. Touch controls work on mobile.',
    );
  }
  tutorial() {
    this.shell(
      'FIRST TRANSMISSION / FIELD GUIDE',
      'Stay in motion.',
      `<p class="panel-copy">Clear each wave. Resupply between attacks.<br>Every fifth wave, face <b>THE OVERSEER</b>.</p><div class="tutorial-steps"><div><span>01</span><b>MOVE & EVADE</b><p>WASD to move, Shift to sprint.<br>Space to jump, Q to dash.</p></div><div><span>02</span><b>MAKE EVERY SHOT COUNT</b><p>Click to fire. R to reload.<br>1 / 2 / 3 to switch weapons.</p></div><div><span>03</span><b>HOLD THE REACTOR</b><p>Shield regenerates after 5 seconds.<br>Collect glowing supply pickups.</p></div></div><p class="panel-note">Touch: left stick to move, swipe right to aim. Use the action buttons. Landscape recommended; desktop offers the best experience.</p><button id="begin" class="button-primary">I’M READY ${icon('arrow')}</button>`,
    );
    this.panels.querySelector('#begin')!.addEventListener('click', () => this.onBegin());
  }
  panel(kind: string) {
    this.panelReturn = this.state;
    this.renderPanel(kind);
  }
  private bindPanelLinks() {
    this.panels
      .querySelectorAll<HTMLButtonElement>('[data-panel]')
      .forEach((b) => b.addEventListener('click', () => this.panel(b.dataset.panel!)));
  }
  private renderPanel(kind: string) {
    if (kind === 'settings') {
      const range = (key: keyof Settings, label: string, min: number, max: number, step: number) =>
        `<label class="setting-row"><span>${label}</span><input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${this.settings[key]}"><output>${this.settings[key]}</output></label>`;
      const toggle = (key: keyof Settings, label: string) =>
        `<label class="setting-row"><span>${label}</span><input type="checkbox" data-setting="${key}" ${this.settings[key] ? 'checked' : ''}></label>`;
      this.shell(
        'SYSTEM PREFERENCES',
        'Tune your signal.',
        `<div class="settings-list">${range('master', 'Master volume', 0, 1, 0.05)}${range('music', 'Ambient music', 0, 1, 0.05)}${range('effects', 'Effects volume', 0, 1, 0.05)}${range('sensitivity', 'Mouse sensitivity', 0.2, 3, 0.1)}${range('fov', 'Field of view', 60, 110, 1)}<label class="setting-row"><span>Graphics quality</span><select data-setting="quality">${['low', 'medium', 'high'].map((q) => `<option ${q === this.settings.quality ? 'selected' : ''}>${q}</option>`).join('')}</select></label>${range('shake', 'Screen shake', 0, 1, 0.05)}${toggle('numbers', 'Damage numbers')}${toggle('invert', 'Invert vertical look')}${toggle('reduced', 'Reduced motion')}</div><p class="panel-note">Preferences are saved on this device. Reduced motion disables shake, weapon bob, muzzle flash, and decorative animation.</p><button id="back" class="button-primary">DONE ${icon('arrow')}</button>`,
      );
      this.panels
        .querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-setting]')
        .forEach((input) =>
          input.addEventListener('input', () => {
            const key = input.dataset.setting! as keyof Settings;
            const value =
              input instanceof HTMLInputElement && input.type === 'checkbox'
                ? input.checked
                : input instanceof HTMLSelectElement
                  ? input.value
                  : Number(input.value);
            Object.assign(this.settings, { [key]: value });
            const output = input.parentElement?.querySelector('output');
            if (output) output.textContent = String(value);
            this.onSettings(this.settings);
          }),
        );
    } else if (kind === 'records') {
      const data = records();
      const bestWave = highestWave();
      this.shell(
        'LOCAL RECORDS / ON THIS DEVICE',
        'Your best signals.',
        `<p class="panel-copy">Stored in this browser. Records do not sync across devices.</p>${bestWave ? `<div class="record-summary"><span>HIGHEST SCORE <b>${(data[0]?.score ?? 0).toLocaleString()}</b></span><span>HIGHEST WAVE <b>${bestWave.wave}</b><small>${DIFFICULTIES[bestWave.difficulty].label}</small></span></div>` : ''}<div class="record-table"><div class="record-row table-heading"><span>RANK</span><span>SCORE</span><span>WAVE</span><span>DIFFICULTY / DATE</span></div>${data.length ? data.map((r, i) => `<div class="record-row"><span>${String(i + 1).padStart(2, '0')}</span><b>${r.score.toLocaleString()}</b><span>${r.wave}</span><span>${DIFFICULTIES[r.difficulty].label}<small>${new Date(r.date).toLocaleDateString()}</small></span></div>`).join('') : '<div class="empty-records">No transmissions yet.<br><span>Enter the arena to set your first record.</span></div>'}</div><button id="back" class="button-primary">BACK ${icon('arrow')}</button>`,
      );
    } else {
      this.shell(
        'FIELD MANUAL',
        'Know your arsenal.',
        `<div class="controls-table">${[
          ['W A S D', 'Move'],
          ['MOUSE', 'Look / left click to fire'],
          ['SHIFT / SPACE', 'Sprint / jump'],
          ['Q', 'Dash · 3 second cooldown'],
          ['R', 'Reload'],
          ['1 / 2 / 3', 'Switch weapons'],
          ['ESC', 'Pause / release mouse'],
        ]
          .map(([a, b]) => `<div><kbd>${a}</kbd><span>${b}</span></div>`)
          .join(
            '',
          )}</div><div class="weapon-guide"><p><b>01 · PULSE PISTOL</b>Accurate, semi-auto. 12 rounds, unlimited reserve.</p><p><b>02 · ARC RIFLE</b>Automatic. 30 rounds, limited reserve.</p><p><b>03 · SCATTERGUN</b>9 pellets. 6 shells, strongest up close.</p></div><p class="panel-note">Shield absorbs damage first and regenerates after 5 seconds. Chain eliminations within 5 seconds for up to 3× points. The Overseer’s cyan core opens for 3 of every 8 seconds: 2.5× damage. Move out of red zones before they detonate.</p><p class="panel-note">Accuracy = shots that damage at least one robot ÷ shots fired. A scattergun blast counts as one shot.</p><button id="back" class="button-primary">BACK ${icon('arrow')}</button>`,
      );
    }
    this.panels.querySelector('#back')!.addEventListener('click', () => {
      this.panels.hidden = true;
      this.menu.inert = false;
      if (this.panelReturn === 'paused') this.pausePanel();
      else this.root.querySelector<HTMLButtonElement>(`[data-panel="${kind}"]`)?.focus();
    });
  }
  gameOver(run: Run, best: boolean, saved: boolean) {
    this.stateTo('over');
    this.shell(
      best ? 'PERSONAL BEST / SIGNAL ARCHIVED' : 'TRANSMISSION TERMINATED',
      'End of the signal.',
      `<div class="final-score"><span>FINAL SCORE</span><strong>${run.score.toLocaleString()}</strong>${best ? '<b>↗ NEW PERSONAL BEST</b>' : ''}</div><div class="results-grid">${[
        ['WAVE REACHED', run.wave],
        ['ROBOTS ELIMINATED', run.kills],
        ['ACCURACY', `${accuracy(run.hits, run.shots)}%`],
        [
          'SURVIVAL TIME',
          `${Math.floor(run.elapsed / 60)}:${String(Math.floor(run.elapsed % 60)).padStart(2, '0')}`,
        ],
      ]
        .map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`)
        .join(
          '',
        )}</div><button id="retry" class="button-primary">TRY AGAIN ${icon('arrow')}</button><button id="main-menu" class="button-secondary">MAIN MENU</button><p class="panel-note">${saved ? 'Record saved on this device.' : 'Browser storage is unavailable. This record could not be saved.'}</p>`,
    );
    this.panels.querySelector('#retry')!.addEventListener('click', () => this.onRetry());
    this.panels.querySelector('#main-menu')!.addEventListener('click', () => this.onMenu());
  }
  update(
    run: Run,
    remaining: number,
    prep: number,
    active: boolean,
    dash: number,
    boss: { hp: number; maxHp: number; weakOpen: boolean } | undefined,
  ) {
    this.set('wave-label', active ? `WAVE ${String(run.wave).padStart(2, '0')}` : 'PREPARATION');
    this.set(
      'wave-value',
      active
        ? String(remaining).padStart(2, '0')
        : String(Math.max(0, Math.ceil(prep))).padStart(2, '0'),
    );
    this.set('enemy-count', active ? 'HOSTILES REMAINING' : 'SECONDS TO NEXT WAVE');
    this.set('score-value', String(run.score).padStart(6, '0'));
    this.set(
      'streak-value',
      run.streak > 1 && run.streakUntil > run.elapsed
        ? `${Math.min(3, 1 + Math.floor((run.streak - 1) / 3) * 0.5)}× STREAK · ${Math.ceil(run.streakUntil - run.elapsed)}s`
        : '',
    );
    this.set('health-value', String(Math.ceil(run.health)));
    this.set('shield-value', String(Math.ceil(run.shield)));
    this.set('weapon-tag', WEAPONS[run.weapon].tag);
    this.set('weapon-name', WEAPONS[run.weapon].name.toUpperCase());
    this.set('mag-value', String(run.ammo[run.weapon].mag).padStart(2, '0'));
    this.set(
      'reserve-value',
      Number.isFinite(run.ammo[run.weapon].reserve) ? String(run.ammo[run.weapon].reserve) : '∞',
    );
    this.set('dash-value', dash > 0 ? `${dash.toFixed(1)}s` : 'READY');
    this.set(
      'reload-label',
      run.reloadRemaining > 0
        ? `RELOADING ${run.reloadRemaining.toFixed(1)}s`
        : run.ammo[run.weapon].mag === 0
          ? 'R · RELOAD'
          : '',
    );
    (this.root.querySelector('#health-fill') as HTMLElement).style.width = `${run.health}%`;
    (this.root.querySelector('#shield-fill') as HTMLElement).style.width = `${run.shield * 2}%`;
    (this.root.querySelector('#dash-fill') as HTMLElement).style.width = `${(1 - dash / 3) * 100}%`;
    this.root
      .querySelectorAll('[data-weapon]')
      .forEach((el, i) => el.classList.toggle('selected', i === run.weapon));
    const bossHud = this.root.querySelector('#boss-hud') as HTMLElement;
    bossHud.hidden = !boss;
    if (boss) {
      (this.root.querySelector('#boss-fill') as HTMLElement).style.width =
        `${(boss.hp / boss.maxHp) * 100}%`;
      this.set('boss-phase', boss.weakOpen ? 'CORE EXPOSED · 2.5×' : 'ARMORED');
    }
  }
  animate(dt: number) {
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.root.querySelector('#hitmarker')!.classList.remove('visible');
    }
    if (this.announceTimer > 0) {
      this.announceTimer -= dt;
      if (this.announceTimer <= 0)
        this.root.querySelector('#announcement')!.classList.remove('visible');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.root.querySelector('#toast')!.classList.remove('visible');
    }
    if (this.damageTimer > 0) {
      this.damageTimer -= dt;
      const value = String(Math.max(0, this.damageTimer / 0.4) * 0.55);
      (this.root.querySelector('#damage-vignette') as HTMLElement).style.opacity = value;
      (this.root.querySelector('#damage-direction') as HTMLElement).style.opacity = value;
    }
  }
  hit(kill: boolean, amount: number, x: number, y: number) {
    const marker = this.root.querySelector('#hitmarker')!;
    marker.classList.add('visible');
    marker.classList.toggle('kill', kill);
    this.hitTimer = 0.18;
    if (this.settings.numbers) {
      const number = document.createElement('span');
      number.className = `damage-number ${kill ? 'kill' : ''}`;
      number.textContent = kill ? `+ ${amount} / ELIM` : String(amount);
      number.style.left = `${x}px`;
      number.style.top = `${y}px`;
      this.root.querySelector('#damage-numbers')!.append(number);
      number.addEventListener('animationend', () => number.remove(), { once: true });
    }
  }
  announce(title: string, subtitle: string) {
    this.set('announcement-title', title);
    this.set('announcement-sub', subtitle);
    this.root.querySelector('#announcement')!.classList.add('visible');
    this.announceTimer = 3;
  }
  toast(text: string) {
    this.set('toast', text);
    this.root.querySelector('#toast')!.classList.add('visible');
    this.toastTimer = 2.2;
  }
  damage(angle: number) {
    this.damageTimer = 0.4;
    (this.root.querySelector('#damage-direction') as HTMLElement).style.transform =
      `translate(-50%, -50%) rotate(${angle}rad) translateY(-110px)`;
  }
  reset() {
    this.root.querySelector('#damage-numbers')!.innerHTML = '';
    this.hitTimer = this.announceTimer = this.toastTimer = this.damageTimer = 0;
    for (const id of ['hitmarker', 'announcement', 'toast'])
      this.root.querySelector(`#${id}`)!.classList.remove('visible');
    (this.root.querySelector('#damage-vignette') as HTMLElement).style.opacity = '0';
    (this.root.querySelector('#damage-direction') as HTMLElement).style.opacity = '0';
    this.values.clear();
  }
}
