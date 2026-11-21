// Editable founder traits. Rendering and simulation both use the same genome.
export const FOUNDER_BUDGET=24;
export const FOUNDER_TRAITS=Object.freeze([
 ['生態・環境',[
  ['diet','肉食傾向',0,1,.05],['aquatic','水生（1）/陸生（0）',0,1,1],
  ['wet','水辺適応',0,1,.05],['dry','乾燥適応',0,1,.05],['rock','岩場適応',0,1,.05],
  ['idealTemp','適温（℃）',-5,40,1],['tempTolerance','温度耐性（±℃）',3,18,1],
  ['hibernate','休眠',0,1,.05],['resist','感染抵抗力',0,1,.05],
  ['frugality','省エネ',0,1,.05],['waterGardening','水草栽培',0,1,.05]]],
 ['体格・感覚・戦闘',[
  ['r','基本体格',3,15,.5],['elongation','体の長さ比',.65,3,.05],
  ['eyes','目の数',0,6,1],['mouths','口の数',1,4,1],['jaw','顎・攻撃力',.2,2.5,.1],
  ['deception','擬態',0,1,.05]]],
 ['繁殖・子育て',[
  ['repro','繁殖方式（0雌雄/1両性/2単為）',0,2,1],['brood','産卵数',1,8,1],
  ['shell','卵殻',0,1,.05],['guard','卵の保護',0,1,.05],
  ['nesting','巣作り',0,1,.05],['nestChoice','産卵地選択',0,1,.05],
  ['parentFeeding','親の給餌',0,1,.05],['yolkReserve','卵への栄養投資',0,1,.05],
  ['juvenileCannibalism','幼体の共食い',0,1,.05]]],
 ['行動・生存',[
  ['dispersal','分散傾向',0,1,.05],['sociability','集合傾向',0,1,.05],
  ['caution','警戒心',0,1,.05],['predatorSense','捕食者の識別',0,1,.05],
  ['retaliation','反撃',0,1,.05]]]
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
 return g;
}
export function founderCost(base,edited){
 let spent=0;
 for(const [key,,lo,hi] of FOUNDER_FIELDS){
  const delta=Math.abs(Number(edited[key]??base[key])-Number(base[key]));
  if(Number.isFinite(delta)&&hi>lo)spent+=Math.ceil(Math.max(0,delta/(hi-lo)*12-1e-7));
 }
 return spent;
}
export const canUseFounder=(base,edited,isGame)=>!isGame||founderCost(base,edited)<=FOUNDER_BUDGET;
