"""Texture logo removal helpers for the OY (Moon) station.

Logos / flags / lettering that NASA painted into model textures are painted
over in a COPY of the image (the source .glb files are never modified).
Each rectangle is filled row by row with a linear blend between the colours
just left and right of the rectangle, so panel seams and shading survive.

Rect coordinates are (x0, y0, x1, y1) in TOP-DOWN pixel coordinates of the
original texture (as seen in an image viewer).
"""
import numpy as np

# HDU_01 (hdu-1.glb, 1024x1024): US flags, NASA meatballs, X-Hab logos,
# HDU logos, "Segment A..H" labels with mini flags/meatballs, "AIRLOCK".
HDU_01_RECTS = [
    # big flags
    (183, 62, 258, 130), (183, 386, 258, 455),
    # big NASA meatballs
    (183, 146, 262, 222), (183, 466, 262, 542),
    # X-Hab logos
    (176, 226, 268, 290), (176, 551, 268, 615),
    # HDU logos (segment D and H)
    (33, 232, 98, 285), (33, 554, 98, 608),
    # "AIRLOCK" lettering
    (652, 800, 702, 995),
]
# "Segment X" label rows: text + mini flag + mini meatball, one band per segment
for yc in (59, 140, 222, 304, 384, 465, 546, 628):
    HDU_01_RECTS.append((36, yc - 11, 156, yc + 16))
# mini meatballs that sit just above each label line (right side of column)
for yc in (44, 124, 206, 287, 368, 449, 531, 612):
    HDU_01_RECTS.append((128, yc - 10, 158, yc + 9))
# top-most mini meatball / flag near the top edge
HDU_01_RECTS.append((128, 0, 158, 20))

# crwlckbg (crew-lock-bag.glb, 1024x512): two small barcode/part-number stickers
# in the bottom corners of the clear window (illegible, but still lettering).
CRWLCKBG_RECTS = [(472, 473, 520, 501), (796, 473, 846, 501)]

TEX_RECTS = {
    'HDU_01': HDU_01_RECTS,
    'crwlckbg': CRWLCKBG_RECTS,
}


def _to_np(img):
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(h, w, 4)


def inpaint_rects(px, rects, pad=3):
    """px: (h, w, 4) bottom-up float array. rects: top-down (x0,y0,x1,y1)."""
    h, w, _ = px.shape
    for (x0, y0, x1, y1) in rects:
        x0 = max(pad, x0); x1 = min(w - pad - 1, x1)
        r0 = max(0, h - 1 - y1); r1 = min(h - 1, h - 1 - y0)
        n = x1 - x0
        t = np.linspace(0.0, 1.0, n)[None, :, None]
        left = px[r0:r1 + 1, x0 - pad:x0, :].mean(axis=1, keepdims=True)
        right = px[r0:r1 + 1, x1:x1 + pad, :].mean(axis=1, keepdims=True)
        px[r0:r1 + 1, x0:x1, :] = left * (1 - t) + right * t
    return px


def clean_image(bpy, img, rects, new_name=None):
    """Return a cleaned, packed copy of img (original left untouched)."""
    w, h = img.size
    px = _to_np(img).copy()
    px = inpaint_rects(px, rects)
    out = bpy.data.images.new(new_name or (img.name + '_clean'), w, h, alpha=True)
    out.colorspace_settings.name = img.colorspace_settings.name
    out.pixels.foreach_set(px.ravel())
    out.pack()
    return out


# crew-lock-bag texture (crwlckbg, 1024x512): the clear front window.
# For the "water brick" variant the window is tinted water-blue.
CLB_WINDOW = (468, 212, 862, 492)


def water_tint(bpy, img, rect=CLB_WINDOW, color=(0.20, 0.55, 0.95), amount=0.62, new_name=None, fill=1.0):
    """Copy of the bag texture with water visible behind the window.
    fill = 0..1 water level inside the window (1 = full)."""
    w, h = img.size
    px = _to_np(img).copy()
    x0, y0, x1, y1 = rect
    r0 = h - 1 - y1; r1 = h - 1 - y0
    rows = np.arange(r0, r1 + 1)
    # water level: rows above level stay as-is
    level = r0 + (r1 - r0) * fill
    t = np.clip((rows - r0) / max(1, (r1 - r0)), 0, 1)[:, None, None]
    col = np.array([*color, 1.0], np.float32)[None, None, :]
    shade = (0.75 + 0.35 * t)  # lighter towards the surface
    region = px[r0:r1 + 1, x0:x1, :]
    tinted = region * (1 - amount) + col * shade * amount
    mask = (rows <= level)[:, None, None]
    px[r0:r1 + 1, x0:x1, :] = np.where(mask, tinted, region)
    px[..., 3] = 1.0
    out = bpy.data.images.new(new_name or (img.name + '_water'), w, h, alpha=True)
    out.colorspace_settings.name = img.colorspace_settings.name
    out.pixels.foreach_set(px.ravel())
    out.pack()
    return out


def recolor_yellow(bpy, img, new_name=None):
    """Yellow safety rails in the HDU_02 texture -> white/light-grey rails as on the
    real Deep Space Habitat porch (NASA photo, Desert RATS 2011)."""
    w, h = img.size
    px = _to_np(img).copy()
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    yellow = (r > 0.22) & (g > 0.18) & (b < 0.6 * g) & (np.abs(r - g) < 0.4 * np.maximum(r, g))
    v = np.maximum(r, g)
    for ch in range(3):
        px[..., ch] = np.where(yellow, v * 0.88, px[..., ch])
    out = bpy.data.images.new(new_name or (img.name + '_white'), w, h, alpha=True)
    out.colorspace_settings.name = img.colorspace_settings.name
    out.pixels.foreach_set(px.ravel())
    out.pack()
    return out
