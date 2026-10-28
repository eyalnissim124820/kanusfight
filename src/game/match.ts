import { Fighter } from './fighter';
import type { CharacterDef, HitHeight, InputFrame, MoveDef, ProjectileDef, SfxName } from './types';

export const VIEW_W = 960;
export const VIEW_H = 540;
export const STAGE_W = 1600;
export const ROUNDS_TO_WIN = 2;
export const ROUND_TIME = 99;

export interface Projectile {
  owner: Fighter;
  def: ProjectileDef;
  x: number; y: number; vx: number;
  life: number; t: number; dead: boolean;
}

export interface Particle {
  kind: 'spark' | 'blockSpark' | 'dust' | 'rock' | 'smoke' | 'ring' | 'flash';
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string; g: number; rot: number;
}

export interface Message { text: string; sub?: string; t: number; dur: number; color: string; size: number }

export type MatchPhase = 'intro' | 'fight' | 'ko' | 'finish' | 'fatal' | 'timeup' | 'roundOver' | 'over';

interface HitInfo {
  damage: number; chip: number; hitstun: number; blockstun: number;
  knockback: { x: number; y: number }; knockdown: boolean; height: HitHeight;
  shake: number; sfx: SfxName; heavy: boolean;
}

export interface MatchCallbacks {
  sfx(name: SfxName): void;
  onMatchOver(winner: Fighter): void;
}

/**
 * Owns one match: two fighters, rounds, timer, hit resolution, projectiles, effects and camera.
 * Pure simulation — rendering reads its public state.
 */
export class Match {
  readonly fighters: [Fighter, Fighter];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  messages: Message[] = [];
  phase: MatchPhase = 'intro';
  phaseT = 0;
  round = 1;
  timer = ROUND_TIME;
  private timerFrames = 0;
  camX = (STAGE_W - VIEW_W) / 2;
  shake = 0;
  slowmo = 0;
  private slowTick = 0;
  roundWinner: Fighter | null = null;
  finishName = '';
  perfect = false;
  hitboxes = false;
  frame = 0;

  constructor(p1: CharacterDef, p2: CharacterDef, private cb: MatchCallbacks) {
    this.fighters = [new Fighter(p1, 0), new Fighter(p2, 1)];
    const [a, b] = this.fighters;
    a.opponent = b; b.opponent = a;
    for (const f of this.fighters) f.hooks = this.makeHooks();
    this.startRound();
  }

  private makeHooks() {
    return {
      sfx: (n: SfxName) => this.cb.sfx(n),
      spawnProjectile: (o: Fighter, d: ProjectileDef) => this.spawnProjectile(o, d),
      hasProjectile: (o: Fighter) => this.projectiles.some((p) => p.owner === o && !p.dead),
      teleport: (f: Fighter) => this.teleport(f),
      activeStart: (f: Fighter, m: MoveDef) => {
        if (m.sfx && !m.projectile) this.cb.sfx(m.sfx);
        if (m.sfx === 'quake') {
          this.shake = Math.max(this.shake, m.shake ?? 8);
          const x = f.x + f.facing * 30 * f.scale;
          this.ring(x, 4, '#d9b38c');
          for (let i = 0; i < 14; i++) this.dust(x + (Math.random() - 0.5) * 200, 2);
        }
      },
      landed: (f: Fighter, hard: boolean) => {
        if (hard) {
          this.cb.sfx('thud');
          this.shake = Math.max(this.shake, 4);
          for (let i = 0; i < 10; i++) this.dust(f.x + (Math.random() - 0.5) * 90, 2);
        } else {
          this.cb.sfx('land');
          for (let i = 0; i < 4; i++) this.dust(f.x + (Math.random() - 0.5) * 40, 1);
        }
      },
      tryFinisher: (f: Fighter) => this.tryFinisher(f),
    };
  }

  startRound() {
    const [a, b] = this.fighters;
    const mid = STAGE_W / 2;
    a.resetForRound(mid - 170, 1);
    b.resetForRound(mid + 170, -1);
    this.projectiles = [];
    this.particles = [];
    this.timer = ROUND_TIME;
    this.timerFrames = 0;
    this.roundWinner = null;
    this.finishName = '';
    this.perfect = false;
    this.camX = (STAGE_W - VIEW_W) / 2;
    this.setPhase('intro');
    this.message(`ROUND ${this.round}`, 70, '#f2d06b', 72);
    this.cb.sfx('bell');
  }

