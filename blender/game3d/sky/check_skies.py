"""Tayyor JPEG o'lchamlari, choklar va Quyosh joylashuvini tekshirish."""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw
OUT=Path(__file__).resolve().parent
cfg=json.loads((OUT/'sky.json').read_text())
report={}; sheet=Image.new('RGB',(1024,6*280),'#181c25'); draw=ImageDraw.Draw(sheet)
for i,(name,c) in enumerate(cfg['skies'].items()):
 a=np.array(Image.open(OUT/c['file_4k']).convert('RGB'))
 assert a.shape==(2048,4096,3),(name,a.shape)
 assert Image.open(OUT/c['file_2k']).size==(2048,1024)
 edge=np.abs(a[:,0].astype(float)-a[:,-1].astype(float))
 az=c['sun']['azimuth_deg']; el=c['sun']['elevation_deg']
 x=round((.5+az/360)%1*4096); y=round((.5-el/180)*2048)
 region=a[y-5:y+6,x-5:x+6]
 assert region.max()>200,(name,'Quyosh topilmadi')
 assert np.percentile(edge,99)<10,(name,'Chetlar farqi katta')
 report[name]={'4k_bytes':(OUT/c['file_4k']).stat().st_size,'2k_bytes':(OUT/c['file_2k']).stat().st_size,'edge_mean_difference_255':round(float(edge.mean()),3),'edge_p99_difference_255':round(float(np.percentile(edge,99)),2),'sun_expected_pixel':[x,y],'sun_patch_max_255':int(region.max())}
 thumb=Image.fromarray(a).resize((1024,256),Image.Resampling.LANCZOS)
 sheet.paste(thumb,(0,i*280+24));draw.text((8,i*280+5),name,fill='white')
sheet.save(OUT/'preview.jpg',quality=90)
report['total_bytes']=sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file())
assert report['total_bytes']<40_000_000
(OUT/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
