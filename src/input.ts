export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  fire = false;
  firePress = false;
  yaw = 0;
  pitch = 0;
  mobile = false;
  moveX = 0;
  moveY = 0;
  private touches = new Map<number, { kind: 'move' | 'look'; x: number; y: number }>();
  onPause = () => {};
  onLockLost = () => {};
  private disposers: (() => void)[] = [];
  constructor(public canvas: HTMLCanvasElement) {
    this.mobile = matchMedia('(pointer: coarse)').matches;
    const listen = (
      target: EventTarget,
      type: string,
      fn: EventListener,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, fn, options);
      this.disposers.push(() => target.removeEventListener(type, fn, options));
    };
    listen(window, 'keydown', ((e: KeyboardEvent) => {
      if (
        ['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code) &&
        document.pointerLockElement === canvas
      )
        e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'Escape') this.onPause();
    }) as EventListener);
    listen(window, 'keyup', ((e: KeyboardEvent) => {
      this.keys.delete(e.code);
    }) as EventListener);
    listen(window, 'mousemove', ((e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        this.yaw += e.movementX;
        this.pitch += e.movementY;
      }
    }) as EventListener);
    listen(canvas, 'mousedown', ((e: MouseEvent) => {
      if (e.button === 0 && document.pointerLockElement === canvas) {
        this.fire = true;
        this.firePress = true;
      }
    }) as EventListener);
    listen(window, 'mouseup', (() => (this.fire = false)) as EventListener);
    listen(window, 'blur', (() => {
      this.reset();
      this.onLockLost();
    }) as EventListener);
    listen(document, 'visibilitychange', (() => {
      if (document.hidden) {
        this.reset();
        this.onLockLost();
      }
    }) as EventListener);
    listen(document, 'pointerlockchange', (() => {
      this.reset();
      if (document.pointerLockElement !== canvas && !this.mobile) this.onLockLost();
    }) as EventListener);
    listen(canvas, 'contextmenu', ((e: Event) => e.preventDefault()) as EventListener);
  }
  bindMobile(root: HTMLElement) {
    const joystick = root.querySelector<HTMLElement>('#joystick')!,
      look = root.querySelector<HTMLElement>('#look-zone')!,
      knob = root.querySelector<HTMLElement>('#stick-knob')!;
    const start = (e: PointerEvent, kind: 'move' | 'look') => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      let x = e.clientX,
        y = e.clientY;
      if (kind === 'move') {
        const rect = joystick.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }
      this.touches.set(e.pointerId, { kind, x, y });
      this.moveTouch(e, knob);
    };
    joystick.addEventListener('pointerdown', (e) => start(e, 'move'));
    look.addEventListener('pointerdown', (e) => start(e, 'look'));
    for (const el of [joystick, look]) {
      el.addEventListener('pointermove', (e) => this.moveTouch(e, knob));
      const end = (e: PointerEvent) => {
        const t = this.touches.get(e.pointerId);
        if (t?.kind === 'move') {
          this.moveX = 0;
          this.moveY = 0;
          knob.style.transform = 'translate(-50%, -50%)';
        }
        this.touches.delete(e.pointerId);
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }
    root.querySelectorAll<HTMLButtonElement>('[data-touch]').forEach((button) => {
      const code = button.dataset.touch!;
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        if (code === 'fire') {
          this.fire = true;
          this.firePress = true;
        } else {
          this.keys.add(code);
          this.pressed.add(code);
        }
      });
      const end = () => {
        if (code === 'fire') this.fire = false;
        else this.keys.delete(code);
      };
      button.addEventListener('pointerup', end);
      button.addEventListener('pointercancel', end);
    });
  }
  private moveTouch(e: PointerEvent, knob: HTMLElement) {
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    if (t.kind === 'move') {
      let x = (e.clientX - t.x) / 48,
        y = (e.clientY - t.y) / 48;
      const length = Math.hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }
      this.moveX = x;
      this.moveY = -y;
      knob.style.transform = `translate(calc(-50% + ${x * 38}px), calc(-50% + ${-this.moveY * 38}px))`;
    } else {
      this.yaw += (e.clientX - t.x) * 1.8;
      this.pitch += (e.clientY - t.y) * 1.8;
      t.x = e.clientX;
      t.y = e.clientY;
    }
  }
  take(code: string) {
    const value = this.pressed.has(code);
    this.pressed.delete(code);
    return value;
  }
  frameEnd() {
    this.pressed.clear();
    this.firePress = false;
    this.yaw = 0;
    this.pitch = 0;
  }
  reset() {
    this.keys.clear();
    this.pressed.clear();
    this.fire = false;
    this.firePress = false;
    this.yaw = this.pitch = 0;
    this.moveX = this.moveY = 0;
    this.touches.clear();
    document
      .querySelector<HTMLElement>('#stick-knob')
      ?.style.setProperty('transform', 'translate(-50%, -50%)');
  }
  dispose() {
    this.disposers.forEach((fn) => fn());
  }
}
