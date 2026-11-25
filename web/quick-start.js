// Deterministic location for one-click game starts. No genome edits, resource
// creation or invisible interventions. The ordinary GameSession.start() still
// generates and introduces exactly one founder species (8 individuals).
export function defaultGameStartSite(world){
 const nx=40,ny=23;
 let best=null,bestScore=-Infinity;
 for(let cy=3;cy<ny-3;cy++)for(let cx=3;cx<nx-3;cx++){
  const idx=cy*nx+cx;
  if(world.tiles[idx]!==0)continue; // Standard founder is land-based.
  const x=(cx+.5)*20,y=(cy+.5)*20;
  let grass=0,water=0;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   if(dx*dx+dy*dy>4)continue;
   const i=(cy+dy)*nx+cx+dx;
   if(world.tiles[i]===1)water++;
   else grass+=Math.max(0,world.grass[i]||0);
  }
  // Nearby water and food matter; mild center preference avoids remote
  // corners. Site selection is read-only and consumes no random numbers.
  const score=Math.min(650,grass)/35+Math.min(water,3)*5-
   Math.hypot(x-400,y-230)/90;
  if(score>bestScore){bestScore=score;best={x,y};}
 }
 return best??{x:170,y:130};
}
