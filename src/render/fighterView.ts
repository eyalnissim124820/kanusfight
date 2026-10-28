import type { Fighter } from '../game/fighter';
import type { BasePoseKey, CharacterDef, Pose } from '../game/types';
import { BASE_POSES, lerpPose, easeOut } from './poses';
import { drawSkeleton, type DrawOpts } from './skeleton';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function posesFor(def: CharacterDef): Record<BasePoseKey, Pose> {
  return { ...BASE_POSES, ...(def.poses ?? {}) } as Record<BasePoseKey, Pose>;
}

/** Pick the skeleton pose for a fighter's current state. `frame` is a global animation clock. */
export function resolvePose(f: Fighter, frame: number): { pose: Pose; grounded: boolean } {
  const P = posesFor(f.def);
  const t = f.t;
  const grounded = !f.airborne;
  switch (f.state) {
    case 'idle': return { pose: lerpPose(P.idle, P.idle2, (Math.sin(frame * 0.08 + f.side) + 1) / 2), grounded };
    case 'walk': return { pose: lerpPose(P.walk1, P.walk2, (Math.sin(f.walkPhase * 0.085) + 1) / 2), grounded };
    case 'crouch': return { pose: lerpPose(P.idle, P.crouch, clamp01(t / 4)), grounded };
    case 'block': case 'blockstun': {
      const p = f.crouchBlock ? P.crouchBlock : P.block;
      return { pose: f.state === 'blockstun' ? { ...p, x: -4 } : p, grounded };
    }
    case 'prejump': return { pose: lerpPose(P.idle, P.crouch, 0.45), grounded };
    case 'jump': return { pose: jumpPose(f, P), grounded: false };
    case 'land': return { pose: lerpPose(P.crouch, P.idle, clamp01(t / Math.max(1, f.landTime))), grounded };
    case 'attack': return attackPose(f, P);
    case 'hitstun': {
      const target = f.hitAnim === 'high' ? P.hitHigh : P.hitLow;
      const k = t < 4 ? t / 4 : 1 - clamp01((t - f.stun + 6) / 6);
      return { pose: lerpPose(P.idle, target, easeOut(clamp01(k))), grounded };
    }
    case 'airHit': {
      const rot = Math.max(-95, -25 - t * 4);
      return { pose: { ...P.airHit, rot, hip: f.def.body.thigh * 0.6 }, grounded: false };
    }
    case 'knockdown': case 'ko': return { pose: P.lying, grounded: true };
    case 'getup': {
      const k = t / 22;
      return { pose: k < 0.5 ? lerpPose(P.lying, P.getup, k * 2) : lerpPose(P.getup, P.idle, (k - 0.5) * 2), grounded: true };
    }
    case 'throwing': {
      const k = t < 14 ? t / 14 : 1 - clamp01((t - 30) / 10);
      return { pose: lerpPose(P.idle, P.throwing, easeOut(k)), grounded };
    }
    case 'thrown': return { pose: { ...P.thrown, rot: -t * 7 }, grounded: false };
    case 'dizzy': case 'finished': {
      const s = Math.sin(frame * 0.09), c = Math.cos(frame * 0.07);
      const p = { ...P.dizzy, x: s * 6, torso: P.dizzy.torso + s * 7, head: P.dizzy.head + c * 10 };
      return { pose: f.state === 'finished' ? P.dizzy : p, grounded };
    }
    case 'victory': return { pose: lerpPose(P.idle, P.victory, easeOut(clamp01(t / 14))), grounded };
    case 'finisher': return { pose: lerpPose(P.idle, f.def.finisher.pose, easeOut(clamp01(t / 10))), grounded };
  }
}

function jumpPose(f: Fighter, P: Record<BasePoseKey, Pose>): Pose {
  const jv = f.def.stats.jumpVel;
  const k = clamp01((jv - f.vy) / (2 * jv));
  if (f.jumpDir === 0) return lerpPose(P.jump, P.idle, 0.35 + 0.3 * Math.abs(k - 0.5));
  // diagonal jumps flip (a classic arcade touch)
  const flip = clamp01((k - 0.1) / 0.75);
  return { ...P.jump, rot: f.jumpDir * 360 * easeOut(flip) };
}

