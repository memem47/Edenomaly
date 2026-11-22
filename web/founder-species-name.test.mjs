import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem} from './simulation.js';
import {editFounderGenome} from './founder-designer.js';

test('founder species name matches the species generated at introduction',()=>{
 const w=new Ecosystem(2026112301),initial=w.gene();
 const g=editFounderGenome(initial,{aquatic:0,diet:.25,rock:.85,guard:.8});
 const beforeRng=w.rng,beforeUnits=w.units.length;
 const name=w.name(w.category(g),g);
 assert.match(name,/^[^・]+・[^・]+(?:・[^・]+)?$/);
 assert.equal(w.rng,beforeRng,'preview must not consume random draws');
 assert.equal(w.units.length,beforeUnits,'preview must not introduce life');
 const site={x:200,y:130};
 const result=w.introduce(site.x,site.y,1,g);
 assert.equal(result.individuals,8);
 assert.equal(w.species.get(w.category(g)).name,name);
});
test('editing meaningful DNA updates the displayed name',()=>{
 const w=new Ecosystem(2026112302),initial=w.gene();
 const wet=editFounderGenome(initial,{aquatic:1,wet:1,dry:0,rock:0});
 const rock=editFounderGenome(initial,{aquatic:0,wet:0,dry:0,rock:1});
 assert.notEqual(w.category(wet),w.category(rock));
 assert.notEqual(w.name(w.category(wet),wet),w.name(w.category(rock),rock));
});
test('editor displays live, escaped species name next to appearance canvas',async()=>{
 const source=await readFile(new URL('./founder-screens.js',import.meta.url),'utf8');
 const css=await readFile(new URL('./style.css',import.meta.url),'utf8');
 assert.ok(source.includes('id="founderSpeciesName"'));
 assert.ok(source.includes("editorBody.querySelector('#founderSpeciesName').textContent=game.name(game.category(g),g)"));
 assert.ok(source.includes('updateEditorSummary();'));
 assert.ok(css.includes('.founder-species-name-line'));
});
