import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,WORLD} from './simulation.js';
import {drawEnhancedTerrain} from './terrain-visuals.js';

test('enhanced terrain renders all expanded rows and columns using correct tile stride',()=>{
 const w=new Ecosystem(20027),beforeRng=w.rng;
 w.tiles.fill(0);
 const i=(WORLD.rows-2)*WORLD.columns+(WORLD.columns-2);
 w.tiles[i]=3;
 w.terrainLevels.fill(3);
 let farRight=false,farBottom=false,rockCalls=0;
 const ctx=new Proxy({
  beginPath(){},moveTo(x,y){
   if(x>1000)farRight=true;
   if(y>500)farBottom=true;
  },
  lineTo(){},closePath(){},fill(){rockCalls++;},
  ellipse(){},arc(){},fillRect(){},quadraticCurveTo(){},stroke(){}
 },{
  get(target,key){return target[key]??(()=>{});},
  set(target,key,value){target[key]=value;return true;}
 });
 drawEnhancedTerrain(ctx,w,'spring');
 assert.ok(farRight,'terrain overlay must draw details beyond old 800px right edge');
 assert.ok(farBottom,'terrain overlay must draw details beyond old 460px bottom edge');
 assert.ok(rockCalls>=3,'rock in expanded corner must draw facets');
 assert.equal(w.rng,beforeRng,'pure visual overlay must not advance simulation RNG');
});
