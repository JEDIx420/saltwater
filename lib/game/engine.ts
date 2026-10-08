import * as T from 'three';
import {makeWorld,heightAt,riverCenter,biomeAt,seeded,HALF,WORLD_SIZE,waterLevel,LANDMARKS} from './world';
import {crocodile,fish,crab,buffalo,bird} from './models';
import {habitatPoint,validHabitat} from './habitat';
import {ROLL_DURATION,rollPose} from './motion';
import {SoftwareRenderer} from './software-renderer';
import {angleDelta,joystickHeading,approach,clamp,type Joystick} from './input';
import {readSave,writeSave,type ExpeditionSave} from './storage';
export type Snapshot={health:number;hunger:number;stamina:number;air:number;warmth:number;mode:string;biome:string;speed:number;depth:number;kills:number;fishCaught:number;buffaloCaught:number;growth:number;distance:number;regions:number;landmarks:string[];elapsed:number;time:string;heading:number;fps:number;message:string;target:string;canBite:boolean;awareness:number;grip:number;meal:boolean;basking:boolean;dead:boolean;started:boolean;paused:boolean;x:number;z:number;drawCalls:number;renderer:string;waypoint:string;waypointDistance:number;waypointBearing:number;canContinue:boolean;feeding:boolean;rolling:boolean;quality:string};
export const initial:Snapshot={health:100,hunger:70,stamina:100,air:100,warmth:72,mode:'SURFACE',biome:'MANGROVE REACH',speed:0,depth:0,kills:0,fishCaught:0,buffaloCaught:0,growth:0,distance:0,regions:1,landmarks:[],elapsed:0,time:'16:42',heading:0,fps:0,message:'The estuary is yours.',target:'',canBite:false,awareness:0,grip:0,meal:false,basking:false,dead:false,started:false,paused:false,x:0,z:-38,drawCalls:0,renderer:'WebGL',waypoint:'',waypointDistance:0,waypointBearing:0,canContinue:false,feeding:false,rolling:false,quality:'Balanced'};
export type Animal={root:T.Group;kind:'fish'|'crab'|'buffalo';alive:boolean;hp:number;home:T.Vector3;angle:number;phase:number;respawn:number;flee:number;awareness:number;velocity:number;servings:number};
export class Engine{
 scene=new T.Scene();camera=new T.PerspectiveCamera(55,1,.1,1100);renderer:T.WebGLRenderer|SoftwareRenderer;state:Snapshot={...initial,landmarks:[]};croc=crocodile();world:ReturnType<typeof makeWorld>;animals:Animal[]=[];
 keys=new Set<string>();touch:{joystick:Joystick;sprint:boolean;stalk:boolean}={joystick:{x:0,y:0},sprint:false,stalk:false};yaw=.42;pitch=.33;zoom=9;sensitivity=1;diving=false;muted=false;quality=2;started=false;paused=false;dead=false;disposed=false;
 private frame=0;private time=0;private ambientTime=0;private last=0;private accumulator=0;private speed=0;private turnAmount=0;private biteTimer=0;private attackCooldown=0;private rollTimer=0;private rollVictim:Animal|null=null;private rollSplash=0;private feedingTimer=0;private messageTimer=5;private damageCooldown=0;private regions=new Set(['MANGROVE REACH']);private uiTimer=0;private fpsSamples:number[]=[];private cameraPointer:number|null=null;private oldX=0;private oldY=0;private pointerStartX=0;private pointerStartY=0;private pointerStartTime=0;private pointerButton=0;private cameraIdle=0;private grabbed:Animal|null=null;private grip=0;private basking=false;private birds:{root:T.Group;angle:number;radius:number;y:number;speed:number}[]=[];
 private particles:{mesh:T.Mesh;life:number;max:number;velocity?:T.Vector3}[]=[];private audio:AudioContext|null=null;private ambience:GainNode|null=null;private audioNodes:AudioNode[]=[];private audioSources:AudioScheduledSourceNode[]=[];private sun:T.DirectionalLight;private waypointId='';private autoQuality=true;private slowFrames=0;private wakeTimer=0;private saved:ExpeditionSave|null=null;
 constructor(private container:HTMLElement,private map:HTMLCanvasElement,private onUpdate:(s:Snapshot)=>void,private onPause:(p:boolean)=>void){
  try{this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch{this.renderer=new SoftwareRenderer()}
  const mobile=matchMedia('(pointer:coarse)').matches;
  this.quality=mobile?1:2;
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1:1.35));this.renderer.setSize(container.clientWidth,container.clientHeight);
  this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;this.renderer.shadowMap.enabled=!mobile&&!(this.renderer instanceof SoftwareRenderer);this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.renderer.domElement.tabIndex=0;this.renderer.domElement.setAttribute('aria-label','Crocodile simulator 3D play area');container.appendChild(this.renderer.domElement);
  this.state.renderer=this.renderer instanceof SoftwareRenderer?'Compatibility':'WebGL';this.state.quality=mobile?'Performance':'Balanced';
  this.scene.background=new T.Color(0xa1c7d1);this.scene.fog=new T.FogExp2(0xa1c7d1,.0032);
  this.scene.add(new T.HemisphereLight(0xd7f0f5,0x596f47,2.35));
  this.sun=new T.DirectionalLight(0xffe3b4,2.8);this.sun.position.set(-70,100,-50);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.left=-24;this.sun.shadow.camera.right=24;this.sun.shadow.camera.top=24;this.sun.shadow.camera.bottom=-24;this.sun.shadow.camera.far=210;this.sun.shadow.bias=-.0006;this.sun.shadow.normalBias=.04;this.scene.add(this.sun,this.sun.target);
  this.world=makeWorld(this.scene);this.croc.root.position.set(riverCenter(-38)+14,-.12,-38);this.croc.root.scale.setScalar(.8);this.scene.add(this.croc.root);this.state.x=this.croc.root.position.x;
  this.world.update(this.croc.root.position.x,-38,0,this.quality);this.populate();
  this.makeSky();this.drawBaseMap();this.saved=readSave();this.state.canContinue=!!this.saved;this.resize();
  this.camera.position.copy(this.croc.root.position).add(new T.Vector3(6,3.6,8));this.camera.lookAt(this.croc.root.position);
  window.addEventListener('resize',this.resize);window.addEventListener('keydown',this.keyDown);window.addEventListener('keyup',this.keyUp);window.addEventListener('blur',this.blur);document.addEventListener('visibilitychange',this.visibility);
  const el=this.renderer.domElement;el.addEventListener('pointerdown',this.pointerDown);el.addEventListener('pointerup',this.pointerUp);el.addEventListener('pointercancel',this.pointerCancel);el.addEventListener('lostpointercapture',this.pointerCancel);el.addEventListener('pointermove',this.pointerMove);el.addEventListener('wheel',this.wheel,{passive:false});el.addEventListener('contextmenu',this.contextMenu);el.addEventListener('webglcontextlost',this.contextLost);
  this.frame=requestAnimationFrame(this.loop);this.updateUI();
 }
 private makeSky(){
  const sun=new T.Mesh(new T.SphereGeometry(15,10,8),new T.MeshBasicMaterial({color:0xffeecb,fog:false}));sun.position.set(-720,360,-780);sun.userData.softwareIgnore=true;this.scene.add(sun);
  const rng=seeded(19);for(let i=0;i<15;i++){const root=bird();this.scene.add(root);this.birds.push({root,angle:rng()*Math.PI*2,radius:45+rng()*155,y:18+rng()*25,speed:.03+rng()*.018})}
 }
 private populate(){
  const rng=seeded(91),start=this.croc.root.position;
  const schools=[{x:start.x,z:start.z-12},{x:riverCenter(95),z:95},{x:riverCenter(325),z:325},{x:120,z:225},{x:riverCenter(545),z:545},{x:riverCenter(-340),z:-340},{x:riverCenter(-570),z:-570},{x:-210,z:-710},{x:270,z:-765}];
  for(let i=0;i<81;i++){const school=schools[Math.floor(i/9)],z=i<3?start.z-6-i*3:school.z+(rng()-.5)*24,x=i<3?start.x+(i-1)*1.8:school.x+(rng()-.5)*17;if(heightAt(x,z)<-.5)this.spawn('fish',x,z,rng,i)}
  for(let i=0;i<32;i++){let x=0,z=0;for(let j=0;j<100;j++){z=rng()*1320-560;x=riverCenter(z)+(rng()<.5?-1:1)*(38+rng()*22);const h=heightAt(x,z);if(h>.08&&h<3.5)break}this.spawn('crab',x,z,rng,i)}
  for(let i=0;i<16;i++){const z=i<4?30+i*6:i<12?450+(i-4)*8:125+(i-12)*10;const x=riverCenter(z)+(i<4?-1:1)*(47+rng()*10);this.spawn('buffalo',x,z,rng,i)}for(let i=0;i<6;i++)this.spawn('buffalo',-325-rng()*80,20+rng()*90,rng,i+16)
 }
 private spawn(kind:Animal['kind'],x:number,z:number,rng:()=>number,index:number){
  const safe=habitatPoint(kind,x,z);if(!safe)return;x=safe.x;z=safe.z;
  const root=kind==='fish'?fish(index%3):kind==='crab'?crab():buffalo();const y=kind==='fish'?Math.max(heightAt(x,z)+.5,-.82-rng()*.5):heightAt(x,z);
  root.position.set(x,y,z);root.rotation.y=rng()*Math.PI*2;this.scene.add(root);this.animals.push({root,kind,alive:true,hp:kind==='buffalo'?3:1,home:root.position.clone(),angle:root.rotation.y+Math.PI,phase:rng()*8,respawn:0,flee:0,awareness:0,velocity:0,servings:0});
 }
 start(){this.started=true;this.dead=false;this.paused=false;this.state.started=true;this.state.paused=false;this.last=performance.now();this.notify('Take it slowly. Fish gather just ahead of you.');this.initAudio();this.audio?.resume().catch(()=>{});this.onPause(false);this.renderer.domElement.focus()}
 pause(value=true){this.paused=value;this.state.paused=value;this.clearInput();this.onPause(value);if(!value){this.last=performance.now();this.renderer.domElement.focus()}this.updateUI()}
 clearInput(){this.keys.clear();this.touch.joystick={x:0,y:0};this.touch.sprint=false;this.touch.stalk=false;this.cameraPointer=null}
 restart(){
  this.croc.root.position.set(riverCenter(-38)+14,-.12,-38);this.croc.root.rotation.set(0,0,0);const renderer=this.state.renderer,quality=this.state.quality;this.state={...initial,landmarks:[],renderer,quality,started:true,canContinue:!!this.saved};this.speed=0;this.time=0;this.diving=false;this.dead=false;this.grabbed=null;this.grip=0;this.basking=false;this.rollTimer=0;this.rollVictim=null;this.rollSplash=0;this.croc.reset();this.biteTimer=0;this.attackCooldown=0;this.feedingTimer=0;this.regions=new Set(['MANGROVE REACH']);this.waypointId='';this.yaw=.42;
  this.animals.forEach(a=>{a.alive=true;a.hp=a.kind==='buffalo'?3:1;a.root.visible=true;a.root.position.copy(a.home);a.root.rotation.set(0,a.angle+Math.PI,0);a.velocity=0;a.flee=0;a.awareness=0;a.servings=0});this.clearInput();this.start();
 }
 continue(){if(!this.saved)return;const s=this.saved;this.restart();Object.assign(this.state,{health:s.health,hunger:s.hunger,stamina:s.stamina,air:100,warmth:s.warmth,growth:s.growth,kills:s.kills,fishCaught:s.fishCaught,buffaloCaught:s.buffaloCaught,distance:s.distance,elapsed:s.elapsed,landmarks:[...s.landmarks]});const ground=heightAt(s.x,s.z);this.croc.root.position.set(s.x,ground<-.45?waterLevel(s.elapsed)-.12:ground+.035,s.z);this.croc.root.rotation.y=s.heading;this.yaw=s.heading;this.time=s.elapsed;this.regions=new Set(s.regions);this.world.update(s.x,s.z,this.time,this.quality);this.notify('Your expedition continues.');this.updateUI()}
 save(){if(!this.started||this.dead)return false;const p=this.croc.root.position;const s:ExpeditionSave={version:2,health:this.state.health,hunger:this.state.hunger,stamina:this.state.stamina,air:this.state.air,warmth:this.state.warmth,growth:this.state.growth,kills:this.state.kills,fishCaught:this.state.fishCaught,buffaloCaught:this.state.buffaloCaught,distance:this.state.distance,elapsed:this.time,x:p.x,y:p.y,z:p.z,heading:this.croc.root.rotation.y,regions:[...this.regions],landmarks:[...this.state.landmarks],savedAt:new Date().toISOString()};const ok=writeSave(s);if(ok){this.saved=s;this.state.canContinue=true;this.notify('Expedition saved on this device.')}else this.notify('This browser could not save your expedition.');return ok}
 setQuality(level:number){this.quality=clamp(Math.round(level),1,3);this.autoQuality=false;this.state.quality=['','Performance','Balanced','Cinematic'][this.quality];this.renderer.setPixelRatio(Math.min(devicePixelRatio,[0,1,1.35,1.7][this.quality]));this.renderer.shadowMap.enabled=this.quality>1&&!(this.renderer instanceof SoftwareRenderer);this.resize();this.updateUI()}
 setMuted(value:boolean){this.muted=value;if(this.ambience)this.ambience.gain.value=value?0:.065}
 setJoystick(joy:Joystick){this.touch.joystick=joy}
 look(dx:number,dy:number){this.yaw-=dx*.004*this.sensitivity;this.pitch=clamp(this.pitch+dy*.003*this.sensitivity,-.16,1.05);this.cameraIdle=5}
 resetCamera(){this.yaw=this.croc.root.rotation.y;this.pitch=.33;this.zoom=9;this.cameraIdle=0}
 waypoint(id:string){this.waypointId=this.waypointId===id?'':id;const marker=LANDMARKS.find(l=>l.id===this.waypointId);this.state.waypoint=marker?.name||'';this.updateUI()}
 dive(){if(!this.started||this.paused||this.dead)return;if(heightAt(this.croc.root.position.x,this.croc.root.position.z)<waterLevel(this.time)-1){this.diving=!this.diving;this.basking=false;this.notify(this.diving?'Keep an eye on your air. Space / Rise returns to the surface.':'Rising to the surface.')}else this.notify('The water is too shallow. Find the main channel.')}
 surface(){this.diving=false}
 bask(){if(!this.started||this.paused||this.dead)return;const p=this.croc.root.position;if(heightAt(p.x,p.z)<waterLevel(this.time)+.1){this.notify('Find a dry bank to bask.');return}this.basking=!this.basking;this.diving=false;this.notify(this.basking?'Basking restores warmth and helps you recover.':'Back on the hunt.')}
 interact(){if(!this.started||this.paused||this.dead||this.rollTimer>0)return;if(this.grabbed){this.grabbed.flee=8;this.grabbed=null;this.grip=0;this.notify('Prey released.');return}const meal=this.nearestMeal();if(meal&&this.feedingTimer<=0){meal.servings--;this.feedingTimer=1.8;this.biteTimer=.7;this.state.hunger=clamp(this.state.hunger+24,0,100);this.state.health=clamp(this.state.health+4,0,100);this.state.growth=clamp(this.state.growth+9,0,100);this.notify('Feeding. +24 nutrition · +9 growth');this.sfx(170,.2);if(!meal.servings)meal.root.visible=false;this.updateUI()}else if(!meal)this.bask()}
 attack(){
  if(!this.started||this.paused||this.dead||this.attackCooldown>0||this.feedingTimer>0||this.rollTimer>0)return;
  this.basking=false;this.biteTimer=.45;this.attackCooldown=.75;this.sfx(140,.12);
  if(this.grabbed){this.grabbed.hp--;this.grip=Math.min(100,this.grip+12);if(this.grabbed.hp<=0)this.kill(this.grabbed);this.ripple();return}
  const p=this.croc.root.position,forward=new T.Vector3(-Math.sin(this.croc.root.rotation.y),0,-Math.cos(this.croc.root.rotation.y));let found:Animal|undefined,nearest=4.7;
  for(const a of this.animals){if(!a.alive)continue;const delta=a.root.position.clone().sub(p),dist=delta.length();if(dist<nearest&&delta.clone().normalize().dot(forward)>.45){found=a;nearest=dist}}
  if(found){found.hp--;found.flee=7;
   if(found.kind==='buffalo'){this.grabbed=found;this.grip=100;found.awareness=1;this.state.health=clamp(this.state.health-4,0,100);this.damageCooldown=3;this.notify('Grabbed! Drag into water, then R / Roll. E releases your grip.');}
   else this.kill(found);
  }else this.notify('Aim your snout at prey and close the gap.');this.ripple();this.updateUI();
 }
 roll(){
  if(!this.started||this.paused||this.dead||this.rollTimer>0)return;
  if(!this.grabbed){this.notify('Bite and hold large prey before rolling.');return}
  if(this.state.stamina<22){this.notify('Rest to recover enough stamina for a roll.');return}
  const p=this.croc.root.position;
  if(heightAt(p.x,p.z)>waterLevel(this.time)-.6){this.notify('Pull your prey into deeper water to roll.');return}
  this.state.stamina-=22;this.rollTimer=ROLL_DURATION;this.rollVictim=this.grabbed;this.rollSplash=0;this.state.rolling=true;this.grip=Math.min(100,this.grip+30);
  this.notify('Death roll! Holding your catch through the turn.');this.sfx(65,.35);this.ripple();this.updateUI();
 }
 private kill(a:Animal){
  a.alive=false;a.respawn=90;a.flee=0;a.servings=a.kind==='buffalo'?3:0;if(this.grabbed===a){this.grabbed=null;this.grip=0}this.state.kills++;
  if(a.kind==='buffalo'){this.state.buffaloCaught++;a.root.rotation.set(0,this.croc.root.rotation.y+.8,Math.PI/2);a.root.position.y=Math.max(heightAt(a.root.position.x,a.root.position.z)+.7,waterLevel(this.time)-.22);this.notify('A successful ambush. E / Feed to eat your catch.');}
  else{a.root.visible=false;if(a.kind==='fish')this.state.fishCaught++;this.state.hunger=clamp(this.state.hunger+(a.kind==='fish'?14:9),0,100);this.state.health=clamp(this.state.health+2,0,100);this.state.growth=clamp(this.state.growth+(a.kind==='fish'?8:5),0,100);this.notify(a.kind==='fish'?'Fish caught. +14 nutrition · +8 growth':'Crab caught. +9 nutrition · +5 growth')}
  this.sfx(240,.1);
 }
 private nearestMeal(){const p=this.croc.root.position;return this.animals.find(a=>!a.alive&&a.servings>0&&a.root.position.distanceTo(p)<6)}
 private notify(msg:string){this.state.message=msg;this.messageTimer=6;this.updateUI()}
 private keyDown=(e:KeyboardEvent)=>{
  if((e.target as HTMLElement)?.closest('input,textarea,[role="slider"],[role="dialog"]'))return;const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();if(e.repeat)return;
  if(key==='escape'&&this.started&&!this.dead){this.pause(!this.paused);return}if(!this.started||this.paused||this.dead)return;this.keys.add(key);
  if(key==='c')this.dive();if(key==='f')this.attack();if(key==='r')this.roll();if(key==='e')this.interact();if(key==='b')this.bask();if(key==='v')this.resetCamera();
 };
 private keyUp=(e:KeyboardEvent)=>this.keys.delete(e.key.toLowerCase());private blur=()=>{if(this.started&&!this.dead)this.pause(true)};private visibility=()=>{if(document.hidden)this.blur()};private contextMenu=(e:Event)=>e.preventDefault();private contextLost=(e:Event)=>{e.preventDefault();this.pause();this.notify('Graphics paused. Save your expedition and reload to restore rendering.')};
 private pointerDown=(e:PointerEvent)=>{if(!this.started||this.paused||this.dead||this.cameraPointer!==null)return;this.cameraPointer=e.pointerId;this.oldX=this.pointerStartX=e.clientX;this.oldY=this.pointerStartY=e.clientY;this.pointerStartTime=performance.now();this.pointerButton=e.button;this.renderer.domElement.setPointerCapture(e.pointerId);this.renderer.domElement.focus()};
 private pointerUp=(e:PointerEvent)=>{if(e.pointerId!==this.cameraPointer)return;const tap=this.pointerButton===0&&e.pointerType==='mouse'&&Math.hypot(e.clientX-this.pointerStartX,e.clientY-this.pointerStartY)<6&&performance.now()-this.pointerStartTime<300;this.cameraPointer=null;if(this.renderer.domElement.hasPointerCapture(e.pointerId))this.renderer.domElement.releasePointerCapture(e.pointerId);if(tap)this.attack()};
 private pointerCancel=(e:PointerEvent)=>{if(e.pointerId===this.cameraPointer)this.cameraPointer=null};
 private pointerMove=(e:PointerEvent)=>{if(this.paused||this.cameraPointer!==e.pointerId)return;this.look(e.clientX-this.oldX,e.clientY-this.oldY);this.oldX=e.clientX;this.oldY=e.clientY};
 private wheel=(e:WheelEvent)=>{e.preventDefault();this.zoom=clamp(this.zoom+e.deltaY*.009,5.5,24)};
 private resize=()=>{const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h)};
 private loop=(now:number)=>{
  if(this.disposed)return;const dt=Math.min((now-(this.last||now))/1000,.15);this.last=now;this.ambientTime+=dt;this.fpsSamples.push(1/(dt||.016));if(this.fpsSamples.length>45)this.fpsSamples.shift();
  if(this.started&&!this.paused&&!this.dead){this.accumulator+=dt;let steps=0;while(this.accumulator>=1/60&&steps++<9){this.time+=1/60;this.step(1/60);this.accumulator-=1/60}}else this.accumulator=0;
  const animateTime=this.started?this.time:this.ambientTime;
  this.animateCroc(animateTime);
  this.world.update(this.croc.root.position.x,this.croc.root.position.z,animateTime,this.quality);this.updateCamera(dt);this.world.waterMat.uniforms.cameraPos.value.copy(this.camera.position);
  const under=this.camera.position.y<waterLevel(this.time)-.08,fog=this.scene.fog as T.FogExp2;fog.color.set(under?0x28685f:0xa1c7d1);fog.density=under?.028:.0032;this.scene.background=(fog.color.clone());
  this.birds.forEach((b,i)=>{b.angle+=dt*b.speed;b.root.position.set(Math.cos(b.angle)*b.radius+this.croc.root.position.x,b.y,Math.sin(b.angle)*b.radius+this.croc.root.position.z);b.root.rotation.y=-b.angle;b.root.userData.animate?.(this.ambientTime+i)});
  this.particles.forEach(p=>{const fxdt=this.paused?0:dt;p.life-=fxdt;if(p.velocity){p.mesh.position.addScaledVector(p.velocity,fxdt);p.velocity.y-=5*fxdt;p.mesh.scale.setScalar(.7+.3*p.life/p.max);}else p.mesh.scale.setScalar((1-p.life/p.max)*4+.1);(p.mesh.material as T.MeshBasicMaterial).opacity=Math.max(0,p.life/p.max)*(p.velocity ? .7 : .24)});this.particles=this.particles.filter(p=>{if(p.life<=0){this.scene.remove(p.mesh);p.mesh.geometry.dispose();(p.mesh.material as T.Material).dispose();return false}return true});
  this.sun.position.copy(this.croc.root.position).add(new T.Vector3(-70,100,-50));this.sun.target.position.copy(this.croc.root.position);
  this.renderer.render(this.scene,this.camera);this.uiTimer+=dt;if(this.uiTimer>.2){this.uiTimer=0;this.updateUI();this.drawMap();this.adaptQuality()}this.frame=requestAnimationFrame(this.loop);
 };
 private animateCroc(time:number){
  const pose=this.rollTimer>0?rollPose(this.rollTimer):{angle:0,tuck:0,lift:0,coil:0};
  this.croc.animate(time,this.started?this.speed:.25,this.state.mode==='SWIMMING'||this.state.mode==='DIVING'||!this.started,this.biteTimer/(this.feedingTimer>0?.7:.45),pose.angle,this.turnAmount,this.basking,{gripping:!!this.grabbed,rollTuck:pose.tuck,rollLift:pose.lift,rollCoil:pose.coil,diving:this.diving});
  this.croc.root.updateMatrixWorld(true);this.croc.skin.skeleton.update();
 }
 private adaptQuality(){if(!this.autoQuality||this.quality<=1||this.renderer instanceof SoftwareRenderer)return;const fps=this.fpsSamples.reduce((a,b)=>a+b,0)/this.fpsSamples.length;if(fps<32)this.slowFrames++;else this.slowFrames=Math.max(0,this.slowFrames-1);if(this.slowFrames>20){this.quality=1;this.renderer.setPixelRatio(1);this.renderer.shadowMap.enabled=false;this.state.quality='Adaptive performance';this.resize();this.slowFrames=0}}
 private step(dt:number){
  const p=this.croc.root.position,ground=heightAt(p.x,p.z),water=waterLevel(this.time),swim=ground<water-.5;
  this.state.mode=swim?(this.diving?'DIVING':'SWIMMING'):ground<water+.1?'WADING':'LAND';
  let forward=(this.keys.has('w')||this.keys.has('arrowup')?1:0)-(this.keys.has('s')||this.keys.has('arrowdown')?1:0),turn=(this.keys.has('a')||this.keys.has('arrowleft')?1:0)-(this.keys.has('d')||this.keys.has('arrowright')?1:0);
  const joy=this.touch.joystick,magnitude=Math.min(1,Math.hypot(joy.x,joy.y));
  if(magnitude>.05){const heading=joystickHeading(joy,this.yaw);turn=clamp(angleDelta(this.croc.root.rotation.y,heading)*2.2,-1,1);forward=magnitude*clamp(1-Math.abs(angleDelta(this.croc.root.rotation.y,heading))/Math.PI,.2,1)}
  if(Math.abs(forward)>.05||turn!==0)this.basking=false;
  const fast=(this.keys.has('shift')||this.touch.sprint)&&this.state.stamina>2&&Math.abs(forward)>.05&&!this.grabbed&&!this.feedingTimer;
  const stalk=this.keys.has('control')||this.touch.stalk;
  const warmthScale=this.state.warmth<30?.7:1;const max=(swim?(fast?8.6:stalk?1.3:4.5):(fast?4.3:stalk?.75:1.9))*(forward<0?.5:1)*(this.grabbed?.6:1)*warmthScale;
  this.speed=approach(this.speed,this.basking||this.feedingTimer>0||this.rollTimer>0?0:forward*max,swim?2.5:5,dt);this.turnAmount=approach(this.turnAmount,turn,5,dt);if(this.rollTimer<=0)this.croc.root.rotation.y+=turn*dt*(swim?1.2:1.5)*(fast?.75:1);
  this.cameraIdle=Math.max(0,this.cameraIdle-dt);if(this.cameraPointer===null&&this.cameraIdle<=0&&magnitude<=.05){this.yaw+=angleDelta(this.yaw,this.croc.root.rotation.y)*dt*.7}
  const nx=p.x-Math.sin(this.croc.root.rotation.y)*this.speed*dt,nz=p.z-Math.cos(this.croc.root.rotation.y)*this.speed*dt,nextH=heightAt(nx,nz);
  let blocked=Math.abs(nx)>HALF-10||Math.abs(nz)>HALF-10||nextH-ground>Math.abs(this.speed*dt)*1.8+.04;
  if(!blocked&&!swim)blocked=this.world.obstacles.some(o=>Math.abs(nx-o.x)<2&&Math.abs(nz-o.z)<2&&Math.hypot(nx-o.x,nz-o.z)<o.r+.48);
  if(!blocked){this.state.distance+=Math.hypot(nx-p.x,nz-p.z);p.x=nx;p.z=nz}else this.speed*=.6;
  if(this.keys.has(' '))this.diving=false;if(!swim)this.diving=false;const h=heightAt(p.x,p.z),target=swim?(this.diving?Math.max(h+.55,water-3.6):water-.12):h+.035;p.y=approach(p.y,target,5,dt);
  const fx=-Math.sin(this.croc.root.rotation.y),fz=-Math.cos(this.croc.root.rotation.y),slope=swim?0:Math.atan2(heightAt(p.x+fx,p.z+fz)-heightAt(p.x-fx,p.z-fz),2);this.croc.root.rotation.x=approach(this.croc.root.rotation.x,slope,6,dt);
  this.state.stamina=clamp(this.state.stamina+(fast?-12:this.grabbed?-2.5:this.state.warmth<30?4:this.basking?15:9)*dt,0,100);
  this.state.hunger=Math.max(0,this.state.hunger-dt*(fast?.19:.085));this.state.air=clamp(this.state.air+(p.y<water-.7?-1.35:17)*dt,0,100);
  this.state.warmth=clamp(this.state.warmth+(this.basking?.28:swim?-.065:.1)*dt,0,100);
  if(this.state.hunger===0||this.state.air===0)this.state.health=Math.max(0,this.state.health-dt*4);else if(this.state.hunger>45&&this.state.warmth>35)this.state.health=Math.min(100,this.state.health+dt*(this.basking?.6:.16));
  this.croc.root.scale.setScalar(.8+this.state.growth*.002);this.state.depth=Math.max(0,water-p.y);this.state.speed=Math.abs(this.speed);this.state.biome=biomeAt(p.x,p.z);
  if(!this.regions.has(this.state.biome)){this.regions.add(this.state.biome);this.notify('New habitat: '+this.state.biome.toLowerCase()+'.')}this.state.regions=this.regions.size;
  for(const marker of LANDMARKS){if(!this.state.landmarks.includes(marker.id)&&Math.hypot(marker.x-p.x,marker.z-p.z)<23){this.state.landmarks.push(marker.id);this.notify('Discovered '+marker.name+'. '+marker.description)}}
  this.state.x=p.x;this.state.z=p.z;this.state.heading=((-this.croc.root.rotation.y*180/Math.PI)%360+360)%360;this.state.elapsed=this.time;
  const minutes=16*60+42+Math.floor(this.time/20);this.state.time=`${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  this.attackCooldown=Math.max(0,this.attackCooldown-dt);this.biteTimer=Math.max(0,this.biteTimer-dt);this.rollTimer=Math.max(0,this.rollTimer-dt);this.feedingTimer=Math.max(0,this.feedingTimer-dt);this.damageCooldown=Math.max(0,this.damageCooldown-dt);this.messageTimer-=dt;if(this.messageTimer<0)this.state.message='';
  this.animateCroc(this.time);
  this.stepAnimals(dt,stalk,swim);
  if(this.grabbed){
   const a=this.grabbed;
   this.grip=Math.max(0,this.grip-dt*(this.rollTimer>0?0:swim?4:9));
   // The bite point stays on the foreleg through the spin. The victim rotates with the
   // jaw frame instead of orbiting a fixed world-space point or dying before the roll.
   const mouth=this.croc.head.localToWorld(new T.Vector3(0,-.035,-1.2));
   const yaw=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),.8);
   a.root.quaternion.copy(this.croc.body.getWorldQuaternion(new T.Quaternion())).multiply(yaw);
   const attachment=new T.Vector3(.44,.15,-.69).applyQuaternion(a.root.quaternion);
   const gripPos=mouth.sub(attachment);
   if(this.rollTimer>0||this.rollVictim)a.root.position.copy(gripPos);else a.root.position.lerp(gripPos,1-Math.exp(-8*dt));
   a.root.userData.animate?.(this.time,this.rollTimer>0?.4:2);
   if(this.rollTimer>0){this.rollSplash+=dt;if(this.rollSplash>.18&&this.particles.length<14){this.rollSplash=0;this.ripple();this.splash();}}
   if(this.damageCooldown<=0&&!swim){this.state.health=Math.max(0,this.state.health-4);this.damageCooldown=3;this.sfx(90,.1)}
   if(this.grip<=0){a.flee=10;this.grabbed=null;this.notify('Your grip slipped. Recover stamina and stalk again.')}
  }
  if(this.rollVictim&&this.rollTimer<=0){const victim=this.rollVictim;this.rollVictim=null;if(victim===this.grabbed&&victim.alive){victim.hp-=2;if(victim.hp<=0)this.kill(victim)}}
  this.state.grip=this.grabbed?this.grip:0;this.state.meal=!!this.nearestMeal();this.state.basking=this.basking;this.state.feeding=this.feedingTimer>0;this.state.rolling=this.rollTimer>0;
  const marker=LANDMARKS.find(m=>m.id===this.waypointId);this.state.waypointDistance=marker?Math.hypot(marker.x-p.x,marker.z-p.z):0;this.state.waypointBearing=marker?angleDelta(this.yaw,Math.atan2(p.x-marker.x,p.z-marker.z))*180/Math.PI:0;
  this.wakeTimer+=dt;if(swim&&Math.abs(this.speed)>1&&this.wakeTimer>.65&&this.particles.length<8){this.wakeTimer=0;this.ripple()}
  if(this.state.health<=0){this.dead=true;this.state.dead=true;this.clearInput();this.grabbed=null;this.rollVictim=null;this.rollTimer=0;this.notify('Your time in the estuary has ended.');this.updateUI()}
 }
 private stepAnimals(dt:number,stalk:boolean,swim:boolean){
  const p=this.croc.root.position;let nearby:Animal|undefined,best=26;
  for(const a of this.animals){
   const dist=a.root.position.distanceTo(p);
   if(!a.alive){a.respawn-=dt;if(a.servings){a.root.visible=dist<230;a.root.position.y=Math.max(heightAt(a.root.position.x,a.root.position.z)+.7,waterLevel(this.time)-.22)}if(a.respawn<0&&a.home.distanceTo(p)>40){a.alive=true;a.hp=a.kind==='buffalo'?3:1;a.root.visible=true;a.root.position.copy(a.home);a.root.rotation.set(0,a.angle+Math.PI,0);a.velocity=0;a.servings=0;a.awareness=0}continue}
   if(dist<best){best=dist;nearby=a}a.root.visible=dist<250;if(a===this.grabbed)continue;
   if(!validHabitat(a.kind,a.root.position.x,a.root.position.z,waterLevel(this.time))){const safe=habitatPoint(a.kind,a.root.position.x,a.root.position.z,waterLevel(this.time));if(!safe){a.root.visible=false;continue}a.root.position.x=safe.x;a.root.position.z=safe.z;a.velocity=0;}
   if(dist>250)continue;
   a.phase+=dt;const fear=a.kind==='buffalo'?(this.diving?5:stalk&&swim?8:20):a.kind==='fish'?(stalk?3.2:7):4;
   const detected=dist<fear&&(Math.abs(this.speed)>(stalk?.8:1.1)||dist<3.5||!swim&&a.kind==='buffalo');a.awareness=clamp(a.awareness+(detected?.8:-.2)*dt,0,1);a.flee=Math.max(0,a.flee-dt);
   const fleeing=a.awareness>.55||a.flee>0;
   if(fleeing)a.angle=Math.atan2(a.root.position.x-p.x,a.root.position.z-p.z);
   else{const homeDist=a.root.position.distanceTo(a.home);if(homeDist>(a.kind==='fish'?24:18))a.angle+=angleDelta(a.angle,Math.atan2(a.home.x-a.root.position.x,a.home.z-a.root.position.z))*dt;else a.angle+=Math.sin(a.phase*.6)*dt*.24}
   const velocity=a.kind==='fish'?(fleeing?3.2:.6):a.kind==='buffalo'?(fleeing?3.6:.24):fleeing?.65:.12;a.velocity=approach(a.velocity,velocity,3,dt);
   const x=a.root.position.x+Math.sin(a.angle)*a.velocity*dt,z=a.root.position.z+Math.cos(a.angle)*a.velocity*dt;const valid=validHabitat(a.kind,x,z,waterLevel(this.time));
   if(valid&&Math.abs(x)<HALF-20&&Math.abs(z)<HALF-20){a.root.position.x=x;a.root.position.z=z}else{for(const offset of [Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2,Math.PI]){const alternative=a.angle+offset,ax=a.root.position.x+Math.sin(alternative)*a.velocity*dt,az=a.root.position.z+Math.cos(alternative)*a.velocity*dt;if(validHabitat(a.kind,ax,az,waterLevel(this.time))&&Math.abs(ax)<HALF-20&&Math.abs(az)<HALF-20){a.root.position.x=ax;a.root.position.z=az;a.angle=alternative;break}}}
   const actualH=heightAt(a.root.position.x,a.root.position.z);a.root.position.y=a.kind==='fish'?Math.max(actualH+.35,waterLevel(this.time)-1.04+Math.sin(a.phase)*.15):actualH;a.root.rotation.y=a.angle+Math.PI;a.root.userData.animate?.(this.time+a.phase,a.velocity);
  }
  const bearing=nearby?angleDelta(this.croc.root.rotation.y,Math.atan2(p.x-nearby.root.position.x,p.z-nearby.root.position.z)):0;const direction=Math.abs(bearing)<.5?'AHEAD':Math.abs(bearing)>2.5?'BEHIND':bearing>0?'LEFT':'RIGHT';this.state.canBite=!!nearby&&best<4.7&&Math.cos(bearing)*Math.hypot(p.x-nearby.root.position.x,p.z-nearby.root.position.z)/Math.max(.01,best)>.45;this.state.target=this.grabbed?'BUFFALO · IN YOUR GRIP':nearby?`${nearby.kind.toUpperCase()} · ${Math.round(best)} M · ${direction}`:'';this.state.awareness=nearby?.awareness||0;
 }
 private updateCamera(dt:number){
  const p=this.croc.root.position;if(!this.started){this.yaw=.55+Math.sin(this.ambientTime*.035)*.14;this.pitch=.31;this.zoom=8.8}
  const target=p.clone().add(new T.Vector3(0,.48,0)),pitch=this.diving&&this.cameraIdle<=0?Math.min(this.pitch,.13):this.pitch,zoom=this.diving?Math.min(this.zoom,7.8):this.zoom,offset=new T.Vector3(Math.sin(this.yaw)*zoom*Math.cos(pitch),zoom*Math.sin(pitch)+.6,Math.cos(this.yaw)*zoom*Math.cos(pitch)),pos=target.clone().add(offset);pos.y=Math.max(pos.y,heightAt(pos.x,pos.z)+.85);this.camera.position.lerp(pos,1-Math.exp(-6*dt));this.camera.lookAt(target);
 }
 private updateUI(){this.state.fps=Math.round(this.fpsSamples.reduce((a,b)=>a+b,0)/Math.max(1,this.fpsSamples.length));this.state.drawCalls=this.renderer.info.render.calls;this.onUpdate({...this.state,landmarks:[...this.state.landmarks]})}
 private baseMap?:HTMLCanvasElement;
 private drawBaseMap(){
  this.baseMap=document.createElement('canvas');this.baseMap.width=256;this.baseMap.height=256;const c=this.baseMap.getContext('2d')!,image=c.createImageData(256,256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){const wx=(x/256-.5)*WORLD_SIZE,wz=(y/256-.5)*WORLD_SIZE,h=heightAt(wx,wz),biome=biomeAt(wx,wz);const rgb=h<0?[33,89,91]:h<1?[149,137,93]:biome==='RAINFOREST TRIBUTARY'?[43,82,61]:[82,112,66],i=(y*256+x)*4;image.data[i]=rgb[0];image.data[i+1]=rgb[1];image.data[i+2]=rgb[2];image.data[i+3]=255}c.putImageData(image,0,0);
 }
 private drawMap(){
  const c=this.map.getContext('2d');if(!c||!this.baseMap)return;const w=this.map.width;c.clearRect(0,0,w,w);c.drawImage(this.baseMap,0,0,w,w);c.strokeStyle='#d4d7bd25';c.lineWidth=1;for(let i=1;i<4;i++){c.beginPath();c.moveTo(w*i/4,0);c.lineTo(w*i/4,w);c.moveTo(0,w*i/4);c.lineTo(w,w*i/4);c.stroke()}
  for(const a of this.animals){if(a.alive&&a.root.position.distanceTo(this.croc.root.position)<120){c.fillStyle=a.kind==='buffalo'?'#e4b56d':'#aadfcf';const x=(a.root.position.x/WORLD_SIZE+.5)*w,y=(a.root.position.z/WORLD_SIZE+.5)*w;c.beginPath();c.arc(x,y,a.kind==='buffalo'?2:1,0,7);c.fill()}}
  for(const l of LANDMARKS){const x=(l.x/WORLD_SIZE+.5)*w,y=(l.z/WORLD_SIZE+.5)*w;c.fillStyle=this.waypointId===l.id?'#ffdd98':this.state.landmarks.includes(l.id)?'#e7d8b0':'#cfdbc18a';c.fillRect(x-2,y-2,4,4);if(this.waypointId===l.id){c.strokeStyle='#ffdd98';c.beginPath();c.arc(x,y,6,0,Math.PI*2);c.stroke()}}
  const x=(this.state.x/WORLD_SIZE+.5)*w,y=(this.state.z/WORLD_SIZE+.5)*w;c.save();c.translate(x,y);c.rotate(-this.croc.root.rotation.y);c.fillStyle='#fff3d0';c.shadowColor='#000';c.shadowBlur=4;c.beginPath();c.moveTo(0,-6);c.lineTo(4,5);c.lineTo(0,3);c.lineTo(-4,5);c.closePath();c.fill();c.restore();
 }
 private ripple(){const m=new T.Mesh(new T.RingGeometry(.8,1,24),new T.MeshBasicMaterial({color:0xc7ecdc,transparent:true,opacity:.24,side:T.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(this.croc.root.position.x,waterLevel(this.time)+.025,this.croc.root.position.z);this.scene.add(m);this.particles.push({mesh:m,life:2,max:2})}
 private splash(){
  const p=this.croc.root.position,water=waterLevel(this.time);if(p.y<water-.75)return;
  for(let i=0;i<2&&this.particles.length<18;i++){
   const a=this.time*17+i*Math.PI,r=.45;
   const droplet=new T.Mesh(new T.SphereGeometry(.065,6,4),new T.MeshBasicMaterial({color:0xd5eee5,transparent:true,opacity:.65,depthWrite:false}));
   droplet.position.set(p.x+Math.cos(a)*r,water+.1,p.z+Math.sin(a)*r-.7);this.scene.add(droplet);
   this.particles.push({mesh:droplet,life:.65,max:.65,velocity:new T.Vector3(Math.cos(a)*1.8,1.7,Math.sin(a)*1.8)});
  }
 }
 private initAudio(){if(this.audio)return;try{this.audio=new AudioContext();const len=this.audio.sampleRate*4,buf=this.audio.createBuffer(1,len,this.audio.sampleRate),data=buf.getChannelData(0);let v=0;for(let i=0;i<len;i++){v=(v+Math.random()*.055-.0275)*.98;data[i]=v}const src=this.audio.createBufferSource();src.buffer=buf;src.loop=true;const filter=this.audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=720;this.ambience=this.audio.createGain();this.ambience.gain.value=this.muted?0:.065;src.connect(filter).connect(this.ambience).connect(this.audio.destination);src.start();this.audioSources.push(src);this.audioNodes.push(filter,this.ambience)}catch{}}
 private sfx(f:number,d:number){if(!this.audio||this.muted)return;const o=this.audio.createOscillator(),g=this.audio.createGain();o.type='triangle';o.frequency.setValueAtTime(f,this.audio.currentTime);o.frequency.exponentialRampToValueAtTime(40,this.audio.currentTime+d);g.gain.setValueAtTime(.08,this.audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,this.audio.currentTime+d);o.connect(g).connect(this.audio.destination);o.start();o.stop(this.audio.currentTime+d);o.onended=()=>{o.disconnect();g.disconnect()}}
 dispose(){
  this.disposed=true;cancelAnimationFrame(this.frame);window.removeEventListener('resize',this.resize);window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);
  const el=this.renderer.domElement;el.removeEventListener('pointerdown',this.pointerDown);el.removeEventListener('pointerup',this.pointerUp);el.removeEventListener('pointercancel',this.pointerCancel);el.removeEventListener('lostpointercapture',this.pointerCancel);el.removeEventListener('pointermove',this.pointerMove);el.removeEventListener('wheel',this.wheel);el.removeEventListener('contextmenu',this.contextMenu);el.removeEventListener('webglcontextlost',this.contextLost);
  const geos=new Set<T.BufferGeometry>(),mats=new Set<T.Material>(),textures=new Set<T.Texture>();this.scene.traverse(o=>{if(o instanceof T.Mesh){geos.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{mats.add(m);Object.values(m).forEach(v=>{if(v instanceof T.Texture)textures.add(v)})})}});this.world.dispose();geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());this.croc.skin.skeleton.dispose();this.renderer.dispose();el.remove();this.audio?.close().catch(()=>{});
 }
}
