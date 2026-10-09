import * as T from 'three';
import {mergeRigid} from './batching';
const sphere=new T.SphereGeometry(1,18,12);
const black=new T.MeshStandardMaterial({color:0x111d18,roughness:.2});
export function mesh(parent:T.Object3D,geo:T.BufferGeometry,mat:T.Material,pos:number[],scale:number[]=[1,1,1]){const m=new T.Mesh(geo,mat);m.position.set(pos[0],pos[1],pos[2]);m.scale.set(scale[0],scale[1],scale[2]);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function ell(parent:T.Object3D,mat:T.Material,p:number[],s:number[]){return mesh(parent,sphere,mat,p,s)}
type Profile=[z:number,width:number,height:number,center:number];
function profileGeometry(profiles:Profile[],sides=24,density=3){const p:number[]=[],uv:number[]=[],color:number[]=[],index:number[]=[];let rings=0;const dark=new T.Color(0x626b41),light=new T.Color(0xc2b78b);for(let i=0;i<profiles.length-1;i++)for(let k=0;k<density;k++){const t=k/density,a=profiles[i],b=profiles[i+1],z=T.MathUtils.lerp(a[0],b[0],t),w=T.MathUtils.lerp(a[1],b[1],t),h=T.MathUtils.lerp(a[2],b[2],t),cy=T.MathUtils.lerp(a[3],b[3],t);for(let j=0;j<=sides;j++){const angle=j/sides*Math.PI*2,sy=Math.sin(angle);p.push(Math.cos(angle)*w,cy+sy*h,z);uv.push(j/sides,(z-profiles[0][0])/(profiles.at(-1)![0]-profiles[0][0]));const c=dark.clone().lerp(light,T.MathUtils.smoothstep(-sy,-.1,.8));const pattern=.87+.13*Math.sin(j*1.83+i*3.1+k*.5);c.multiplyScalar(pattern);color.push(c.r,c.g,c.b)}rings++}const last=profiles.at(-1)!;for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2;p.push(Math.cos(a)*last[1],last[3]+Math.sin(a)*last[2],last[0]);uv.push(j/sides,1);color.push(dark.r,dark.g,dark.b)}rings++;for(let i=0;i<rings-1;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;index.push(a,a+1,b,b,a+1,b+1)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setIndex(index);g.computeVertexNormals();return g}
function curveTube(parent:T.Object3D,mat:T.Material,points:number[][],radius:number){const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number])));return mesh(parent,new T.TubeGeometry(path,12,radius,6,false),mat,[0,0,0])}
import {crocodile} from './crocodile';
export {crocodile};
function finGeometry(points:number[][]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));const index=[];for(let i=1;i<points.length-1;i++)index.push(0,i,i+1);g.setIndex(index);g.computeVertexNormals();return g}
export function fish(species=0){const g=new T.Group(),silver=new T.MeshStandardMaterial({color:species%2?0xd0b98a:0x9db8ac,vertexColors:true,roughness:.4,metalness:.12});const body=profileGeometry([[-.79,.006,.015,0],[-.63,.11,.16,0],[-.32,.2,.29,0],[.05,.22,.31,0],[.39,.12,.19,0],[.64,.048,.07,0],[.74,.025,.04,0]],14,2);const colors=body.attributes.color;for(let i=0;i<colors.count;i++){const y=body.attributes.position.getY(i),c=new T.Color(y>0?0x557b75:0xd3decb);if(species%2)c.set(y>0?0x806b45:0xe0ce9a);c.multiplyScalar(.85+.15*Math.sin(i*.73));colors.setXYZ(i,c.r,c.g,c.b)}mesh(g,body,silver,[0,0,0]);const fins=new T.MeshStandardMaterial({color:species%2?0xaa854d:0x76958b,side:T.DoubleSide,transparent:true,opacity:.88,roughness:.6});const tail=new T.Group();tail.position.z=.65;g.add(tail);mesh(tail,finGeometry([[0,0,0],[0,.32,.4],[0,.12,.27],[0,-.02,.29],[0,-.28,.4]]),fins,[0,0,0]);const dorsal=mesh(g,finGeometry([[0,.15,-.33],[0,.48,-.1],[0,.35,.33],[0,.14,.4]]),fins,[0,0,0]);for(const side of [-1,1]){ell(g,black,[side*.126,.065,-.5],[.04,.041,.041]);const iris=new T.MeshStandardMaterial({color:0xd7c882,roughness:.3});ell(g,iris,[side*.151,.066,-.5],[.017,.025,.025]);mesh(g,finGeometry([[0,0,0],[side*.31,-.08,.2],[side*.18,.02,.34]]),fins,[side*.16,-.01,-.27]);curveTube(g,new T.MeshStandardMaterial({color:0x476b62,roughness:.7}),[[side*.15,.15,-.31],[side*.192,0,-.28],[side*.13,-.18,-.28]],.012)}const rigid=mergeRigid(g,[dorsal]);g.scale.setScalar(species%3===2?.58:species%3===1?.84:1);g.userData.animate=(time:number,speed:number)=>{tail.rotation.y=Math.sin(time*(speed>1?10:5))*.4;dorsal.rotation.z=Math.sin(time*2)*.045;if(rigid)rigid.rotation.y=Math.sin(time*5)*.025};return g}
export function crab(){const g=new T.Group(),m=new T.MeshStandardMaterial({color:0xa97446,roughness:.76}),light=new T.MeshStandardMaterial({color:0xce9566,roughness:.8});ell(g,m,[0,.22,0],[.36,.18,.29]);const legs:T.Group[]=[];for(const side of [-1,1]){for(let j=0;j<4;j++){const l=new T.Group();l.position.set(side*.26,.15,(j-1.5)*.135);g.add(l);curveTube(l,m,[[0,0,0],[side*.26,-.04,.02],[side*.4,-.14,.05]],.028);legs.push(l)}for(const z of [-.2,-.13]){ell(g,black,[side*.12,.39,z],[.024,.05,.024])}curveTube(g,m,[[side*.22,.18,-.18],[side*.4,.22,-.34],[side*.5,.24,-.44]],.047);ell(g,light,[side*.5,.24,-.49],[.12,.105,.18]);ell(g,m,[side*.57,.25,-.6],[.044,.055,.13])}mergeRigid(g);g.userData.animate=(time:number,speed:number)=>{legs.forEach((l,i)=>{l.rotation.y=Math.sin(time*9+i)*.14*Math.min(speed*4,1)})};return g}
export function buffalo(){const g=new T.Group(),m=new T.MeshStandardMaterial({color:0x544e43,roughness:.93}),hornMat=new T.MeshStandardMaterial({color:0xa69a7b,roughness:.7});ell(g,m,[0,1.23,0],[.68,.77,1.18]);ell(g,m,[0,1.58,-.5],[.54,.4,.65]);const head=new T.Group();head.position.set(0,1.3,-.91);g.add(head);g.userData.head=head;ell(head,m,[0,0,-.19],[.4,.44,.5]);ell(head,m,[0,-.2,-.5],[.36,.25,.35]);const legs:T.Group[]=[];for(const side of [-1,1]){ell(head,m,[side*.44,.15,-.15],[.3,.12,.18]);curveTube(head,hornMat,[[side*.29,.3,-.17],[side*.63,.41,-.22],[side*.92,.33,-.18],[side*.98,.57,-.08],[side*.8,.71,.02]],.06);ell(head,black,[side*.34,.08,-.45],[.034,.038,.038]);ell(head,black,[side*.2,-.21,-.79],[.058,.031,.035]);for(const z of [-.68,.78]){const l=new T.Group();l.position.set(side*.43,.84,z);g.add(l);ell(l,m,[0,-.11,.03],[.18,.44,.2]);mesh(l,new T.CylinderGeometry(.092,.071,.51,9),m,[0,-.58,.07]);ell(l,black,[0,-.79,.04],[.14,.09,.21]);legs.push(l)}}const tail=curveTube(g,m,[[0,1.27,.93],[.04,.8,1.2],[.05,.55,1.24]],.038);ell(g,m,[.05,.51,1.25],[.09,.14,.08]);mergeRigid(head);legs.forEach(l=>mergeRigid(l));mergeRigid(g,[tail]);g.userData.animate=(time:number,speed:number,drinking=false,swimming=false,struggling=false)=>{if(struggling){legs.forEach((l,i)=>l.rotation.x=Math.sin(time*16+i*2.6)*.75);head.rotation.y=Math.sin(time*14)*.45;head.rotation.x=Math.sin(time*11)*.3;tail.rotation.z=Math.sin(time*18)*.35;}else{legs.forEach((l,i)=>l.rotation.x=Math.sin(time*(swimming?7.5:5)+(i===0||i===3?0:Math.PI))*(swimming?.45:.34)*Math.min(speed,1));head.rotation.x=drinking?.54:(swimming?-.22:(Math.sin(time*1.1)*.05+(speed>2?.1:0)));head.rotation.y=0;tail.rotation.z=Math.sin(time*2)*.08;}};return g}
export function bird(){const g=new T.Group(),mat=new T.MeshStandardMaterial({color:0xe2e2d0,side:T.DoubleSide,roughness:.8});ell(g,mat,[0,0,0],[.11,.09,.31]);const left=mesh(g,finGeometry([[0,0,0],[-.75,.01,.16],[-.28,0,.38]]),mat,[-.08,0,0]);const right=mesh(g,finGeometry([[0,0,0],[.75,.01,.16],[.28,0,.38]]),mat,[.08,0,0]);g.userData.animate=(time:number)=>{left.rotation.z=Math.sin(time*4)*.42;right.rotation.z=-Math.sin(time*4)*.42};return g}

