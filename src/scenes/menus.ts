import type { App, Mode, Scene } from './scene';
import { VIEW_W, VIEW_H, STAGE_W } from '../game/match';
import { ROSTER } from '../characters';
import { STAGES, drawStage, getStage, GROUND_Y } from '../render/stage';
import { drawCharacter } from '../render/fighterView';
import { text } from '../render/hud';
import { drawTitleBackdrop, drawTitlePlaque } from '../render/titleBackdrop';
import { drawMenuButton, drawMenuHeading } from '../render/menuUi';
import { FightScene } from './fight';
import type { CharacterDef, MotionDir } from '../game/types';
import type { Fighter } from '../game/fighter';
import type { Difficulty } from '../game/ai';
import { LoadingScene } from './loading';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];


function dim(ctx: CanvasRenderingContext2D, a: number) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// ---------------- Title ----------------

/** Two different random roster indices: the fighters shown on the title and pre-selected on character select. */
function randomPair(): [number, number] {
  const n = ROSTER.length;
  const a = Math.floor(Math.random() * n);
  const b = n > 1 ? (a + 1 + Math.floor(Math.random() * (n - 1))) % n : a;
  return [a, b];
}

/** The title backdrop with the two featured fighters standing on the terrace. */
function drawTitleScene(ctx: CanvasRenderingContext2D, app: App, pair: [number, number]) {
  const f = app.frame;
  drawTitleBackdrop(ctx, f);
  drawCharacter(ctx, ROSTER[pair[0]], 'idle', f, 140, GROUND_Y, 1);
  drawCharacter(ctx, ROSTER[pair[1]], 'idle', f, VIEW_W - 140, GROUND_Y, -1, 1);
}

/** Centred column of plaque buttons; `header` (if any) sits above them. `choices` lists the items that cycle with left/right. */
function drawMenu(ctx: CanvasRenderingContext2D, items: string[], sel: number, header?: string, choices: number[] = []) {
  let y = 262;
  if (header) { drawMenuHeading(ctx, header, VIEW_W / 2, y - 8); y += 46; }
  items.forEach((s, i) => drawMenuButton(ctx, s, VIEW_W / 2, y + i * 52, i === sel, choices.includes(i)));
}

export class TitleScene implements Scene {
  private sel = 0;
  private settings = false;
  private pair: [number, number];

  constructor(private app: App, opts: { settings?: boolean; pair?: [number, number] } = {}) {
    app.audio.stopMusic();
    this.pair = opts.pair ?? randomPair();
    if (opts.settings) { this.settings = true; this.sel = 1; }
  }

  private items(): string[] {
    return this.settings
      ? [`DIFFICULTY: ${this.app.difficulty.toUpperCase()}`, 'CONTROLS & MOVES', 'BACK']
      : ['1 PLAYER', '2 PLAYERS', 'SETTINGS'];
  }

  private cycleDifficulty(d: number) {
    this.app.difficulty = DIFFS[(DIFFS.indexOf(this.app.difficulty) + d + 3) % 3];
  }

  private open(settings: boolean) { this.settings = settings; this.sel = settings ? 0 : 2; }

