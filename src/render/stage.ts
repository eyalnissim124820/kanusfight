import { STAGE_W, VIEW_W, VIEW_H } from '../game/match';

export const GROUND_Y = 478; // screen y of the floor line

export interface StageDef {
  id: string;
  name: string;
  build(): StageLayers;
}

interface Layer { canvas: HTMLCanvasElement; factor: number; y: number }
export interface StageLayers { layers: Layer[]; floor: (ctx: CanvasRenderingContext2D, camX: number, frame: number) => void; ambient?: (ctx: CanvasRenderingContext2D, camX: number, frame: number) => void }

function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

function layerCanvas(factor: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(VIEW_W + (STAGE_W - VIEW_W) * factor) + 4;
  c.height = h;
  return c;
}

/** Dusk temple courtyard. */
const emberTemple: StageDef = {
  id: 'ember', name: 'Ember Temple',
  build() {
    const r = rng(7);
    const sky = layerCanvas(0, VIEW_H);
    {
      const g = sky.getContext('2d')!;
      const gr = g.createLinearGradient(0, 0, 0, VIEW_H);
      gr.addColorStop(0, '#1c0c24'); gr.addColorStop(0.45, '#7a2a2a'); gr.addColorStop(0.75, '#e0763a'); gr.addColorStop(1, '#f4b860');
      g.fillStyle = gr; g.fillRect(0, 0, sky.width, VIEW_H);
      g.fillStyle = 'rgba(255,220,150,0.9)';
      g.beginPath(); g.arc(VIEW_W * 0.68, 300, 70, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.6})`; g.fillRect(r() * sky.width, r() * 180, 2, 2); }
    }
    const far = layerCanvas(0.2, VIEW_H);
    {
      const g = far.getContext('2d')!;
      g.fillStyle = '#3a1828';
      g.beginPath(); g.moveTo(0, 380);
      for (let x = 0; x <= far.width; x += 40) g.lineTo(x, 300 + Math.sin(x * 0.006) * 50 + r() * 30);
      g.lineTo(far.width, VIEW_H); g.lineTo(0, VIEW_H); g.fill();
    }
    const mid = layerCanvas(0.55, VIEW_H);
    {
      const g = mid.getContext('2d')!;
      for (let i = 0; i < 6; i++) {
        const x = 120 + i * 260 + r() * 60, w = 120 + r() * 40, h = 150 + r() * 70;
        g.fillStyle = '#24101a';
        for (let tier = 0; tier < 3; tier++) {
          const ty = 410 - h + tier * (h / 3), tw = w * (0.6 + tier * 0.2);
          g.fillRect(x - tw / 2 + 8, ty + 12, tw - 16, h / 3);
          g.beginPath(); g.moveTo(x - tw / 2 - 20, ty + 18); g.quadraticCurveTo(x, ty - 14, x + tw / 2 + 20, ty + 18); g.lineTo(x + tw / 2, ty + 26); g.lineTo(x - tw / 2, ty + 26); g.fill();
        }
        g.fillStyle = 'rgba(255,170,80,0.55)';
        g.fillRect(x - 6, 410 - h * 0.45, 12, 16);
      }
    }
    const near = layerCanvas(1, VIEW_H);
    {
      const g = near.getContext('2d')!;
      for (let i = 0; i < 9; i++) {
        const x = 40 + i * 200;
        g.fillStyle = '#2d1414'; g.fillRect(x - 14, 200, 28, GROUND_Y - 200);
        g.fillStyle = '#4a2018'; g.fillRect(x - 20, 196, 40, 12); g.fillRect(x - 20, GROUND_Y - 18, 40, 18);
        g.fillStyle = '#d24a2a'; g.fillRect(x - 4, 220, 8, 24);
      }
      g.fillStyle = '#2d1414'; g.fillRect(0, 186, near.width, 14);
    }
    return {
      layers: [{ canvas: sky, factor: 0, y: 0 }, { canvas: far, factor: 0.2, y: 0 }, { canvas: mid, factor: 0.55, y: 0 }, { canvas: near, factor: 0.92, y: 0 }],
      floor: (ctx, camX) => floor(ctx, camX, '#5a3326', '#3a1f18', 'rgba(255,190,120,0.12)'),
      ambient: (ctx, camX, frame) => lanterns(ctx, camX, frame),
    };
  },
};

/** Moonlit rooftop bridge. */
const moonBridge: StageDef = {
  id: 'moon', name: 'Moon Bridge',
  build() {
    const r = rng(42);
    const sky = layerCanvas(0, VIEW_H);
    {
      const g = sky.getContext('2d')!;
      const gr = g.createLinearGradient(0, 0, 0, VIEW_H);
      gr.addColorStop(0, '#05060f'); gr.addColorStop(0.6, '#162444'); gr.addColorStop(1, '#2b4a6b');
      g.fillStyle = gr; g.fillRect(0, 0, sky.width, VIEW_H);
      for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(220,230,255,${r() * 0.8})`; g.fillRect(r() * sky.width, r() * 300, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1); }
      const mg = g.createRadialGradient(VIEW_W * 0.3, 130, 10, VIEW_W * 0.3, 130, 160);
      mg.addColorStop(0, 'rgba(230,240,255,1)'); mg.addColorStop(0.35, 'rgba(200,220,255,0.9)'); mg.addColorStop(0.4, 'rgba(120,160,220,0.25)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = mg; g.fillRect(0, 0, sky.width, 320);
    }
    const far = layerCanvas(0.2, VIEW_H);
    {
      const g = far.getContext('2d')!;
      g.fillStyle = '#0d1426';
      for (let x = 0; x < far.width; x += 30 + r() * 40) {
        const w = 30 + r() * 60, h = 80 + r() * 200;
        g.fillRect(x, 420 - h, w, h + 200);
        g.fillStyle = 'rgba(255,220,140,0.5)';
        for (let k = 0; k < 6; k++) if (r() < 0.5) g.fillRect(x + 4 + r() * (w - 10), 420 - h + 10 + r() * (h - 20), 3, 4);
        g.fillStyle = '#0d1426';
      }
    }
    const mid = layerCanvas(0.55, VIEW_H);
    {
      const g = mid.getContext('2d')!;
      g.strokeStyle = '#1b2840'; g.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        const x0 = i * 520;
        g.beginPath(); g.moveTo(x0, 240); g.quadraticCurveTo(x0 + 260, 400, x0 + 520, 240); g.stroke();
        g.fillStyle = '#1b2840'; g.fillRect(x0 - 12, 200, 24, 260);
      }
      g.lineWidth = 2;
      for (let x = 0; x < mid.width; x += 26) { g.beginPath(); g.moveTo(x, 300 + Math.abs(((x % 520) - 260) / 260) * -60 + 60); g.lineTo(x, 440); g.stroke(); }
    }
    const near = layerCanvas(1, VIEW_H);
    {
      const g = near.getContext('2d')!;
      g.fillStyle = '#121a2c';
      g.fillRect(0, GROUND_Y - 70, near.width, 10);
      for (let x = 0; x < near.width; x += 60) g.fillRect(x, GROUND_Y - 70, 8, 70);
    }
    return {
      layers: [{ canvas: sky, factor: 0, y: 0 }, { canvas: far, factor: 0.2, y: 0 }, { canvas: mid, factor: 0.55, y: 0 }, { canvas: near, factor: 0.92, y: 0 }],
      floor: (ctx, camX) => floor(ctx, camX, '#2c3a52', '#151d2e', 'rgba(170,200,255,0.12)'),
    };
  },
};