export function monkey(){
 const g=new T.Group();
 const fur=new T.MeshStandardMaterial({color:0x694e35,roughness:.88});
 const muzzleMat=new T.MeshStandardMaterial({color:0xbda48a,roughness:.8});
 ell(g,fur,[0,.62,0],[.24,.32,.22]);
 ell(g,fur,[0,.94,-.12],[.19,.22,.18]);
 const head=new T.Group();head.position.set(0,1.15,-.18);g.add(head);
 ell(head,fur,[0,0,0],[.16,.15,.15]);
 ell(head,muzzleMat,[0,-.04,-.12],[.11,.09,.11]);
 for(const side of [-1,1]){
  ell(head,black,[side*.07,.04,-.11],[.026,.026,.026]);
  ell(head,muzzleMat,[side*.17,.04,-.02],[.05,.06,.025]);
 }
 const limbs:T.Group[]=[];
 for(const side of [-1,1]){
  const arm=new T.Group();arm.position.set(side*.22,.92,-.08);g.add(arm);
  curveTube(arm,fur,[[0,0,0],[side*.12,-.28,-.05],[side*.1,-.55,.05]],.042);
  limbs.push(arm);
  const leg=new T.Group();leg.position.set(side*.18,.45,.08);g.add(leg);
  curveTube(leg,fur,[[0,0,0],[side*.14,-.22,.1],[side*.08,-.44,.05]],.048);
  limbs.push(leg);
 }
 const tail=curveTube(g,fur,[[0,.42,.18],[.05,.55,.45],[.08,.85,.6],[.02,1.05,.52],[-.05,1.15,.38]],.035);
 g.userData.animate=(time:number,speed:number,alarmed=false,struggling=false)=>{
  if(struggling){
   head.rotation.y=Math.sin(time*18)*.6;head.rotation.x=Math.sin(time*15)*.4;
   limbs.forEach((l,i)=>l.rotation.x=Math.sin(time*20+i)*.9);
   tail.rotation.z=Math.sin(time*15)*.4;
  }else if(alarmed){
   head.rotation.y=Math.sin(time*12)*.5;head.rotation.x=-.2+Math.abs(Math.sin(time*10))*.3;
   limbs[0].rotation.x=Math.sin(time*14)*.7;limbs[1].rotation.x=-Math.sin(time*14)*.7;
   tail.rotation.y=Math.sin(time*10)*.5;
  }else{
   head.rotation.y=Math.sin(time*1.2)*.18;head.rotation.x=Math.sin(time*1.5)*.06;
   limbs.forEach((l,i)=>l.rotation.x=Math.sin(time*5+i*Math.PI*.5)*.4*Math.min(speed,1));
   tail.rotation.z=Math.sin(time*2.5)*.12;
  }
 };
 return g;
}

