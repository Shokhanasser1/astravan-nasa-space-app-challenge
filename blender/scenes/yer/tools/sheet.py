# usage: blender -b --factory-startup -P sheet.py -- out.png height file1 file2 ...
import bpy, sys, numpy as np
a=sys.argv[sys.argv.index('--')+1:]
out=a[0]; H=int(a[1]); files=a[2:]
tiles=[]
for f in files:
    im=bpy.data.images.load(f); w,h=im.size
    px=np.array(im.pixels[:],dtype=np.float32).reshape(h,w,im.channels)
    if im.channels==4:
        al=px[...,3:4]; px=px[...,:3]*al+0.85*(1-al)
    # nearest resize to height H
    nw=max(1,int(w*H/h)); yi=(np.arange(H)*h/H).astype(int); xi=(np.arange(nw)*w/nw).astype(int)
    tiles.append(px[yi][:,xi][...,:3])
W=sum(t.shape[1] for t in tiles)+4*(len(tiles)-1)
c=np.ones((H,W,3),np.float32); x=0
for t in tiles:
    c[:,x:x+t.shape[1]]=t; x+=t.shape[1]+4
img=bpy.data.images.new('s',W,H); img.pixels[:]=np.concatenate([c,np.ones((H,W,1),np.float32)],2).ravel()
img.filepath_raw=out; img.file_format='PNG'; img.save()
