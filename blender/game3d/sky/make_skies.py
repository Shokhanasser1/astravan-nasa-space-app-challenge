"""Oy karvonsaroyi: Metal/Cycles yordamida 360 darajali osmonlar."""
import argparse, json, math, sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

OUT = Path(__file__).resolve().parent
ROOT = OUT.parent.parent
P = argparse.ArgumentParser()
P.add_argument('--only', nargs='+')
P.add_argument('--width', type=int, default=4096)
P.add_argument('--samples', type=int, default=128)
args = P.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
CONFIG = {
 'yer_dusk': (60,4,'#ffd2ad',2.2,'#a7afc5','#444d58'),
 'xks_orbit': (35,35,'#fff5e8',3.0,'#26374f','#122237'),
 'oy_sky': (118,10.5,'#fff6e9',3.2,'#171b24','#232323'),
 'mars_day': (45,32,'#fff0dc',2.4,'#dab08d','#805f4d'),
 'mars_sunset': (60,2,'#d4e7ff',1.0,'#5c5c64','#383230'),
 'koinot_space': (35,35,'#fff5e8',2.0,'#121722','#050609'),
}
def direction(az, el):
 a,e=map(math.radians,(az,el)); return Vector((math.cos(e)*math.cos(a),-math.cos(e)*math.sin(a),math.sin(e)))
def color(h):
 if isinstance(h,str): h=tuple(int(h[i:i+2],16)/255 for i in (1,3,5))
 return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in h)+(1,)
def node(nt,kind): return nt.nodes.new('ShaderNode'+kind)
def mathnode(nt,op,a,b):
 n=node(nt,'Math'); n.operation=op
 for s,v in zip(n.inputs,(a,b)):
  if isinstance(v,(int,float)): s.default_value=v
  else: nt.links.new(v,s)
 return n.outputs[0]
def mix(nt,a,b,f):
 n=node(nt,'MixRGB');
 for s,v in zip(n.inputs,(f,a,b)):
  if isinstance(v,(tuple,list)): s.default_value=v
  elif isinstance(v,(int,float)): s.default_value=v
  else: nt.links.new(v,s)
 return n.outputs[0]
def ramp(nt,v,stops):
 n=node(nt,'ValToRGB'); r=n.color_ramp
 for e in list(r.elements)[2:]: r.elements.remove(e)
 for i,(p,c) in enumerate(stops):
  e=r.elements[i] if i<2 else r.elements.new(p); e.position=p; e.color=color(c)
 nt.links.new(v,n.inputs[0]); return n.outputs[0]
def sphere(name,loc,radius,earth=False):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=256,ring_count=128,radius=radius,location=loc)
 o=bpy.context.object; o.name=name
 for p in o.data.polygons:p.use_smooth=True
 m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree
 bs=nt.nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value=1
 if earth:
  t=node(nt,'TexImage'); t.image=bpy.data.images.load(str(ROOT/'scenes/xks/tex/bluemarble_oct_5400.jpg'),check_existing=True)
  nt.links.new(t.outputs['Color'],bs.inputs['Base Color'])
 o.data.materials.append(m); return o

