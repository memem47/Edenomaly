import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem} from '../web/simulation.js';
import {runHeadless} from '../web/headless-runner.mjs';

test('death diagnostic distinguishes nearby usable grass from distant total grass',()=>{
 const w=new Ecosystem(221);w.introduce(170,130,1);
 const u=w.units[0];u.g.diet=0;u.g.dna.diet=0;u.g.aquatic=0;
 w.tiles.fill(0);w.grass.fill(0);w.grass[w.cell(u.x,u.y)]=60;
 assert.ok(w.nearbyFoodEstimate(u)>20);
 w.grass.fill(0);w.grass[w.cell(780,440)]=100;
 assert.equal(w.nearbyFoodEstimate(u),0);
});
test('headless output includes starvation death diagnostics without graphics',()=>{
 const result=runHeadless({seed:72,steps:80,interval:20});
 assert.equal(result.world.headless,true);
 assert.equal(typeof result.summary.starvationDiagnostics.juvenile,'number');
 assert.equal(typeof result.summary.starvationDiagnostics.meanNearbyFood,'number');
 assert.equal(typeof result.summary.finalFood,'number');
});
