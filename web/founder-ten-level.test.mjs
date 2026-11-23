import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem} from './simulation.js';
import {FOUNDER_FIELDS,founderLevel,founderValueAtLevel,founderLevelMeaning,editFounderGenome,founderCost,FOUNDER_BUDGET} from './founder-designer.js';
import {founderPresetGenome,FOUNDER_PRESETS} from './founder-presets.js';
import {abilityListHTML} from './ability-bars.js';

test('every editable gene exposes integer levels 1–10, preserving min/max and monotonicity',()=>{
 for(const [key,,lo,hi] of FOUNDER_FIELDS){
  assert.equal(founderLevel(key,lo),1,key);
  assert.equal(founderLevel(key,hi),10,key);
  assert.equal(founderValueAtLevel(key,1),lo,key);
  assert.equal(founderValueAtLevel(key,10),hi,key);
  let last=-Infinity;
  for(let n=1;n<=10;n++){
   const value=founderValueAtLevel(key,n);
   assert.ok(value>=last&&value>=lo&&value<=hi,key+' '+n);
   last=value;
  }
 }
});
test('ecological simulation retains physical units, costs and immutable parents',()=>{
 const w=new Ecosystem(34),base=w.gene();
 const g=editFounderGenome(base,{
  resist:founderValueAtLevel('resist',8),
  idealTemp:founderValueAtLevel('idealTemp',7),
  brood:founderValueAtLevel('brood',10)
 });
 assert.equal(g.brood,8);
 assert.equal(g.idealTemp,25);
 assert.equal(founderLevel('resist',g.resist),8);
 assert.equal(g.alleles.resist[0],g.resist);
 assert.notEqual(g,base);
 assert.ok(Number.isFinite(founderCost(base,g)));
});
test('two and three state traits report understandable categorical meanings',()=>{
 assert.equal(founderLevelMeaning('aquatic',1),'陸生');
 assert.equal(founderLevelMeaning('aquatic',10),'水生');
 assert.equal(founderLevelMeaning('repro',1),'雌雄異体');
 assert.equal(founderLevelMeaning('repro',6),'雌雄同体');
 assert.equal(founderLevelMeaning('repro',10),'単為生殖');
 assert.match(founderLevelMeaning('idealTemp',8),/℃/);
 assert.match(founderLevelMeaning('brood',10),/個/);
});
test('presets remain valid and DNA meters no longer show raw floats',()=>{
 const base=new Ecosystem(35).gene();
 for(const p of FOUNDER_PRESETS)
  assert.ok(founderCost(base,founderPresetGenome(base,p.id))<=FOUNDER_BUDGET,p.id);
 const html=abilityListHTML(base);
 assert.match(html,/\/10/);
 assert.match(html,/aria-valuemin="1"/);
 assert.match(html,/aria-valuemax="10"/);
 assert.doesNotMatch(html,/最小 0/);
});
test('editor renders ten-stage inputs and snap-safe categorical buttons',async()=>{
 const ui=await readFile(new URL('./founder-screens.js',import.meta.url),'utf8');
 assert.ok(ui.includes('min="1" max="10" step="1"'));
 assert.ok(ui.includes('founderValueAtLevel(key,level)'));
 assert.ok(ui.includes("(key==='aquatic'||key==='albino')?(direction>0?10:1)"));
 assert.ok(ui.includes("key==='repro'?(direction>0?now<6?6:10:now>6?6:1)"));
 assert.ok(ui.includes('basicStatLevel(g,stat.key)'));
});
