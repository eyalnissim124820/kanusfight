import {
  BUTTONS, emptyInput,
  type ButtonName, type CharacterDef, type InputFrame, type MotionDir, type MoveDef, type NormalMoveKey,
  type ProjectileDef, type SfxName,
} from './types';

export const GRAVITY = 0.8;

export type FState =
  | 'idle' | 'walk' | 'crouch' | 'block' | 'prejump' | 'jump' | 'land' | 'attack'
  | 'hitstun' | 'blockstun' | 'airHit' | 'knockdown' | 'getup' | 'throwing' | 'thrown'
  | 'dizzy' | 'ko' | 'victory' | 'finisher' | 'finished';

const NEUTRAL: FState[] = ['idle', 'walk', 'crouch', 'block'];

/** Callbacks the match provides so a fighter can affect the world. */
export interface FighterHooks {
  sfx(name: SfxName): void;
  spawnProjectile(owner: Fighter, def: ProjectileDef): void;
  hasProjectile(owner: Fighter): boolean;
  teleport(f: Fighter): void;
  activeStart(f: Fighter, move: MoveDef): void;
  landed(f: Fighter, hard: boolean): void;
  tryFinisher(f: Fighter): boolean;
}

// Numpad notation (relative to facing): 7 8 9 / 4 5 6 / 1 2 3, where 6 = forward.
const DIR_MATCH: Record<MotionDir, number[]> = {
  F: [6, 3, 9], B: [4, 1, 7], U: [8, 7, 9], D: [2, 1, 3],
  DF: [3], DB: [1], UF: [9], UB: [7], N: [5],
};

/** Standing height in pixels (top of head to floor); also the size sprite art is scaled to. */
export function characterHeight(def: CharacterDef) {
  const b = def.body;
  return ((b.thigh + b.shin) * 0.95 + b.torso + b.headR * 2 + 6) * b.scale;
}

export class Fighter {
  readonly def: CharacterDef;
  readonly side: 0 | 1;
  opponent!: Fighter;
  hooks!: FighterHooks;

  x = 0; y = 0; vx = 0; vy = 0;
  facing: 1 | -1 = 1;
  health = 100;
  wins = 0;

  state: FState = 'idle';
  t = 0; // frames spent in the current state
  move: MoveDef | null = null;
  moveId = '';
  moveHit = false;
  stun = 0; // length of the current hitstun / blockstun
  landTime = 0;
  hitAnim: 'high' | 'low' = 'high';
  crouchBlock = false;
  jumpDir: -1 | 0 | 1 = 0;
  airAttack = false;

  hitstop = 0;
  flash = 0;
  invuln = 0;
  juggle = 0;
  combo = 0; // hits received in the current combo
  thrower: Fighter | null = null;

  /** Set by the match when the round is lost. */
  koed = false;
  toDizzy = false;
  canFinish = false;

  /** Visual-only values driven by the match (finishers). */
  stone = 0;
  vanish = 0;
  slice = 0; // 0..1: cut in two (finisher)
  hidden = false;
  walkPhase = 0;

  cur: InputFrame = emptyInput();
  fwdHeld = false;
  backHeld = false;
  private prev: InputFrame = emptyInput();
  private frame = 0;
  private lastDir = 5;
  private dirEvents: { d: number; f: number }[] = [];
  private buffer: { b: ButtonName; ttl: number }[] = [];

  constructor(def: CharacterDef, side: 0 | 1) {
    this.def = def;
    this.side = side;
  }

  get scale() { return this.def.body.scale; }
  get airborne() { return this.y > 0 || this.vy > 0; }
  get height() { return characterHeight(this.def); }
  isNeutral() { return NEUTRAL.includes(this.state) || this.state === 'land'; }

