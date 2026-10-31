import { ROSTER } from '../characters';
import { drawSkeleton } from '../render/skeleton';
import { posesFor } from '../render/fighterView';
import type { CharacterDef, Pose } from '../game/types';

/**
 * Developer tool: open /?tool=poses to see every pose of every character on one sheet.
 * Press D to download the sheet as a PNG — handy as a reference for drawing sprites in phase 2.
 * Use ?tool=poses&char=taldan to show a single character.
 */
export function runPoseSheet(canvas: HTMLCanvasElement) {
  const q = new URLSearchParams(location.search);
  // sprite-art characters have no skeleton poses to show
  const chars = (q.get('char') ? ROSTER.filter((c) => c.id === q.get('char')) : ROSTER).filter((c) => !c.sprites);
  const CW = 150, CH = 230, COLS = 10;
  const entries: { def: CharacterDef; label: string; pose: Pose; grounded: boolean }[] = [];
  for (const def of chars) {
    const P = posesFor(def);
    for (const [k, p] of Object.entries(P)) entries.push({ def, label: k, pose: p, grounded: !['jump', 'airHit', 'thrown'].includes(k) });
    for (const [k, m] of Object.entries(def.moves)) {
      entries.push({ def, label: `${k}.windup`, pose: m.poses.windup, grounded: !m.air });
      entries.push({ def, label: `${k}.strike`, pose: m.poses.strike, grounded: !m.air });
    }
    for (const s of def.specials) {
      entries.push({ def, label: `${s.id}.windup`, pose: s.move.poses.windup, grounded: !s.air });
      entries.push({ def, label: `${s.id}.strike`, pose: s.move.poses.strike, grounded: !s.air });
    }
    entries.push({ def, label: 'finisher', pose: def.finisher.pose, grounded: true });
  }
  const rows = Math.ceil(entries.length / COLS);
  canvas.width = COLS * CW;
  canvas.height = rows * CH;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  document.body.style.overflow = 'auto';
  document.body.style.display = 'block';
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#20202a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  entries.forEach((e, i) => {
    const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH;
    ctx.fillStyle = i % 2 ? '#2a2a36' : '#262632';
    ctx.fillRect(x, y, CW, CH);
    ctx.strokeStyle = '#555'; ctx.beginPath(); ctx.moveTo(x, y + CH - 24); ctx.lineTo(x + CW, y + CH - 24); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, CW, CH); ctx.clip();
    const s = 0.82 / e.def.body.scale;
    ctx.translate(x + CW / 2 - 10, y + CH - 24 - (e.grounded ? 0 : 40));
    ctx.scale(s, s);
    drawSkeleton(ctx, e.def, e.pose, 0, 0, 1, e.grounded);
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${e.def.id}:${e.label}`, x + CW / 2, y + CH - 8);
  });
  window.addEventListener('keydown', (ev) => {
    if (ev.code !== 'KeyD') return;
    const a = document.createElement('a');
    a.download = 'pose-sheet.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  });
}
