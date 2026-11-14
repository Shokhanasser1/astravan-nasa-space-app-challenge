# blender -b --factory-startup -P to_jpg.py -- quality in1.png [in2.png ...]  -> writes in*.jpg next to them
import bpy, sys, os
a = sys.argv[sys.argv.index('--') + 1:]
q = int(a[0])
sc = bpy.context.scene
sc.render.image_settings.file_format = 'JPEG'
sc.render.image_settings.quality = q
sc.render.image_settings.color_mode = 'RGB'
# plain pass-through (no AgX/Filmic re-grade of an already finished image)
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
sc.view_settings.exposure = 0.0
sc.view_settings.gamma = 1.0
try:
    sc.render.image_settings.color_management = 'FOLLOW_SCENE'
except Exception:
    pass
for f in a[1:]:
    im = bpy.data.images.load(os.path.abspath(f))
    out = os.path.splitext(os.path.abspath(f))[0] + '.jpg'
    im.save_render(out, scene=sc)
    print('JPG', out, os.path.getsize(out))
