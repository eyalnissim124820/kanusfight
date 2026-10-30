import { Input } from './core/input';
import { Audio } from './core/audio';
import type { App, Mode, Scene } from './scenes/scene';
import { TitleScene, createFight } from './scenes/menus';
import { getCharacter, ROSTER } from './characters';
import { spriteImage } from './render/fighterView';
import { VIEW_W, VIEW_H } from './game/match';
import type { Difficulty } from './game/ai';
import { runPoseSheet } from './tools/poseSheet';
import { isTouchDevice, setupTouchControls } from './core/touch';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const q = new URLSearchParams(location.search);

if (q.get('tool') === 'poses') runPoseSheet(canvas);
else startGame();

function startGame() {
  for (const c of ROSTER) if (c.sprites) spriteImage(c.sprites.src); // start loading art early
  const fit = () => {
    const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    canvas.style.width = `${Math.floor(VIEW_W * s)}px`;
    canvas.style.height = `${Math.floor(VIEW_H * s)}px`;
  };
  window.addEventListener('resize', fit);
  fit();

  const input = new Input(window);
  const audio = new Audio();
  // Browsers only allow sound after a user gesture.
  const unlock = () => audio.unlock();
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);

  let scene: Scene;
  const app: App = {
    ctx, input, audio, frame: 0, difficulty: 'normal',
    setScene(s) { scene = s; app.touch?.setInFight('match' in s); },
  };
  if (isTouchDevice()) app.touch = setupTouchControls(input);

  // URL shortcuts for testing: ?mode=cpu&p1=kanu&p2=nyx&stage=moon&difficulty=hard
  if (q.get('difficulty')) app.difficulty = q.get('difficulty') as Difficulty;
  if (q.get('mode')) {
    scene = createFight(app, q.get('mode') as Mode, getCharacter(q.get('p1') ?? 'kanu'),
      getCharacter(q.get('p2') ?? 'nyx'), q.get('stage') ?? 'ember');
  } else scene = new TitleScene(app);
  app.touch?.setInFight('match' in scene);

  // Fixed 60Hz simulation, decoupled from the display refresh rate.
  const STEP = 1000 / 60;
  let last = performance.now(), acc = 0;
  const loop = (now: number) => {
    acc += Math.min(250, now - last);
    last = now;
    while (acc >= STEP) {
      input.pollPads();
      scene.update();
      input.endFrame();
      app.frame++;
      acc -= STEP;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    scene.render(ctx);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Exposed for debugging / automated tests.
  (window as unknown as { __game: unknown }).__game = { app, get scene() { return scene; } };
}