  private setPhase(p: MatchPhase) { this.phase = p; this.phaseT = 0; }

  message(text: string, dur: number, color = '#f2d06b', size = 64, sub?: string) {
    this.messages.push({ text, sub, t: 0, dur, color, size });
  }

  // ---------------- main tick ----------------

  update(inputs: [InputFrame, InputFrame]) {
    this.frame++;
    if (this.slowmo > 0) {
      this.slowmo--;
      this.slowTick++;
      if (this.slowTick % 2 === 0) { this.updateEffects(); return; }
    }
    this.phaseT++;
    const [a, b] = this.fighters;

    const control = this.phase === 'fight' || this.phase === 'finish';
    a.update(inputs[0], control && (this.phase === 'fight' || this.roundWinner === a));
    b.update(inputs[1], control && (this.phase === 'fight' || this.roundWinner === b));

    for (const f of this.fighters) if (f.state === 'thrown') this.updateThrown(f);
    this.updateFacing();
    this.separate();
    this.updateCamera();
    this.clampToBounds();

    if (this.phase === 'fight' || this.phase === 'finish') {
      this.checkHits(a, b);
      this.checkHits(b, a);
      this.checkThrow(a, b);
      this.checkThrow(b, a);
    }
    this.updateProjectiles();
    this.updatePhase();
    this.updateEffects();
  }

  private updateFacing() {
    for (const f of this.fighters) {
      if (f.isNeutral() && !f.airborne) f.facing = f.opponent.x >= f.x ? 1 : -1;
    }
  }

  /** Bodies can't overlap (unless one is in the air above the other, or being thrown). */
  private separate() {
    const [a, b] = this.fighters;
    if ([a.state, b.state].some((s) => s === 'thrown' || s === 'throwing' || s === 'finished')) return;
    if (a.hidden || b.hidden) return;
    const vertical = Math.abs(a.y - b.y) < Math.min(a.height, b.height) * 0.55;
    if (!vertical) return;
    const minD = 26 * (a.scale + b.scale);
    const dx = b.x - a.x, d = Math.abs(dx);
    if (d >= minD) return;
    const push = (minD - d) / 2, dir = dx === 0 ? (a.facing === 1 ? 1 : -1) : Math.sign(dx);
    a.x -= dir * push;
    b.x += dir * push;
  }

  private updateCamera() {
    const [a, b] = this.fighters;
    const target = Math.max(0, Math.min(STAGE_W - VIEW_W, (a.x + b.x) / 2 - VIEW_W / 2));
    this.camX += (target - this.camX) * 0.25;
  }

  private clampToBounds() {
    const margin = 34;
    const lo = Math.max(margin, this.camX + margin), hi = Math.min(STAGE_W - margin, this.camX + VIEW_W - margin);
    for (const f of this.fighters) {
      if (f.state === 'thrown') continue;
      if (f.x < lo) { f.x = lo; if (f.vx < 0) f.vx = 0; }
      if (f.x > hi) { f.x = hi; if (f.vx > 0) f.vx = 0; }
    }
  }

  private nearWall(f: Fighter) {
    const lo = Math.max(34, this.camX + 34), hi = Math.min(STAGE_W - 34, this.camX + VIEW_W - 34);
    return f.x - lo < 24 || hi - f.x < 24;
  }

  // ---------------- combat ----------------

  private checkHits(att: Fighter, def: Fighter) {
    const hb = att.hitbox();
    if (!hb) return;
    const m = att.move!;
    if (m.throw) return;
    const hu = def.hurtbox();
    if (!hu) return;
    if (hb.x1 > hu.x2 || hb.x2 < hu.x1 || hb.y1 > hu.y2 || hb.y2 < hu.y1) return;
    att.moveHit = true;
    const cx = (Math.max(hb.x1, hu.x1) + Math.min(hb.x2, hu.x2)) / 2;
    const cy = (Math.max(hb.y1, hu.y1) + Math.min(hb.y2, hu.y2)) / 2;
    const heavy = m.damage >= 7;
    this.applyHit(att, def, {
      damage: m.damage, chip: m.special ? m.chip ?? 1 : 0,
      hitstun: m.hitstun ?? 16, blockstun: m.blockstun ?? 10,
      knockback: m.knockback ?? { x: 4, y: 0 }, knockdown: !!m.knockdown, height: m.height ?? 'mid',
      shake: m.shake ?? 0, sfx: m.hitSfx ?? (heavy ? 'hitHeavy' : 'hitLight'), heavy,
    }, Math.sign(def.x - att.x) || att.facing, cx, cy);
  }

