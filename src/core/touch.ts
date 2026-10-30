import type { Input } from './input';

/**
 * On-screen controls for phones and tablets.
 *
 * Left: an 8-way joystick. Right: the five attack buttons laid out like the arcade panel, plus two
 * one-tap special buttons (★1 / ★2). Top: pause. Everything presses the same key codes as the
 * player-1 keyboard layout, so menus, fights and the pause screen all work without special cases.
 * Fingers can slide between buttons (handy for combos).
 */

const DIR_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' } as const;
type Dir = keyof typeof DIR_KEYS;

interface ButtonSpec { label: string; code?: string; special?: number; cls: string; area: string }

const BUTTONS: ButtonSpec[] = [
  { label: '★1', special: 0, cls: 'sp', area: 's1' },
  { label: 'HP', code: 'KeyU', cls: 'punch', area: 'hp' },
  { label: 'HK', code: 'KeyO', cls: 'kick', area: 'hk' },
  { label: '★2', special: 1, cls: 'sp', area: 's2' },
  { label: 'LP', code: 'KeyJ', cls: 'punch', area: 'lp' },
  { label: 'LK', code: 'KeyL', cls: 'kick', area: 'lk' },
  { label: 'BLOCK', code: 'KeyK', cls: 'block', area: 'bl' },
];

const CSS = `
#touch { position: fixed; inset: 0; pointer-events: none; z-index: 10; user-select: none; -webkit-user-select: none; }
#touch * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
#touch .stick { position: absolute; pointer-events: auto; touch-action: none;
  left: calc(env(safe-area-inset-left, 0px) + 3vmin); bottom: calc(env(safe-area-inset-bottom, 0px) + 4vmin);
  width: 36vmin; height: 36vmin; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.10), rgba(255,255,255,0.04));
  border: 2px solid rgba(255,255,255,0.25); }
#touch .knob { position: absolute; left: 50%; top: 50%; width: 42%; height: 42%; margin: -21% 0 0 -21%;
  border-radius: 50%; background: rgba(255,255,255,0.35); border: 2px solid rgba(255,255,255,0.6);
  transition: transform 40ms linear; }
#touch .btns { position: absolute; pointer-events: auto; touch-action: none;
  right: calc(env(safe-area-inset-right, 0px) + 3vmin); bottom: calc(env(safe-area-inset-bottom, 0px) + 3vmin);
  display: grid; gap: 2.2vmin; grid-template-columns: repeat(3, 15vmin);
  grid-template-areas: "s1 hp hk" "s2 lp lk" "bl bl bl"; }
#touch .b { height: 15vmin; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font: bold 4.2vmin/1 Impact, "Arial Narrow Bold", sans-serif; color: #fff; text-shadow: 0 1px 2px #000;
  border: 2px solid rgba(255,255,255,0.55); opacity: 0.72; }
#touch .b.on { opacity: 1; transform: scale(0.92); filter: brightness(1.4); }
#touch .punch { background: rgba(230,110,40,0.55); }
#touch .kick { background: rgba(50,130,230,0.55); }
#touch .sp { background: rgba(230,190,40,0.5); font-size: 3.6vmin; flex-direction: column; }
#touch .sp small { font: 600 2vmin/1.1 sans-serif; margin-top: 0.6vmin; text-align: center; max-width: 13vmin; }
#touch .block { height: 9vmin; border-radius: 4.5vmin; background: rgba(140,140,160,0.5); }
#touch .pause { position: absolute; pointer-events: auto; top: calc(env(safe-area-inset-top, 0px) + 1.5vmin); left: 50%;
  transform: translateX(-50%); width: 11vmin; height: 7vmin; margin-top: 12vmin; border-radius: 2vmin;
  background: rgba(0,0,0,0.45); border: 2px solid rgba(255,255,255,0.35); color: #fff;
  font: bold 3.4vmin/7vmin sans-serif; text-align: center; display: none; }
#touch.fight .pause { display: block; }
#touch .hint { display: none; position: absolute; left: 0; right: 0; top: calc(56.25vw + 8vh);
  text-align: center; color: rgba(255,255,255,0.45); font: 600 4vw/1.4 sans-serif; }
@media (orientation: portrait) { #touch .hint { display: block; } }
`;

export interface TouchControls {
  /** Show special-move names under the ★ buttons (call when a fight starts). */
  setSpecials(names: string[]): void;
  /** The pause button is only shown during fights. */
  setInFight(on: boolean): void;
}

export const isTouchDevice = () =>
  new URLSearchParams(location.search).get('touch') === '1' ||
  (new URLSearchParams(location.search).get('touch') !== '0' &&
    (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window));

