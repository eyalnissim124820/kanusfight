import type { App, Mode, Scene } from './scene';
import { VIEW_W, VIEW_H } from '../game/match';
import { ROSTER } from '../characters';
import { STAGES, drawStage, getStage, GROUND_Y } from '../render/stage';
import { drawCharacter } from '../render/fighterView';
import { text } from '../render/hud';
import { FightScene } from './fight';
import type { CharacterDef, MotionDir } from '../game/types';
import type { Fighter } from '../game/fighter';
import type { Difficulty } from '../game/ai';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];


function dim(ctx: CanvasRenderingContext2D, a: number) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// ---------------- Title ----------------

export class TitleScene implements Scene {
  private sel = 0;
  private items = ['1 PLAYER', '2 PLAYERS', 'CPU VS CPU', 'DIFFICULTY', 'CONTROLS & MOVES'];
  constructor(private app: App) { app.audio.stopMusic(); }

  update() {
    const { input, audio } = this.app;
    if (input.menuUp()) { this.sel = (this.sel + this.items.length - 1) % this.items.length; audio.play('select'); }
    if (input.menuDown()) { this.sel = (this.sel + 1) % this.items.length; audio.play('select'); }
    if (this.sel === 3 && (input.menuLeft() || input.menuRight())) {
      const d = input.menuLeft() ? -1 : 1;
      this.app.difficulty = DIFFS[(DIFFS.indexOf(this.app.difficulty) + d + 3) % 3];
      audio.play('select');
    }
    if (input.confirm()) {
      audio.unlock();
      audio.play('confirm');
      if (this.sel <= 2) this.app.setScene(new SelectScene(this.app, (['1p', '2p', 'cpu'] as Mode[])[this.sel]));
      else if (this.sel === 3) this.app.difficulty = DIFFS[(DIFFS.indexOf(this.app.difficulty) + 1) % 3];
      else this.app.setScene(new ControlsScene(this.app));
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const f = this.app.frame;
    drawStage(ctx, getStage('ember'), 320 + Math.sin(f * 0.003) * 300, f);
    const left = ROSTER.find((c) => c.sprites) ?? ROSTER[0];
    const right = ROSTER.find((c) => c !== left && !c.sprites) ?? ROSTER[1 % ROSTER.length];
    drawCharacter(ctx, left, 'idle', f, 230, GROUND_Y, 1);
    drawCharacter(ctx, right, 'idle', f, 730, GROUND_Y, -1, 1);
    dim(ctx, 0.35);
    text(ctx, "KANU'S FIGHT", VIEW_W / 2, 110, 96, '#f2d06b', 'center', '#3a0a00');
    text(ctx, 'A 2D ARCADE FIGHTER', VIEW_W / 2, 175, 24, '#ffffff');
    this.items.forEach((s, i) => {
      const label = i === 3 ? `DIFFICULTY: ${this.app.difficulty.toUpperCase()}` : s;
      text(ctx, label, VIEW_W / 2, 250 + i * 50, 36, i === this.sel ? '#ff3b2f' : '#ffffff');
    });
    if (Math.floor(f / 30) % 2) text(ctx, this.app.touch ? 'STICK TO CHOOSE · HP OR LP TO SELECT' : 'ENTER / J TO SELECT', VIEW_W / 2, 515, 18, '#cccccc');
  }
}

// ---------------- Controls / move list ----------------

const arrow = (d: MotionDir) => ({ F: '→', B: '←', U: '↑', D: '↓', DF: '↘', DB: '↙', UF: '↗', UB: '↖', N: '·' })[d];

export class ControlsScene implements Scene {
  constructor(private app: App) {}
  update() {
    if (this.app.input.back() || this.app.input.confirm()) { this.app.audio.play('select'); this.app.setScene(new TitleScene(this.app)); }
  }
  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#0d0a12'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, 'CONTROLS', VIEW_W / 2, 40, 48, '#f2d06b');
    const rows: [string, string, string][] = [
      ['', 'PLAYER 1', 'PLAYER 2'],
      ['Move / jump / crouch', 'W A S D', 'Arrow keys'],
      ['High Punch · Block · High Kick', 'U · I · O', 'Num7 · Num8 · Num9'],
      ['Low Punch · Block · Low Kick', 'J · K · L', 'Num4 · Num5 · Num6'],
      ['Gamepad', 'X/Y punch · A/B kick · LB/RB block', ''],
      ['Touch screen', 'stick · HP LP HK LK · BLOCK · ★ = special', ''],
    ];
    rows.forEach((r, i) => {
      text(ctx, r[0], 40, 100 + i * 30, 20, i ? '#ffffff' : '#f2d06b', 'left');
      text(ctx, r[1], 450, 100 + i * 30, 20, i ? '#9fe3ff' : '#f2d06b', 'left');
      text(ctx, r[2], 730, 100 + i * 30, 20, i ? '#ffb3a8' : '#f2d06b', 'left');
    });
    text(ctx, 'Close LP throw · close HP elbow · close HK knee · ←+LK sweep · ←+HK roundhouse · ↓+HP uppercut',
      VIEW_W / 2, 262, 17, '#dddddd');
    ROSTER.forEach((c, i) => {
      const x = 40 + i * 460;
      text(ctx, `${c.name} — ${c.title}`, x, 305, 24, '#f2d06b', 'left');
      const lines = c.specials.map((s) => `${s.name}: ${s.air ? '(air) ' : ''}${s.motion.map(arrow).join(' ')} + ${s.button}`);
      lines.push(`FINISHER ${c.finisher.name}: ${c.finisher.motion.map(arrow).join(' ')} + ${c.finisher.button} (${c.finisher.range})`);
      lines.forEach((l, j) => text(ctx, l, x, 340 + j * 28, 18, j === lines.length - 1 ? '#ff8a7a' : '#ffffff', 'left'));
    });
    text(ctx, 'Arrows are relative to facing (→ = toward the opponent). Esc / Enter to return.', VIEW_W / 2, 515, 16, '#999999');
  }
}

