import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,GENETIC_LOCUS_LIMITS,phenotypeTraits,phenotypeSignature,distinctivePhenotypeNames,speciesNameFromCategory} from './simulation.js';
import {FOUNDER_FIELDS,editFounderGenome} from './founder-designer.js';
import {drawOrnamentsBehind,drawOrnamentsFront,drawAbilityDetails} from './slime-ornaments.js';

test('each one of 37 genes changes appearance and an identifying name token (DNA v2)',async()=>{
 const w=new Ecosystem(2026112304),base=w.gene();
 assert.equal(FOUNDER_FIELDS.length,27);
 for(const [key,,lo,hi] of FOUNDER_FIELDS){
  const a=editFounderGenome(base,{[key]:lo});
  const b=editFounderGenome(base,{[key]:hi});
  assert.notEqual(a.dna[key],b.dna[key],key);
  assert.notEqual(phenotypeSignature(a),phenotypeSignature(b),key);
  assert.notEqual(speciesNameFromCategory(w.category(a),a),
   speciesNameFromCategory(w.category(b),b),key);
 }
});
test('fertility and stamina drive recognizable egg and armor features (DNA v2)',async()=>{
 const w=new Ecosystem(2026112305),g=w.gene();
 const stamina=editFounderGenome(g,{stamina:10});
 const weak=editFounderGenome(g,{stamina:1});
 assert.ok(phenotypeTraits(stamina).shellPlates>phenotypeTraits(weak).shellPlates);
 const fertile=editFounderGenome(g,{fertility:10,skillParentFeeding:1,repro:2});
 const barren=editFounderGenome(g,{fertility:1,skillParentFeeding:0,repro:0});
 assert.ok(phenotypeTraits(fertile).eggCrown>phenotypeTraits(barren).eggCrown);
 assert.ok(distinctivePhenotypeNames(fertile).includes('タマゴフサ'));
});
test('fins, horn buds and tentacles can emerge, wings require rare combinations (DNA v2)',async()=>{
 const w=new Ecosystem(2026112306),g=w.gene();
 const fin=editFounderGenome(g,{aquatic:1,biome:1,adaptation:10,skillWaterGardening:1});
 const horn=editFounderGenome(g,{power:10,skillRetaliation:1});
 const tentacle=editFounderGenome(g,{intellect:10,agility:10,fertility:10,skillParentFeeding:1,skillNestChoice:1});
 const wings=editFounderGenome(g,{agility:10,intellect:10,adaptation:10,social:1,biome:1});
 const plain=editFounderGenome(g,{agility:1,intellect:1,adaptation:1,social:0,biome:0,aquatic:0});
 assert.ok(phenotypeTraits(fin).fins>.7);
 assert.ok(phenotypeTraits(horn).horns>.5);
 assert.ok(phenotypeTraits(tentacle).tentacles>.4);
 assert.ok(phenotypeTraits(wings).wings>.2);
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
