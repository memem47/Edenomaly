import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem,genomeCode} from './simulation.js';
import {FOUNDER_PRESETS,founderPresetGenome,randomFounderGenome} from './founder-presets.js';
import {FOUNDER_FIELDS,FOUNDER_BUDGET,founderCost} from './founder-designer.js';

test('four distinctive explained strategies are valid in game mode',()=>{
 const w=new Ecosystem(2026112121),base=w.gene();
 assert.equal(FOUNDER_PRESETS.length,4);
 const codes=new Set();
 for(const preset of FOUNDER_PRESETS){
  assert.ok(preset.name.length>=4);
  assert.ok(preset.description.length>=18,preset.id);
  const g=founderPresetGenome(base,preset.id);
  assert.ok(g&&g.functionalBody,preset.id);
  assert.ok(founderCost(base,g)<=FOUNDER_BUDGET,preset.id);
  assert.equal(g.alleles.wet[0],g.wet);
  codes.add(genomeCode(g));
 }
 assert.equal(codes.size,4);
});
test('random generation stays inside genome budget and changes genes',()=>{
 const w=new Ecosystem(2026112122),base=w.gene();
 const codes=new Set();
 for(let i=0;i<35;i++){
  const g=randomFounderGenome(base);
  assert.ok(founderCost(base,g)<=FOUNDER_BUDGET);
  for(const [key,,lo,hi] of FOUNDER_FIELDS)assert.ok(g[key]>=lo&&g[key]<=hi,key);
  codes.add(genomeCode(g));
 }
 assert.ok(codes.size>3,'random produces diverse options');
});
test('preset changes and site selection preserve chosen DNA',()=>{
 const w=new Ecosystem(2026112123),base=w.gene();
 const chosen=founderPresetGenome(base,'water');
 const genome=JSON.parse(JSON.stringify(chosen));
 const site={x:200,y:150};
 // No terrain auto-adaptation must occur after the player chose the genome.
 const result=w.introduce(site.x,site.y,1,genome);
 assert.equal(result.individuals,8);
 assert.equal(genomeCode(w.units[0].g),genomeCode(chosen));
 assert.equal(w.units[0].g.aquatic,1);
});
test('browser enforces editor -> prepared genome -> placement order',async()=>{
 const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const editor=await readFile(new URL('./founder-screens.js',import.meta.url),'utf8');
 const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
 assert.ok(editor.includes('preparedGenome=g;onReady(g)'));
 assert.ok(editor.includes('consumePrepared:()'));
 assert.ok(editor.includes('data-founder-preset'));
 assert.ok(editor.includes('randomFounderGenome(defaultGenome())'));
 assert.ok(app.includes('if(!screens.hasPrepared()){screens.showEditor();update();return;}'));
 assert.ok(app.includes('const genome=screens.consumePrepared()'));
 assert.ok(app.includes('introduceCustom(x,y,genome)'));
 assert.ok(html.includes('id="startGameConfirm" type="button" disabled'));
});
