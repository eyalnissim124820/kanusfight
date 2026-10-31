import { STAGE_W, VIEW_W, VIEW_H } from '../game/match';

export const GROUND_Y = 478; // screen y of the floor line

export interface StageDef {
  id: string;
  name: string;
  build(): StageLayers;
}

/** A pre-rendered parallax layer: `factor` is how fast it scrolls with the camera. */
interface Layer { canvas: HTMLCanvasElement; factor: number; y: number }
type StageDraw = (ctx: CanvasRenderingContext2D, camX: number, frame: number) => void;
export interface StageLayers { layers: Layer[]; floor?: StageDraw; ambient?: StageDraw; backdrop?: StageDraw }

/**
 * A location painted as a single picture (public/backgrounds/stages/). It is scaled so it is just wide
 * enough to pan with the camera at `PAINTED_PARALLAX`, and placed so that `groundY` (a row of the
 * source image on its floor) lands on the fighters' floor line. Until it loads, a dark fill stands in.
 */
const PAINTED_PARALLAX = 0.25;
function paintedStage(id: string, name: string, file: string, groundY: number): StageDef {
  const img = new Image();
  img.src = `/backgrounds/stages/${file}`;
  return {
    id, name,
    build: () => ({
      layers: [],
      backdrop(ctx, camX) {
        if (!img.complete || !img.naturalWidth) { ctx.fillStyle = '#1a1420'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); return; }
        const w = VIEW_W + (STAGE_W - VIEW_W) * PAINTED_PARALLAX;
        const scale = w / img.naturalWidth, h = img.naturalHeight * scale;
        const y = Math.min(0, Math.max(VIEW_H - h, GROUND_Y - groundY * scale));
        ctx.drawImage(img, -Math.round(camX * PAINTED_PARALLAX), Math.round(y), w, h);
      },
    }),
  };
}

const livingRoom = paintedStage('living', 'Living Room', 'living_room.webp', 830);
const greenRoom = paintedStage('green', 'Green Room', 'green_room.webp', 830);

/** The locations offered on the Choose Location screen. */
export const STAGES: StageDef[] = [livingRoom, greenRoom];

const built = new Map<string, StageLayers>();
export function getStage(id: string): StageLayers {
  let s = built.get(id);
  if (!s) { s = (STAGES.find((x) => x.id === id) ?? STAGES[0]).build(); built.set(id, s); }
  return s;
}

export function drawStage(ctx: CanvasRenderingContext2D, s: StageLayers, camX: number, frame: number) {
  s.backdrop?.(ctx, camX, frame);
  for (const l of s.layers) ctx.drawImage(l.canvas, -Math.round(camX * l.factor), l.y);
  s.ambient?.(ctx, camX, frame);
  s.floor?.(ctx, camX, frame);
}
