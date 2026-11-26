import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem,genomeCode} from './simulation.js';
import {FOUNDER_FIELDS,FOUNDER_BUDGET,editFounderGenome,founderCost,canUseFounder} from './founder-designer.js';

test('founder editor exposes heritable abilities and keeps original immutable (DNA v2)',async()=>{
 const {DNA_KEYS}=await import('./genome-model.js');
 const world=new Ecosystem(2026112001),base=world.gene();
 const adjusted=editFounderGenome(base,{power:9,fertility:8,intellect:7,skillParentFeeding:1,thermal:.60});
 assert.equal(adjusted.genomeModel,2);assert.equal(Object.keys(adjusted.alleles).length,27);
 assert.deepEqual(adjusted.alleles.power,[9,9]);
 assert.deepEqual(adjusted.alleles.skillParentFeeding,[1,1]);
 assert.notEqual(adjusted.alleles,base.alleles);assert.notEqual(adjusted,base);
 assert.deepEqual(Object.keys(adjusted.dna).sort(),[...DNA_KEYS].sort());
 assert.ok(genomeCode(adjusted).length>=19);
});
test('game mode budget is checked, while lab can change all genes',()=>{
 const w=new Ecosystem(2026112002),g=w.gene();
 const same=editFounderGenome(g,{});
 assert.equal(founderCost(g,same),founderCost(same,same));
 assert.equal(canUseFounder(g,same,true),founderCost(g,same)<=FOUNDER_BUDGET);
 const maxChanges=Object.fromEntries(FOUNDER_FIELDS.map(([key,,lo,hi])=>[key,hi]));
 const extreme=editFounderGenome(g,maxChanges);
 assert.ok(founderCost(g,extreme)>FOUNDER_BUDGET);
 assert.equal(canUseFounder(g,extreme,true),false);
 assert.equal(canUseFounder(g,extreme,false),true);
});
test('edited introduction uses exactly the previewed DNA in initial pair',()=>{
 const w=new Ecosystem(2026112003),g=w.gene();
 const edited=editFounderGenome(g,{eyes:5,brood:2,idealTemp:24,diet:.2,guard:.95});
 const actual=w.adaptFounderToTerrain(edited,w.terrain(220,175));
 const result=w.introduce(220,175,1,actual);
 assert.equal(result.types,1);
 assert.equal(result.individuals,8);
 assert.equal(w.units[0].g.eyes,actual.eyes);
 assert.equal(w.units[0].g.guard,actual.guard);
 assert.equal(w.units[0].g.idealTemp,actual.idealTemp);
 assert.equal(w.units[0].g.diet,actual.diet);
 assert.equal(genomeCode(w.units[1].g),genomeCode(actual));
});
test('browser pauses on discovery and has a confirmation/resume dialog',async()=>{
 const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const ui=await readFile(new URL('./founder-screens.js',import.meta.url),'utf8');
 const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
 assert.ok(app.includes('if(unseen.length&&screens.announce(unseen)){running=false;acc=0;updateDormancySpeedStatus();}'));
 assert.ok(app.includes('batch.steps&&running'));
 assert.ok(app.includes('knownSpecies.add(key)'));
 assert.ok(app.includes('screens.announce(unseen)'));
 assert.ok(ui.includes("discovery.showModal()"));
 assert.ok(ui.includes('確認して再開'));
 assert.ok(ui.includes('停止したまま閉じる'));
 assert.ok(html.includes('openFounderEditor'));
 assert.ok(html.includes('startEditFounder'));
});

test('absolute survival budget rewards disadvantages and ignores neutral strategy changes (DNA v2)',async()=>{
 const w=new Ecosystem(12),g=w.gene();
 const weak=editFounderGenome(g,{power:1,stamina:1,adaptation:1,fertility:1});
 const strong=editFounderGenome(g,{power:10,stamina:10,adaptation:10,fertility:10});
 assert.ok(founderCost(g,weak)<founderCost(g,strong));
 assert.equal(founderCost(g,strong),founderCost(weak,strong));
 assert.equal(founderCost(g,weak),founderCost(g,editFounderGenome(weak,{diet:1,thermal:1})));
 const senses=editFounderGenome(g,{intellect:10});
 assert.equal(senses.dna.intellect,10);
 assert.equal(w.mutate(senses).genomeModel,2);
 assert.equal(w.recombine(senses,weak).genomeModel,2);
 for(const key of ['r','eyes','mouths','jaw'])assert.ok(!FOUNDER_FIELDS.some(([k])=>k===key));
});
