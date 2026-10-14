import type { Settings } from './settings';
export class Sound {
  context: AudioContext | null = null;
  private main: GainNode | null = null;
  private fx: GainNode | null = null;
  private music: GainNode | null = null;
  private ambience: OscillatorNode[] = [];
  constructor(public settings: Settings) {}
  unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.main = this.context.createGain();
        this.fx = this.context.createGain();
        this.music = this.context.createGain();
        this.fx.connect(this.main);
        this.music.connect(this.main);
        this.main.connect(this.context.destination);
        for (const freq of [55, 82.41, 110.1]) {
          const osc = this.context.createOscillator();
          const gain = this.context.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.value = 0.045;
          osc.connect(gain);
          gain.connect(this.music);
          osc.start();
          this.ambience.push(osc);
        }
        this.apply();
      }
      void this.context.resume();
    } catch {
      /* Audio is optional if the browser denies it. */
    }
  }
  apply() {
    if (this.context && this.main && this.fx && this.music) {
      this.main.gain.setTargetAtTime(this.settings.master, this.context.currentTime, 0.05);
      this.fx.gain.value = this.settings.effects;
      this.music.gain.value = this.settings.music;
    }
  }
  pause() {
    void this.context?.suspend();
  }
  tone(
    freq: number,
    duration = 0.12,
    volume = 0.15,
    type: OscillatorType = 'sine',
    end = frequencyFallback(freq),
  ) {
    const c = this.context;
    if (!c || c.state !== 'running' || !this.fx) return;
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, end), c.currentTime + duration);
    g.gain.setValueAtTime(volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    o.connect(g);
    g.connect(this.fx);
    o.start();
    o.stop(c.currentTime + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  weapon(index: number) {
    this.tone(
      index === 0 ? 620 : index === 1 ? 320 : 110,
      index === 2 ? 0.23 : 0.1,
      0.18,
      index === 2 ? 'sawtooth' : 'triangle',
      45,
    );
    if (index === 2) this.tone(73, 0.22, 0.18, 'square', 25);
  }
  hit(kill = false) {
    this.tone(kill ? 1050 : 850, kill ? 0.16 : 0.055, 0.07, 'sine', kill ? 1500 : 600);
  }
  pickup() {
    this.tone(700, 0.2, 0.12, 'sine', 1200);
  }
  wave() {
    this.tone(330, 0.55, 0.15, 'triangle', 660);
  }
  warning() {
    this.tone(120, 0.7, 0.14, 'sawtooth', 70);
  }
  dispose() {
    this.ambience.forEach((o) => o.stop());
    void this.context?.close();
  }
}
function frequencyFallback(freq: number) {
  return freq * 0.7;
}
