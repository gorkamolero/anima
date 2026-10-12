"""Local connected grey-background matte. No API calls or shape edits."""
import json,sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
r=Path('tmp/walkqa/verification-16b')/sys.argv[1];out=r/'keyed';out.mkdir(exist_ok=True)
for p in sorted((r/'raw-frames').glob('*.png')):
 c=np.array(Image.open(p).convert('RGB'),dtype=float);bg=np.median(np.concatenate([c[:,:12].reshape(-1,3),c[:,-12:].reshape(-1,3)]),axis=0);dist=np.linalg.norm(c-bg,axis=2)
 candidate=dist<45;seeds=np.zeros(dist.shape,bool);seeds[0]=candidate[0];seeds[-1]=candidate[-1];seeds[:,0]=candidate[:,0];seeds[:,-1]=candidate[:,-1];outside=ndi.binary_propagation(seeds,mask=candidate)
 core=~outside;_,ix=ndi.distance_transform_edt(outside,return_indices=True);fg=c[ix[0],ix[1]];v=fg-bg;alpha=np.clip(np.sum((c-bg)*v,axis=2)/np.maximum(1,np.sum(v*v,axis=2)),0,1);alpha[core]=1;alpha[dist<3]=0
 color=np.clip((c-bg*(1-alpha[:,:,None]))/np.maximum(alpha[:,:,None],0.001),0,255);rgba=np.concatenate([color,alpha[:,:,None]*255],axis=2).astype('uint8');Image.fromarray(rgba).save(out/p.name)
print(sys.argv[1],len(list(out.glob('*.png'))),'locally keyed')
