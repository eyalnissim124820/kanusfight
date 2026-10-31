#!/usr/bin/env python3
"""Normalise the title-screen layer art into public/backgrounds/title/.

The source images come from an image generator at assorted sizes with transparent padding.
This crops each to its content, cleans stray near-transparent pixels and resizes it to its
size on the 1920x1080 base canvas (the game draws every layer at 0.5 scale). Cloud layers are
cross-faded at the ends so they tile seamlessly; the four sea-glitter frames are packed into
one horizontal strip with a shared cell size.

  python3 tools/build_title_layers.py <dir with the source PNGs>

The SOURCES table maps output names to the generator's file-number suffixes (`...-<n>.png`).
"""
import glob
import os
import re
import sys

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'backgrounds', 'title')

# output name -> source suffix number
SOURCES = {
    'sky': 1, 'mountains': 2, 'balustrade': 3, 'banner_left': 4, 'clouds_far': 5, 'town': 6,
    'floor': 7, 'banner_right': 8, 'sun': 9, 'sea': 10, 'arches': 11, 'logo': 12,
    'clouds_near': 13, 'vines_left': 15, 'plaque_keys': 16, 'vines_right': 18,
    'plaque_blank': 19, 'frame_border': 21,
}
GLITTER = [14, 17, 20, 22]


def load(src_dir: str, n: int) -> Image.Image:
    [path] = [p for p in glob.glob(os.path.join(src_dir, '*.png')) if re.search(rf'-{n}\.png$', p)]
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    a[a[..., 3] < 8] = 0  # background-removal leaves faint specks
    return Image.fromarray(a)


def content(im: Image.Image, x=True, y=True) -> Image.Image:
    l, t, r, b = im.getbbox()
    return im.crop((l if x else 0, t if y else 0, r if x else im.width, b if y else im.height))


def fit_w(im: Image.Image, w: int) -> Image.Image:
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def fit_h(im: Image.Image, h: int) -> Image.Image:
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def seamless(im: Image.Image, w: int, overlap: int) -> Image.Image:
    """Resize to w+overlap wide, then fade the overhang into the start so x=0 follows x=w-1."""
    im = im.resize((w + overlap, round(im.height * (w + overlap) / im.width)), Image.LANCZOS)
    a = np.array(im).astype(np.float32)
    t = np.linspace(0, 1, overlap)[None, :, None]  # 0 at the seam side -> 1 inside
    a[:, :overlap] = a[:, w:] * (1 - t) + a[:, :overlap] * t
    return Image.fromarray(a[:, :w].round().astype(np.uint8))


def main(src_dir: str):
    os.makedirs(OUT, exist_ok=True)
    L = {k: load(src_dir, n) for k, n in SOURCES.items()}
    out = {
        # 2560 wide = 320 px of slack each side for parallax.
        'sky': L['sky'].resize((2563, 1082), Image.LANCZOS).crop((1, 1, 2561, 1081)),
        'clouds_far': seamless(content(L['clouds_far'], x=False), 2560, 256),
        'clouds_near': seamless(content(L['clouds_near'], x=False), 2560, 256),
        'sun': fit_w(content(L['sun']), 240),
        'mountains': fit_w(content(L['mountains'], x=False), 2400),
        # At canvas scale the town would tower over the scene; keep it at the reference image's size.
        'town': fit_h(content(L['town']), 240),
        'sea': fit_w(content(L['sea'], x=False), 2400),
        'balustrade': fit_w(content(L['balustrade']), 1920),
        'floor': L['floor'].resize((1920, 270), Image.LANCZOS),
        # Same 1672x941 framing as the reference title image, so they scale straight to 1920x1080.
        'arches': L['arches'].resize((1920, 1080), Image.LANCZOS),
        'frame_border': L['frame_border'].resize((1920, 1080), Image.LANCZOS),
        'vines_left': fit_w(content(L['vines_left']), 520),
        'vines_right': fit_w(content(L['vines_right']), 520),
        'banner_left': fit_h(content(L['banner_left']), 300),
        'banner_right': fit_h(content(L['banner_right']), 300),
        'logo': fit_h(content(L['logo']), 420),
        'plaque_keys': fit_w(content(L['plaque_keys']), 880),
        'plaque_blank': fit_w(content(L['plaque_blank']), 760),
    }
    frames = [content(load(src_dir, n)) for n in GLITTER]
    frames = [f.resize((round(f.width * 0.25), round(f.height * 0.25)), Image.LANCZOS) for f in frames]
    cw, ch = max(f.width for f in frames), max(f.height for f in frames)
    strip = Image.new('RGBA', (cw * len(frames), ch))
    for i, f in enumerate(frames):
        strip.alpha_composite(f, (i * cw + (cw - f.width) // 2, 0))  # centred, top-aligned on the water
    out['sea_glitter'] = strip

    for name, im in out.items():
        im.save(os.path.join(OUT, f'{name}.png'), optimize=True)
        print(f'{name:13s} {im.width}x{im.height}')


if __name__ == '__main__':
    main(sys.argv[1])
