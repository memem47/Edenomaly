// Biome starters for canonical six-stat + skill + strategy DNA.
import {FOUNDER_BUDGET,editFounderGenome,founderCost} from './founder-designer.js';
import {CORE_KEYS,SKILLS} from './genome-model.js';
const BALANCED=Object.freeze({
 power:4,agility:5,stamina:6,intellect:5,adaptation:5,fertility:5,
 diet:.16,aquatic:0,repro:0,biome:0,thermal:.60,social:.55,albino:0,
 skillWaterGardening:0,skillHibernate:0,skillParentFeeding:0,
 skillNestChoice:0,skillRetaliation:0,skillCannibalism:0
});
export const FOUNDER_PRESETS=Object.freeze([
 {id:'grass',name:'🌿 草原の草食型',description:'草原で食料を探し、抵抗力と省エネを重視する入門型。',
  values:{stamina:7,fertility:6,diet:.05,biome:0,agility:5}},
 {id:'water',name:'💧 水辺の水草型',description:'水生のスライム。水辺に適応し、水草栽培スキルを持つ。',
  values:{stamina:5,adaptation:7,agility:6,diet:.05,aquatic:1,biome:1,skillWaterGardening:1}},
 {id:'desert',name:'🏜 乾燥地の節約型',description:'乾燥地と季節の変化に備え、休眠する。',
  values:{stamina:8,adaptation:7,fertility:3,diet:.36,biome:2,skillHibernate:1}},
 {id:'rock',name:'🪨 岩場の警戒型',description:'岩場に強い生存戦略。危険を早期に察知し、反撃スキルで卵や仲間を守る。',
  values:{power:7,intellect:7,adaptation:7,diet:.42,biome:3,skillRetaliation:1}}
]);
export function founderPresetGenome(base,id){
 const preset=FOUNDER_PRESETS.find(p=>p.id===id);
 return preset?editFounderGenome(base,{...BALANCED,...preset.values}):null;
}
export function randomFounderGenome(base,random=Math.random){
 const preset=FOUNDER_PRESETS[Math.min(FOUNDER_PRESETS.length-1,Math.floor(random()*FOUNDER_PRESETS.length))];
 const initial=founderPresetGenome(base,preset.id),changes={};
 for(const key of CORE_KEYS)changes[key]=Math.max(1,Math.min(10,initial.dna[key]+Math.round((random()-.5)*3)));
 for(const skill of SKILLS)if(random()<.07)changes[skill.key]=1;
 let result=editFounderGenome(initial,changes);
 if(founderCost(base,result)>FOUNDER_BUDGET)result=initial;
 return result;
}
