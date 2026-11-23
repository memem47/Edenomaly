// Founder editor operates exclusively on canonical DNA v2.
import {expressDNA,DNA_KEYS,DNA_LIMITS,CORE_KEYS,SKILLS,STRATEGY_FIELDS,canonicalDNA} from './genome-model.js';
export const FOUNDER_BUDGET=24;
export const FOUNDER_TRAITS=Object.freeze([
 ['基本ステータス',CORE_KEYS.map((key,i)=>[key,['ちから','すばやさ','たいりょく','かしこさ','てきおう','はんしょく'][i],1,10,1])],
 ['スキル保有',SKILLS.map(s=>[s.key,s.label,0,1,1])],
 ['生存戦略',STRATEGY_FIELDS.map(s=>[s.key,s.label,s.min,s.max,
  ['aquatic','repro','biome','albino'].includes(s.key)?1:.05])]
]);
export const FOUNDER_FIELDS=FOUNDER_TRAITS.flatMap(([,fields])=>fields);
export const FOUNDER_LEVEL_MIN=1,FOUNDER_LEVEL_MAX=10;
export function founderLevel(key,value){
 const f=FOUNDER_FIELDS.find(([k])=>k===key);
 if(!f||!Number.isFinite(value))return 1;
 const [,,lo,hi]=f;
 return Math.max(1,Math.min(10,Math.round((value-lo)/(hi-lo)*9)+1));
}
export function founderValueAtLevel(key,level){
 const f=FOUNDER_FIELDS.find(([k])=>k===key);
 if(!f)return undefined;
 const [,,lo,hi,step]=f,n=Math.max(1,Math.min(10,Math.round(Number(level)||1)));
 return Number(Math.max(lo,Math.min(hi,Math.round((lo+(n-1)*(hi-lo)/9)/step)*step)).toFixed(5));
}
export function formatTrait(key,value){
 if(key==='aquatic')return value===1?'水生':'陸生';
 if(key==='repro')return ['雌雄異体','雌雄同体','単為生殖'][Math.round(value)]??String(value);
 if(key==='biome')return ['草地','水辺','乾燥地','岩場'][Math.round(value)]??String(value);
 if(key.startsWith('skill'))return value?'保有':'なし';
 return Number.isInteger(value)?String(value):Number(value).toFixed(2);
}
export function founderLevelMeaning(key,level){
 const value=founderValueAtLevel(key,level);
 if(key==='diet')return value>=.7?'肉食':value>=.3?'雑食':'草食';
 if(key==='thermal')return '好適 '+Math.round(-5+value*45)+'℃';
 if(key==='albino')return value===1?'白化':'通常';
 if(['aquatic','repro','biome'].includes(key)||key.startsWith('skill'))return formatTrait(key,value);
 return level<=3?'低い':level>=8?'高い':'中程度';
}
export function editFounderGenome(base,changes={}){
 const dna={...canonicalDNA(base)};
 for(const [key,,lo,hi,step] of FOUNDER_FIELDS){
  if(!Object.hasOwn(changes,key))continue;
  const value=Number(changes[key]);if(!Number.isFinite(value))continue;
  dna[key]=Math.max(lo,Math.min(hi,Math.round(value/step)*step));
 }
 const alleles=Object.fromEntries(DNA_KEYS.map(key=>
  [key,Object.hasOwn(changes,key)?[dna[key],dna[key]]:[...(base.alleles?.[key]??[dna[key],dna[key]])]]));
 return expressDNA({dna,alleles});
}
export function founderTraitCost(key,value){
 if(!Number.isFinite(value))return 0;
 if(CORE_KEYS.includes(key))return (value-5)*1.55;
 if(key.startsWith('skill'))return value?2.8:0;
 if(key==='repro')return [0,3,1][Math.round(value)]??0;
 return 0;
}
export function founderCost(base,edited){
 const dna=canonicalDNA(edited??base);
 return Math.round((DNA_KEYS.reduce((n,key)=>n+founderTraitCost(key,dna[key]),0))*10)/10;
}
export const canUseFounder=(base,edited,isGame)=>!isGame||founderCost(base,edited)<=FOUNDER_BUDGET;
