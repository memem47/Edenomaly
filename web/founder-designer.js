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
  ['retaliation','反撃',0,1,.05],['deception','擬態',0,1,.05]]],
 ['体格・形態（詳細）',[
  ['r','基本体格',3,15,.1],['elongation','体の長さ',.65,3,.05],
  ['eyes','目の数',0,6,1],['mouths','口の数',1,4,1],['jaw','顎の強さ',.2,2.5,.05]]],
 ['体表・遺伝（詳細）',[
  ['tailLength','尾の発達',0,1,.05],['hornLength','角の発達',0,1,.05],
  ['antennaLength','触角の発達',0,1,.05],['pattern','斑点・模様',0,1,.05],
  ['albino','白化（色素喪失）',0,1,1],['longevity','体内光沢（旧寿命遺伝子）',.6,2,.05]]]
]);
export const FOUNDER_FIELDS=FOUNDER_TRAITS.flatMap(([,fields])=>fields);
// All player-facing DNA controls use the same 1..10 integer scale. Internal
// gene values (including temperatures and categorical reproductive modes)
// remain in their original physical/simulation units.
export const FOUNDER_LEVEL_MIN=1;
export const FOUNDER_LEVEL_MAX=10;
export function founderLevel(key,value){
 const field=FOUNDER_FIELDS.find(([name])=>name===key);
 if(!field||!Number.isFinite(value))return 1;
 const [,,lo,hi]=field;
 return Math.max(1,Math.min(10,Math.round((value-lo)/(hi-lo)*9)+1));
}
export function founderValueAtLevel(key,level){
 const field=FOUNDER_FIELDS.find(([name])=>name===key);
 if(!field)return undefined;
 const [,,lo,hi,step]=field;
 const n=Math.max(1,Math.min(10,Math.round(Number(level)||1)));
 const raw=lo+(n-1)*(hi-lo)/9;
 return Number(Math.min(hi,Math.max(lo,Math.round(raw/step)*step)).toFixed(5));
}
export function founderLevelMeaning(key,level){
 const value=founderValueAtLevel(key,level);
 if(key==='aquatic')return value===1?'水生':'陸生';
 if(key==='repro')return formatTrait(key,value);
 if(key==='idealTemp')return value+'℃';
 if(key==='tempTolerance')return '±'+value+'℃';
 if(key==='brood')return value+'個';
 if(key==='diet')return value>=.75?'肉食':value>=.3?'雑食':'草食';
 if(key==='albino')return value===1?'白化':'通常色';
 if(key==='eyes')return value+'個';
 if(key==='mouths')return value+'個';
 if(key==='r')return '半径 '+value;
 if(key==='elongation')return '長さ比 '+value;
 if(key==='jaw')return '顎 '+value;
 if(key==='longevity')return '光沢 '+value;
 return level<=3?'低い':level>=8?'高い':'中程度';
}

export const formatTrait=(key,v)=>{
 if(key==='aquatic')return v===1?'水生':'陸生';
 if(key==='repro')return ['雌雄異体','雌雄同体','単為生殖'][Math.round(v)]??String(v);
 return Number.isInteger(v)?String(v):Number(v).toFixed(2);
};
export function editFounderGenome(base,changes={}){
 const g={...base,bodyOverrides:[...(base.bodyOverrides??[])],
  alleles:Object.fromEntries(Object.entries(base.alleles??{}).map(([k,pair])=>[k,[...pair]]))};
 for(const [key,,lo,hi,step] of FOUNDER_FIELDS){
  if(!Object.hasOwn(changes,key))continue;
  const raw=Number(changes[key]);
  if(!Number.isFinite(raw))continue;
  const val=Math.min(hi,Math.max(lo,Math.round(raw/step)*step));
  const clean=Number(val.toFixed(5));
  g[key]=clean;
  g.alleles[key]=[clean,clean];
  if(['r','elongation','eyes','mouths','jaw'].includes(key)&&!g.bodyOverrides.includes(key))
   g.bodyOverrides.push(key);
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
 if(key==='longevity')return 0; // legacy lifespan no longer affects survival; visual expression only
 if(key==='repro')return [0,3,1][Math.round(value)]??0;
 // High brood sizes gain many simultaneous offspring: price the advantage
 // non-linearly, while low brood sizes refund points for the tradeoff.
 if(key==='brood')return value<=3?(value-3)*1.5:1.35*Math.pow(value-3,1.35);
 if(!Object.hasOwn(PRICE,key))return 0; // unpriced appearance / ecological trade-offs
 return PRICE[key]*(Math.max(0,Math.min(1,value))-.5);
}
export function founderCost(base,edited){
 const g=edited??base;
 let total=FOUNDER_FIELDS.reduce((sum,[key])=>sum+founderTraitCost(key,g[key]),0);
 // Manual morphology overrides have a separate price; automatically
 // derived body shape is already paid for through functional abilities.
 const bodyPrice={r:[3,15,8],elongation:[.65,3,3],eyes:[0,6,4],
  mouths:[1,4,3],jaw:[.2,2.5,6]};
 for(const key of (g.bodyOverrides??[])){
  const [lo,hi,weight]=bodyPrice[key]??[];
  if(weight)total+=weight*Math.max(0,(g[key]-lo)/(hi-lo));
 }
 // Generalists pay a premium for combining strong terrain adaptations.
 const excess=['wet','dry','rock'].reduce((sum,k)=>sum+Math.max(0,(g[k]??.5)-.6),0);
 total+=Math.max(0,excess-.4)*15;
 return Math.round(total*10)/10;
}
export const canUseFounder=(base,edited,isGame)=>!isGame||founderCost(base,edited)<=FOUNDER_BUDGET;
