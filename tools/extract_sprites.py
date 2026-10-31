#!/usr/bin/env python3
"""
Turn an AI-generated green-screen pose sheet into a game sprite atlas.

    pip install pillow numpy scipy
    python3 tools/extract_sprites.py art/<character>/layout.json

layout.json describes where each animation sits on the source sheet:
  bands     – [y0, y1] pixel rows of each strip of frames (below the black label bars)
  anims     – [name, bandIndex, [x0, x1], frameCount, {options}]
              options: keepFirst N   – keep only the first N blobs (drop detached effects)
                       stripWhite    – remove white/light-grey pixels first (e.g. an opponent in a white outfit)
                       maxReach px   – per-animation reach crop (overrides the global one)
                       anchor 'center' – anchor on the bounding-box centre (projectiles)
                       fadeLeft / fadeRight px – soften an effect cut off by the cell edge
  thinLines – true: erase 1–2px lines (cell borders) before finding frames
  centerAnchor – animations anchored on their bounding-box centre (airborne / lying poses)
  maxReach  – crop effects that reach further forward than this (source px)
  scale     – resample factor for the output (1.5 = sharper when drawn at game size)

Output: a WebP atlas (trimmed frames, shelf-packed) + a JSON file with, per animation,
[x, y, w, h, anchorX, anchorY] for every frame. The anchor is the floor point under the fighter.
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

cfg_path = sys.argv[1]
base = os.path.dirname(os.path.abspath(cfg_path))
cfg = json.load(open(cfg_path))
im = np.asarray(Image.open(os.path.join(base, cfg['source'])).convert('RGB')).astype(np.int32)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
key = g - np.maximum(r, b)
green = (g > 100) & (g > r * 1.3) & (g > b * 1.3)
dark = (r < 45) & (g < 45) & (b < 45)
BANDS = cfg['bands']
CENTER = set(cfg.get('centerAnchor', []))
MAX_REACH = cfg.get('maxReach', 9999)
SCALE = cfg.get('scale', 1.0)


def frames_for(anim, band, sec, n, opts=None):
    opts = opts or {}
    y0, y1 = BANDS[band]
    x0, x1 = sec
    fg = ~green[y0:y1, x0:x1]
    fg[:, dark[y0:y1, x0:x1].mean(0) > 0.85] = False  # vertical separators
    fg[dark[y0:y1, x0:x1].mean(1) > 0.5, :] = False  # label-bar rows
    if opts.get('stripWhite'):
        px = im[y0:y1, x0:x1]
        white = (px.min(2) > 135) & (px.max(2) - px.min(2) < 45)
        fg &= ~ndimage.binary_dilation(white, iterations=2)
    if cfg.get('thinLines'):
        fg = ndimage.binary_opening(fg, structure=np.ones((3, 3)))
    lab, cnt = ndimage.label(fg)
    objs = ndimage.find_objects(lab)
    areas = ndimage.sum(fg, lab, range(1, cnt + 1))
    comps = []
    for i, (o, a) in enumerate(zip(objs, areas)):
        w, h = o[1].stop - o[1].start, o[0].stop - o[0].start
        if a < 30 or (a < 2500 and (w > 250 or h > 140)):
            continue  # specks and frame borders
        comps.append({'id': i + 1, 'x0': o[1].start, 'x1': o[1].stop, 'a': a, 'w': w, 'h': h})
    big = sorted([c for c in comps if c['a'] > 2500], key=lambda c: c['x0'])
    masks = [lab == c['id'] for c in big]
    if 'keepFirst' in opts:
        masks = masks[:opts['keepFirst']]
        big = big[:opts['keepFirst']]
    if len(masks) < n:  # touching frames: split the widest blob at its emptiest column
        while len(masks) < n:
            wi = max(range(len(masks)), key=lambda i: np.ptp(np.nonzero(masks[i].any(0))[0]))
            m = masks.pop(wi)
            cols = m.sum(0).astype(float)
            nz = np.nonzero(cols)[0]
            a, z = nz[0], nz[-1]
            mid, span = (a + z) // 2, (z - a) // 5
            cut = mid - span + int(np.argmin(np.convolve(cols, np.ones(5) / 5, 'same')[mid - span:mid + span]))
            left, right = m.copy(), m.copy()
            left[:, cut:] = False
            right[:, :cut] = False
            masks[wi:wi] = [left, right]
    assert len(masks) == n, f'{anim}: found {len(masks)} frames, expected {n}'

    # a frame's limb that pokes into the next frame belongs to it, not to the neighbour
    for i in range(1, len(masks)):
        A, B = masks[i - 1], masks[i]
        acols = np.nonzero(A.any(0))[0]
        dens = np.convolve(B.sum(0).astype(float), np.ones(5) / 5, 'same')
        body = int(np.nonzero(dens > 0.35 * dens.max())[0][0])
        stray = B.copy()
        stray[:, body - 2:] = False
        brows = np.nonzero(B.any(1))[0]
        stray[int(brows[0] + 0.55 * (brows[-1] - brows[0])):, :] = False  # arms only, never feet
        scols = np.nonzero(stray.any(0))[0]
        if stray.sum() > 40 and len(scols) and scols[0] - acols[-1] < 12 and acols[-1] >= body - 60:
            B[stray] = False
            A[stray] = True

    # small fragments (glints, sparks) join the nearest frame; border lines are dropped
    for c in comps:
        if c['a'] > 2500:
            continue
        if min(c['w'], c['h']) <= 4 or (c['a'] < 0.25 * c['w'] * c['h'] and max(c['w'], c['h']) > 30):
            continue
        cx = (c['x0'] + c['x1']) / 2
        best, bd = None, 1e9
        for i, m in enumerate(masks):
            xs = np.nonzero(m.any(0))[0]
            d = 0 if xs[0] <= cx <= xs[-1] else min(abs(cx - xs[0]), abs(cx - xs[-1]))
            if d < bd:
                best, bd = i, d
        if bd < 12:
            masks[best] |= lab == c['id']

    res = []
    for i, m in enumerate(masks):
        m = ndimage.binary_opening(m, structure=np.ones((5, 5)))
        l3, k3 = ndimage.label(m)
        if k3 > 1:  # drop specks that float away from the main body
            sizes = ndimage.sum(m, l3, range(1, k3 + 1))
            main = l3 == 1 + int(np.argmax(sizes))
            near = ndimage.binary_dilation(main, iterations=4)
            keep = main.copy()
            for j in range(k3):
                piece = l3 == j + 1
                if sizes[j] >= 0.12 * sizes.max() or (piece & near).any():
                    keep |= piece
            m = keep
        m = ndimage.binary_dilation(m, iterations=1) & ~(dark[y0:y1, x0:x1] & (lab == 0))
        ys, xs = np.nonzero(m)
        fy0, fy1, fx0, fx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        if opts.get('anchor') == 'center':
            ax, fy1c = (fx0 + fx1) / 2, (fy0 + fy1) / 2
        elif anim in CENTER:
            ax = (fx0 + fx1) / 2
        else:  # the densest column is the trunk: a stable anchor while limbs move
            ax = float(np.argmax(np.convolve(m.sum(0).astype(float), np.ones(15) / 15, 'same')))
        ay = fy1c if opts.get('anchor') == 'center' else fy1
        res.append({'anim': anim, 'i': i, 'mask': m, 'box': (fx0, fy0, fx1, fy1), 'ax': ax, 'ay': ay, 'ox': x0, 'oy': y0,
                    'reach': opts.get('maxReach', MAX_REACH), 'fade': (opts.get('fadeLeft', 0), opts.get('fadeRight', 0))})
    return res


def rgba(f):
    fx0, fy0, fx1, fy1 = f['box']
    X0, Y0 = f['ox'] + fx0, f['oy'] + fy0
    rgb = im[Y0:f['oy'] + fy1, X0:f['ox'] + fx1].copy()
    k = key[Y0:f['oy'] + fy1, X0:f['ox'] + fx1]
    a = np.clip((70 - k) / 50.0, 0, 1) * f['mask'][fy0:fy1, fx0:fx1]  # soft chroma key
    fl, fr = f.get('fade', (0, 0))
    w = a.shape[1]
    ramp = np.ones(w)
    if fl: ramp *= np.clip(np.arange(w) / fl, 0, 1)
    if fr: ramp *= np.clip((w - 1 - np.arange(w)) / fr, 0, 1)
    if f.get('reach', 9999) < w:  # the reach crop happens later: fade towards the crop line instead
        cut = int(f['ax'] - fx0 + f['reach'])
        if fr: ramp *= np.clip((cut - np.arange(w)) / fr, 0, 1)
    a = a * ramp[None, :]
    mx = np.maximum(rgb[..., 0], rgb[..., 2])
    rgb[..., 1] = np.where(rgb[..., 1] > mx, (mx * 0.7 + rgb[..., 1] * 0.3).astype(np.int32), rgb[..., 1])  # despill
    return Image.fromarray(np.dstack([rgb, (a * 255).astype(np.int32)]).astype(np.uint8), 'RGBA')


frames = []
for spec in cfg['anims']:
    frames += frames_for(*spec)

cells = []
for f in frames:
    sp = rgba(f)
    ax, ay = f['ax'] - f['box'][0], f['ay'] - f['box'][1]
    if sp.width - ax > f['reach']:
        sp = sp.crop((0, 0, int(ax + f['reach']), sp.height))
    sp = sp.resize((round(sp.width * SCALE), round(sp.height * SCALE)), Image.LANCZOS)
    cells.append((f, sp, ax * SCALE, ay * SCALE))

SHEET_W, GAP = 2048, 2
x = y = shelf = 0
place = []
for f, sp, ax, ay in sorted(cells, key=lambda c: -c[1].height):
    if x + sp.width > SHEET_W:
        x, y, shelf = 0, y + shelf + GAP, 0
    place.append((f, sp, ax, ay, x, y))
    x += sp.width + GAP
    shelf = max(shelf, sp.height)
sheet = Image.new('RGBA', (SHEET_W, y + shelf), (0, 0, 0, 0))
atlas = {}
for f, sp, ax, ay, px, py in place:
    sheet.alpha_composite(sp, (px, py))
    atlas.setdefault(f['anim'], []).append((f['i'], [px, py, sp.width, sp.height, round(ax), round(ay)]))
atlas = {a: [v for _, v in sorted(l)] for a, l in atlas.items()}
stand = float(np.median([f['box'][3] - f['box'][1] for f in frames if f['anim'] == 'idle'])) * SCALE

out_img = os.path.join(base, cfg['output']['image'])
out_json = os.path.join(base, cfg['output']['atlas'])
sheet.save(out_img, quality=90, method=6)
with open(out_json, 'w') as fh:
    json.dump({'standHeight': round(stand), 'frames': atlas}, fh, separators=(',', ':'))
print(f'{len(frames)} frames, sheet {sheet.size}, standHeight {round(stand)} -> {out_img}, {out_json}')
