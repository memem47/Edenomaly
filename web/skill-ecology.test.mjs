import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem} from './simulation.js';
import {editFounderGenome,FOUNDER_FIELDS} from './founder-designer.js';
import {SKILLS,DNA_KEYS} from './genome-model.js';
import {founderSkills} from './basic-stats.js';
import {founderFormulaHTML} from './founder-formulas.js';

test('all requested skills are distinct inherited loci and visible in founder editor',()=>{
 const keys=['skillPredation','skillNesting','skillCooperate','skillParentFeeding',
  'skillWaterGardening','skillAbsorb','skillSplit'];
 for(const key of keys){
  assert.ok(SKILLS.some(s=>s.key===key),key);
  assert.ok(DNA_KEYS.includes(key),key);
  assert.ok(FOUNDER_FIELDS.some(([k])=>k===key),key);
 }
 assert.equal(SKILLS.length,14);
 assert.equal(DNA_KEYS.length,27);
 assert.ok(founderFormulaHTML().includes('27遺伝子'));
 const g=new Ecosystem(2210).gene();
 for(const key of keys){
  const on=editFounderGenome(g,{[key]:1});
  assert.deepEqual(on.alleles[key],[1,1]);
  assert.equal(founderSkills(on).find(s=>s.key===key).ready,true);
 }
});
test('cooperation transfers real energy only to hungry same-lineage neighbors',()=>{
 const world=new Ecosystem(2211);
 const gene=editFounderGenome(world.gene(),{skillCooperate:1});
 const giver=world.spawn(180,180,gene),receiver=world.spawn(195,180,gene);
 receiver.lineage=giver.lineage;
 giver.stage='adult';giver.energy=165;receiver.energy=20;receiver.stage='juvenile';
 world.tick=24-(giver.id%24);
 const before=giver.energy;
 assert.equal(world.shareFoodWithAlly(giver,[receiver]),true);
 assert.ok(receiver.energy>20);
 assert.ok(giver.energy<before-(receiver.energy-20));
 assert.equal(world.shareFoodWithAlly(editFounderGenome(giver.g,{skillCooperate:0})===null?giver:{...giver,g:editFounderGenome(giver.g,{skillCooperate:0})},[receiver]),false);
});
test('nesting invests parent energy to protect eggs without creating free resources',()=>{
 const world=new Ecosystem(2212),base=world.gene();
 const parent=world.spawn(180,180,editFounderGenome(base,{skillNesting:1}));
 parent.energy=160;parent.stage='adult';
 parent.pregnancy={genomes:[parent.g],parent:parent.id,otherParent:null,
  generation:1,lineage:parent.lineage,parents:[]};
 const before=parent.energy,egg=world.layEgg(parent);
 assert.ok(egg.nestProtection);
 assert.ok(egg.energy>0);
 assert.ok(before-parent.energy>=4,'nest protection must cost parent energy');
});
test('division requires inherited skill, surplus resources, open space and cooldown',()=>{
 const w=new Ecosystem(2213),base=w.gene(),u=w.spawn(200,200,editFounderGenome(base,{skillSplit:1}));
 u.age=170;u.energy=195;u.hydration=100;u.hp=u.maxHp;u.stage='adult';
 u.infection=0;u.pregnancy=null;u.courtPartner=null;
 w.temperatureAt=()=>u.g.idealTemp;
 w.tick=720;
 assert.equal(w.canSkillSplit(u,[]),true);
 const before=u.energy,oldCount=w.units.length,child=w.skillSplit(u);
 assert.ok(child);
 assert.equal(w.units.length,oldCount+1);
 assert.ok(before-u.energy>=110);
 assert.ok(u.hp<u.maxHp);
 assert.equal(w.canSkillSplit(u,[]),false,'cooldown and depletion must prevent chaining');
 const u2=w.spawn(400,200,editFounderGenome(base,{skillSplit:0}));
 u2.age=170;u2.energy=195;u2.hydration=100;u2.hp=u2.maxHp;u2.stage='adult';
 assert.equal(w.canSkillSplit(u2,[]),false);
});
test('absorption and predation skills participate in actual feeding and attack code',async()=>{
 const {readFile}=await import('node:fs/promises');
 const s=await readFile(new URL('./simulation.js',import.meta.url),'utf8');
 assert.ok(s.includes("g.dna?.skillAbsorb===1"));
 assert.ok(s.includes("Math.max(effectiveMeatAffinity(u),absorption)"));
 assert.ok(s.includes("hunter.g.dna?.skillPredation===1?1.16:1"));
 assert.ok(s.includes("egg.nestProtection&&this.rand()<.42"));
 const base=new Ecosystem(2214).gene();
 const boosted=editFounderGenome(base,{diet:1,skillPredation:1});
 assert.equal(boosted.dna.skillPredation,1);
 const absorbing=editFounderGenome(base,{diet:0,skillAbsorb:1});
 assert.equal(absorbing.dna.skillAbsorb,1);
});
