import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem,terrainFitness} from './simulation.js';
import {GameSession,INTERVENTIONS,TERRAIN_SCULPT_COST} from './game-mode.js';
function xy(i){return {x:(i%40+.5)*20,y:(Math.floor(i/40)+.5)*20};}
function tile(w,type){return w.tiles.findIndex(t=>t===type);}
function unoccupied(w,type){for(let i=0;i<w.tiles.length;i++)if(w.tiles[i]===type&&!w.units.some(u=>w.cell(u.x,u.y)===i))return i;return -1;}
test('landscape purchase changes only one cell with finite edible resource and no RNG',()=>{
 const w=new Ecosystem(83),i=tile(w,3),site=xy(i),before=w.tiles.slice(),rng=w.rng;
 assert.ok(w.reshapeTerrainCell(site.x,site.y,0));
 assert.equal(w.tiles[i],0);
 assert.equal(w.grass[i],28);
 assert.equal(w.water[i],0);
 assert.equal(w.waterweed[i],0);
 assert.equal(w.terrainLevels[i],3);
 assert.equal(w.rng,rng);
 assert.equal([...w.tiles].filter((t,j)=>t!==before[j]).length,1);
 assert.equal(w.reshapeTerrainCell(site.x,site.y,0),false,'no free biomass by repainting');
 assert.equal(w.grass[i],28);
});
test('pond creation must extend existing pond and gives finite water and weeds',()=>{
 const w=new Ecosystem(84);
 const dry=Array.from(w.tiles).findIndex((t,i)=>{
  if(t===1)return false;const x=i%40,y=Math.floor(i/40);
  return [x>0?i-1:-1,x<39?i+1:-1,y>0?i-40:-1,y<22?i+40:-1].some(j=>j>=0&&w.tiles[j]===1);
 });
 assert.ok(dry>=0);
 const {x,y}=xy(dry);
 assert.ok(w.reshapeTerrainCell(x,y,1));
 assert.equal(w.tiles[dry],1);assert.equal(w.water[dry],60);
 assert.equal(w.waterweed[dry],30);
 assert.equal(w.reshapeTerrainCell(x,y,1),false);
 const isolated=Array.from(w.tiles).findIndex((t,i)=>{
  if(t===1)return false;const xx=i%40,yy=Math.floor(i/40);
  return [xx>0?i-1:-1,xx<39?i+1:-1,yy>0?i-40:-1,yy<22?i+40:-1].every(j=>j<0||w.tiles[j]!==1);
 });
 assert.ok(isolated>=0);const p=xy(isolated);
 assert.equal(w.reshapeTerrainCell(p.x,p.y,1),false);
});
test('occupied terrain and egg nursery cannot be overwritten',()=>{
 const w=new Ecosystem(85),i=tile(w,0),p=xy(i),g=w.gene();
 const u=w.spawn(p.x,p.y,g);
 assert.equal(w.reshapeTerrainCell(p.x,p.y,3),false);
 w.units=[];const egg={x:p.x,y:p.y,dead:false};w.eggs.push(egg);
 assert.equal(w.reshapeTerrainCell(p.x,p.y,2),false);
 egg.dead=true;
 assert.ok(w.reshapeTerrainCell(p.x,p.y,2));
});
test('terrain purchases spend exact intervention points once and record impact',()=>{
 const w=new Ecosystem(86),s=new GameSession(w);
 assert.ok(s.start(160,140));
 const i=unoccupied(w,2),p=xy(i),before=w.tiles[i];
 assert.ok(i>=0);
 const pts=s.points;
 assert.ok(s.canIntervene('terrain0',p.x,p.y));
 assert.ok(s.intervene('terrain0',p.x,p.y));
 assert.equal(s.points,pts-TERRAIN_SCULPT_COST[0]);
 assert.equal(s.spent,TERRAIN_SCULPT_COST[0]);
 assert.equal(w.tiles[i],0);
 assert.equal(s.interventionHistory.at(-1).kind,'terrain0');
 assert.equal(s.canIntervene('terrain0',p.x,p.y),false);
 assert.equal(s.intervene('terrain0',p.x,p.y),false);
 assert.equal(s.points,pts-TERRAIN_SCULPT_COST[0]);
 // Reshape changes biome survival affordances, not just its visual color.
 assert.notEqual(terrainFitness(w.units[0].g,before).move,terrainFitness(w.units[0].g,0).move);
});
test('invalid points, coordinates and actions leave the world untouched',()=>{
 const w=new Ecosystem(87),s=new GameSession(w),i=tile(w,3),p=xy(i);
 const old=w.tiles[i],oldPoints=s.points;
 assert.equal(s.intervene('terrain0',p.x,p.y),false);
 assert.equal(w.tiles[i],old);assert.equal(s.points,oldPoints);
 assert.equal(w.reshapeTerrainCell(-1,0,0),false);
 assert.equal(w.reshapeTerrainCell(p.x,p.y,99),false);
 assert.ok(s.start(160,140));
 s.points=0;
 assert.equal(s.canIntervene('terrain0',p.x,p.y),false);
 assert.equal(s.intervene('terrain0',p.x,p.y),false);
 assert.equal(w.tiles[i],old);
});
test('game browser tools support click-and-drag plus user-visible costs',async()=>{
 const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
 assert.ok(app.includes("const kind='terrain'+mode"));
 assert.ok(app.includes("session.intervene(kind,x,y)"));
 assert.ok(app.includes("playMode==='game'&&['0','1','2','3'].includes(mode)"));
 assert.ok(html.includes('id="terrainEditStatus"'));
 for(const price of [3,5,2,4])assert.ok(Object.values(TERRAIN_SCULPT_COST).includes(price));
 for(const kind of ['terrain0','terrain1','terrain2','terrain3'])assert.ok(INTERVENTIONS[kind]);
});