export function bigSnake(){
 const g=new T.Group();
 const skinMat=new T.MeshStandardMaterial({color:0x344b2f,roughness:.65,metalness:.08});
 const bellyMat=new T.MeshStandardMaterial({color:0xa6aa72,roughness:.72});
 const eyeMat=new T.MeshStandardMaterial({color:0xdfb428,roughness:.3});
 const redMat=new T.MeshStandardMaterial({color:0xb42828,roughness:.4});
 const head=new T.Group();head.position.set(0,.35,-2.2);g.add(head);
 ell(head,skinMat,[0,0,0],[.22,.14,.38]);
 ell(head,bellyMat,[0,-.08,0],[.18,.06,.32]);
 for(const side of [-1,1]){
  ell(head,eyeMat,[side*.14,.05,-.06],[.045,.04,.04]);
  ell(head,black,[side*.165,.05,-.06],[.018,.032,.018]);
 }
 const tongue=curveTube(head,redMat,[[0,-.04,-.32],[0,-.04,-.52],[.03,-.04,-.62]],.012);
 curveTube(head,redMat,[[0,-.04,-.52],[-.03,-.04,-.62]],.012);
 const bodyNodes:T.Mesh[]=[];
 const segCount=16;
 for(let i=0;i<segCount;i++){
  const t=i/(segCount-1);
  const z=-1.8+i*.38;
  const radius=.24*(1-t*.55);
  const seg=ell(g,skinMat,[0,.22,z],[radius,radius*.85,radius*1.2]);
  bodyNodes.push(seg);
 }
 g.userData.animate=(time:number,speed:number,striking=false)=>{
  tongue.position.z=Math.sin(time*12)*.08;
  if(striking){
   head.position.set(0,.55,-2.7);
   head.rotation.x=-.35;
  }else{
   head.position.x=Math.sin(time*4.5)*.32;
   head.position.y=.35+Math.sin(time*2.2)*.08;
   head.rotation.y=Math.cos(time*4.5)*.28;
   head.rotation.x=0;
  }
  bodyNodes.forEach((node,i)=>{
   const wave=Math.sin(time*4-i*.55);
   node.position.x=wave*(.38+i*.02);
   node.position.y=.22+Math.abs(Math.sin(time*2-i*.3))*.04;
  });
 };
 return g;
}

