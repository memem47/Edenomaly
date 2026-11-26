import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,adaptationColor,pigmentClass,speciesColorName} from './simulation.js';
import {expressDNA} from './genome-model.js';

const make=(source={})=>expressDNA({dna:{
 power:5,agility:5,stamina:5,intellect:5,adaptation:5,fertility:5,
 diet:.2,aquatic:0,repro:0,biome:0,thermal:.56,social:.5,albino:0,
 ...source
}});

test('every basic inherited ability changes at least one visible pigment attribute',()=>{
 const baseline=adaptationColor(make());
 for(const key of ['power','agility','stamina','intellect','adaptation','fertility']){
  const next=adaptationColor(make({[key]:9}));
  assert.notDeepEqual(next,baseline,key+' should change inherited pigment');
 }
});
test('a single habitat supports many recognizably different heritable colors',()=>{
 const variants=[
  {power:10,agility:1},{power:1,agility:10},
  {intellect:10,fertility:1},{intellect:1,fertility:10},
  {adaptation:10,stamina:1},{adaptation:1,stamina:10},
  {power:10,intellect:10,agility:1},{agility:10,fertility:10,power:1}
 ].map(dna=>make(dna));
 const names=new Set(variants.map(g=>speciesColorName(g)));
 const hues=new Set(variants.map(g=>Math.round(adaptationColor(g).hue/15)));
 assert.ok(names.size>=4,'same habitat should have at least four color names: '+[...names]);
 assert.ok(hues.size>=5,'same habitat should have at least five distinguishable hue bins');
});
test('species name classification and rendered body hue share a single color source',()=>{
 const w=new Ecosystem(20261127);
 const a=make({power:10,agility:1}),b=make({power:1,agility:10});
 const c1=adaptationColor(a),c2=adaptationColor(b);
 assert.notEqual(c1.hue,c2.hue);
 assert.notEqual(w.category(a),w.category(b));
 assert.equal(w.name(w.category(a),a),w.name(w.category(a),b),
  'classification, not any supplied individual, determines the species name');
 assert.match(w.name(w.category(a),a),/^[ァ-ヶ]{6}$/);
 assert.match(w.name(w.category(b),b),/^[ァ-ヶ]{6}$/);
 assert.notEqual(w.name(w.category(a)),w.name(w.category(b)));
 assert.equal(typeof pigmentClass(a),'string');
});
test('pigment is stable across time and changes only through inherited DNA',()=>{
 const g=make({power:8,stamina:3,skillParentFeeding:1});
 const before=adaptationColor(g);
 assert.deepEqual(adaptationColor(g),before);
 const w=new Ecosystem(20261127);
 const child=w.recombine(g,g);
 assert.deepEqual(adaptationColor(child),before);
 const variant=make({...g.dna,agility:9});
 assert.notDeepEqual(adaptationColor(variant),before);
});
test('albino is still visibly white, regardless of abilities',()=>{
 const g=make({albino:1,power:10,agility:1});
 assert.deepEqual(adaptationColor(g),{hue:0,saturation:4,lightness:91});
 assert.equal(pigmentClass(g),'white');
});
test('legacy genomes without canonical DNA retain existing color behavior',()=>{
 const g={wet:.22,dry:.95,rock:.22,albino:0};
 const color=adaptationColor(g);
 assert.ok(color.hue>=0&&color.hue<360);
 assert.deepEqual(adaptationColor({...g,power:10}),color);
});
