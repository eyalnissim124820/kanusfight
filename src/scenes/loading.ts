import type { App, Scene } from './scene';
import { VIEW_W, VIEW_H } from '../game/match';
import { loadProgress } from '../core/assets';

/**
 * Loading screen: the KANUS FIGHT loading card (public/ui/loading/) with its bar filling smoothly over
 * 6 seconds, then "READY!". Shown when the page opens and between choosing a location and the fight.
 * It never finishes before every tracked image has loaded; the bar waits just short of full until then.
 */

const card = (f: string) => { const i = new Image(); i.src = `/ui/loading/${f}.webp`; return i; };
const EMPTY = card('loading'); // empty bar, "LOADING..."
const FULL = card('ready'); // full bar, "READY!"
const ready = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;

// The bar's inside, as a fraction of the card (measured on the 1672×941 source art).
const BAR = { x0: 264 / 1672, x1: 1412 / 1672, y0: 680 / 941, y1: 794 / 941 };

const DURATION = 360; // 6 s at 60 fps
const READY_HOLD = 30; // the last 0.5 s shows the full card with "READY!"

export class LoadingScene implements Scene {
  private t = 0;

  /** `next` builds the scene to show afterwards (called once loading is done). */
  constructor(private app: App, private next: () => Scene) {}

  update() {
    this.t++;
    if (this.t >= DURATION && loadProgress() >= 1) this.app.setScene(this.next());
  }

  /** Bar fill 0..1: eased over the first 5.5 s, held at 97% while art is still loading. */
  private fill() {
    const k = Math.min(1, this.t / (DURATION - READY_HOLD));
    const eased = 1 - Math.pow(1 - k, 1.35); // close to even, settling gently at the end
    return loadProgress() >= 1 ? eased : Math.min(eased, 0.97);
  }

  render(ctx: CanvasRenderingContext2D) {
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.45, 40, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.7);
    g.addColorStop(0, '#2a0f1c');
    g.addColorStop(1, '#07060a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (!ready(EMPTY) || !ready(FULL)) return; // the card itself is tiny; just a dark screen until then

    // the card is 16:9 like the screen: fit it with a little margin, held still
    const w = VIEW_W * 0.96, h = w * (EMPTY.naturalHeight / EMPTY.naturalWidth);
    const x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2;
    const p = this.fill();
    if (p >= 1 && this.t >= DURATION - READY_HOLD) {
      ctx.drawImage(FULL, x, y, w, h);
      return;
    }
    ctx.drawImage(EMPTY, x, y, w, h);
    const bx0 = x + BAR.x0 * w, bx1 = x + BAR.x1 * w, by0 = y + BAR.y0 * h, by1 = y + BAR.y1 * h;
    const edge = bx0 + (bx1 - bx0) * p;
    if (p > 0) { // reveal the full bar up to the current fill
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx0, by0, edge - bx0, by1 - by0);
      ctx.clip();
      ctx.drawImage(FULL, x, y, w, h);
      ctx.restore();
    }
    // a twinkling spark at the leading edge
    const cy = (by0 + by1) / 2, r = (by1 - by0) * (0.55 + 0.12 * Math.sin(this.t * 0.4));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const s = ctx.createRadialGradient(edge, cy, 0, edge, cy, r);
    s.addColorStop(0, 'rgba(255,248,200,0.95)');
    s.addColorStop(0.35, 'rgba(255,190,60,0.55)');
    s.addColorStop(1, 'rgba(255,140,0,0)');
    ctx.fillStyle = s;
    ctx.fillRect(edge - r, cy - r, r * 2, r * 2);
    ctx.strokeStyle = 'rgba(255,255,230,0.9)';
    ctx.lineWidth = 1.5;
    const a = r * 0.9;
    ctx.beginPath();
    ctx.moveTo(edge - a, cy); ctx.lineTo(edge + a, cy);
    ctx.moveTo(edge, cy - a * 0.7); ctx.lineTo(edge, cy + a * 0.7);
    ctx.stroke();
    ctx.restore();
  }
}
