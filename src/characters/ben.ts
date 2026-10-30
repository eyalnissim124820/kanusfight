import type { CharacterDef } from '../game/types';
import { withMoves } from './baseMoves';
import { P } from '../render/poses';
import atlas from './sprites/ben.json';

/**
 * BEN — The Cocky Barber. Lean, quick and showy, fights with professional scissors.
 * Art: art/ben/sprites (one PNG per frame) packed by tools/pack_frames.py into public/sprites/ben.webp.
 * Use this file as the reference for a character delivered as a folder of frames.
 */
export const ben: CharacterDef = {
  id: 'ben',
  name: 'BEN',
  title: 'The Cocky Barber',
  bio: 'The sharpest barber in town, and he knows it. Every fight is a styling session; every opponent leaves with a fresh cut.',
  stats: { walkSpeed: 3.3, backSpeed: 2.8, jumpVel: 18, jumpSpeedX: 5.2, weight: 1.05, power: 0.98 },
  // Proportions set the hurtbox (≈195px tall) and the fallback stick figure shown while the art loads.
  body: {
    scale: 1.03, torso: 62, thigh: 50, shin: 50, upperArm: 34, forearm: 32,
    headR: 13, chestW: 42, waistW: 34, armW: 12, legW: 15,
  },
  palette: {
    skin: '#e0a878', hair: '#6b4426', primary: '#2c3a5c', secondary: '#1a1a1a',
    accent: '#7a4a26', eyes: '#ffffff', outline: '#120c08',
  },
  look: { hair: 'spiky', beard: true, pants: 'gi' },
  ai: { aggression: 0.6, zoning: 0.45 },

  moves: withMoves({
    lp: { startup: 4 },
    hp: { name: 'Scissor Slash', damage: 7, hitbox: { x: 16, y: 104, w: 84, h: 56 } },
    hk: { hitbox: { x: 24, y: 120, w: 96, h: 50 } },
    uppercut: { name: 'Rising Snip', hitbox: { x: 4, y: 96, w: 80, h: 120 } },
    crouchLk: { hitbox: { x: 30, y: 0, w: 104, h: 36 } },
  }),

  specials: [
    {
      id: 'flyingShears', name: 'Flying Shears', motion: ['B', 'F'], button: 'LP', role: 'projectile',
      move: {
        name: 'Flying Shears', startup: 12, active: 1, recovery: 20, damage: 0, special: true, sfx: 'projectile',
        projectile: {
          speed: 10, w: 52, h: 18, y: 120, x: 64, damage: 8, chip: 1, hitstun: 22,
          knockback: { x: 6, y: 0 }, life: 150, style: 'blade', color: '#fff6c8', glow: '#ffc93a',
          sprite: 'proj_flyingShears', // the flying scissors cut from art/ben/source-sheet.webp
        },
        poses: {
          windup: P({ torso: -6, fs: 160, fe: 40, bs: 20, be: 90 }),
          strike: P({ torso: 20, fs: 84, fe: 0, bs: 10, be: 60, x: 8, fh: 32, bh: -30 }),
        },
      },
    },
    {
      id: 'denimLance', name: 'Denim Lance', motion: ['B', 'F'], button: 'HK', role: 'rush',
      move: {
        name: 'Denim Lance', startup: 12, active: 6, recovery: 20, damage: 11, special: true, chip: 2,
        selfVel: { x: 5, y: 0 }, hitbox: { x: 30, y: 36, w: 100, h: 46 }, height: 'mid', knockdown: true,
        hitstun: 24, blockstun: 16, knockback: { x: 11, y: 6 }, shake: 6, sfx: 'whooshHeavy', hitSfx: 'hitHeavy',
        poses: {
          windup: P({ fh: 70, fk: -100, torso: -4 }),
          strike: P({ fh: 84, fk: 0, torso: -12, bh: -10, bk: -6 }),
        },
      },
    },
  ],

  finisher: {
    name: 'Perfect Cut', motion: ['F', 'D', 'F'], button: 'LK', range: 'close', effect: 'slice',
    color: '#9fe8ff',
    pose: P({ bs: 100, be: 0, fs: 30, fe: 110, torso: 20, x: 8, fh: 34, bh: -30 }),
  },

  sprites: {
    src: '/sprites/ben.webp',
    atlas: atlas.frames as unknown as NonNullable<CharacterDef['sprites']>['atlas'],
    standHeight: atlas.standHeight,
    // How each animation plays. `hit` = strike frame shown on the move's active frames.
    play: {
      idle: { fps: 9 }, walk: { fps: 12 }, dizzy: { fps: 6 },
      jump: { fps: 6, loop: false }, victory: { frames: [1] }, // victory_02, cleaned of a ghosted second figure getup: { fps: 6 },
      hitHigh: { fps: 12 }, hitLow: { fps: 12 }, airHit: { fps: 8 }, finisher: { fps: 4, loop: false },
      lp: { hit: 2 }, hp: { hit: 1 }, lk: { hit: 2 }, hk: { frames: [1, 2, 1], hit: 1 },
      sweep: { hit: 1 }, roundhouse: { hit: 2 }, uppercut: { hit: 1 }, crouchLk: { hit: 1 },
      jumpKick: { hit: 1 }, jumpPunch: { hit: 1 }, denimLance: { hit: 2 },
      closeHp: { use: 'hp', hit: 1 },
      closeHk: { use: 'lk', hit: 2 },
      crouchLp: { use: 'crouchLk', hit: 1 },
      crouchHk: { use: 'crouchLk', hit: 1 },
      jumpUpKick: { use: 'jumpKick', hit: 1 },
      throw: { frames: [0, 1], hit: 1 },
      throwing: { use: 'throw', frames: [2, 3], fps: 3, loop: false },
      thrown: { use: 'airHit', fps: 6 },
      flyingShears: { use: 'hp', hit: 1 },
    },
  },
};
