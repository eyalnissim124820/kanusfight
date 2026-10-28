import type { BasePoseKey, Pose } from '../game/types';

/** Build a pose from the default fighting stance plus overrides. */
export const P = (o: Partial<Pose> = {}): Pose => ({ ...BASE_POSES.idle, ...o });

const LEGS_STANCE = { fh: 24, fk: -20, bh: -22, bk: -16 };
const LEGS_CROUCH = { fh: 88, fk: -122, bh: 38, bk: -128 };
const ARMS_GUARD = { fs: 52, fe: 96, bs: 34, be: 112 };

/** Shared poses used by every character unless the character overrides them. */
export const BASE_POSES: Record<BasePoseKey, Pose> = {
  idle: { torso: 6, head: -4, ...ARMS_GUARD, ...LEGS_STANCE },
  idle2: { torso: 9, head: -6, fs: 48, fe: 100, bs: 30, be: 116, ...LEGS_STANCE, y: -4 },
  walk1: { torso: 8, head: -4, ...ARMS_GUARD, fh: 32, fk: -12, bh: -26, bk: -22 },
  walk2: { torso: 8, head: -4, ...ARMS_GUARD, fh: -8, fk: -34, bh: 18, bk: -6 },
  crouch: { torso: 26, head: -18, fs: 70, fe: 92, bs: 50, be: 104, ...LEGS_CROUCH },
  jump: { torso: 12, head: -6, fs: 64, fe: 84, bs: 74, be: 66, fh: 82, fk: -112, bh: 42, bk: -104 },
  block: { torso: -2, head: -10, fs: 104, fe: 136, bs: 84, be: 142, ...LEGS_STANCE },
  crouchBlock: { torso: 18, head: -10, fs: 104, fe: 132, bs: 86, be: 138, ...LEGS_CROUCH },
  hitHigh: { torso: -22, head: -26, fs: 22, fe: 40, bs: 8, be: 34, fh: 22, fk: -10, bh: -30, bk: -12 },
  hitLow: { torso: 34, head: 16, fs: 28, fe: 64, bs: 18, be: 74, fh: 20, fk: -24, bh: -18, bk: -22 },
  airHit: { torso: -38, head: -20, fs: 150, fe: 20, bs: 128, be: 32, fh: 64, fk: -24, bh: 40, bk: -36, hip: 70 },
  lying: { torso: 0, head: 4, fs: 24, fe: 14, bs: -12, be: 10, fh: 6, fk: -4, bh: -2, bk: -8, rot: -88, hip: 14 },
  getup: { torso: 34, head: -10, fs: 30, fe: 40, bs: 10, be: 60, ...LEGS_CROUCH },
  dizzy: { torso: -4, head: 22, fs: 6, fe: 12, bs: -6, be: 16, fh: 10, fk: -6, bh: -10, bk: -6 },
  victory: { torso: -4, head: -14, fs: 168, fe: 8, bs: 158, be: 14, fh: 20, fk: -6, bh: -20, bk: -6 },
  throwing: { torso: -18, head: -12, fs: 160, fe: 30, bs: 150, be: 40, fh: 26, fk: -12, bh: -24, bk: -10 },
  thrown: { torso: -10, head: -10, fs: 150, fe: 30, bs: 140, be: 40, fh: 40, fk: -30, bh: 20, bk: -40, hip: 80 },
};

export const LEGS = { stance: LEGS_STANCE, crouch: LEGS_CROUCH };
export const ARMS = { guard: ARMS_GUARD };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const NUM_KEYS: (keyof Pose)[] = ['torso', 'head', 'fs', 'fe', 'bs', 'be', 'fh', 'fk', 'bh', 'bk'];

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = { ...b } as Pose;
  for (const k of NUM_KEYS) (out as unknown as Record<string, number>)[k] = lerp(a[k] as number, b[k] as number, t);
  out.x = lerp(a.x ?? 0, b.x ?? 0, t);
  out.y = lerp(a.y ?? 0, b.y ?? 0, t);
  out.rot = lerp(a.rot ?? 0, b.rot ?? 0, t);
  if (a.hip !== undefined || b.hip !== undefined) {
    // Interpolating explicit hip heights only makes sense if both have one; otherwise snap at halfway.
    if (a.hip !== undefined && b.hip !== undefined) out.hip = lerp(a.hip, b.hip, t);
    else out.hip = t < 0.5 ? a.hip : b.hip;
  }
  return out;
}

export const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
