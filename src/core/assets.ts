/**
 * Tracks every image the game loads, so the loading screen can wait until the art is ready instead of
 * the game showing stick-figure stand-ins. Loaders call `trackImage` right after setting `src`.
 */
const tracked: HTMLImageElement[] = [];

export function trackImage(img: HTMLImageElement) {
  tracked.push(img);
  img.decode?.().catch(() => {}); // start decoding early, so the first frame drawn doesn't stall
  return img;
}

/** Fraction of tracked images finished loading (a failed image counts as finished). */
export function loadProgress() {
  if (!tracked.length) return 1;
  return tracked.filter((i) => i.complete).length / tracked.length;
}