  update() {
    const { input, audio } = this.app;
    const n = this.items().length;
    if (input.menuUp()) { this.sel = (this.sel + n - 1) % n; audio.play('select'); }
    if (input.menuDown()) { this.sel = (this.sel + 1) % n; audio.play('select'); }
    if (this.settings && this.sel === 0 && (input.menuLeft() || input.menuRight())) {
      this.cycleDifficulty(input.menuLeft() ? -1 : 1);
      audio.play('select');
    }
    if (this.settings && input.back()) { audio.play('select'); this.open(false); return; }
    if (input.confirm()) {
      audio.unlock();
      audio.play('confirm');
      if (!this.settings) {
        if (this.sel === 2) this.open(true);
        else this.app.setScene(new SelectScene(this.app, this.sel === 0 ? '1p' : '2p', this.pair));
      } else if (this.sel === 0) this.cycleDifficulty(1);
      else if (this.sel === 1) this.app.setScene(new ControlsScene(this.app, this.pair));
      else this.open(false);
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    drawTitleScene(ctx, this.app, this.pair);
    drawMenu(ctx, this.items(), this.sel, this.settings ? 'SETTINGS' : undefined, this.settings ? [0] : []);
    drawTitlePlaque(ctx, !!this.app.touch);
  }
}

// ---------------- Controls / move list ----------------

const arrow = (d: MotionDir) => ({ F: '→', B: '←', U: '↑', D: '↓', DF: '↘', DB: '↙', UF: '↗', UB: '↖', N: '·' })[d];

/** Fighters whose move lists share one page of the Controls screen. */
const MOVES_PER_PAGE = 2;

export class ControlsScene implements Scene {
  private page = 0;
  private readonly pages = Math.ceil(ROSTER.length / MOVES_PER_PAGE);
  constructor(private app: App, private pair?: [number, number]) {}
  update() {
    const { input, audio } = this.app;
    if (this.pages > 1 && (input.menuLeft() || input.menuRight())) {
      this.page = (this.page + (input.menuLeft() ? this.pages - 1 : 1)) % this.pages;
      audio.play('select');
    }
    if (input.back() || input.confirm()) {
      this.app.audio.play('select');
      this.app.setScene(new TitleScene(this.app, { settings: true, pair: this.pair }));
    }
  }
  render(ctx: CanvasRenderingContext2D) {
    drawTitleBackdrop(ctx, this.app.frame);
    ctx.fillStyle = 'rgba(13,10,18,0.92)';
    ctx.beginPath();
    ctx.roundRect(20, 14, VIEW_W - 40, VIEW_H - 28, 14);
    ctx.fill();
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
      text(ctx, r[0], 40, 88 + i * 28, 20, i ? '#ffffff' : '#f2d06b', 'left');
      text(ctx, r[1], 450, 88 + i * 28, 20, i ? '#9fe3ff' : '#f2d06b', 'left');
      text(ctx, r[2], 730, 88 + i * 28, 20, i ? '#ffb3a8' : '#f2d06b', 'left');
    });
    text(ctx, 'Close LP throw · close HP elbow · close HK knee · ←+LK sweep · ←+HK roundhouse · ↓+HP uppercut',
      VIEW_W / 2, 262, 17, '#dddddd');
    ROSTER.slice(this.page * MOVES_PER_PAGE, (this.page + 1) * MOVES_PER_PAGE).forEach((c, i) => {
      const x = 40 + i * 460;
      text(ctx, `${c.name} — ${c.title}`, x, 305, 24, '#f2d06b', 'left');
      const lines = c.specials.map((s) => `${s.name}: ${s.air ? '(air) ' : ''}${s.motion.map(arrow).join(' ')} + ${s.button}`);
      lines.push(`FINISHER ${c.finisher.name}: ${c.finisher.motion.map(arrow).join(' ')} + ${c.finisher.button} (${c.finisher.range})`);
      lines.forEach((l, j) => text(ctx, l, x, 340 + j * 28, 18, j === lines.length - 1 ? '#ff8a7a' : '#ffffff', 'left'));
    });
    if (this.pages > 1) text(ctx, `◀  FIGHTERS ${this.page + 1} / ${this.pages}  ▶`, VIEW_W / 2, 488, 20, '#f2d06b');
    text(ctx, 'Arrows are relative to facing (→ = toward the opponent). ◀ ▶ more fighters · Esc / Enter to return.', VIEW_W / 2, 515, 16, '#999999');
  }
}

// ---------------- Character select ----------------

export class SelectScene implements Scene {
  private cur: number[];
  private locked = [false, false];
  private t = 0;

