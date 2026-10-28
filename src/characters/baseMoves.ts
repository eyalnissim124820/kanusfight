import type { MoveDef, NormalMoves, NormalMoveKey } from '../game/types';
import { P, LEGS, ARMS } from '../render/poses';

/**
 * The standard move set every fighter gets (the "normals").
 * Frame data is at 60fps. Hitboxes are tuned for a fighter about 190px tall (body.scale = 1)
 * and are scaled with the character's body.scale at runtime.
 *
 * Input map (MK-style 5 buttons):
 *   LP jab · HP high punch · LK low kick · HK high kick · BL block
 *   close LP = throw · close HP = elbow · close HK = knee
 *   back+LK = sweep · back+HK = roundhouse · down+HP = uppercut
 *   down+LP / down+LK / down+HK = crouching attacks · punches/kicks in the air = jump attacks
 */
export function createBaseMoves(): NormalMoves {
  return {
    lp: {
      name: 'Jab', startup: 4, active: 3, recovery: 8, damage: 3,
      hitbox: { x: 18, y: 128, w: 78, h: 26 }, height: 'high',
      hitstun: 14, blockstun: 8, knockback: { x: 3, y: 0 }, sfx: 'whoosh', hitSfx: 'hitLight',
      poses: {
        windup: P({ fs: 70, fe: 70, torso: 8 }),
        strike: P({ fs: 92, fe: 2, torso: 14, x: 4 }),
      },
    },
    hp: {
      name: 'High Punch', startup: 6, active: 3, recovery: 14, damage: 6,
      hitbox: { x: 22, y: 134, w: 90, h: 26 }, height: 'high',
      hitstun: 18, blockstun: 10, knockback: { x: 6, y: 0 }, sfx: 'whoosh', hitSfx: 'hitHeavy',
      poses: {
        windup: P({ bs: 40, be: 110, fs: 40, fe: 110, torso: -2 }),
        strike: P({ bs: 96, be: 0, fs: 30, fe: 100, torso: 22, x: 8, fh: 34, bh: -30 }),
      },
    },
    closeHp: {
      name: 'Elbow', startup: 4, active: 3, recovery: 10, damage: 5,
      hitbox: { x: 10, y: 120, w: 58, h: 40 }, height: 'high',
      hitstun: 16, blockstun: 8, knockback: { x: 5, y: 0 }, sfx: 'whoosh', hitSfx: 'hitHeavy',
      poses: {
        windup: P({ fs: 30, fe: 150, torso: -4 }),
        strike: P({ fs: 100, fe: 120, torso: 18, x: 6 }),
      },
    },
    lk: {
      name: 'Low Kick', startup: 6, active: 3, recovery: 12, damage: 5,
      hitbox: { x: 30, y: 58, w: 84, h: 30 }, height: 'mid',
      hitstun: 16, blockstun: 9, knockback: { x: 5, y: 0 }, sfx: 'whoosh', hitSfx: 'hitLight',
      poses: {
        windup: P({ fh: 70, fk: -100, torso: -4 }),
        strike: P({ fh: 82, fk: 0, torso: -12, bh: -10, bk: -6 }),
      },
    },
    hk: {
      name: 'High Kick', startup: 8, active: 4, recovery: 16, damage: 8,
      hitbox: { x: 28, y: 118, w: 94, h: 42 }, height: 'high',
      hitstun: 20, blockstun: 12, knockback: { x: 8, y: 0 }, sfx: 'whooshHeavy', hitSfx: 'hitHeavy',
      poses: {
        windup: P({ fh: 92, fk: -112, torso: -14 }),
        strike: P({ fh: 128, fk: -4, torso: -28, bh: -6, bk: -4, fs: 40, bs: 10 }),
      },
    },
    closeHk: {
      name: 'Knee', startup: 5, active: 3, recovery: 12, damage: 7,
      hitbox: { x: 12, y: 70, w: 52, h: 54 }, height: 'mid',
      hitstun: 18, blockstun: 10, knockback: { x: 6, y: 0 }, sfx: 'whoosh', hitSfx: 'hitHeavy',
      poses: {
        windup: P({ fh: 60, fk: -80 }),
        strike: P({ fh: 104, fk: -134, torso: 12, fs: 100, fe: 60, bs: 90, be: 60, bh: -8, bk: -4 }),
      },
    },
    sweep: {
      name: 'Sweep', startup: 8, active: 4, recovery: 22, damage: 8,
      hitbox: { x: 20, y: 0, w: 116, h: 30 }, height: 'low', knockdown: true, crouching: true,
      hitstun: 20, blockstun: 12, knockback: { x: 4, y: 0 }, sfx: 'whoosh', hitSfx: 'hitHeavy',
      poses: {
        windup: P({ ...LEGS.crouch, torso: 40, fs: 100, fe: 10, bs: 70, be: 20 }),
        strike: P({ fh: 94, fk: 0, bh: 30, bk: -132, torso: 56, head: -30, fs: 120, fe: 0, bs: 100, be: 0, hip: 34 }),
      },
    },
    roundhouse: {
      name: 'Roundhouse', startup: 10, active: 4, recovery: 20, damage: 10,
      hitbox: { x: 26, y: 108, w: 104, h: 54 }, height: 'high', knockdown: true,
      hitstun: 22, blockstun: 14, knockback: { x: 10, y: 8 }, shake: 4, sfx: 'whooshHeavy', hitSfx: 'hitHeavy',
      poses: {
        windup: P({ torso: 30, fh: 30, fk: -40, bh: -40, bk: -20, rot: 20 }),
        strike: P({ torso: -34, fh: 112, fk: 0, bh: -12, bk: -8, fs: -10, bs: 30, head: -10 }),
      },
    },
    uppercut: {
      name: 'Uppercut', startup: 6, active: 4, recovery: 22, damage: 14,
      hitbox: { x: 8, y: 110, w: 72, h: 100 }, height: 'mid',
      hitstun: 30, blockstun: 14, knockback: { x: 5, y: 20 }, shake: 8, sfx: 'whooshHeavy', hitSfx: 'hitHeavy',
      poses: {
        windup: P({ ...LEGS.crouch, torso: 30, fs: -10, fe: 70, bs: 40, be: 100 }),
        strike: P({ torso: -6, head: -16, fs: 168, fe: 8, bs: 30, be: 90, fh: 14, fk: -4, bh: -14, bk: -4, x: 6 }),
      },
    },
    crouchLp: {
      name: 'Low Jab', startup: 4, active: 3, recovery: 8, damage: 3, crouching: true,
      hitbox: { x: 20, y: 62, w: 72, h: 24 }, height: 'mid',
      hitstun: 14, blockstun: 8, knockback: { x: 3, y: 0 }, sfx: 'whoosh', hitSfx: 'hitLight',
      poses: {
        windup: P({ ...LEGS.crouch, torso: 26, fs: 60, fe: 70 }),
        strike: P({ ...LEGS.crouch, torso: 30, fs: 94, fe: 0, bs: 50, be: 100 }),
      },
    },
    crouchLk: {
      name: 'Low Poke', startup: 4, active: 3, recovery: 10, damage: 4, crouching: true,
      hitbox: { x: 24, y: 0, w: 92, h: 32 }, height: 'low',
      hitstun: 14, blockstun: 8, knockback: { x: 4, y: 0 }, sfx: 'whoosh', hitSfx: 'hitLight',
      poses: {
        windup: P({ ...LEGS.crouch, ...ARMS.guard, torso: 22 }),
        strike: P({ fh: 92, fk: 0, bh: 30, bk: -130, torso: 18, fs: 70, fe: 92, bs: 50, be: 104, hip: 36 }),
      },
    },
    crouchHk: {
      name: 'Rising Kick', startup: 7, active: 4, recovery: 16, damage: 7, crouching: true,
      hitbox: { x: 22, y: 70, w: 84, h: 64 }, height: 'mid',
      hitstun: 18, blockstun: 10, knockback: { x: 6, y: 0 }, sfx: 'whoosh', hitSfx: 'hitHeavy',
      poses: {
        windup: P({ ...LEGS.crouch, torso: 26 }),
        strike: P({ fh: 132, fk: 0, bh: 34, bk: -132, torso: -20, fs: 30, fe: 60, bs: 10, be: 60, hip: 40 }),
      },
    },
    jumpPunch: {
      name: 'Jump Punch', startup: 4, active: 40, recovery: 0, damage: 7, air: true, untilLand: true,
      hitbox: { x: 16, y: 70, w: 72, h: 46 }, height: 'overhead',
      hitstun: 18, blockstun: 10, knockback: { x: 6, y: 0 }, sfx: 'whoosh', hitSfx: 'hitHeavy',
      poses: {
        windup: P({ torso: 14, fs: 40, fe: 120, bs: 60, be: 60, fh: 80, fk: -110, bh: 40, bk: -100 }),
        strike: P({ torso: 24, fs: 62, fe: 0, bs: 30, be: 90, fh: 70, fk: -100, bh: 30, bk: -90 }),
      },
    },
    jumpKick: {
      name: 'Flying Kick', startup: 5, active: 40, recovery: 0, damage: 9, air: true, untilLand: true,
      hitbox: { x: 24, y: 6, w: 78, h: 54 }, height: 'overhead',
      hitstun: 20, blockstun: 12, knockback: { x: 8, y: 0 }, sfx: 'whooshHeavy', hitSfx: 'hitHeavy',
      poses: {
        windup: P({ torso: 6, fh: 90, fk: -120, bh: 40, bk: -100, fs: 60, fe: 80 }),
        strike: P({ torso: -18, fh: 58, fk: 0, bh: -30, bk: -90, fs: 110, fe: 40, bs: 150, be: 30 }),
      },
    },
    jumpUpKick: {
      name: 'Air Kick', startup: 5, active: 12, recovery: 6, damage: 7, air: true,
      hitbox: { x: 20, y: 50, w: 80, h: 44 }, height: 'overhead',
      hitstun: 18, blockstun: 10, knockback: { x: 7, y: 0 }, sfx: 'whoosh', hitSfx: 'hitHeavy',
      poses: {
        windup: P({ torso: 0, fh: 80, fk: -110, bh: 40, bk: -100 }),
        strike: P({ torso: -20, fh: 96, fk: 0, bh: 30, bk: -100, fs: 40, bs: 20 }),
      },
    },
    throw: {
      name: 'Throw', startup: 4, active: 3, recovery: 18, damage: 13, throw: true,
      hitbox: { x: 0, y: 40, w: 78, h: 120 }, sfx: 'whoosh', hitSfx: 'throw',
      poses: {
        windup: P({ fs: 90, fe: 30, bs: 90, be: 30, torso: 16 }),
        strike: P({ fs: 96, fe: 10, bs: 96, be: 10, torso: 20, x: 6 }),
      },
    },
  };
}

/** Deep-ish merge helper so a character can tweak individual normals. */
export function withMoves(overrides: Partial<Record<NormalMoveKey, Partial<MoveDef>>>): NormalMoves {
  const base = createBaseMoves();
  for (const k of Object.keys(overrides) as NormalMoveKey[]) {
    const o = overrides[k]!;
    base[k] = { ...base[k], ...o, poses: { ...base[k].poses, ...(o.poses ?? {}) } };
  }
  return base;
}
