import type { Fighter } from '../game/fighter';
import type { BasePoseKey, CharacterDef, Pose, SpriteAnim, SpriteFrame, SpriteSheetDef } from '../game/types';
import { characterHeight } from '../game/fighter';
import { BASE_POSES, lerpPose, easeOut } from './poses';
import { drawSkeleton, type DrawOpts } from './skeleton';
import { trackImage } from '../core/assets';

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
/** Returns the loaded image, or null while it is still loading (the skeleton is drawn meanwhile). */
export function spriteImage(src: string) {
  let img = spriteCache.get(src);
  if (!img) { img = new Image(); img.src = src; spriteCache.set(src, img); trackImage(img); }
  return img.complete && img.naturalWidth ? img : null;
}

const LOOPING = new Set(['idle', 'walk', 'dizzy']);

/** Resolve an animation key to its frames, following `use` aliases; falls back to idle. */
export function spriteAnim(sp: SpriteSheetDef, key: string): { frames: SpriteFrame[]; anim: SpriteAnim } | null {
  const anim = sp.play?.[key] ?? {};
  let frames = sp.atlas[anim.use ?? key];
  if (!frames) return key === 'idle' ? null : spriteAnim(sp, 'idle');
  if (anim.frames) frames = anim.frames.map((i) => frames[i]).filter(Boolean);
  return frames.length ? { frames, anim } : null;
}

/** Attack animations are driven by the move phases: windup frames → strike frame → recovery frames. */
function attackFrame(f: Fighter, n: number, hitIdx: number | undefined) {
  const m = f.move!;
  if (n === 1) return 0;
  const hit = Math.min(n - 1, hitIdx ?? (n >= 3 ? n - 2 : n - 1));
  const ph = f.phase();
  if (ph === 'startup') return hit === 0 ? 0 : Math.min(hit - 1, Math.floor((f.t / Math.max(1, m.startup)) * hit));
  if (ph === 'active') return hit;
  const after = n - 1 - hit;
  if (after <= 0) return hit;
  const k = (f.t - m.startup - m.active) / Math.max(1, m.recovery);
  return Math.min(n - 1, hit + 1 + Math.floor(k * after));
}

function timedFrame(key: string, anim: SpriteAnim, n: number, t: number) {
  const fi = Math.floor((t * (anim.fps ?? 10)) / 60);
  return (anim.loop ?? LOOPING.has(key)) ? fi % n : Math.min(n - 1, fi);
}

function spriteFilter(opts: DrawOpts) {
  const parts: string[] = [];
  if (opts.stone) parts.push(`grayscale(${opts.stone})`, `contrast(${1 - 0.25 * opts.stone})`);
  if (opts.tintAmt) parts.push(`sepia(${opts.tintAmt})`, `hue-rotate(${opts.tintAmt * 200}deg)`, `saturate(${1 + opts.tintAmt * 2})`);
  if (opts.flash) parts.push(`brightness(${1 + opts.flash * 2})`);
  return parts.length ? parts.join(' ') : 'none';
}

/** Draw one atlas frame with its anchor at (sx, sy). `height` is the on-screen standing height. */
export function blitFrame(ctx: CanvasRenderingContext2D, img: HTMLImageElement, sp: SpriteSheetDef, fr: SpriteFrame,
  sx: number, sy: number, facing: 1 | -1, height: number, opts: DrawOpts = {}) {
  const [x, y, w, h, ax, ay] = fr;
  const s = (height / sp.standHeight) * (sp.scale ?? 1);
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.filter = spriteFilter(opts);
  ctx.translate(sx, sy);
  ctx.scale(facing * s, s);
  ctx.drawImage(img, x, y, w, h, -ax, -ay, w, h);
  ctx.restore();
}

/** Draw a fighter at screen position (sx, sy) where sy is the ground line. */
export function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, sx: number, sy: number, frame: number) {
  if (f.hidden) return;
  if (f.slice > 0) { drawSliced(ctx, f, sx, sy, frame); return; }
  drawFighterBody(ctx, f, sx, sy, frame);
}