def build(name):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 sc=bpy.context.scene; sc.render.engine='CYCLES'
 prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='METAL'; prefs.get_devices()
 gpu=[d for d in prefs.devices if d.type=='METAL']
 if not gpu: raise RuntimeError('Metal GPU topilmadi')
 for d in prefs.devices:d.use=d.type=='METAL'
 sc.cycles.device='GPU'; sc.cycles.samples=args.samples; sc.cycles.use_denoising=True
 sc.cycles.adaptive_threshold=.02
 sc.render.resolution_x=args.width; sc.render.resolution_y=args.width//2; sc.render.resolution_percentage=100
 sc.view_settings.view_transform='Standard'; sc.view_settings.look='None'
 sc.render.image_settings.file_format='JPEG'; sc.render.image_settings.color_mode='RGB'; sc.render.image_settings.quality=88
 cd=bpy.data.cameras.new('Panorama'); cd.type='PANO'; cd.panorama_type='EQUIRECTANGULAR'; cd.clip_end=100000
 cam=bpy.data.objects.new('Panorama',cd); sc.collection.objects.link(cam); cam.rotation_euler=Vector((1,0,0)).to_track_quat('-Z','Y').to_euler(); sc.camera=cam
 az,el,*_=CONFIG[name]; sun=direction(az,el)
 w=bpy.data.worlds.new(name); w.use_nodes=True; sc.world=w; nt=w.node_tree; nt.nodes.clear()
 tc=node(nt,'TexCoord'); vec=tc.outputs['Generated']; sep=node(nt,'SeparateXYZ'); nt.links.new(vec,sep.inputs[0]); z=sep.outputs['Z']
 dot=node(nt,'VectorMath'); dot.operation='DOT_PRODUCT'; nt.links.new(vec,dot.inputs[0]); dot.inputs[1].default_value=sun
 dot=dot.outputs['Value']
 if name=='yer_dusk':
  sky=node(nt,'TexSky'); sky.sky_type='MULTIPLE_SCATTERING'; sky.sun_disc=False
  sky.sun_elevation=math.radians(el); sky.sun_rotation=math.radians(90+az); sky.altitude=10; sky.aerosol_density=2
  scale=node(nt,'VectorMath'); scale.operation='SCALE'; scale.inputs['Scale'].default_value=.22; nt.links.new(sky.outputs[0],scale.inputs[0]); c=scale.outputs[0]
  noise=node(nt,'TexNoise'); noise.inputs['Scale'].default_value=5; noise.inputs['Detail'].default_value=4; nt.links.new(vec,noise.inputs[0])
  clouds=mathnode(nt,'MULTIPLY',mathnode(nt,'MAXIMUM',mathnode(nt,'SUBTRACT',noise.outputs['Fac'],.48),0),1.8)
  clouds=mathnode(nt,'MULTIPLY',clouds,mathnode(nt,'GREATER_THAN',z,.1))
  c=mix(nt,c,color('#e0a3ac'),clouds)
 elif name.startswith('mars'):
  if name=='mars_day':
   c=ramp(nt,z,[(0,'#e6ba92'),(.12,'#daa87e'),(1,'#b87e58')])
   halo=mathnode(nt,'POWER',mathnode(nt,'MAXIMUM',dot,0),18)
   c=mix(nt,c,color('#f6e4ce'),mathnode(nt,'MULTIPLY',halo,.65))
  else:
   c=ramp(nt,z,[(0,'#5c5c64'),(.08,'#4a4b54'),(.6,'#1e1f26')])
   halo=mathnode(nt,'POWER',mathnode(nt,'MAXIMUM',dot,0),50)
   c=mix(nt,c,color('#aacaee'),halo)
 else:
  tex=node(nt,'TexEnvironment'); tex.image=bpy.data.images.load(str(ROOT/'scenes/koinot/tex/starfield_1920x1080.png'),check_existing=True)
  # Rasm chetlaridagi chokni sferik shovqin bilan yumshatish.
  noise=node(nt,'TexNoise'); nt.links.new(vec,noise.inputs[0]); noise.inputs['Scale'].default_value=180; noise.inputs['Detail'].default_value=2
  stars=mathnode(nt,'POWER',noise.outputs['Fac'],28)
  stars=mathnode(nt,'MULTIPLY',stars,3 if name=='koinot_space' else .55)
  c=mix(nt,(0,0,0,1),tex.outputs[0],.12 if name=='koinot_space' else .015)
  add=node(nt,'VectorMath'); add.operation='ADD'; nt.links.new(c,add.inputs[0]); nt.links.new(stars,add.inputs[1]); c=add.outputs[0]
  if name=='koinot_space':
   banddot=node(nt,'VectorMath'); banddot.operation='DOT_PRODUCT'; nt.links.new(vec,banddot.inputs[0]); banddot.inputs[1].default_value=(.3,.4,.866)
   band=mathnode(nt,'POWER',mathnode(nt,'ABSOLUTE',banddot.outputs['Value'],0),2)
   band=mathnode(nt,'EXPONENT',mathnode(nt,'MULTIPLY',band,-100),0)
   c=mix(nt,c,color('#141622'),mathnode(nt,'MULTIPLY',band,.55))
 if name not in ('xks_orbit','koinot_space'):
  ground={'yer_dusk':'#56616d','oy_sky':'#191919','mars_day':'#9d7962','mars_sunset':'#302d2d'}[name]
  low=mathnode(nt,'LESS_THAN',z,0)
  if name!='oy_sky':
   low=mathnode(nt,'MINIMUM',mathnode(nt,'MAXIMUM',mathnode(nt,'MULTIPLY',z,-25),0),1)
  c=mix(nt,c,color(ground),low)
 disc=mathnode(nt,'GREATER_THAN',dot,math.cos(math.radians(.175 if name.startswith('mars') else .266)))
 c=mix(nt,c,color('#fff6e3'),disc)
 bg=node(nt,'Background'); nt.links.new(c,bg.inputs['Color']); out=node(nt,'OutputWorld'); nt.links.new(bg.outputs[0],out.inputs['Surface'])
 ld=bpy.data.lights.new('Quyosh','SUN'); ld.energy=3; lo=bpy.data.objects.new('Quyosh',ld); sc.collection.objects.link(lo); lo.rotation_euler=sun.to_track_quat('Z','Y').to_euler()
 if name=='xks_orbit':
  sphere('Yer_6371_km',(0,0,-6771),6371,True)
  # Yupqa atmosfera: sfera chetida ko'k emissiya, markazda shaffof.
  atm=sphere('Atmosfera',(0,0,-6771),6386); m=atm.data.materials[0]; t=m.node_tree; t.nodes.clear()
  lw=node(t,'LayerWeight'); lw.inputs['Blend'].default_value=.1
  em=node(t,'Emission'); em.inputs[0].default_value=color('#4389e3'); em.inputs[1].default_value=.65
  tr=node(t,'BsdfTransparent'); mx=node(t,'MixShader'); t.links.new(lw.outputs['Fresnel'],mx.inputs[0]); t.links.new(tr.outputs[0],mx.inputs[1]); t.links.new(em.outputs[0],mx.inputs[2]); out=node(t,'OutputMaterial'); t.links.new(mx.outputs[0],out.inputs['Surface'])
 if name=='oy_sky':
  # Yer va Quyosh yo'nalishi orasida 90 daraja: yarim yoritilgan disk.
  earth_az=az+math.degrees(math.acos(-math.tan(math.radians(el))*math.tan(math.radians(25))))
  sphere('Yer_1_9_daraja',direction(earth_az,25)*1000,1000*math.sin(math.radians(.95)),True)
  # Fon osmoni Yerning qorong'i tomonini yoritmasin.
  sc.cycles.max_bounces=2
 return sc