// ---------------- Character select ----------------

export class SelectScene implements Scene {
  private cur = [0, Math.min(1, ROSTER.length - 1)];
  private locked = [false, false];
  private t = 0;
  private stageIdx = Math.floor(Math.random() * STAGES.length);

  constructor(private app: App, private mode: Mode) {
    if (mode === 'cpu') this.locked = [false, false];
  }

  /** Who controls each cursor: in 1P / CPU modes player 1 picks both sides in order. */
  private activeSide(): 0 | 1 | null {
    if (this.mode === '2p') return null;
    return this.locked[0] ? 1 : 0;
  }

  update() {
    const { input, audio } = this.app;
    this.t++;
    const n = ROSTER.length;
    const handle = (side: 0 | 1, layouts: ('p1' | 'p2')[], pad: number | null) => {
      if (this.locked[side]) return;
      if (input.menuLeft(layouts, pad)) { this.cur[side] = (this.cur[side] + n - 1) % n; audio.play('select'); }
      if (input.menuRight(layouts, pad)) { this.cur[side] = (this.cur[side] + 1) % n; audio.play('select'); }
      if (input.confirm(layouts, pad)) { this.locked[side] = true; audio.play('confirm'); }
    };
    const a = this.activeSide();
    if (a === null) { handle(0, ['p1'], 0); handle(1, ['p2'], 1); }
    else handle(a, ['p1', 'p2'], null);

    if (input.keyPressed('Tab')) { this.stageIdx = (this.stageIdx + 1) % STAGES.length; audio.play('select'); }
    if (input.back()) {
      if (this.locked[1]) this.locked[1] = false;
      else if (this.locked[0]) this.locked[0] = false;
      else this.app.setScene(new TitleScene(this.app));
      return;
    }
    if (this.locked[0] && this.locked[1]) {
      this.app.setScene(createFight(this.app, this.mode, ROSTER[this.cur[0]], ROSTER[this.cur[1]], STAGES[this.stageIdx].id));
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const f = this.app.frame;
    drawStage(ctx, getStage(STAGES[this.stageIdx].id), 320, f);
    dim(ctx, 0.55);
    text(ctx, 'CHOOSE YOUR FIGHTER', VIEW_W / 2, 44, 52, '#f2d06b');
    const who = this.mode === '2p' ? '' : this.locked[0] ? 'PICK YOUR OPPONENT' : this.mode === 'cpu' ? 'PICK CPU 1' : 'PICK YOUR FIGHTER';
    if (who) text(ctx, who, VIEW_W / 2, 88, 22, '#ffffff');

    const cell = 96, gx = VIEW_W / 2 - (ROSTER.length * (cell + 12)) / 2;
    ROSTER.forEach((c, i) => {
      const x = gx + i * (cell + 12), y = 112;
      ctx.fillStyle = '#1a1420'; ctx.fillRect(x, y, cell, cell);
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, cell, cell); ctx.clip();
      ctx.translate(x + cell / 2, y + cell + 66);
      ctx.scale(0.75, 0.75);
      drawCharacter(ctx, c, 'idle', 0, 0, 0, 1);
      ctx.restore();
      [0, 1].forEach((side) => {
        if (this.cur[side] !== i) return;
        const blink = this.locked[side] || Math.floor(this.t / 10) % 2;
        ctx.lineWidth = 4;
        ctx.strokeStyle = side === 0 ? '#3aa0ff' : '#ff3b2f';
        if (blink) ctx.strokeRect(x - 3 - side * 5, y - 3 - side * 5, cell + 6 + side * 10, cell + 6 + side * 10);
      });
    });

    [0, 1].forEach((side) => {
      const c = ROSTER[this.cur[side]];
      const x = side === 0 ? 200 : 760;
      drawCharacter(ctx, c, 'idle', f, x, GROUND_Y, side === 0 ? 1 : -1, side);
      text(ctx, c.name, x, 255, 44, side === 0 ? '#9fe3ff' : '#ffb3a8');
      text(ctx, c.title, x, 290, 18, '#ffffff');
      if (this.locked[side]) text(ctx, 'READY', x, 505, 30, '#f2d06b');
    });
    const c = ROSTER[this.cur[this.activeSide() ?? 0]];
    wrap(ctx, c.bio, VIEW_W / 2, 330, 300, 18);
    text(ctx, `STAGE: ${STAGES[this.stageIdx].name.toUpperCase()} (TAB)`, VIEW_W / 2, 470, 18, '#cccccc');
  }
}