/** 'slice' finisher: draw the fighter twice, clipped on each side of a diagonal cut, sliding apart. */
function drawSliced(ctx: CanvasRenderingContext2D, f: Fighter, sx: number, sy: number, frame: number) {
  const k = f.slice, a = (25 * Math.PI) / 180, L = 600;
  const back = -f.facing; // the top half slides away from the attacker
  const d = { x: Math.cos(a) * back, y: -Math.sin(a) }; // along the cut, rising backwards
  const cx = sx, cy = sy - f.y - f.height * 0.52;
  const fade = 1 - Math.max(0, (k - 0.65) / 0.35);
  const half = (side: 1 | -1, ox: number, oy: number) => {
    // normal pointing to the kept side: up for the top half (side 1), down for the bottom half
    const p = { x: -d.y, y: d.x }, up = p.y < 0 ? 1 : -1;
    const n = { x: p.x * up * side, y: p.y * up * side };
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.moveTo(cx - d.x * L, cy - d.y * L);
    ctx.lineTo(cx + d.x * L, cy + d.y * L);
    ctx.lineTo(cx + d.x * L + n.x * L, cy + d.y * L + n.y * L);
    ctx.lineTo(cx - d.x * L + n.x * L, cy - d.y * L + n.y * L);
    ctx.closePath();
    ctx.clip();
    ctx.translate(ox, oy);
    drawFighterBody(ctx, f, sx, sy, frame);
    ctx.restore();
  };
  const slide = 110 * (1 - (1 - k) * (1 - k));
  const drop = 260 * Math.max(0, k - 0.4) ** 2;
  half(-1, 0, 0);
  half(1, d.x * slide, d.y * slide + drop);
  if (k < 0.35) { // glowing cut line
    ctx.save();
    ctx.globalAlpha = 1 - k / 0.35;
    ctx.strokeStyle = f.opponent.def.finisher.color;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - d.x * 90, cy - d.y * 90);
    ctx.lineTo(cx + d.x * 90, cy + d.y * 90);
    ctx.stroke();
    ctx.restore();
  }
}

function drawFighterBody(ctx: CanvasRenderingContext2D, f: Fighter, sx: number, sy: number, frame: number) {
  const opts: DrawOpts = {
    alpha: fighterAlpha(f),
    flash: f.flash > 0 ? 0.6 : 0,
    stone: f.stone,
    tint: f.vanish ? f.def.palette.primary : undefined,
    tintAmt: f.vanish,
  };
  const sp = f.def.sprites;
  const img = sp && spriteImage(sp.src);
  if (sp && img) {
    const key = animKey(f);
    const r = spriteAnim(sp, key);
    if (r) {
      const n = r.frames.length;
      const i = f.state === 'attack' && f.move ? attackFrame(f, n, r.anim.hit) : timedFrame(key, r.anim, n, f.t);
      blitFrame(ctx, img, sp, r.frames[i], sx, sy - f.y, f.facing, f.height, opts);
      return;
    }
  }
  const { pose, grounded } = resolvePose(f, frame);
  drawSkeleton(ctx, f.def, pose, sx, sy - f.y, f.facing, grounded, opts);
}

/**
 * Draw a character outside a fight (menus, portraits): sprite art when available, skeleton otherwise.
 * `key` is an animation key such as 'idle' or 'victory'; `t` is a frame clock.
 */
export function drawCharacter(ctx: CanvasRenderingContext2D, def: CharacterDef, key: 'idle' | 'victory',
  t: number, x: number, y: number, facing: 1 | -1, phase = 0) {
  const sp = def.sprites;
  const img = sp && spriteImage(sp.src);
  if (sp && img) {
    const r = spriteAnim(sp, key);
    if (r) {
      blitFrame(ctx, img, sp, r.frames[timedFrame(key, { fps: key === 'idle' ? 6 : 3, ...r.anim }, r.frames.length, t + phase * 20)],
        x, y, facing, characterHeight(def));
      return;
    }
  }
  const P = posesFor(def);
  const pose = key === 'idle' ? lerpPose(P.idle, P.idle2, (Math.sin(t * 0.08 + phase) + 1) / 2) : P.victory;
  drawSkeleton(ctx, def, pose, x, y, facing, true);
}
