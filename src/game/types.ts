// Core data types shared by the simulation, the renderer and character definitions.
// Coordinates: x grows to the right, y is height above the ground (y-up).
// Anything "local" is expressed as if the fighter faces right (+x = forward).

export type ButtonName = 'HP' | 'LP' | 'HK' | 'LK' | 'BL';
export const BUTTONS: ButtonName[] = ['HP', 'LP', 'HK', 'LK', 'BL'];

export interface InputFrame {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  HP: boolean;
  LP: boolean;
  HK: boolean;
  LK: boolean;
  BL: boolean;
}

export const emptyInput = (): InputFrame => ({
  up: false, down: false, left: false, right: false,
  HP: false, LP: false, HK: false, LK: false, BL: false,
});

/** Directions relative to the fighter's facing. F = toward the opponent. */
export type MotionDir = 'F' | 'B' | 'U' | 'D' | 'DF' | 'DB' | 'UF' | 'UB' | 'N';

/** Axis-aligned box in local space: x = forward offset of the near edge, y = bottom edge height. */
export interface Box { x: number; y: number; w: number; h: number }

/**
 * A skeleton pose. All limb angles are in degrees, measured from "pointing straight down",
 * rotating toward the fighter's front (90 = pointing forward, 180 = pointing up).
 * Knee/elbow values are added to the parent limb angle (knees bend with negative values,
 * elbows with positive values).
 */
export interface Pose {
  torso: number; // lean from vertical, + = forward
  head: number; // added to torso lean
  fs: number; fe: number; // front shoulder / elbow
  bs: number; be: number; // back shoulder / elbow
  fh: number; fk: number; // front hip / knee
  bh: number; bk: number; // back hip / knee
  x?: number; // horizontal hip offset
  y?: number; // added to the automatic hip height
  hip?: number; // explicit hip height (disables automatic ground contact)
  rot?: number; // whole-body rotation around the hip, + = forward (clockwise when facing right)
}

export type HitHeight = 'high' | 'mid' | 'low' | 'overhead';

export interface ProjectileDef {
  speed: number;
  w: number;
  h: number;
  y: number; // bottom edge height of the projectile when it spawns
  x?: number; // spawn offset in front of the fighter
  damage: number;
  chip: number;
  hitstun: number;
  knockback: { x: number; y: number };
  knockdown?: boolean;
  height?: HitHeight;
  life: number; // frames
  style: 'orb' | 'blade' | 'bolt';
  sprite?: string; // animation in the owner's sprite atlas drawn instead of the built-in effect
  color: string;
  glow: string;
}

export type SfxName =
  | 'whoosh' | 'whooshHeavy' | 'hitLight' | 'hitHeavy' | 'block' | 'projectile'
  | 'teleport' | 'land' | 'thud' | 'quake' | 'throw' | 'select' | 'confirm'
  | 'shatter' | 'vaporize' | 'slice' | 'bell';

export interface MovePoses {
  windup: Pose;
  strike: Pose;
  recover?: Pose;
}

export interface MoveDef {
  name?: string;
  startup: number; // frames before the hitbox appears
  active: number; // frames the hitbox is live (air moves: until landing)
  recovery: number; // frames after the active window
  damage: number; // percent of a standard 100hp bar
  chip?: number; // damage dealt through a block
  hitbox?: Box;
  height?: HitHeight;
  hitstun?: number;
  blockstun?: number;
  knockback?: { x: number; y: number };
  knockdown?: boolean; // puts a grounded opponent on the floor
  selfVel?: { x: number; y: number }; // velocity applied when the active window starts
  untilLand?: boolean; // the move continues until the fighter lands
  air?: boolean; // performed in the air
  crouching?: boolean; // fighter keeps a crouching hurtbox
  projectile?: ProjectileDef; // spawned at the end of startup
  throw?: boolean;
  teleport?: 'behind';
  invuln?: number; // invulnerable for the first N frames
  spin?: number; // degrees per frame of whole-body spin while active
  shake?: number; // camera shake on hit (and on the active frame for ground moves)
  sfx?: SfxName;
  hitSfx?: SfxName;
  special?: boolean;
  poses: MovePoses;
}

