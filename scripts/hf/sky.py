# The all-sky Milky Way for features.hfSky (public/hf/sky/milkyway-{4k,2k}.webp).
# Input: the AI panorama (Higgsfield, FLUX 3 Image, 4k 2:1, job e208797e-03e2-4294-9c16-2b078544c3fc) saved as a4.png.
# 1) seamless left/right (overlap-blend 8% of the width), 2) "star reduction" as in astrophotography: split the stars
# from the diffuse band (median filter), shrink them (3x3 min) and thin the faint ones, dim the band, black floor,
# 3) poles faded to their row mean (the sphere pinches the top and bottom rows to a point).
# Run: python3 -I scripts/hf/sky.py a4.png out/   (Pillow + NumPy)
import sys
import numpy as np
from PIL import Image, ImageFilter
Image.MAX_IMAGE_PIXELS = None
src, out_dir = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255.0
H, W, _ = a.shape
N = int(W * 0.08)
t = np.linspace(0, 1, N, dtype=np.float32)[None, :, None]
t = t * t * (3 - 2 * t)
a = np.concatenate([a[:, N:W - N], a[:, W - N:] * (1 - t) + a[:, :N] * t], axis=1)
img = Image.fromarray((a * 255 + .5).astype(np.uint8)).resize((4096, 2048), Image.LANCZOS)
bg = img.filter(ImageFilter.MedianFilter(9)).filter(ImageFilter.GaussianBlur(3))
A = np.asarray(img).astype(np.float32) / 255
B = np.asarray(bg).astype(np.float32) / 255
S = np.clip(A - B, 0, 1)
S = np.asarray(Image.fromarray((S * 255 + .5).astype(np.uint8)).filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255
S = np.clip(S * 1.6, 0, 1) ** 1.35
bp = np.percentile(B.mean(axis=2), 35)
Bk = np.clip((B - bp) / (1 - bp), 0, 1) ** 1.25
out = np.clip(Bk * 0.62 + S * 1.1, 0, 1)
rows = np.linspace(0, 1, out.shape[0], dtype=np.float32)
for d in (rows, 1 - rows):
    w = np.clip(1 - d / 0.07, 0, 1) ** 1.5
    out = out * (1 - w[:, None, None]) + out.mean(axis=1, keepdims=True) * w[:, None, None]
o = Image.fromarray((out * 255 + .5).astype(np.uint8))
o.save(f'{out_dir}/milkyway-4k.webp', quality=72, method=6)
o.resize((2048, 1024), Image.LANCZOS).save(f'{out_dir}/milkyway-2k.webp', quality=76, method=6)
