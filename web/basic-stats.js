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
 skillCannibalism:'空腹と食性などの条件が揃うと幼体を捕食します。',
 skillSprint:'獲物を追う・捕食者から逃げるときだけ一時的に加速します。エネルギーを消費します。',
 skillAmbush:'肉食個体が警戒していない獲物に最初の一撃を与えるとダメージが増えます。',
 skillRegenerate:'十分な餌と水があり感染していないとき、エネルギーを使ってHPを早く回復します。',
 skillPredation:'肉食の攻撃が強くなり、倒した獲物から得られる栄養も増えます。肉食自体には必須ではありません。',
 skillNesting:'卵にエネルギーを投資して巣に守られた状態にし、捕食されにくくします。',
 skillCooperate:'十分な栄養がある成体が、近くにいる同系統の空腹個体へ栄養を分けます。',
 skillAbsorb:'肉食でなくても死体の残存栄養を少量吸収します。利用した資源は減ります。',
 skillSplit:'成体が多くの栄養と体力を消費して低密度の場所で分裂します。冷却期間が必要です。'
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