function floor(ctx: CanvasRenderingContext2D, camX: number, top: string, bottom: string, line: string) {
  const gr = ctx.createLinearGradient(0, GROUND_Y - 20, 0, VIEW_H);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  ctx.fillStyle = gr;
  ctx.fillRect(0, GROUND_Y - 20, VIEW_W, VIEW_H - GROUND_Y + 20);
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  // perspective tiles: vanishing point above the middle of the stage
  const vpX = STAGE_W / 2 - camX;
  for (let i = -16; i <= 16; i++) {
    const xb = vpX + i * 140;
    ctx.beginPath();
    ctx.moveTo(vpX + i * 70, GROUND_Y - 20);
    ctx.lineTo(xb, VIEW_H);
    ctx.stroke();
  }
  for (const y of [GROUND_Y - 6, GROUND_Y + 14, GROUND_Y + 40]) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y); ctx.stroke();
  }
}

function lanterns(ctx: CanvasRenderingContext2D, camX: number, frame: number) {
  for (let i = 0; i < 9; i++) {
    const x = 140 + i * 200 - camX * 0.92;
    if (x < -40 || x > VIEW_W + 40) continue;
    const sway = Math.sin(frame * 0.03 + i) * 4;
    const y = 250;
    ctx.strokeStyle = '#1a0a0a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 200); ctx.lineTo(x + sway, y - 16); ctx.stroke();
    const g = ctx.createRadialGradient(x + sway, y, 2, x + sway, y, 46);
    g.addColorStop(0, 'rgba(255,200,110,0.55)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.fillRect(x + sway - 46, y - 46, 92, 92);
    ctx.fillStyle = '#e8562c';
    ctx.beginPath(); ctx.ellipse(x + sway, y, 11, 15, 0, 0, Math.PI * 2); ctx.fill();
  }
}

export const STAGES: StageDef[] = [emberTemple, moonBridge];

const built = new Map<string, StageLayers>();
export function getStage(id: string): StageLayers {
  let s = built.get(id);
  if (!s) { s = (STAGES.find((x) => x.id === id) ?? STAGES[0]).build(); built.set(id, s); }
  return s;
}

export function drawStage(ctx: CanvasRenderingContext2D, s: StageLayers, camX: number, frame: number) {
  for (const l of s.layers) ctx.drawImage(l.canvas, -Math.round(camX * l.factor), l.y);
  s.ambient?.(ctx, camX, frame);
  s.floor(ctx, camX, frame);
}
