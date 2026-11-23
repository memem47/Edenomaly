import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DNA_KEYS,DNA_LIMITS,CORE_KEYS,SKILLS,STRATEGY_FIELDS,expressDNA,canonicalDNA} from './genome-model.js';
import {Ecosystem,GENETIC_LOCUS_LIMITS,genomeCode} from './simulation.js';
import {FOUNDER_FIELDS,editFounderGenome,founderCost,canUseFounder,FOUNDER_BUDGET} from './founder-designer.js';
import {BASIC_STATS,basicStatLevel,editBasicStat,founderSkills,trainFounderSkill} from './basic-stats.js';
import {GENOME_DERIVATION_FORMULAS,founderFormulaHTML} from './founder-formulas.js';
import {FOUNDER_TRAIT_HELP} from './founder-trait-help.js';
import {speciesReport} from './species-statistics.js';

test('genome has only six core, six skills and seven strategies',()=>{
 assert.equal(CORE_KEYS.length,6);assert.equal(SKILLS.length,6);assert.equal(STRATEGY_FIELDS.length,7);
 assert.equal(DNA_KEYS.length,19);
 assert.deepEqual([...DNA_KEYS].sort(),FOUNDER_FIELDS.map(f=>f[0]).sort());
 assert.deepEqual([...DNA_KEYS].sort(),Object.keys(FOUNDER_TRAIT_HELP).sort());
 assert.deepEqual(GENOME_DERIVATION_FORMULAS.map(f=>f[0]).sort(),Object.keys(GENETIC_LOCUS_LIMITS).sort());
});

test('each simulated founder inherits only 19 loci; 37 ecology values are computed, not alleles',()=>{
 const w=new Ecosystem(2026112308),g=w.gene();
 assert.equal(g.genomeModel,2);
 assert.equal(Object.keys(g.dna).length,19);
 assert.deepEqual(Object.keys(g.alleles).sort(),[...DNA_KEYS].sort());
 for(const key of DNA_KEYS){
  assert.deepEqual(g.alleles[key],[g.dna[key],g.dna[key]]);
  const [lo,hi]=DNA_LIMITS[key];
  assert.ok(g.dna[key]>=lo&&g.dna[key]<=hi,key);
 }
 for(const key of Object.keys(GENETIC_LOCUS_LIMITS))
  if(!DNA_KEYS.includes(key))assert.ok(!Object.hasOwn(g.alleles,key),'derived locus wrongly inherited: '+key);
});

test('all old physiology values are deterministic functions of new genotype',()=>{
 const g=new Ecosystem(2026112309).gene();
 const clone=expressDNA({dna:canonicalDNA(g)});
 for(const key of Object.keys(GENETIC_LOCUS_LIMITS))
  assert.equal(g[key],clone[key],key);
 assert.equal(genomeCode(g),genomeCode(clone));
});

test('six direct core stats persist through editing, mutation and recombination',()=>{
 const world=new Ecosystem(2026112310),g=world.gene();
 const edited=editBasicStat(g,'stamina',10);
 assert.equal(edited.dna.stamina,10);
 assert.equal(basicStatLevel(edited,'stamina'),10);
 for(const stat of BASIC_STATS)if(stat.key!=='stamina')
  assert.equal(edited.dna[stat.key],g.dna[stat.key],stat.key);
 const b=editFounderGenome(g,{power:9,fertility:7,biome:3});
 const child=world.recombine(b,edited),mutant=world.mutate(child);
 for(const member of [child,mutant]){
  assert.equal(Object.keys(member.alleles).length,19);
  assert.equal(member.genomeModel,2);
  for(const k of DNA_KEYS)assert.ok(Number.isFinite(member.dna[k]),k);
 }
 assert.ok(Number.isFinite(founderCost(g,edited)));
 assert.equal(canUseFounder(g,editFounderGenome(g,{power:10,stamina:10,agility:10,intellect:10,adaptation:10,fertility:10}),true),false);
 assert.ok(FOUNDER_BUDGET>0);
});

test('skill presence is inherited independently of basic stat and gates its own behavior',()=>{
 const w=new Ecosystem(2026112311),g=w.gene();
 const off=editFounderGenome(g,Object.fromEntries(SKILLS.map(s=>[s.key,0])));
 const on=editFounderGenome(off,Object.fromEntries(SKILLS.map(s=>[s.key,1])));
 assert.equal(off.hibernate,0);assert.equal(off.waterGardening,0);
 assert.equal(off.parentFeeding,0);assert.equal(off.retaliation,0);assert.equal(off.nestChoice,0);
 assert.equal(off.juvenileCannibalism,0);
 for(const s of SKILLS)assert.equal(on.dna[s.key],1);
 assert.ok(on.hibernate>0&&on.retaliation>0&&on.parentFeeding>0);
 const trained=trainFounderSkill(off,'親の給餌');
 assert.equal(trained.dna.skillParentFeeding,1);
 assert.equal(founderSkills(trained).find(s=>s.name==='親の給餌').ready,true);
 const child=w.recombine(off,on);
 assert.equal(child.genomeModel,2);
 assert.ok([0,1].includes(child.dna.skillParentFeeding));
});

test('strategies independently determine diet habitat reproductive mode and thermal preference',()=>{
 const g=new Ecosystem(2026112312).gene();
 const a=editFounderGenome(g,{aquatic:1,repro:2,diet:.9,biome:1,thermal:0});
 const b=editFounderGenome(g,{aquatic:0,repro:0,diet:.1,biome:3,thermal:1});
 assert.equal(a.aquatic,1);assert.equal(a.repro,2);assert.ok(a.diet>.8);
 assert.equal(b.aquatic,0);assert.equal(b.repro,0);assert.ok(b.diet<.2);
 assert.ok(a.wet>b.wet);assert.ok(b.rock>a.rock);
 assert.equal(a.idealTemp,-5);assert.equal(b.idealTemp,40);
});

test('founder only formula index explains 19 DNA and 37 derived physiology fields',async()=>{
 const html=founderFormulaHTML(),ui=await readFile(new URL('./founder-screens.js',import.meta.url),'utf8');
 assert.match(html,/19遺伝子/);
 assert.match(html,/37応用パラメータ/);
 assert.equal((html.match(/<tr>/g)||[]).length>=40,true);
 assert.match(ui,/founderFormulaHTML\(\)/);
 assert.match(ui,/生存戦略7項目/);
 assert.ok(!ui.includes('全37遺伝子を表示（詳細18項目）'));
});

test('high-speed headless ecology executes with canonical genetics',()=>{
 const w=new Ecosystem(2026112313),genome=w.gene();
 const spawned=w.introduce(240,180,1,genome);
 assert.equal(spawned.types,1);assert.ok(spawned.individuals>=2);
 for(let i=0;i<75;i++)w.step();
 for(const u of w.units){
  assert.equal(u.g.genomeModel,2);
  assert.equal(Object.keys(u.g.dna).length,19);
 }
 const rows=speciesReport(w);
 assert.ok(rows.some(row=>row.metric==='stat_power'));
});
