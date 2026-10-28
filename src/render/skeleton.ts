import type { CharacterDef, Pose } from '../game/types';

type V = { x: number; y: number };

export interface Skeleton {
  hip: V; neck: V; head: V;
  fShoulder: V; fElbow: V; fHand: V;
  bShoulder: V; bElbow: V; bHand: V;
  fKnee: V; fFoot: V; bKnee: V; bFoot: V;
  fToe: V; bToe: V;
}

const rad = (d: number) => (d * Math.PI) / 180;
/** Direction for a limb angle (0 = down, 90 = forward, 180 = up), y-up space. */
const limb = (a: number, len: number): V => ({ x: Math.sin(rad(a)) * len, y: -Math.cos(rad(a)) * len });
const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y });

/** Forward kinematics. Returns joints in local space (facing right, y-up, origin on the ground). */
export function solveSkeleton(def: CharacterDef, pose: Pose, grounded: boolean): Skeleton {
  const b = def.body;
  const fKneeRel = limb(pose.fh, b.thigh);
  const fFootRel = add(fKneeRel, limb(pose.fh + pose.fk, b.shin));
  const bKneeRel = limb(pose.bh, b.thigh);
  const bFootRel = add(bKneeRel, limb(pose.bh + pose.bk, b.shin));

  let hipY: number;
  if (pose.hip !== undefined) hipY = pose.hip;
  else if (grounded) hipY = Math.max(-fFootRel.y, -bFootRel.y) + 2;
  else hipY = (b.thigh + b.shin) * 0.85;
  hipY += pose.y ?? 0;

  const hip: V = { x: pose.x ?? 0, y: hipY };
  const tDir = { x: Math.sin(rad(pose.torso)), y: Math.cos(rad(pose.torso)) };
  const neck: V = { x: hip.x + tDir.x * b.torso, y: hip.y + tDir.y * b.torso };
  const hA = rad(pose.torso + pose.head);
  const head: V = { x: neck.x + Math.sin(hA) * (b.headR + 5), y: neck.y + Math.cos(hA) * (b.headR + 5) };
  const sh = { x: hip.x + tDir.x * b.torso * 0.86, y: hip.y + tDir.y * b.torso * 0.86 };
  const fShoulder = { x: sh.x + 4, y: sh.y };
  const bShoulder = { x: sh.x - 5, y: sh.y + 1 };
  const fElbow = add(fShoulder, limb(pose.fs, b.upperArm));
  const fHand = add(fElbow, limb(pose.fs + pose.fe, b.forearm));
  const bElbow = add(bShoulder, limb(pose.bs, b.upperArm));
  const bHand = add(bElbow, limb(pose.bs + pose.be, b.forearm));
  const fKnee = add(hip, fKneeRel), fFoot = add(hip, fFootRel);
  const bKnee = add(hip, bKneeRel), bFoot = add(hip, bFootRel);
  // feet point forward, perpendicular-ish to the shin
  const fToe = add(fFoot, limb(pose.fh + pose.fk + 90, 16));
  const bToe = add(bFoot, limb(pose.bh + pose.bk + 90, 16));

  const sk: Skeleton = { hip, neck, head, fShoulder, fElbow, fHand, bShoulder, bElbow, bHand, fKnee, fFoot, bKnee, bFoot, fToe, bToe };
  const r = pose.rot ?? 0;
  if (r) {
    const c = Math.cos(rad(r)), s = Math.sin(rad(r));
    for (const k of Object.keys(sk) as (keyof Skeleton)[]) {
      if (k === 'hip') continue;
      const p = sk[k], dx = p.x - hip.x, dy = p.y - hip.y;
      sk[k] = { x: hip.x + dx * c + dy * s, y: hip.y - dx * s + dy * c };
    }
  }
  return sk;
}

// ---------------- drawing ----------------

export interface DrawOpts {
  alpha?: number;
  flash?: number; // 0..1 white flash
  stone?: number; // 0..1 turn to stone
  tint?: string; // color overlay (vaporize)
  tintAmt?: number;
}

type Prim =
  | { k: 'cap'; a: V; b: V; w: number; c: string }
  | { k: 'circ'; p: V; r: number; c: string }
  | { k: 'poly'; pts: V[]; c: string };

