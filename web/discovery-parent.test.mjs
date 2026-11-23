import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem} from './simulation.js';
import {readFile} from 'node:fs/promises';
test('new species retains actual parents without requiring live individuals',()=>{
 const w=new Ecosystem(413),g=w.gene();
 const a=w.spawn(200,150,{...g,eyes:1}),b=w.spawn(205,150,{...g,eyes:2});
 const parents=[w.parentSnapshot(a),w.parentSnapshot(b)];
 const childGenome={...g,eyes:6,albino:1};
 w.units=[]; // parents no longer present at birth
 const child=w.spawn(200,150,childGenome,{id:a.id,otherParent:b.id,generation:0,lineage:a.lineage,parents});
 const species=w.species.get(child.category);
 assert.equal(species.parents.length,2);
 assert.equal(species.parents[0].genome.eyes,1);
 assert.equal(species.parents[1].genome.eyes,2);
 assert.equal(species.parents[0].id,a.id);
 assert.equal(species.genome.eyes,6);
});
test('discovery renders portraits and compares real parental values',async()=>{
 const ui=await readFile(new URL('./founder-screens.js',import.meta.url),'utf8');
 const sim=await readFile(new URL('./simulation.js',import.meta.url),'utf8');
 assert.ok(ui.includes('data-discovery-portrait'));
 assert.ok(ui.includes('comparisonHTML(g,parents)'));
 assert.ok(ui.includes('const value=basicStatLevel(g,stat.key),pv=parents.map(p=>basicStatLevel(p.genome,stat.key))'));
 assert.ok(sim.includes('parents:egg.parents'));
 assert.ok(sim.includes('parents:[this.parentSnapshot(parent),this.parentSnapshot(partner)]'));
});
