// Run with: node --test web/simulation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,morphology} from './simulation.js';
test('same seed creates same initial ecosystem',()=>{const a=new Ecosystem(42),b=new Ecosystem(42);assert.deepEqual(a.tiles,b.tiles);assert.deepEqual(a.units,b.units);});
test('species counts reconcile',()=>{const s=new Ecosystem();for(let i=0;i<25;i++)s.step();assert.equal([...s.species.values()].reduce((v,x)=>v+x.current,0),s.units.length);assert.ok([...s.species.values()].every(x=>x.total>=x.current));});
test('death creates a decomposable corpse',()=>{const s=new Ecosystem();let u=s.units[0];s.die(u,'test');assert.equal(s.corpses.length,1);assert.equal(s.species.get(u.category).current>=0,true);});
test('terrain painting changes terrain',()=>{const s=new Ecosystem();s.paint(100,100,3,2);assert.equal(s.terrain(100,100),3);});

test('morphological genes are inherited and bounded',()=>{const s=new Ecosystem(42);for(let i=0;i<300;i++)s.step();for(const u of s.units){assert.ok(u.g.elongation>=.65&&u.g.elongation<=3);assert.ok(u.g.eyes>=0&&u.g.eyes<=6);assert.ok(u.g.mouths>=1&&u.g.mouths<=4);assert.ok(u.g.legs>=0&&u.g.legs<=8&&u.g.legs%2===0);}});
test('more eyes increase sight but cost energy',()=>{const g=new Ecosystem().gene();assert.ok(morphology({...g,eyes:6}).eyeRange>morphology({...g,eyes:0}).eyeRange);assert.ok(morphology({...g,eyes:6}).upkeep>morphology({...g,eyes:0}).upkeep);});
test('more legs increase movement while requiring energy',()=>{const g=new Ecosystem().gene();assert.ok(morphology({...g,legs:8}).speed>morphology({...g,legs:0}).speed);assert.ok(morphology({...g,legs:8}).upkeep>morphology({...g,legs:0}).upkeep);});
test('longer body raises mass and energy consumption',()=>{const g=new Ecosystem().gene();assert.ok(morphology({...g,elongation:2.8}).bodyMass>morphology({...g,elongation:.8}).bodyMass);assert.ok(morphology({...g,elongation:2.8}).upkeep>morphology({...g,elongation:.8}).upkeep);});
test('mouth number influences feeding and attack reach',()=>{const g=new Ecosystem().gene();assert.ok(morphology({...g,mouths:4}).foodGain>morphology({...g,mouths:1}).foodGain);assert.ok(morphology({...g,mouths:4}).biteReach>morphology({...g,mouths:1}).biteReach);});

import {eggTraits} from './simulation.js';
test('egg hatches into a juvenile and grows into adult',()=>{const s=new Ecosystem(19);const parent=s.units[0];s.units=[parent];const egg=s.layEgg(parent);assert.ok(egg);assert.equal(s.eggs.length,1);s.growth=100;for(let i=0;i<egg.hatchAt;i++)s.step();assert.equal(s.eggs.some(e=>e.id===egg.id),false);const kid=s.units.find(u=>u.parent===parent.id);assert.ok(kid);assert.equal(kid.stage,'juvenile');kid.energy=100;for(let i=0;i<90;i++){kid.energy=100;s.step();}assert.equal(kid.stage,'adult');});
test('eggs can be eaten and are removed',()=>{const s=new Ecosystem(11),parent=s.units[0],e=s.layEgg(parent);const predator=s.units[1];assert.ok(s.eatEgg(e,predator));assert.equal(e.dead,true);assert.ok(s.logs.some(l=>l.type==='eggeaten'));});
test('shell trades material for longer incubation and chewing',()=>{const g=new Ecosystem(4).gene();assert.ok(eggTraits({...g,shell:1}).incubation>eggTraits({...g,shell:0}).incubation);assert.ok(eggTraits({...g,shell:1}).eggEnergy>eggTraits({...g,shell:0}).eggEnergy);});
test('egg protection genes are inherited and bounded',()=>{const s=new Ecosystem(30);for(let i=0;i<100;i++){const g=s.mutate(s.gene());for(const k of ['guard','shell','nesting'])assert.ok(g[k]>=0&&g[k]<=1);}});
