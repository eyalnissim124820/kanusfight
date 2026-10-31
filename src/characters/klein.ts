import type { CharacterDef } from '../game/types';
import { withMoves } from './baseMoves';
import { P, LEGS } from '../render/poses';
import atlas from './sprites/klein.json';

/**
 * KLEIN — scruffy street guitarist who fights with his guitar.
 * Art: the frame pack in art/klein/sprites (one PNG per frame), packed by tools/pack_frames.py.
 * Every frame of the pack was enlarged to fill its canvas, so art/klein/frames.json gives each frame's size:
 *   python3 tools/pack_frames.py art/klein/sprites public/sprites/klein.webp src/characters/sprites/klein.json \
 *     --scale 0.24 --config art/klein/frames.json
 * The pack has no frames for block, crouch, crouchBlock or airHit yet: they borrow other frames (see `play`).
 */
export const klein: CharacterDef = {
  id: 'klein',
  name: 'KLEIN',
  title: 'The Feedback',
  bio: 'Plays every bar in town and starts a fight in most of them. The guitar has survived more brawls than he has.',
  stats: { walkSpeed: 3.1, backSpeed: 2.6, jumpVel: 17.5, jumpSpeedX: 5.0, weight: 0.98, power: 1.02 },
  // Proportions set the hurtbox (≈195px tall) and the fallback stick figure shown while the art loads.
  body: {
    scale: 1.03, torso: 62, thigh: 49, shin: 49, upperArm: 34, forearm: 32,
    headR: 14, chestW: 44, waistW: 36, armW: 12, legW: 15,
  },
  palette: {
    skin: '#d9a07a', hair: '#4a2c18', primary: '#5a2a1c', secondary: '#7d93b5',
    accent: '#c8641e', eyes: '#ffffff', outline: '#140c08',
  },
  look: { hair: 'spiky', beard: true, pants: 'gi' },
  ai: { aggression: 0.65, zoning: 0.4 },

  moves: withMoves({
    hp: { hitbox: { x: 20, y: 124, w: 92, h: 30 } },
    hk: { hitbox: { x: 22, y: 118, w: 92, h: 56 } },
    sweep: { hitbox: { x: 28, y: 0, w: 108, h: 34 } },
  }),

  specials: [
    {
      id: 'guitarSmash', name: 'Guitar Smash', motion: ['B', 'F'], button: 'HP', role: 'rush',
      move: {
        name: 'Guitar Smash', startup: 14, active: 6, recovery: 22, damage: 13, special: true, chip: 3,
        selfVel: { x: 6, y: 0 }, hitbox: { x: 30, y: 40, w: 112, h: 120 }, height: 'mid', knockdown: true,
        hitstun: 26, blockstun: 18, knockback: { x: 10, y: 8 }, shake: 8, sfx: 'whooshHeavy', hitSfx: 'hitHeavy',
        poses: {
          windup: P({ torso: -10, fs: 170, fe: 20, bs: 160, be: 30 }),
          strike: P({ torso: 26, fs: 80, fe: 0, bs: 70, be: 10, x: 10, fh: 40, bh: -34 }),
        },
      },
    },
    {
      id: 'powerChord', name: 'Power Chord', motion: ['D', 'F'], button: 'LP', role: 'projectile',
      move: {
        name: 'Power Chord', startup: 15, active: 1, recovery: 24, damage: 0, special: true, sfx: 'projectile',
        projectile: {
          speed: 7.5, w: 46, h: 46, y: 96, x: 80, damage: 9, chip: 2, hitstun: 22,
          knockback: { x: 7, y: 0 }, life: 160, style: 'orb', color: '#ffe2a8', glow: '#ff8a2a',
        },
        poses: {
          windup: P({ ...LEGS.crouch, torso: -8, fs: 120, fe: 40, bs: 100, be: 50 }),
          strike: P({ torso: 18, fs: 90, fe: 0, bs: 70, be: 20 }),
        },
      },
    },
  ],

  finisher: {
    name: 'Encore', motion: ['F', 'D', 'F'], button: 'HP', range: 'close', effect: 'shatter',
    color: '#ffb03a',
    pose: P({ bs: 100, be: 0, fs: 70, fe: 10, torso: 28, x: 12, fh: 40, bh: -34 }),
  },

  sprites: {
    src: '/sprites/klein.webp',
    atlas: atlas.frames as unknown as NonNullable<CharacterDef['sprites']>['atlas'],
    standHeight: atlas.standHeight,
    // How each animation plays. `hit` = strike frame shown on the move's active frames.
    play: {
      idle: { frames: [0, 1, 2, 3, 2, 1], fps: 7 }, walk: { fps: 10 }, dizzy: { fps: 5 }, // idle plays back and forth
      jump: { fps: 6, loop: false }, victory: { fps: 3, loop: false }, getup: { fps: 6 },
      hitHigh: { fps: 12 }, hitLow: { fps: 12 },
      finisher: { fps: 4, loop: false }, // guitar raised, then the lunge
      lp: { hit: 1 }, hp: { hit: 1 }, lk: { hit: 1 }, hk: { hit: 1 },
      sweep: { hit: 1 }, roundhouse: { hit: 2 }, uppercut: { hit: 1 },
      crouchLk: { hit: 1 }, jumpKick: { hit: 1 }, jumpPunch: { hit: 1 },
      guitarSmash: { hit: 2 }, // overhead, swing, smash
      powerChord: { use: 'guitarSmash', frames: [0, 1], hit: 1 },
      // no art for these in the pack yet: borrowed frames
      block: { use: 'idle', frames: [0] },
      crouch: { use: 'crouchLk', frames: [0] },
      crouchBlock: { use: 'crouchLk', frames: [0] },
      airHit: { use: 'hitHigh', frames: [1], fps: 8 },
      closeHp: { use: 'hp', hit: 1 },
      closeHk: { use: 'lk', hit: 1 },
      crouchLp: { use: 'crouchLk', hit: 1 },
      crouchHk: { use: 'crouchLk', hit: 1 },
      jumpUpKick: { use: 'jumpKick', hit: 1 },
      throw: { frames: [0, 1], hit: 0 },
      throwing: { use: 'throw', frames: [2, 3], fps: 3, loop: false },
      thrown: { use: 'hitHigh', frames: [1], fps: 6 },
    },
  },
};
