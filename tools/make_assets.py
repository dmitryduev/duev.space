"""Regenerate the dithered image assets.

    uv run --with pillow tools/make_assets.py [path/to/photo.jpg]

The portrait is gradient-mapped onto a 6-color ramp with an 8x8 Bayer
matrix. The page recolors it at runtime (palette swap), so the ramp
below must match BAKED in public/static/js/site.js.
"""
import random
import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "public" / "static" / "img"
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tools" / "portrait-src.jpg"

RAMP = ["#0d0a1c", "#360741", "#42527a", "#3b8a86", "#75c078", "#d6c951"]  # muted viridis
SIZE = 128

BAYER8 = [
    [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
]


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def portrait():
    g = ImageOps.mirror(Image.open(SRC).convert("L")).resize((SIZE, SIZE), Image.LANCZOS)
    g = ImageEnhance.Brightness(ImageEnhance.Contrast(g).enhance(1.35)).enhance(1.05)
    pal = [rgb(h) for h in RAMP]
    n = len(pal) - 1
    out = Image.new("P", (SIZE, SIZE))
    out.putpalette([c for p in pal for c in p])
    src, dst = g.load(), out.load()
    c = SIZE / 2
    for y in range(SIZE):
        for x in range(SIZE):
            d = ((x - c) ** 2 + (y - c) ** 2) ** 0.5 / c
            v = src[x, y] / 255 * max(0.0, min(1.0, 1.35 - 0.55 * d))
            t = (BAYER8[y % 8][x % 8] + 0.5) / 64 - 0.5
            dst[x, y] = int(max(0, min(n, round(v * n + t))))
    out.save(IMG / "portrait.png", optimize=True)
    return out


def og_image(p):
    """1200x630 social card: starfield + 4x portrait."""
    random.seed(7)
    bg = Image.new("RGB", (300, 158), rgb(RAMP[0]))
    px = bg.load()
    for _ in range(140):
        x, y = random.randrange(300), random.randrange(158)
        px[x, y] = rgb(random.choice(RAMP[3:]))
    card = bg.resize((1200, 632), Image.NEAREST).crop((0, 0, 1200, 630))
    big = p.convert("RGB").resize((512, 512), Image.NEAREST)
    card.paste(big, (344, 59))
    card.save(IMG / "og.png", optimize=True)


def planet(n):
    """Tiny ringed planet (index image) for the favicons."""
    import math
    out = Image.new("P", (n, n), 0)
    out.putpalette([c for h in RAMP for c in rgb(h)])
    px = out.load()
    c, R, tilt, a = n / 2, n * 0.25, 0.32, -0.45
    ca, sa = math.cos(a), math.sin(a)
    L = (-0.62, -0.48, 0.62)
    for y in range(n):
        for x in range(n):
            dx, dy = x + 0.5 - c, y + 0.5 - c
            d2 = dx * dx + dy * dy
            u = dx * ca + dy * sa
            v = (-dx * sa + dy * ca) / tilt
            r = math.hypot(u, v)
            th = (BAYER8[y % 8][x % 8] + 0.5) / 64 - 0.5
            inside = d2 < R * R
            if 1.35 * R < r < 1.9 * R and (v > 0 or not inside):
                val = 0.85 if v > 0 else 0.5
                px[x, y] = max(1, min(5, round(val * 5 + th)))
            elif inside:
                nz = math.sqrt(1 - d2 / (R * R))
                lam = max(0.0, dx / R * L[0] + dy / R * L[1] + nz * L[2])
                lat = -dx / R * sa + dy / R * ca
                val = lam * (0.8 + 0.2 * math.sin(lat * 9))
                px[x, y] = max(0, min(5, round(val * 5.4 + th)))
    return out


def icons():
    p16 = planet(16).convert("RGBA")
    bg = rgb(RAMP[0])
    rects = []
    for y in range(16):
        x = 0
        while x < 16:
            col = p16.getpixel((x, y))[:3]
            run = 1
            while x + run < 16 and p16.getpixel((x + run, y))[:3] == col:
                run += 1
            if col != bg:
                rects.append(f'<rect x="{x}" y="{y}" width="{run}" height="1" fill="#{col[0]:02x}{col[1]:02x}{col[2]:02x}"/>')
            x += run
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">'
           f'<rect width="16" height="16" rx="2" fill="{RAMP[0]}"/>' + "".join(rects) + "</svg>\n")
    (IMG / "favicon.svg").write_text(svg)
    p16.convert("RGB").resize((32, 32), Image.NEAREST).save(IMG / "favicon-32.png", optimize=True)
    planet(36).convert("RGB").resize((180, 180), Image.NEAREST).save(IMG / "icon-180.png", optimize=True)


def pixel_font():
    """The 5x7 font from site.js: char + 7 base-32 row masks."""
    import re
    js = (ROOT / "public" / "static" / "js" / "site.js").read_text()
    s = re.search(r"const s = '(.*?)';\n", js).group(1).replace("\\'", "'")
    return {s[i]: [int(c, 32) for c in s[i + 1:i + 8]] for i in range(0, len(s), 8)}


def banner():
    """README banner: starfield, dithered ringed planet, title in the site's pixel font."""
    W, H, S = 240, 60, 4
    font = pixel_font()
    random.seed(11)
    img = Image.new("P", (W, H), 0)
    img.putpalette([c for h in RAMP for c in rgb(h)])
    px = img.load()
    for _ in range(90):
        px[random.randrange(W), random.randrange(H)] = random.choice([1, 2, 2, 3, 5])
    p = planet(56)
    pp = p.load()
    for y in range(p.height):
        for x in range(p.width):
            if pp[x, y] and 0 <= W - 66 + x < W and 0 <= 2 + y < H:
                px[W - 66 + x, 2 + y] = pp[x, y]

    def text(t, x0, y0, scale, color, shadow):
        for dx, dy, c in ((1, 1, shadow), (0, 0, color)):
            x = x0
            for ch in t:
                rows = font.get(ch, [0] * 7)
                w = max([c_ + 1 for r in rows for c_ in range(5) if r & (16 >> c_)] or [2])
                for j, r in enumerate(rows):
                    for c_ in range(5):
                        if r & (16 >> c_):
                            for a in range(scale):
                                for b in range(scale):
                                    X, Y = x + (c_ + dx) * scale + a, y0 + (j + dy) * scale + b
                                    if 0 <= X < W and 0 <= Y < H:
                                        px[X, Y] = c
                x += (w + 1) * scale

    text("DUEV.SPACE", 12, 16, 2, 5, 1)
    text("8-BIT · DITHERED · TINY", 12, 38, 1, 3, 0)
    out = ROOT / ".github" / "banner.png"
    out.parent.mkdir(exist_ok=True)
    img.convert("RGB").resize((W * S, H * S), Image.NEAREST).save(out, optimize=True)
    return out


if __name__ == "__main__":
    og_image(portrait())
    icons()
    banner()
    for f in ("portrait.png", "og.png", "favicon.svg", "favicon-32.png", "icon-180.png"):
        print(f, (IMG / f).stat().st_size, "bytes")
    print("banner.png", (ROOT / ".github" / "banner.png").stat().st_size, "bytes")
