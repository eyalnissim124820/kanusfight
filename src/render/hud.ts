import type { Match, Particle, Projectile } from '../game/match';
import { VIEW_W, VIEW_H, ROUNDS_TO_WIN } from '../game/match';
import { GROUND_Y } from './stage';
import { blitFrame, spriteImage } from './fighterView';

export const FONT = '"Impact", "Haettenschweiler", "Arial Narrow Bold", sans-serif';

export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', stroke = '#000') {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 9);
  ctx.strokeStyle = stroke;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

const trail = [100, 100];

export function drawHud(ctx: CanvasRenderingContext2D, m: Match) {
  const BW = 370, BH = 22, Y = 26;
  m.fighters.forEach((f, i) => {
    trail[i] = Math.max(f.health, trail[i] - 0.5);
    if (trail[i] < f.health) trail[i] = f.health;
    const x0 = i === 0 ? 40 : VIEW_W - 40 - BW;
    ctx.fillStyle = '#000'; ctx.fillRect(x0 - 3, Y - 3, BW + 6, BH + 6);
    ctx.fillStyle = '#5a0b0b'; ctx.fillRect(x0, Y, BW, BH);
    const w = (BW * f.health) / 100, wt = (BW * trail[i]) / 100;
    // bars drain toward the outer edge (health stays anchored near the timer)
    const ax = (ww: number) => (i === 0 ? x0 + BW - ww : x0);
    ctx.fillStyle = '#f2d06b'; ctx.fillRect(ax(wt), Y, wt, BH);
    const g = ctx.createLinearGradient(0, Y, 0, Y + BH);
    g.addColorStop(0, '#5cff7a'); g.addColorStop(1, '#13a83a');
    ctx.fillStyle = f.health < 25 ? (Math.floor(m.frame / 8) % 2 ? '#ff3b2f' : '#ffb02f') : g;
    ctx.fillRect(ax(w), Y, w, BH);
    text(ctx, f.def.name, i === 0 ? x0 : x0 + BW, Y + BH + 18, 22, '#ffffff', i === 0 ? 'left' : 'right');
    for (let r = 0; r < ROUNDS_TO_WIN; r++) {
      const cx = i === 0 ? x0 + BW - 12 - r * 26 : x0 + 12 + r * 26;
      ctx.beginPath(); ctx.arc(cx, Y + BH + 18, 9, 0, Math.PI * 2);
      ctx.fillStyle = r < f.wins ? '#f2d06b' : '#2a2a2a'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke();
    }
    const opp = f.opponent;
    if (opp.combo >= 2 && opp.state !== 'idle') {
      text(ctx, `${opp.combo} HITS`, i === 0 ? 60 : VIEW_W - 60, 150, 40, '#ff8a2a', i === 0 ? 'left' : 'right');
    }
  });
  ctx.fillStyle = '#000'; ctx.fillRect(VIEW_W / 2 - 34, 14, 68, 50);
  text(ctx, String(Math.ceil(m.timer)).padStart(2, '0'), VIEW_W / 2, 40, 44, m.timer <= 10 ? '#ff3b2f' : '#f2d06b');

  for (const msg of m.messages) {
    const k = Math.min(1, msg.t / 8);
    const out = Math.min(1, (msg.dur - msg.t) / 10);
    ctx.save();
    ctx.globalAlpha = out;
    ctx.translate(VIEW_W / 2, VIEW_H * 0.38);
    const sc = 1.6 - 0.6 * k;
    ctx.scale(sc, sc);
    text(ctx, msg.text, 0, 0, msg.size, msg.color, 'center', '#000');
    if (msg.sub) text(ctx, msg.sub, 0, msg.size * 0.85, msg.size * 0.55, '#ffffff');
    ctx.restore();
  }
}

export function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, camX: number, frame: number) {
  const x = p.x - camX, y = GROUND_Y - p.y - p.def.h / 2, d = p.def;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 2, x, y, d.w);
  g.addColorStop(0, d.color); g.addColorStop(0.4, d.glow); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - d.w, y - d.w, d.w * 2, d.w * 2);
  ctx.restore();
  const sp = p.owner.def.sprites, img = sp && spriteImage(sp.src), fr = d.sprite && sp?.atlas[d.sprite]?.[0];
  if (sp && img && fr) {
    blitFrame(ctx, img, sp, fr, x, y, p.vx < 0 ? -1 : 1, p.owner.height);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.sign(p.vx), 1);
  ctx.fillStyle = d.color;
  if (d.style === 'orb') {
    const pulse = 1 + Math.sin(frame * 0.5) * 0.08;
    ctx.beginPath(); ctx.arc(0, 0, (d.w / 2) * 0.7 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a = frame * 0.3 + i * 2.1;
      ctx.beginPath(); ctx.arc(0, 0, d.w * 0.42, a, a + 0.9); ctx.stroke();
    }
  } else if (d.style === 'blade') {
    ctx.beginPath();
    ctx.moveTo(d.w / 2, 0);
    ctx.quadraticCurveTo(0, -d.h * 1.2, -d.w / 2, -d.h * 0.4);
    ctx.quadraticCurveTo(0, -d.h * 0.2, d.w / 2, 0);
    ctx.quadraticCurveTo(0, d.h * 0.2, -d.w / 2, d.h * 0.4);
    ctx.quadraticCurveTo(0, d.h * 1.2, d.w / 2, 0);
    ctx.fill();
  } else {
    ctx.fillRect(-d.w / 2, -d.h / 4, d.w, d.h / 2);
  }
  ctx.restore();
}

export function drawParticles(ctx: CanvasRenderingContext2D, ps: Particle[], camX: number) {
  for (const p of ps) {
    const x = p.x - camX, y = GROUND_Y - p.y, k = p.life / p.max;
    ctx.globalAlpha = Math.min(1, k * 1.5);
    switch (p.kind) {
      case 'spark': case 'blockSpark':
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 2.5, y + p.vy * 2.5); ctx.stroke();
        break;
      case 'dust': case 'smoke':
        ctx.fillStyle = p.color; ctx.globalAlpha = k * (p.kind === 'smoke' ? 0.6 : 0.4);
        ctx.beginPath(); ctx.arc(x, y, p.size * (1.6 - k * 0.6), 0, Math.PI * 2); ctx.fill();
        break;
      case 'rock':
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8);
        ctx.strokeStyle = '#3e3a36'; ctx.lineWidth = 1.5; ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8);
        ctx.restore();
        break;
      case 'ring':
        ctx.strokeStyle = p.color; ctx.lineWidth = 4 * k;
        ctx.beginPath(); ctx.ellipse(x, y, (1 - k) * 140 + 10, ((1 - k) * 140 + 10) * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'flash':
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,255,255,${k * 0.7})`;
        ctx.beginPath(); ctx.arc(x, y, p.size * (1.2 - k * 0.5), 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
    }
  }
  ctx.globalAlpha = 1;
}

export function drawShadow(ctx: CanvasRenderingContext2D, x: number, height: number, scale: number) {
  const s = Math.max(0.35, 1 - height / 300) * scale;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(x, GROUND_Y + 2, 46 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
}
