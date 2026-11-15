import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,lifeDrain,vitality} from './simulation.js';

const one=(seed=2026111510)=>{
 const w=new Ecosystem(seed),g={...w.gene(),aquatic:0,diet:0,idealTemp:22,tempTolerance:18,hibernate:0};
 const u=w.spawn(200,160,g);
 w.climateEnabled=false;w.temperatureAt=()=>22;
 w.tiles.fill(0);w.grass.fill(100);w.growth=100;
 u.stage='adult';u.age=120;u.energy=155;u.hydration=100;
 return {w,u};
};
test('old age alone cannot drain HP or reduce vigor',()=>{
 const {w,u}=one();
 u.hp=u.maxHp;u.age=25000;
 assert.equal(lifeDrain(u),0);
 assert.equal(vitality(u).old,0);
 const hp=u.hp;
 for(let i=0;i<40;i++){u.energy=150;u.hydration=100;w.step();}
 assert.equal(u.hp,hp,'healthy aged organisms should not lose life to a clock');
});
test('repair consumes nutrition and does not exceed maximum HP',()=>{
 const {w,u}=one(2026111511);
 u.hp=u.maxHp*.35;
 const before=u.hp,energy=u.energy;
 w.updateVitalHealth(u);
 assert.ok(u.hp>before);
 assert.ok(u.hp<=u.maxHp);
 assert.ok(u.energy<energy);
 assert.equal(u.hpRecovered>0,true);
});
test('starvation and dehydration injure HP, but no instantaneous zero-resource death',()=>{
 const {w,u}=one(2026111512);
 u.energy=0;u.hydration=0;
 const hp=u.hp;
 w.updateVitalHealth(u);
 assert.ok(u.hp<hp);
 assert.ok(u.hp>0);
 assert.ok(u.hpLoss.starvation>0&&u.hpLoss.dehydration>0);
 const after=u.hp;u.energy=180;u.hydration=100;w.tick++;
 w.updateVitalHealth(u);
 assert.ok(u.hp>after);
});
test('infection and injury cannot be healed in the same tick',()=>{
 const {w,u}=one(2026111513);
 u.hp=u.maxHp*.5;u.infection=30;w.updateVitalHealth(u);
 const hp=u.hp;
 assert.equal(u.hp,hp);
 u.infection=0;w.applyHpLoss(u,'combat',1);
 w.updateVitalHealth(u);
 assert.ok(u.hp<hp);
});
test('maximum HP follows body growth and shrinking',()=>{
 const {w,u}=one(2026111514);
 u.age=200;u.energy=240;u.recentFood=80;
 const before=u.maxHp;
 for(let i=0;i<75;i++){u.energy=220;u.recentFood=80;w.step();}
 assert.ok(u.growthScale>1);
 assert.ok(u.maxHp>before);
 const grown=u.maxHp;
 u.energy=0;u.recentFood=0;
 for(let i=0;i<15&&!u.dead;i++)w.step();
 assert.ok(u.maxHp<=grown);
});
