import type { App, Mode, Scene } from './scene';
import { Match, VIEW_W, VIEW_H } from '../game/match';
import { AIController } from '../game/ai';
import type { CharacterDef, InputFrame } from '../game/types';
import type { Fighter } from '../game/fighter';
import { drawStage, getStage, GROUND_Y } from '../render/stage';
import { drawFighter } from '../render/fighterView';
import { drawHud, drawParticles, drawProjectile, drawShadow, text } from '../render/hud';

export interface FightSetup { mode: Mode; p1: CharacterDef; p2: CharacterDef; stage: string }

export class FightScene implements Scene {
  match: Match;
  private ai: (AIController | null)[];
  private paused = false;
  private pauseSel = 0;

  constructor(private app: App, private setup: FightSetup, private onExit: (to: 'result' | 'title', winner?: Fighter) => void) {
    this.match = new Match(setup.p1, setup.p2, {
      sfx: (n) => app.audio.play(n),
      onMatchOver: (w) => window.setTimeout(() => onExit('result', w), 400),
    });
    const [a, b] = this.match.fighters;
    this.ai = [
      setup.mode === 'cpu' ? new AIController(a, this.match, app.difficulty) : null,
      setup.mode === '2p' ? null : new AIController(b, this.match, app.difficulty),
    ];
    app.audio.startMusic();
    app.touch?.setSpecials(setup.p1.specials.filter((s) => !s.air).map((s) => s.name));
  }

  private readInputs(): [InputFrame, InputFrame] {
    const { input } = this.app;
    const human = (side: 0 | 1): InputFrame => {
      if (this.setup.mode === '1p') return input.read(['p1', 'p2'], null); // any keyboard layout or pad
      return input.read([side === 0 ? 'p1' : 'p2'], side);
    };
    // one-tap specials from the touch controls belong to player 1
    if (!this.ai[0]) for (const i of input.specials) this.match.fighters[0].requestSpecial(i);
    return [this.ai[0] ? this.ai[0].poll() : human(0), this.ai[1] ? this.ai[1].poll() : human(1)];
  }

  update() {
    const { input, audio } = this.app;
    if (input.keyPressed('F1')) this.match.hitboxes = !this.match.hitboxes;
    if (input.keyPressed('KeyM')) audio.toggleMusic();
    if (input.keyPressed('KeyN')) audio.toggleMute();

    if (this.paused) {
      if (input.menuUp()) { this.pauseSel = (this.pauseSel + 2) % 3; audio.play('select'); }
      if (input.menuDown()) { this.pauseSel = (this.pauseSel + 1) % 3; audio.play('select'); }
      if (input.pause() && this.pauseSel !== 2) { this.paused = false; return; }
      if (input.confirm()) {
        audio.play('confirm');
        if (this.pauseSel === 0) this.paused = false;
        else if (this.pauseSel === 1) { this.app.setScene(new FightScene(this.app, this.setup, this.onExit)); }
        else { audio.stopMusic(); this.onExit('title'); }
      }
      return;
    }
    if (input.pause()) { this.paused = true; this.pauseSel = 0; return; }
    this.match.update(this.readInputs());
  }

  render(ctx: CanvasRenderingContext2D) {
    const m = this.match, frame = this.app.frame;
    ctx.save();
    if (m.shake) ctx.translate((Math.random() - 0.5) * m.shake * 2, (Math.random() - 0.5) * m.shake * 2);
    drawStage(ctx, getStage(this.setup.stage), m.camX, frame);

    for (const f of m.fighters) if (!f.hidden) drawShadow(ctx, f.x - m.camX, f.y, f.scale);
    // the attacking fighter is drawn on top
    const order = [...m.fighters].sort((a, b) => (a.state === 'attack' ? 1 : 0) - (b.state === 'attack' ? 1 : 0));
    for (const f of order) drawFighter(ctx, f, f.x - m.camX, GROUND_Y, frame);
    for (const p of m.projectiles) drawProjectile(ctx, p, m.camX, frame);
    drawParticles(ctx, m.particles, m.camX);
    if (m.hitboxes) this.drawBoxes(ctx);
    ctx.restore();

    if (m.phase === 'fatal') {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.45, m.phaseT / 60)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      for (const f of m.fighters) drawFighter(ctx, f, f.x - m.camX, GROUND_Y, frame);
      drawParticles(ctx, m.particles, m.camX);
      if (m.phaseT > 60) text(ctx, m.finishName, VIEW_W / 2, 120, 54, m.roundWinner!.def.finisher.color);
    }
    drawHud(ctx, m);
    if (this.paused) this.drawPause(ctx);
  }

  private drawBoxes(ctx: CanvasRenderingContext2D) {
    const m = this.match;
    ctx.lineWidth = 2;
    for (const f of m.fighters) {
      const hu = f.hurtbox();
      if (hu) { ctx.strokeStyle = '#3cf'; ctx.strokeRect(hu.x1 - m.camX, GROUND_Y - hu.y2, hu.x2 - hu.x1, hu.y2 - hu.y1); }
      const hb = f.hitbox();
      if (hb) { ctx.strokeStyle = '#f33'; ctx.strokeRect(hb.x1 - m.camX, GROUND_Y - hb.y2, hb.x2 - hb.x1, hb.y2 - hb.y1); }
      text(ctx, `${f.state}${f.moveId && f.state === 'attack' ? ':' + f.moveId : ''}`, f.x - m.camX, GROUND_Y + 30, 14, '#fff');
    }
    for (const p of m.projectiles) {
      ctx.strokeStyle = '#f3f';
      ctx.strokeRect(p.x - p.def.w / 2 - m.camX, GROUND_Y - p.y - p.def.h, p.def.w, p.def.h);
    }
  }

  private drawPause(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, 'PAUSED', VIEW_W / 2, 150, 72, '#f2d06b');
    ['RESUME', 'RESTART MATCH', 'QUIT TO TITLE'].forEach((s, i) =>
      text(ctx, s, VIEW_W / 2, 260 + i * 56, 38, i === this.pauseSel ? '#ff3b2f' : '#ffffff'));
    text(ctx, 'F1 hitboxes · M music · N mute', VIEW_W / 2, 470, 20, '#aaaaaa');
  }
}

