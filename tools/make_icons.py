"""Draws the Gone Bananas!!! app icon (a crazy monkey hugging a banana).

One list of shapes is written out twice: as icons/icon.svg and as PNGs (with Pillow),
so the browser tab icon and the home-screen icons always match.
Run:  python tools/make_icons.py
"""
import math
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'icons')
S = 512
INK = '#3b2314'


def crescent(cx, cy, radius, a1, a2, width, taper=0.7, steps=60):
    """Banana-shaped band along a circle: thick in the middle, pointed at both ends."""
    outer, inner = [], []
    for i in range(steps + 1):
        t = i / steps
        a = math.radians(a1 + (a2 - a1) * t)
        w = width * math.sin(math.pi * t) ** taper + 6
        outer.append((cx + (radius + w / 2) * math.cos(a), cy + (radius + w / 2) * math.sin(a)))
        inner.append((cx + (radius - w / 2) * math.cos(a), cy + (radius - w / 2) * math.sin(a)))
    return outer + inner[::-1]


def arc_line(cx, cy, radius, a1, a2, steps=40):
    return [(cx + radius * math.cos(math.radians(a1 + (a2 - a1) * i / steps)),
             cy + radius * math.sin(math.radians(a1 + (a2 - a1) * i / steps))) for i in range(steps + 1)]


def half_ellipse(cx, top, rx, depth, steps=30):
    """A 'D' shape lying flat: straight top edge, round bottom (an open mouth)."""
    pts = [(cx - rx, top)]
    for i in range(steps + 1):
        a = math.pi * i / steps
        pts.append((cx - rx * math.cos(a), top + depth * math.sin(a)))
    return pts


shapes = []
add = shapes.append

# Sunburst background
add(('rect', '#ffc21f'))
for i in range(16):
    a1, a2 = math.radians(i * 22.5 - 5), math.radians(i * 22.5 + 6)
    add(('poly', [(256, 256), (256 + 420 * math.cos(a1), 256 + 420 * math.sin(a1)),
                  (256 + 420 * math.cos(a2), 256 + 420 * math.sin(a2))], '#ffdb5c', None, 0))

# Monkey: ears, head, wild hair
FUR, FUR_D, SKIN = '#8a4b22', '#6b3416', '#f5c99d'
for x in (146, 366):
    add(('circle', x, 205, 44, FUR, INK, 8))
    add(('circle', x, 205, 25, SKIN, None, 0))
add(('poly', [(200, 130), (212, 62), (240, 118)], FUR_D, INK, 7))
add(('poly', [(232, 116), (262, 44), (280, 116)], FUR_D, INK, 7))
add(('poly', [(272, 120), (318, 70), (312, 134)], FUR_D, INK, 7))
add(('circle', 256, 215, 106, FUR, INK, 8))
# face mask
add(('circle', 218, 206, 50, SKIN, None, 0))
add(('circle', 296, 206, 50, SKIN, None, 0))
add(('ellipse', 256, 268, 80, 54, SKIN, None, 0))
# crazy googly eyes: different sizes, looking different ways
add(('circle', 216, 198, 38, '#ffffff', INK, 7))
add(('circle', 297, 192, 47, '#ffffff', INK, 7))
add(('circle', 229, 210, 16, '#2b1d14', None, 0))
add(('circle', 281, 176, 19, '#2b1d14', None, 0))
add(('circle', 234, 204, 5, '#ffffff', None, 0))
add(('circle', 287, 170, 6, '#ffffff', None, 0))
add(('line', [(180, 150), (238, 160)], INK, 9))
add(('line', [(262, 132), (330, 124)], INK, 9))
# nose and big open laughing mouth with tongue out
add(('ellipse', 245, 243, 5, 4, INK, None, 0))
add(('ellipse', 267, 243, 5, 4, INK, None, 0))
add(('poly', half_ellipse(256, 258, 54, 58), '#8b1e2d', INK, 7))
add(('poly', [(208, 260), (304, 260), (300, 276), (212, 276)], '#ffffff', None, 0))
add(('ellipse', 268, 300, 26, 15, '#ff6b8b', INK, 5))

