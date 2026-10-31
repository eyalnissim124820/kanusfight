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

**Phones and tablets** get on-screen controls automatically: a joystick (left), HP/LP/HK/LK + BLOCK (right),
and pause. **★1 / ★2** perform the fighter's first two specials with one tap, no motion needed; during the
"END IT!" window ★1 performs the finisher (if you're in range). The touch controls drive player 1 and the menus.
Force them on or off with `?touch=1` / `?touch=0`.

**Shared moves:** close LP = throw · close HP = elbow · close HK = knee · ←+LK = sweep · ←+HK = roundhouse ·
↓+HP = uppercut · ↓+LP/LK/HK = crouching attacks · punch/kick in the air = jump attacks.
Directions are relative to facing (→ = toward the opponent).

| Character | Specials | Finisher |
|---|---|---|
| **KANU** (heavy) | Thunder Orb ← → LP · Bull Charge → → HP · Quake Stomp ↓ ← HK | Shatter Fist → ↓ → HP (close) |
| **TALDAN** (heavy, sprite art) | Power Blast ← → LP · Riot Rush → → HP | Final Verdict → ↓ → HP (any range) |
| **BEN** (quick, sprite art) | Flying Shears ← → LP · Denim Lance ← → HK | Perfect Cut → ↓ → LK (close) |
| **EYAL PRO MAX** (balanced, sprite art) | Hot Deploy ← → LP · Hotfix Rush → → HP | Ship It → ↓ → HP (any range) |
| **KLEIN** (brawler, sprite art) | Guitar Smash ← → HP · Power Chord ↓ → LP | Encore → ↓ → HP (close) |
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
- `finisher`: motion, button, range (`close`/`far`/`any`), effect (`shatter`/`vaporize`/`slice`), color and pose
- `poses`: optional overrides of the base poses (idle, victory, …)

Frame data is in 60 fps frames: `startup → active → recovery`. Hitboxes are `{x, y, w, h}` in local space
(x = distance in front of the fighter, y = height above the floor) and scale with `body.scale`.
Press **F1** in a fight to see them.

### Sprite-art characters (Taldan is the reference)

**TALDAN** is drawn from AI-generated art instead of the stick-figure renderer. Here's the pipeline to add another character the same way:

1. **Generate a pose sheet.** Every pose, side view, facing right, on a flat green (#00FF00) background, with a
   black label bar above each strip of frames. Taldan's source is `art/taldan/source-sheet.webp`.
2. **Describe the layout.** Copy `art/taldan/layout.json` and set, for each animation, which strip it's on (`bands`), its
   x-range and its frame count.
3. **Extract.** This keys out the green, cuts and aligns every frame on the feet, and packs a trimmed atlas:
   ```bash
   pip install pillow numpy scipy
   python3 tools/extract_sprites.py art/<name>/layout.json
   ```
   It writes `public/sprites/<name>.webp` (the image) and `src/characters/sprites/<name>.json` (frame rectangles + anchors).
   If the art comes as **one image per frame** instead (like Ben's pack in `art/ben/sprites/<anim>/<anim>_NN.png`),
   skip steps 1–3 and pack the folder directly. Every frame must share the same canvas placement; `--pivot` is
   the floor point under the fighter:
   ```bash
   python3 tools/pack_frames.py art/ben/sprites public/sprites/ben.webp src/characters/sprites/ben.json --scale 0.36 --pivot 512,996
   ```
   If the frames **don't** share a placement (e.g. some were cropped and enlarged from other sheets, like
   Eyal's pack), add `--config art/<name>/frames.json`: each frame is then anchored on its own feet and trunk,
   and `size` shrinks enlarged animations (or single frames) back to idle's scale. See `art/eyal/frames.json`.
4. **Character file.** Copy `src/characters/taldan.ts` (or `ben.ts`), import the new atlas JSON, and add the character to `ROSTER`.

The `sprites` block in a character file:

```ts
sprites: {
  src: '/sprites/taldan.webp',
  atlas: atlas.frames,            // from the extractor
  standHeight: atlas.standHeight, // art is scaled so the idle pose = the hurtbox height
  play: {
    idle: { fps: 6 },             // timed animations (idle/walk/dizzy loop by default)
    hp: { hit: 2 },               // attacks: which frame is the strike (shown on active frames)
    closeHp: { use: 'hp', frames: [0, 1], hit: 1 }, // reuse another animation's frames
    throwing: { use: 'throw', frames: [2, 3], fps: 3, loop: false },
  },
},
```

A projectile can use art too: put its frame in the atlas (e.g. `art/ben/sprites/proj_flyingShears/`, packed with
`--anchor proj_flyingShears=0.88,0.5` so it's anchored on the scissors head) and set `sprite: 'proj_flyingShears'`
in the special's `projectile`.

Attacks follow the move's frame data: frames before `hit` play during startup, `hit` during the active window,
and the rest during recovery. Any animation without art falls back to `idle`. Characters without `sprites` use
the procedural skeleton.

Animation keys: `idle walk crouch jump block crouchBlock hitHigh hitLow airHit lying getup dizzy victory
throwing thrown finisher` plus every move id (`lp hp lk hk closeHp closeHk sweep roundhouse uppercut crouchLp
crouchLk crouchHk jumpPunch jumpKick jumpUpKick throw`) and each special's `id`.
For a stick-figure character, `/?tool=poses` shows which pose each animation needs.