  resetForRound(x: number, facing: 1 | -1) {
    Object.assign(this, {
      x, y: 0, vx: 0, vy: 0, facing, health: 100, state: 'idle', t: 0, move: null, moveId: '',
      moveHit: false, stun: 0, hitstop: 0, flash: 0, invuln: 0, juggle: 0, combo: 0, thrower: null,
      koed: false, toDizzy: false, canFinish: false, stone: 0, vanish: 0, slice: 0, hidden: false, airAttack: false,
    });
    this.buffer = [];
    this.dirEvents = [];
  }

  setState(s: FState) {
    if (this.state !== s) { this.state = s; this.t = 0; }
  }

  // ---------------- per-frame update ----------------

  update(raw: InputFrame, allowControl: boolean) {
    const inp = allowControl ? raw : emptyInput();
    this.frame++;
    const fwd = this.facing === 1 ? inp.right : inp.left;
    const back = this.facing === 1 ? inp.left : inp.right;
    const h = (fwd ? 1 : 0) - (back ? 1 : 0);
    const v = inp.up ? 1 : inp.down ? -1 : 0;
    const dir = 5 + h + 3 * v;
    if (dir !== this.lastDir) {
      this.dirEvents.push({ d: dir, f: this.frame });
      if (this.dirEvents.length > 16) this.dirEvents.shift();
      this.lastDir = dir;
    }
    for (const b of BUTTONS) if (inp[b] && !this.prev[b] && b !== 'BL') this.buffer.push({ b, ttl: 6 });
    this.prev = { ...inp };
    this.cur = inp;
    this.fwdHeld = fwd;
    this.backHeld = back;

    if (this.flash > 0) this.flash--;
    if (this.hitstop > 0) { this.hitstop--; return; }
    for (const e of this.buffer) e.ttl--;
    this.buffer = this.buffer.filter((e) => e.ttl > 0);
    if (this.invuln > 0) this.invuln--;

    this.t++;
    this.step();
    this.physics();
  }

  private step() {
    const st = this.def.stats;
    switch (this.state) {
      case 'idle': case 'walk': case 'crouch': case 'block':
        this.neutral();
        break;
      case 'prejump':
        if (this.t >= 3) {
          this.vy = st.jumpVel;
          this.vx = this.jumpDir * st.jumpSpeedX * this.facing;
          this.y = 0.01;
          this.airAttack = false;
          this.setState('jump');
        }
        break;
      case 'jump':
        this.airControl();
        break;
      case 'land':
        this.vx = 0;
        if (this.t >= this.landTime) this.setState('idle');
        break;
      case 'attack':
        this.attackStep();
        break;
      case 'hitstun':
        this.vx *= 0.82;
        if (this.t >= this.stun) this.recoverToNeutral();
        break;
      case 'blockstun':
        this.vx *= 0.82;
        this.crouchBlock = this.cur.down;
        if (this.t >= this.stun) { if (this.toDizzy) this.recoverToNeutral(); else this.setState(this.cur.BL ? 'block' : 'idle'); }
        break;
      case 'knockdown':
        this.vx *= 0.8;
        if (this.t >= 40) {
          if (this.koed) this.setState('ko');
          else { this.setState('getup'); this.invuln = 24; }
        }
        break;
      case 'getup':
        if (this.t >= 22) this.recoverToNeutral();
        break;
      case 'throwing':
        this.vx = 0;
        if (this.t >= 40) this.setState('idle');
        break;
      case 'airHit': case 'thrown':
        break; // physics / the thrower drive these
      case 'dizzy': case 'ko': case 'victory': case 'finisher': case 'finished':
        this.vx *= 0.8;
        break;
    }
  }

  private recoverToNeutral() {
    this.juggle = 0;
    this.combo = 0;
    if (this.toDizzy) { this.setState('dizzy'); return; }
    this.setState('idle');
  }

