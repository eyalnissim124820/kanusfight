import type { Input } from '../core/input';
import type { Audio } from '../core/audio';
import type { Difficulty } from '../game/ai';

export interface Scene {
  update(): void;
  render(ctx: CanvasRenderingContext2D): void;
}

export type Mode = '1p' | '2p' | 'cpu';

export interface App {
  ctx: CanvasRenderingContext2D;
  input: Input;
  audio: Audio;
  frame: number;
  difficulty: Difficulty;
  setScene(s: Scene): void;
}
