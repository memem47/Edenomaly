import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,WORLD} from './simulation.js';
import {GameSession,INTERVENTIONS} from './game-mode.js';

const start=seed=>{
 const world=new Ecosystem(seed),run=new GameSession(world);
 world.tiles.fill(0);world.grass.fill(12);world.soilWater.fill(65);
 assert.ok(run.start(290,230));
 return {world,run};
};
test('rare population coexistence, ancient survivor and environmental engineering give once-only bonuses',()=>{
 const {world:w,run}=start(34021);
 run.observe(); // First collect any initial visible-form milestone, if present.
 const base=run.points;
 w.cultivationEvents=1;w.pondCreationEvents=1;
 w.units[0].age=1700;
 run.observe();
 assert.ok(run.milestones.has('rare:ancient'));
 assert.ok(run.milestones.has('rare:farmer'));
 assert.ok(run.milestones.has('rare:pond'));
 assert.equal(run.points,base+35+25+60);
 const earned=run.points;
 for(let i=0;i<15;i++)run.observe();
 assert.equal(run.points,earned,'rare milestone cannot be farmed by repeated observation');
});
test('high-cost interventions are inaccessible before earning points and never overspend',()=>{
 const {world:w,run}=start(34022);
 for(const kind of ['reserveForest','sanctuary','lakeMaker']){
  assert.ok(INTERVENTIONS[kind].cost>=40);
  assert.equal(run.canIntervene(kind,290,230),false);
  assert.equal(run.intervene(kind,290,230),false);
 }
 assert.equal(run.points,15);
});
test('expensive forest restoration regenerates many tiles but never converts water or volcano',()=>{
 const {world:w,run}=start(34023);
 run.points=90;
 const center=w.cell(600,340),wat=center+1,rock=center-1;
 w.tiles[wat]=1;w.tiles[rock]=5;
 w.grass.fill(0);
 const before=run.points;
 assert.ok(run.intervene('reserveForest',600,340));
 assert.equal(run.points,before-40);
 assert.equal(w.tiles[wat],1);assert.equal(w.tiles[rock],5);
 assert.ok(w.grass.filter(g=>g>=45).length>=20,'large-area forest effect');
 assert.ok(run.interventionHistory.some(e=>e.kind==='reserveForest'));
});
test('large sanctuary protects eggs and provides finite-duration habitat support',()=>{
 const {world:w,run}=start(34024);
 const first=w.units[0];first.x=500;first.y=350;
 run.points=90;
 assert.equal(run.intervene('sanctuary',500,350),true);
 const z=w.supportZones.find(z=>z.kind==='sanctuary');
 assert.ok(z);assert.equal(z.until,w.tick+500);
 assert.equal(run.points,40);
 run.points=0;
 assert.equal(run.intervene('sanctuary',500,350),false);
});
test('lake maker extends existing connected water without drowning occupied cells',()=>{
 const {world:w,run}=start(34025);
 w.units.forEach(u=>{u.x=250;u.y=250;});
 const x=600,y=380,center=w.cell(x,y),near=center+1;
 w.tiles[center]=1;w.water[center]=90;w.tiles[near]=0;
 w.tiles[center-1]=5;w.tiles[center-WORLD.columns]=5;w.tiles[center+WORLD.columns]=5;
 w.soilWater.fill(80);
 run.points=90;
 assert.ok(run.canIntervene('lakeMaker',x,y));
 assert.ok(run.intervene('lakeMaker',x,y));
 assert.equal(run.points,15);
 assert.equal(w.tiles[center+1],1);
 assert.equal(w.tiles[center-1],5);
 assert.ok(w.waterbed[center+1]===1);
 assert.equal(run.interventionHistory.at(-1).kind,'lakeMaker');
});
test('world reset clears naturally observed rare ecology milestones',()=>{
 const {world:w}=start(34026);
 w.cultivationEvents=4;w.pondCreationEvents=8;
 w.reset();
 assert.equal(w.cultivationEvents,0);
 assert.equal(w.pondCreationEvents,0);
});