  private isBlocking(f: Fighter, dir: number, height: HitHeight) {
    if (f.airborne) return false;
    if (f.state !== 'block' && f.state !== 'blockstun') return false;
    if (f.facing !== -dir) return false; // must face the incoming attack
    if (height === 'low' && !f.crouchBlock) return false;
    return true;
  }

  private applyHit(att: Fighter, def: Fighter, h: HitInfo, dir: number, cx: number, cy: number) {
    const w = def.def.stats.weight;
    if (this.isBlocking(def, dir, h.height)) {
      def.health = Math.max(0, def.health - h.chip * att.def.stats.power);
      def.stun = h.blockstun;
      def.state = 'blockstun'; def.t = 0;
      def.vx = dir * (h.knockback.x * 0.6 + 2);
      if (this.nearWall(def)) att.vx -= dir * (h.knockback.x * 0.5 + 2);
      att.hitstop = def.hitstop = 5;
      this.sparks(cx, cy, 'blockSpark', 8);
      this.cb.sfx('block');
      if (def.health <= 0) this.onKO(att, def);
      return;
    }

    const juggling = def.airborne || def.state === 'airHit';
    let dmg = h.damage * att.def.stats.power;
    if (juggling) { dmg *= Math.max(0.4, 1 - 0.2 * def.juggle); def.juggle++; }
    def.health = Math.max(0, def.health - dmg);
    def.combo++;
    def.move = null;
    def.flash = 4;

    if (juggling || h.knockback.y > 0 || h.knockdown) {
      def.state = 'airHit'; def.t = 0;
      def.vy = Math.max(h.knockback.y, juggling ? 8 : 5) / Math.sqrt(w);
      def.vx = dir * h.knockback.x * w;
      if (def.y <= 0) def.y = 0.01;
    } else {
      def.state = 'hitstun'; def.t = 0;
      def.stun = h.hitstun;
      def.hitAnim = cy - def.y > def.height * 0.55 ? 'high' : 'low';
      def.vx = dir * h.knockback.x * w;
      if (this.nearWall(def)) att.vx -= dir * h.knockback.x * 0.8;
    }
    att.hitstop = def.hitstop = h.heavy ? 9 : 6;
    if (h.shake) this.shake = Math.max(this.shake, h.shake);
    this.sparks(cx, cy, 'spark', h.heavy ? 16 : 9);
    if (h.heavy) this.particles.push(this.part('flash', cx, cy, 0, 0, 8, 46, '#ffffff', 0));
    this.cb.sfx(h.sfx);

    if (this.phase === 'finish' && this.roundWinner === att) {
      // the dizzy loser got hit instead of finished: knock them out cold
      def.toDizzy = false;
      def.koed = true;
      def.state = 'airHit'; def.t = 0;
      def.vy = Math.max(def.vy, 9);
      def.y = Math.max(def.y, 0.01);
      att.canFinish = false;
      this.setPhase('ko');
    } else if (def.health <= 0) this.onKO(att, def);
  }

  private checkThrow(att: Fighter, def: Fighter) {
    if (att.state !== 'attack' || !att.move?.throw || att.moveHit || att.phase() !== 'active') return;
    att.moveHit = true;
    const ok = !def.airborne && def.invuln <= 0 && att.distTo(def) < 100 * att.scale &&
      ['idle', 'walk', 'crouch', 'block', 'blockstun', 'land', 'attack', 'dizzy'].includes(def.state);
    if (!ok) return;
    att.state = 'throwing'; att.t = 0; att.move = null;
    def.state = 'thrown'; def.t = 0; def.thrower = att; def.vx = def.vy = 0; def.move = null;
    this.cb.sfx('throw');
  }

