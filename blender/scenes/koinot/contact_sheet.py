# Make a contact sheet (grid) of PNG/JPG images with Blender's Python + numpy.
# Usage: Blender -b --factory-startup -P contact_sheet.py -- OUT.png COLS CELL_W img1 img2 ...
import bpy, sys
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
out, cols, cw = argv[0], int(argv[1]), int(argv[2])
paths = argv[3:]
cells = []
for p in paths:
    im = bpy.data.images.load(p)
    w, h = im.size
    a = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(a)
    a = a.reshape(h, w, 4)
    ch = int(round(h * cw / w))
    ys = (np.arange(ch) * h / ch).astype(int)
    xs = (np.arange(cw) * w / cw).astype(int)
    cell = a[ys][:, xs]
    # composite alpha over mid grey checker so transparent sprites are readable
    chk = ((np.indices((ch, cw)).sum(0) // 16) % 2)[..., None] * 0.15 + 0.25
    rgb = cell[..., :3] * cell[..., 3:4] + chk * (1 - cell[..., 3:4])
    cells.append(rgb)
rows = (len(cells) + cols - 1) // cols
chs = max(c.shape[0] for c in cells)
sheet = np.zeros((rows * chs, cols * cw, 4), dtype=np.float32)
sheet[..., 3] = 1
for i, c in enumerate(cells):
    r, k = divmod(i, cols)
    # blender pixel rows go bottom-up: place row 0 at top
    y0 = (rows - 1 - r) * chs + (chs - c.shape[0])
    sheet[y0:y0 + c.shape[0], k * cw:(k + 1) * cw, :3] = c
img = bpy.data.images.new("sheet", cols * cw, rows * chs, alpha=False)
img.pixels.foreach_set(sheet.ravel())
img.filepath_raw = out
img.file_format = 'PNG'
img.save()
print("SHEET", out)
