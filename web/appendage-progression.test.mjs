import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,appendageProgression,visibleSpeciesCategory,speciesNameFromCategory} from './simulation.js';
import {expressDNA} from './genome-model.js';
import {GameSession} from './game-mode.js';

const make=(patch={})=>expressDNA({dna:{
 power:10,agility:10,stamina:10,intellect:10,adaptation:10,fertility:10,
 aquatic:1,biome:1,social:1,diet:.15,skillParentFeeding:1,
 skillSprint:1,skillPredation:0,...patch
}});
test('tail, feet, hands and wings are increasingly rare and hierarchical',()=>{
 const count=[0,0,0,0],w=new Ecosystem(71188);
 for(let i=0;i<1500;i++){
  const p=appendageProgression(w.gene());
  if(p.tail)count[0]++;
  if(p.feet)count[1]++;
  if(p.hands)count[2]++;
  if(p.wing)count[3]++;
  assert.ok(!p.wing||p.hands);
  assert.ok(!p.hands||p.feet);
  assert.ok(!p.feet||p.tail);
 }
 assert.ok(count[0]<1500*.40,'tails are no longer widespread');
 assert.ok(count[0]>=count[1]&&count[1]>=count[2]&&count[2]>=count[3],String(count));
});
test('all appendages can evolve with excellent genetics, angel and demon wings distinguish species',()=>{
 const angel=make(),demon=make({skillPredation:1});
 for(const g of [angel,demon]){
  const p=appendageProgression(g);
  assert.equal(p.stage,g===angel?4:5);
  assert.ok(p.tail&&p.feet&&p.hands&&p.wing);
 }
 assert.equal(appendageProgression(angel).wingType,'angel');
 assert.equal(appendageProgression(demon).wingType,'demon');
 assert.notEqual(visibleSpeciesCategory(angel),visibleSpeciesCategory(demon));
 const a=speciesNameFromCategory(visibleSpeciesCategory(angel));
 const d=speciesNameFromCategory(visibleSpeciesCategory(demon));
 assert.match(a,/^[ァ-ヶ]{6}$/);assert.match(d,/^[ァ-ヶ]{6}$/);
 assert.notEqual(a,d);
});
test('discovering a fully featured species awards an achievement once',()=>{
 const w=new Ecosystem(41414),session=new GameSession(w);
 const g=make();
 assert.ok(session.start(225,165,{founderGenome:g}));
 const initial=session.points;
 session.observe();
 assert.ok(session.milestones.has('appendage:1'));
 assert.ok(session.milestones.has('appendage:2'));
 assert.ok(session.milestones.has('appendage:3'));
 assert.ok(session.milestones.has('appendage:4'));
 assert.equal(session.points,initial+3+7+15+60);
 session.observe();
 assert.equal(session.points,initial+3+7+15+60);
});
