import { VIEW_W, VIEW_H } from '../game/match';
import { text } from './hud';

/**
 * Layered, animated title-screen backdrop.
 *
 * The art is authored on a 1920x1080 base canvas (2x the view) and drawn at 0.5 scale, so all
 * numbers in LAYERS are base-canvas pixels. Images are built from the generator's output by
 * tools/build_title_layers.py into public/backgrounds/title/.
 */

const BASE_W = VIEW_W * 2;
const DIR = '/backgrounds/title/';
/** Largest parallax travel, base px, for a layer with factor 1. Each layer moves MAX_SHIFT * parallax. */
const MAX_SHIFT = 400;

type Anim =
  | { type: 'sway'; deg: number; speed: number; phase: number } // rotate around the anchor
  | { type: 'pulse'; speed: number } // sun glow: alpha 0.9-1.0, size fixed
  | { type: 'bob'; px: number; speed: number } // vertical bob
  | { type: 'frames'; count: number; every: number }; // horizontal sprite strip

interface Layer {
  file: string;
  z: number;
  /** Where the anchor point of the image lands on the base canvas. */
  x: number;
  y: number;
  /** Anchor (and rotation pivot) as a fraction of the image (or of one frame of a strip). */
  anchor: [number, number];
  /** 0 = locked to the screen, 1 = full MAX_SHIFT travel. */
  parallax: number;
  /** Tiles horizontally, drifting left this many screen px per frame. */
  drift?: number;
  anim?: Anim;
}

const LAYERS: Layer[] = [
  // The sun, its reflection and the town are locked in place; the rest of the scene pans around them.
  { file: 'sky', z: 0, x: 960, y: 0, anchor: [0.5, 0], parallax: 0.05 },
  { file: 'clouds_far', z: 1, x: 0, y: 200, anchor: [0, 0], parallax: 0.1, drift: 0.15 },
  { file: 'sun', z: 2, x: 380, y: 560, anchor: [0.5, 0.5], parallax: 0, anim: { type: 'pulse', speed: 0.025 } },
  { file: 'clouds_near', z: 3, x: 0, y: 110, anchor: [0, 0], parallax: 0.2, drift: 0.35 },
  { file: 'mountains', z: 4, x: 960, y: 620, anchor: [0.5, 1], parallax: 0.3 },
  { file: 'town', z: 5, x: 1440, y: 622, anchor: [0.5, 1], parallax: 0 },
  { file: 'sea', z: 6, x: 960, y: 620, anchor: [0.5, 0], parallax: 0.5 },
  { file: 'sea_glitter', z: 6.5, x: 380, y: 620, anchor: [0.5, 0], parallax: 0, anim: { type: 'frames', count: 4, every: 9 } },
  // The frame layers are exactly canvas-wide (no slack to pan), so they stay locked.
  { file: 'balustrade', z: 7, x: 0, y: 650, anchor: [0, 0], parallax: 0 },
  { file: 'floor', z: 8, x: 0, y: 830, anchor: [0, 0], parallax: 0 },
  { file: 'arches', z: 9, x: 0, y: 0, anchor: [0, 0], parallax: 0 },
  { file: 'vines_left', z: 10, x: 14, y: 26, anchor: [0.06, 0.03], parallax: 0, anim: { type: 'sway', deg: 2, speed: 0.02, phase: 0 } },
  { file: 'vines_right', z: 10, x: 1906, y: 26, anchor: [0.94, 0.03], parallax: 0, anim: { type: 'sway', deg: 2, speed: 0.02, phase: 2.1 } },
  { file: 'banner_left', z: 10, x: 295, y: 115, anchor: [0.5, 0], parallax: 0, anim: { type: 'sway', deg: 3, speed: 0.028, phase: 0.8 } },
  { file: 'banner_right', z: 10, x: 1625, y: 115, anchor: [0.5, 0], parallax: 0, anim: { type: 'sway', deg: 3, speed: 0.028, phase: 2.6 } },
  { file: 'frame_border', z: 10.5, x: 0, y: 0, anchor: [0, 0], parallax: 0 },
  { file: 'logo', z: 11, x: 960, y: 220, anchor: [0.5, 0.5], parallax: 0, anim: { type: 'bob', px: 4, speed: 0.035 } },
].sort((a, b) => a.z - b.z) as Layer[];

