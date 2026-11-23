import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem,GENETIC_LOCUS_LIMITS,morphology} from './simulation.js';
import {BASIC_STATS,basicStatLevel,editBasicStat,founderSkills,trainFounderSkill,skillTrainingGenes} from './basic-stats.js';
import {FOUNDER_FIELDS,founderCost,editFounderGenome} from './founder-designer.js';

test('basic stats are six derived views of existing genes, with no additional DNA',()=>{
 assert.deepEqual(BASIC_STATS.map(s=>s.name),
  ['ちから','すばやさ','たいりょく','かしこさ','てきおう','はんしょく']);
 const keys=FOUNDER_FIELDS.map(([key])=>key);
 assert.equal(keys.length,37);
 for(const stat of BASIC_STATS){
  assert.ok(stat.help.length>10&&stat.genes.length);
  for(const gene of stat.genes){
   assert.ok(keys.includes(gene),stat.key+': '+gene);
   assert.ok(Object.hasOwn(GENETIC_LOCUS_LIMITS,gene));
  }
 }
});

test('changing each basic stat modifies a genuine editable locus and leaves unrelated genes untouched',()=>{
 const base=editFounderGenome(new Ecosystem(20901).gene(),{resist:.5,guard:.5});
 for(const stat of BASIC_STATS){
  const current=basicStatLevel(base,stat.key);
  const target=current<=5?current+2:current-2;
  const edited=editBasicStat(base,stat.key,target);
  assert.ok(edited!==base);
  assert.ok(edited.functionalBody);
  assert.ok(stat.genes.some(k=>edited[k]!==base[k]),'no-op '+stat.key);
  assert.equal(Object.keys(edited).includes(stat.key),false);
  for(const key of FOUNDER_FIELDS.map(([k])=>k)){
   if(!stat.genes.includes(key)&&!['r','elongation','eyes','mouths','jaw'].includes(key))
    assert.equal(edited[key],base[key],stat.key+' changed '+key);
  }
  assert.ok(Number.isFinite(founderCost(base,edited)));
 }
});

test('skill eligibility changes with real DNA and does not consume simulation randomness',()=>{
 const w=new Ecosystem(20902),g=w.gene(),before=w.rng;
 const aquatic=editFounderGenome(g,{aquatic:1,waterGardening:.9});
 const terrestrial=editFounderGenome(g,{aquatic:0,waterGardening:.9});
 const skill=name=>x=>founderSkills(x).find(s=>s.name===name);
 assert.equal(skill('水草栽培')(aquatic).ready,true);
 assert.equal(skill('水草栽培')(terrestrial).ready,false);
 assert.equal(skill('親の給餌')(editFounderGenome(g,{parentFeeding:0})).ready,false);
 assert.equal(skill('親の給餌')(editFounderGenome(g,{parentFeeding:1})).ready,true);
 assert.equal(w.rng,before);
});

test('screen renders basic stats first and keeps gene details and live skills',async()=>{
 const ui=await readFile(new URL('./founder-screens.js',import.meta.url),'utf8');
 const css=await readFile(new URL('./style.css',import.meta.url),'utf8');
 assert.match(ui,/id="toggleGeneEditor"/);
 assert.match(ui,/id="founderGeneEditor" hidden/);
 assert.match(ui,/data-basic-stat/);
 assert.match(ui,/editBasicStat\(currentGenome\(\),input\.dataset\.basicStat,desired\)/);
 assert.match(ui,/changes\[key\]=edited\[key\]/);
 assert.match(ui,/founderSkills\(g\)/);
 assert.match(css,/#founderGeneEditor\[hidden\]/);
});

test('training every skill edits only existing genome loci and enables its prerequisites',()=>{
 const base=editFounderGenome(new Ecosystem(20903).gene(),{
  aquatic:0,waterGardening:0,hibernate:0,parentFeeding:0,
  nestChoice:0,retaliation:0,juvenileCannibalism:0,diet:0
 });
 for(const skill of founderSkills(base)){
  const trained=trainFounderSkill(base,skill.name);
  const newSkill=founderSkills(trained).find(s=>s.name===skill.name);
  assert.ok(newSkill.ready,skill.name);
  assert.ok(skillTrainingGenes(skill.name).length,skill.name);
  assert.ok(skillTrainingGenes(skill.name).some(key=>trained[key]!==base[key]),skill.name);
  assert.ok(Number.isFinite(founderCost(base,trained)));
 }
});
test('agility gene directly improves locomotion at a real upkeep cost',()=>{
 const g=new Ecosystem(20904).gene();
 const slow=morphology({...g,dispersal:0}),quick=morphology({...g,dispersal:1});
 assert.ok(quick.speed>slow.speed);
 assert.ok(quick.upkeep>slow.upkeep);
});
