#!/usr/bin/env python3
"""
Pack a folder of individual sprite frames into a game atlas.

Use this when the art comes as separate images (one file per frame) instead of one big
pose sheet (for that, see extract_sprites.py).

    pip install pillow numpy scipy
    python3 tools/pack_frames.py <frames_dir> <out_image.webp> <out_atlas.json> [--scale 0.36] [--pivot 512,996]

<frames_dir> must contain <anim>/<anim>_NN.png (e.g. idle/idle_01.png). Frames may be RGBA, or RGB on a
flat green (#00FF00) background, which is keyed out. Every frame must share the same canvas
placement: the pivot is the floor point under the fighter, the same for all frames.

Output: a trimmed, shelf-packed WebP atlas plus JSON with [x, y, w, h, anchorX, anchorY] per frame,
the same format extract_sprites.py writes.
"""
import argparse, glob, json, os
import numpy as np
from PIL import Image
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument('frames_dir')
ap.add_argument('out_image')
ap.add_argument('out_json')
ap.add_argument('--scale', type=float, default=0.36)
ap.add_argument('--pivot', default='512,996')
args = ap.parse_args()
PX, PY = (float(v) for v in args.pivot.split(','))


def keyed(path):
    im = Image.open(path)
    if im.mode == 'RGBA':
        return im
    a = np.asarray(im.convert('RGB')).astype(np.int32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = g - np.maximum(r, b)
    alpha = np.clip((70 - k) / 50.0, 0, 1)  # soft chroma key
    solid = alpha > 0.5
    lab, n = ndimage.label(solid)
    if n:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        alpha[np.isin(lab, 1 + np.nonzero(sizes < 60)[0])] = 0  # specks
    mx = np.maximum(r, b)
    g2 = np.where(g > mx, (mx * 0.7 + g * 0.3).astype(np.int32), g)  # despill green fringes
    return Image.fromarray(np.dstack([r, g2, b, (alpha * 255).astype(np.int32)]).astype(np.uint8), 'RGBA')


frames = []
for d in sorted(os.listdir(args.frames_dir)):
    files = sorted(glob.glob(os.path.join(args.frames_dir, d, '*.png')))
    for i, f in enumerate(files):
        im = keyed(f)
        bb = im.getbbox()
        if not bb:
            continue
        crop = im.crop(bb)
        w, h = round(crop.width * args.scale), round(crop.height * args.scale)
        crop = crop.resize((max(1, w), max(1, h)), Image.LANCZOS)
        frames.append((d, i, crop, (PX - bb[0]) * args.scale, (PY - bb[1]) * args.scale, (bb[3] - bb[1]) * args.scale))

SHEET_W, GAP = 2048, 2
x = y = shelf = 0
place = []
for fr in sorted(frames, key=lambda f: -f[2].height):
    sp = fr[2]
    if x + sp.width > SHEET_W:
        x, y, shelf = 0, y + shelf + GAP, 0
    place.append((fr, x, y))
    x += sp.width + GAP
    shelf = max(shelf, sp.height)
sheet = Image.new('RGBA', (SHEET_W, y + shelf), (0, 0, 0, 0))
atlas = {}
for (anim, i, sp, ax, ay, _), px, py in place:
    sheet.alpha_composite(sp, (px, py))
    atlas.setdefault(anim, []).append((i, [px, py, sp.width, sp.height, round(ax), round(ay)]))
atlas = {a: [v for _, v in sorted(l)] for a, l in atlas.items()}
stand = float(np.median([f[5] for f in frames if f[0] == 'idle']))
sheet.save(args.out_image, quality=90, method=6)
with open(args.out_json, 'w') as fh:
    json.dump({'standHeight': round(stand), 'frames': atlas}, fh, separators=(',', ':'))
print(f'{len(frames)} frames in {len(atlas)} animations, sheet {sheet.size}, standHeight {round(stand)}')
