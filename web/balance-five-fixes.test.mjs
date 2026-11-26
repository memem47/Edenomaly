import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem,WORLD,genomeCode} from './simulation.js';
import {founderTraitCost,founderCost,FOUNDER_BUDGET} from './founder-designer.js';
import {FOUNDER_PRESETS,founderPresetGenome,randomFounderGenome} from './founder-presets.js';
import {placementAssessment,populationDiagnosis,deathDiagnosis} from './survival-guidance.js';

test('rock has edible persistent lichen available without conversion to grassland',()=>{
 const w=new Ecosystem(72);
 const i=w.tiles.findIndex(t=>t===3);
 assert.ok(i>=0);
 const x=(i%WORLD.columns+.5)*WORLD.cell,y=(Math.floor(i/WORLD.columns)+.5)*WORLD.cell;
 assert.ok(w.grass[i]>0,'rock should start with living lichen');
 const g=w.gene();g.rock=1;g.aquatic=0;
 assert.ok(w.nearestGrass(x,y,28,g),'rock forage must be discoverable');
 const eaten=w.consumeGrass(x,y,2);
 assert.ok(eaten>0);
 assert.equal(w.tiles[i],3,'grazing lichen must not erase rock biome');
});
test('brood cost punishes excessive reproduction, weak brood refunds points (DNA v2)',async()=>{
 const {founderTraitCost}=await import('./founder-designer.js');
 assert.ok(founderTraitCost('fertility',10)>founderTraitCost('fertility',6));
 assert.ok(founderTraitCost('fertility',1)<0);
 assert.ok(founderTraitCost('repro',2)<founderTraitCost('repro',1));
 const w=new Ecosystem(109),base=w.gene();
 for(const p of FOUNDER_PRESETS)assert.ok(founderCost(base,founderPresetGenome(base,p.id))<=FOUNDER_BUDGET,p.id);
});
test('coherent random genomes remain within game-mode budget',()=>{
 const w=new Ecosystem(110),base=w.gene();
 const seen=new Set();
 for(let i=0;i<50;i++){
  const g=randomFounderGenome(base);
  assert.ok(founderCost(base,g)<=FOUNDER_BUDGET);
  seen.add(genomeCode(g));
 }
 assert.ok(seen.size>5);
});
test('site assessment warns strongly against water/land mismatch and initially preyless predators',()=>{
 const w=new Ecosystem(72),base=w.gene();
 const water=founderPresetGenome(base,'water');
 const grass=founderPresetGenome(base,'grass');
 const rock=founderPresetGenome(base,'rock');
 const waterId=w.tiles.findIndex(t=>t===1);
 const grassId=w.tiles.findIndex(t=>t===0);
 const site=i=>[(i%40+.5)*20,(Math.floor(i/40)+.5)*20];
 const [wx,wy]=site(waterId),[gx,gy]=site(grassId);
 assert.equal(placementAssessment(w,water,gx,gy).severe,true);
 assert.equal(placementAssessment(w,grass,wx,wy).severe,true);
 assert.ok(placementAssessment(w,rock,gx,gy).suitability>=0);
 assert.equal(placementAssessment(w,{...grass,diet:1},gx,gy).severe,true);
});
test('ecology diagnosis reports actionable resource and infection issues',()=>{
 const w=new Ecosystem(17),g=w.gene(),u=w.spawn(160,130,g);
 u.energy=12;u.infection=30;u.hydration=20;u.forageFailure=50;
 const d=populationDiagnosis(w);
 assert.equal(d.infected,1);assert.equal(d.noFood,1);
 assert.ok(d.recommendation.includes('防疫'));
 assert.equal(deathDiagnosis(u),'感染');
});
test('new scoring favors surviving established lineages beyond discoveries',()=>{
 const w=new Ecosystem(101);
 const g=w.gene();w.introduce(160,130,1,g);
 const previous=w.runScore;
 const sp=[...w.species.values()][0];
 sp.establishedByGeneration=true;sp.establishedByPopulation=true;
 const improved=w.runScore;
 assert.equal(improved.discoveryScore,previous.discoveryScore);
 assert.equal(improved.establishmentScore-previous.establishmentScore,650);
 assert.equal(improved.stabilityScore-previous.stabilityScore,220);
});
test('browser exposes placed-genome preview and risk/diagnosis messaging',async()=>{
 const ui=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
 const sim=await readFile(new URL('./simulation.js',import.meta.url),'utf8');
 assert.ok(ui.includes('placementAssessment(game,candidate,x,y)'));
 assert.ok(ui.includes('populationDiagnosis(game)'));
 assert.ok(ui.includes('const genome=screens.consumePrepared()'));
 assert.ok(html.includes('id="placementRisk"'));
 assert.ok(html.includes('id="survivalAdvice"'));
 assert.ok(sim.includes('diagnosticCause:'));
});
