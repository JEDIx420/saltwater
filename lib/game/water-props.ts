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

export function seagrassGeometry(){
 const p:number[]=[],c:number[]=[],uv:number[]=[],indices:number[]=[];
 let vertCount=0;
 const blades=[
  {yaw:0,scale:1.8,lean:0.28,width:0.12},
  {yaw:2.1,scale:2.2,lean:0.35,width:0.10},
  {yaw:4.2,scale:1.5,lean:0.22,width:0.11}
 ];
 for(const b of blades){
  const segs=5,baseIdx=vertCount;
  const cosY=Math.cos(b.yaw),sinY=Math.sin(b.yaw);
  const perpX=-sinY*b.width,perpZ=cosY*b.width;
  for(let i=0;i<=segs;i++){
   const t=i/segs,y=t*b.scale;
   const arch=Math.pow(t,1.6)*b.lean*b.scale;
   const wave=Math.sin(t*Math.PI)*0.08;
   const cx=cosY*arch+sinY*wave,cz=sinY*arch-cosY*wave;
   const col=[0.08+t*0.16,0.32+t*0.42,0.18+t*0.16];
   const w=1-t*0.7;
   p.push(cx-perpX*w,y,cz-perpZ*w);c.push(...col);uv.push(0,t);
   p.push(cx+perpX*w,y,cz+perpZ*w);c.push(...col);uv.push(1,t);
   vertCount+=2;
   if(i>0){
    const curr=baseIdx+i*2,prev=curr-2;
    indices.push(prev,prev+1,curr,curr,prev+1,curr+1);
    indices.push(prev,curr,prev+1,curr,curr+1,prev+1);
   }
  }
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));
 g.setAttribute('color',new T.Float32BufferAttribute(c,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setIndex(indices);g.computeVertexNormals();return g;
}

export function coralGeometry(){
 const p:number[]=[],c:number[]=[],uv:number[]=[],indices:number[]=[];
 let vertCount=0;
 const arms=[
  {x:0,z:0,h:0.95,r:0.16,leanX:0,leanZ:0},
  {x:0.18,z:0.14,h:0.75,r:0.13,leanX:0.15,leanZ:0.12},
  {x:-0.16,z:0.15,h:0.82,r:0.14,leanX:-0.14,leanZ:0.14},
  {x:-0.18,z:-0.15,h:0.68,r:0.12,leanX:-0.16,leanZ:-0.12},
  {x:0.16,z:-0.16,h:0.88,r:0.14,leanX:0.14,leanZ:-0.15}
 ];
 for(const arm of arms){
  const sides=6,heightSegs=4,baseIdx=vertCount;
  for(let j=0;j<=heightSegs;j++){
   const t=j/heightSegs,y=t*arm.h;
   const rx=arm.x+t*arm.leanX,rz=arm.z+t*arm.leanZ;
   const rad=arm.r*(j===heightSegs?0.35:(1-t*0.25));
   const col=[0.95,0.45+t*0.25,0.35+t*0.35];
   for(let s=0;s<=sides;s++){
    const a=(s/sides)*Math.PI*2;
    p.push(rx+Math.cos(a)*rad,y,rz+Math.sin(a)*rad);c.push(...col);uv.push(s/sides,t);
    vertCount++;
   }
  }
  for(let j=0;j<heightSegs;j++){
   for(let s=0;s<sides;s++){
    const i0=baseIdx+j*(sides+1)+s,i1=i0+1,i2=i0+(sides+1),i3=i2+1;
    indices.push(i0,i2,i1,i1,i2,i3);
   }
  }
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));
 g.setAttribute('color',new T.Float32BufferAttribute(c,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setIndex(indices);g.computeVertexNormals();return g;
}

export function fanCoralGeometry(){
 const p:number[]=[],c:number[]=[],uv:number[]=[],indices:number[]=[];
 let vertCount=0;
 p.push(0,0,0);c.push(0.65,0.25,0.65);uv.push(0.5,0);
 const stemIdx=vertCount++,segs=14;
 for(let ring=1;ring<=3;ring++){
  const t=ring/3,r=t*0.95;
  for(let i=0;i<=segs;i++){
   const a=0.2+(Math.PI-0.4)*(i/segs);
   const waveZ=Math.sin(a*7)*0.08*t,x=Math.cos(a)*r,y=Math.sin(a)*r;
   p.push(x,y,waveZ);c.push(0.85+t*0.1,0.25+t*0.35,0.7+(1-t)*0.25);uv.push(i/segs,t);
   vertCount++;
  }
 }
 for(let i=0;i<segs;i++){
  indices.push(stemIdx,stemIdx+1+i,stemIdx+2+i,stemIdx,stemIdx+2+i,stemIdx+1+i);
 }
 for(let ring=1;ring<3;ring++){
  const r0=1+(ring-1)*(segs+1),r1=1+ring*(segs+1);
  for(let i=0;i<segs;i++){
   indices.push(r0+i,r1+i,r0+i+1,r0+i+1,r1+i,r1+i+1);
   indices.push(r0+i,r0+i+1,r1+i,r0+i+1,r1+i+1,r1+i);
  }
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));
 g.setAttribute('color',new T.Float32BufferAttribute(c,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setIndex(indices);g.computeVertexNormals();return g;
}

export function tubeSpongeGeometry(){
 const p:number[]=[],c:number[]=[],uv:number[]=[],indices:number[]=[];
 let vertCount=0;
 const tubes=[
  {x:0,z:0,h:0.85,r:0.14,tiltX:0.05,tiltZ:0},
  {x:0.15,z:0.12,h:0.65,r:0.11,tiltX:0.12,tiltZ:0.08},
  {x:-0.14,z:0.08,h:0.52,r:0.10,tiltX:-0.1,tiltZ:0.06}
 ];
 for(const tube of tubes){
  const sides=8,segs=3,baseIdx=vertCount;
  for(let j=0;j<=segs;j++){
   const t=j/segs,y=t*tube.h;
   const cx=tube.x+t*tube.tiltX,cz=tube.z+t*tube.tiltZ;
   const rad=tube.r*(0.85+Math.sin(t*Math.PI)*0.25);
   const col=[0.18+t*0.45,0.52+(1-t)*0.25,0.75+t*0.2];
   for(let s=0;s<=sides;s++){
    const a=(s/sides)*Math.PI*2;
    p.push(cx+Math.cos(a)*rad,y,cz+Math.sin(a)*rad);c.push(...col);uv.push(s/sides,t);
    vertCount++;
   }
  }
  for(let j=0;j<segs;j++){
   for(let s=0;s<sides;s++){
    const i0=baseIdx+j*(sides+1)+s,i1=i0+1,i2=i0+(sides+1),i3=i2+1;
    indices.push(i0,i2,i1,i1,i2,i3);
    indices.push(i0,i1,i2,i1,i3,i2);
   }
  }
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));
 g.setAttribute('color',new T.Float32BufferAttribute(c,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setIndex(indices);g.computeVertexNormals();return g;
}
