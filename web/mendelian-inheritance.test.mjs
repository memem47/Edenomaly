import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem} from './simulation.js';
import {editFounderGenome} from './founder-designer.js';
import {DNA_KEYS,RECESSIVE_SKILLS,DOMINANT_SKILLS,INHERITANCE_RULES,expressAllelePair,expressDNA} from './genome-model.js';

function chooseAlleles(world,which=0.2){
 const old=world.rand;
 let count=0;
 world.rand=()=>count++<DNA_KEYS.length*2?which:.99;
 return ()=>{world.rand=old;};
}
test('explicit genetics classify every locus and all skills by inheritance rules',()=>{
 assert.equal(Object.keys(INHERITANCE_RULES).length,DNA_KEYS.length);
 assert.equal(RECESSIVE_SKILLS.length+DOMINANT_SKILLS.length,16);
 assert.equal(INHERITANCE_RULES.power,'additive');
 assert.equal(INHERITANCE_RULES.albino,'recessive');
 assert.equal(INHERITANCE_RULES.skillSplit,'recessive');
 assert.equal(INHERITANCE_RULES.skillSprint,'dominant');
 for(const key of DNA_KEYS)assert.ok(INHERITANCE_RULES[key],key);
});
test('both parents contribute one allele; hidden trait can appear in grandchildren',()=>{
 const w=new Ecosystem(20444),base=w.gene();
 const active=editFounderGenome(base,{skillHibernate:1});
 const inactive=editFounderGenome(base,{skillHibernate:0});
 let restore=chooseAlleles(w);
 const f1=w.recombine(active,inactive);
 restore();
 assert.deepEqual(f1.alleles.skillHibernate,[1,0]);
 assert.equal(f1.dna.skillHibernate,0,'a recessive trait is latent in heterozygotes');
 assert.equal(f1.hibernate,0,'inactive phenotype has no hibernation');
 restore=chooseAlleles(w);
 const f2=w.recombine(f1,f1);
 restore();
 assert.deepEqual(f2.alleles.skillHibernate,[1,1]);
 assert.equal(f2.dna.skillHibernate,1,'two hidden carriers can have an expressed grandchild');
 assert.ok(f2.hibernate>0);
});
test('two heterozygous recessive carriers yield one expressed combination in four',()=>{
 const outcomes=[[1,1],[1,0],[0,1],[0,0]].map(pair=>expressAllelePair('skillSplit',pair));
 assert.deepEqual(outcomes,[1,0,0,0]);
 assert.equal(expressAllelePair('albino',[1,0]),0);
 assert.equal(expressAllelePair('albino',[1,1]),1);
});
test('dominant skill expresses from a single copy, but recessive copies remain inherited',()=>{
 const w=new Ecosystem(20445),base=w.gene();
 const on=editFounderGenome(base,{skillSprint:1}),off=editFounderGenome(base,{skillSprint:0});
 const restore=chooseAlleles(w),child=w.recombine(on,off);
 restore();
 assert.deepEqual(child.alleles.skillSprint,[1,0]);
 assert.equal(child.dna.skillSprint,1);
 assert.equal(expressAllelePair('skillSprint',[0,1]),1);
 assert.equal(expressAllelePair('skillSprint',[0,0]),0);
});
test('quantitative core genes are additive and preserve hidden allele diversity',()=>{
 const w=new Ecosystem(20446),base=w.gene();
 const weak=editFounderGenome(base,{power:2}),strong=editFounderGenome(base,{power:8});
 const restore=chooseAlleles(w),offspring=w.recombine(weak,strong);
 restore();
 assert.deepEqual(offspring.alleles.power,[2,8]);
 assert.equal(offspring.dna.power,5);
 assert.equal(expressAllelePair('power',[4,10]),7);
 assert.equal(offspring.genomeModel,2);
});
test('mutation can create a hidden recessive allele without immediately changing phenotype',()=>{
 const w=new Ecosystem(20447);
 const base=editFounderGenome(w.gene(),{skillRegenerate:0});
 const index=DNA_KEYS.indexOf('skillRegenerate');
 let n=0;
 const old=w.rand;
 const stream=[.9,.9,(index+.1)/DNA_KEYS.length,.2,.05];
 w.rand=()=>stream[n++]??.99;
 const mutant=w.mutate(base);
 w.rand=old;
 assert.deepEqual(mutant.alleles.skillRegenerate,[1,0]);
 assert.equal(mutant.dna.skillRegenerate,0);
 assert.equal(mutant.genomeModel,2);
});
test('parents and offspring retain unexpressed alleles without changing simulation RNG during observation',()=>{
 const w=new Ecosystem(20448),base=w.gene();
 const carrier=expressDNA({dna:{...base.dna,skillSplit:0},alleles:{
  ...base.alleles,skillSplit:[1,0]}});
 assert.equal(carrier.dna.skillSplit,0);
 const before=w.rng;
 assert.equal(expressAllelePair('skillSplit',carrier.alleles.skillSplit),0);
 assert.equal(w.rng,before);
});
