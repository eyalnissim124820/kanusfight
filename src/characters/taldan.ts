import type { CharacterDef } from '../game/types';
import { withMoves } from './baseMoves';
import { P, LEGS } from '../render/poses';
import atlas from './sprites/taldan.json';

/**
 * TALDAN — heavyweight street cop. The first sprite-art character: his frames come from
 * art/taldan/source-sheet.webp, cut by tools/extract_sprites.py into public/sprites/taldan.webp.
 * Use this file as the reference for adding a character with hand-made / AI-generated art.
 */
export const taldan: CharacterDef = {
  id: 'taldan',
  name: 'TALDAN',
  title: 'The Long Arm of the Law',
  bio: 'A veteran beat cop with a temper, a belly like a battering ram, and fists that burn when justice runs out of patience.',
  stats: { walkSpeed: 2.5, backSpeed: 2.0, jumpVel: 16.5, jumpSpeedX: 4.4, weight: 0.8, power: 1.12 },
  // Body proportions drive the hurtbox size (≈200px tall) and the fallback stick figure shown while the art loads.
  body: {
    scale: 1.1, torso: 62, thigh: 46, shin: 44, upperArm: 36, forearm: 34,
    headR: 15, chestW: 60, waistW: 56, armW: 15, legW: 18,
  },
  palette: {
    skin: '#d9a27a', hair: '#1a1410', primary: '#1d2340', secondary: '#141414',
    accent: '#c9a227', eyes: '#ffffff', outline: '#0c0c12',
  },
  look: { hair: 'spiky', beard: true, pants: 'gi', suit: true },
  ai: { aggression: 0.7, zoning: 0.35 },

  // Hitboxes tuned to the reach of his art (see F1 hitbox view in a fight).
  moves: withMoves({
    lp: { hitbox: { x: 18, y: 120, w: 70, h: 30 } },
    hp: { damage: 7, hitbox: { x: 22, y: 118, w: 80, h: 34 } },
    lk: { hitbox: { x: 24, y: 70, w: 86, h: 36 } },
    hk: { damage: 9, startup: 9, hitbox: { x: 22, y: 110, w: 80, h: 56 } },
    roundhouse: { hitbox: { x: 24, y: 100, w: 92, h: 60 } },
    sweep: { hitbox: { x: 20, y: 0, w: 104, h: 30 } },
    uppercut: { damage: 15 },
    crouchLk: { hitbox: { x: 24, y: 0, w: 96, h: 34 } },
  }),

  specials: [
    {
      id: 'powerBlast', name: 'Power Blast', motion: ['B', 'F'], button: 'LP', role: 'projectile',
      move: {
        name: 'Power Blast', startup: 16, active: 1, recovery: 24, damage: 0, special: true, sfx: 'projectile',
        projectile: {
          speed: 7, w: 46, h: 46, y: 96, x: 78, damage: 10, chip: 2, hitstun: 24,
          knockback: { x: 7, y: 0 }, life: 200, style: 'orb', color: '#fff2b0', glow: '#ff9a1f',
        },
        poses: {
          windup: P({ torso: -10, fs: 20, fe: 120, bs: 10, be: 130 }),
          strike: P({ torso: 18, fs: 92, fe: 0, bs: 88, be: 4, x: 6, fh: 32, bh: -28 }),
        },
      },
    },
    {
      id: 'riotRush', name: 'Riot Rush', motion: ['F', 'F'], button: 'HP', role: 'rush',
      move: {
        name: 'Riot Rush', startup: 10, active: 20, recovery: 22, damage: 12, special: true, chip: 2,
        selfVel: { x: 11.5, y: 0 }, hitbox: { x: 10, y: 70, w: 80, h: 90 }, height: 'mid', knockdown: true,
        hitstun: 24, blockstun: 16, knockback: { x: 12, y: 7 }, shake: 7, sfx: 'whooshHeavy', hitSfx: 'hitHeavy',
        poses: {
          windup: P({ torso: -10, fs: 10, fe: 90, bs: 0, be: 90, ...LEGS.crouch }),
          strike: P({ torso: 34, head: -26, fs: 92, fe: 0, bs: 10, be: 120, fh: 54, fk: -44, bh: -42, bk: -34 }),
        },
      },
    },
  ],

  finisher: {
    name: 'Final Verdict', motion: ['F', 'D', 'F'], button: 'HP', range: 'any', effect: 'vaporize',
    color: '#ffb000',
    pose: P({ bs: 100, be: 0, fs: 30, fe: 110, torso: 26, x: 10, fh: 36, bh: -32 }),
  },

  sprites: {
    src: '/sprites/taldan.webp',
    atlas: atlas.frames as unknown as NonNullable<CharacterDef['sprites']>['atlas'],
    standHeight: atlas.standHeight,
    // How each animation plays. `hit` = strike frame shown on the move's active frames.
    // Moves without their own art reuse another animation via `use`.
    play: {
      idle: { fps: 6 }, walk: { fps: 10 }, dizzy: { fps: 5 },
      jump: { fps: 6, loop: false }, victory: { fps: 3, loop: false }, getup: { fps: 6 },
      hitHigh: { fps: 12 }, hitLow: { fps: 12 }, airHit: { fps: 8 }, finisher: { fps: 4, loop: false },
      lp: { hit: 1 }, hp: { hit: 2 }, lk: { hit: 1 }, hk: { hit: 1 }, sweep: { hit: 1 },
      roundhouse: { hit: 2 }, uppercut: { hit: 2 }, crouchLk: { hit: 1 },
      jumpKick: { hit: 1 }, jumpPunch: { hit: 1 }, powerBlast: { hit: 2 },
      closeHp: { use: 'hp', frames: [0, 1], hit: 1 },
      closeHk: { use: 'lk', hit: 1 },
      crouchLp: { use: 'crouchLk', hit: 1 },
      crouchHk: { use: 'crouchLk', hit: 1 },
      jumpUpKick: { use: 'jumpKick', hit: 1 },
      throw: { frames: [0, 1], hit: 1 },
      throwing: { use: 'throw', frames: [2, 3], fps: 3, loop: false },
      thrown: { use: 'airHit', fps: 6 },
      riotRush: { use: 'hp', frames: [1, 2], hit: 1 },
    },
  },
};
