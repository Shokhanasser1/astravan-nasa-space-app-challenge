# Contact sheet helper: blender -b -P contact_sheet.py -- out.png cols cellw img1 img2 ...
import bpy, sys, numpy as np
a = sys.argv[sys.argv.index("--")+1:]
out, cols, cw = a[0], int(a[1]), int(a[2]); files = a[3:]
cells = []
for f in files:
    im = bpy.data.images.load(f)
    w, h = im.size
    ch = int(cw * h / w)
    im.scale(cw, ch)
    px = np.array(im.pixels[:], dtype=np.float32).reshape(ch, cw, 4)
    if im.channels < 4 or True:
        # composite on grey checker-free mid grey for alpha
        al = px[..., 3:4]
        px = np.concatenate([px[..., :3] * al + 0.25 * (1 - al), np.ones_like(al)], axis=2)
    cells.append(px)
rows = (len(cells) + cols - 1) // cols
rh = [max(c.shape[0] for c in cells[r*cols:(r+1)*cols]) for r in range(rows)]
H = sum(rh) + 4 * rows; W = cols * (cw + 4)
sheet = np.zeros((H, W, 4), np.float32); sheet[..., 3] = 1
y = 0
for r in range(rows):
    for c in range(cols):
        i = r * cols + c
        if i >= len(cells): break
        px = cells[i]; h = px.shape[0]
        # blender pixel rows go bottom-up; place rows from the top of the sheet
        y0 = H - y - h
        sheet[y0:y0+h, c*(cw+4):c*(cw+4)+cw] = px
    y += rh[r] + 4
img = bpy.data.images.new("sheet", W, H, alpha=False)
img.pixels[:] = sheet.ravel()
img.filepath_raw = out; img.file_format = 'PNG'; img.save()