export function fishEagle(){
 const g=new T.Group();
 const brown=new T.MeshStandardMaterial({color:0x3e2c1e,roughness:.85});
 const white=new T.MeshStandardMaterial({color:0xf5f5ef,roughness:.75});
 const yellow=new T.MeshStandardMaterial({color:0xdfa024,roughness:.4});
 ell(g,brown,[0,0,0],[.22,.2,.48]);
 const head=new T.Group();head.position.set(0,.18,-.44);g.add(head);
 ell(head,white,[0,0,0],[.15,.16,.2]);
 mesh(head,new T.ConeGeometry(.06,.24,6),yellow,[0,-.04,-.22],[-1.75,0,0]);
 for(const side of [-1,1])ell(head,black,[side*.11,.05,-.06],[.026,.026,.026]);
 const leftWing=new T.Group();leftWing.position.set(-.18,.08,-.05);g.add(leftWing);
 mesh(leftWing,finGeometry([[0,0,0],[-1.6,-.04,.35],[-.6,-.02,.65]]),brown,[0,0,0]);
 const rightWing=new T.Group();rightWing.position.set(.18,.08,-.05);g.add(rightWing);
 mesh(rightWing,finGeometry([[0,0,0],[1.6,-.04,.35],[.6,-.02,.65]]),brown,[0,0,0]);
 const tail=mesh(g,finGeometry([[0,0,0],[-.32,0,.55],[.32,0,.55]]),white,[0,.02,.44]);
 g.userData.animate=(time:number,banking=0)=>{
  const flap=Math.sin(time*5.5);
  leftWing.rotation.z=flap*.52+banking*.3;
  rightWing.rotation.z=-flap*.52+banking*.3;
  tail.rotation.x=Math.sin(time*2)*.08;
 };
 return g;
}

export function rivalCroc(){const c=crocodile('rival');c.root.scale.set(1.22,1.18,1.2);return c}

