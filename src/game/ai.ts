import type { Fighter } from './fighter';
import type { Match } from './match';
import { emptyInput, type ButtonName, type InputFrame, type MotionDir, type SpecialRole } from './types';

export type Difficulty = 'easy' | 'normal' | 'hard';

const LEVEL: Record<Difficulty, { react: number; block: number; antiAir: number; finish: number }> = {
  easy: { react: 22, block: 0.2, antiAir: 0.15, finish: 0.2 },
  normal: { react: 13, block: 0.5, antiAir: 0.45, finish: 0.6 },
  hard: { react: 6, block: 0.8, antiAir: 0.8, finish: 1 },
};

/**
 * CPU controller. It produces the same InputFrame a human would, so it goes through the
 * exact same move/special parsing — no cheating shortcuts.
 */
export class AIController {
  private queue: InputFrame[] = [];
  private cooldown = 0;
  private holdBlock = 0;
  private cfg;

  constructor(private me: Fighter, private match: Match, difficulty: Difficulty = 'normal') {
    this.cfg = LEVEL[difficulty];
  }

  poll(): InputFrame {
    const me = this.me, o = me.opponent;
    if (this.queue.length) return this.queue.shift()!;

    const dist = me.distTo(o);
    const oAttacking = o.state === 'attack' && o.phase() !== 'recovery';
    const incoming = this.match.projectiles.find((p) => p.owner === o && Math.sign(me.x - p.x) === Math.sign(p.vx) && Math.abs(p.x - me.x) < 260);

    // Defensive reactions are checked every frame but gated by chance (reaction time).
    if (this.holdBlock > 0) {
      this.holdBlock--;
      return this.dirs({ block: true, down: o.move?.height === 'low' });
    }
    if (me.isNeutral() && (oAttacking && dist < 190 || incoming)) {
      if (Math.random() < this.cfg.block / 6) {
        if (incoming && incoming.def.height === 'high' && Math.random() < 0.5) {
          this.hold(this.dirs({ down: true }), 20);
          return this.queue.shift()!;
        }
        this.holdBlock = 14;
        return this.dirs({ block: true, down: o.move?.height === 'low' });
      }
    }

    if (this.cooldown > 0) { this.cooldown--; return this.idleDrift(dist); }
    this.cooldown = this.cfg.react + Math.floor(Math.random() * this.cfg.react);
    if (!me.isNeutral() && me.state !== 'jump') return emptyInput();

    // Finish phase: walk in and do the finisher (or just hit them)
    if (this.match.phase === 'finish' && me.canFinish) {
      const fin = me.def.finisher;
      const need = fin.range === 'close' ? 110 : fin.range === 'far' ? 210 : 9999;
      if (fin.range === 'far' && dist < need) { this.hold(this.dirs({ back: true }), 12); return this.queue.shift()!; }
      if (fin.range === 'close' && dist > need) { this.hold(this.dirs({ fwd: true }), 10); return this.queue.shift()!; }
      if (Math.random() < this.cfg.finish) this.motion(fin.motion, fin.button);
      else this.press('HP');
      return this.queue.shift() ?? emptyInput();
    }
    if (this.match.phase !== 'fight') return emptyInput();

    const ag = me.def.ai?.aggression ?? 0.5, zone = me.def.ai?.zoning ?? 0.4;
    const r = Math.random();

    if (me.state === 'jump') return emptyInput();

    // Anti-air
    if (o.airborne && o.state !== 'airHit' && dist < 170 && Math.random() < this.cfg.antiAir) {
      if (!this.special('antiair')) this.press('HP', { down: true });
      return this.queue.shift()!;
    }
    // Opponent on the floor: close in
    if (o.state === 'knockdown' || o.state === 'getup') {
      this.hold(this.dirs({ fwd: dist > 120 }), 12);
      return this.queue.shift()!;
    }

    if (dist > 330) {
      if (r < zone && this.special('projectile')) return this.queue.shift()!;
      if (r < zone + 0.15) { this.jump(1, Math.random() < 0.7 ? 'HK' : 'HP'); return this.queue.shift()!; }
      this.hold(this.dirs({ fwd: true }), 20 + Math.floor(Math.random() * 20));
    } else if (dist > 140) {
      if (r < 0.2 && this.special('rush')) return this.queue.shift()!;
      if (r < 0.3 && this.special('projectile')) return this.queue.shift()!;
      if (r < 0.45) { this.jump(1, 'HK'); return this.queue.shift()!; }
      if (r < 0.5 && this.special('teleport')) return this.queue.shift()!;
      if (r < 0.55 + ag * 0.3) this.hold(this.dirs({ fwd: true }), 14);
      else this.hold(this.dirs({ back: true }), 10);
    } else {
      const pick = Math.random();
      if (pick < 0.12) this.press('LP'); // throw when close, jab otherwise
      else if (pick < 0.24) this.press('HP');
      else if (pick < 0.34) this.press('HP', { down: true });
      else if (pick < 0.44) this.press('LK', { back: true });
      else if (pick < 0.52) this.press('HK', { back: true });
      else if (pick < 0.6) this.press('HK');
      else if (pick < 0.68) this.press('LK', { down: true });
      else if (pick < 0.74 && this.special('low')) { /* queued */ }
      else if (pick < 0.8) { this.holdBlock = 20; }
      else if (pick < 0.88) this.hold(this.dirs({ back: true }), 14);
      else this.press('LK');
    }
    return this.queue.shift() ?? emptyInput();
  }