  private neutral() {
    const inp = this.cur, st = this.def.stats;
    this.vx = 0;
    this.juggle = 0;
    this.combo = 0;

    if (this.canFinish && this.buffer.length && this.hooks.tryFinisher(this)) return;
    if (this.trySpecial(false)) return;

    const btn = this.takeButton();
    if (btn) { this.doNormal(btn); return; }

    if (inp.BL) { this.setState('block'); this.crouchBlock = inp.down; return; }
    if (inp.up) {
      this.jumpDir = this.fwdHeld ? 1 : this.backHeld ? -1 : 0;
      this.setState('prejump');
      return;
    }
    if (inp.down) { this.setState('crouch'); return; }
    if (this.fwdHeld) {
      this.vx = st.walkSpeed * this.facing;
      this.walkPhase += st.walkSpeed;
      this.setState('walk');
    } else if (this.backHeld) {
      this.vx = -st.backSpeed * this.facing;
      this.walkPhase -= st.backSpeed;
      this.setState('walk');
    } else this.setState('idle');
  }

  private airControl() {
    if (this.airAttack) return;
    if (this.trySpecial(true)) { this.airAttack = true; return; }
    const btn = this.takeButton();
    if (!btn) return;
    this.airAttack = true;
    const key: NormalMoveKey = btn === 'HP' || btn === 'LP' ? 'jumpPunch' : this.jumpDir === 0 ? 'jumpUpKick' : 'jumpKick';
    this.startMove(key, this.def.moves[key]);
  }

  distTo(o: Fighter) { return Math.abs(o.x - this.x); }

  private throwable(o: Fighter) {
    return !o.airborne && o.invuln <= 0 && ['idle', 'walk', 'crouch', 'block', 'blockstun', 'land'].includes(o.state);
  }

  private doNormal(btn: ButtonName) {
    const o = this.opponent, close = this.distTo(o) < 92 * this.scale;
    let key: NormalMoveKey;
    if (this.cur.down) {
      key = ({ LP: 'crouchLp', HP: 'uppercut', LK: 'crouchLk', HK: 'crouchHk' } as const)[btn as 'LP'];
    } else if (this.backHeld && (btn === 'LK' || btn === 'HK')) {
      key = btn === 'LK' ? 'sweep' : 'roundhouse';
    } else if (btn === 'LP') key = close && this.throwable(o) ? 'throw' : 'lp';
    else if (btn === 'HP') key = close ? 'closeHp' : 'hp';
    else if (btn === 'LK') key = 'lk';
    else key = close ? 'closeHk' : 'hk';
    this.startMove(key, this.def.moves[key]);
  }

  private takeButton(): ButtonName | null {
    const e = this.buffer.shift();
    return e ? e.b : null;
  }

  matchMotion(motion: MotionDir[], window = 28) {
    let idx = motion.length - 1;
    for (let i = this.dirEvents.length - 1; i >= 0 && idx >= 0; i--) {
      const e = this.dirEvents[i];
      if (this.frame - e.f > window) break;
      if (DIR_MATCH[motion[idx]].includes(e.d)) idx--;
    }
    return idx < 0;
  }

  /** Is any button in the buffer that matches, and does the motion match? Consumes the button. */
  consumeMotion(motion: MotionDir[], button: ButtonName) {
    const i = this.buffer.findIndex((e) => e.b === button);
    if (i < 0 || !this.matchMotion(motion)) return false;
    this.buffer.splice(i, 1);
    this.dirEvents = [];
    return true;
  }

  private trySpecial(air: boolean) {
    if (!this.buffer.length) return false;
    const list = this.def.specials
      .filter((s) => !!s.air === air)
      .sort((a, b) => b.motion.length - a.motion.length);
    for (const s of list) {
      if (s.move.projectile && this.hooks.hasProjectile(this)) continue;
      if (this.consumeMotion(s.motion, s.button)) {
        this.startMove(s.id, s.move);
        return true;
      }
    }
    return false;
  }

  startMove(id: string, m: MoveDef) {
    this.state = 'attack';
    this.t = 0;
    this.move = m;
    this.moveId = id;
    this.moveHit = false;
    if (m.invuln) this.invuln = m.invuln;
    if (!m.air) this.vx = 0;
  }

