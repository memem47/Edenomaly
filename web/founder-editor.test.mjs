import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem,genomeCode} from './simulation.js';
import {FOUNDER_FIELDS,FOUNDER_BUDGET,editFounderGenome,founderCost,canUseFounder} from './founder-designer.js';

test('founder editor exposes heritable abilities and keeps original immutable',()=>{
 const world=new Ecosystem(2026112001),base=world.gene();
 const changes={eyes:4,brood:6,parentFeeding:.95,nestChoice:.8,
  yolkReserve:.65,juvenileCannibalism:.7,idealTemp:22};
 const adjusted=editFounderGenome(base,changes);
 assert.notEqual(adjusted.eyes,undefined);
 assert.deepEqual(adjusted.alleles.eyes,[adjusted.eyes,adjusted.eyes]);
 assert.deepEqual(adjusted.alleles.parentFeeding,[.95,.95]);
 assert.notEqual(adjusted.alleles,base.alleles);
 assert.notEqual(adjusted,base);
 assert.ok(FOUNDER_FIELDS.length>=25);
 assert.ok(genomeCode(adjusted).length>30);
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
 assert.ok(app.includes('if(unseen.length&&screens.announce(unseen)){running=false;acc=0;}'));
 assert.ok(app.includes('batch.steps&&running'));
 assert.ok(app.includes('knownSpecies.add(key)'));
 assert.ok(app.includes('screens.announce(unseen)'));
 assert.ok(ui.includes("discovery.showModal()"));
 assert.ok(ui.includes('確認して再開'));
 assert.ok(ui.includes('停止したまま閉じる'));
 assert.ok(html.includes('openFounderEditor'));
 assert.ok(html.includes('startEditFounder'));
});

test('absolute survival budget rewards disadvantages and ignores neutral strategy changes',()=>{
 const w=new Ecosystem(12),g=w.gene();
 const weak=editFounderGenome(g,{frugality:0,resist:0,wet:0,dry:0,rock:0});
 const strong=editFounderGenome(g,{frugality:1,resist:1,wet:1,dry:1,rock:1});
 assert.ok(founderCost(g,weak)<founderCost(g,strong));
 assert.equal(founderCost(g,strong),founderCost(weak,strong));
 assert.equal(founderCost(g,weak),founderCost(g,{...weak,diet:1,idealTemp:40}));
 const eyes=editFounderGenome(g,{predatorSense:1,caution:1});
 assert.equal(eyes.eyes,6);
 assert.equal(w.mutate(eyes).functionalBody,true);
 assert.equal(w.recombine(eyes,weak).functionalBody,true);
 for(const key of ['r','elongation','eyes','mouths','jaw'])assert.ok(!FOUNDER_FIELDS.some(([k])=>k===key));
});
