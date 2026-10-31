#!/usr/bin/env python3
"""
Pack a folder of individual sprite frames into a game atlas.

Use this when the art comes as separate images (one file per frame) instead of one big
pose sheet (for that, see extract_sprites.py).

    pip install pillow numpy scipy
    python3 tools/pack_frames.py <frames_dir> <out_image.webp> <out_atlas.json> [--scale 0.36] [--pivot 512,996]
                                 [--anchor proj_x=0.88,0.5 ...]

<frames_dir> must contain <anim>/<anim>_NN.png (e.g. idle/idle_01.png). Frames may be RGBA, or RGB on a
flat green (#00FF00) background, which is keyed out. Every frame must share the same canvas
placement: the pivot is the floor point under the fighter, the same for all frames.
--anchor name=fx,fy overrides the pivot for one animation with a point inside its trimmed frame
(fractions of width/height) — e.g. projectiles, anchored on their head.

--config frames.json is for packs whose frames do NOT share a placement (e.g. poses cropped and enlarged
from different sheets). Each frame is then anchored on itself: x = its trunk (densest column), y = its
lowest pixel (or the box centre for airborne animations). Keys (all optional):
  "size":   {anim or frame file stem: s} – how big the character is drawn in that animation relative to idle (1.3 = 30%
                         larger); the frames are shrunk by 1/s so every animation matches
  "center": [anim, …]  – anchor on the bounding-box centre (jumps, air hits)
  "fadeRight": {anim: px} – soften an effect cut off by the right image edge
  "align":  [anim, …]  – register every frame of the animation onto its first frame (scale from the whole
                         silhouette, position from the feet), so a loop such as idle doesn't jitter when
                         the frames were generated or enlarged separately. Overrides "size" for those frames.

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
ap.add_argument('--anchor', action='append', default=[])
ap.add_argument('--config')
args = ap.parse_args()
CFG = json.load(open(args.config)) if args.config else None
PX, PY = (float(v) for v in args.pivot.split(','))
ANCHORS = {a.split('=')[0]: tuple(float(v) for v in a.split('=')[1].split(',')) for a in args.anchor}


def keyed(path):
    im = Image.open(path)
    if im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] < 255:
        return im  # already transparent (an opaque RGBA frame on green is keyed below)
    a = np.asarray(im.convert('RGB')).astype(np.int32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = g - np.maximum(r, b)
    alpha = np.clip((70 - k) / 50.0, 0, 1)  # soft chroma key
    solid = alpha > 0.5
    lab, n = ndimage.label(solid)
    if n:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        alpha[np.isin(lab, 1 + np.nonzero(sizes < 60)[0])] = 0  # specks
        # 1–2px lines (cell borders left over from a sheet): pieces with no thick part at all
        thick = ndimage.binary_opening(solid, structure=np.ones((5, 5)))
        has_thick = ndimage.maximum(thick, lab, range(1, n + 1))
        alpha[np.isin(lab, 1 + np.nonzero(~has_thick.astype(bool))[0])] = 0
    mx = np.maximum(r, b)
    g2 = np.where(g > mx, (mx * 0.7 + g * 0.3).astype(np.int32), g)  # despill green fringes
    return Image.fromarray(np.dstack([r, g2, b, (alpha * 255).astype(np.int32)]).astype(np.uint8), 'RGBA')


def silhouette(im, n=512):
    return np.asarray(im.getchannel('A').resize((n, n), Image.BILINEAR), float) / 255


def register(R, img, n=512):
    """Scale s and shift (dx, dy) so that R ≈ img scaled by s and shifted (in n-px units)."""
    F = np.fft.rfft2(R, (2 * n, 2 * n))
    best = (-1,)
    for s in np.arange(0.85, 1.151, 0.005):
        w = int(round(n * s))
        I = np.zeros((n, n))
        Ir = np.asarray(Image.fromarray((img * 255).astype(np.uint8)).resize((w, w), Image.BILINEAR), float) / 255
        I[:min(n, w), :min(n, w)] = Ir[:n, :n]
        c = np.fft.irfft2(F * np.conj(np.fft.rfft2(I, (2 * n, 2 * n))), (2 * n, 2 * n))
        iy, ix = np.unravel_index(np.argmax(c), c.shape)
        iou = c[iy, ix] / (R.sum() + I.sum() - c[iy, ix])
        if iou > best[0]:
            best = (iou, s, I)
    _, s, I = best
    # position from the feet: correlate only the lowest 15% of the reference silhouette
    rows = np.nonzero(R.max(1) > 0.5)[0]
    band = R.copy()
    band[:int(rows[-1] - 0.15 * (rows[-1] - rows[0]))] = 0
    c = np.fft.irfft2(np.fft.rfft2(band, (2 * n, 2 * n)) * np.conj(np.fft.rfft2(I, (2 * n, 2 * n))), (2 * n, 2 * n))
    iy, ix = np.unravel_index(np.argmax(c), c.shape)
    return s, (ix if ix < n else ix - 2 * n), (iy if iy < n else iy - 2 * n)


ALIGN = set(CFG.get('align', [])) if CFG else set()
refs = {}
frames = []
for d in sorted(os.listdir(args.frames_dir)):
    files = sorted(glob.glob(os.path.join(args.frames_dir, d, '*.png')))
    for i, f in enumerate(files):
        im = keyed(f)
        bb = im.getbbox()
        if not bb:
            continue
        crop = im.crop(bb)
        stem = os.path.splitext(os.path.basename(f))[0]  # a frame (e.g. sweep_01) can override its animation
        sc = args.scale / (CFG.get('size', {}).get(stem, CFG.get('size', {}).get(d, 1.0)) if CFG else 1.0)
        fr = CFG.get('fadeRight', {}).get(d) if CFG else None
        if fr:
            a = np.asarray(crop).copy()
            ramp = np.clip((crop.width - 1 - np.arange(crop.width)) / fr, 0, 1)
            a[..., 3] = (a[..., 3] * ramp[None, :]).astype(np.uint8)
            crop = Image.fromarray(a, 'RGBA')
        w, h = round(crop.width * sc), round(crop.height * sc)
        if d in ANCHORS:
            ax, ay = ANCHORS[d][0] * w, ANCHORS[d][1] * h
        elif CFG is not None:
            alpha = np.asarray(crop)[..., 3] > 128
            if d in CFG.get('center', []):
                ax, ay = crop.width / 2, crop.height / 2
            else:  # the densest column is the trunk: a stable anchor while limbs move
                ax, ay = float(np.argmax(np.convolve(alpha.sum(0).astype(float), np.ones(41) / 41, 'same'))), crop.height
            ax, ay = ax * sc, ay * sc
        else:
            ax, ay = (PX - bb[0]) * sc, (PY - bb[1]) * sc
        if d in ALIGN:
            full = im.size[0] / 512
            if d not in refs:  # the first frame is the reference
                refs[d] = (silhouette(im), sc, ax / sc + bb[0], ay / sc + bb[1])
            else:
                R, rsc, rax, ray = refs[d]
                k, dx, dy = register(R, silhouette(im))
                sc = rsc * k  # this frame's pixels map onto the reference by ref = k * px + shift
                w, h = round(crop.width * sc), round(crop.height * sc)
                ax, ay = ((rax - dx * full) / k - bb[0]) * sc, ((ray - dy * full) / k - bb[1]) * sc
        crop = crop.resize((max(1, w), max(1, h)), Image.LANCZOS)
        frames.append((d, i, crop, ax, ay, (bb[3] - bb[1]) * sc))

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
