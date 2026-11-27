import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,WORLD,TERRAIN_NAMES,TERRAIN_COLORS,terrainFitness} from './simulation.js';
import {expressDNA,SKILLS,canonicalDNA} from './genome-model.js';
import {GameSession} from './game-mode.js';
import {drawEnhancedTerrain} from './terrain-visuals.js';

const skillGenome=(w,skill)=>{
 const base=canonicalDNA(w.gene());
 return expressDNA({dna:{...base,aquatic:0,biome:0,diet:.10,[skill]:1}});
};
test('wetlands and volcanic terrain are real, persistent 20px ecological tiles',()=>{
 const w=new Ecosystem(2026112801);
 assert.equal(TERRAIN_NAMES.length,6);
 assert.equal(TERRAIN_COLORS.length,6);
 for(const t of [4,5]){
  const ids=[...w.tiles].map((v,i)=>v===t?i:-1).filter(i=>i>=0);
  assert.ok(ids.length>=15,'terrain '+t+' must be naturally present');
  assert.ok(w.terrainLevels[ids[0]]>=1);
  const x=(ids[0]%WORLD.columns+.5)*WORLD.cell;
  const y=(Math.floor(ids[0]/WORLD.columns)+.5)*WORLD.cell;
  assert.equal(w.terrain(x,y),t);
  assert.ok(Number.isFinite(w.temperatureAt(x,y)));
  assert.ok(Number.isFinite(terrainFitness(w.gene(),t).fitness));
 }
 const marsh=[...w.tiles].findIndex(t=>t===4),volcano=[...w.tiles].findIndex(t=>t===5);
 assert.ok(w.soilWater[marsh]>w.soilWater[volcano]);
 assert.ok(w.grass[marsh]>w.grass[volcano]);
});
test('new skills are genuinely inherited binary DNA and not an external perk',()=>{
 const w=new Ecosystem(2026112802);
 for(const key of ['skillCultivate','skillPondBuilder']){
  assert.ok(SKILLS.some(s=>s.key===key),key);
  const g=skillGenome(w,key);
  assert.equal(g.dna[key],1);
  assert.equal(w.recombine(g,g).dna[key],1);
  assert.equal(w.mutate(g).dna[key]===0||w.mutate(g).dna[key]===1,true);
 }
});
test('cultivation transfers previously eaten seeds into depleted soil at personal cost',()=>{
 const w=new Ecosystem(2026112803);
 w.tiles.fill(0);w.soilWater.fill(90);w.grass.fill(0);
 const u=w.spawn(240,220,skillGenome(w,'skillCultivate'));
 u.stage='adult';u.energy=150;u.hydration=90;u.seedBank=6;
 const before={energy:u.energy,hydration:u.hydration,seeds:u.seedBank};
 assert.equal(w.cultivate(u),true);
 assert.ok(w.grass.some(v=>v>0));
 assert.ok(u.energy<before.energy);
 assert.ok(u.hydration<before.hydration);
 assert.ok(u.seedBank<before.seeds);
 assert.equal(w.cultivate(u),false,'cooldown prevents unlimited farming');
 const other=w.spawn(280,220,skillGenome(w,'skillPondBuilder'));
 other.stage='adult';other.energy=150;other.hydration=90;other.seedBank=6;
 assert.equal(w.cultivate(other),false,'non-carriers cannot cultivate');
});
test('pond skill uses a moist unoccupied marsh edge during rain; never conjures water when dry',()=>{
 const w=new Ecosystem(2026112804);
 w.tiles.fill(0);w.soilWater.fill(0);w.water.fill(0);w.waterbed.fill(0);
 const idx=w.cell(240,220),edge=idx+1;
 w.tiles[edge]=4;w.soilWater[edge]=94;
 const u=w.spawn(240,220,skillGenome(w,'skillPondBuilder'));
 u.stage='adult';u.energy=165;u.hydration=100;
 w.weather='sunny';
 assert.equal(w.createWaterhole(u),false);
 assert.equal(w.tiles[edge],4);
 w.weather='rain';
 assert.equal(w.createWaterhole(u),true);
 assert.equal(w.tiles[edge],1);
 assert.equal(w.waterbed[edge],1);
 assert.ok(w.water[edge]>0);
 assert.equal(w.waterweed[edge],0,'pond creation cannot conjure plant food');
 assert.ok(u.energy<165&&u.hydration<100);
 assert.equal(w.createWaterhole(u),false,'cooldown/energy stops spamming');
});
test('terrain sculpting and enhanced renderer accept both newly added biomes',()=>{
 const w=new Ecosystem(2026112805),session=new GameSession(w);
 const found=w.tiles.findIndex(t=>t===0);
 const x=(found%WORLD.columns+.5)*WORLD.cell,y=(Math.floor(found/WORLD.columns)+.5)*WORLD.cell;
 assert.ok(w.reshapeTerrainCell(x,y,4));
 assert.equal(w.terrain(x,y),4);
 assert.ok(w.reshapeTerrainCell(x,y,5));
 assert.equal(w.terrain(x,y),5);
 const g=skillGenome(w,'skillCultivate');
 assert.ok(session.start(220,160,{founderGenome:g}));
 const t=[...w.tiles].findIndex(v=>v===0&&!w.units.some(u=>w.cell(u.x,u.y)===w.cell((t%WORLD.columns+.5)*20,(Math.floor(t/WORLD.columns)+.5)*20)));
 // Rendering is purely graphical: no simulation RNG changes.
 const rng=w.rng,ctx=new Proxy({},{get(obj,key){return obj[key]??(()=>{});},set(obj,key,value){obj[key]=value;return true;}});
 drawEnhancedTerrain(ctx,w,'spring');
 assert.equal(w.rng,rng);
});
