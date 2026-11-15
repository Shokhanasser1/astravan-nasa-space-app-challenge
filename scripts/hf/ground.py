# The regolith detail for features.hfGround (public/hf/ground/regolith-{albedo,slope}-{1k,512}.webp), the same
# contract as src/look/textures.js regolithTextures: albedo grey with mean 0.5 (the shader doubles it), slope RG =
# surface tilt (decoded s = rg*2-1). Input: the AI photo-texture (Higgsfield, GPT Image 2.6 high 4k,
# job e8e40322-d8fb-4aff-a435-fe4692d2ed63) saved as a1.png -> prefix "regolith" (the 2.7 m close-up layer); the macro
# layer (one tile ≈ 14 m: craterlets with ejecta, stones; Nano Banana Pro 4k, job e32ca3a5-53ff-40d2-9bbc-5fb727621978)
# saved as a2.png -> prefix "macro".
# Seamless by overlap-blending 6% on both axes; blur is done in Fourier space, so it wraps like the tile.
# Run: python3 -I scripts/hf/ground.py a1.png out/ regolith && python3 -I scripts/hf/ground.py a2.png out/ macro
import sys
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
src, out_dir, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
g = np.asarray(Image.open(src).convert('L')).astype(np.float32) / 255.0


def overlap(a, axis, N):
    t = np.linspace(0, 1, N, dtype=np.float32)
    t = t * t * (3 - 2 * t)
    if axis == 0:
        return np.concatenate([a[N:-N], a[-N:] * (1 - t)[:, None] + a[:N] * t[:, None]], 0)
    return np.concatenate([a[:, N:-N], a[:, -N:] * (1 - t)[None] + a[:, :N] * t[None]], 1)


def blur(a, s):
    h, w = a.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    return np.real(np.fft.ifft2(np.fft.fft2(a) * np.exp(-2 * (np.pi * s) ** 2 * (fx * fx + fy * fy))))


N = int(g.shape[0] * 0.06)
g = overlap(overlap(g, 0, N), 1, N)
for size, name in ((1024, '1k'), (512, '512')):
    a = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)).astype(np.float32) / 255
    alb = a - blur(a, size / 6) + a.mean()                 # no large light falloff from the photo
    alb = np.clip((alb - alb.mean()) / alb.std() * 0.115 + 0.5, 0.12, 0.88)
    h = blur(a, 0.7) - blur(a, size / 24)                   # brightness as relief, high-passed
    dx = np.roll(h, -1, 1) - np.roll(h, 1, 1)
    dy = np.roll(h, -1, 0) - np.roll(h, 1, 0)
    k = 0.15 / np.sqrt((dx ** 2 + dy ** 2).mean() / 2)
    sx, sy = np.clip(-dx * k, -1, 1), np.clip(-dy * k, -1, 1)
    A = (alb * 255 + 0.5).astype(np.uint8)
    Image.fromarray(np.stack([A, A, A], -1)).save(f'{out_dir}/{prefix}-albedo-{name}.webp', quality=80, method=6)
    S = np.stack([(sx * 0.5 + 0.5) * 255 + 0.5, (sy * 0.5 + 0.5) * 255 + 0.5, np.full_like(sx, 128)], -1).astype(np.uint8)
    Image.fromarray(S).save(f'{out_dir}/{prefix}-slope-{name}.webp', quality=84, method=6)
