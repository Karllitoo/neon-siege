# NEON SIEGE

**Survive the signal.** A complete single-player, first-person robot arena shooter built with TypeScript, Three.js, Vite, and an HTML/CSS interface. All visuals and sounds are procedural. There are no accounts, backend, network gameplay, or external asset requests.

## Run locally

Requires Node.js **22.12 or newer** and npm.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. Do not open `index.html` using `file://`.

On this Windows workspace Node is available at `C:\laragon\bin\nodejs\node-v22`. If Node is missing from your terminal PATH, run this first in PowerShell:

```powershell
$env:Path = 'C:\laragon\bin\nodejs\node-v22;' + $env:Path
```

## Build and verify

```sh
npm run build       # Strict TypeScript check, then static production output
npm test            # Focused deterministic logic checks
npm run test:browser # Builds and runs Chromium integration checks
npm run preview     # Serve the production dist/ directory
```

Browser tests use an installed Google Chrome (`channel: 'chrome'`), with software WebGL for reliable headless checks. Install Chrome if it is absent, or change the Playwright channel to your installed browser. The test runner starts and stops the Vite development and production-preview servers. Screenshots are written to `test-results/`. `tests/harness.html` exposes test state only in the development test harness; it is **not shipped** in the production build.

## Gameplay

- Clear each wave to gain a wave bonus and a seven-second supply break.
- Chasers rush you, Sentinels shoot dodgeable projectiles, and Heavies bring more armor and stronger shots.
- Every fifth wave brings **THE OVERSEER**: slow projectile bursts, a red four-meter area attack with a **2.5-second warning**, and at most three summoned minions per boss. Jumping above 1.6 meters or leaving the marked zone avoids the area strike. Its cyan weak point opens for **3 seconds of every 8 seconds** and takes **2.5× damage**. The area telegraph has a sound cue and a visible ring.
- Damage removes shield before health. Health is capped at 100, shield at 50. Shield regenerates at 10 per second after five seconds without damage. Pick up green health crosses, cyan shield diamonds, teal rifle magazines, and amber shell cylinders.
- Pulse Pistol: accurate, separate presses/taps, 12 rounds, unlimited reserve.
- Arc Rifle: hold to fire, 30 rounds, finite reserve.
- Scattergun: nine pellets per blast, six shells, strongest at short range. A robot killed by several pellets awards points once.
- Reloading transfers only available reserve ammo. Switching cancels unfinished reloads without consuming or duplicating ammo.
- Eliminations within five seconds extend a streak. Every three additional kills increases the multiplier by 0.5, capped at **3×**. Base points are 100 / 180 / 350 / 2500 for Chaser / Sentinel / Heavy / Overseer; a cleared wave awards `250 × wave`.
- **Accuracy = shots that damage at least one robot / all shots fired × 100.** A shotgun blast counts as one shot, regardless of pellets or robots hit.

## Controls

| Action | Desktop |
| --- | --- |
| Move | WASD |
| Look / fire | Mouse / left click |
| Reload | R |
| Switch weapons | 1, 2, 3 |
| Sprint / jump | Shift / Space |
| Dash | Q, three-second cooldown |
| Pause and release mouse | Escape |

On mobile, use the left joystick, swipe the right side to aim, and the Fire / Reload / Jump / Dash / Weapon / Pause buttons. Move, aim, and fire support separate simultaneous touch pointers. Use landscape for the clearest HUD; portrait menus also work. Desktop offers the best experience.

Click **Play**, then the first-time tutorial's ready button, to start. Audio and mouse capture unlock only after this gesture. Focus loss, pointer-lock loss, or Escape pauses the simulation and clears all held controls. Click **Resume** intentionally to continue. If the browser rejects mouse capture, the pause dialog explains how to enable it. Keyboard navigation and visible focus rings are available in menus.

## Settings and local data

Volume, ambience, effects, mouse sensitivity, FOV, pixel-density quality, screen shake, damage numbers, vertical inversion, and reduced motion persist in local storage. Reduced motion removes shake, weapon bob, muzzle flash, and unnecessary arena/pickup/enemy animation. Local records contain scores, wave reached, difficulty, and run date, and are labeled **On this device**. They never sync to another browser. If storage is unavailable or corrupt, the game remains playable and reports when a result could not be saved.

## Architecture