  /**
   * `start` is the pair of roster indices the two cursors begin on (random when not given).
   * `locked` re-opens the screen with both picks made (coming back from Choose Location).
   */
  constructor(private app: App, private mode: Mode, start: [number, number] = randomPair(), locked = false) {
    this.cur = [...start];
    if (locked) this.locked = [true, true];
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
    // Both fighters picked: the NEXT button moves on to Choose Location, back un-picks the second.
    if (this.locked[0] && this.locked[1]) {
      if (input.back()) { this.locked[1] = false; audio.play('select'); }
      else if (input.confirm()) {
        audio.play('confirm');
        this.app.setScene(new LocationScene(this.app, this.mode, [this.cur[0], this.cur[1]]));
      }
      return;
    }
    const handle = (side: 0 | 1, layouts: ('p1' | 'p2')[], pad: number | null) => {
      if (this.locked[side]) return;
      if (input.menuLeft(layouts, pad)) { this.cur[side] = (this.cur[side] + n - 1) % n; audio.play('select'); }
      if (input.menuRight(layouts, pad)) { this.cur[side] = (this.cur[side] + 1) % n; audio.play('select'); }
      if (input.confirm(layouts, pad)) { this.locked[side] = true; audio.play('confirm'); }
    };
    const a = this.activeSide();
    if (a === null) { handle(0, ['p1'], 0); handle(1, ['p2'], 1); }
    else handle(a, ['p1', 'p2'], null);

    if (input.back()) {
      if (this.locked[1]) this.locked[1] = false;
      else if (this.locked[0]) this.locked[0] = false;
      else this.app.setScene(new TitleScene(this.app));
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const f = this.app.frame;
    drawTitleBackdrop(ctx, f, { logo: false });
    dim(ctx, 0.35);
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
    if (this.locked[0] && this.locked[1]) drawMenuButton(ctx, 'NEXT', VIEW_W / 2, 470, true);
  }
}

// ---------------- Location select ----------------

export class LocationScene implements Scene {
  /** Starts on a random location; left/right browse, confirm fights there. */
  private idx = Math.floor(Math.random() * STAGES.length);
  private t = 0;

  constructor(private app: App, private mode: Mode, private pair: [number, number]) {}

  update() {
    const { input, audio } = this.app;
    this.t++;
    const n = STAGES.length;
    if (input.menuLeft()) { this.idx = (this.idx + n - 1) % n; this.t = 0; audio.play('select'); }
    if (input.menuRight()) { this.idx = (this.idx + 1) % n; this.t = 0; audio.play('select'); }
    if (input.back()) {
      audio.play('select');
      this.app.setScene(new SelectScene(this.app, this.mode, this.pair, true));
    } else if (input.confirm()) {
      audio.play('confirm');
      const [a, b] = this.pair;
      const stage = STAGES[this.idx].id, mode = this.mode;
      this.app.setScene(new LoadingScene(this.app, () => createFight(this.app, mode, ROSTER[a], ROSTER[b], stage)));
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    // Full-screen preview of the location, slowly panning across it as the camera would in a fight.
    const mid = (STAGE_W - VIEW_W) / 2;
    drawStage(ctx, getStage(STAGES[this.idx].id), mid + Math.sin(this.t * 0.01) * mid * 0.9, this.app.frame);
    const g = ctx.createLinearGradient(0, 0, 0, 130);
    g.addColorStop(0, 'rgba(0,0,0,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, 130);
    text(ctx, 'CHOOSE LOCATION', VIEW_W / 2, 44, 52, '#f2d06b');
    if (STAGES.length > 1) text(ctx, `${this.idx + 1} / ${STAGES.length}`, VIEW_W / 2, 88, 20, '#ffffff');
    drawMenuButton(ctx, STAGES[this.idx].name, VIEW_W / 2, 470, true, STAGES.length > 1);
    text(ctx, '◀ ▶ browse · Enter fight · Esc back', VIEW_W / 2, 518, 16, '#dddddd');
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
      else if (this.sel === 1) this.app.setScene(new SelectScene(this.app, s.mode, [ROSTER.indexOf(s.p1), ROSTER.indexOf(s.p2)]));
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
