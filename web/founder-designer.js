// Editable founder traits. Rendering and simulation both use the same genome.
import {deriveFunctionalBody} from './simulation.js';
export const FOUNDER_BUDGET=24;
export const FOUNDER_TRAITS=Object.freeze([
 ['生態・環境',[
  ['diet','肉食傾向',0,1,.05],['aquatic','水生（1）/陸生（0）',0,1,1],
  ['wet','水辺適応',0,1,.05],['dry','乾燥適応',0,1,.05],['rock','岩場適応',0,1,.05],
  ['idealTemp','適温（℃）',-5,40,1],['tempTolerance','温度耐性（±℃）',3,18,1],
  ['hibernate','休眠',0,1,.05],['resist','感染抵抗力',0,1,.05],
  ['frugality','省エネ',0,1,.05],['waterGardening','水草栽培',0,1,.05]]],

 ['繁殖・子育て',[
  ['repro','繁殖方式（0雌雄/1両性/2単為）',0,2,1],['brood','産卵数',1,8,1],
  ['shell','卵殻',0,1,.05],['guard','卵の保護',0,1,.05],
  ['nesting','巣作り',0,1,.05],['nestChoice','産卵地選択',0,1,.05],
  ['parentFeeding','親の給餌',0,1,.05],['yolkReserve','卵への栄養投資',0,1,.05],
  ['juvenileCannibalism','幼体の共食い',0,1,.05]]],
 ['行動・生存',[
  ['dispersal','分散傾向',0,1,.05],['sociability','集合傾向',0,1,.05],
  ['caution','警戒心',0,1,.05],['predatorSense','捕食者の識別',0,1,.05],
  ['retaliation','反撃',0,1,.05],['deception','擬態',0,1,.05]]]
]);
export const FOUNDER_FIELDS=FOUNDER_TRAITS.flatMap(([,fields])=>fields);
export const formatTrait=(key,v)=>{
 if(key==='aquatic')return v===1?'水生':'陸生';
 if(key==='repro')return ['雌雄異体','雌雄同体','単為生殖'][Math.round(v)]??String(v);
 return Number.isInteger(v)?String(v):Number(v).toFixed(2);
};
export function editFounderGenome(base,changes={}){
 const g={...base,alleles:Object.fromEntries(Object.entries(base.alleles??{}).map(([k,pair])=>[k,[...pair]]))};
 for(const [key,,lo,hi,step] of FOUNDER_FIELDS){
  if(!Object.hasOwn(changes,key))continue;
  const raw=Number(changes[key]);
  if(!Number.isFinite(raw))continue;
  const val=Math.min(hi,Math.max(lo,Math.round(raw/step)*step));
  const clean=Number(val.toFixed(5));
  g[key]=clean;
  g.alleles[key]=[clean,clean];
 }
 return deriveFunctionalBody(g);
}
// Absolute, signed prices relative to a balanced reference, never to the RNG founder.
const PRICE=Object.freeze({wet:8,dry:8,rock:8,tempTolerance:12,hibernate:4,resist:12,
 frugality:16,waterGardening:4,shell:5,guard:4,nesting:3,nestChoice:6,
 parentFeeding:4,yolkReserve:5,caution:4,predatorSense:8,retaliation:5,deception:5});
export function founderTraitCost(key,value){
 if(!Number.isFinite(value))return 0;
 if(key==='tempTolerance')return PRICE[key]*(Math.max(3,Math.min(18,value))-10.5)/15;
 if(key==='repro')return [0,3,1][Math.round(value)]??0;
 // High brood sizes gain many simultaneous offspring: price the advantage
 // non-linearly, while low brood sizes refund points for the tradeoff.
 if(key==='brood')return value<=3?(value-3)*1.5:1.35*Math.pow(value-3,1.35);
 if(!Object.hasOwn(PRICE,key))return 0; // alternative strategies have no universal advantage
 return PRICE[key]*(Math.max(0,Math.min(1,value))-.5);
}
export function founderCost(base,edited){
 const g=edited??base;
 let total=FOUNDER_FIELDS.reduce((sum,[key])=>sum+founderTraitCost(key,g[key]),0);
 // Generalists pay a premium for combining strong terrain adaptations.
 const excess=['wet','dry','rock'].reduce((sum,k)=>sum+Math.max(0,(g[k]??.5)-.6),0);
 total+=Math.max(0,excess-.4)*15;
 return Math.round(total*10)/10;
}
export const canUseFounder=(base,edited,isGame)=>!isGame||founderCost(base,edited)<=FOUNDER_BUDGET;
