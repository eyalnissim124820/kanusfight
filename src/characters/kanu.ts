import type { CharacterDef } from '../game/types';
import { withMoves } from './baseMoves';
import { P, LEGS } from '../render/poses';

/**
 * KANU — heavy power brawler. Slow, hits hard, takes hits well.
 * Use this file as the reference for a "big" character.
 */
export const kanu: CharacterDef = {
  id: 'kanu',
  name: 'KANU',
  title: 'The Mountain Breaker',
  bio: 'A mountain-village champion who fights with the weight of the earth behind every blow.',
  stats: { walkSpeed: 2.8, backSpeed: 2.2, jumpVel: 17.5, jumpSpeedX: 4.6, weight: 0.85, power: 1.12 },
  body: {
    scale: 1.08, torso: 64, thigh: 48, shin: 46, upperArm: 36, forearm: 34,
    headR: 15, chestW: 54, waistW: 40, armW: 15, legW: 17,
  },
  palette: {
    skin: '#b07045', hair: '#1b1410', primary: '#b3261e', secondary: '#2a1d16',
    accent: '#e3a52b', eyes: '#ffffff', outline: '#120a08',
  },
  look: { hair: 'mohawk', beard: true, pants: 'trunks', wraps: true, tattoo: true },
  ai: { aggression: 0.65, zoning: 0.3 },

  moves: withMoves({
    hp: { damage: 7 },
    hk: { damage: 9, startup: 9 },
    uppercut: { damage: 15 },
  }),

  specials: [
    {
      id: 'thunderOrb', name: 'Thunder Orb', motion: ['B', 'F'], button: 'LP', role: 'projectile',
      move: {
        name: 'Thunder Orb', startup: 16, active: 1, recovery: 24, damage: 0, special: true, sfx: 'projectile',
        projectile: {
          speed: 6.5, w: 44, h: 44, y: 104, x: 60, damage: 9, chip: 2, hitstun: 24,
          knockback: { x: 7, y: 0 }, life: 200, style: 'orb', color: '#ffd35a', glow: '#ff8a1f',
        },
        poses: {
          windup: P({ torso: -10, fs: 20, fe: 120, bs: 10, be: 130 }),
          strike: P({ torso: 18, fs: 92, fe: 0, bs: 88, be: 4, x: 6, fh: 32, bh: -28 }),
        },
      },
    },
    {
      id: 'bullCharge', name: 'Bull Charge', motion: ['F', 'F'], button: 'HP', role: 'rush',
      move: {
        name: 'Bull Charge', startup: 9, active: 20, recovery: 20, damage: 11, special: true, chip: 2,
        selfVel: { x: 12.5, y: 0 }, hitbox: { x: 8, y: 64, w: 64, h: 96 }, height: 'mid', knockdown: true,
        hitstun: 24, blockstun: 16, knockback: { x: 11, y: 7 }, shake: 6, sfx: 'whooshHeavy', hitSfx: 'hitHeavy',
        poses: {
          windup: P({ torso: -10, fs: 10, fe: 90, bs: 0, be: 90, ...LEGS.crouch }),
          strike: P({ torso: 40, head: -30, fs: 40, fe: 110, bs: 10, be: 120, fh: 54, fk: -44, bh: -42, bk: -34 }),
        },
      },
    },
    {
      id: 'quakeStomp', name: 'Quake Stomp', motion: ['D', 'B'], button: 'HK', role: 'low',
      move: {
        name: 'Quake Stomp', startup: 18, active: 4, recovery: 24, damage: 8, special: true, chip: 1,
        hitbox: { x: -30, y: 0, w: 210, h: 26 }, height: 'low', knockdown: true,
        hitstun: 20, blockstun: 14, knockback: { x: 5, y: 0 }, shake: 10, sfx: 'quake', hitSfx: 'hitHeavy',
        poses: {
          windup: P({ fh: 112, fk: -124, torso: -6, fs: 150, fe: 30, bs: 140, be: 30 }),
          strike: P({ fh: 30, fk: -14, bh: -30, bk: -20, torso: 36, head: -20, fs: 40, fe: 20, bs: 30, be: 20, y: -10 }),
        },
      },
    },
  ],

  finisher: {
    name: 'Shatter Fist', motion: ['F', 'D', 'F'], button: 'HP', range: 'close', effect: 'shatter',
    color: '#ffd35a',
    pose: P({ bs: 100, be: 0, fs: 30, fe: 110, torso: 26, x: 10, fh: 36, bh: -32 }),
  },

  poses: {
    victory: P({ torso: -6, head: -12, fs: 92, fe: 128, bs: 86, be: 132, fh: 24, fk: -6, bh: -24, bk: -6 }),
  },
};
