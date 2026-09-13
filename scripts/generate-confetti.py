"""
The confetti band at the top of the birthday email.

An animated GIF rather than CSS, because no mail client runs CSS animation —
Gmail, Apple Mail, iOS Mail and Yahoo all play a GIF, and Outlook on Windows
shows frame 0 and stops. So frame 0 has to look finished on its own, which is
why the pieces start already spread across the band rather than massed at the
top.

Drawn in her palette rather than party colours: the same browns and beiges as
the rest of the email, plus one warmer pop, so it reads as celebratory without
looking like it came from a different brand.

Loops seamlessly: every piece falls at a constant speed and wraps vertically,
and each rotates by a whole multiple of 90 degrees across the loop, so a
rectangle lands back on a shape identical to the one it started on.
"""
import math
import random
from PIL import Image, ImageDraw

W, H = 1040, 170          # 2x the 520x85 it is displayed at
FRAMES = 20
DURATION_MS = 90
BG = (255, 255, 255)

# Deep brown, warm beige, dark brown, light tan, and one warmer pop.
COLOURS = [
    (139, 111, 71),
    (212, 184, 150),
    (61, 43, 31),
    (232, 221, 208),
    (197, 130, 85),
]

random.seed(19)           # Fixed, so re-running produces the same band.

PIECES = []
for _ in range(46):
    PIECES.append({
        "x": random.uniform(0, W),
        "y0": random.uniform(0, H),
        "speed": random.uniform(0.45, 1.25),      # fraction of H per loop
        "w": random.randint(9, 17),
        "h": random.randint(5, 9),
        "colour": random.choice(COLOURS),
        "spin": random.choice([1, -1, 2, -2]),    # whole turns per loop
        "phase": random.uniform(0, math.tau),
        "round": random.random() < 0.22,          # a few dots among the strips
        "sway": random.uniform(4, 14),
    })


def draw_piece(base, piece, t):
    """One confetti piece at loop position t (0..1)."""
    span = H + piece["h"] * 3
    y = (piece["y0"] + piece["speed"] * span * t) % span - piece["h"] * 1.5
    x = piece["x"] + math.sin(piece["phase"] + t * math.tau) * piece["sway"]

    if piece["round"]:
        r = piece["h"]
        ImageDraw.Draw(base).ellipse(
            [x - r, y - r, x + r, y + r], fill=piece["colour"]
        )
        return

    # Rotated rectangles are drawn on their own tile and pasted, because
    # ImageDraw has no rotation of its own.
    w, h = piece["w"], piece["h"]
    tile = Image.new("RGBA", (w * 3, h * 3), (0, 0, 0, 0))
    ImageDraw.Draw(tile).rectangle([w, h, w * 2, h * 2], fill=piece["colour"])
    angle = (piece["spin"] * 360 * t) + math.degrees(piece["phase"])
    tile = tile.rotate(angle, resample=Image.BICUBIC, expand=False)
    base.alpha_composite(tile, (int(x - w * 1.5), int(y - h * 1.5)))


frames = []
for f in range(FRAMES):
    t = f / FRAMES
    canvas = Image.new("RGBA", (W, H), BG + (255,))
    for piece in PIECES:
        draw_piece(canvas, piece, t)
    frames.append(canvas.convert("RGB").convert("P", palette=Image.ADAPTIVE, colors=64))

frames[0].save(
    "/home/user/vislashes-booking/public/email/confetti.gif",
    save_all=True,
    append_images=frames[1:],
    duration=DURATION_MS,
    loop=0,
    optimize=True,
)
print("frames:", len(frames))
