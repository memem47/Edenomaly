import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,WORLD} from '../web/simulation.js';
import {GameSession} from '../web/game-mode.js';
import {defaultGameStartSite,randomGameFounder,freshGameSeed} from '../web/quick-start.js';

test('random quick start chooses viable habitat and starts exactly one founder species',()=>{
 const world=new Ecosystem(1943);
 const position=defaultGameStartSite(world);
 assert.ok([0,1,2,3].includes(world.terrain(position.x,position.y)));
 const game=new GameSession(world);
 assert.ok(game.start(position.x,position.y,{reserve:false,founderGenome:randomGameFounder(world,position)}));
 assert.equal(world.introducedCount,8);
 assert.equal(world.species.size,1);
 assert.equal(game.active,true);
 assert.equal(game.start(position.x,position.y),false);
});
test('quick start location and habitat vary across seeds',()=>{
 const locations=new Set();
 for(let seed=1;seed<=20;seed++){
  const world=new Ecosystem(seed);
  const p=defaultGameStartSite(world);
  assert.ok(p.x>=0&&p.x<WORLD.width&&p.y>=0&&p.y<WORLD.height);
  locations.add(p.x+','+p.y);
 }
 assert.ok(locations.size>1,'random game start should not always pick the same map cell');
});

test('fresh game seed differs across resets and is usable for reproducible worlds',()=>{
 const a=freshGameSeed(()=>.125),b=freshGameSeed(()=>.875);
 assert.notEqual(a,b);
 assert.ok(a>=1&&b<=2147483646);
 const world=new Ecosystem(a);
 const first=world.gene().dna;
 world.initialSeed=b;world.reset();
 const second=world.gene().dna;
 assert.notDeepEqual(first,second);
 const replay=new Ecosystem(a);
 assert.deepEqual(first,replay.gene().dna);
});
