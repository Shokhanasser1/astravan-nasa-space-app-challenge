"""Final background renders on the Apple GPU (Metal) for every station .blend.

Run OUTSIDE Claude's sandbox (your own Terminal), because the sandbox blocks Metal:
    bash ~/dev/oy-karvonsaroyi-3d/tools/render_final_gpu.sh            # all stations
    bash ~/dev/oy-karvonsaroyi-3d/tools/render_final_gpu.sh yer xks    # only some

Renders every scene that has a camera, except helper scenes (sprites, assets, library,
brand checks, NASA comparison). Output: renders/final_gpu/<station>/<scene>.png
Args after "--": out_dir [samples] [res_percent] [cpu]
"""
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out_dir = argv[0]
samples = int(argv[1]) if len(argv) > 1 else 256
res_pct = int(argv[2]) if len(argv) > 2 else 100
force_cpu = len(argv) > 3 and argv[3] == "cpu"

SKIP = ("sprite", "spr_", "asset", "library", "chk", "check", "taqqos", "ref_", "_ref")

device = "CPU"
if not force_cpu:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        gpus = [d for d in prefs.devices if d.type == "METAL"]
        for d in prefs.devices:
            d.use = d.type == "METAL"
        if gpus:
            device = "GPU"
            print("GPU_DEVICES", [d.name for d in gpus], flush=True)
        else:
            print("WARNING: no Metal GPU found - rendering on CPU", flush=True)
    except Exception as e:  # noqa: BLE001
        print("WARNING: Metal setup failed:", e, flush=True)

os.makedirs(out_dir, exist_ok=True)
blend = bpy.path.basename(bpy.data.filepath)
for scene in list(bpy.data.scenes):
    name = scene.name.lower()
    if scene.camera is None or any(k in name for k in SKIP):
        print(f"skip  {blend} :: {scene.name}", flush=True)
        continue
    scene.render.engine = "CYCLES"
    scene.cycles.device = device
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "AUTO"
    scene.render.resolution_percentage = res_pct
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = os.path.join(out_dir, f"{scene.name}.png")
    print(f"RENDER {blend} :: {scene.name} ({device}, {samples} spp)", flush=True)
    bpy.ops.render.render(write_still=True, scene=scene.name)
    print(f"DONE   {scene.render.filepath}", flush=True)
