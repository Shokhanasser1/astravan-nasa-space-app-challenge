"""Export the baked astronaut for the game WITH the battery prop (bake_all.py --export leaves props out).

  $B -b <OUT>/astronaut_anim.blend -P export_game.py -- --out <OUT>/astronaut_game_raw.glb [--save-rig ../_work/astronaut_rig.blend]

Same glTF settings as lunar_rig.export_glb (no Draco: the repo runs `npm run glb` → meshopt), plus the object
`Battery` (bone-parented to RightHand by clips/gesture_insert.py) so it lands under the RightHand joint node.
The game hides it except while Insert holds it (src/character/anim.js INSERT_HOLD).
"""
import bpy, sys, os
from mathutils import Quaternion, Vector
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lunar_rig as L

A = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(A[A.index('--out') + 1])

ad = L._ad()
for t2 in ad.nla_tracks:
    t2.mute = False
ad.action = None
for pb in L.rig.pose.bones:
    pb.rotation_quaternion = Quaternion()
    pb.location = Vector()
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
L.rig.select_set(True)
L.body.select_set(True)
bat = bpy.data.objects.get('Battery')
if bat:
    bat.hide_set(False)
    bat.hide_render = False
    bat.select_set(True)
    for ch in bat.children:
        ch.select_set(True)
    L.log('export battery: parent', bat.parent and bat.parent.name, bat.parent_type, bat.parent_bone)
else:
    L.log('export: NO Battery object')
bpy.context.view_layer.objects.active = L.rig
want = dict(filepath=OUT, export_format='GLB', use_selection=True, export_apply=False,
            export_yup=True, export_texcoords=True, export_normals=True, export_tangents=False,
            export_materials='EXPORT', export_image_format='JPEG', export_jpeg_quality=88,
            export_cameras=False, export_lights=False, export_extras=False,
            export_skins=True, export_all_influences=False, export_def_bones=False,
            export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
            export_frame_range=False, export_anim_slide_to_zero=True, export_optimize_animation_size=True,
            export_reset_pose_bones=True, export_rest_position_armature=True,
            export_anim_single_armature=True, export_morph=False,
            export_draco_mesh_compression_enable=False)
props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
bpy.ops.export_scene.gltf(**{k: v for k, v in want.items() if k in props})
L.log('exported game glb', OUT, os.path.getsize(OUT))
if '--save-rig' in A:
    # the baked rig becomes the edit source; save_as remaps the relative texture path (a plain cp broke it: magenta suit)
    rig_path = os.path.abspath(A[A.index('--save-rig') + 1])
    bpy.ops.wm.save_as_mainfile(filepath=rig_path, copy=True, relative_remap=True)
    L.log('saved rig', rig_path)