export function setupTouchControls(input: Input): TouchControls {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  document.body.classList.add('touch');

  const root = document.createElement('div');
  root.id = 'touch';
  root.innerHTML = `
    <div class="stick"><div class="knob"></div></div>
    <div class="btns">${BUTTONS.map((b, i) =>
      `<div class="b ${b.cls}" data-i="${i}" style="grid-area:${b.area}">${b.label}${b.special !== undefined ? '<small></small>' : ''}</div>`).join('')}</div>
    <div class="pause">II</div>
    <div class="hint">↻ Turn your phone sideways<br>for a bigger view</div>`;
  document.body.appendChild(root);

  // ---------- joystick ----------
  const stick = root.querySelector<HTMLDivElement>('.stick')!;
  const knob = root.querySelector<HTMLDivElement>('.knob')!;
  const held: Record<Dir, boolean> = { up: false, down: false, left: false, right: false };
  let stickId: number | null = null;

  const setDirs = (next: Record<Dir, boolean>) => {
    for (const d of Object.keys(DIR_KEYS) as Dir[]) {
      if (next[d] && !held[d]) input.virtualDown(DIR_KEYS[d]);
      if (!next[d] && held[d]) input.virtualUp(DIR_KEYS[d]);
      held[d] = next[d];
    }
  };
  const moveStick = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect();
    const rad = r.width / 2;
    let dx = (e.clientX - (r.left + rad)) / rad, dy = (e.clientY - (r.top + rad)) / rad;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    knob.style.transform = `translate(${dx * rad * 0.55}px, ${dy * rad * 0.55}px)`;
    // 8-way with a dead zone; diagonals need a clear lean on both axes
    setDirs({ right: dx > 0.38, left: dx < -0.38, up: dy < -0.45, down: dy > 0.45 });
  };
  const releaseStick = () => {
    stickId = null;
    knob.style.transform = '';
    setDirs({ up: false, down: false, left: false, right: false });
  };
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stickId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    moveStick(e);
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
  stick.addEventListener('pointerup', (e) => { if (e.pointerId === stickId) releaseStick(); });
  stick.addEventListener('pointercancel', (e) => { if (e.pointerId === stickId) releaseStick(); });

  // ---------- buttons (a finger can slide from one button to another) ----------
  const btnPad = root.querySelector<HTMLDivElement>('.btns')!;
  const els = [...btnPad.querySelectorAll<HTMLDivElement>('.b')];
  const fingers = new Map<number, number>(); // pointerId -> button index
  const press = (i: number) => {
    const b = BUTTONS[i];
    els[i].classList.add('on');
    if (b.code) input.virtualDown(b.code);
    else if (b.special !== undefined) input.specials.push(b.special);
  };
  const release = (i: number) => {
    const b = BUTTONS[i];
    // only release when no other finger still holds this button
    if ([...fingers.values()].includes(i)) return;
    els[i].classList.remove('on');
    if (b.code) input.virtualUp(b.code);
  };
  const buttonAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLDivElement>('#touch .b');
    return el ? Number(el.dataset.i) : -1;
  };
  btnPad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btnPad.setPointerCapture(e.pointerId);
    const i = buttonAt(e.clientX, e.clientY);
    if (i < 0) return;
    fingers.set(e.pointerId, i);
    press(i);
  });
  btnPad.addEventListener('pointermove', (e) => {
    if (!fingers.has(e.pointerId)) return;
    const i = buttonAt(e.clientX, e.clientY), prev = fingers.get(e.pointerId)!;
    if (i === prev || i < 0) return;
    fingers.set(e.pointerId, i);
    release(prev);
    press(i);
  });
  const lift = (e: PointerEvent) => {
    const i = fingers.get(e.pointerId);
    if (i === undefined) return;
    fingers.delete(e.pointerId);
    release(i);
  };
  btnPad.addEventListener('pointerup', lift);
  btnPad.addEventListener('pointercancel', lift);

  // ---------- pause / back ----------
  root.querySelector('.pause')!.addEventListener('pointerdown', (e) => { e.preventDefault(); input.virtualTap('Escape'); });

  // no page scrolling, zooming or long-press menus while playing
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  const spLabels = BUTTONS.map((b, i) => (b.special !== undefined ? els[i].querySelector('small') : null));
  return {
    setInFight(on) { root.classList.toggle('fight', on); },
    setSpecials(names) {
      BUTTONS.forEach((b, i) => {
        const el = spLabels[i];
        if (el && b.special !== undefined) el.textContent = names[b.special] ?? '';
      });
    },
  };
}
