import {HALF} from './world';
export type ExpeditionSave={version:2;health:number;hunger:number;stamina:number;air:number;warmth:number;growth:number;kills:number;fishCaught:number;buffaloCaught:number;distance:number;elapsed:number;x:number;y:number;z:number;heading:number;regions:string[];landmarks:string[];savedAt:string};
const KEY='saltwater-expedition-v2';
export function validateSave(value:unknown):ExpeditionSave|null{
 if(!value||typeof value!=='object')return null;
 const s=value as ExpeditionSave;
 if(s.version!==2||!Number.isFinite(s.x)||!Number.isFinite(s.y)||!Number.isFinite(s.z)||Math.abs(s.x)>HALF-10||Math.abs(s.z)>HALF-10||!Number.isFinite(s.heading))return null;
 for(const k of ['health','hunger','stamina','air','warmth','growth'] as const)if(!Number.isFinite(s[k])||s[k]<0||s[k]>100)return null;
 for(const k of ['kills','fishCaught','buffaloCaught','distance','elapsed'] as const)if(!Number.isFinite(s[k])||s[k]<0)return null;
 if(s.health<=0||!Array.isArray(s.regions)||!Array.isArray(s.landmarks)||s.regions.some(x=>typeof x!=='string')||s.landmarks.some(x=>typeof x!=='string'))return null;
 return s;
}
export function readSave():ExpeditionSave|null{try{return validateSave(JSON.parse(localStorage.getItem(KEY)||'null'))}catch{return null}}
export function writeSave(save:ExpeditionSave){try{localStorage.setItem(KEY,JSON.stringify(save));return true}catch{return false}}