  private updateThrown(f: Fighter) {
    const a = f.thrower!;
    const k = f.t / 30;
    if (k < 1) {
      f.x = a.x + a.facing * 64 * Math.cos(Math.PI * k);
      f.y = 20 + 120 * Math.sin(Math.PI * k);
      return;
    }
    f.y = 0;
    f.x = a.x - a.facing * 70;
    f.vx = -a.facing * 5;
    f.state = 'knockdown'; f.t = 0;
    f.thrower = null;
    const dmg = a.def.moves.throw.damage * a.def.stats.power;
    f.health = Math.max(0, f.health - dmg);
    this.shake = Math.max(this.shake, 8);
    this.cb.sfx('thud');
    for (let i = 0; i < 12; i++) this.dust(f.x + (Math.random() - 0.5) * 100, 2);
    if (f.health <= 0) {
      if (this.phase === 'finish') { f.koed = true; f.toDizzy = false; a.canFinish = false; this.setPhase('ko'); }
      else this.onKO(a, f);
    }
  }

  private teleport(f: Fighter) {
    const o = f.opponent;
    const side = Math.sign(o.x - f.x) || 1;
    let nx = o.x + side * 95;
    const lo = Math.max(34, this.camX + 34), hi = Math.min(STAGE_W - 34, this.camX + VIEW_W - 34);
    if (nx < lo || nx > hi) nx = o.x - side * 95; // no room behind: stay in front
    for (let i = 0; i < 12; i++) this.smoke(f.x, f.y + 40 + Math.random() * 120, '#5b2d8f');
    f.x = Math.max(lo, Math.min(hi, nx));
    f.y = 0;
    f.facing = o.x >= f.x ? 1 : -1;
    for (let i = 0; i < 12; i++) this.smoke(f.x, f.y + 40 + Math.random() * 120, '#5b2d8f');
  }

  // ---------------- projectiles ----------------

  private spawnProjectile(o: Fighter, d: ProjectileDef) {
    const s = o.scale;
    this.projectiles.push({
      owner: o, def: d, x: o.x + o.facing * (d.x ?? 50) * s, y: o.y + d.y * s,
      vx: d.speed * o.facing, life: d.life, t: 0, dead: false,
    });
    this.cb.sfx('projectile');
  }

