import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem} from '../web/simulation.js';

test('egg diapause remains protective, does not last near-infinite time, and ends in spring',()=>{
 const w=new Ecosystem(98019);
 w.tiles.fill(0);w.grass.fill(90);w.water.fill(70);
 const g={...w.gene(),idealTemp:23,tempTolerance:8,shell:.85,hibernate:.85};
 const egg={id:98019,x:210,y:150,g,age:0,hatchAt:65,energy:18,dead:false,parent:1,otherParent:2,generation:1,lineage:'test'};
 w.eggs.push(egg);
 w.tick=1800;w.weather='cloudy';w.weatherUntil=1e8;w.updateTemperature();
 for(let i=0;i<100;i++)w.step();
 assert.equal(egg.dormant,true);
 assert.ok(egg.age>2&&egg.age<65,'winter egg should progress slowly, not stand still');
 assert.ok(egg.energy>0);
 // Even a fully incubated egg must not hatch in hostile winter temperatures.
 egg.age=66;
 w.step();
 assert.equal(w.eggs.includes(egg),true);
 w.tick=2400;w.updateTemperature();
 for(let i=0;i<100&&w.eggs.includes(egg);i++)w.step();
 assert.equal(w.eggs.includes(egg),false,'the dormant egg hatches after spring returns');
});
