import test from 'node:test';
import assert from 'node:assert/strict';
import {allLivingDormant,dormancySpeedMultiplier} from './dormancy-speed.js';
import {simulationBatch} from './performance-policy.js';
import {Ecosystem} from './simulation.js';

test('all living individuals must be asleep, with at least one survivor',()=>{
 assert.equal(allLivingDormant([]),false);
 assert.equal(allLivingDormant([{dead:true,dormant:true}]),false);
 assert.equal(allLivingDormant([{dead:false,dormant:true}]),true);
 assert.equal(allLivingDormant([{dead:false,dormant:true},{dead:true,dormant:false}]),true);
 assert.equal(allLivingDormant([{dead:false,dormant:true},{dead:false,dormant:false}]),false);
 assert.equal(dormancySpeedMultiplier([{dormant:true,dead:false}]),2);
 assert.equal(dormancySpeedMultiplier([{dormant:false,dead:false}]),1);
});
test('hibernation multiplier doubles tick budget without modifying ecology RNG',()=>{
 const w=new Ecosystem(18198);
 const genome=w.gene();
 const u=w.spawn(240,180,genome);
 const rng=w.rng;
 u.dormant=true;
 const ordinary={stepsPerSecond:14,speedLimit:24,maxSteps:6};
 const fast={...ordinary,speedLimit:48,maxSteps:12};
 const normal=simulationBatch(0,100,ordinary,1);
 const accelerated=simulationBatch(0,100,fast,dormancySpeedMultiplier(w.units));
 // Batches are integer rounded; across sustained time the fast path does
 // exactly twice as many simulated ticks.
 const normalized=Array.from({length:10}).reduce(({carry,total})=>{
  const a=simulationBatch(carry,100,ordinary,1);
  return {carry:a.carry,total:total+a.steps};
 },{carry:0,total:0});
 const doubled=Array.from({length:10}).reduce(({carry,total})=>{
  const a=simulationBatch(carry,100,fast,2);
  return {carry:a.carry,total:total+a.steps};
 },{carry:0,total:0});
 assert.equal(doubled.total,normalized.total*2);
 assert.equal(normal.steps,1);
 assert.equal(accelerated.steps,2);
 assert.equal(w.rng,rng);
});
test('waking or newly hatched awake organism disables fast forward immediately',()=>{
 const w=new Ecosystem(8912),g=w.gene();
 const a=w.spawn(200,150,g),b=w.spawn(208,150,g);
 a.dormant=true;b.dormant=true;
 assert.equal(dormancySpeedMultiplier(w.units),2);
 b.dormant=false;
 assert.equal(dormancySpeedMultiplier(w.units),1);
 b.dormant=true;
 const hatch=w.spawn(220,150,g);
 assert.equal(dormancySpeedMultiplier(w.units),1);
 hatch.dead=true;
 assert.equal(dormancySpeedMultiplier(w.units),2);
});