  private idleDrift(dist: number): InputFrame {
    // small footsies movement while waiting to act
    if (this.match.phase !== 'fight' || !this.me.isNeutral()) return emptyInput();
    if (dist > 260 && Math.random() < 0.5) return this.dirs({ fwd: true });
    return emptyInput();
  }

  private dirs(o: { fwd?: boolean; back?: boolean; up?: boolean; down?: boolean; block?: boolean }): InputFrame {
    const f = emptyInput();
    const right = this.me.facing === 1;
    if (o.fwd) { if (right) f.right = true; else f.left = true; }
    if (o.back) { if (right) f.left = true; else f.right = true; }
    f.up = !!o.up; f.down = !!o.down; f.BL = !!o.block;
    return f;
  }

  private hold(f: InputFrame, frames: number) {
    for (let i = 0; i < frames; i++) this.queue.push({ ...f });
  }

  private press(b: ButtonName, d: { fwd?: boolean; back?: boolean; down?: boolean } = {}) {
    const base = this.dirs(d);
    this.queue.push({ ...base });
    this.queue.push({ ...base, [b]: true });
    this.queue.push({ ...base, [b]: true });
    this.queue.push(emptyInput());
  }

  private jump(dir: -1 | 0 | 1, attack: ButtonName) {
    const up = this.dirs({ up: true, fwd: dir === 1, back: dir === -1 });
    this.hold(up, 4);
    this.hold(emptyInput(), 12 + Math.floor(Math.random() * 8));
    this.queue.push({ ...emptyInput(), [attack]: true });
    this.queue.push(emptyInput());
  }

  private motion(m: MotionDir[], b: ButtonName) {
    let last = '';
    for (const d of m) {
      if (d === last) this.queue.push(emptyInput());
      const f = this.dirs({
        fwd: d.includes('F'), back: d.includes('B'), up: d.includes('U'), down: d.includes('D'),
      });
      this.queue.push({ ...f }, { ...f });
      last = d;
    }
    const tail = this.queue[this.queue.length - 1];
    this.queue.push({ ...tail, [b]: true }, emptyInput());
  }

  private special(role: SpecialRole) {
    const s = this.me.def.specials.find((x) => x.role === role && !x.air);
    if (!s) return false;
    if (s.move.projectile && this.match.projectiles.some((p) => p.owner === this.me)) return false;
    this.motion(s.motion, s.button);
    return true;
  }
}
