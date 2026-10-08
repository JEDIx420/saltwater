import * as T from 'three';
import {reptileMaterials} from './materials';
import {mesh,ell,profileGeometry,batch,curveTube,type Profile} from './geometry';
import {mergeRigid} from './batching';

// All measurements are in adult model metres. +Z is the tail; -Z is the snout.
const torso:Profile[]=[[-1.36,.22,.16,.35],[-1.08,.31,.21,.34],[-.7,.43,.25,.34],[-.18,.5,.27,.33],[.34,.49,.27,.33],[.76,.4,.23,.32],[1.08,.3,.2,.3],[1.4,.25,.19,.29],[1.8,.2,.18,.27],[2.2,.15,.17,.25],[2.6,.105,.15,.23],[3,.067,.12,.21],[3.4,.035,.08,.19],[3.75,.003,.012,.18]];
function surface(z:number){
 const i=Math.max(0,torso.findIndex(p=>p[0]>=z)-1),a=torso[i],b=torso[Math.min(i+1,torso.length-1)],t=T.MathUtils.clamp((z-a[0])/(b[0]-a[0]),0,1);
 return {w:T.MathUtils.lerp(a[1],b[1],t),h:T.MathUtils.lerp(a[2],b[2],t),y:T.MathUtils.lerp(a[3],b[3],t)};
}
function armourGeometry(){
 // Low osteoderm plates with a swept keel, rather than pyramidal spikes.
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-.5,0,-.5,.5,0,-.5,.5,0,.5,-.5,0,.5,0,.16,-.4,0,.32,.28],3));
 g.setIndex([0,4,1,1,4,5,1,5,2,2,5,3,3,5,4,3,4,0,0,1,3,1,2,3]);g.computeVertexNormals();return g;
}
function segment(parent:T.Group,mat:T.Material,end:T.Vector3,radius:number){
 const length=end.length(),g=profileGeometry([[0,radius*.8,radius*.78,0],[length*.22,radius,radius*.88,0],[length*.7,radius*.82,radius*.7,0],[length,radius*.63,radius*.58,0]],12,2);
 const m=mesh(parent,g,mat,[0,0,0]);m.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),end.clone().normalize());return m;
}
export type CrocMotion={gripping?:boolean;rollTuck?:number;rollLift?:number;rollCoil?:number;diving?:boolean};

