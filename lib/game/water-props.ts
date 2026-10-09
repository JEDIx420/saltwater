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

export function lotusFlowerGeometry(){
 const p:number[]=[],c:number[]=[],uv:number[]=[],indices:number[]=[];
 let vertCount=0;
 // Central stamen / receptacle (golden-yellow disc)
 p.push(0,.08,0);c.push(.98,.82,.22);uv.push(.5,.5);
 const centerIdx=vertCount++;
 const stamenSegments=10;
 for(let i=0;i<=stamenSegments;i++){
  const a=(Math.PI*2*i)/stamenSegments;
  p.push(Math.cos(a)*.14,.075,Math.sin(a)*.14);c.push(.96,.78,.18);uv.push(.5+Math.cos(a)*.15,.5+Math.sin(a)*.15);
  vertCount++;
  if(i>0)indices.push(centerIdx,vertCount-1,vertCount-2);
 }
 // Petals: outer ring (8 petals) and inner ring (6 petals)
 const layers=[
  {count:8,radius:.44,height:.15,colorBase:[.95,.42,.58],colorTip:[1,.88,.94]},
  {count:6,radius:.32,height:.22,colorBase:[.98,.62,.74],colorTip:[1,.94,.97]}
 ];
 for(const layer of layers){
  for(let i=0;i<layer.count;i++){
   const baseAngle=(Math.PI*2*i)/layer.count+(layer.count===6?.35:0);
   const cos=Math.cos(baseAngle),sin=Math.sin(baseAngle);
   const perpX=-sin,perpZ=cos;
   const baseIdx=vertCount;
   // Petal base
   p.push(cos*.1,.05,sin*.1);c.push(layer.colorBase[0],layer.colorBase[1],layer.colorBase[2]);uv.push(.5,.5);
   // Petal left
   p.push(cos*(layer.radius*.55)+perpX*.12,layer.height*.6,sin*(layer.radius*.55)+perpZ*.12);c.push(layer.colorBase[0]*.9+.1,layer.colorBase[1]*.9+.1,layer.colorBase[2]*.9+.1);uv.push(0,.5);
   // Petal right
   p.push(cos*(layer.radius*.55)-perpX*.12,layer.height*.6,sin*(layer.radius*.55)-perpZ*.12);c.push(layer.colorBase[0]*.9+.1,layer.colorBase[1]*.9+.1,layer.colorBase[2]*.9+.1);uv.push(1,.5);
   // Petal tip
   p.push(cos*layer.radius,layer.height,sin*layer.radius);c.push(layer.colorTip[0],layer.colorTip[1],layer.colorTip[2]);uv.push(.5,1);
   vertCount+=4;
   indices.push(baseIdx,baseIdx+1,baseIdx+3);
   indices.push(baseIdx,baseIdx+3,baseIdx+2);
   indices.push(baseIdx,baseIdx+3,baseIdx+1);
   indices.push(baseIdx,baseIdx+2,baseIdx+3);
  }
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));
 g.setAttribute('color',new T.Float32BufferAttribute(c,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setIndex(indices);
 g.computeVertexNormals();
 return g;
}
