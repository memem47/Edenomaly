import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,GENETIC_LOCUS_LIMITS,visibleOrnaments,functionalOrnaments,morphology} from './simulation.js';
import {FOUNDER_FIELDS,editFounderGenome,founderValueAtLevel,founderLevel} from './founder-designer.js';
import {FOUNDER_TRAIT_HELP} from './founder-trait-help.js';
import {abilityAppearance} from './slime-ornaments.js';

const shapeKeys=['r','elongation','eyes','mouths','jaw'];
test('full genetic editor exactly matches the heritable genome registry (DNA v2)',async()=>{
 const {DNA_KEYS,DNA_LIMITS}=await import('./genome-model.js');
 const keys=FOUNDER_FIELDS.map(([key])=>key);
 assert.equal(keys.length,19);
 assert.deepEqual([...keys].sort(),[...DNA_KEYS].sort());
 assert.deepEqual([...keys].sort(),Object.keys(FOUNDER_TRAIT_HELP).sort());
 for(const [key,,lo,hi] of FOUNDER_FIELDS)assert.deepEqual(DNA_LIMITS[key],[lo,hi],key);
 assert.equal(Object.keys(GENETIC_LOCUS_LIMITS).length,37);
});

test('all genes change at least one visible trait, shape or color endpoint',()=>{
 const g=new Ecosystem(20991111).gene();
 for(const [key,,lo,hi] of FOUNDER_FIELDS){
  const signature=(value)=>{
   const x=editFounderGenome(g,{[key]:value});
   return {
    body:[x.r,x.elongation,x.eyes,x.mouths,x.jaw],
    ornaments:visibleOrnaments(x),
    details:abilityAppearance(x),
    albino:x.albino
   };
  };
  assert.notDeepEqual(signature(lo),signature(hi),key);
 }
});

test('directly edited morphology overrides the computed body and survives descendants (DNA v2)',async()=>{
 const w=new Ecosystem(201122),base=w.gene();
 const a=editFounderGenome(base,{power:10,intellect:9,fertility:9,agility:7});
 assert.ok(a.r>base.r);assert.ok(a.jaw>base.jaw);assert.ok(a.eyes>=base.eyes);
 for(const key of ['r','eyes','mouths','jaw','elongation'])assert.ok(!Object.hasOwn(a.alleles,key));
 const derived=editFounderGenome(a,{power:4,intellect:4,fertility:4});
 assert.ok(derived.r<a.r);assert.ok(derived.jaw<a.jaw);
 const child=w.recombine(a,a),mutated=w.mutate(a);
 assert.equal(child.genomeModel,2);assert.equal(mutated.genomeModel,2);
 assert.equal(Object.keys(child.alleles).length,19);
 assert.equal(Object.keys(mutated.alleles).length,19);
 assert.deepEqual(child.dna,a.dna);
});

test('cosmetic loci affect visual phenotype without modifying existing mechanics',()=>{
 const world=new Ecosystem(201123),g=world.gene();
 const a={...g,tailLength:0,hornLength:0,antennaLength:0,pattern:0};
 const b={...g,tailLength:1,hornLength:1,antennaLength:1,pattern:1};
 assert.notDeepEqual(visibleOrnaments(a),visibleOrnaments(b));
 assert.deepEqual(functionalOrnaments(a),functionalOrnaments(b));
 assert.deepEqual(morphology(a),morphology(b));
});

test('all direct edits honor 1–10 controls and re-express homozygous alleles',()=>{
 const g=new Ecosystem(201124).gene();
 for(const [key] of FOUNDER_FIELDS){
  for(const level of [1,10]){
   const expected=founderValueAtLevel(key,level);
   const x=editFounderGenome(g,{[key]:expected});
   assert.equal(x[key],expected,key+': '+level);
   assert.deepEqual(x.alleles[key],[expected,expected],key+': '+level);
   assert.equal(founderLevel(key,x[key]),level,key);
  }
 }
});
