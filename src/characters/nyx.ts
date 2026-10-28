import type { CharacterDef } from '../game/types';
import { withMoves } from './baseMoves';
import { P } from '../render/poses';

/**
 * NYX — fast, agile shadow fighter. Lower damage, better mobility, tricky specials.
 * Use this file as the reference for a "light" character.
 */
export const nyx: CharacterDef = {
  id: 'nyx',
  name: 'NYX',
  title: 'The Night Current',
  bio: 'A rooftop drifter who moves between shadows and strikes before the light catches up.',
  stats: { walkSpeed: 3.6, backSpeed: 3.0, jumpVel: 18.5, jumpSpeedX: 5.4, weight: 1.12, power: 0.92 },
  body: {
    scale: 0.97, torso: 60, thigh: 50, shin: 50, upperArm: 34, forearm: 32,
    headR: 13, chestW: 40, waistW: 32, armW: 11, legW: 13,
  },
  palette: {
    skin: '#e8c3a0', hair: '#e8e4f4', primary: '#3a1f5c', secondary: '#16101f',
    accent: '#2ee6c8', eyes: '#2ee6c8', outline: '#0b0712',
  },
  look: { hair: 'ponytail', suit: true, pants: 'gi', sash: true, headband: true },
  ai: { aggression: 0.55, zoning: 0.55 },

  moves: withMoves({
    lp: { startup: 3 },
    lk: { startup: 5 },
    hk: { startup: 7, damage: 7 },
    jumpKick: { damage: 8 },
  }),

  specials: [
    {
      id: 'moonBlade', name: 'Moon Blade', motion: ['B', 'F'], button: 'HP', role: 'projectile',
      move: {
        name: 'Moon Blade', startup: 11, active: 1, recovery: 20, damage: 0, special: true, sfx: 'projectile',
        projectile: {
          speed: 10.5, w: 56, h: 18, y: 132, x: 56, damage: 7, chip: 1, hitstun: 20, height: 'high',
          knockback: { x: 5, y: 0 }, life: 140, style: 'blade', color: '#bffcf2', glow: '#2ee6c8',
        },
        poses: {
          windup: P({ torso: -6, fs: 160, fe: 40, bs: 20, be: 90 }),
          strike: P({ torso: 20, fs: 84, fe: 0, bs: 10, be: 60, x: 8, fh: 32, bh: -30 }),
        },
      },
    },
    {
      id: 'shadowStep', name: 'Shadow Step', motion: ['D', 'B'], button: 'LP', role: 'teleport',
      move: {
        name: 'Shadow Step', startup: 14, active: 1, recovery: 14, damage: 0, special: true,
        teleport: 'behind', invuln: 24, sfx: 'teleport',
        poses: {
          windup: P({ torso: 20, fs: 120, fe: 60, bs: 100, be: 70 }),
          strike: P({ torso: 10 }),
        },
      },
    },
    {
      id: 'crescentRise', name: 'Crescent Rise', motion: ['D', 'F'], button: 'HK', role: 'antiair',
      move: {
        name: 'Crescent Rise', startup: 5, active: 40, recovery: 10, damage: 10, special: true, chip: 1,
        selfVel: { x: 3.5, y: 15 }, untilLand: true, invuln: 6, spin: -14,
        hitbox: { x: -10, y: 40, w: 88, h: 130 }, height: 'mid',
        hitstun: 26, blockstun: 14, knockback: { x: 4, y: 16 }, shake: 5, sfx: 'whooshHeavy', hitSfx: 'hitHeavy',
        poses: {
          windup: P({ fh: 88, fk: -122, bh: 38, bk: -128, torso: 30 }),
          strike: P({ torso: -10, fh: 150, fk: 0, bh: 20, bk: -60, fs: 60, fe: 20, bs: 20, be: 40, hip: 90 }),
        },
      },
    },
    {
      id: 'talonDive', name: 'Talon Dive', motion: ['D'], button: 'HK', air: true, role: 'air',
      move: {
        name: 'Talon Dive', startup: 6, active: 40, recovery: 10, damage: 8, special: true, chip: 1,
        selfVel: { x: 9, y: -13 }, untilLand: true, air: true,
        hitbox: { x: 10, y: -4, w: 66, h: 56 }, height: 'overhead', knockdown: true,
        hitstun: 20, blockstun: 12, knockback: { x: 8, y: 6 }, sfx: 'whooshHeavy', hitSfx: 'hitHeavy',
        poses: {
          windup: P({ torso: 10, fh: 90, fk: -120, bh: 40, bk: -100, fs: 150, fe: 20, bs: 130, be: 30 }),
          strike: P({ torso: -30, fh: 36, fk: 0, bh: -20, bk: -100, fs: 140, fe: 20, bs: 160, be: 20 }),
        },
      },
    },
  ],

  finisher: {
    name: 'Eclipse', motion: ['F', 'B', 'F'], button: 'LK', range: 'any', effect: 'vaporize',
    color: '#2ee6c8',
    pose: P({ torso: -8, head: -10, fs: 110, fe: 30, bs: 160, be: 10, fh: 26, fk: -10, bh: -26, bk: -8 }),
  },
};