| Module | Responsibility |
| --- | --- |
| `game.ts`, `main.ts` | One animation loop, explicit lifecycle, focus/pointer lock, rendering and reset |
| `player.ts`, `input.ts` | Normalized movement, gravity/jump, swept dash collision, keyboard/multitouch |
| `arena.ts` | Shared procedural geometry/materials, collision boxes, reactor animation and landmarks |
| `navigation.ts` | Static occupancy grid and staggered A* navigation |
| `enemies.ts` | Robot archetypes, separation, LOS, swept projectiles, boss phases and telegraphs |
| `weapons.ts` | Camera-origin hitscan, spread/range, ammo/reload, weapon viewmodels |
| `waves.ts`, `pickups.ts` | Spawn queue, concurrency cap, supply breaks and pickup effects |
| `effects.ts`, `audio.ts` | Bounded particle/tracer pools and original Web Audio synthesis |
| `hud.ts`, `style.css` | Menus, tutorial, HUD, records, settings and responsive touch controls |
| `core.ts`, `config.ts` | Pure combat/scoring rules and tuning values |
| `settings.ts`, `records.ts` | Validated local storage with fallback |

Frame delta is capped at 40 ms. Collision sweeps are subdivided into at most 15 cm steps, including dash movement; projectiles raycast their traveled segment. The layout stays flat and cover is deliberately impassable, including while jumping. Enemies use navigation and separation instead of a heavyweight physics engine. Caps: 22 active enemies, 52 pending wave robots (plus a fifth-wave boss), 100 pooled projectiles, 180 impact particles, 32 tracers, 20 supplies, and three active boss markers. Enemy durability/speed/damage scaling is bounded. Only three point lights are used; there is no bloom or shadow-map pass. Pixel density caps are 1 / 1.35 / 1.8 for low / medium / high, with a 1.5 cap on touch devices. Robot/weapon/arena box geometries and materials are shared. HUD values update at about 13 Hz. Resource cleanup is provided for page teardown; retry reuses the existing loop, pools and input listeners.

## Static HTTPS deployment

`npm run build` produces everything needed in **`dist/`**. Asset URLs are relative (`base: './'`), so deployment at a subdirectory is supported. No developer server, localhost URL, credential, or test harness is embedded in the build. Serving `dist` from an HTTPS static host is sufficient. There are no deep app routes.

To deploy independently on **Cloudflare Pages**:

1. Push this source to a GitHub or GitLab repository, including `package-lock.json`, excluding `node_modules`, `dist`, and test output.
2. In Cloudflare, choose **Workers & Pages → Create application → Pages → Import an existing Git repository**, and connect that repository.
3. Choose your production branch (usually `main`) and the repository root as the project directory.
4. Set the build command to **`npm run build`**, output directory to **`dist`**, and Node version to **22**. No runtime secrets or environment variables are needed.
5. Save and deploy. Open the **actual HTTPS URL returned by the host**, start a run, and verify mouse capture, sound, and touch controls. Future pushes rebuild automatically.

See [Cloudflare's build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/) and [Git deployment guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vue-site/) for the current dashboard workflow. This game does not use Vue; the repository connection and static build settings are the same.

An optional `.openai/hosting.json` binds this checkout to its Sites hosting project. The presence of a project ID or a local `dist` folder alone does **not** mean deployment has succeeded; consult the separately reported hosting result. Nothing in the runtime depends on Sites.

## Browser and hardware limits

Requires WebGL 2, ES2022 support, and graphics acceleration in a current browser. Chrome desktop is the primary tested target. Desktop mouse capture may be blocked in embedded/sandboxed frames; open the URL directly. Web Audio may be unavailable or muted by browser policy. Touch devices vary considerably in GPU performance and thermal limits; use Low graphics if necessary. Headless browser checks establish behavior, not real-device frame rate or touch comfort. Safari, Firefox, real Android/iOS hardware and long-session thermal performance have not been certified. No guarantee is made for every browser or device.

See [VERIFICATION.md](VERIFICATION.md) for exactly what was tested.

## Assets and licenses

Robot models, arena, weapons, icons, text textures, materials, pickup shapes and audio synthesis are original procedural work in this source. There are no downloaded art/audio assets or copyrighted game assets. Fonts use the system stack; nothing is fetched from a font service. Third-party package licenses remain applicable: Three.js (MIT), Vite (MIT), TypeScript (Apache-2.0), Vitest (MIT), Playwright (Apache-2.0). See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
