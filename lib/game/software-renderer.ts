import * as T from 'three';
import {heightAt,groundColor,waterLevel} from './world';
/** A reduced-detail CPU fallback for browsers without a WebGL context.
 * Uses the same simulation and animated skeletons. WebGL is the primary renderer.
 */
export class SoftwareRenderer {
 domElement=document.createElement('canvas');shadowMap={enabled:false,type:0};info={render:{calls:0}};outputColorSpace='';toneMapping=0;toneMappingExposure=1;
 private ctx:CanvasRenderingContext2D;private width=1;private height=1;private triangles:{a:number[];b:number[];c:number[];d:number;layer:number;color:string;alpha:number}[]=[];private vp=new T.Matrix4();private normal=new T.Vector3();private side=new T.Vector3();private sun=new T.Vector3(-.5,.8,-.4).normalize();private coarseGeometries=new Map<T.BufferGeometry,T.BufferGeometry>();private fog=new T.Color(0xa1c7d1);private eye=new T.Vector3();private w1=new T.Vector3();private w2=new T.Vector3();private w3=new T.Vector3();private clock=0;private ratio=1;private frustum=new T.Frustum();private fogDensity=.0032;
 constructor(){this.ctx=this.domElement.getContext('2d',{alpha:false})!;if(!this.ctx)throw new Error('Canvas rendering unavailable')}
 setPixelRatio(value:number){void value}setSize(w:number,h:number){this.ratio=Math.min(1,1050/Math.max(w,h));this.width=Math.round(w*this.ratio);this.height=Math.round(h*this.ratio);this.domElement.width=this.width;this.domElement.height=this.height;this.domElement.style.width=w+'px';this.domElement.style.height=h+'px'}
 private project(p:T.Vector3){const e=this.vp.elements,x=p.x,y=p.y,z=p.z,w=e[3]*x+e[7]*y+e[11]*z+e[15];if(w<.1)return null;return [((e[0]*x+e[4]*y+e[8]*z+e[12])/w*.5+.5)*this.width,(-(e[1]*x+e[5]*y+e[9]*z+e[13])/w*.5+.5)*this.height,w]}
 private triangle(a:T.Vector3,b:T.Vector3,c:T.Vector3,color:T.Color,unlit=false,alpha=1,clipped=false,doubleSide=false,waterSurface=false,waterClipped=false){
  const water=waterLevel(this.clock);
  // Intersecting objects are split at the water plane. A depth-sorted water tile
  // must never paint over a limb or lily pad that is actually above its surface.
  if(!waterClipped&&!waterSurface){const vertices=[a,b,c],height=vertices.map(v=>v.y-water);if(height.some(h=>h>0)&&height.some(h=>h<0)){for(const sign of [-1,1]){const poly:T.Vector3[]=[];for(let i=0;i<3;i++){const j=(i+2)%3,inside=height[i]*sign>=0,wasInside=height[j]*sign>=0;if(inside!==wasInside)poly.push(vertices[j].clone().lerp(vertices[i],-height[j]/(height[i]-height[j])));if(inside)poly.push(vertices[i])}for(let i=1;i<poly.length-1;i++)this.triangle(poly[0],poly[i],poly[i+1],color,unlit,alpha,clipped,doubleSide,false,true)}return}}
  if(!clipped){const v=[a,b,c],e=this.vp.elements,depth=(p:T.Vector3)=>e[3]*p.x+e[7]*p.y+e[11]*p.z+e[15],ds=v.map(depth);if(ds.some(d=>d<.11)){if(ds.every(d=>d<.11))return;const poly:T.Vector3[]=[];for(let i=0;i<3;i++){const prev=(i+2)%3,inside=ds[i]>=.11,wasInside=ds[prev]>=.11;if(inside!==wasInside)poly.push(v[prev].clone().lerp(v[i],(.12-ds[prev])/(ds[i]-ds[prev])));if(inside)poly.push(v[i].clone())}for(let i=1;i<poly.length-1;i++)this.triangle(poly[0],poly[i],poly[i+1],color,unlit,alpha,true,doubleSide,waterSurface,true);return}}
  const pa=this.project(a),pb=this.project(b),pc=this.project(c);if(!pa||!pb||!pc)return;if(Math.max(pa[0],pb[0],pc[0])<0||Math.min(pa[0],pb[0],pc[0])>this.width||Math.max(pa[1],pb[1],pc[1])<0||Math.min(pa[1],pb[1],pc[1])>this.height)return;
  const depth=(pa[2]+pb[2]+pc[2])/3;this.normal.copy(b).sub(a).cross(this.side.copy(c).sub(a)).normalize();if(!doubleSide&&this.normal.x*(a.x-this.eye.x)+this.normal.y*(a.y-this.eye.y)+this.normal.z*(a.z-this.eye.z)>=0)return;const light=unlit?1:.72+Math.abs(this.normal.dot(this.sun))*.3,rgb=color.clone().multiplyScalar(light),fog=clampFog(1-Math.exp(-depth*this.fogDensity));rgb.lerp(this.fog,fog);this.triangles.push({a:pa,b:pb,c:pc,d:depth,layer:waterSurface?1:(((a.y+b.y+c.y)/3>water)===(this.eye.y>water)?2:0),color:rgb.getStyle(),alpha});
 }
 private terrain(camera:T.Camera){
  const cx=Math.floor(camera.position.x/24)*24,cz=Math.floor(camera.position.z/24)*24,water=waterLevel(this.clock),c=new T.Color();
  // Exactly adjacent grids prevent overlapping shore triangles.
  for(const step of [24,6,1.5]){const extent=step===1.5?24:16;for(let ix=-extent;ix<extent;ix++)for(let iz=-extent;iz<extent;iz++){
   if(step===24&&ix>=-4&&ix<4&&iz>=-4&&iz<4)continue;
   if(step===6&&ix>=-6&&ix<6&&iz>=-6&&iz<6)continue;
   const x=cx+ix*step,z=cz+iz*step,h=[heightAt(x,z),heightAt(x+step,z),heightAt(x+step,z+step),heightAt(x,z+step)],avg=h.reduce((a,b)=>a+b,0)/4;
   const points=[new T.Vector3(x,h[0],z),new T.Vector3(x+step,h[1],z),new T.Vector3(x+step,h[2],z+step),new T.Vector3(x,h[3],z+step)];
   c.copy(groundColor(avg,x,z));if(avg<0)c.set(0x607759);this.triangle(points[0],points[3],points[1],c);this.triangle(points[1],points[3],points[2],c);
   const poly:T.Vector3[]=[];for(let i=0;i<4;i++){const j=(i+3)%4,inside=h[i]<=water,prev=h[j]<=water;if(inside!==prev){const p=points[j].clone().lerp(points[i],(water-h[j])/(h[i]-h[j]));p.y=water;poly.push(p)}if(inside)poly.push(new T.Vector3(points[i].x,water,points[i].z))}
   if(poly.length>=3){const wave=Math.sin(x*.18+z*.24+this.clock)*.012,depth=Math.max(0,water-avg);c.set(depth<2?0x427e73:0x347e81);c.offsetHSL(0,0,wave);for(let i=1;i<poly.length-1;i++)this.triangle(poly[0],poly[i+1],poly[i],c,true,.62,false,true,true)}
  }}
 }
 render(scene:T.Scene,camera:T.Camera){
  scene.updateMatrixWorld();camera.updateMatrixWorld();this.vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.vp);this.eye.copy(camera.position);this.fog.copy((scene.fog as T.FogExp2)?.color??new T.Color(0xa1c7d1));this.fogDensity=(scene.fog as T.FogExp2)?.density??.0032;this.triangles.length=0;
  scene.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.update();if(o instanceof T.Mesh&&o.material instanceof T.ShaderMaterial&&o.material.uniforms.time)this.clock=o.material.uniforms.time.value});
  const ctx=this.ctx,sky=ctx.createLinearGradient(0,0,0,this.height);sky.addColorStop(0,this.eye.y<waterLevel(this.clock)?'#25665d':'#72b4cb');sky.addColorStop(.6,this.fog.getStyle());sky.addColorStop(1,this.eye.y<waterLevel(this.clock)?'#163c37':'#b7d9d1');ctx.fillStyle=sky;ctx.fillRect(0,0,this.width,this.height);this.terrain(camera);
  let calls=0;const mat=new T.Matrix4(),instance=new T.Matrix4(),center=new T.Vector3(),instanceColor=new T.Color(),base=new T.Color(),faceColor=new T.Color();
  scene.traverse(o=>{
   if(!(o instanceof T.Mesh)||!o.visible||o.userData.softwareIgnore)return;let parent=o.parent;while(parent){if(!parent.visible)return;parent=parent.parent}
   if(o instanceof T.InstancedMesh&&!this.frustum.intersectsObject(o))return;let geo=o.geometry;if(o.material instanceof T.ShaderMaterial||geo instanceof T.RingGeometry)return;
   if(geo instanceof T.SphereGeometry||geo instanceof T.IcosahedronGeometry||geo instanceof T.CylinderGeometry){let coarse=this.coarseGeometries.get(geo);if(!coarse){if(geo instanceof T.SphereGeometry)coarse=new T.SphereGeometry(geo.parameters.radius,9,6);else if(geo instanceof T.IcosahedronGeometry)coarse=new T.IcosahedronGeometry(geo.parameters.radius,0);else if(geo instanceof T.ConeGeometry)coarse=new T.ConeGeometry(geo.parameters.radius,geo.parameters.height,5);else coarse=new T.CylinderGeometry(geo.parameters.radiusTop,geo.parameters.radiusBottom,geo.parameters.height,5);this.coarseGeometries.set(geo,coarse)}geo=coarse}
   const material=(Array.isArray(o.material)?o.material[0]:o.material) as T.MeshStandardMaterial,positions=geo.attributes.position,colors=geo.attributes.color,indices=geo.index,count=o instanceof T.InstancedMesh?o.count:1,total=indices?.count??positions.count;
   for(let n=0;n<count;n++){
    if(o instanceof T.InstancedMesh){o.getMatrixAt(n,instance);mat.multiplyMatrices(o.matrixWorld,instance)}else mat.copy(o.matrixWorld);
    center.setFromMatrixPosition(mat);const dist=center.distanceTo(camera.position);if(dist>210||this.project(center)===null)continue;
    // Leaf/grass instances retain nearby density and progressively thin in the distance.
    if(o instanceof T.InstancedMesh){const foliage=positions.count<15,skip=foliage?(dist>110?16:dist>55?6:dist>25?3:1):dist>100?3:1;if(n%skip!==0)continue}
    calls++;base.copy(material.color??new T.Color(0xaaaaaa));if(o instanceof T.InstancedMesh&&o.instanceColor){o.getColorAt(n,instanceColor);base.multiply(instanceColor)}
    for(let i=0;i+2<total;i+=3){const ia=indices?indices.getX(i):i,ib=indices?indices.getX(i+1):i+1,ic=indices?indices.getX(i+2):i+2;
     if(o instanceof T.SkinnedMesh){o.getVertexPosition(ia,this.w1);o.getVertexPosition(ib,this.w2);o.getVertexPosition(ic,this.w3)}else{this.w1.fromBufferAttribute(positions,ia);this.w2.fromBufferAttribute(positions,ib);this.w3.fromBufferAttribute(positions,ic)}
     this.w1.applyMatrix4(mat);this.w2.applyMatrix4(mat);this.w3.applyMatrix4(mat);faceColor.copy(base);
     if(colors&&material.vertexColors){instanceColor.setRGB((colors.getX(ia)+colors.getX(ib)+colors.getX(ic))/3,(colors.getY(ia)+colors.getY(ib)+colors.getY(ic))/3,(colors.getZ(ia)+colors.getZ(ib)+colors.getZ(ic))/3);faceColor.multiply(instanceColor)}
     this.triangle(this.w1,this.w2,this.w3,faceColor,material instanceof T.MeshBasicMaterial,material.transparent?material.opacity:1,false,material.side===T.DoubleSide);
    }
   }
  });
  this.triangles.sort((a,b)=>a.layer-b.layer||b.d-a.d);for(const t of this.triangles){ctx.globalAlpha=t.alpha;ctx.fillStyle=t.color;ctx.beginPath();ctx.moveTo(t.a[0],t.a[1]);ctx.lineTo(t.b[0],t.b[1]);ctx.lineTo(t.c[0],t.c[1]);ctx.closePath();ctx.fill();ctx.strokeStyle=t.color;ctx.lineWidth=.4;ctx.stroke()}ctx.globalAlpha=1;this.info.render.calls=calls;
 }
 dispose(){this.triangles.length=0;this.coarseGeometries.forEach(g=>g.dispose());this.coarseGeometries.clear();this.domElement.width=1;this.domElement.height=1}
}
function clampFog(v:number){return T.MathUtils.clamp(v,0,.96)}
