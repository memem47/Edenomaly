import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,GENETIC_LOCUS_LIMITS,phenotypeTraits,phenotypeSignature,distinctivePhenotypeNames,speciesNameFromCategory} from './simulation.js';
import {FOUNDER_FIELDS,editFounderGenome} from './founder-designer.js';
import {drawOrnamentsBehind,drawOrnamentsFront,drawAbilityDetails} from './slime-ornaments.js';

test('each one of 37 genes changes appearance and an identifying name token',()=>{
 const w=new Ecosystem(2026112304),base=editFounderGenome(w.gene(),{});
 assert.equal(FOUNDER_FIELDS.length,37);
 for(const [key,,lo,hi] of FOUNDER_FIELDS){
  const a=editFounderGenome(base,{[key]:lo});
  const b=editFounderGenome(base,{[key]:hi});
  const phenotypeA=phenotypeTraits(a),phenotypeB=phenotypeTraits(b);
  assert.notEqual(phenotypeA.genes[key],phenotypeB.genes[key],key);
  assert.notEqual(phenotypeSignature(a),phenotypeSignature(b),key);
  assert.notEqual(speciesNameFromCategory(w.category(a),a),
   speciesNameFromCategory(w.category(b),b),key);
 }
});
test('fertility and stamina drive recognizable egg and armor features',()=>{
 const w=new Ecosystem(2026112305),g=w.gene();
 const stamina=editFounderGenome(g,{resist:1,shell:1,tempTolerance:18});
 const weak=editFounderGenome(g,{resist:0,shell:0,tempTolerance:3});
 assert.ok(phenotypeTraits(stamina).shellPlates>phenotypeTraits(weak).shellPlates);
 const fertile=editFounderGenome(g,{brood:8,yolkReserve:1,parentFeeding:1,repro:2});
 const barren=editFounderGenome(g,{brood:1,yolkReserve:0,parentFeeding:0,repro:0});
 assert.ok(phenotypeTraits(fertile).eggCrown>phenotypeTraits(barren).eggCrown);
 assert.ok(distinctivePhenotypeNames(fertile).includes('タマゴフサ'));
});
test('fins, horn buds and tentacles can emerge, wings require rare combinations',()=>{
 const w=new Ecosystem(2026112306),g=w.gene();
 const fin=editFounderGenome(g,{aquatic:1,wet:1,waterGardening:1});
 const horn=editFounderGenome(g,{guard:1,retaliation:1,hornLength:1});
 const tentacle=editFounderGenome(g,{antennaLength:1,parentFeeding:1,nestChoice:1,predatorSense:1});
 const wings=editFounderGenome(g,{dispersal:1,antennaLength:1,sociability:1,wet:1});
 const plain=editFounderGenome(g,{dispersal:0,antennaLength:0,sociability:0,wet:0});
 assert.ok(phenotypeTraits(fin).fins>.9);
 assert.ok(phenotypeTraits(horn).horns>.5);
 assert.ok(phenotypeTraits(tentacle).tentacles>.5);
 assert.ok(phenotypeTraits(wings).wings>.5);
 assert.equal(phenotypeTraits(plain).wings,0);
 assert.ok(distinctivePhenotypeNames(wings).includes('ツバサ'));
});
test('all new drawing paths preserve deterministic world RNG',()=>{
 const w=new Ecosystem(2026112307),g=editFounderGenome(w.gene(),{
  aquatic:1,wet:1,waterGardening:1,dispersal:1,antennaLength:1,
  sociability:1,guard:1,retaliation:1,parentFeeding:1,nestChoice:1
 });
 const rng=w.rng,calls={ellipse:0};
 const ctx=new Proxy({ellipse(){calls.ellipse++;}},{
  get(o,k){return Object.hasOwn(o,k)?o[k]:()=>{};},
  set(o,k,v){o[k]=v;return true}
 });
 for(let i=0;i<10;i++){
  drawOrnamentsBehind(ctx,g,28,22,i);
  drawOrnamentsFront(ctx,g,28,22,i);
  drawAbilityDetails(ctx,g,28,22);
 }
 assert.equal(w.rng,rng);
 assert.ok(calls.ellipse>400);
});