  phase(): 'startup' | 'active' | 'recovery' {
    const m = this.move;
    if (!m) return 'recovery';
    if (this.t < m.startup) return 'startup';
    if (m.untilLand && this.airborne) return 'active';
    return this.t < m.startup + m.active ? 'active' : 'recovery';
  }

  private attackStep() {
    const m = this.move!;
    if (this.t === m.startup) {
      if (m.selfVel) {
        this.vx = m.selfVel.x * this.facing;
        if (m.selfVel.y) { this.vy = m.selfVel.y; if (this.y <= 0) this.y = 0.01; }
      }
      if (m.projectile && !this.hooks.hasProjectile(this)) this.hooks.spawnProjectile(this, m.projectile);
      if (m.teleport) this.hooks.teleport(this);
      this.hooks.activeStart(this, m);
    }
    if (this.airborne) return; // air moves end on landing (see onLand)
    if (m.selfVel && this.t >= m.startup && this.t < m.startup + m.active) {
      // dash moves keep their speed while active
    } else this.vx *= 0.7;
    if (this.t >= m.startup + m.active + m.recovery) {
      this.move = null;
      this.setState(m.crouching && this.cur.down ? 'crouch' : 'idle');
    }
  }

  private physics() {
    if (this.state === 'thrown') return;
    if (this.airborne) {
      this.vy -= GRAVITY;
      this.y += this.vy;
      this.x += this.vx;
      // a timed air move (air kick) that finished before landing returns to the jump state
      if (this.state === 'attack' && this.move && !this.move.untilLand && this.move.air &&
          this.t >= this.move.startup + this.move.active + this.move.recovery) {
        this.move = null;
        this.state = 'jump';
      }
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.onLand(); }
    } else {
      this.x += this.vx;
    }
  }

  private onLand() {
    switch (this.state) {
      case 'jump': case 'prejump':
        this.vx = 0; this.landTime = 4; this.setState('land'); this.hooks.landed(this, false);
        break;
      case 'attack': {
        const m = this.move;
        this.vx = 0;
        this.landTime = m?.untilLand ? Math.max(6, m.recovery) : 4;
        this.move = null;
        this.state = 'land'; this.t = 0;
        this.hooks.landed(this, false);
        break;
      }
      case 'airHit':
        this.vx *= 0.3;
        this.setState('knockdown');
        this.hooks.landed(this, true);
        break;
      default:
        break;
    }
  }

  // ---------------- collision boxes (world space) ----------------

  hurtbox(): { x1: number; x2: number; y1: number; y2: number } | null {
    if (this.invuln > 0 || this.hidden) return null;
    if (['knockdown', 'getup', 'ko', 'thrown', 'finished', 'finisher'].includes(this.state)) return null;
    const H = this.height, W = 58 * this.scale;
    let y1 = this.y, h = H, w = W;
    const crouching =
      this.state === 'crouch' || this.state === 'prejump' ||
      ((this.state === 'block' || this.state === 'blockstun') && this.crouchBlock) ||
      (this.state === 'attack' && this.move?.crouching && !this.airborne);
    if (crouching) h = H * 0.62;
    if (this.state === 'airHit') { y1 = this.y + 10; h = H * 0.55; w = W * 1.5; }
    else if (this.airborne) { y1 = this.y + H * 0.1; h = H * 0.75; }
    return { x1: this.x - w / 2, x2: this.x + w / 2, y1, y2: y1 + h };
  }

  hitbox(): { x1: number; x2: number; y1: number; y2: number } | null {
    const m = this.move;
    if (this.state !== 'attack' || !m || !m.hitbox || this.moveHit || this.phase() !== 'active') return null;
    const s = this.scale, b = m.hitbox;
    const lx = b.x * s, w = b.w * s;
    const x1 = this.facing === 1 ? this.x + lx : this.x - lx - w;
    return { x1, x2: x1 + w, y1: this.y + b.y * s, y2: this.y + (b.y + b.h) * s };
  }
}
