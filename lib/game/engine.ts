import * as T from 'three';
import {makeWorld,heightAt,riverCenter,biomeAt,seeded,HALF,WORLD_SIZE,waterLevel,LANDMARKS} from './world';
import {crocodile,fish,crab,buffalo,bird,bullShark,hippo,plover,wadingBird,rivalCroc} from './models';
import {habitatPoint,validHabitat} from './habitat';
import {ROLL_DURATION,rollPose} from './motion';
import {SoftwareRenderer} from './software-renderer';
import {angleDelta,joystickHeading,approach,clamp,type Joystick} from './input';
import {readSave,writeSave,type ExpeditionSave} from './storage';
import {JungleAudio} from './audio';
export type Snapshot={health:number;hunger:number;stamina:number;air:number;warmth:number;mode:string;biome:string;speed:number;depth:number;kills:number;fishCaught:number;buffaloCaught:number;growth:number;distance:number;regions:number;landmarks:string[];elapsed:number;time:string;heading:number;fps:number;message:string;target:string;canBite:boolean;awareness:number;grip:number;meal:boolean;basking:boolean;dead:boolean;started:boolean;paused:boolean;x:number;z:number;drawCalls:number;renderer:string;waypoint:string;waypointDistance:number;waypointBearing:number;canContinue:boolean;feeding:boolean;rolling:boolean;quality:string;title:string;rivalNear:string};
export const initial:Snapshot={health:100,hunger:70,stamina:100,air:100,warmth:72,mode:'SURFACE',biome:'MANGROVE REACH',speed:0,depth:0,kills:0,fishCaught:0,buffaloCaught:0,growth:0,distance:0,regions:1,landmarks:[],elapsed:0,time:'16:42',heading:0,fps:0,message:'The estuary is yours.',target:'',canBite:false,awareness:0,grip:0,meal:false,basking:false,dead:false,started:false,paused:false,x:0,z:-38,drawCalls:0,renderer:'WebGL',waypoint:'',waypointDistance:0,waypointBearing:0,canContinue:false,feeding:false,rolling:false,quality:'Balanced',title:'Yearling (5-6 ft)',rivalNear:''};
export type Animal={root:T.Group;kind:'fish'|'crab'|'buffalo';alive:boolean;hp:number;home:T.Vector3;angle:number;phase:number;respawn:number;flee:number;awareness:number;velocity:number;servings:number;drinkTimer?:number;drinking?:boolean;drinkSpot?:{x:number;z:number};crossing?:boolean;crossTarget?:{x:number;z:number};crossTimer?:number};
export type RivalKind='croc'|'shark'|'hippo';
export type Rival={root:T.Group;kind:RivalKind;name:string;alive:boolean;hp:number;maxHp:number;home:T.Vector3;territoryRadius:number;angle:number;phase:number;respawn:number;velocity:number;servings:number;warningTimer:number;attackCooldown:number;fleeing?:boolean};
export type PloverBird={root:T.Group;landed:boolean;hopTimer:number};
export type WaderBird={root:T.Group;home:T.Vector3;fleeing:boolean;fleeTimer:number};
export class Engine{
 scene=new T.Scene();camera=new T.PerspectiveCamera(55,1,.1,1100);renderer:T.WebGLRenderer|SoftwareRenderer;state:Snapshot={...initial,landmarks:[]};croc=crocodile();world:ReturnType<typeof makeWorld>;animals:Animal[]=[];rivals:Rival[]=[];plovers:PloverBird[]=[];waders:WaderBird[]=[];
 keys=new Set<string>();touch:{joystick:Joystick;sprint:boolean;stalk:boolean}={joystick:{x:0,y:0},sprint:false,stalk:false};yaw=.42;pitch=.33;zoom=9;sensitivity=1;diving=false;muted=false;quality=2;started=false;paused=false;dead=false;disposed=false;
 private frame=0;private time=0;private ambientTime=0;private last=0;private accumulator=0;private speed=0;private turnAmount=0;private biteTimer=0;private attackCooldown=0;private rollTimer=0;private rollVictim:Animal|null=null;private rollSplash=0;private feedingTimer=0;private messageTimer=5;private damageCooldown=0;private regions=new Set(['MANGROVE REACH']);private uiTimer=0;private fpsSamples:number[]=[];private cameraPointer:number|null=null;private oldX=0;private oldY=0;private pointerStartX=0;private pointerStartY=0;private pointerStartTime=0;private pointerButton=0;private cameraIdle=0;private grabbed:Animal|null=null;private grabbedRival:Rival|null=null;private rollRivalVictim:Rival|null=null;private tailWhipTimer=0;private tailWhipCooldown=0;private grip=0;private basking=false;private birds:{root:T.Group;angle:number;radius:number;y:number;speed:number}[]=[];private ploverSoundTimer=0;
 private particles:{mesh:T.Mesh;life:number;max:number;velocity?:T.Vector3}[]=[];private audio:JungleAudio|null=null;private sun:T.DirectionalLight;private waypointId='';private autoQuality=true;private slowFrames=0;private wakeTimer=0;private saved:ExpeditionSave|null=null;
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
  for(let i=0;i<16;i++){const z=i<4?30+i*6:i<12?450+(i-4)*8:125+(i-12)*10;const x=riverCenter(z)+(i<4?-1:1)*(47+rng()*10);this.spawn('buffalo',x,z,rng,i)}for(let i=0;i<6;i++)this.spawn('buffalo',-325-rng()*80,20+rng()*90,rng,i+16);this.populateRivals(rng);this.populateWaders(rng);this.populatePlover();
 }
 private spawn(kind:Animal['kind'],x:number,z:number,rng:()=>number,index:number){
  const safe=habitatPoint(kind,x,z);if(!safe)return;x=safe.x;z=safe.z;
  const root=kind==='fish'?fish(index%3):kind==='crab'?crab():buffalo();const y=kind==='fish'?Math.max(heightAt(x,z)+.5,-.82-rng()*.5):heightAt(x,z);
  root.position.set(x,y,z);root.rotation.y=rng()*Math.PI*2;this.scene.add(root);this.animals.push({root,kind,alive:true,hp:kind==='buffalo'?3:1,home:root.position.clone(),angle:root.rotation.y+Math.PI,phase:rng()*8,respawn:0,flee:0,awareness:0,velocity:0,servings:0});
 }
 private populateRivals(rng:()=>number){
  if(!this.rivals)this.rivals=[];
  const rivalDefs:[RivalKind,string,number,number,number,number,number][]=[
   ['croc','Old Scarface Bull',riverCenter(130),130,48,10,6],
   ['croc','Ironjaw Dominant',riverCenter(-380),-380,55,12,6],
   ['croc','The Marsh King',riverCenter(520),520,52,14,7],
   ['shark','Bull Shark',riverCenter(-580),-580,35,4,3],
   ['shark','Bull Shark',riverCenter(-240),-240,35,4,3],
   ['shark','Channel Shark',riverCenter(260),260,35,4,3],
   ['shark','Tidal Shark',-240,-720,40,5,3],
   ['hippo','Bull Hippo',135,240,32,9,5],
   ['hippo','River Hippo',155,310,30,8,5],
   ['hippo','Lagoon Hippo',-285,75,30,8,5],
  ];
  for(const [kind,name,x,z,territoryRadius,maxHp,servings] of rivalDefs){
   const root=kind==='croc'?rivalCroc().root:kind==='shark'?bullShark():hippo();
   const water=0,h=heightAt(x,z);
   const y=kind==='shark'?Math.max(h+.5,water-.75):kind==='croc'?Math.max(h+.05,water-.12):Math.max(h,water-.25);
   root.position.set(x,y,z);
   root.rotation.y=rng()*Math.PI*2;
   this.scene.add(root);
   this.rivals.push({root,kind,name,alive:true,hp:maxHp,maxHp,home:root.position.clone(),territoryRadius,angle:root.rotation.y,phase:rng()*10,respawn:0,velocity:0,servings:0,warningTimer:0,attackCooldown:0});
  }
 }
 private populateWaders(rng:()=>number){
  if(!this.waders)this.waders=[];
  const spots=[{x:riverCenter(50)+26,z:50},{x:riverCenter(190)-28,z:190},{x:115,z:210},{x:175,z:380},{x:riverCenter(470)+32,z:470},{x:riverCenter(-180)-25,z:-180},{x:riverCenter(-440)+30,z:-440},{x:-210,z:-640}];
  for(const s of spots){
   const x=s.x+(rng()-.5)*12,z=s.z+(rng()-.5)*12,h=heightAt(x,z);
   if(h<-.4||h>1.8)continue;
   const root=wadingBird();root.position.set(x,h,z);root.rotation.y=rng()*Math.PI*2;
   this.scene.add(root);
   this.waders.push({root,home:root.position.clone(),fleeing:false,fleeTimer:0});
  }
 }
 private populatePlover(){
  if(!this.plovers)this.plovers=[];
  for(let i=0;i<2;i++){
   const root=plover();root.visible=false;
   this.scene.add(root);
   this.plovers.push({root,landed:false,hopTimer:0});
  }
 }
 private sandDust(pos:T.Vector3){
  for(let i=0;i<2&&this.particles.length<22;i++){
   const m=new T.Mesh(new T.SphereGeometry(.14+Math.random()*.08,5,4),new T.MeshBasicMaterial({color:0xd4c69b,transparent:true,opacity:.42,depthWrite:false}));
   m.position.set(pos.x+(Math.random()-.5)*.7,pos.y+.12,pos.z+(Math.random()-.5)*.7);
   this.scene.add(m);
   this.particles.push({mesh:m,life:.55,max:.55,velocity:new T.Vector3((Math.random()-.5)*.4,.45+Math.random()*.3,(Math.random()-.5)*.4)});
  }
 }
 private bloodBurst(pos:T.Vector3){
  for(let i=0;i<5&&this.particles.length<26;i++){
   const a=Math.random()*Math.PI*2,speed=1.2+Math.random()*2.2;
   const droplet=new T.Mesh(new T.SphereGeometry(.075+Math.random()*.045,5,4),new T.MeshBasicMaterial({color:i%2?0x881818:0xb52b2b,transparent:true,opacity:.78,depthWrite:false}));
   droplet.position.set(pos.x+(Math.random()-.5)*.4,pos.y+.2,pos.z+(Math.random()-.5)*.4);
   this.scene.add(droplet);
   this.particles.push({mesh:droplet,life:.7,max:.7,velocity:new T.Vector3(Math.cos(a)*speed,1.4+Math.random()*1.8,Math.sin(a)*speed)});
  }
 }
 start(){this.started=true;this.dead=false;this.paused=false;this.state.started=true;this.state.paused=false;this.last=performance.now();this.notify('Take it slowly. Fish gather just ahead of you.');this.initAudio();this.audio?.resume();this.onPause(false);this.renderer.domElement.focus()}
 pause(value=true){this.paused=value;this.state.paused=value;this.clearInput();this.onPause(value);if(!value){this.last=performance.now();this.renderer.domElement.focus()}this.updateUI()}
 clearInput(){this.keys.clear();this.touch.joystick={x:0,y:0};this.touch.sprint=false;this.touch.stalk=false;this.cameraPointer=null}
 restart(){
  this.croc.root.position.set(riverCenter(-38)+14,-.12,-38);this.croc.root.rotation.set(0,0,0);const renderer=this.state.renderer,quality=this.state.quality;this.state={...initial,landmarks:[],renderer,quality,started:true,canContinue:!!this.saved};this.speed=0;this.time=0;this.diving=false;this.dead=false;this.grabbed=null;this.grabbedRival=null;this.rollRivalVictim=null;this.tailWhipTimer=0;this.tailWhipCooldown=0;this.grip=0;this.basking=false;this.rollTimer=0;this.rollVictim=null;this.rollSplash=0;this.croc.reset();this.biteTimer=0;this.attackCooldown=0;this.feedingTimer=0;this.regions=new Set(['MANGROVE REACH']);this.waypointId='';this.yaw=.42;
  this.animals.forEach(a=>{a.alive=true;a.hp=a.kind==='buffalo'?3:1;a.root.visible=true;a.root.position.copy(a.home);a.root.rotation.set(0,a.angle+Math.PI,0);a.velocity=0;a.flee=0;a.awareness=0;a.servings=0;a.drinking=false;a.drinkSpot=undefined;a.crossing=false;a.crossTarget=undefined;a.crossTimer=35+((a.phase*7)%45);});
  this.rivals?.forEach(r=>{r.alive=true;r.hp=r.maxHp;r.root.visible=true;r.root.position.copy(r.home);r.root.rotation.set(0,r.angle,0);r.velocity=0;r.servings=0;r.fleeing=false;});
  this.waders?.forEach(w=>{w.fleeing=false;w.root.position.copy(w.home);});
  this.plovers?.forEach(pl=>{pl.landed=false;pl.root.visible=false;});
  this.clearInput();this.start();
 }
 continue(){if(!this.saved)return;const s=this.saved;this.restart();Object.assign(this.state,{health:s.health,hunger:s.hunger,stamina:s.stamina,air:100,warmth:s.warmth,growth:s.growth,kills:s.kills,fishCaught:s.fishCaught,buffaloCaught:s.buffaloCaught,distance:s.distance,elapsed:s.elapsed,landmarks:[...s.landmarks]});const ground=heightAt(s.x,s.z);this.croc.root.position.set(s.x,ground<-.45?waterLevel(s.elapsed)-.12:ground+.035,s.z);this.croc.root.rotation.y=s.heading;this.yaw=s.heading;this.time=s.elapsed;this.regions=new Set(s.regions);this.world.update(s.x,s.z,this.time,this.quality);this.notify('Your expedition continues.');this.updateUI()}
 save(){if(!this.started||this.dead)return false;const p=this.croc.root.position;const s:ExpeditionSave={version:2,health:this.state.health,hunger:this.state.hunger,stamina:this.state.stamina,air:this.state.air,warmth:this.state.warmth,growth:this.state.growth,kills:this.state.kills,fishCaught:this.state.fishCaught,buffaloCaught:this.state.buffaloCaught,distance:this.state.distance,elapsed:this.time,x:p.x,y:p.y,z:p.z,heading:this.croc.root.rotation.y,regions:[...this.regions],landmarks:[...this.state.landmarks],savedAt:new Date().toISOString()};const ok=writeSave(s);if(ok){this.saved=s;this.state.canContinue=true;this.notify('Expedition saved on this device.')}else this.notify('This browser could not save your expedition.');return ok}
 setQuality(level:number){this.quality=clamp(Math.round(level),1,3);this.autoQuality=false;this.state.quality=['','Performance','Balanced','Cinematic'][this.quality];this.renderer.setPixelRatio(Math.min(devicePixelRatio,[0,1,1.35,1.7][this.quality]));this.renderer.shadowMap.enabled=this.quality>1&&!(this.renderer instanceof SoftwareRenderer);this.resize();this.updateUI()}
 setMuted(value:boolean){this.muted=value;this.audio?.setMuted(value)}
 setJoystick(joy:Joystick){this.touch.joystick=joy}
 look(dx:number,dy:number){this.yaw-=dx*.004*this.sensitivity;this.pitch=clamp(this.pitch+dy*.003*this.sensitivity,-.16,1.05);this.cameraIdle=5}
 resetCamera(){this.yaw=this.croc.root.rotation.y;this.pitch=.33;this.zoom=9;this.cameraIdle=0}
 waypoint(id:string){this.waypointId=this.waypointId===id?'':id;const marker=LANDMARKS.find(l=>l.id===this.waypointId);this.state.waypoint=marker?.name||'';this.updateUI()}
 dive(){if(!this.started||this.paused||this.dead)return;if(heightAt(this.croc.root.position.x,this.croc.root.position.z)<waterLevel(this.time)-1){this.diving=!this.diving;this.basking=false;this.notify(this.diving?'Keep an eye on your air. Space / Rise returns to the surface.':'Rising to the surface.')}else this.notify('The water is too shallow. Find the main channel.')}
 surface(){this.diving=false}
 bask(){if(!this.started||this.paused||this.dead)return;const p=this.croc.root.position;if(heightAt(p.x,p.z)<waterLevel(this.time)+.1){this.notify('Find a dry bank to bask.');return}this.basking=!this.basking;this.diving=false;if(this.basking)this.audio?.playBaskWarmth();this.notify(this.basking?'Basking restores warmth and helps you recover.':'Back on the hunt.')}
 tailWhip(){
  if(!this.started||this.paused||this.dead||this.tailWhipCooldown>0||this.rollTimer>0)return;
  if(this.state.stamina<12){this.notify('Low stamina for tail whip.');return}
  this.state.stamina-=12;this.tailWhipCooldown=1.05;this.tailWhipTimer=0.42;this.basking=false;
  this.audio?.playTailWhip();
  const p=this.croc.root.position,water=waterLevel(this.time),swim=heightAt(p.x,p.z)<water-.5;
  if(swim)this.ripple();else this.sandDust(p);
  const forward=new T.Vector3(-Math.sin(this.croc.root.rotation.y),0,-Math.cos(this.croc.root.rotation.y));
  let hit=false;
  for(const r of (this.rivals||[])){
   if(r===this.grabbedRival)continue;
   if(!r.alive)continue;
   const delta=r.root.position.clone().sub(p),dist=delta.length();
   if(dist<6.4&&delta.clone().normalize().dot(forward)<.4){
    r.hp-=2;r.attackCooldown=2.5;r.warningTimer=2;r.velocity=-4.5;
    const knock=delta.clone().normalize().multiplyScalar(4.2);
    r.root.position.add(knock);
    this.bloodBurst(r.root.position);
    hit=true;
    if(r.hp<=0)this.killRival(r);
    else this.notify(`Tail whip knocked back ${r.name}! (HP ${r.hp}/${r.maxHp})`);
   }
  }
  if(!hit){
   for(const a of this.animals){
    if(!a.alive)continue;
    const delta=a.root.position.clone().sub(p),dist=delta.length();
    if(dist<5.2){
     a.flee=8;a.awareness=1;
     if(a.kind==='buffalo'){a.hp--;if(a.hp<=0)this.kill(a)}
     else this.kill(a);
     hit=true;break;
    }
   }
  }
  this.updateUI();
 }
 interact(){if(!this.started||this.paused||this.dead||this.rollTimer>0)return;if(this.grabbed){this.grabbed.flee=8;this.grabbed=null;this.grip=0;this.notify('Prey released.');return}if(this.grabbedRival){this.grabbedRival.warningTimer=3;this.grabbedRival=null;this.grip=0;this.notify('Rival released from jaw lock.');return}const meal=this.nearestMeal();if(meal&&this.feedingTimer<=0){meal.servings--;this.feedingTimer=1.8;this.biteTimer=.7;this.state.hunger=clamp(this.state.hunger+24,0,100);this.state.health=clamp(this.state.health+4,0,100);this.state.growth=clamp(this.state.growth+9,0,100);const mLen=(5.0+this.state.growth*0.0414).toFixed(1);const ftLen=(parseFloat(mLen)*3.28084).toFixed(1);this.notify(`Feeding. +24 nutrition · +9 growth · ${ftLen} ft (${mLen} m)`);this.audio?.playFeed();if(!meal.servings)meal.root.visible=false;this.updateUI()}else if(!meal)this.bask()}
 attack(){
  if(!this.started||this.paused||this.dead||this.attackCooldown>0||this.feedingTimer>0||this.rollTimer>0)return;
  this.basking=false;this.biteTimer=.45;this.attackCooldown=.75;this.audio?.playBite();this.audio?.playBiteLunge();
  const p=this.croc.root.position,water=waterLevel(this.time),ground=heightAt(p.x,p.z),swim=ground<water-.5;
  this.speed=Math.max(this.speed+(swim?5.5:4.0),swim?8.0:5.5);
  if(this.grabbed){this.grabbed.hp--;this.grip=Math.min(100,this.grip+15);this.bloodBurst(this.grabbed.root.position);if(this.grabbed.hp<=0)this.kill(this.grabbed);this.ripple();return}
  if(this.grabbedRival){this.grabbedRival.hp-=2;this.grip=Math.min(100,this.grip+15);this.bloodBurst(this.grabbedRival.root.position);if(this.grabbedRival.hp<=0){this.killRival(this.grabbedRival);this.grabbedRival=null;this.grip=0;}else this.notify(`Biting clamped ${this.grabbedRival.name}! Strike again or press R to Death Roll.`);this.ripple();return;}
  const forward=new T.Vector3(-Math.sin(this.croc.root.rotation.y),0,-Math.cos(this.croc.root.rotation.y));let found:Animal|undefined,nearest=4.7+this.state.growth*0.02;
  for(const a of this.animals){if(!a.alive)continue;const delta=a.root.position.clone().sub(p),dist=delta.length();if(dist<nearest&&delta.clone().normalize().dot(forward)>.45){found=a;nearest=dist}}
  let foundRival:Rival|undefined;
  for(const r of (this.rivals||[])){if(!r.alive)continue;const delta=r.root.position.clone().sub(p),dist=delta.length();if(dist<nearest&&delta.clone().normalize().dot(forward)>.45){foundRival=r;found=undefined;nearest=dist}}
  if(found){found.hp--;found.flee=7;this.bloodBurst(found.root.position);
   if(found.kind==='buffalo'){this.grabbed=found;this.grip=100;found.awareness=1;this.state.health=clamp(this.state.health-4,0,100);this.damageCooldown=3;this.audio?.playBuffaloGrunt();this.notify('Grabbed! Drag into water, then R / Roll. E releases your grip.');}
   else this.kill(found);
  }else if(foundRival){
   foundRival.hp--;foundRival.warningTimer=0;this.bloodBurst(foundRival.root.position);this.audio?.playRollThrash();
   if(this.state.growth>=55){
    if(foundRival.hp<=2&&foundRival.hp>0){foundRival.fleeing=true;this.notify(`The ${foundRival.name.toLowerCase()} is wounded and fleeing your dominance!`)}
    else if(foundRival.hp<=0){this.killRival(foundRival)}
    else this.notify(`Biting ${foundRival.name}! Strike again to crush them. (HP ${foundRival.hp}/${foundRival.maxHp})`);
   }else{
    this.state.health=Math.max(0,this.state.health-(foundRival.kind==='hippo'?14:foundRival.kind==='croc'?10:7));
    this.damageCooldown=2.5;if(foundRival.kind==='croc')this.audio?.playCrocRoar();else if(foundRival.kind==='hippo')this.audio?.playHippoGrunt();
    if(foundRival.hp<=0)this.killRival(foundRival);
    else this.notify(`The ${foundRival.name} is too powerful! Grow larger before challenging adult rivals.`);
   }
  }else this.notify('Aim your snout at prey and close the gap.');this.ripple();this.updateUI();
 }
 roll(){
  if(!this.started||this.paused||this.dead||this.rollTimer>0)return;
  if(!this.grabbed&&!this.grabbedRival){this.notify('Bite and hold large prey before rolling.');return}
  if(this.state.stamina<22){this.notify('Rest to recover enough stamina for a roll.');return}
  const p=this.croc.root.position;
  if(heightAt(p.x,p.z)>waterLevel(this.time)-.55){this.notify('Pull into deeper water to roll.');return}
  this.state.stamina-=22;this.rollTimer=ROLL_DURATION;this.rollSplash=0;this.state.rolling=true;this.grip=Math.min(100,this.grip+30);
  if(this.grabbedRival){this.rollRivalVictim=this.grabbedRival;this.notify(`Death roll! Tearing into ${this.grabbedRival.name}!`);}
  else{this.rollVictim=this.grabbed;this.notify('Death roll! Holding your catch through the turn.');}
  this.audio?.playRollThrash();this.ripple();this.bloodBurst(p);this.updateUI();
 }
 private kill(a:Animal){
  a.alive=false;a.respawn=90;a.flee=0;a.servings=a.kind==='buffalo'?3:0;if(this.grabbed===a){this.grabbed=null;this.grip=0}this.state.kills++;
  const mLen=(5.0+this.state.growth*0.0414).toFixed(1);const ftLen=(parseFloat(mLen)*3.28084).toFixed(1);
  if(a.kind==='buffalo'){this.state.buffaloCaught++;a.root.rotation.set(0,this.croc.root.rotation.y+.8,Math.PI/2);a.root.position.y=Math.max(heightAt(a.root.position.x,a.root.position.z)+.7,waterLevel(this.time)-.22);this.notify('A successful ambush. E / Feed to eat your catch.');}
  else{a.root.visible=false;if(a.kind==='fish')this.state.fishCaught++;this.state.hunger=clamp(this.state.hunger+(a.kind==='fish'?14:9),0,100);this.state.health=clamp(this.state.health+2,0,100);this.state.growth=clamp(this.state.growth+(a.kind==='fish'?8:5),0,100);this.notify(a.kind==='fish'?`Fish caught. +14 nutrition · +8 growth · ${ftLen} ft`:`Crab caught. +9 nutrition · +5 growth · ${ftLen} ft`)}
  this.audio?.playBite();
 }
 private killRival(r:Rival){
  r.alive=false;r.respawn=180;r.servings=r.kind==='croc'?6:r.kind==='hippo'?5:3;
  this.state.kills++;
  const mLen=(5.0+this.state.growth*0.0414).toFixed(1);const ftLen=(parseFloat(mLen)*3.28084).toFixed(1);
  const growthGain=r.kind==='croc'?25:r.kind==='hippo'?20:10;
  this.state.growth=clamp(this.state.growth+growthGain,0,100);
  this.state.hunger=clamp(this.state.hunger+40,0,100);
  this.state.health=clamp(this.state.health+15,0,100);
  r.root.rotation.set(0,r.root.rotation.y+.6,Math.PI/2);
  r.root.position.y=Math.max(heightAt(r.root.position.x,r.root.position.z)+.6,waterLevel(this.time)-.2);
  this.bloodBurst(r.root.position);
  this.notify(`Apex triumph! Defeated ${r.name}. +${growthGain} growth · ${ftLen} ft (${mLen} m). E feeds.`);
  this.audio?.playRollThrash();
 }
 private nearestMeal(){
  const p=this.croc.root.position;
  const a=this.animals.find(a=>!a.alive&&a.servings>0&&a.root.position.distanceTo(p)<6);
  if(a)return a;
  const r=(this.rivals||[]).find(r=>!r.alive&&r.servings>0&&r.root.position.distanceTo(p)<7.5);
  return r;
 }
 private notify(msg:string){this.state.message=msg;this.messageTimer=6;this.updateUI()}
 private keyDown=(e:KeyboardEvent)=>{
  if((e.target as HTMLElement)?.closest('input,textarea,[role="slider"],[role="dialog"]'))return;const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();if(e.repeat)return;
  if(key==='escape'&&this.started&&!this.dead){this.pause(!this.paused);return}if(!this.started||this.paused||this.dead)return;this.keys.add(key);
  if(key==='c')this.dive();if(key==='f')this.attack();if(key==='r')this.roll();if(key==='e')this.interact();if(key==='b')this.bask();if(key==='v')this.resetCamera();if(key==='q')this.tailWhip();
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
  this.renderer.render(this.scene,this.camera);this.uiTimer+=dt;if(this.uiTimer>.06){this.uiTimer=0;this.updateUI();this.drawMap();this.adaptQuality()}this.frame=requestAnimationFrame(this.loop);
 };
 private animateCroc(time:number){
  const pose=this.rollTimer>0?rollPose(this.rollTimer):{angle:0,tuck:0,lift:0,coil:0};
  this.croc.animate(time,this.started?this.speed:.25,this.state.mode==='SWIMMING'||this.state.mode==='DIVING'||!this.started,this.biteTimer/(this.feedingTimer>0?.7:.45),pose.angle,this.turnAmount,this.basking,{gripping:!!(this.grabbed||this.grabbedRival),rollTuck:pose.tuck,rollLift:pose.lift,rollCoil:pose.coil,diving:this.diving,tailWhip:this.tailWhipTimer>0?Math.sin((this.tailWhipTimer/.42)*Math.PI)*1.5:0});
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
  const g=this.state.growth;this.croc.root.scale.set(.8+g*.0095,.8+g*.0072,.8+g*.0066);this.state.title=g>=95?'Apex Titan (30 ft)':g>=70?'Estuary Bull (18-24 ft)':g>=40?'River Stalker (11-17 ft)':g>=20?'Sub-Adult Hunter (7-10 ft)':'Yearling (5-6 ft)';if(!swim&&Math.abs(this.speed)>1.1&&Math.random()<.25)this.sandDust(p);this.state.depth=Math.max(0,water-p.y);this.state.speed=Math.abs(this.speed);this.state.biome=biomeAt(p.x,p.z);
  if(!this.regions.has(this.state.biome)){this.regions.add(this.state.biome);this.notify('New habitat: '+this.state.biome.toLowerCase()+'.')}this.state.regions=this.regions.size;
  for(const marker of LANDMARKS){if(!this.state.landmarks.includes(marker.id)&&Math.hypot(marker.x-p.x,marker.z-p.z)<23){this.state.landmarks.push(marker.id);this.notify('Discovered '+marker.name+'. '+marker.description)}}
  this.state.x=p.x;this.state.z=p.z;this.state.heading=((-this.croc.root.rotation.y*180/Math.PI)%360+360)%360;this.state.elapsed=this.time;
  const minutes=16*60+42+Math.floor(this.time/20);this.state.time=`${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  this.attackCooldown=Math.max(0,this.attackCooldown-dt);this.biteTimer=Math.max(0,this.biteTimer-dt);this.rollTimer=Math.max(0,this.rollTimer-dt);this.feedingTimer=Math.max(0,this.feedingTimer-dt);this.damageCooldown=Math.max(0,this.damageCooldown-dt);this.tailWhipTimer=Math.max(0,this.tailWhipTimer-dt);this.tailWhipCooldown=Math.max(0,this.tailWhipCooldown-dt);this.messageTimer-=dt;if(this.messageTimer<0)this.state.message='';
  this.animateCroc(this.time);
  this.stepAnimals(dt,stalk,swim);this.stepRivals(dt,stalk,swim);this.stepPlovers(dt);this.stepWaders(dt);
  this.audio?.setUnderwater(p.y<water-.7||this.state.mode==='DIVING');
  this.audio?.setIntensity(this.rollTimer>0?'roll':this.grabbed?'hunt':stalk?'stalk':'calm');
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
  if(this.grabbedRival){
   const r=this.grabbedRival;
   this.grip=Math.max(0,this.grip-dt*(this.rollTimer>0?0:swim?5:12));
   const mouth=this.croc.head.localToWorld(new T.Vector3(0,-.035,-1.35));
   if(this.rollTimer>0){
    r.root.position.copy(mouth);
    r.root.rotation.z=rollPose(this.rollTimer).angle;
    this.rollSplash+=dt;
    if(this.rollSplash>.16&&this.particles.length<16){this.rollSplash=0;this.ripple();this.splash();this.bloodBurst(r.root.position);}
   }else{
    r.root.position.lerp(mouth,1-Math.exp(-8*dt));
   }
   if(this.grip<=0){this.grabbedRival=null;this.notify('Your jaw clamp broke free.');}
  }
  if(this.rollVictim&&this.rollTimer<=0){const victim=this.rollVictim;this.rollVictim=null;if(victim===this.grabbed&&victim.alive){victim.hp-=2;if(victim.hp<=0)this.kill(victim)}}
  if(this.rollRivalVictim&&this.rollTimer<=0){
   const victim=this.rollRivalVictim;this.rollRivalVictim=null;
   victim.hp-=4;this.bloodBurst(victim.root.position);
   if(victim.hp<=0){this.killRival(victim);this.grabbedRival=null;}
   else{victim.fleeing=true;victim.velocity=-4.5;this.grabbedRival=null;this.notify(`Death roll crushed ${victim.name}! Rival is retreating.`);}
  }
  this.state.grip=this.grabbed?this.grip:this.grabbedRival?this.grip:0;this.state.meal=!!this.nearestMeal();this.state.basking=this.basking;this.state.feeding=this.feedingTimer>0;this.state.rolling=this.rollTimer>0;
  const marker=LANDMARKS.find(m=>m.id===this.waypointId);this.state.waypointDistance=marker?Math.hypot(marker.x-p.x,marker.z-p.z):0;this.state.waypointBearing=marker?angleDelta(this.yaw,Math.atan2(p.x-marker.x,p.z-marker.z))*180/Math.PI:0;
  this.wakeTimer+=dt;if(swim&&Math.abs(this.speed)>1&&this.wakeTimer>.65&&this.particles.length<8){this.wakeTimer=0;this.ripple();if(Math.abs(this.speed)>5.5)this.audio?.playSplash();}
  if(this.state.health<=0){this.dead=true;this.state.dead=true;this.clearInput();this.grabbed=null;this.grabbedRival=null;this.rollVictim=null;this.rollRivalVictim=null;this.rollTimer=0;this.notify('Your time in the estuary has ended.');this.updateUI()}
 }
 private stepAnimals(dt:number,stalk:boolean,swim:boolean){
  const p=this.croc.root.position;let nearby:Animal|undefined,best=26;
  for(const a of this.animals){
   const dist=a.root.position.distanceTo(p);
   if(!a.alive){a.respawn-=dt;if(a.servings){a.root.visible=dist<230;a.root.position.y=Math.max(heightAt(a.root.position.x,a.root.position.z)+.7,waterLevel(this.time)-.22)}if(a.respawn<0&&a.home.distanceTo(p)>40){a.alive=true;a.hp=a.kind==='buffalo'?3:1;a.root.visible=true;a.root.position.copy(a.home);a.root.rotation.set(0,a.angle+Math.PI,0);a.velocity=0;a.servings=0;a.awareness=0}continue}
   if(dist<best){best=dist;nearby=a}a.root.visible=dist<250;if(a===this.grabbed)continue;
   const inDrinkWade=a.kind==='buffalo'&&a.drinking&&heightAt(a.root.position.x,a.root.position.z)>=waterLevel(this.time)-.42;
   const isCrossing=a.kind==='buffalo'&&a.crossing;
   if(!inDrinkWade&&!isCrossing&&!validHabitat(a.kind,a.root.position.x,a.root.position.z,waterLevel(this.time))){const safe=habitatPoint(a.kind,a.root.position.x,a.root.position.z,waterLevel(this.time));if(!safe){a.root.visible=false;continue}a.root.position.x=safe.x;a.root.position.z=safe.z;a.velocity=0;a.drinking=false;a.crossing=false;}
   if(dist>250)continue;
   a.phase+=dt;const fear=a.kind==='buffalo'?(this.diving?5:stalk&&swim?8:20):a.kind==='fish'?(stalk?3.2:7):4;
   const detected=dist<fear&&(Math.abs(this.speed)>(stalk?.8:1.1)||dist<3.5||!swim&&a.kind==='buffalo');a.awareness=clamp(a.awareness+(detected?.8:-.2)*dt,0,1);a.flee=Math.max(0,a.flee-dt);
   const fleeing=a.awareness>.55||a.flee>0;
   if(a.kind==='buffalo'){
    if(fleeing||detected){a.drinking=false;a.drinkSpot=undefined;a.crossing=false;a.crossTarget=undefined;}
    else{
     a.drinkTimer=(a.drinkTimer??(20+((a.phase*7)%25)))-dt;
     if(a.drinkTimer<=0&&!a.drinking&&!a.crossing){
      for(let rad=6;rad<42;rad+=4){
       const riverX=riverCenter(a.home.z),dir=riverX>a.home.x?0:Math.PI;
       const sx=a.home.x+Math.cos(dir)*rad,sz=a.home.z+Math.sin(dir)*rad*.3;
       const sh=heightAt(sx,sz),wl=waterLevel(this.time);
       if(sh<wl+.06&&sh>wl-.32){a.drinkSpot={x:sx,z:sz};a.drinking=true;a.drinkTimer=16;break;}
      }
     }
     if(a.drinking&&a.drinkSpot&&a.drinkTimer&&a.drinkTimer<=0){a.drinking=false;a.drinkSpot=undefined;a.drinkTimer=40+((a.phase*13)%30);}
     a.crossTimer=(a.crossTimer??(35+((a.phase*7)%45)))-dt;
     if(a.crossTimer<=0&&!a.drinking&&!a.crossing){
      const rivX=riverCenter(a.home.z),onEast=a.home.x>rivX;
      const targetX=rivX+(onEast?-1:1)*(45+((a.phase*6)%18)),targetZ=a.home.z+Math.sin(a.phase)*16;
      if(validHabitat('buffalo',targetX,targetZ,waterLevel(this.time))){a.crossing=true;a.crossTarget={x:targetX,z:targetZ};}
      else{a.crossTimer=25;}
     }
    }
   }
   if(fleeing)a.angle=Math.atan2(a.root.position.x-p.x,a.root.position.z-p.z);
   else if(a.drinking&&a.drinkSpot){
    const toSpot=Math.hypot(a.drinkSpot.x-a.root.position.x,a.drinkSpot.z-a.root.position.z);
    if(toSpot>1.2)a.angle=Math.atan2(a.drinkSpot.x-a.root.position.x,a.drinkSpot.z-a.root.position.z);
    else{a.velocity=0;if(Math.random()<.16)this.ripple();}
   }
   else if(a.crossing&&a.crossTarget){
    const toTarget=Math.hypot(a.crossTarget.x-a.root.position.x,a.crossTarget.z-a.root.position.z);
    a.angle=Math.atan2(a.crossTarget.x-a.root.position.x,a.crossTarget.z-a.root.position.z);
    if(toTarget<3.5&&heightAt(a.root.position.x,a.root.position.z)>=waterLevel(this.time)-.05){
     a.crossing=false;a.crossTarget=undefined;a.home.copy(a.root.position);a.crossTimer=70+((a.phase*11)%55);
    }
   }
   else{const homeDist=a.root.position.distanceTo(a.home);if(homeDist>(a.kind==='fish'?24:18))a.angle+=angleDelta(a.angle,Math.atan2(a.home.x-a.root.position.x,a.home.z-a.root.position.z))*dt;else a.angle+=Math.sin(a.phase*.6)*dt*.24}
   const velocity=a.kind==='fish'?(fleeing?3.2:.6):a.kind==='buffalo'?(fleeing?3.6:a.crossing?1.35:a.drinking?.7:.24):fleeing?.65:.12;
   a.velocity=approach(a.velocity,a.drinking&&a.drinkSpot&&Math.hypot(a.drinkSpot.x-a.root.position.x,a.drinkSpot.z-a.root.position.z)<=1.2?0:velocity,3,dt);
   const x=a.root.position.x+Math.sin(a.angle)*a.velocity*dt,z=a.root.position.z+Math.cos(a.angle)*a.velocity*dt;
   const valid=inDrinkWade?(heightAt(x,z)>=waterLevel(this.time)-.42):isCrossing?true:validHabitat(a.kind,x,z,waterLevel(this.time));
   if(valid&&Math.abs(x)<HALF-20&&Math.abs(z)<HALF-20){a.root.position.x=x;a.root.position.z=z}else{for(const offset of [Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2,Math.PI]){const alternative=a.angle+offset,ax=a.root.position.x+Math.sin(alternative)*a.velocity*dt,az=a.root.position.z+Math.cos(alternative)*a.velocity*dt;if((isCrossing||validHabitat(a.kind,ax,az,waterLevel(this.time)))&&Math.abs(ax)<HALF-20&&Math.abs(az)<HALF-20){a.root.position.x=ax;a.root.position.z=az;a.angle=alternative;break}}}
   const actualH=heightAt(a.root.position.x,a.root.position.z);
   const wl=waterLevel(this.time);
   const isSwimming=isCrossing&&actualH<wl-.2;
   a.root.position.y=a.kind==='fish'?Math.max(actualH+.35,wl-1.04+Math.sin(a.phase)*.15):isSwimming?Math.max(actualH+.6,wl-.72):actualH;
   a.root.rotation.y=a.angle+Math.PI;
   a.root.userData.animate?.(this.time+a.phase,a.velocity,a.drinking,isSwimming);
   if(isSwimming&&Math.random()<.08&&this.particles.length<18){this.ripple();}
  }
  const bearing=nearby?angleDelta(this.croc.root.rotation.y,Math.atan2(p.x-nearby.root.position.x,p.z-nearby.root.position.z)):0;const direction=Math.abs(bearing)<.5?'AHEAD':Math.abs(bearing)>2.5?'BEHIND':bearing>0?'LEFT':'RIGHT';const reach=4.7+this.state.growth*0.02;this.state.canBite=!!nearby&&best<reach&&Math.cos(bearing)*Math.hypot(p.x-nearby.root.position.x,p.z-nearby.root.position.z)/Math.max(.01,best)>.45;this.state.target=this.grabbed?'BUFFALO · IN YOUR GRIP':this.grabbedRival?`${this.grabbedRival.name.toUpperCase()} · JAW LOCK`:nearby?`${nearby.kind.toUpperCase()} · ${Math.round(best)} M · ${direction}`:'';this.state.awareness=nearby?.awareness||0;
 }
 private stepRivals(dt:number,stalk:boolean,swim:boolean){
  const p=this.croc.root.position,water=waterLevel(this.time);
  let rivalNear='';
  for(const r of (this.rivals||[])){
   const dist=r.root.position.distanceTo(p);
   r.root.visible=dist<260;
   if(!r.alive){
    r.respawn-=dt;
    if(r.respawn<0&&r.home.distanceTo(p)>60){
     r.alive=true;r.hp=r.maxHp;r.root.visible=true;r.root.position.copy(r.home);r.root.rotation.set(0,r.angle,0);r.servings=0;r.fleeing=false;
    }
    continue;
   }
   if(dist>250)continue;
   r.phase+=dt;
   r.warningTimer=Math.max(0,r.warningTimer-dt);
   r.attackCooldown=Math.max(0,r.attackCooldown-dt);
   const homeDist=r.root.position.distanceTo(r.home);
   const inside=homeDist<r.territoryRadius;
   if(dist<r.territoryRadius*1.2)rivalNear=`${r.name.toUpperCase()} · TERRITORY`;
   if(r.fleeing){
    r.angle=Math.atan2(r.root.position.x-p.x,r.root.position.z-p.z);
    r.velocity=approach(r.velocity,4.2,4,dt);
    if(dist>r.territoryRadius*1.5)r.fleeing=false;
   }else if(inside&&dist<r.territoryRadius*.85){
    if(this.state.growth<55){
     if(dist<28&&r.warningTimer<=0){
      r.warningTimer=5;if(r.kind==='croc')this.audio?.playCrocRoar();else if(r.kind==='hippo')this.audio?.playHippoGrunt();
      this.notify(`${r.name} detects an intruder! Defending territory.`);
     }
     r.angle=Math.atan2(p.x-r.root.position.x,p.z-r.root.position.z);
     r.velocity=approach(r.velocity,r.kind==='shark'?4.8:r.kind==='croc'?4.2:3.2,3,dt);
     if(dist<3.6&&r.attackCooldown<=0&&this.damageCooldown<=0){
      r.attackCooldown=2.5;this.damageCooldown=2.2;
      const dmg=r.kind==='hippo'?14:r.kind==='croc'?10:7;
      this.state.health=Math.max(0,this.state.health-dmg);
      this.bloodBurst(p);this.audio?.playBite();
      this.notify(`${r.name} attacks! Retreat out of its territory.`);
     }
    }else{
     if(dist<16){
      r.angle=Math.atan2(p.x-r.root.position.x,p.z-r.root.position.z)+(dist<8?.3:1.2);
      r.velocity=approach(r.velocity,1.5,2,dt);
     }else{
      r.velocity=approach(r.velocity,.6,2,dt);
      r.angle+=Math.sin(r.phase*.5)*dt*.3;
     }
    }
   }else{
    if(homeDist>18)r.angle+=angleDelta(r.angle,Math.atan2(r.home.x-r.root.position.x,r.home.z-r.root.position.z))*dt*.9;
    else r.angle+=Math.sin(r.phase*.4)*dt*.2;
    r.velocity=approach(r.velocity,r.kind==='shark'?1.8:r.kind==='croc'?.8:.5,2,dt);
   }
   const nx=r.root.position.x+Math.sin(r.angle)*r.velocity*dt,nz=r.root.position.z+Math.cos(r.angle)*r.velocity*dt;
   if(Math.abs(nx)<HALF-25&&Math.abs(nz)<HALF-25){r.root.position.x=nx;r.root.position.z=nz;}
   const actualH=heightAt(r.root.position.x,r.root.position.z);
   r.root.position.y=r.kind==='shark'?Math.max(actualH+.35,water-.75+Math.sin(r.phase)*.1):r.kind==='croc'?actualH<-.3?water-.12:actualH+.035:Math.max(actualH,water-.25);
   r.root.rotation.y=r.angle+Math.PI;
   r.root.userData.animate?.(this.time+r.phase,r.velocity,inside&&dist<25);
  }
  this.state.rivalNear=rivalNear;
 }
 private stepPlovers(dt:number){
  this.ploverSoundTimer=Math.max(0,this.ploverSoundTimer-dt);
  const teethPos=this.croc.head.localToWorld(new T.Vector3(0,-.06,-1.35));
  (this.plovers||[]).forEach((pl,idx)=>{
   pl.root.visible=this.basking;
   if(!this.basking){pl.landed=false;return}
   if(!pl.landed){
    pl.root.position.copy(teethPos).add(new T.Vector3((idx===0?-.12:.12),0,0));
    pl.landed=true;
   }
   pl.hopTimer+=dt;
   const pecking=pl.hopTimer>1.2;
   pl.root.userData.animate?.(this.time+idx*2,pecking,false);
   if(this.ploverSoundTimer<=0&&Math.random()<.08){
    this.ploverSoundTimer=3.5;this.audio?.playPloverChirp();
   }
  });
  if(this.basking){this.state.health=Math.min(100,this.state.health+dt*1.2);}
 }
 private stepWaders(dt:number){
  const p=this.croc.root.position;
  for(const w of (this.waders||[])){
   const dist=w.root.position.distanceTo(p);
   if(!w.fleeing&&dist<14){w.fleeing=true;w.fleeTimer=12;}
   if(w.fleeing){
    w.fleeTimer-=dt;
    w.root.position.y+=dt*4.5;
    w.root.position.x+=Math.sin(this.time)*dt*6;
    w.root.userData.animate?.(this.time,true);
    if(w.fleeTimer<=0){w.fleeing=false;w.root.position.copy(w.home);}
   }else{
    w.root.position.copy(w.home);
    w.root.userData.animate?.(this.time,false);
   }
  }
 }
 private updateCamera(dt:number){
  const p=this.croc.root.position;if(!this.started){this.yaw=.55+Math.sin(this.ambientTime*.035)*.14;this.pitch=.31;this.zoom=8.8}
  const target=p.clone().add(new T.Vector3(0,.46+this.state.growth*.004,0)),pitch=this.diving&&this.cameraIdle<=0?Math.min(this.pitch,.13):this.pitch,zoom=(this.diving?Math.min(this.zoom,7.8):this.zoom)*(1+this.state.growth*.0012),offset=new T.Vector3(Math.sin(this.yaw)*zoom*Math.cos(pitch),zoom*Math.sin(pitch)+.6,Math.cos(this.yaw)*zoom*Math.cos(pitch)),pos=target.clone().add(offset);if(this.rollTimer>0){const shake=(Math.random()-.5)*.14;pos.x+=shake;pos.y+=shake}pos.y=Math.max(pos.y,heightAt(pos.x,pos.z)+.85);this.camera.position.lerp(pos,1-Math.exp(-6*dt));this.camera.lookAt(target);
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
  for(const r of (this.rivals||[])){if(r.alive&&r.root.position.distanceTo(this.croc.root.position)<160){c.fillStyle=r.kind==='shark'?'#4aa3df':r.kind==='hippo'?'#9b59b6':'#e04b36';const x=(r.root.position.x/WORLD_SIZE+.5)*w,y=(r.root.position.z/WORLD_SIZE+.5)*w;c.beginPath();c.arc(x,y,r.kind==='croc'?3.5:2.5,0,7);c.fill()}}
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
 private initAudio(){if(this.audio)return;try{this.audio=new JungleAudio();this.audio.init();if(this.muted)this.audio.setMuted(true)}catch{}}
 private sfx(f:number,d:number){this.audio?.playBite()}
 dispose(){
  this.disposed=true;cancelAnimationFrame(this.frame);window.removeEventListener('resize',this.resize);window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);
  const el=this.renderer.domElement;el.removeEventListener('pointerdown',this.pointerDown);el.removeEventListener('pointerup',this.pointerUp);el.removeEventListener('pointercancel',this.pointerCancel);el.removeEventListener('lostpointercapture',this.pointerCancel);el.removeEventListener('pointermove',this.pointerMove);el.removeEventListener('wheel',this.wheel);el.removeEventListener('contextmenu',this.contextMenu);el.removeEventListener('webglcontextlost',this.contextLost);
  const geos=new Set<T.BufferGeometry>(),mats=new Set<T.Material>(),textures=new Set<T.Texture>();this.scene.traverse(o=>{if(o instanceof T.Mesh){geos.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{mats.add(m);Object.values(m).forEach(v=>{if(v instanceof T.Texture)textures.add(v)})})}});this.world.dispose();geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());this.croc.skin.skeleton.dispose();this.renderer.dispose();el.remove();this.audio?.dispose();
 }
}
(Engine.prototype as any).rivals = [];
(Engine.prototype as any).plovers = [];
(Engine.prototype as any).waders = [];
