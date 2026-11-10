import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,bodySizeMultiplier,morphology,bodyCollisionAxes} from './simulation.js';
import {runHeadless,headlessCSV,HEADLESS_COLUMNS} from './headless-runner.mjs';
import {parseArgs} from './headless-cli.mjs';

test('founder sizes are strongly right-skewed, with 80% or more compact bodies',()=>{
 const w=new Ecosystem(2026110841),count=5000;
 const sizes=Array.from({length:count},()=>w.gene().r);
 const compact=sizes.filter(r=>r<4.5).length/count;
 const medium=sizes.filter(r=>r>=4.5&&r<8).length/count;
 const extremelyLarge=sizes.filter(r=>r>=11).length/count;
 assert.ok(compact>=.80&&compact<=.94,JSON.stringify({compact,medium,extremelyLarge}));
 assert.ok(medium>.06&&medium<.18);
 assert.ok(extremelyLarge<.01,'historically large bodies must be very rare');
});

test('slimes are 1.7 times larger than prior version without changing genetic size distribution',()=>{
 const w=new Ecosystem(2026110842),g={...w.gene(),r:4,elongation:1};
 assert.equal(bodySizeMultiplier(g),.85);
 assert.equal(morphology(g).width,3.4);
 const giant={...g,r:15};
 assert.equal(bodySizeMultiplier(giant),1.7);
 assert.equal(morphology(giant).width,25.5);
 const small=w.spawn(170,170,g),big=w.spawn(200,170,giant);
 assert.ok(bodyCollisionAxes(big).rx>bodyCollisionAxes(small).rx*5);
});

test('headless run is deterministic for fixed seed and settings and never generates graphics',()=>{
 const a=runHeadless({seed:2026110843,steps:60,interval:15});
 const b=runHeadless({seed:2026110843,steps:60,interval:15});
 assert.equal(a.world.headless,true);
 assert.equal(a.world.effects.length,0);
 assert.equal(a.summary.simulatedSteps,60);
 assert.equal(headlessCSV(a.rows),headlessCSV(b.rows));
 assert.ok(a.summary.stepsPerSecond>0);
 assert.ok(a.rows.some(row=>row.event_birth>0),'events are collected without UI logs');
 assert.ok(a.rows.every(row=>row.smallBodies>=0&&row.medianRadius>=0));
});

test('different headless seeds can be run independently and exported with complete fields',()=>{
 const a=runHeadless({seed:2026110844,steps:30,interval:10,founders:2,version:'TEST'});
 const b=runHeadless({seed:2026110845,steps:30,interval:10,founders:2,version:'TEST'});
 assert.notEqual(a.rows[0].seed,b.rows[0].seed);
 assert.equal(a.rows[0].version,'TEST');
 assert.equal(a.rows[0].run,a.rows[0].seed);
 assert.ok(HEADLESS_COLUMNS.includes('event_cannibal'));
 assert.ok(HEADLESS_COLUMNS.includes('p90Radius'));
 assert.equal(headlessCSV(a.rows).split('\n').length,a.rows.length+2);
});

test('headless CLI flags validate bounds, output path and repeatability settings',()=>{
 const p=parseArgs(['--seed','47','--steps','500','--runs','4','--interval','25',
  '--founders','2','--out','results/ecology','--continue-after-extinction']);
 assert.equal(p.seed,47);
 assert.equal(p.runs,4);
 assert.equal(p.stopAtExtinction,false);
 assert.equal(p.out,'results/ecology');
 assert.throws(()=>parseArgs(['--runs','0']),/positive integer/);
 assert.throws(()=>parseArgs(['--steps','10000001']),/10 million/);
 assert.throws(()=>parseArgs(['--unknown','foo']),/Unknown/);
});

test('high-speed ecology generates readable names for actual discovered species',()=>{
 const names=[];
 for(const seed of [72,73,74,75]){
  const {world}=runHeadless({seed,steps:450,interval:150,founders:3});
  for(const sp of world.species.values())names.push(sp.name);
 }
 assert.ok(names.length>0);
 assert.ok(names.every(name=>name.length>=8),'color+five-character code is sufficient without a suffix');
 assert.ok(names.every(name=>!name.includes('ノーマル')));
 assert.ok(names.every(name=>/^[ァ-ヶー]+$/.test(name)));
 assert.ok(names.some(name=>/^(レッド|イエロー|グリーン|ブルー|パープル|ピンク|ホワイト)/.test(name)));
});
