import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem} from './simulation.js';

test('death event records actionable HP loss breakdown for an underfed hatchling',()=>{
 const w=new Ecosystem(202611156);
 const parent=w.spawn(180,140,w.gene());
 const u=w.spawn(190,140,parent.g,parent);
 u.stage='juvenile';u.bornTick=12;
 w.tick=45;
 w.applyHpLoss(u,'juvenile',14.5);
 w.applyHpLoss(u,'combat',3);
 u.energy=0;u.forageFailure=7;
 w.die(u,'飢餓');
 const d=w.deathRecords.at(-1);
 assert.equal(d.id,u.id);assert.equal(d.stage,'juvenile');
 assert.equal(d.stepsAlive,33);
 assert.equal(d.hpLoss_juvenile,14.5);
 assert.equal(d.hpLoss_combat,3);
 assert.equal(d.dominantHpLoss,'juvenile');
 assert.ok(w.logs.some(x=>x.type==='death'&&x.message.includes('主HP損失 juvenile')));
});
test('sibling juveniles are not selected for early cannibalism',()=>{
 const w=new Ecosystem(202611157);
 const g=w.gene();g.diet=1;g.aquatic=0;g.frugality=0;
 const parent=w.spawn(240,210,g);
 const a=w.spawn(242,210,g,parent),b=w.spawn(243,211,g,parent);
 w.units=[a,b];w.introducedCount=1;
 a.energy=12;b.energy=12;a.age=0;b.age=0;
 w.temperatureAt=()=>g.idealTemp;
 w.step();
 assert.equal(w.logs.filter(x=>x.type==='attack'&&x.message.includes('#'+a.id)&&x.message.includes('#'+b.id)).length,0);
});
test('game archive code contains death diagnostic export',async()=>{
 const {readFile}=await import('node:fs/promises');
 const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
 assert.ok(app.includes('edenomaly-death-diagnostics-'));
 assert.ok(app.includes('hpLoss_juvenile'));
 assert.ok(app.includes('game.deathRecords'));
});
