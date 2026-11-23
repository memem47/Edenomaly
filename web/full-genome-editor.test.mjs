import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,GENETIC_LOCUS_LIMITS,visibleOrnaments,functionalOrnaments,morphology} from './simulation.js';
import {FOUNDER_FIELDS,editFounderGenome,founderValueAtLevel,founderLevel} from './founder-designer.js';
import {FOUNDER_TRAIT_HELP} from './founder-trait-help.js';
import {abilityAppearance} from './slime-ornaments.js';

const shapeKeys=['r','elongation','eyes','mouths','jaw'];
test('full genetic editor exactly matches the heritable genome registry',()=>{
 const keys=FOUNDER_FIELDS.map(([key])=>key);
 assert.equal(keys.length,37);
 assert.deepEqual([...keys].sort(),Object.keys(GENETIC_LOCUS_LIMITS).sort());
 assert.deepEqual([...keys].sort(),Object.keys(FOUNDER_TRAIT_HELP).sort());
 for(const [key,,lo,hi] of FOUNDER_FIELDS){
  assert.deepEqual(GENETIC_LOCUS_LIMITS[key],[lo,hi],key);
 }
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

test('directly edited morphology overrides the computed body and survives descendants',()=>{
 const world=new Ecosystem(201122),base=world.gene();
 const g=editFounderGenome(base,{eyes:5,r:13,jaw:2.25});
 assert.deepEqual(g.bodyOverrides.sort(),['eyes','jaw','r'].sort());
 assert.equal(g.eyes,5);
 assert.equal(g.r,13);
 assert.equal(g.jaw,2.25);
 assert.equal(g.alleles.eyes[0],5);
 const recomputed=editFounderGenome(g,{diet:0,retaliation:0,predatorSense:0});
 assert.equal(recomputed.r,13);
 assert.equal(recomputed.eyes,5);
 assert.equal(recomputed.jaw,2.25);
 const mutated=world.mutate(g);
 assert.ok(mutated.bodyOverrides.includes('eyes'));
 assert.equal(mutated.eyes,Math.max(...mutated.alleles.eyes));
 const child=world.recombine(g,g);
 assert.ok(child.bodyOverrides.includes('jaw'));
 assert.equal(child.jaw,(child.alleles.jaw[0]+child.alleles.jaw[1])/2);
 const passive=editFounderGenome(base,{predatorSense:1,caution:1});
 assert.ok(!passive.bodyOverrides.includes('eyes'));
 assert.equal(passive.eyes,6);
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
