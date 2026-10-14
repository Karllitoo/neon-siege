import './style.css';
import { Game } from './game';
const app = document.querySelector<HTMLElement>('#app')!;
try {
  new Game(app);
} catch (error) {
  console.error('NEON SIEGE initialization failed', error);
  app.innerHTML =
    '<main class="error-screen"><h1>NEON SIEGE</h1><h2>Graphics system unavailable.</h2><p>This game needs WebGL 2 and a browser with hardware acceleration.<br>Enable graphics acceleration or try a current desktop browser.<br>If initialization was interrupted, reload to try again.</p><button id="retry-load">RETRY INITIALIZATION</button></main>';
  app.querySelector('#retry-load')!.addEventListener('click', () => location.reload());
}