export function bullShark(){
 const g=new T.Group(),m=new T.MeshStandardMaterial({color:0x3b4751,roughness:.38,metalness:.12}),bellyMat=new T.MeshStandardMaterial({color:0xd8dfe2,roughness:.48});
 const finMat=new T.MeshStandardMaterial({color:0x303c44,side:T.DoubleSide,roughness:.42});
 const toothMat=new T.MeshStandardMaterial({color:0xeeeade,roughness:.4});
 const body=profileGeometry([[-2.3,.06,.06,0],[-1.85,.32,.28,-.02],[-1.1,.62,.55,-.02],[0,.68,.62,0],[.95,.48,.44,.02],[1.85,.24,.22,0],[2.4,.08,.08,0]],18,3);
 mesh(g,body,m,[0,0,0]);
 ell(g,bellyMat,[0,-.24,-.12],[.58,.26,1.15]);
 const dorsal=mesh(g,finGeometry([[0,.5,-.35],[0,1.38,.12],[0,.5,.65],[0,.5,.15]]),finMat,[0,0,0]);
 const secondDorsal=mesh(g,finGeometry([[0,.18,1.2],[0,.52,1.42],[0,.18,1.55]]),finMat,[0,0,0]);
 const tail=new T.Group();tail.position.set(0,0,2.15);g.add(tail);
 mesh(tail,finGeometry([[0,0,0],[0,1.15,.62],[0,.3,.45],[0,-.55,.58],[0,-.18,.25]]),finMat,[0,0,0]);
 for(const side of [-1,1]){
  mesh(g,finGeometry([[0,0,0],[side*1.15,-.35,.5],[side*.42,-.08,.82]]),finMat,[side*.48,-.22,-.65]);
  mesh(g,finGeometry([[0,0,0],[side*.46,-.22,.3],[side*.16,-.06,.45]]),finMat,[side*.32,-.26,.88]);
  ell(g,black,[side*.32,.12,-1.65],[.052,.052,.052]);
  for(let t=0;t<5;t++){
   mesh(g,new T.ConeGeometry(.022,.08,4),toothMat,[side*(.22-t*.03),-.18,-1.7+t*.07],[Math.PI,0,0]);
  }
 }
 mergeRigid(g,[dorsal,secondDorsal]);
 g.scale.set(1.4,1.35,1.45);
 g.userData.animate=(time:number,speed:number,attack=false)=>{
  const cadence=attack?11:speed>1?7.5:4.2;
  tail.rotation.y=Math.sin(time*cadence)*.46;
  dorsal.rotation.z=Math.sin(time*2.5)*.045;
  g.rotation.z=Math.sin(time*3)*.04+(attack?Math.sin(time*12)*.08:0);
 };
 return g;
}

export function hippo(){
 const g=new T.Group(),m=new T.MeshStandardMaterial({color:0x464240,roughness:.92}),bellyMat=new T.MeshStandardMaterial({color:0x705c58,roughness:.85});
 const tuskMat=new T.MeshStandardMaterial({color:0xdcd3b8,roughness:.6}),mouthMat=new T.MeshStandardMaterial({color:0x875558,roughness:.75});
 ell(g,m,[0,1.26,0],[.86,.92,1.45]);
 ell(g,bellyMat,[0,.85,0],[.78,.65,1.25]);
 const head=new T.Group();head.position.set(0,1.28,-1.25);g.add(head);
 ell(head,m,[0,.12,-.32],[.52,.5,.58]);
 ell(head,m,[0,-.16,-.8],[.52,.38,.5]);
 ell(head,mouthMat,[0,-.28,-.78],[.4,.15,.38]);
 curveTube(head,tuskMat,[[-.35,-.28,-.68],[-.34,.05,-.72]],.045);
 curveTube(head,tuskMat,[[.35,-.28,-.68],[.34,.05,-.72]],.045);
 for(const side of [-1,1]){
  ell(head,m,[side*.38,.42,-.1],[.1,.13,.06]);
  ell(head,black,[side*.36,.31,-.38],[.04,.042,.042]);
  ell(head,m,[side*.25,.1,-1.18],[.12,.08,.09]);
 }
 const legs:T.Group[]=[];
 for(const side of [-1,1]){
  for(const z of [-.75,.85]){
   const l=new T.Group();l.position.set(side*.52,.88,z);g.add(l);
   ell(l,m,[0,-.12,0],[.25,.46,.27]);
   mesh(l,new T.CylinderGeometry(.15,.18,.55,9),m,[0,-.58,0]);
   ell(l,black,[0,-.84,0],[.19,.1,.24]);
   legs.push(l);
  }
 }
 const tail=curveTube(g,m,[[0,1.25,1.4],[0,.9,1.55]],.045);
 mergeRigid(head);legs.forEach(l=>mergeRigid(l));mergeRigid(g,[tail]);
 g.userData.animate=(time:number,speed:number,threat=false,attacking=false)=>{
  legs.forEach((l,i)=>l.rotation.x=Math.sin(time*(attacking?7.5:4.8)+(i===0||i===3?0:Math.PI))*.4*Math.min(speed,1));
  head.rotation.x=attacking?-.65:threat?-.42:Math.sin(time*1.2)*.06+(speed>1.5?.15:0);
  tail.rotation.z=Math.sin(time*3)*.1;
 };
 return g;
}

