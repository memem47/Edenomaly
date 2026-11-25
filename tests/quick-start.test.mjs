import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem} from '../web/simulation.js';
import {GameSession} from '../web/game-mode.js';
import {defaultGameStartSite} from '../web/quick-start.js';

test('random quick start chooses viable land and starts exactly one founder species',()=>{
 const world=new Ecosystem(1943);
 const position=defaultGameStartSite(world);
 assert.equal(world.terrain(position.x,position.y),0);
 const game=new GameSession(world);
 assert.ok(game.start(position.x,position.y,{reserve:false}));
 assert.equal(world.introducedCount,8);
 assert.equal(world.species.size,1);
 assert.equal(game.active,true);
 assert.equal(game.start(position.x,position.y),false);
});
test('quick start location varies with random seed yet stays on land',()=>{
 const locations=new Set();
 for(let seed=1;seed<=20;seed++){
  const world=new Ecosystem(seed);
  const p=defaultGameStartSite(world);
  assert.equal(world.terrain(p.x,p.y),0);
  locations.add(p.x+','+p.y);
 }
 assert.ok(locations.size>1,'random game start should not always pick the same map cell');
});