function attackPose(f: Fighter, P: Record<BasePoseKey, Pose>): { pose: Pose; grounded: boolean } {
  const m = f.move!;
  const grounded = !f.airborne;
  const base = m.air ? P.jump : m.crouching ? P.crouch : P.idle;
  const { windup, strike, recover } = m.poses;
  const t = f.t, ph = f.phase();
  let pose: Pose;
  if (ph === 'startup') {
    const k = t / Math.max(1, m.startup);
    pose = k < 0.7 ? lerpPose(base, windup, easeOut(k / 0.7)) : lerpPose(windup, strike, (k - 0.7) / 0.3);
  } else if (ph === 'active') {
    pose = strike;
    if (m.spin) pose = { ...strike, rot: (strike.rot ?? 0) + m.spin * (t - m.startup) };
  } else {
    const k = (t - m.startup - m.active) / Math.max(1, m.recovery);
    pose = lerpPose(strike, recover ?? base, easeOut(clamp01(k)));
  }
  return { pose, grounded: grounded && pose.hip === undefined ? true : grounded };
}

export function fighterAlpha(f: Fighter) {
  let a = 1;
  const m = f.move;
  if (f.state === 'attack' && m?.teleport) {
    a = f.t < m.startup ? 1 - f.t / m.startup : clamp01((f.t - m.startup) / 10);
  }
  if (f.vanish) a *= 1 - f.vanish;
  if (f.state === 'getup' || (f.invuln > 0 && f.state === 'idle')) a *= 0.75 + 0.25 * Math.sin(f.t * 0.8);
  return a;
}

/** Map fighter state -> animation key (used for sprite sheets). */
export function animKey(f: Fighter): string {
  switch (f.state) {
    case 'attack': return f.moveId;
    case 'hitstun': return f.hitAnim === 'high' ? 'hitHigh' : 'hitLow';
    case 'block': case 'blockstun': return f.crouchBlock ? 'crouchBlock' : 'block';
    case 'knockdown': case 'ko': return 'lying';
    case 'prejump': return 'crouch';
    case 'land': return 'crouch';
    case 'finished': return 'dizzy';
    default: return f.state;
  }
}

const spriteCache = new Map<string, HTMLImageElement>();
function spriteImage(src: string) {
  let img = spriteCache.get(src);
  if (!img) { img = new Image(); img.src = src; spriteCache.set(src, img); }
  return img.complete && img.naturalWidth ? img : null;
}

/** Draw a fighter at screen position (sx, sy) where sy is the ground line. */
export function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, sx: number, sy: number, frame: number) {
  if (f.hidden) return;
  const opts: DrawOpts = {
    alpha: fighterAlpha(f),
    flash: f.flash > 0 ? 0.6 : 0,
    stone: f.stone,
    tint: f.vanish ? f.def.palette.primary : undefined,
    tintAmt: f.vanish,
  };
  const sp = f.def.sprites;
  if (sp) {
    const img = spriteImage(sp.src);
    if (img) { drawSprite(ctx, f, img, sx, sy, opts); return; }
  }
  const { pose, grounded } = resolvePose(f, frame);
  drawSkeleton(ctx, f.def, pose, sx, sy - f.y, f.facing, grounded, opts);
}

function drawSprite(ctx: CanvasRenderingContext2D, f: Fighter, img: HTMLImageElement, sx: number, sy: number, opts: DrawOpts) {
  const sp = f.def.sprites!;
  const key = animKey(f);
  const a = sp.anims[key] ?? sp.anims.idle;
  if (!a) return;
  let frameIdx: number;
  if (f.state === 'attack' && f.move) {
    const total = f.move.startup + f.move.active + f.move.recovery;
    frameIdx = Math.min(a.frames - 1, Math.floor((f.t / Math.max(1, total)) * a.frames));
  } else {
    const fi = Math.floor((f.t * (a.fps ?? 10)) / 60);
    frameIdx = a.loop === false ? Math.min(a.frames - 1, fi) : fi % a.frames;
  }
  const s = (sp.scale ?? 1) * f.def.body.scale;
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.translate(sx, sy - f.y);
  ctx.scale(f.facing * s, s);
  ctx.drawImage(img, frameIdx * sp.frameW, a.row * sp.frameH, sp.frameW, sp.frameH, -sp.anchorX, -sp.anchorY, sp.frameW, sp.frameH);
  if (opts.flash) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4;
    ctx.drawImage(img, frameIdx * sp.frameW, a.row * sp.frameH, sp.frameW, sp.frameH, -sp.anchorX, -sp.anchorY, sp.frameW, sp.frameH);
  }
  ctx.restore();
}
