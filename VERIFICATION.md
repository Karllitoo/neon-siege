# Verification — 14 October 2026

The workspace was empty. A TypeScript / Three.js / Vite project was created, with no external art or audio asset dependencies.

## Executed checks

- Production compilation: strict TypeScript (`tsc --noEmit`) and Vite build succeeded.
- 10 Vitest checks: ammunition conservation and repeat reloads, infinite pistol reserve, fire intervals and lifecycle gates, shield-first and lethal damage, negative damage, pending/active wave completion, streak multiplier cap, documented shot accuracy, isolated fresh run state, progressive enemy types and bounded wave rosters.
- 12 Playwright Chromium integration checks using installed Chrome and software WebGL:
  1. Normalized movement, ground detection, airborne jump restriction, cover collision and swept dash.
  2. Separate pistol presses, automatic rifle shots, finite reload transfers and switching cancellation.
  3. Hitscan blocked by the reactor; several shotgun pellets cause one elimination and one successful shot.
  4. A* paths around the reactor; enemy projectiles stop at world geometry.
  5. Pending spawn queue, wave completion bonus, four break supplies and fifth-wave boss spawn.
  6. Boss weak-point opening, readable area telegraph, limited summons and death cleanup.
  7. Damage, health/shield pickups, pause input clearing, Game Over and retry reset.
  8. Production menu rendering, keyboard activation, settings persistence through reload and local records dialog.
  9. Production desktop pointer lock, all three weapons fired through actual mouse/keyboard input, reload, Escape and deliberate Resume.
  10. Blur pauses the simulation, clears inputs and freezes elapsed time until deliberate Resume.
  11. Corrupt settings/record storage does not break initialization or records UI.
  12. Browser-generated three-finger input simultaneously moves, aims and fires. Landscape and portrait controls/pause layouts are checked; rotating does not reload the run.
- npm audit: no known vulnerabilities at the time of verification after updating the test tooling.
- Static output inspection: relative assets, no test harness or game test globals, no localhost endpoint or runtime secrets. The Three.js license notice is included in `dist`.

The production build was also opened in visible Chrome using browser tools. Menu and first-person rendering, wave start and weapon switching were observed. Two render issues (menu camera blocked by an overhead beam; weapon pass clearing the world background) were found and fixed. Automated browser checks then covered the corrected production rendering. Screenshots were visually inspected for the menu, desktop gameplay, mobile landscape gameplay and portrait pause screen.

Browser checks use controlled integration scenarios to trigger wave completion, boss phases, lethal damage and retry. These are not claims of manually playing a full five-wave run. The test-only harness is not included in `dist`.

## Remaining verification limits

- No physical Android/iOS device play-test, Safari/Firefox certification, or measured real-hardware frame-rate benchmark.
- No long-session endurance or thermal test.
- Audio synthesis and user-gesture lifecycle are implemented; sound quality and balance still benefit from listening on actual speakers/headphones.
- Automated control tests do not measure subjective aiming feel, difficulty balance or mobile comfort.
- Deployment status and any verified HTTPS URL are reported separately. A local build alone is not public hosting.

Reproduce the checks with `npm test` and `npm run test:browser`. See the README for environment and deployment instructions.
