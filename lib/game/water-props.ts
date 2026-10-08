import * as T from 'three';

export const PAD_CLEARANCE=.045;
export function lilyPadGeometry(){
 const p=[0,.014,0],c=[.58,.75,.35],uv=[.5,.5],indices:number[]=[],segments=22;
 // A shallow bowl with a real radial notch. Geometry starts flat in XZ, so yaw
 // never tips the leaf into the water or changes its thickness.
 for(let i=0;i<=segments;i++){
  const a=.17+(Math.PI*2-.34)*i/segments,r=.96+.035*Math.sin(a*5);
  p.push(Math.cos(a)*r,.002,Math.sin(a)*r);c.push(.37,.55,.24);uv.push(.5+Math.cos(a)*.5,.5+Math.sin(a)*.5);
  if(i>0)indices.push(0,i+1,i);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
