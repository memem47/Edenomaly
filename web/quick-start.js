import {WORLD,morphology,thermalFitness} from './simulation.js';
// Every new game gets a different seed; explicit seeds still reproduce headless runs.
export function freshGameSeed(random=Math.random){
 const value=Number(random());
 if(!Number.isFinite(value)||value<0||value>=1)throw new RangeError('random source must return [0,1)');
 return 1+Math.floor(value*2147483646);
}
export function defaultGameStartSite(world){
 const {columns:nx,rows:ny,cell}=WORLD;
 const byTerrain=Array.from({length:6},()=>[]);
 // Don't restrict the game to one grassland niche. Select a seeded random
 // biome first, then choose a locally viable location inside that biome.
 for(let cy=3;cy<ny-3;cy++)for(let cx=3;cx<nx-3;cx++){
  const idx=cy*nx+cx,terrain=world.tiles[idx];
  const x=(cx+.5)*cell,y=(cy+.5)*cell;
  let food=0,water=0;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   if(dx*dx+dy*dy>4)continue;
   const i=(cy+dy)*nx+cx+dx;
   if(world.tiles[i]===1)water++;
   food+=terrain===1?world.waterweed[i]:world.grass[i];
  }
  const score=Math.min(650,food)/35+(terrain===1?0:Math.min(water,3)*5)-
   Math.hypot(x-WORLD.width/2,y-WORLD.height/2)/Math.max(90,WORLD.width/8);
  byTerrain[terrain].push({x,y,score,terrain});
 }
 // Different ecological origins produce visibly different founders, while
 // water, desert and rock are less frequent than temperate grassland.
 const roll=world.rand(),requested=roll<.47?0:roll<.69?1:roll<.81?2:roll<.89?3:roll<.96?4:5;
 const sites=byTerrain[requested].length?byTerrain[requested]:byTerrain[0];
 let best=-Infinity;
 for(const s of sites)best=Math.max(best,s.score);
 const viable=sites.filter(s=>s.score>=best-5);
 const chosen=viable[Math.floor(world.rand()*viable.length)];
 return chosen??{x:WORLD.width/2,y:WORLD.height/2,terrain:0};
}
export function randomGameFounder(world,site){
 const terrain=world.terrain(site.x,site.y);
 const candidates=[];
 for(let i=0;i<48;i++){
  const g=world.adaptFounderToTerrain(world.gene(),terrain);
  if(g.diet>.68||g.eyes<2||morphology(g).bodyMass>125||
    !thermalFitness(g,world.temperatureAt(site.x,site.y)).reproduction)continue;
  candidates.push(g);
 }
 // Prefer a diverse viable phenotype, rather than always choosing the
 // first acceptable low-diet, medium-small grassland founder.
 if(candidates.length)return candidates[Math.floor(world.rand()*candidates.length)];
 const fallback=world.gene();
 return world.adaptFounderToTerrain(fallback,terrain);
}
