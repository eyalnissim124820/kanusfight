# Kanu's Fight

A 2D arcade fighting game built from scratch in TypeScript and HTML5 Canvas. Its design follows the
classic mid-90s arcade fighter formula: 5-button controls, best-of-3 rounds, specials entered as motions,
juggles, throws and a last-round finisher. It has no runtime dependencies and builds to a static site,
ready for Vercel.

All characters, art and sounds are original and generated in code. See
[docs/REVERSE_ENGINEERING.md](docs/REVERSE_ENGINEERING.md) for how the original game was analysed and
how each mechanic maps to this code.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

Handy URLs:
- `/?mode=cpu&p1=kanu&p2=nyx&stage=moon&difficulty=hard`: jump straight into a fight (`mode` = `1p`, `2p` or `cpu`)
- `/?tool=poses` (or `&char=kanu`): a sheet of every pose for every character. Press **D** to download it as a PNG.
- In a fight: **F1** shows hitboxes and states, **Esc/P** pauses, **M** turns music on/off, **N** mutes.

## Deploy to Vercel

Either:
1. Push this repo to GitHub, then **Vercel → Add New Project → import the repo**. Vercel detects Vite from
   `vercel.json` (build `npm run build`, output `dist`). Click Deploy.
2. Or from the CLI: `npm i -g vercel && vercel` (then `vercel --prod`).

## Controls

| | Player 1 | Player 2 |
|---|---|---|
| Move / jump / crouch | W A S D | Arrow keys |
| High Punch · Block · High Kick | U · I · O | Num7 · Num8 · Num9 |
| Low Punch · Block · Low Kick | J · K · L | Num4 · Num5 · Num6 |
| Gamepad | X/Y punch, A/B kick, bumpers/triggers block | second pad |

In 1-player mode either keyboard layout works.

**Shared moves:** close LP = throw · close HP = elbow · close HK = knee · ←+LK = sweep · ←+HK = roundhouse ·
↓+HP = uppercut · ↓+LP/LK/HK = crouching attacks · punch/kick in the air = jump attacks.
Directions are relative to facing (→ = toward the opponent).

| Character | Specials | Finisher |
|---|---|---|
| **KANU** (heavy) | Thunder Orb ← → LP · Bull Charge → → HP · Quake Stomp ↓ ← HK | Shatter Fist → ↓ → HP (close) |
| **NYX** (fast) | Moon Blade ← → HP · Shadow Step ↓ ← LP · Crescent Rise ↓ → HK · Talon Dive (air) ↓ HK | Eclipse → ← → LK (any range) |

The finisher works in the deciding round: when the loser is stunned and **END IT!** appears.

## Making your own characters

Each character is one data file. Copy `src/characters/kanu.ts` (heavy) or `src/characters/nyx.ts` (light),
edit it, and add it to `ROSTER` in `src/characters/index.ts`. The select screen, CPU opponent and move list
pick it up automatically.

A `CharacterDef` contains:
- `stats`: walk/back speed, jump height and distance, `weight` (knockback taken), `power` (damage dealt)
- `body`: proportions (limb lengths, widths, head size, overall `scale`)
- `palette` + `look`: colors and features (hair style, beard, mask, headband, suit or trunks, wraps, tattoos…)
- `moves`: the shared normals from `withMoves({...})`. Override any frame data, damage, hitbox or pose.
- `specials`: `{ motion: ['D','F'], button: 'HK', move: {...} }`. A move can spawn a `projectile`, dash
  (`selfVel`), rise or dive (`selfVel.y` + `untilLand`), `teleport`, `spin`, be `invuln` for some frames, and more.
  `role` tells the CPU how to use it.
- `finisher`: motion, button, range (`close`/`far`/`any`), effect (`shatter`/`vaporize`), color and pose
- `poses`: optional overrides of the base poses (idle, victory, …)

Frame data is in 60 fps frames: `startup → active → recovery`. Hitboxes are `{x, y, w, h}` in local space
(x = distance in front of the fighter, y = height above the floor) and scale with `body.scale`.
Press **F1** in a fight to see them.

### Phase 2: replacing the stick-art with your own sprites

Add a `sprites` block to a character and it is drawn from a sprite sheet instead of the skeleton:

```ts
sprites: {
  src: '/sprites/kanu.png',          // put the file in public/sprites/
  frameW: 256, frameH: 256,          // size of one frame
  anchorX: 128, anchorY: 240,        // pixel in a frame that touches the floor
  scale: 1,
  anims: {                           // one row per animation
    idle:   { row: 0, frames: 6, fps: 8 },
    walk:   { row: 1, frames: 8, fps: 12 },
    crouch: { row: 2, frames: 1 },
    jump:   { row: 3, frames: 6, fps: 10, loop: false },
    lp:     { row: 4, frames: 4 },    // attacks stretch over startup + active + recovery
    // ...
  },
},
```

Animation keys: `idle walk crouch jump block crouchBlock hitHigh hitLow airHit lying getup dizzy victory
throwing thrown finisher` plus every move id (`lp hp lk hk closeHp closeHk sweep roundhouse uppercut crouchLp
crouchLk crouchHk jumpPunch jumpKick jumpUpKick throw`) and each special's `id`. A missing key falls back to `idle`.
Use `/?tool=poses` as a reference for which poses each animation needs.
