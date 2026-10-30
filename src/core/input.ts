import { emptyInput, type InputFrame } from '../game/types';

type Binding = Partial<Record<keyof InputFrame, string[]>>;

/** Keyboard layouts. Buttons mirror the arcade panel: HP BL HK on top, LP BL LK below. */
export const KEYMAP: Record<'p1' | 'p2', Binding> = {
  p1: {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    HP: ['KeyU'], BL: ['KeyI', 'KeyK'], HK: ['KeyO'],
    LP: ['KeyJ'], LK: ['KeyL'],
  },
  p2: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    HP: ['Numpad7'], BL: ['Numpad8', 'Numpad5'], HK: ['Numpad9'],
    LP: ['Numpad4'], LK: ['Numpad6'],
  },
};

/** Standard-mapping gamepad: face buttons X/Y = punches, A/B = kicks, triggers/bumpers = block. */
const PAD_BUTTONS: Partial<Record<keyof InputFrame, number[]>> = {
  LP: [2], HP: [3], LK: [0], HK: [1], BL: [4, 5, 6, 7],
  up: [12], down: [13], left: [14], right: [15],
};

export class Input {
  private down = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private padPrev: boolean[][] = [];
  private padPressed: Set<number>[] = [];

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!this.down.has(e.code)) this.pressedThisFrame.add(e.code);
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  /** Call once per simulation tick, after everything has read input. */
  endFrame() {
    for (const c of this.releaseLater) this.down.delete(c);
    this.releaseLater.clear();
    this.pressedThisFrame.clear();
    this.specials = [];
  }

  // ---- virtual keys (touch controls press the same key codes the keyboard uses) ----
  private releaseLater = new Set<string>();
  /** One-tap special requests from the touch controls, consumed by the fight scene each tick. */
  specials: number[] = [];

  virtualDown(code: string) {
    if (!this.down.has(code)) this.pressedThisFrame.add(code);
    this.down.add(code);
    this.releaseLater.delete(code);
  }

  virtualUp(code: string) {
    // a tap shorter than one tick still has to be seen as held for one tick
    if (this.pressedThisFrame.has(code)) this.releaseLater.add(code);
    else this.down.delete(code);
  }

  virtualTap(code: string) {
    this.virtualDown(code);
    this.releaseLater.add(code);
  }

  pollPads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (!p) continue;
      const prev = this.padPrev[i] ?? [];
      const set = new Set<number>();
      p.buttons.forEach((b, bi) => { if (b.pressed && !prev[bi]) set.add(bi); });
      this.padPressed[i] = set;
      this.padPrev[i] = p.buttons.map((b) => b.pressed);
    }
  }

  key(code: string) { return this.down.has(code); }
  keyPressed(code: string) { return this.pressedThisFrame.has(code); }

  private pad(index: number): InputFrame | null {
    const p = navigator.getGamepads ? navigator.getGamepads()[index] : null;
    if (!p) return null;
    const f = emptyInput();
    for (const k of Object.keys(PAD_BUTTONS) as (keyof InputFrame)[]) {
      f[k] = PAD_BUTTONS[k]!.some((b) => p.buttons[b]?.pressed);
    }
    const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
    if (ax < -0.5) f.left = true;
    if (ax > 0.5) f.right = true;
    if (ay < -0.5) f.up = true;
    if (ay > 0.5) f.down = true;
    return f;
  }

  /** Read a player's controls. `layouts` lets 1P mode accept both keyboard layouts. */
  read(layouts: ('p1' | 'p2')[], padIndex: number | null): InputFrame {
    const f = emptyInput();
    for (const l of layouts) {
      const map = KEYMAP[l];
      for (const k of Object.keys(map) as (keyof InputFrame)[]) {
        if (map[k]!.some((c) => this.down.has(c))) f[k] = true;
      }
    }
    if (padIndex !== null) {
      const pf = this.pad(padIndex);
      if (pf) for (const k of Object.keys(pf) as (keyof InputFrame)[]) f[k] = f[k] || pf[k];
    }
    return f;
  }

  // ---- menu helpers (any player / any device) ----
  private anyPadPressed(buttons: number[]) {
    return this.padPressed.some((s) => s && buttons.some((b) => s.has(b)));
  }
  menuUp(layouts: ('p1' | 'p2')[] = ['p1', 'p2'], pad: number | null = null) {
    return layouts.some((l) => KEYMAP[l].up!.some((c) => this.keyPressed(c))) || this.padBtn(pad, 12);
  }
  menuDown(layouts: ('p1' | 'p2')[] = ['p1', 'p2'], pad: number | null = null) {
    return layouts.some((l) => KEYMAP[l].down!.some((c) => this.keyPressed(c))) || this.padBtn(pad, 13);
  }
  menuLeft(layouts: ('p1' | 'p2')[] = ['p1', 'p2'], pad: number | null = null) {
    return layouts.some((l) => KEYMAP[l].left!.some((c) => this.keyPressed(c))) || this.padBtn(pad, 14);
  }
  menuRight(layouts: ('p1' | 'p2')[] = ['p1', 'p2'], pad: number | null = null) {
    return layouts.some((l) => KEYMAP[l].right!.some((c) => this.keyPressed(c))) || this.padBtn(pad, 15);
  }
  confirm(layouts: ('p1' | 'p2')[] = ['p1', 'p2'], pad: number | null = null) {
    const keys = ['Enter', 'Space', 'NumpadEnter'];
    for (const l of layouts) keys.push(...KEYMAP[l].LP!, ...KEYMAP[l].HP!);
    return keys.some((c) => this.keyPressed(c)) || this.padBtn(pad, 0) || this.padBtn(pad, 9);
  }
  back() {
    return this.keyPressed('Escape') || this.keyPressed('Backspace') || this.anyPadPressed([1]);
  }
  pause() {
    return this.keyPressed('Escape') || this.keyPressed('KeyP') || this.anyPadPressed([9]);
  }

  private padBtn(pad: number | null, b: number) {
    if (pad === null) return this.anyPadPressed([b]);
    return this.padPressed[pad]?.has(b) ?? false;
  }
}