export function crocodile(){
 const root=new T.Group(),body=new T.Group(),anatomy=new T.Group();
 // Roll around the spine, not a point on the ground.
 body.position.y=.34;anatomy.position.y=-.34;root.add(body);body.add(anatomy);
 const m=reptileMaterials(),geometry=profileGeometry(torso,32,4);
 const colors=geometry.attributes.color,positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++){
  const z=positions.getZ(i),x=positions.getX(i),shape=surface(z),top=(positions.getY(i)-shape.y)/shape.h;
  const c=new T.Color(0x8c9677).lerp(new T.Color(0xe0d5af),T.MathUtils.smoothstep(-top,0,.8));
  const mottling=.87+.1*Math.sin(z*13+x*18)*Math.sin(z*4-x*23);
  c.multiplyScalar(mottling);colors.setXYZ(i,c.r,c.g,c.b);
 }
 const bones:T.Bone[]=[new T.Bone()];bones[0].name='spine';const tail:T.Bone[]=[];
 for(let i=0;i<8;i++){const b=new T.Bone();b.name='tail_'+i;b.position.set(0,i===0?.3:0,i===0?1.05:.37);(i===0?bones[0]:tail[i-1]).add(b);tail.push(b);bones.push(b)}
 const indices:number[]=[],weights:number[]=[];
 for(let i=0;i<positions.count;i++){
  const z=positions.getZ(i),at=Math.max(0,(z-1.05)/.37),a=z<1.05?0:Math.min(8,Math.floor(at)+1),b=Math.min(8,a+1),t=z<.78?0:z<1.05?(z-.78)/.27:at-Math.floor(at);
  indices.push(a,b,0,0);weights.push(1-t,t,0,0);
 }
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 const skin=new T.SkinnedMesh(geometry,m.skin);skin.add(bones[0]);skin.bind(new T.Skeleton(bones));skin.castShadow=true;skin.receiveShadow=true;skin.frustumCulled=false;anatomy.add(skin);
 const plate=armourGeometry(),scutes:{p:number[];s:number[];r?:number[]}[]=[];
 for(let row=0;row<12;row++){
  const z=-.98+row*.165,s=surface(z);
  for(let col=0;col<6;col++){const x=(col-2.5)*s.w*.29,y=s.y+s.h*Math.sqrt(1-(x/s.w)**2)-.012;scutes.push({p:[x,y,z],s:[.115,col===1||col===4?.18:.08,.15],r:[0,0,-Math.sign(x)*.14]})}
 }
 batch(anatomy,plate,m.ridge,scutes);
 tail.forEach((b,i)=>{
  const z=1.05+i*.37,s=surface(z+.18),h=s.y+s.h-.3,w=s.w*.62;
  const items=i<4?[-1,1].map(side=>({p:[side*w,h,.18],s:[.09,.26-i*.015,.29]})):[{p:[0,h,.18],s:[.065,.24-i*.018,.29]}];
  batch(b,plate,m.ridge,items);
 });
 const head=new T.Group();head.position.set(0,.34,-1.12);anatomy.add(head);
 const upper=profileGeometry([[-1.35,.14,.045,-.01],[-1.24,.24,.078,.012],[-.94,.29,.09,.028],[-.57,.32,.1,.045],[-.25,.33,.135,.06],[.06,.27,.155,.06],[.3,.21,.14,.035]],28,4);upper.deleteAttribute('color');mesh(head,upper,m.head,[0,0,0]);
 const jaw=new T.Group();jaw.position.set(0,-.035,.14);head.add(jaw);
 const lower=profileGeometry([[-1.49,.135,.034,-.096],[-1.37,.23,.045,-.09],[-1.08,.28,.052,-.082],[-.65,.3,.058,-.065],[-.3,.27,.065,-.054],[.14,.19,.075,-.03]],24,3);lower.deleteAttribute('color');mesh(jaw,lower,m.belly,[0,0,0]);
 ell(jaw,m.mouth,[0,-.022,-.76],[.255,.01,.58]);
 const toothGeo=new T.ConeGeometry(1,1,7),teeth:{p:number[];s:number[];r:number[]}[]=[],upperTeeth:{p:number[];s:number[];r:number[]}[]=[];
 for(const side of [-1,1])for(let i=0;i<13;i++){
  const z=-.23-i*.084,w=.29-(i>8?(i-8)*.027:0),size=i===3||i===8?.092:i%3===0?.068:.045;
  teeth.push({p:[side*w,-.038,z-.14],s:[.014,size,.014],r:[0,0,side*.1]});upperTeeth.push({p:[side*w,-.025,z],s:[.016,size*.85,.016],r:[0,0,Math.PI]});
 }
 batch(jaw,toothGeo,m.ivory,teeth);batch(head,toothGeo,m.ivory,upperTeeth);
 for(const side of [-1,1]){
  ell(head,m.head,[side*.255,.175,-.19],[.098,.071,.15]);
  ell(head,m.iris,[side*.302,.19,-.245],[.041,.029,.047]);ell(head,m.black,[side*.329,.19,-.259],[.013,.022,.023]);
  curveTube(head,m.ridge,[[side*.22,.22,-.12],[side*.17,.145,-.5],[side*.12,.11,-.86]],.014);
  ell(head,m.head,[side*.105,.071,-1.24],[.055,.024,.068]);ell(head,m.black,[side*.105,.088,-1.26],[.017,.009,.025]);
  curveTube(head,m.ridge,[[side*.305,-.018,-.33],[side*.289,-.025,-.86],[side*.16,-.026,-1.33]],.006);
 }
 const legs:T.Group[]=[],knees:T.Group[]=[],feet:T.Group[]=[],digits:T.Group[][]=[],webs:T.Mesh[]=[],claws:T.Mesh[]=[];
 for(let j=0;j<4;j++){
  const side=j%2===0?-1:1,hind=j>=2,leg=new T.Group();leg.name=hind?'hind_hip':'front_shoulder';leg.position.set(side*(hind?.36:.32),.36,hind?.83:-.81);anatomy.add(leg);
  const upperEnd=new T.Vector3(side*(hind?.32:.3),-.13,hind?-.03:.08);segment(leg,m.head,upperEnd,hind?.18:.124);
  const knee=new T.Group();knee.name=hind?'knee':'elbow';knee.position.copy(upperEnd);leg.add(knee);
  const lowerEnd=new T.Vector3(side*.18,-.185,hind?-.13:-.06);segment(knee,m.head,lowerEnd,hind?.089:.068);
  const foot=new T.Group();foot.name=hind?'webbed_hind_foot':'five_digit_forefoot';foot.position.copy(lowerEnd);knee.add(foot);
  const palm=profileGeometry([[-.17,hind?.105:.074,.026,0],[-.07,hind?.128:.094,.036,0],[.07,hind?.088:.065,.041,.009],[.12,.045,.028,.016]],12,2);palm.deleteAttribute('color');mesh(foot,palm,m.head,[0,0,0]);
  const count=hind?4:5,lengths=hind?[.23,.3,.31,.24]:[.15,.235,.26,.22,.14],toeJoints:T.Group[]=[],tips:T.Vector3[]=[];
  for(let k=0;k<count;k++){
   const toe=new T.Group(),fan=(k-(count-1)/2)/(count-1),length=lengths[k];toe.name='digit_'+(k+1);toe.userData.clawed=k<3;toe.position.set(side*fan*(hind?.23:.185),-.006,-.13);toe.rotation.y=-side*fan*.72;foot.add(toe);
   const g=profileGeometry([[-length,.006,.008,-.006],[-length*.78,.02,.017,-.002],[-length*.42,.027,.025,.005],[0,.028,.024,.004]],10,2);g.deleteAttribute('color');mesh(toe,g,m.head,[0,0,0]);
   if(k<3){const claw=profileGeometry([[-.085,.002,.004,.021],[-.046,.012,.013,.014],[0,.019,.018,0]],8,2);claw.deleteAttribute('color');const nail=mesh(toe,claw,m.claw,[0,-.006,-length+.025]);nail.name='claw';claws.push(nail)}
   // Keep each digit as a joint while baking its rigid skin/nail into one draw call.
   mergeRigid(toe);toeJoints.push(toe);toe.updateMatrix();tips.push(new T.Vector3(0,-.008,-length*.7).applyMatrix4(toe.matrix));
  }
  if(hind){
   const verts:number[]=[],idx:number[]=[];
   for(let k=0;k<count-1;k++){const a=toeJoints[k].position,b=toeJoints[k+1].position,ta=tips[k],tb=tips[k+1],i=verts.length/3;verts.push(a.x,-.01,a.z,ta.x,-.008,ta.z,(ta.x+tb.x)*.5,-.017,(ta.z+tb.z)*.5+.035,tb.x,-.008,tb.z,b.x,-.01,b.z);idx.push(i,i+1,i+2,i,i+2,i+4,i+2,i+3,i+4)}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();const web=mesh(foot,g,m.web,[0,0,0]);web.name='hind_webbing';webs.push(web);
  }
  legs.push(leg);knees.push(knee);feet.push(foot);digits.push(toeJoints);
 }
 // Rigid cranial details retain their texture; instanced plates and teeth stay batched.
 let phase=0,lastTime:number|null=null,waterBlend=1,pace=0;
 const api={root,body,anatomy,jaw,head,legs,knees,feet,digits,webs,claws,tail,skin,
  reset(){phase=0;lastTime=null;pace=0;waterBlend=1;body.rotation.set(0,0,0)},
  animate(time:number,speed:number,swim:boolean,bite:number,roll:number,turn=0,rest=false,extra:CrocMotion={}){
   const dt=lastTime===null?1/30:T.MathUtils.clamp(time-lastTime,0,.15);lastTime=time;
   pace=T.MathUtils.damp(pace,Math.abs(speed),7,dt);waterBlend=T.MathUtils.damp(waterBlend,swim?1:0,9,dt);
   phase+=dt*(T.MathUtils.lerp(2.6+pace*.6,3.7+pace*2.2,1-waterBlend));
   const move=T.MathUtils.clamp(pace/2,0,1),burst=T.MathUtils.smoothstep(pace,3,6.8),tuck=extra.rollTuck??0,coil=extra.rollCoil??0;
   body.rotation.set(0,Math.sin(phase)*move*.018+coil*.07,roll);
   body.position.y=.34+Math.sin(time*1.5)*.005+Math.sin(phase*2)*.011*move*(1-waterBlend)+(extra.rollLift??0);
   const strike=Math.sin(T.MathUtils.clamp(bite,0,1)*Math.PI);
   head.rotation.set(rest?-.055:Math.sin(time*1.5)*.008-strike*.045,Math.sin(phase-.3)*move*.025+coil*.12,0);
   head.position.z=-1.12-strike*.07;
   tail.forEach((b,i)=>{
    const amplitude=.015+move*(.04+waterBlend*.09)*(1+i*.075);
    b.rotation.y=Math.sin(phase-i*.55)*amplitude-turn*.035*(.3+i/8)+coil*.09*(i/8);
    b.rotation.x=waterBlend*(Math.sin(time*1.7-i*.3)*.008+(extra.diving?.018:0));
   });
   legs.forEach((l,i)=>{
    const side=i%2===0?-1:1,hind=i>=2,cycle=phase+(i===0||i===3?0:Math.PI),stroke=Math.sin(cycle),lift=Math.max(0,Math.cos(cycle));
    const paddle=(hind?.16:.09)*(1-burst*.88),fold=burst*.72+tuck*.93;
    const walkY=stroke*.43*move,swimY=-side*(.12+fold)+stroke*paddle;
    l.rotation.y=T.MathUtils.lerp(walkY,swimY,waterBlend)*(1-tuck)+(-side*.95)*tuck;
    l.rotation.x=T.MathUtils.lerp(lift*.19*move,-.16+stroke*paddle*.7,waterBlend)*(1-tuck)-.12*tuck;
    l.rotation.z=T.MathUtils.lerp(-side*lift*.1*move,side*(.11+lift*.07*(1-burst)),waterBlend)*(1-tuck);
    knees[i].rotation.y=side*(waterBlend*(.12+fold*.26)+tuck*.2);
    knees[i].rotation.x=T.MathUtils.lerp(lift*.4*move,.17+lift*.26*(1-burst),waterBlend)*(1-tuck)+.4*tuck;
    feet[i].rotation.x=T.MathUtils.lerp(-lift*.3*move,.12-stroke*.28*(1-burst),waterBlend)*(1-tuck)-.15*tuck;
    feet[i].rotation.z=side*stroke*.07*waterBlend*(1-burst)*(1-tuck);
    digits[i].forEach(d=>d.rotation.x=waterBlend*(.065+stroke*.06)*(1-burst)*(1-tuck)+lift*.08*move*(1-waterBlend));
   });
   // A grip holds the jaws shut through the whole roll, rather than reopening on a timer.
   jaw.rotation.x=extra.gripping?-.035:-strike*.62-(rest?.15:0);skin.skeleton.update();
  }
 };
 return api;
}
