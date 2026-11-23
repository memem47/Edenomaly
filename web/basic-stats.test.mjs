import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem,GENETIC_LOCUS_LIMITS,morphology} from './simulation.js';
import {BASIC_STATS,basicStatLevel,editBasicStat,founderSkills,trainFounderSkill,skillTrainingGenes} from './basic-stats.js';
import {FOUNDER_FIELDS,founderCost,editFounderGenome} from './founder-designer.js';

test('basic stats are six derived views of existing genes, with no additional DNA (DNA v2)',async()=>{
 const {CORE_KEYS,DNA_KEYS,SKILLS,STRATEGY_FIELDS}=await import('./genome-model.js');
 assert.deepEqual(BASIC_STATS.map(s=>s.name),
  ['ちから','すばやさ','たいりょく','かしこさ','てきおう','はんしょく']);
 assert.deepEqual(BASIC_STATS.map(s=>s.key),CORE_KEYS);
 assert.equal(DNA_KEYS.length,27);assert.equal(SKILLS.length,14);assert.equal(STRATEGY_FIELDS.length,7);
 assert.equal(FOUNDER_FIELDS.length,27);
});

test('changing each basic stat modifies a genuine editable locus and leaves unrelated genes untouched (DNA v2)',async()=>{
 const base=new Ecosystem(20901).gene();
 for(const stat of BASIC_STATS){
  const target=base.dna[stat.key]===10?9:10,edited=editBasicStat(base,stat.key,target);
  assert.equal(edited.dna[stat.key],target);
  assert.deepEqual(edited.alleles[stat.key],[target,target]);
  for(const key of Object.keys(base.dna))if(key!==stat.key)assert.equal(edited.dna[key],base.dna[key]);
  assert.ok(Number.isFinite(founderCost(base,edited)));
 }
});

test('skill eligibility changes with real DNA and does not consume simulation randomness (DNA v2)',async()=>{
 const w=new Ecosystem(20902),g=w.gene(),before=w.rng;
 const aquatic=editFounderGenome(g,{aquatic:1,skillWaterGardening:1});
 const terrestrial=editFounderGenome(g,{aquatic:0,skillWaterGardening:1});
 const find=(g,name)=>founderSkills(g).find(s=>s.name===name);
 assert.equal(find(aquatic,'水草栽培').ready,true);
 assert.equal(find(terrestrial,'水草栽培').ready,true);
 assert.equal(aquatic.aquatic,1);assert.equal(terrestrial.aquatic,0);
 assert.equal(find(editFounderGenome(g,{skillParentFeeding:0}),'親の給餌').ready,false);
 assert.equal(find(editFounderGenome(g,{skillParentFeeding:1}),'親の給餌').ready,true);
 assert.equal(w.rng,before);
});

test('screen renders basic stats first and keeps gene details and live skills (DNA v2)',async()=>{
 const ui=await readFile(new URL('./founder-screens.js',import.meta.url),'utf8');
 const css=await readFile(new URL('./style.css',import.meta.url),'utf8');
 assert.match(ui,/id="toggleGeneEditor"/);assert.match(ui,/id="founderGeneEditor" class="founder-strategy-grid"/);
 assert.match(ui,/data-basic-stat/);
 assert.match(ui,/editBasicStat\(currentGenome\(\),input\.dataset\.basicStat,desired\)/);
 assert.match(ui,/changes\[input\.dataset\.basicStat\]=edited\.dna\[input\.dataset\.basicStat\]/);
 assert.match(ui,/founderSkills\(g\)/);
 assert.match(css,/#founderEditorDialog \.founder-two-columns/);
});

test('training every skill edits only existing genome loci and enables its prerequisites (DNA v2)',async()=>{
 const {SKILLS}=await import('./genome-model.js');
 const base=editFounderGenome(new Ecosystem(20903).gene(),Object.fromEntries(SKILLS.map(s=>[s.key,0])));
 for(const skill of founderSkills(base)){
  const trained=trainFounderSkill(base,skill.name),keys=skillTrainingGenes(skill.name);
  assert.equal(keys.length,1);assert.equal(trained.dna[keys[0]],1);
  assert.equal(founderSkills(trained).find(s=>s.name===skill.name).ready,true);
  assert.ok(Number.isFinite(founderCost(base,trained)));
 }
});
test('agility gene directly improves locomotion at a real upkeep cost',()=>{
 const g=new Ecosystem(20904).gene();
 const slow=morphology({...g,dispersal:0}),quick=morphology({...g,dispersal:1});
 assert.ok(quick.speed>slow.speed);
 assert.ok(quick.upkeep>slow.upkeep);
});
