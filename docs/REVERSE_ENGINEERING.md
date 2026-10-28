# Reverse-engineering notes

Source analysed: the 1995 DOS release of *Mortal Kombat II* (Acclaim/Midway). This came from the uploaded
`mortal-kombat-2.zip`: 614 files, about 21 MB.

**Nothing from the original package is used in this project.** No sprites, sounds, music, character
designs, names or text were copied. We studied it only for **game design and mechanics**. Everything in
`src/` is new code. The characters (Kanu, Nyx), stages, effects and audio are all original: drawn and
synthesized procedurally.

## 1. What is in the package

| Files | What they are |
|---|---|
| `MK2.EXE` (861 KB) | The game: a DOS/4GW protected-mode executable. It holds the game logic, the menus and the text. |
| `*.GRA` (124 files, ~15 MB) | Graphics packs. Each fighter's animations are split over several packs, named with a two-letter prefix plus a number (e.g. `LK0..LK5`, `JX0..JX5`, `NJ0..NJ8` for the palette-swap ninjas). There are also stage packs (`ARENA`, `ARMORY`, `PIT`, `TOWER`, `FOREST`, `TOMB`, …) and effect packs (`BLOOD`, `EXPLODE`, `FREEZE`, `PUFF`, `SLIME`, …). |
| `*FRIEND.GRA`, `BABIES.GRA`, `FAT.GRA`, `ENDPICS.GRA` | Finishing-move animations and ending screens, loaded separately. |
| `SOUND/*.MID` | General MIDI music. |
| `SOUND/*.GVS, *.SBL, *.AWE, *.LAP` | The same music converted for different sound cards (Gravis, Sound Blaster, AWE32, LAPC). |
| `GMI.BIN`, `GRV.BIN`, `AWE.BIN`, `RM.DRV`, `ULTRAMID.*` | Sound drivers and patch banks. |
| `CMOS`, `MK2GUS.BAT` | Saved settings and a launcher. |

Strings in `MK2.EXE` show:
- a keyboard-remapping menu (`PRESS THE KEY FOR HIGH PUNCH / LOW PUNCH / HIGH KICK / LOW KICK / BLOCK / UP / DOWN / LEFT / RIGHT`), so the game uses **5 attack buttons and 4 directions**
- `ROUND %d`, `<NAME> WINS`, `FLAWLESS`, `FINISHER`, `%d WINS IN A ROW`: round-based matches with a win-streak counter
- a `THROWING DISABLED` option, plus `DIFFICULTY:`, `4 BUTTON JOYSTICK` and `JOYSTICK & KEYS`
- per-character throw identifiers (`LKTHROW`, `JHTHROW`, …) and teleport identifiers (`KUNGTELE`, `MILETELE`), so throws and teleports are scripted separately for each character
- `GUDBLOCK*` / `GUDFALL*` animation tags (block and fall states)

## 2. The core design we copied (mechanics only)

| Mechanic | Original | Our implementation |
|---|---|---|
| Controls | 4 directions + HP, LP, HK, LK, BL (a dedicated block button; holding back doesn't block) | Same 5-button layout. The keyboard keys mirror the arcade panel (`src/core/input.ts`). |
| Match | Best of 3 rounds, 99 timer, health bar per fighter | `ROUNDS_TO_WIN = 2`, `ROUND_TIME = 99` (`src/game/match.ts`) |
| Time over | Higher health wins | Same; equal health is a draw and the round is replayed |
| Normals | Jab / high punch / low kick / high kick. Close-range versions (elbow, knee). Back+LK sweep, back+HK roundhouse, down+HP uppercut, crouching attacks, jump punch/kick | `src/characters/baseMoves.ts` (shared by every character, can be overridden per character) |
| Throw | Close + LP. Grabs blocking opponents; the victim is thrown over the thrower | `throw` move + scripted arc in `Match.updateThrown` |
| Blocking | Block button; crouch-block needed for lows; specials do chip damage | `Match.isBlocking`, `chip` on special moves |
| Jumps | High, floaty arcs; diagonal jumps do a somersault | `jumpVel` / `jumpSpeedX` per character; flip in `render/fighterView.ts` |
| Uppercut | Launches the opponent high into the air with a big knockdown | `knockback.y` launches into the `airHit` state |
| Juggles | Opponents in the air can be hit again | `juggle` counter with damage scaling |
| Specials | Short motions like B,F + button, D,B + button, F,F + button. Projectiles, teleports, dashes, rising attacks, air specials | Motion parser in `Fighter.matchMotion` (relative to facing, 28-frame window). Data-driven `SpecialDef`. |
| Projectiles | One on screen per player; projectiles cancel each other | `Match.updateProjectiles` |
| Hit feel | Hit-stop, sparks, screen shake, knockback, corner push-back | `hitstop`, particles, `shake`, wall pushback (`Match.applyHit`) |
| Last round | The loser stands stunned and the winner has a few seconds to input a finishing motion at the right distance | `finish` phase → `END IT!`, `FinisherDef { motion, button, range, effect }` |
| Perfect round | A round won without taking damage gets a bonus title | Shown as `PERFECT` |
| CPU | Reads the player and reacts to jump-ins with uppercuts, etc. | `src/game/ai.ts` produces regular inputs (no shortcuts), with 3 difficulty levels |

## 3. Architecture of the remake

```
src/
  main.ts              boot, fixed 60 Hz loop, URL shortcuts
  core/input.ts        keyboard + gamepad → InputFrame
  core/audio.ts        WebAudio synthesized SFX + procedural music
  game/types.ts        all data types (moves, specials, characters, poses)
  game/fighter.ts      fighter state machine, motion parser, physics, boxes
  game/match.ts        rounds, timer, hit resolution, throws, projectiles, finishers, camera, particles
  game/ai.ts           CPU opponent
  characters/          baseMoves.ts + one file per character + roster index
  render/skeleton.ts   procedural character renderer (pose → forward kinematics → shapes)
  render/fighterView.ts state → pose/animation mapping; optional sprite-sheet renderer
  render/stage.ts      parallax stages
  render/hud.ts        health bars, timer, messages, particles, projectiles
  scenes/              title, controls, select, fight, results
  tools/poseSheet.ts   /?tool=poses: preview/export every pose
```

The simulation (`game/`) has no rendering code. The renderer only reads its state. So swapping the
procedural characters for sprite art (phase 2) only touches `render/`.