const PLAQUE_KEYS: Layer = { file: 'plaque_keys', z: 11, x: 960, y: 1010, anchor: [0.5, 0.5], parallax: 0 };
const PLAQUE_BLANK: Layer = { ...PLAQUE_KEYS, file: 'plaque_blank' };

/** Without all of these the layered scene would look broken, so the flat image is drawn instead. */
const CORE = ['sky', 'sea', 'arches', 'logo'];

const images = new Map<string, HTMLImageElement>();
for (const l of [...LAYERS, PLAQUE_KEYS, PLAQUE_BLANK]) {
  const img = new Image();
  img.src = `${DIR}${l.file}.png`;
  images.set(l.file, img);
}
const flat = new Image();
flat.src = '/backgrounds/title.webp';

const ready = (img: HTMLImageElement | undefined): img is HTMLImageElement => !!img && img.complete && img.naturalWidth > 0;

function drawLayer(ctx: CanvasRenderingContext2D, l: Layer, f: number, pan: number) {
  const img = images.get(l.file);
  if (!ready(img)) return;
  const a = l.anim;
  const fw = a?.type === 'frames' ? img.width / a.count : img.width;
  const h = img.height;
  let off = -pan * MAX_SHIFT * l.parallax;

  if (l.drift) {
    // Two copies side by side, wrapped, cover the canvas because every tiling layer is wider than it.
    const s = (((off - l.drift * 2 * f) % fw) + fw) % fw;
    ctx.drawImage(img, s - fw, l.y);
    ctx.drawImage(img, s, l.y);
    return;
  }

  const left = l.x - l.anchor[0] * fw;
  if (left <= 0 && left + fw >= BASE_W) off = Math.max(BASE_W - (left + fw), Math.min(-left, off)); // never show an edge

  ctx.save();
  ctx.translate(l.x + off, l.y + (a?.type === 'bob' ? Math.sin(f * a.speed) * a.px : 0));
  let sx = 0;
  if (a?.type === 'sway') ctx.rotate((a.deg * Math.PI / 180) * Math.sin(f * a.speed + a.phase));
  else if (a?.type === 'pulse') {
    const t = 0.5 + 0.5 * Math.sin(f * a.speed);
    ctx.globalAlpha = 0.9 + 0.1 * t;
  } else if (a?.type === 'frames') sx = (Math.floor(f / a.every) % a.count) * fw;
  ctx.drawImage(img, sx, 0, fw, h, -l.anchor[0] * fw, -l.anchor[1] * h, fw, h);
  ctx.restore();
}

/** Run `draw` in base-canvas coordinates with crisp pixels, restoring the context afterwards. */
function inBase(ctx: CanvasRenderingContext2D, draw: () => void) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.scale(VIEW_W / BASE_W, VIEW_W / BASE_W);
  draw();
  ctx.restore();
}

/** `logo: false` leaves out the title logo, for screens that put their own heading there. */
export function drawTitleBackdrop(ctx: CanvasRenderingContext2D, frame: number, { logo = true } = {}) {
  if (!CORE.every((k) => (!logo && k === 'logo') || ready(images.get(k)))) {
    // The flat fallback has the logo baked in, so it only stands in when the logo is wanted.
    if (logo && ready(flat)) ctx.drawImage(flat, 0, 0, VIEW_W, VIEW_H);
    else { ctx.fillStyle = '#2a1340'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    return;
  }
  const pan = Math.sin(frame * 0.003);
  inBase(ctx, () => { for (const l of LAYERS) if (logo || l.file !== 'logo') drawLayer(ctx, l, frame, pan); });
}

/** The "ENTER / J TO SELECT" plaque, or a blank one carrying the touch hint. */
export function drawTitlePlaque(ctx: CanvasRenderingContext2D, touch: boolean) {
  inBase(ctx, () => drawLayer(ctx, touch ? PLAQUE_BLANK : PLAQUE_KEYS, 0, 0));
  if (touch) text(ctx, 'STICK TO CHOOSE · HP OR LP TO SELECT', VIEW_W / 2, PLAQUE_KEYS.y / 2, 15, '#f2e2b8', 'center', '#2a1208');
}
