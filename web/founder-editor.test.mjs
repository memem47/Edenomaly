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
 assert.equal(adjusted.eyes,4);
 assert.deepEqual(adjusted.alleles.eyes,[4,4]);
 assert.deepEqual(adjusted.alleles.parentFeeding,[.95,.95]);
 assert.notEqual(adjusted.alleles,base.alleles);
 assert.notEqual(adjusted,base);
 assert.ok(FOUNDER_FIELDS.length>=30);
 assert.ok(genomeCode(adjusted).length>30);
});
test('game mode budget is checked, while lab can change all genes',()=>{
 const w=new Ecosystem(2026112002),g=w.gene();
 const same=editFounderGenome(g,{});
 assert.equal(founderCost(g,same),0);
 assert.ok(canUseFounder(g,same,true));
 const maxChanges=Object.fromEntries(FOUNDER_FIELDS.map(([key,,lo,hi])=>[key,Math.abs(g[key]-lo)<Math.abs(g[key]-hi)?hi:lo]));
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
 assert.ok(app.includes('if(unseen.length){running=false'));
 assert.ok(app.includes('batch.steps&&running'));
 assert.ok(app.includes('knownSpecies.add(key)'));
 assert.ok(app.includes('screens.announce(unseen)'));
 assert.ok(ui.includes("discovery.showModal()"));
 assert.ok(ui.includes('確認して再開'));
 assert.ok(ui.includes('停止したまま閉じる'));
 assert.ok(html.includes('openFounderEditor'));
 assert.ok(html.includes('startEditFounder'));
});