export type NormalMoveKey =
  | 'lp' | 'hp' | 'lk' | 'hk' | 'closeHp' | 'closeHk' | 'sweep' | 'roundhouse' | 'uppercut'
  | 'crouchLp' | 'crouchLk' | 'crouchHk' | 'jumpPunch' | 'jumpKick' | 'jumpUpKick' | 'throw';

export type NormalMoves = Record<NormalMoveKey, MoveDef>;

export type SpecialRole = 'projectile' | 'rush' | 'antiair' | 'teleport' | 'low' | 'air';

export interface SpecialDef {
  id: string;
  name: string;
  motion: MotionDir[];
  button: ButtonName;
  air?: boolean;
  role?: SpecialRole; // hint for the CPU opponent
  move: MoveDef;
}

export type FinisherEffect = 'shatter' | 'vaporize' | 'slice';

export interface FinisherDef {
  name: string;
  motion: MotionDir[];
  button: ButtonName;
  range: 'close' | 'far' | 'any';
  effect: FinisherEffect;
  color: string;
  pose: Pose; // pose the finisher holds while the effect plays
}

export interface Palette {
  skin: string;
  hair: string;
  primary: string; // trunks / suit
  secondary: string; // boots, trims
  accent: string; // belt, headband, wraps
  eyes: string;
  outline: string;
}

export interface Look {
  hair: 'bald' | 'mohawk' | 'ponytail' | 'spiky';
  beard?: boolean;
  mask?: boolean; // lower face mask in `primary`
  headband?: boolean; // headband in `accent`
  suit?: boolean; // covered torso and arms in `primary`
  pants: 'trunks' | 'gi';
  wraps?: boolean; // forearm wraps in `accent`
  sash?: boolean; // hanging belt tails
  tattoo?: boolean; // tribal stripes on the arms
}

export interface Body {
  scale: number;
  torso: number;
  thigh: number;
  shin: number;
  upperArm: number;
  forearm: number;
  headR: number;
  chestW: number;
  waistW: number;
  armW: number;
  legW: number;
}

export interface Stats {
  walkSpeed: number;
  backSpeed: number;
  jumpVel: number;
  jumpSpeedX: number;
  weight: number; // multiplier on received knockback (heavier = lower)
  power: number; // multiplier on dealt damage
}

export type BasePoseKey =
  | 'idle' | 'idle2' | 'walk1' | 'walk2' | 'crouch' | 'jump' | 'block' | 'crouchBlock'
  | 'hitHigh' | 'hitLow' | 'airHit' | 'lying' | 'getup' | 'dizzy' | 'victory' | 'throwing' | 'thrown';

/** One frame in a sprite atlas: [x, y, w, h, anchorX, anchorY]. The anchor is the point on the floor under the fighter. */
export type SpriteFrame = [number, number, number, number, number, number];

/** How one animation plays. Keys are animation names (see README → "Animation keys"). */
export interface SpriteAnim {
  use?: string; // play another animation's frames (e.g. closeHp → hp)
  frames?: number[]; // pick / reorder frames of that animation
  fps?: number; // for non-attack animations (default 10)
  loop?: boolean; // default true for idle/walk/dizzy, false otherwise
  hit?: number; // attacks: index of the strike frame shown during the active window
}

/** Optional sprite art. When present it replaces the procedural skeleton renderer. */
export interface SpriteSheetDef {
  src: string; // image URL, e.g. "/sprites/taldan.webp" (file in /public)
  atlas: Record<string, SpriteFrame[]>; // frames per animation, produced by tools/extract_sprites.py
  standHeight: number; // pixel height of the idle pose; scaled to match the fighter's hurtbox height
  scale?: number; // extra size multiplier (1 = hurtbox height)
  play?: Record<string, SpriteAnim>;
}

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  bio: string;
  stats: Stats;
  body: Body;
  palette: Palette;
  look: Look;
  moves: NormalMoves;
  specials: SpecialDef[];
  finisher: FinisherDef;
  poses?: Partial<Record<BasePoseKey, Pose>>;
  sprites?: SpriteSheetDef;
  ai?: { aggression: number; zoning: number };
}