function wrap(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, w: number, size: number) {
  ctx.font = `${size}px sans-serif`;
  const words = s.split(' ');
  let line = '', yy = y;
  for (const wd of words) {
    const t = line ? `${line} ${wd}` : wd;
    if (ctx.measureText(t).width > w) { text(ctx, line, x, yy, size, '#dddddd'); line = wd; yy += size + 6; }
    else line = t;
  }
  if (line) text(ctx, line, x, yy, size, '#dddddd');
}

export function createFight(app: App, mode: Mode, p1: CharacterDef, p2: CharacterDef, stage: string): Scene {
  const setup = { mode, p1, p2, stage };
  return new FightScene(app, setup, (to, winner) => {
    if (to === 'title') app.setScene(new TitleScene(app));
    else app.setScene(new ResultScene(app, setup, winner!));
  });
}

// ---------------- Result ----------------

export class ResultScene implements Scene {
  private sel = 0;
  constructor(private app: App, private setup: { mode: Mode; p1: CharacterDef; p2: CharacterDef; stage: string }, private winner: Fighter) {
    app.audio.stopMusic();
  }
  update() {
    const { input, audio } = this.app;
    if (input.menuUp()) { this.sel = (this.sel + 2) % 3; audio.play('select'); }
    if (input.menuDown()) { this.sel = (this.sel + 1) % 3; audio.play('select'); }
    if (input.confirm()) {
      audio.play('confirm');
      const s = this.setup;
      if (this.sel === 0) this.app.setScene(createFight(this.app, s.mode, s.p1, s.p2, s.stage));
      else if (this.sel === 1) this.app.setScene(new SelectScene(this.app, s.mode));
      else this.app.setScene(new TitleScene(this.app));
    }
  }
  render(ctx: CanvasRenderingContext2D) {
    const f = this.app.frame, w = this.winner.def;
    drawStage(ctx, getStage(this.setup.stage), 320, f);
    dim(ctx, 0.5);
    drawCharacter(ctx, w, 'victory', f, VIEW_W / 2, GROUND_Y, 1);
    const label = this.setup.mode === '1p' ? (this.winner.side === 0 ? 'YOU WIN' : 'YOU LOSE') : `PLAYER ${this.winner.side + 1} WINS`;
    text(ctx, `${w.name} WINS THE MATCH`, VIEW_W / 2, 70, 56, '#f2d06b');
    text(ctx, label, VIEW_W / 2, 120, 28, '#ffffff');
    ['REMATCH', 'CHARACTER SELECT', 'TITLE'].forEach((s, i) =>
      text(ctx, s, VIEW_W / 2 + 300, 330 + i * 46, 32, i === this.sel ? '#ff3b2f' : '#ffffff'));
  }
}
