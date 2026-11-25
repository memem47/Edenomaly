import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem} from '../web/simulation.js';
import {DNA_KEYS} from '../web/genome-model.js';

const differs=(a,b)=>DNA_KEYS.some(key=>
 a.alleles[key][0]!==b.alleles[key][0]||a.alleles[key][1]!==b.alleles[key][1]);

test('mutation calls result in genetic variation rather than silent no-ops',()=>{
 const sim=new Ecosystem(2026112601),founder=sim.gene();
 let actual=0,expressed=0;
 for(let i=0;i<500;i++){
  const offspring=sim.mutate(founder);
  if(differs(founder,offspring))actual++;
  if(sim.category(founder)!==sim.category(offspring))expressed++;
 }
 assert.ok(actual>=490,'mutate should change an allele in almost all calls: '+actual);
 assert.ok(expressed<actual,'most gene mutations need not create new species');
});
test('new species are still discovered by natural births and classified by phenotype',()=>{
 const sim=new Ecosystem(2026112602);
 sim.introduce(170,130,1);
 const founders=sim.species.size;
 const founder=sim.units[0].g;
 const inheritedVariants=new Set();
 for(let i=0;i<2000;i++){
  const child=sim.mutate(founder);
  inheritedVariants.add(sim.category(child));
 }
 assert.ok(inheritedVariants.size>1,'mutations can give rise to new phenotypic species');
 assert.equal(sim.species.size,founders,'mutation alone does not register a species without an actual individual');
});