def main():
 metadata={'schema_version':1,'coordinates':'Three.js: Y yuqori; azimut 0 = +X, 90 = +Z; balandlik 0 = ufq; backgroundRotation = 0','skies':{}}
 for name,(az,el,col,power,ambient,ground) in CONFIG.items():
  entry=dict(file_4k=name+'_4k.jpg',file_2k=name+'_2k.jpg',sun=dict(azimuth_deg=az,elevation_deg=el,color=col,intensity=power),hemisphere=dict(sky_color=ambient,ground_color=ground,intensity=.25))
  if name=='oy_sky':entry['earth']=dict(azimuth_deg=az+math.degrees(math.acos(-math.tan(math.radians(el))*math.tan(math.radians(25)))),elevation_deg=25,angular_diameter_deg=1.9)
  if name=='xks_orbit':entry['geometry']=dict(earth_radius_km=6371,altitude_km=400,horizon_dip_deg=math.degrees(math.acos(6371/6771)))
  metadata['skies'][name]=entry
  if args.only and name not in args.only:continue
  sc=build(name); sc.render.filepath=str(OUT/entry['file_4k']); bpy.ops.render.render(write_still=True)
  im=bpy.data.images.load(sc.render.filepath,check_existing=False)
  # Denoiser tekis rasm chetini o'raydi deb hisoblamaydi: 12 px ni davriy tutashtirish.
  w,h=im.size; pixels=np.empty(w*h*4,dtype=np.float32); im.pixels.foreach_get(pixels)
  pixels=pixels.reshape(h,w,4); n=12
  left=pixels[:,n].copy(); right=pixels[:,-n-1].copy(); middle=(left+right)*.5
  for j in range(n):
   t=j/n; pixels[:,j]=middle*(1-t)+left*t; pixels[:,-1-j]=middle*(1-t)+right*t
  im.pixels.foreach_set(pixels.ravel()); im.update()
  im.save_render(sc.render.filepath,scene=sc)
  im.scale(args.width//2,args.width//4)
  sc.render.image_settings.quality=85; im.save_render(str(OUT/entry['file_2k']),scene=sc); bpy.data.images.remove(im)
 (OUT/'sky.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