  private updateProjectiles() {
    const active = this.phase === 'fight' || this.phase === 'finish';
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.x += p.vx; p.t++; p.life--;
      if (p.life <= 0 || p.x < -100 || p.x > STAGE_W + 100) { p.dead = true; continue; }
      if (!active) continue;
      // projectile vs projectile
      for (const q of this.projectiles) {
        if (q === p || q.dead || q.owner === p.owner) continue;
        if (Math.abs(q.x - p.x) < (q.def.w + p.def.w) / 2 && Math.abs(q.y - p.y) < (q.def.h + p.def.h) / 2 + 10) {
          p.dead = q.dead = true;
          this.sparks((p.x + q.x) / 2, (p.y + q.y) / 2 + p.def.h / 2, 'spark', 18);
          this.ring((p.x + q.x) / 2, p.y + p.def.h / 2, '#ffffff');
          this.cb.sfx('hitHeavy');
        }
      }
      if (p.dead) continue;
      const t = p.owner.opponent, hu = t.hurtbox();
      if (!hu) continue;
      const x1 = p.x - p.def.w / 2, x2 = p.x + p.def.w / 2, y1 = p.y, y2 = p.y + p.def.h;
      if (x1 > hu.x2 || x2 < hu.x1 || y1 > hu.y2 || y2 < hu.y1) continue;
      p.dead = true;
      this.applyHit(p.owner, t, {
        damage: p.def.damage, chip: p.def.chip, hitstun: p.def.hitstun, blockstun: 14,
        knockback: p.def.knockback, knockdown: !!p.def.knockdown, height: p.def.height ?? 'mid',
        shake: 4, sfx: 'hitHeavy', heavy: true,
      }, Math.sign(p.vx), (Math.max(x1, hu.x1) + Math.min(x2, hu.x2)) / 2, (y1 + y2) / 2);
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  // ---------------- rounds ----------------

  private isDecidingWin(w: Fighter) { return w.wins + 1 >= ROUNDS_TO_WIN; }

  private onKO(winner: Fighter, loser: Fighter) {
    if (this.phase !== 'fight') return;
    this.roundWinner = winner;
    this.perfect = winner.health >= 100;
    if (this.isDecidingWin(winner)) {
      loser.toDizzy = true;
      this.setPhase('ko');
      this.slowmo = 30;
    } else {
      loser.koed = true;
      if (loser.state !== 'airHit' && loser.state !== 'knockdown') {
        loser.state = 'airHit'; loser.t = 0; loser.vy = 9; loser.y = Math.max(loser.y, 0.01);
        loser.vx = Math.sign(loser.x - winner.x) * 4;
      }
      this.setPhase('ko');
      this.slowmo = 50;
      this.message('K.O.', 90, '#ff3b2f', 110);
    }
    this.cb.sfx('hitHeavy');
  }

  private tryFinisher(f: Fighter) {
    if (this.phase !== 'finish' || this.roundWinner !== f) return false;
    const fin = f.def.finisher, d = f.distTo(f.opponent);
    const inRange = fin.range === 'any' || (fin.range === 'close' ? d < 120 : d > 200);
    if (!inRange || !f.consumeMotion(fin.motion, fin.button)) return false;
    const o = f.opponent;
    f.state = 'finisher'; f.t = 0; f.move = null; f.vx = 0;
    o.state = 'finished'; o.t = 0; o.vx = 0;
    this.finishName = fin.name.toUpperCase();
    this.messages = [];
    this.setPhase('fatal');
    this.cb.sfx('whooshHeavy');
    return true;
  }

  private updatePhase() {
    const [a, b] = this.fighters;
    switch (this.phase) {
      case 'intro':
        if (this.phaseT === 72) { this.message('FIGHT!', 50, '#ff3b2f', 96); this.cb.sfx('confirm'); }
        if (this.phaseT >= 110) this.setPhase('fight');
        break;
      case 'fight':
        if (++this.timerFrames >= 60) {
          this.timerFrames = 0;
          this.timer--;
          if (this.timer <= 0) {
            this.timer = 0;
            this.setPhase('timeup');
            this.message('TIME', 90, '#f2d06b', 96);
            this.roundWinner = a.health === b.health ? null : a.health > b.health ? a : b;
          }
        }
        break;
      case 'ko': {
        const w = this.roundWinner!, l = w.opponent;
        if (l.toDizzy && l.state === 'dizzy') {
          this.setPhase('finish');
          w.canFinish = true;
          this.message('END IT!', 120, '#ff3b2f', 96);
          break;
        }
        if (l.koed && l.state === 'ko' && w.isNeutral() && !w.airborne) {
          if (this.phaseT > 40) this.endRound(w);
        }
        if (this.phaseT > 600) this.endRound(w); // safety
        break;
      }
      case 'finish': {
        const w = this.roundWinner!, l = w.opponent;
        if (this.phaseT > 330 && l.state === 'dizzy') {
          // time ran out: the loser collapses
          w.canFinish = false;
          l.toDizzy = false; l.koed = true;
          l.state = 'airHit'; l.t = 0; l.vy = 4; l.y = 0.01;
          this.setPhase('ko');
        }
        break;
      }
      case 'fatal':
        this.updateFinisher();
        break;
      case 'timeup':
        if (this.phaseT >= 90) {
          const w = this.roundWinner;
          if (w) { w.opponent.setState('dizzy'); this.endRound(w); }
          else {
            this.message('DRAW', 120, '#f2d06b', 96);
            this.roundWinner = null;
            this.setPhase('roundOver');
          }
        }
        break;
      case 'roundOver':
        if (this.phaseT >= 200) {
          const w = this.roundWinner;
          if (w && w.wins >= ROUNDS_TO_WIN) { this.setPhase('over'); this.cb.onMatchOver(w); }
          else { this.round++; this.startRound(); }
        }
        break;
      case 'over':
        break;
    }
  }

  private endRound(w: Fighter) {
    w.wins++;
    w.canFinish = false;
    w.setState('victory');
    w.vx = 0;
    this.setPhase('roundOver');
    const sub = this.finishName ? `${this.finishName}!` : this.perfect ? 'PERFECT' : undefined;
    this.message(`${w.def.name} WINS`, 190, '#f2d06b', 72, sub);
  }

  private updateFinisher() {
    const w = this.roundWinner!, l = w.opponent, t = this.phaseT;
    const fin = w.def.finisher;
    const cx = l.x, cy = l.y + l.height * 0.5;
    if (fin.effect === 'shatter') {
      if (t < 50) l.stone = t / 50;
      if (t === 20) this.cb.sfx('hitHeavy');
      if (t === 60) {
        l.hidden = true;
        this.cb.sfx('shatter');
        this.shake = 16;
        this.ring(cx, cy, fin.color);
        for (let i = 0; i < 60; i++) {
          const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 9;
          const p = this.part('rock', cx + (Math.random() - 0.5) * 40, l.y + Math.random() * l.height,
            Math.cos(a) * s + w.facing * 3, Math.abs(Math.sin(a)) * s + 2, 120, 4 + Math.random() * 9, '#8b8580', 0.45);
          this.particles.push(p);
        }
      }
    } else if (fin.effect === 'slice') {
      // a flurry of cuts, then the opponent falls apart along one clean diagonal line
      if (t < 36 && t % 6 === 0) {
        this.cb.sfx('whoosh');
        l.flash = 3;
        this.sparks(cx + (Math.random() - 0.5) * 40, l.y + l.height * (0.3 + Math.random() * 0.5), 'blockSpark', 6);
      }
      if (t === 40) {
        this.cb.sfx('slice');
        this.shake = 10;
        this.particles.push(this.part('flash', cx, cy, 0, 0, 12, 90, '#ffffff', 0));
        for (let i = 0; i < 24; i++) {
          const k = Math.random() - 0.5;
          this.particles.push(this.part('spark', cx + k * 90, cy - k * 30, k * 10, (Math.random() - 0.5) * 3, 18, 3, fin.color, 0));
        }
      }
      if (t > 40) l.slice = Math.min(1, (t - 40) / 100);
      if (t === 140) l.hidden = true;
    } else {
      if (t < 40 && t % 3 === 0) this.ring(cx, cy, fin.color);
      if (t === 30) this.cb.sfx('vaporize');
      if (t >= 30 && t < 110) {
        l.vanish = (t - 30) / 80;
        for (let i = 0; i < 4; i++) this.smoke(l.x + (Math.random() - 0.5) * 50, l.y + Math.random() * l.height * (1 - l.vanish * 0.5), fin.color);
      }
      if (t === 110) l.hidden = true;
    }
    if (t >= 190) this.endRound(w);
  }

  // ---------------- particles ----------------

  private part(kind: Particle['kind'], x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, g: number): Particle {
    return { kind, x, y, vx, vy, life, max: life, size, color, g, rot: Math.random() * Math.PI * 2 };
  }

  sparks(x: number, y: number, kind: 'spark' | 'blockSpark', n: number) {
    const colors = kind === 'spark' ? ['#fff3b0', '#ffb347', '#ff6a2a'] : ['#cfe9ff', '#6ab8ff', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 7;
      this.particles.push(this.part(kind, x, y, Math.cos(a) * s, Math.sin(a) * s, 10 + Math.random() * 10, 2 + Math.random() * 3, colors[i % 3], -0.2));
    }
  }
  dust(x: number, y: number) {
    this.particles.push(this.part('dust', x, y, (Math.random() - 0.5) * 2, Math.random() * 1.5, 30 + Math.random() * 20, 8 + Math.random() * 10, '#b8a58a', 0));
  }
  smoke(x: number, y: number, color: string) {
    this.particles.push(this.part('smoke', x, y, (Math.random() - 0.5) * 1.5, 1 + Math.random() * 2, 40 + Math.random() * 30, 8 + Math.random() * 12, color, -0.02));
  }
  ring(x: number, y: number, color: string) {
    this.particles.push(this.part('ring', x, y, 0, 0, 24, 10, color, 0));
  }

  private updateEffects() {
    for (const p of this.particles) {
      p.x += p.vx; p.y += p.vy; p.vy -= p.g; p.life--;
      if (p.kind === 'rock' && p.y < 0) { p.y = 0; p.vy *= -0.35; p.vx *= 0.7; }
      if (p.kind === 'dust' || p.kind === 'smoke') { p.vx *= 0.95; }
      p.rot += p.vx * 0.05;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const m of this.messages) m.t++;
    this.messages = this.messages.filter((m) => m.t < m.dur);
    if (this.shake > 0) this.shake *= 0.85;
    if (this.shake < 0.3) this.shake = 0;
  }
}
