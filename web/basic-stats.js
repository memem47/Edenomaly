// Six inherited stats and six inheritable on/off skill traits.
import {CORE_KEYS,SKILLS,canonicalDNA} from './genome-model.js';
import {BASIC_STAT_GROUPS,basicStatScore} from './basic-stat-score.js';
import {editFounderGenome} from './founder-designer.js';
export const BASIC_STATS=BASIC_STAT_GROUPS;
export const basicStatLevel=(g,key)=>basicStatScore(g,key);
export function editBasicStat(g,key,target){
 if(!CORE_KEYS.includes(key))return g;
 return editFounderGenome(g,{[key]:Math.max(1,Math.min(10,Math.round(Number(target)||1)))});
}
const SKILL_DESCRIPTIONS={
 skillWaterGardening:'水生で水草の種を獲得し、植え付け可能な場所で利用します。',
 skillHibernate:'寒さ・餌不足などの環境条件で休眠します。',
 skillParentFeeding:'余剰の栄養がある親が空腹の幼体に給餌します。',
 skillNestChoice:'産卵時によりよい場所を選ぼうとします。',
 skillRetaliation:'攻撃を受けた場合に反撃します。',
 skillCannibalism:'空腹と食性などの条件が揃うと幼体を捕食します。'
};
export function founderSkills(g){
 const dna=canonicalDNA(g);
 return SKILLS.map(skill=>({key:skill.key,name:skill.label,
  ready:dna[skill.key]===1,detail:SKILL_DESCRIPTIONS[skill.key]}));
}
export function trainFounderSkill(g,name){
 const skill=SKILLS.find(s=>s.label===name);
 return skill?editFounderGenome(g,{[skill.key]:1}):g;
}
export function skillTrainingGenes(name){
 const skill=SKILLS.find(s=>s.label===name);
 return skill?[skill.key]:[];
}
