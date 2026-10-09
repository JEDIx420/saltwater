import {heightAt,HALF} from './world';

export type HabitatKind='fish'|'crab'|'buffalo'|'monkey';
// Land animals remain clear of the highest tide, including their footprint.
export function validHabitat(kind:HabitatKind,x:number,z:number,water=.16){
 if(Math.abs(x)>HALF-22||Math.abs(z)>HALF-22)return false;
 if(kind==='fish')return heightAt(x,z)<water-.65;
 const clearance=kind==='buffalo'?1.7:kind==='monkey'?0.8:.45,level=Math.max(.16,water)+.12;
 for(const [dx,dz] of [[0,0],[clearance,0],[-clearance,0],[0,clearance],[0,-clearance]]){
  if(heightAt(x+dx,z+dz)<level)return false;
 }
 return true;
}

/** Deterministic nearest safe point. Failed searches never create invalid animals. */
export function habitatPoint(kind:HabitatKind,x:number,z:number,water=.16){
 if(validHabitat(kind,x,z,water))return {x,z};
 for(let radius=2;radius<=160;radius+=2){
  const count=Math.max(12,Math.ceil(radius*1.5));
  for(let i=0;i<count;i++){
   const a=i/count*Math.PI*2,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;
   if(validHabitat(kind,px,pz,water))return {x:px,z:pz};
  }
 }
 return null;
}
