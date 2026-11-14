"""Bake clip modules into the astronaut rig, measure them, optionally render a contact sheet and export.

  B=/Applications/Blender.app/Contents/MacOS/Blender
  $B -b ../_work/astronaut_rig.blend -P bake_all.py -- --out DIR [--only Walk,Carry] [--sheet] [--export]
      [--clips-dir DIR]   (default anim/clips; the lander clips live in anim/clips_lander and never ship in the game)

Clip modules: anim/clips/*.py, each defines CLIPS = [dict(name, fn, frames, loop, speed, sheet=[frames], meta={})]
fn(t) -> params (t in [0, 1]); use lunar_rig.place_foot() inside fn to plant the boots.
Never overwrites the source rig: saves DIR/astronaut_anim.blend, DIR/clips.json, DIR/sheet_*.png,
DIR/astronaut_raw.glb (+ DIR/astronaut_draco.glb) with --export.
"""
import bpy, sys, os, json, importlib.util, glob, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
A0 = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
CLIPS_DIR = os.path.abspath(A0[A0.index('--clips-dir') + 1]) if '--clips-dir' in A0 else os.path.join(HERE, 'clips')
sys.path.insert(0, CLIPS_DIR)   # clip modules may import helpers from <clips dir>/_*.py
import lunar_rig as L

A = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def opt(name, default=None):
    return A[A.index(name) + 1] if name in A else default
OUT = os.path.abspath(opt('--out', os.path.join(HERE, '..', '_work', 'anim_out')))
ONLY = set(opt('--only').split(',')) if opt('--only') else None
MODS = opt('--modules')   # comma list of module file names in clips/ (default: all)
os.makedirs(OUT, exist_ok=True)

ORDER = ['Idle', 'Walk', 'Run', 'Jump', 'Carry', 'Pour', 'JumpStart', 'JumpAir', 'JumpLand']
specs = []
files = sorted(glob.glob(os.path.join(CLIPS_DIR, '*.py')))
if MODS:
    files = [f for f in files if os.path.basename(f) in MODS.split(',')]
for f in files:
    if os.path.basename(f).startswith('_'):
        continue
    spec = importlib.util.spec_from_file_location('clip_' + os.path.basename(f)[:-3], f)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    for c in getattr(m, 'CLIPS', []):
        c['module'] = os.path.basename(f)
        specs.append(c)
L.log('clip specs', [(c['name'], c['module']) for c in specs])

meta_all = {}
side = json.load(open(os.path.join(OUT, 'clips.json'))) if os.path.exists(os.path.join(OUT, 'clips.json')) else {}
for c in specs:
    if ONLY and c['name'] not in ONLY:
        continue
    t0 = time.time()
    meta = dict(c.get('meta', {}))
    meta['speed'] = float(c.get('speed', 0.0))
    L.bake_clip(c['name'], c['fn'], c['frames'], c['loop'], meta)
    r = L.measure(c['name'], c.get('speed', 0.0))
    side[c['name']] = {'frames': c['frames'], 'seconds': round(c['frames'] / L.FPS, 4), 'loop': c['loop'],
                       'speed': c.get('speed', 0.0), 'module': c['module'],
                       'sink': round(r['sink'], 4), 'slide': {k: round(v, 4) for k, v in r['slide'].items()},
                       'hips_acc': [round(v, 3) for v in r['hips_acc']], 'flight_s': round(r['flight_s'], 3),
                       'hips_z': [round(v, 4) for v in r['hips_z']], **{k: v for k, v in c.get('meta', {}).items()}}
    L.log('bake+measure', c['name'], round(time.time() - t0, 1), 's')

L.order_nla(ORDER)
for n in ORDER:   # untouched old clips get measured too, for the record
    if n in bpy.data.actions and n not in side:
        r = L.measure(n, {'Walk': 0.92, 'Carry': 0.57, 'Run': 1.0}.get(n, 0.0), verbose=True)
json.dump(side, open(os.path.join(OUT, 'clips.json'), 'w'), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'astronaut_anim.blend'), copy=True)
L.log('saved', os.path.join(OUT, 'astronaut_anim.blend'))

if '--sheet' in A:
    rows = []
    for c in specs:
        if ONLY and c['name'] not in ONLY:
            continue
        fr = c.get('sheet') or [round(c['frames'] * i / 6) for i in range(6)]
        rows.append((c['name'], c.get('speed', 0.0), fr))
    if rows:
        tag = '_'.join(r[0] for r in rows)
        L.contact_sheet(rows, os.path.join(OUT, 'sheet_%s.png' % tag))
        L.contact_sheet(rows, os.path.join(OUT, 'sheet_%s_34.png' % tag), view='34')
if '--export' in A:
    L.export_glb(os.path.join(OUT, 'astronaut_raw.glb'), draco=False)
    L.export_glb(os.path.join(OUT, 'astronaut_draco.glb'), draco=True)
