import type { CharacterDef } from '../game/types';
import { withMoves } from './baseMoves';
import { P, LEGS } from '../render/poses';
import atlas from './sprites/eyal.json';

/**
 * EYAL PRO MAX — balanced all-rounder with a laptop full of lightning.
 * Art: the frame pack in art/eyal/sprites (one PNG per frame), packed by tools/pack_frames.py with
 * art/eyal/frames.json, which evens out the frames' different scales, into public/sprites/eyal.webp:
 *   python3 tools/pack_frames.py art/eyal/sprites public/sprites/eyal.webp src/characters/sprites/eyal.json \
 *     --scale 0.3 --config art/eyal/frames.json --anchor proj_hotDeploy=0.5,0.5
 * The lightning bolt projectile comes from the first sheet (art/eyal/sheet-v1).
 */
export const eyal: CharacterDef = {
  id: 'eyal',
  name: 'EYAL PRO MAX',
  title: 'The Hot Deploy',
  bio: 'Ships code and knuckles at the same speed. When the build fails, someone gets a hotfix to the face.',
  stats: { walkSpeed: 3.0, backSpeed: 2.5, jumpVel: 17.5, jumpSpeedX: 4.9, weight: 1.0, power: 1.0 },
  // Proportions set the hurtbox (≈195px tall) and the fallback stick figure shown while the art loads.
  body: {
    scale: 1.04, torso: 62, thigh: 48, shin: 48, upperArm: 34, forearm: 32,
    headR: 14, chestW: 50, waistW: 42, armW: 13, legW: 16,
  },
  palette: {
    skin: '#d8a27c', hair: '#2a1d16', primary: '#1c1c1e', secondary: '#e8e8e8',
    accent: '#3aa0ff', eyes: '#ffffff', outline: '#0c0c10',
  },
  look: { hair: 'bald', beard: true, pants: 'gi' },
  ai: { aggression: 0.6, zoning: 0.5 },

  moves: withMoves({
    hp: { hitbox: { x: 20, y: 126, w: 92, h: 30 } },
    hk: { hitbox: { x: 22, y: 116, w: 90, h: 56 } },
  }),

  specials: [
    {
      id: 'hotDeploy', name: 'Hot Deploy', motion: ['B', 'F'], button: 'LP', role: 'projectile',
      move: {
        name: 'Hot Deploy', startup: 18, active: 1, recovery: 26, damage: 0, special: true, sfx: 'projectile',
        projectile: {
          speed: 8, w: 70, h: 44, y: 52, x: 96, damage: 10, chip: 2, hitstun: 24,
          knockback: { x: 7, y: 0 }, life: 160, style: 'bolt', color: '#e6fbff', glow: '#2ecbff',
          sprite: 'proj_hotDeploy', // the laptop lightning, from art/eyal/sheet-v1
        },
        poses: {
          windup: P({ ...LEGS.crouch, torso: 10, fs: 60, fe: 60, bs: 50, be: 70 }),
          strike: P({ ...LEGS.crouch, torso: 16, fs: 90, fe: 0, bs: 60, be: 60 }),
        },
      },
    },
    {
      id: 'hotfixRush', name: 'Hotfix Rush', motion: ['F', 'F'], button: 'HP', role: 'rush',
      move: {
        name: 'Hotfix Rush', startup: 9, active: 18, recovery: 20, damage: 11, special: true, chip: 2,
        selfVel: { x: 12, y: 0 }, hitbox: { x: 16, y: 100, w: 84, h: 70 }, height: 'mid', knockdown: true,
        hitstun: 24, blockstun: 16, knockback: { x: 11, y: 7 }, shake: 6, sfx: 'whooshHeavy', hitSfx: 'hitHeavy',
        poses: {
          windup: P({ torso: -6, fs: 30, fe: 110, bs: 20, be: 110 }),
          strike: P({ torso: 26, fs: 94, fe: 0, bs: 20, be: 110, fh: 44, fk: -30, bh: -36, bk: -24 }),
        },
      },
    },
  ],

  finisher: {
    name: 'Ship It', motion: ['F', 'D', 'F'], button: 'HP', range: 'any', effect: 'vaporize',
    color: '#ff8a1f',
    pose: P({ bs: 100, be: 0, fs: 30, fe: 110, torso: 26, x: 10, fh: 36, bh: -32 }),
  },

  sprites: {
    src: '/sprites/eyal.webp',
    atlas: atlas.frames as unknown as NonNullable<CharacterDef['sprites']>['atlas'],
    standHeight: atlas.standHeight,
    // How each animation plays. `hit` = strike frame shown on the move's active frames.
    play: {
      idle: { fps: 7 }, walk: { fps: 10 }, dizzy: { fps: 5 },
      jump: { fps: 6, loop: false }, victory: { fps: 3, loop: false }, getup: { fps: 6 },
      hitHigh: { fps: 12 }, hitLow: { fps: 12 }, airHit: { fps: 8 },
      finisher: { fps: 4, loop: false }, // lightning punch, then the power pose
      lp: { hit: 1 }, hp: { hit: 1 }, lk: { hit: 1 }, hk: { hit: 1 },
      sweep: { hit: 1 }, roundhouse: { hit: 2 }, uppercut: { hit: 1 },
      crouchLk: { frames: [1, 0], hit: 1 }, jumpKick: { hit: 1 }, jumpPunch: { hit: 1 },
      hotDeploy: { hit: 2 }, // stand with the laptop, sit and charge, release the bolt
      closeHp: { use: 'hp', hit: 1 },
      closeHk: { use: 'lk', hit: 1 },
      crouchLp: { use: 'crouchLk', frames: [1, 0], hit: 1 },
      crouchHk: { use: 'crouchLk', frames: [1, 0], hit: 1 },
      jumpUpKick: { use: 'jumpKick', hit: 1 },
      throw: { frames: [0, 1], hit: 1 },
      throwing: { use: 'throw', frames: [2, 3], fps: 3, loop: false },
      thrown: { use: 'airHit', fps: 6 },
      hotfixRush: { use: 'hp', frames: [0, 1], hit: 1 },
    },
  },
};
