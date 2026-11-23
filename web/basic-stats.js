// Player-friendly overview computed from the same 37 real hereditary loci.
// These are not new genes. Basic-stat editing changes the existing loci.
import {founderLevel,founderValueAtLevel,editFounderGenome} from './founder-designer.js';

import {BASIC_STAT_GROUPS,basicStatScore} from './basic-stat-score.js';
export const BASIC_STATS=BASIC_STAT_GROUPS;
const clamp=n=>Math.max(1,Math.min(10,Math.round(n)));
export const basicStatLevel=(g,key)=>basicStatScore(g,key);
export function editBasicStat(g,key,target){
 const stat=BASIC_STATS.find(s=>s.key===key);
 if(!stat)return g;
 const desired=clamp(Number(target));
 const before=basicStatLevel(g,key),delta=desired-before;
 if(delta===0)return g;
 // Move the real genes by the requested relative step, rather than inventing
 // a second hidden value. Preserve individual fine-tuning and trade-offs.
 const changes=Object.fromEntries(stat.genes.map(gene=>[
  gene,founderValueAtLevel(gene,clamp(founderLevel(gene,g[gene])+delta))
 ]));
 return editFounderGenome(g,changes);
}
const value=(g,k)=>Number(g?.[k]??0);
// Skill buttons train real loci, never a parallel RPG skill variable.
const SKILL_TRAINING=Object.freeze({
 '水草栽培':{aquatic:1,waterGardening:.65},
 '休眠':{hibernate:.7},
 '親の給餌':{parentFeeding:.65},
 '産卵地選択':{nestChoice:.70},
 '反撃':{retaliation:.70},
 '幼体共食い':{juvenileCannibalism:.8,diet:.35}
});
export function trainFounderSkill(g,name){
 const target=SKILL_TRAINING[name];
 if(!target)return g;
 const changes={};
 for(const [key,min] of Object.entries(target)){
  changes[key]=key==='aquatic'?1:Math.min(1,Math.max(min,Number(g[key]??0)+.10));
 }
 return editFounderGenome(g,changes);
}
export function skillTrainingGenes(name){return Object.keys(SKILL_TRAINING[name]??{});}
export function founderSkills(g){
 return [
  {name:'水草栽培',ready:g.aquatic===1&&value(g,'waterGardening')>=.4,
   detail:'水生かつ水草栽培が0.40以上。種を獲得し、水草の少ない場所で使用'},
  {name:'休眠',ready:value(g,'hibernate')>.52,
   detail:'休眠傾向0.52超。寒さや餌不足などの環境条件で発動'},
  {name:'親の給餌',ready:value(g,'parentFeeding')>=.35,
   detail:'給餌傾向0.35以上。親の体力と空腹の幼体が必要'},
  {name:'産卵地選択',ready:value(g,'nestChoice')>=.5,
   detail:'産卵地選択0.50以上。産卵時に栄養・安全な場所を探す'},
  {name:'反撃',ready:value(g,'retaliation')>=.5,
   detail:'反撃傾向0.50以上。実際の反撃は攻撃を受けた際の確率判定'},
  {name:'幼体共食い',ready:value(g,'juvenileCannibalism')>.68&&value(g,'diet')>.24,
   detail:'幼体共食い0.68超、肉食傾向0.24超。飢餓などの条件下でのみ発動'}
 ];
}
