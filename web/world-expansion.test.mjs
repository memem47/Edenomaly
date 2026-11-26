import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,WORLD,morphology} from './simulation.js';
import {GameSession} from './game-mode.js';
import {defaultGameStartSite,randomGameFounder,freshGameSeed} from './quick-start.js';
import {placementAssessment} from './survival-guidance.js';

test('ecological map grows to 60x35 with live habitats beyond the old boundary',()=>{
 assert.deepEqual([WORLD.columns,WORLD.rows,WORLD.width,WORLD.height],[60,35,1200,700]);
 const w=new Ecosystem(8303);
 assert.equal(w.tiles.length,60*35);
 assert.equal(w.cell(1190,690),60*35-1);
 const newArea=[];
 for(let y=23;y<WORLD.rows;y++)for(let x=40;x<WORLD.columns;x++)
  newArea.push(w.tiles[y*WORLD.columns+x]);
 assert.ok(new Set(newArea).size>=3,'expanded southeastern area has several biomes');
 const guide=placementAssessment(w,w.gene(),1110,630);
 assert.ok(Number.isFinite(guide.suitability));
});
test('random start produces different ecological founder types and species across seeds',()=>{
 const habitats=new Set(),types=new Set(),seeds=new Set();
 for(let seed=1;seed<=35;seed++){
  const w=new Ecosystem(seed*7043);
  const site=defaultGameStartSite(w);
  assert.ok(site.x>0&&site.x<WORLD.width&&site.y>0&&site.y<WORLD.height);
  const terrain=w.terrain(site.x,site.y);
  habitats.add(terrain);
  const founder=randomGameFounder(w,site);
  assert.equal(founder.aquatic===1,terrain===1);
  assert.ok(morphology(founder).bodyMass>0);
  types.add(w.category(founder));
  const session=new GameSession(w);
  assert.ok(session.start(site.x,site.y,{founderGenome:founder}));
  assert.equal(w.introducedCount,8);
  assert.equal(w.species.size,1);
  seeds.add(w.species.values().next().value.name);
 }
 assert.ok(habitats.size>=3,'starts should span at least three habitats');
 assert.ok(types.size>=8,'starts should vary beyond trivial color differences');
 assert.ok(seeds.size>=8,'user-visible founder species names should vary');
});
test('map edges are available to game interventions',()=>{
 const w=new Ecosystem(8477),game=new GameSession(w);
 const site=defaultGameStartSite(w),founder=randomGameFounder(w,site);
 assert.ok(game.start(site.x,site.y,{founderGenome:founder}));
 assert.equal(game.canIntervene('seed',1110,610),true);
 assert.equal(game.canIntervene('seed',1250,610),false);
 assert.equal(game.canIntervene('seed',1110,760),false);
});
test('fresh seeds remain distinct when random source varies',()=>{
 const a=freshGameSeed(()=>.123),b=freshGameSeed(()=>.765);
 assert.notEqual(a,b);
});
