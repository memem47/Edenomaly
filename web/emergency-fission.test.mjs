import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem} from './simulation.js';

const survivor=(seed=202611151)=>{
 const w=new Ecosystem(seed);
 const u=w.spawn(230,180,w.gene());
 // Force benign habitat and focus on reproduction predicates.
 w.units=[u];u.stage='adult';u.age=460;u.energy=180;
 u.hp=u.maxHp;u.hydration=95;u.infection=0;u.isolatedSteps=250;
 u.pregnancy=null;u.courtPartner=null;u.lastEmergencySplit=-100000;
 w.temperatureAt=()=>u.g.idealTemp;
 return {w,u};
};
test('last survivor splits and partially rejuvenates at a steep resource cost',()=>{
 const {w,u}=survivor();
 const oldHp=u.hp,oldAge=u.age,oldEnergy=u.energy;
 assert.ok(w.canEmergencySplit(u));
 const child=w.emergencySplit(u);
 assert.ok(child);
 assert.equal(w.units.length,2);
 assert.equal(child.parent,u.id);
 assert.equal(child.lineage,u.lineage);
 assert.equal(child.stage,'juvenile');
 assert.equal(child.generation,u.generation+1);
 assert.equal(u.energy,oldEnergy-105);
 assert.ok(u.age<oldAge);
 assert.ok(u.hp<oldHp,'partial rejuvenation must not heal damage');
 assert.equal(child.lastEmergencySplit,w.tick);
 assert.ok(!w.canEmergencySplit(u));
 assert.ok(w.logs.some(x=>x.type==='split'));
 if(u.g.repro===0)assert.notEqual(child.sex,u.sex);
});
test('no splitting while healthy relatives or eggs survive',()=>{
 const {w,u}=survivor(202611152);
 const companion=w.spawn(240,170,u.g,u);
 assert.equal(w.canEmergencySplit(u),false);
 w.die(companion,'test');w.units=[u];
 w.eggs.push({dead:false,lineage:u.lineage});
 assert.equal(w.canEmergencySplit(u),false);
});
test('fission cannot rescue starving, ill, immature or recently split organisms',()=>{
 const {w,u}=survivor(202611153);
 for(const [field,value] of [['energy',120],['hydration',40],['infection',10],['isolatedSteps',70],['age',80],['lastEmergencySplit',w.tick-5],['stage','juvenile']]){
  const original=u[field];u[field]=value;
  assert.equal(w.canEmergencySplit(u),false,field);
  u[field]=original;
 }
 assert.equal(w.units.length,1);
});