# Banana (a real curved one) that the monkey hugs
BX, BY, BR = 256, 70, 310
add(('poly', crescent(BX, BY, BR, 53, 127, 84), '#ffe135', INK, 9))
add(('poly', crescent(BX, BY, BR + 26, 60, 120, 26, 1.0), '#f2b705', None, 0))   # shaded underside
add(('line', arc_line(BX, BY, BR - 12, 66, 114), '#fff6b0', 9))                  # shine
add(('line', arc_line(BX, BY, BR + 8, 62, 118), '#e0a800', 4))                   # ridge
# brown tip on the left, green stem on the right
add(('ellipse', 72, 312, 13, 11, '#5b3a1a', INK, 5))
add(('poly', [(424, 312), (452, 282), (468, 296), (440, 326)], '#5d8a2e', INK, 6))
# monkey hands gripping the banana
for x in (180, 332):
    add(('ellipse', x, 338, 30, 22, FUR, INK, 7))
    for f in (-14, 0, 14):   # fingers curled over the banana
        add(('ellipse', x + f, 356, 8, 10, FUR, INK, 5))


def to_svg():
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">']
    def st(stroke, w):
        return f' stroke="{stroke}" stroke-width="{w}" stroke-linejoin="round"' if stroke else ''
    for s in shapes:
        kind = s[0]
        if kind == 'rect':
            out.append(f'<rect width="{S}" height="{S}" rx="96" fill="{s[1]}"/>')
        elif kind == 'circle':
            _, x, y, r, fill, stroke, w = s
            out.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}"{st(stroke, w)}/>')
        elif kind == 'ellipse':
            _, x, y, rx, ry, fill, stroke, w = s
            out.append(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}"{st(stroke, w)}/>')
        elif kind == 'poly':
            _, pts, fill, stroke, w = s
            p = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)
            out.append(f'<polygon points="{p}" fill="{fill}"{st(stroke, w)}/>')
        elif kind == 'line':
            _, pts, color, w = s
            p = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)
            out.append(f'<polyline points="{p}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')
    out.append('</svg>')
    return '\n'.join(out)


def to_png(size):
    k = 4 * size / S   # draw 4x bigger, then shrink for smooth edges
    im = Image.new('RGBA', (int(S * k), int(S * k)))
    d = ImageDraw.Draw(im)
    P = lambda pts: [(x * k, y * k) for x, y in pts]
    W = lambda w: max(1, round(w * k))
    for s in shapes:
        kind = s[0]
        if kind == 'rect':
            d.rectangle([0, 0, S * k, S * k], fill=s[1])   # square: the phone rounds the corners
        elif kind in ('circle', 'ellipse'):
            if kind == 'circle':
                _, x, y, rx, fill, stroke, w = s; ry = rx
            else:
                _, x, y, rx, ry, fill, stroke, w = s
            d.ellipse([(x - rx) * k, (y - ry) * k, (x + rx) * k, (y + ry) * k], fill=fill,
                      outline=stroke, width=W(w) if stroke else 0)
        elif kind == 'poly':
            _, pts, fill, stroke, w = s
            d.polygon(P(pts), fill=fill)
            if stroke:
                d.line(P(pts + pts[:1]), fill=stroke, width=W(w), joint='curve')
        elif kind == 'line':
            _, pts, color, w = s
            d.line(P(pts), fill=color, width=W(w), joint='curve')
            for x, y in (pts[0], pts[-1]):   # round ends
                r = w * k / 2
                d.ellipse([x * k - r, y * k - r, x * k + r, y * k + r], fill=color)
    return im.resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'icon.svg'), 'w', encoding='utf-8') as f:
        f.write(to_svg())
    for name, size in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)]:
        to_png(size).save(os.path.join(OUT, name))
    print('icons written to', os.path.normpath(OUT))