function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1)}`;
}
const shade = (c: string, t: number) => mix(c, '#000000', t);
const lerpV = (a: V, b: V, t: number): V => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/**
 * Draw a fighter. (sx, sy) = screen position of the ground point under the fighter.
 * The skeleton is built facing right; `facing` mirrors it.
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D, def: CharacterDef, pose: Pose, sx: number, sy: number,
  facing: 1 | -1, grounded: boolean, opts: DrawOpts = {},
) {
  const sk = solveSkeleton(def, pose, grounded);
  const pal = def.palette, look = def.look, b = def.body;
  const recolor = (c: string) => {
    let out = c;
    if (opts.stone) out = mix(out, mix('#8d8a86', out, 0.15), opts.stone);
    if (opts.tint && opts.tintAmt) out = mix(out, opts.tint, opts.tintAmt);
    if (opts.flash) out = mix(out, '#ffffff', opts.flash);
    return out;
  };

  const skin = pal.skin, suit = look.suit ? pal.primary : skin;
  const legTop = pal.primary;
  const legLow = look.pants === 'gi' ? pal.primary : skin;

  const back: Prim[] = [], body: Prim[] = [], front: Prim[] = [];

  const leg = (out: Prim[], hipP: V, knee: V, foot: V, toe: V, dark: number) => {
    const w = b.legW;
    if (look.pants === 'trunks') {
      const split = lerpV(hipP, knee, 0.45);
      out.push({ k: 'cap', a: split, b: knee, w, c: shade(skin, dark) });
      out.push({ k: 'cap', a: hipP, b: split, w: w + 3, c: shade(legTop, dark) });
      const bootTop = lerpV(knee, foot, 0.35);
      out.push({ k: 'cap', a: knee, b: bootTop, w: w - 2, c: shade(skin, dark) });
      out.push({ k: 'cap', a: bootTop, b: foot, w: w - 1, c: shade(pal.secondary, dark) });
    } else {
      out.push({ k: 'cap', a: hipP, b: knee, w: w + 2, c: shade(legTop, dark) });
      out.push({ k: 'cap', a: knee, b: foot, w: w, c: shade(legLow, dark) });
      out.push({ k: 'cap', a: lerpV(knee, foot, 0.7), b: foot, w: w - 1, c: shade(pal.secondary, dark) });
    }
    out.push({ k: 'cap', a: foot, b: toe, w: w - 4, c: shade(pal.secondary, dark) });
  };

  const arm = (out: Prim[], s: V, e: V, h: V, dark: number) => {
    const w = b.armW;
    out.push({ k: 'cap', a: s, b: e, w: w + 1, c: shade(suit, dark) });
    out.push({ k: 'cap', a: e, b: h, w, c: shade(suit, dark) });
    if (look.wraps || look.suit) {
      out.push({ k: 'cap', a: lerpV(e, h, 0.55), b: h, w: w + 1, c: shade(look.suit ? pal.secondary : pal.accent, dark) });
    }
    if (look.tattoo) {
      out.push({ k: 'cap', a: lerpV(s, e, 0.35), b: lerpV(s, e, 0.5), w: w + 1.5, c: shade('#2a1a12', dark) });
    }
    out.push({ k: 'circ', p: h, r: w * 0.62, c: shade(look.suit ? pal.secondary : skin, dark) });
  };

  // back layer
  leg(back, sk.hip, sk.bKnee, sk.bFoot, sk.bToe, 0.28);
  arm(back, sk.bShoulder, sk.bElbow, sk.bHand, 0.3);

  // torso
  const tx = sk.neck.x - sk.hip.x, ty = sk.neck.y - sk.hip.y;
  const tl = Math.hypot(tx, ty) || 1;
  const nx = -ty / tl, ny = tx / tl; // perpendicular (toward front when upright)
  const chest = lerpV(sk.hip, sk.neck, 0.82);
  const pts: V[] = [
    { x: sk.hip.x - nx * b.waistW * 0.5, y: sk.hip.y - ny * b.waistW * 0.5 },
    { x: sk.hip.x + nx * b.waistW * 0.5, y: sk.hip.y + ny * b.waistW * 0.5 },
    { x: chest.x + nx * b.chestW * 0.5, y: chest.y + ny * b.chestW * 0.5 },
    { x: sk.neck.x + nx * b.chestW * 0.3, y: sk.neck.y + ny * b.chestW * 0.3 },
    { x: sk.neck.x - nx * b.chestW * 0.35, y: sk.neck.y - ny * b.chestW * 0.35 },
    { x: chest.x - nx * b.chestW * 0.45, y: chest.y - ny * b.chestW * 0.45 },
  ];
  body.push({ k: 'poly', pts, c: suit });
  if (!look.suit) {
    // pec / ab shading line
    body.push({ k: 'cap', a: lerpV(sk.hip, sk.neck, 0.55), b: lerpV(sk.hip, sk.neck, 0.7), w: 3, c: shade(skin, 0.18) });
  } else {
    body.push({ k: 'cap', a: lerpV(sk.hip, sk.neck, 0.95), b: lerpV(sk.hip, sk.neck, 0.45), w: 5, c: pal.accent });
  }
  // trunks / belt
  const beltA = { x: sk.hip.x - nx * b.waistW * 0.55, y: sk.hip.y - ny * b.waistW * 0.55 };
  const beltB = { x: sk.hip.x + nx * b.waistW * 0.55, y: sk.hip.y + ny * b.waistW * 0.55 };
  body.push({ k: 'cap', a: lerpV(beltA, sk.neck, 0.0), b: beltB, w: 12, c: legTop });
  body.push({ k: 'cap', a: lerpV(beltA, lerpV(beltA, sk.neck, 1), 0.12), b: lerpV(beltB, lerpV(beltB, sk.neck, 1), 0.12), w: 6, c: pal.accent });
  if (look.sash) {
    const tail = { x: sk.hip.x - nx * 6 - 14, y: sk.hip.y - 30 };
    body.push({ k: 'cap', a: { x: sk.hip.x - nx * 4, y: sk.hip.y + 4 }, b: tail, w: 5, c: pal.accent });
  }

  // head
  const hr = b.headR;
  body.push({ k: 'cap', a: sk.neck, b: lerpV(sk.neck, sk.head, 0.6), w: hr * 0.9, c: skin });
  body.push({ k: 'circ', p: sk.head, r: hr, c: skin });
  const ha = Math.atan2(sk.head.x - sk.neck.x, sk.head.y - sk.neck.y); // lean of head (0 = up)
  const up = { x: Math.sin(ha), y: Math.cos(ha) }, fw = { x: Math.cos(ha), y: -Math.sin(ha) };
  const hp = (u: number, f: number): V => ({ x: sk.head.x + up.x * u + fw.x * f, y: sk.head.y + up.y * u + fw.y * f });

  if (look.hair === 'mohawk') {
    body.push({ k: 'cap', a: hp(hr * 0.9, -hr * 0.9), b: hp(hr * 1.25, hr * 0.4), w: 8, c: pal.hair });
    body.push({ k: 'cap', a: hp(hr * 0.6, -hr * 1.05), b: hp(hr * 1.1, -hr * 0.2), w: 7, c: pal.hair });
  } else if (look.hair === 'ponytail') {
    body.push({ k: 'circ', p: hp(hr * 0.25, -hr * 0.2), r: hr * 1.02, c: pal.hair });
    body.push({ k: 'cap', a: hp(hr * 0.5, -hr * 0.9), b: hp(-hr * 1.6, -hr * 2.2), w: 9, c: pal.hair });
    body.push({ k: 'circ', p: hp(-hr * 0.05, hr * 0.35), r: hr * 0.78, c: skin });
  } else if (look.hair === 'spiky') {
    for (let i = 0; i < 4; i++) body.push({ k: 'cap', a: hp(hr * 0.5, -hr * 0.6 + i * 6), b: hp(hr * 1.4, -hr * 1.2 + i * 8), w: 6, c: pal.hair });
  }
  if (look.beard) {
    body.push({ k: 'cap', a: hp(-hr * 0.35, hr * 0.15), b: hp(-hr * 0.85, hr * 0.55), w: 9, c: pal.hair });
  }
  if (look.mask) {
    body.push({ k: 'cap', a: hp(-hr * 0.35, -hr * 0.4), b: hp(-hr * 0.35, hr * 0.7), w: hr * 0.9, c: pal.primary });
  }
  if (look.headband) {
    body.push({ k: 'cap', a: hp(hr * 0.42, -hr * 0.95), b: hp(hr * 0.42, hr * 0.95), w: 5, c: pal.accent });
    body.push({ k: 'cap', a: hp(hr * 0.42, -hr * 0.95), b: hp(hr * 0.1, -hr * 2.0), w: 4, c: pal.accent });
  }
  // eye
  body.push({ k: 'cap', a: hp(hr * 0.12, hr * 0.42), b: hp(hr * 0.12, hr * 0.72), w: 3.2, c: pal.eyes });

  // front layer
  leg(front, sk.hip, sk.fKnee, sk.fFoot, sk.fToe, 0);
  arm(front, sk.fShoulder, sk.fElbow, sk.fHand, 0);

  // ---- render ----
  const S = b.scale;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(facing * S, -S); // y-up local space
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const outline = recolor(pal.outline);
  for (const layer of [back, body, front]) {
    // outline pass
    for (const p of layer) drawPrim(ctx, p, outline, 3.2);
    for (const p of layer) drawPrim(ctx, p, recolor(p.c), 0);
  }
  ctx.restore();
}

function drawPrim(ctx: CanvasRenderingContext2D, p: Prim, c: string, grow: number) {
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  if (p.k === 'cap') {
    ctx.lineWidth = p.w + grow;
    ctx.beginPath();
    ctx.moveTo(p.a.x, p.a.y);
    ctx.lineTo(p.b.x, p.b.y);
    ctx.stroke();
  } else if (p.k === 'circ') {
    ctx.beginPath();
    ctx.arc(p.p.x, p.p.y, p.r + grow / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    p.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    if (grow) { ctx.lineWidth = grow; ctx.stroke(); }
    ctx.fill();
  }
}
