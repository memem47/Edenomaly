import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,WORLD,microclimateTemperature,terrestrialHydrationDelta,thermalFitness} from './simulation.js';

test('deep forest is cooler in summer and warmer in winter',()=>{
 assert.ok(microclimateTemperature(35,0,5,'summer')<microclimateTemperature(35,0,1,'summer'));
 assert.ok(microclimateTemperature(0,0,5,'winter')>microclimateTemperature(0,0,1,'winter'));
 assert.ok(microclimateTemperature(35,3,5,'summer')<microclimateTemperature(35,3,1,'summer'));
 assert.ok(microclimateTemperature(0,0,5,'winter')>microclimateTemperature(0,3,5,'winter'));
});
test('forest dew gives a small water benefit but cannot replace drinking',()=>{
 const g={dry:0,rock:0};
 const dry=terrestrialHydrationDelta(g,0,'sunny',5,0,100);
 const forest=terrestrialHydrationDelta(g,0,'sunny',5,100,100);
 const bare=terrestrialHydrationDelta(g,0,'sunny',1,100,0);
 assert.ok(forest>dry);assert.ok(forest>bare);assert.ok(forest<0);
});
test('terrain levels affect real ecosystem thermal exposure',()=>{
 const w=new Ecosystem(158);
 w.temperature=35;w.climateEnabled=true;w.tick=w.seasonLength;
 const i=w.tiles.findIndex((v,j)=>v===0&&w.terrainLevels[j]===5);
 assert.ok(i>=0,'seed must contain deep forest');
 const x=(i%WORLD.columns)*WORLD.cell+WORLD.cell/2,y=Math.floor(i/WORLD.columns)*WORLD.cell+WORLD.cell/2;
 assert.equal(w.temperatureAt(x,y),microclimateTemperature(35,0,5,'summer'));
 const g={idealTemp:26,tempTolerance:8};
 assert.ok(thermalFitness(g,w.temperatureAt(x,y)).excess<=thermalFitness(g,35).excess);
});
