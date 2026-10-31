import { text } from './hud';
import glyphs from './menuFont.json';
import { trackImage } from '../core/assets';

/**
 * Menu buttons: burgundy plaques (red with gold arrows when selected) labelled in the KANUS bitmap
 * alphabet. Art lives in public/ui/menu/; drawn at half size, nearest-neighbour, to keep it crisp.
 */

const DIR = '/ui/menu/';
const load = (f: string) => { const i = new Image(); i.src = DIR + f; return trackImage(i); };
const plaqueDefault = load('plaque_default.png');
const plaqueSelected = load('plaque_selected.png');
const plaqueSelectedArrows = load('plaque_selected_arrows.png');
const font = load('font.png');
const ready = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;

/** [x, y, w, h, yOffset within the line] per character, in atlas pixels. */
const G = glyphs as unknown as Record<string, [number, number, number, number, number]>;
const LINE_H = 39;
const TRACKING = -1;
const SPACE = 14;
/** Screen scale of the plaque art and of full-size lettering. */
export const MENU_SCALE = 0.5;
/** Widest a label may be (atlas px) before it is shrunk to fit inside the plaque. Options with arrows
 *  get less room. The limit applies in both states so a label keeps its size when highlighted. */
const MAX_LABEL_W = 350;
const MAX_LABEL_W_ARROWS = 300;

function measure(s: string): number {
  let w = 0;
  for (const ch of s) w += (ch === ' ' ? SPACE : (G[ch]?.[2] ?? SPACE)) + TRACKING;
  return Math.max(0, w - TRACKING);
}

/** Bitmap text centred on (cx, cy). `scale` maps atlas px to screen px. */
export function bitmapText(ctx: CanvasRenderingContext2D, s: string, cx: number, cy: number, scale: number) {
  s = s.toUpperCase();
  let x = cx - (measure(s) * scale) / 2;
  const top = cy - (LINE_H * scale) / 2;
  for (const ch of s) {
    const g = G[ch];
    if (g) ctx.drawImage(font, g[0], g[1], g[2], g[3], x, top + g[4] * scale, g[2] * scale, g[3] * scale);
    x += ((g ? g[2] : SPACE) + TRACKING) * scale;
  }
}

/**
 * One menu option centred on (cx, cy). `choices` marks an option that cycles with left/right
 * (e.g. difficulty): only those show the gold arrows, and only while selected.
 * Falls back to plain text until the art has loaded.
 */
export function drawMenuButton(ctx: CanvasRenderingContext2D, label: string, cx: number, cy: number, selected: boolean, choices = false) {
  const plaque = !selected ? plaqueDefault : choices ? plaqueSelectedArrows : plaqueSelected;
  if (!ready(plaque) || !ready(font)) {
    text(ctx, label, cx, cy, 30, selected ? '#ff3b2f' : '#ffffff');
    return;
  }
  const s = MENU_SCALE;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(plaque, Math.round(cx - (plaque.width * s) / 2), Math.round(cy - (plaque.height * s) / 2), plaque.width * s, plaque.height * s);
  const fit = Math.min(1, (choices ? MAX_LABEL_W_ARROWS : MAX_LABEL_W) / measure(label.toUpperCase()));
  // The selected plaque carries a drop shadow on its left, so its face sits slightly right of centre.
  bitmapText(ctx, label, cx + (selected ? 3 : 0), cy, s * fit);
  ctx.restore();
}

/** Bitmap heading (e.g. SETTINGS) without a plaque. */
export function drawMenuHeading(ctx: CanvasRenderingContext2D, label: string, cx: number, cy: number) {
  if (!ready(font)) { text(ctx, label, cx, cy, 26, '#f2d06b'); return; }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowOffsetY = 2;
  bitmapText(ctx, label, cx, cy, 0.6);
  ctx.restore();
}
