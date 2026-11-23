import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,terrainFitness,thermalFitness,pursuitEscapeSpeedFactor,phenotypeTraits} from './simulation.js';
import {editFounderGenome} from './founder-designer.js';
import {SKILLS,DNA_KEYS} from './genome-model.js';
import {GENOME_DERIVATION_FORMULAS,founderFormulaHTML} from './founder-formulas.js';

test('strength increases actual carnivorous attack damage even when morphology is held constant',()=>{
 const w=new Ecosystem(20261123221);
 const base=editFounderGenome(w.gene(),{diet:.95,power:5,skillAmbush:0});
 const preyGene=editFounderGenome(w.gene(),{diet:0,stamina:9});
 const attacker=w.spawn(180,180,base),victim=w.spawn(188,180,preyGene);
 assert.ok(attacker&&victim);
 const hit=(power,ambush)=>{
  attacker.g={...base,dna:{...base.dna,power,skillAmbush:ambush}};
  attacker.bite=0;victim.bite=0;victim.attackResponse=null;victim.maxHp=10000;victim.hp=10000;
  const before=victim.hp;
  assert.equal(w.attack(attacker,victim),true);
  return before-victim.hp;
 };
 const low=hit(1,0),high=hit(10,0),surprise=hit(10,1);
 assert.ok(high>low*1.3,'power must improve real attack damage, not only jaw shape');
 assert.ok(surprise>high*1.18,'ambush must increase an initial unguarded carnivore hit');
});
test('agility and sprint raise pursuit and escape movement but not passive speed',()=>{
 const w=new Ecosystem(20261123222),base=w.gene();
 const slow=editFounderGenome(base,{agility:1,skillSprint:0});
 const fast=editFounderGenome(base,{agility:10,skillSprint:0});
 const sprint=editFounderGenome(base,{agility:10,skillSprint:1});
 assert.equal(pursuitEscapeSpeedFactor(slow,false),1);
 assert.equal(pursuitEscapeSpeedFactor(fast,false),1);
 assert.ok(pursuitEscapeSpeedFactor(fast,true)>pursuitEscapeSpeedFactor(slow,true));
 assert.ok(pursuitEscapeSpeedFactor(sprint,true)>pursuitEscapeSpeedFactor(fast,true));
 assert.equal(pursuitEscapeSpeedFactor(sprint,true,40),pursuitEscapeSpeedFactor(fast,true));
});
test('stamina changes size elongation mouths but not pattern or inner glow',()=>{
 const w=new Ecosystem(20261123223),g=w.gene();
 const low=editFounderGenome(g,{stamina:1});
 const high=editFounderGenome(g,{stamina:10});
 assert.ok(high.r>low.r);
 assert.ok(high.elongation>low.elongation);
 assert.ok(high.mouths>low.mouths);
 assert.equal(high.pattern,low.pattern,'stamina must not control the pattern');
 assert.equal(high.longevity,low.longevity,'stamina must not control inner glow');
});
test('fertility controls glowing core; adaptation controls pattern, not terrain specialization',()=>{
 const w=new Ecosystem(20261123224),g=w.gene();
 const fertile=editFounderGenome(g,{fertility:10}),infertile=editFounderGenome(g,{fertility:1});
 assert.ok(fertile.longevity>infertile.longevity);
 const weak=editFounderGenome(g,{adaptation:1,biome:2});
 const versatile=editFounderGenome(g,{adaptation:10,biome:2});
 assert.ok(versatile.pattern>weak.pattern);
 for(const field of ['wet','dry','rock'])assert.equal(versatile[field],weak[field]);
 const poorWet=terrainFitness(weak,1),goodWet=terrainFitness(versatile,1);
 assert.ok(goodWet.fitness>poorWet.fitness);
 assert.ok(goodWet.upkeep<=poorWet.upkeep);
 const cold=thermalFitness(weak,-20),better=thermalFitness(versatile,-20);
 assert.ok(better.excess<cold.excess);
 const water=editFounderGenome(g,{biome:1});
 const dry=editFounderGenome(g,{biome:2});
 const rock=editFounderGenome(g,{biome:3});
 assert.ok(water.wet>dry.wet);
 assert.ok(dry.dry>water.dry);
 assert.ok(rock.rock>water.rock);
});
test('regeneration uses sufficient energy to heal HP faster',()=>{
 const w=new Ecosystem(20261123225),g=w.gene(),base=editFounderGenome(g,{skillRegenerate:0});
 const regen=editFounderGenome(g,{skillRegenerate:1});
 const heal=genome=>{
  const u={g:genome,hp:35,maxHp:100,age:100,energy:155,hydration:100,infection:0,
   lastHpDamageTick:-100};
  w.tick=140;
  w.updateVitalHealth(u);
  return {hp:u.hp,energy:u.energy};
 };
 const ordinary=heal(base),healer=heal(regen);
 assert.ok(healer.hp>ordinary.hp);
 assert.ok(healer.energy<ordinary.energy);
});
test('all three new skills are heritable selectable and mechanically described',()=>{
 for(const key of ['skillSprint','skillAmbush','skillRegenerate']){
  assert.ok(DNA_KEYS.includes(key));
  assert.ok(SKILLS.some(skill=>skill.key===key));
  const world=new Ecosystem(20261123226),base=world.gene();
  const on=editFounderGenome(base,{[key]:1});
  assert.deepEqual(on.alleles[key],[1,1]);
  assert.equal(world.recombine(on,on).dna[key],1);
 }
 const formulaMap=new Map(GENOME_DERIVATION_FORMULAS.map(([key,,formula])=>[key,formula]));
 assert.ok(formulaMap.get('pattern').includes('adaptationN'));
 assert.ok(formulaMap.get('longevity').includes('fertilityN'));
 assert.ok(formulaMap.get('r').includes('staminaN'));
 assert.ok(founderFormulaHTML().includes('22遺伝子'));
 assert.equal(phenotypeTraits(editFounderGenome(new Ecosystem(20261123227).gene(),{adaptation:10})).genes.pattern>0,true);
});