export function plover(){
 const g=new T.Group();
 const peach=new T.MeshStandardMaterial({color:0xd9ab7e,roughness:.8});
 const slate=new T.MeshStandardMaterial({color:0x4d5b66,roughness:.75});
 const white=new T.MeshStandardMaterial({color:0xedeae1,roughness:.8});
 const dark=new T.MeshStandardMaterial({color:0x1b1f22,roughness:.6});
 ell(g,peach,[0,0,0],[.09,.08,.16]);
 ell(g,slate,[0,.03,.02],[.085,.055,.14]);
 const head=new T.Group();head.position.set(0,.07,-.12);g.add(head);
 ell(head,dark,[0,0,0],[.05,.055,.07]);
 ell(head,white,[0,.01,-.01],[.052,.02,.07]);
 mesh(head,new T.ConeGeometry(.016,.14,5),dark,[0,-.01,-.1],[-1.57,0,0]);
 const wings:T.Mesh[]=[];
 for(const side of [-1,1]){
  const w=mesh(g,finGeometry([[0,0,0],[side*.22,.02,.08],[side*.04,-.02,.2]]),slate,[side*.08,.02,-.04]);
  wings.push(w);
  mesh(g,new T.CylinderGeometry(.006,.006,.11,5),dark,[side*.04,-.11,0]);
 }
 g.scale.setScalar(.45);
 g.userData.animate=(time:number,pecking=false,flying=false)=>{
  head.rotation.x=pecking?Math.abs(Math.sin(time*14))*.5:Math.sin(time*2)*.08;
  if(flying){
   wings[0].rotation.z=Math.sin(time*22)*.7;
   wings[1].rotation.z=-Math.sin(time*22)*.7;
  }else{
   wings[0].rotation.z=0;wings[1].rotation.z=0;
   g.position.y+=pecking?Math.abs(Math.sin(time*7))*.01:0;
  }
 };
 return g;
}

export function wadingBird(){
 const g=new T.Group();
 const white=new T.MeshStandardMaterial({color:0xf3f4ee,roughness:.75,side:T.DoubleSide});
 const yellow=new T.MeshStandardMaterial({color:0xdea328,roughness:.5});
 const dark=new T.MeshStandardMaterial({color:0x22261e,roughness:.9});
 ell(g,white,[0,.82,0],[.16,.18,.38]);
 const neck=curveTube(g,white,[[0,.85,-.2],[0,1.15,-.24],[0,1.42,-.18],[0,1.6,-.26]],.042);
 const head=new T.Group();head.position.set(0,1.62,-.28);g.add(head);
 ell(head,white,[0,0,0],[.075,.08,.13]);
 mesh(head,new T.ConeGeometry(.022,.42,6),yellow,[0,-.01,-.28],[-1.57,0,0]);
 for(const side of [-1,1]){
  ell(head,black,[side*.07,.02,-.04],[.018,.018,.018]);
  mesh(g,new T.CylinderGeometry(.012,.012,.82,6),dark,[side*.09,.38,.02]);
 }
 const wings:T.Mesh[]=[];
 for(const side of [-1,1]){
  const w=mesh(g,finGeometry([[0,0,0],[side*.85,.1,.3],[side*.2,0,.55]]),white,[side*.14,.84,-.08]);
  wings.push(w);
 }
 g.userData.animate=(time:number,flying=false)=>{
  if(flying){
   wings[0].rotation.z=Math.sin(time*8)*.65;
   wings[1].rotation.z=-Math.sin(time*8)*.65;
   head.position.y=1.62+Math.sin(time*8)*.05;
  }else{
   wings[0].rotation.z=Math.sin(time*1.5)*.04;
   wings[1].rotation.z=-Math.sin(time*1.5)*.04;
   head.rotation.x=Math.sin(time*1.1)*.08;
  }
 };
 return g;
}
