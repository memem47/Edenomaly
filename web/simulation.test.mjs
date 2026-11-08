// Run with: node --test web/simulation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,TERRAIN_COLORS,coverFactor,morphology,organismMorphology,bodyCollisionAxes,localDensity,crowdStress,acquiredSizeMaintenance,feedingCapacity,energyStorageLimit,MAX_NUTRITION_GROWTH,adaptationColor,eggPredationDrive,protectiveDrive,habitatCrowding} from './simulation.js';
import {slimeEyeAngles,slimeEyeColor,slimeEyeLocation,organismVisualState,drawWorld} from './renderer.js';
const populated=seed=>{const s=new Ecosystem(seed);s.introduce(160,135,3);if(s.units.length>1){s.units[0].sex='F';s.units[1].sex='M';}s.temperatureAt=()=>22;for(const u of s.units){u.g.idealTemp=22;u.g.tempTolerance=12;}return s;};
test('same seed creates same initial ecosystem',()=>{const a=populated(42),b=populated(42);assert.deepEqual(a.tiles,b.tiles);assert.deepEqual(a.units,b.units);});
test('species counts reconcile',()=>{const s=populated();for(let i=0;i<25;i++)s.step();assert.equal([...s.species.values()].reduce((v,x)=>v+x.current,0),s.units.length);assert.ok([...s.species.values()].every(x=>x.total>=x.current));});
test('death creates a decomposable corpse',()=>{const s=populated();let u=s.units[0];s.die(u,'test');assert.equal(s.corpses.length,1);assert.equal(s.species.get(u.category).current>=0,true);});
test('terrain painting changes terrain',()=>{const s=populated();s.paint(100,100,3,2);assert.equal(s.terrain(100,100),3);});

test('morphological genes are inherited and bounded',()=>{const s=populated(42);for(let i=0;i<300;i++)s.step();for(const u of s.units){assert.ok(u.g.elongation>=.65&&u.g.elongation<=3);assert.ok(u.g.eyes>=0&&u.g.eyes<=6);assert.ok(u.g.mouths>=1&&u.g.mouths<=4);assert.equal('legs' in u.g,false);assert.equal('pattern' in u.g,false);}});
test('more eyes increase sight but cost energy',()=>{const g=populated().gene();assert.ok(morphology({...g,eyes:6}).eyeRange>morphology({...g,eyes:0}).eyeRange);assert.ok(morphology({...g,eyes:6}).upkeep>morphology({...g,eyes:0}).upkeep);});
test('slime has no vestigial legs or pattern genes',()=>{const g=populated().gene();assert.equal(g.legs,undefined);assert.equal(g.pattern,undefined);});
test('longer body raises mass and energy consumption',()=>{const g=populated().gene();assert.ok(morphology({...g,elongation:2.8}).bodyMass>morphology({...g,elongation:.8}).bodyMass);assert.ok(morphology({...g,elongation:2.8}).upkeep>morphology({...g,elongation:.8}).upkeep);});
test('mouth number influences feeding and attack reach',()=>{const g=populated().gene();assert.ok(morphology({...g,mouths:4}).foodGain>morphology({...g,mouths:1}).foodGain);assert.ok(morphology({...g,mouths:4}).biteReach>morphology({...g,mouths:1}).biteReach);});

import {eggTraits} from './simulation.js';
test('egg hatches into a juvenile and grows into adult',()=>{
 const s=populated(19),parent=s.units[0],partner=s.units[1];s.units=[parent,partner];
 for(const u of s.units){u.age=100;u.energy=160;u.stage='adult';u.mateCooldown=0;}
 const preg=s.layEgg(parent,partner);assert.ok(preg);assert.equal(s.eggs.length,0);const egg=s.layEgg(parent);assert.ok(egg);assert.equal(egg.parent,parent.id);assert.equal(egg.otherParent,partner.id);
 // Isolate egg so it cannot be eaten during incubation.
 s.units=[];s.growth=100;
 for(let i=0;i<egg.hatchAt*2;i++)s.step();
 assert.equal(s.eggs.some(e=>e.id===egg.id),false);
 const kid=s.units.find(u=>u.parent===parent.id);
 assert.ok(kid);assert.equal(kid.otherParent,partner.id);assert.equal(kid.stage,'juvenile');
 for(let i=0;i<90;i++){kid.energy=100;s.step();}
 assert.equal(kid.stage,'adult');
});
test('eggs can be eaten and are removed',()=>{const s=populated(11),parent=s.units[0],predator=s.units[1];parent.age=predator.age=100;parent.energy=predator.energy=160;s.layEgg(parent,predator);const e=s.layEgg(parent);assert.ok(s.eatEgg(e,predator));assert.equal(e.dead,true);assert.ok(s.logs.some(l=>l.type==='eggeaten'));});
test('shell trades material for longer incubation and chewing',()=>{const g=populated(4).gene();assert.ok(eggTraits({...g,shell:1}).incubation>eggTraits({...g,shell:0}).incubation);assert.ok(eggTraits({...g,shell:1}).eggEnergy>eggTraits({...g,shell:0}).eggEnergy);});
test('egg protection genes are inherited and bounded',()=>{const s=populated(30);for(let i=0;i<100;i++){const g=s.mutate(s.gene());for(const k of ['guard','shell','nesting'])assert.ok(g[k]>=0&&g[k]<=1);}});

test('mating requires two distinct adults and consumes energy',()=>{
 const s=populated(21),a=s.units[0],b=s.units[1];
 a.age=b.age=100;a.energy=b.energy=160;
 assert.equal(s.layEgg(a,a),null);
 assert.equal(s.layEgg(a,{...b,stage:'juvenile'}),null);
 const pregnancy=s.layEgg(a,b);assert.ok(pregnancy);assert.equal(s.eggs.length,0);
 const e=s.layEgg(a);assert.ok(e);assert.equal(e.parent,a.id);assert.equal(e.otherParent,b.id);assert.ok(a.energy<160&&b.energy<160);
 assert.ok(a.mateCooldown>0&&b.mateCooldown>0);
 assert.equal(s.layEgg(a,b),null);
});
test('two allele copies are inherited from each parent',()=>{
 const s=new Ecosystem(52),a=s.gene(),b=s.gene();
 a.eyes=4;a.alleles.eyes=[4,1];
 b.eyes=3;b.alleles.eyes=[3,1];
 const original=s.mutate;s.mutate=()=>{throw Error('unexpected mutation');};
 s.rand=()=>.5; // always choose the second genetic copy, mutation roll .5 > .12
 const c=s.recombine(a,b);
 assert.deepEqual(c.alleles.eyes,[1,1]);
 assert.equal(c.eyes,1);
 assert.equal(c.alleles.r.length,2);
 s.mutate=original;
});
test('a recessive trait hidden in both parents reappears in grandchildren',()=>{
 const s=new Ecosystem(53),father=s.gene(),mother=s.gene();
 father.eyes=4;father.alleles.eyes=[4,1];
 mother.eyes=4;mother.alleles.eyes=[4,1];
 s.rand=()=>.5;
 const child=s.recombine(father,mother);
 assert.equal(father.eyes,4);
 assert.equal(mother.eyes,4);
 assert.equal(child.eyes,1);
 assert.deepEqual(child.alleles.eyes,[1,1]);
});
test('mate search excludes self juveniles and direct descendants',()=>{
 const s=populated(33),a=s.units[0],b=s.units[1];
 a.age=b.age=100;a.energy=b.energy=120;
 a.x=b.x=100;a.y=b.y=100;
 assert.equal(s.findMate(a,[a,b]),b);
 b.stage='juvenile';assert.equal(s.findMate(a,[a,b]),null);
 b.stage='adult';b.parent=a.id;assert.equal(s.findMate(a,[a,b]),null);
});

test('isolated adult cannot produce an egg by cloning',()=>{
 const s=populated(66),a=s.units[0];
 s.units=[a];a.age=100;a.energy=200;
 s.food=[];s.growth=0;
 for(let i=0;i<25;i++)s.step();
 assert.equal(s.eggs.length,0);
 assert.equal(s.matings,0);
});

test('courtship links both living parents before conception',()=>{
 const s=populated(88),a=s.units[0],b=s.units[1];
 s.units=[a,b];for(const u of s.units){u.age=100;u.energy=200;u.x=100;u.y=100;}
 assert.equal(s.startCourtship(a,b),true);
 assert.equal(a.courtPartner,b.id);assert.equal(b.courtPartner,a.id);
 assert.equal(s.eggs.length,0);assert.equal(s.matings,0);
 for(let i=0;i<24;i++)s.updateCourtships();
 assert.equal(s.matings,1);assert.ok(a.pregnancy);
 assert.equal(s.eggs.length,0);
 for(let i=0;i<45;i++)a.pregnancy.remaining--;
 const egg=s.layEgg(a);
 assert.ok(egg);assert.equal(egg.parent,a.id);assert.equal(egg.otherParent,b.id);
 assert.equal(s.eggTrails.length,0);
 // A clutch stays clustered behind its parent instead of scattering far away.
 const origin=rearPosition(a,0);
 assert.ok(s.eggs.every(e=>Math.hypot(e.x-origin.x,e.y-origin.y)<25));
});
test('courtship breaks when the couple separates',()=>{
 const s=populated(89),a=s.units[0],b=s.units[1];
 s.units=[a,b];for(const u of s.units){u.age=100;u.energy=200;}
 a.x=100;a.y=100;b.x=105;b.y=105;
 assert.ok(s.startCourtship(a,b));b.x=600;
 s.updateCourtships();
 assert.equal(s.courtships.length,0);assert.equal(s.matings,0);
 assert.equal(a.courtPartner,null);assert.equal(b.courtPartner,null);
});

test('genetic brood size controls clutch count and preserves both parents',()=>{
 const small=populated(91),a=small.units[0],b=small.units[1];
 for(const u of [a,b]){u.age=100;u.energy=160;u.g.brood=1;}
 assert.ok(small.conceive(a,b));small.layEgg(a);
 assert.ok(small.eggs.length>=4);
 const large=populated(91),c=large.units[0],d=large.units[1];
 for(const u of [c,d]){u.age=100;u.energy=160;u.g.brood=8;}
 assert.ok(large.conceive(c,d));large.layEgg(c);
 assert.ok(large.eggs.length>small.eggs.length);
 assert.ok(large.eggs.every(e=>e.parent===c.id&&e.otherParent===d.id));
 assert.equal(new Set(large.eggs.map(e=>e.id)).size,large.eggs.length);
});
test('large clutches cost more parental energy',()=>{
 const run=brood=>{
  const s=populated(93),a=s.units[0],b=s.units[1];
  for(const u of [a,b]){u.age=100;u.energy=160;u.g.brood=brood;}
  s.conceive(a,b);return 160-a.energy;
 };
 assert.ok(run(8)>run(1));
});
test('brood is bounded and redundant pigmentation genes stay absent after mutation',()=>{
 const s=populated(94);
 for(let i=0;i<100;i++){
  const g=s.mutate(s.gene());
  assert.ok(g.brood>=1&&g.brood<=8&&Number.isInteger(g.brood));
  assert.equal(g.pattern,undefined);
  for(const key of ['hue','saturation','lightness']){
   assert.equal(Object.hasOwn(g,key),false);
   assert.equal(Object.hasOwn(g.alleles,key),false);
  }
 }
});

import {dietProfile} from './simulation.js';
test('diet genes define strict nutritional endpoints',()=>{
 const g=populated(140).gene();
 assert.deepEqual([dietProfile({...g,diet:0}).plant,dietProfile({...g,diet:0}).meat],[1,0]);
 assert.deepEqual([dietProfile({...g,diet:1}).plant,dietProfile({...g,diet:1}).meat],[0,1]);
 assert.ok(dietProfile({...g,diet:.5}).plant>0&&dietProfile({...g,diet:.5}).meat>0);
});
test('feeding signal can be inherited independently of actual diet',()=>{
 const s=populated(141),g=s.gene();
 const plantDisguise=dietProfile({...g,diet:1,deception:0});
 const predatorBluff=dietProfile({...g,diet:0,deception:1});
 assert.equal(plantDisguise.meat,1);assert.ok(plantDisguise.signal<.48);
 assert.equal(predatorBluff.meat,0);assert.ok(predatorBluff.signal>.52);
});
test('diet and deception alleles survive crossover and bounded mutation',()=>{
 const s=populated(142),a=s.gene(),b={...a,diet:1,deception:1};
 a.diet=0;a.deception=0;
 const c=s.recombine(a,b);
 assert.ok([0,1].includes(c.diet)||c.diet>=0&&c.diet<=1);
 for(let i=0;i<100;i++){const g=s.mutate(s.gene());assert.ok(g.diet>=0&&g.diet<=1);assert.ok(g.deception>=0&&g.deception<=1);}
});
test('nutrient eater runs away from apparent large predator',()=>{
 const s=populated(143),grazer=s.units[0],hunter=s.units[1];
 s.units=[grazer,hunter];s.food=[];
 grazer.x=100;grazer.y=100;grazer.g.diet=0;grazer.g.deception=.5;
 hunter.x=120;hunter.y=100;hunter.g.diet=1;hunter.g.deception=.8;
 hunter.g.r=Math.max(hunter.g.r,grazer.g.r*1.5);hunter.g.elongation=grazer.g.elongation;grazer.g.eyes=6;
 grazer.threatDecisions.set(hunter.id,{flee:true});
 s.step();
 assert.equal(grazer.fleeing,true);
});
test('herbivore cannot gain energy by eating an egg',()=>{
 const s=populated(144),hunter=s.units[0],parent=s.units[1],partner=s.units[2];
 hunter.g.diet=0;parent.sex='F';partner.sex='M';parent.age=partner.age=100;parent.energy=partner.energy=160;
 s.conceive(parent,partner);const egg=s.layEgg(parent);
 const before=hunter.energy;
 assert.equal(s.eatEgg(egg,hunter),false);
 assert.equal(hunter.energy,before);assert.equal(egg.dead,false);
});

test('strict carnivore leaves nutrient particles uneaten',()=>{
 const s=populated(145),u=s.units[0];
 s.units=[u];u.g.diet=1;u.energy=100;s.food=[{x:u.x,y:u.y,energy:20,source:'natural'}];s.growth=0;
 s.step();assert.equal(s.food.length,1);
});
test('strict nutrient eater does not hunt living prey',()=>{
 const s=populated(146),a=s.units[0],b=s.units[1];
 s.units=[a,b];a.g.diet=0;a.g.jaw=2.5;a.g.eyes=6;a.g.deception=.5;
 b.g.diet=0;b.g.deception=.5;b.g.r=3;
 a.x=b.x=200;a.y=b.y=200;s.food=[];s.growth=0;
 s.step();assert.equal(b.dead,false);
});

import {terrainFitness,TERRAIN_FERTILITY} from './simulation.js';
test('terrain fertility is explicitly ordered, with harsh refuge terrain',()=>{
 assert.ok(TERRAIN_FERTILITY[0]>TERRAIN_FERTILITY[1]);
 assert.ok(TERRAIN_FERTILITY[1]>TERRAIN_FERTILITY[2]);
 assert.ok(TERRAIN_FERTILITY[2]>TERRAIN_FERTILITY[3]);
});
test('inherited dry and rock tolerance reduce habitat costs',()=>{
 const g=populated(204).gene();
 assert.ok(terrainFitness({...g,dry:1},2).fitness>terrainFitness({...g,dry:0},2).fitness);
 assert.ok(terrainFitness({...g,dry:1},2).upkeep<terrainFitness({...g,dry:0},2).upkeep);
 assert.ok(terrainFitness({...g,rock:1},3).fitness>terrainFitness({...g,rock:0},3).fitness);
 assert.ok(terrainFitness({...g,wet:1},1).fitness>terrainFitness({...g,wet:0},1).fitness);
});
test('rock adaptation is inherited and bounded',()=>{
 const s=populated(205),a=s.gene(),b=s.gene();
 a.rock=0;b.rock=1;
 const c=s.recombine(a,b);assert.ok(c.rock>=0&&c.rock<=1);
 for(let i=0;i<100;i++){const g=s.mutate(s.gene());assert.ok(g.rock>=0&&g.rock<=1);}
});
test('completed refuge migration is distinct from terrain crossing',()=>{
 const s=populated(206),u=s.units[0];
 s.units=[u];s.migrations=0;
 u.refugeTarget={x:u.x,y:u.y,until:s.tick+20};
 s.step();
 assert.equal(s.migrations,1);assert.equal(u.migrations,1);
 assert.equal(u.refugeTarget,null);
});
test('painted terrain updates the fitness calculation',()=>{
 const s=populated(207),g=s.gene();
 g.dry=1;g.rock=0;
 s.paint(100,100,2,2);const arid=terrainFitness(g,s.terrain(100,100));
 s.paint(100,100,3,2);const rocky=terrainFitness(g,s.terrain(100,100));
 assert.ok(arid.fitness>rocky.fitness);
});

import {rearPosition,vitality} from './simulation.js';
test('egg cluster is deposited behind the laying parent',()=>{
 const world=populated(301),a=world.units[0],b=world.units[1];
 a.age=b.age=100;a.energy=b.energy=160;
 a.x=300;a.y=200;a.angle=0;
 world.conceive(a,b);
 // Only offspring of the same habitat remain immediately behind the parent;
 // habitat-switch offspring can drift toward a nearby coast.
 for(const g of a.pregnancy.genomes)g.aquatic=a.g.aquatic;
 world.layEgg(a);
 assert.ok(world.eggs.length>=1);
 assert.ok(world.eggs.every(e=>e.x<a.x));
 assert.ok(rearPosition(a).x<a.x);
});
test('bite damages prey without necessarily killing in one hit',()=>{
 const world=populated(302),hunter=world.units[0],prey=world.units[1];
 hunter.g.diet=1;hunter.g.jaw=1.5;hunter.age=100;hunter.hp=hunter.maxHp;
 prey.hp=prey.maxHp=150;
 const before=prey.hp;
 assert.equal(world.attack(hunter,prey),true);
 assert.ok(prey.hp<before);assert.equal(prey.dead,false);
 assert.ok(world.effects.some(x=>x.type==='strike'));
 assert.equal(world.attack(hunter,prey),false);
});
test('repeated bites eventually cause predation and feeding effect',()=>{
 const world=populated(303),hunter=world.units[0],prey=world.units[1];
 hunter.g.diet=1;hunter.g.jaw=2.5;
 prey.hp=prey.maxHp=30;hunter.age=100;
 for(let i=0;i<20&&!prey.dead;i++){hunter.bite=0;world.attack(hunter,prey);}
 assert.ok(prey.dead);
 assert.ok(world.effects.some(x=>x.type==='consume'));
});
test('injury and old age reduce vigor',()=>{
 const world=populated(304),u=world.units[0];
 const young=vitality(u).vigor;
 u.hp=u.maxHp*.4;
 const injured=vitality(u).vigor;
 u.age=1350;
 const old=vitality(u).vigor;
 assert.ok(young>injured&&injured>old);
});

test('corpses retain their complete hereditary anatomy and death orientation',()=>{
 const s=populated(401),u=s.units[0];u.angle=1.23;
 const g={...u.g};s.die(u,'test');
 const c=s.corpses[0];
 assert.deepEqual(c.g,g);assert.equal(c.angle,1.23);
 assert.equal(c.stage,u.stage);assert.equal(c.initialMass,c.mass);
 assert.ok(c.initialMass>0);
});
test('giant mutations can exceed old radius limit but remain bounded',()=>{
 const s=populated(402),g={...s.gene(),r:14.9};
 for(let i=0;i<80;i++){
  const child=s.mutate(g);
  assert.ok(child.r>=3&&child.r<=15);
 }
 const born=Array.from({length:300},()=>s.gene());
 assert.ok(born.some(x=>x.r>9));
});
test('giants are tougher and hit harder but require more upkeep and move slower',()=>{
 const s=populated(403),g=s.gene();
 const small={...g,r:5,elongation:1.25},giant={...g,r:13,elongation:1.25};
 assert.ok(morphology(giant).upkeep>morphology(small).upkeep*3);
 assert.ok(morphology(giant).speed<morphology(small).speed);
 const a=s.spawn(210,160,small),b=s.spawn(280,160,giant);
 assert.ok(b.maxHp>a.maxHp);
 const prey=s.spawn(330,160,{...g,r:4,elongation:1});
 a.g.diet=b.g.diet=1;
 a.bite=b.bite=0;
 prey.hp=prey.maxHp=1000;
 s.attack(a,prey);const first=1000-prey.hp;
 prey.hp=1000;
 s.attack(b,prey);const second=1000-prey.hp;
 assert.ok(second>first);
});

test('new world starts without creatures but has grass and water reserves',()=>{
 const w=new Ecosystem(907);
 assert.equal(w.units.length,0);assert.equal(w.species.size,0);
 assert.ok(w.grass.some(v=>v>0));assert.ok(w.water.some(v=>v>0));
});
test('default introduction has one type and eight mating-capable founders',()=>{
 const s=new Ecosystem(908),result=s.introduce(400,230);
 assert.equal(result.types,1);
 assert.equal(result.individuals,8);
 assert.equal(s.units.length,8);
 assert.equal(new Set(s.units.map(u=>u.category)).size,1);
 assert.ok(s.units.every(u=>u.stage==='adult'&&u.parent===null));
 // Adding a heritable trait must not assume that the first two founders
 // have opposite sex; founder populations still contain compatible adults.
 for(const u of s.units){u.age=100;u.energy=180;}
 const pair=s.units.flatMap(a=>s.units.map(b=>[a,b])).find(([a,b])=>s.canMate(a,b));
 assert.ok(pair);
 assert.equal(s.findMate(pair[0],s.units),s.units.find(v=>v===s.findMate(pair[0],s.units)));
});
test('selected founder type count creates distinct groups and clamps options',()=>{
 for(const n of [2,3,6]){
  const s=new Ecosystem(909+n),r=s.introduce(400,230,n);
  assert.equal(r.types,n);assert.equal(r.individuals,n*8);
  assert.equal(new Set(s.units.map(u=>u.category)).size,n);
 }
 assert.equal(new Ecosystem(915).introduce(400,230,0).types,1);
 assert.equal(new Ecosystem(916).introduce(400,230,99).types,6);
});
test('reset clears previously introduced life',()=>{
 const s=new Ecosystem(920);
 s.introduce(400,230,2);assert.ok(s.units.length>0);
 s.reset();
 assert.equal(s.units.length,0);assert.equal(s.introducedCount,0);
});

test('water is impassable for poorly adapted creatures',()=>{
 const world=new Ecosystem(501);
 world.paint(220,220,1,2);
 const g={...world.gene(),wet:0,aquatic:0};
 assert.equal(terrainFitness(g,1).passable,false);
 assert.equal(terrainFitness({...g,wet:1,aquatic:1},1).passable,true);
});
test('water adapted creatures retain underwater vision',()=>{
 const g=new Ecosystem(502).gene();
 const blind=terrainFitness({...g,wet:0,aquatic:0},1);
 const diver=terrainFitness({...g,wet:1,aquatic:1},1);
 assert.ok(diver.sight>blind.sight*2);
 assert.ok(diver.sight>=1);
});
test('dryland intolerance causes potentially lethal hazard',()=>{
 const g=new Ecosystem(503).gene();
 assert.ok(terrainFitness({...g,dry:0},2).hazard>.5);
 assert.equal(terrainFitness({...g,dry:1},2).hazard,0);
});
test('same founder classification shares lineage across individuals',()=>{
 const s=new Ecosystem(504);
 const result=s.introduce(350,200,1);
 assert.equal(result.types,1);
 assert.equal(new Set(s.units.map(u=>u.lineage)).size,1);
 assert.equal(new Set(s.units.map(u=>u.category)).size,1);
});
test('infection reduces HP and delays reproduction',()=>{
 const s=new Ecosystem(505);s.introduce(350,200,1);
 const u=s.units[0];u.age=100;u.energy=170;u.infection=25;
 assert.equal(s.isReadyToMate(u),false);
 const hp=u.hp;s.units=[u];s.growth=0;s.grass.fill(0);s.step();
 assert.ok(u.hp<hp);
});
test('local nutrient regeneration respects terrain cell capacity',()=>{
 const s=new Ecosystem(506);
 s.tiles.fill(0);s.growth=100;s.food=[];
 for(let i=0;i<350;i++)s.step();
 const counts=new Map();
 for(const food of s.food){if(food.source!=='natural')continue;const cell=s.cell(food.x,food.y);counts.set(cell,(counts.get(cell)||0)+1);}
 assert.ok([...counts.values()].every(c=>c<=4));
});

test('offspring inherit the founding lineage across morphology changes',()=>{
 const s=new Ecosystem(507);s.introduce(350,200,1);
 const [a,b]=s.units;a.sex='F';b.sex='M';for(const u of [a,b]){u.age=100;u.energy=175;}
 const p=s.conceive(a,b);assert.ok(p);const e=s.layEgg(a);
 assert.equal(e.lineage,a.lineage);
 assert.equal(e.lineage,b.lineage);
});

test('infection resistance is inherited and has a survival cost',()=>{
 const w=new Ecosystem(512),base=w.gene();
 assert.ok(morphology({...base,resist:1}).upkeep>morphology({...base,resist:0}).upkeep);
 for(let i=0;i<90;i++){
  const g=w.mutate(w.gene());
  assert.ok(g.resist>=0&&g.resist<=1);
 }
 const low=w.spawn(160,150,{...base,resist:0}),high=w.spawn(450,150,{...base,resist:1});
 low.infection=5;high.infection=5;
 low.energy=high.energy=200;
 w.units=[low,high];w.food=[];w.growth=0;w.tiles.fill(2);w.grass.fill(0);w.water.fill(0);w.waterbed.fill(0);
 const l=low.hp,h=high.hp;
 w.step();assert.ok((l-low.hp)>(h-high.hp));
});

test('aquatic state is inherited, and habitat changes are rare mutations',()=>{
 const s=new Ecosystem(601),a={...s.gene(),aquatic:1},b={...s.gene(),aquatic:1};
 for(let i=0;i<30;i++)assert.ok([0,1].includes(s.recombine(a,b).aquatic));
});
test('terrestrial slime dies without drinking water',()=>{
 const s=new Ecosystem(602);s.tiles.fill(0);s.water.fill(0);s.waterbed.fill(0);
 s.rainfall=0;s.soilWater.fill(0);s.weather='sunny';
 const g={...s.gene(),aquatic:0,diet:0,hibernate:0},u=s.spawn(250,210,g);s.units=[u];
 s.climateEnabled=false;
 u.energy=1e6;for(let i=0;i<750&&!u.dead;i++)s.step();
 assert.equal(u.dead,true);
});
test('aquatic slime dies stranded outside water',()=>{
 const s=new Ecosystem(603);s.tiles.fill(0);
 const g={...s.gene(),aquatic:1},u=s.spawn(250,210,g);s.units=[u];
 u.energy=1e6;for(let i=0;i<500&&!u.dead;i++)s.step();
 assert.equal(u.dead,true,'aquatic acclimation must not eliminate water dependence');
});
test('larger slimes move slower than smaller slimes',()=>{
 const g=new Ecosystem(604).gene();
 assert.ok(morphology({...g,r:11}).speed<morphology({...g,r:4}).speed);
});

test('aquatic founders are introduced into water tiles',()=>{
 const w=new Ecosystem(710);
 let site=null;
 for(let y=20;y<440&&!site;y+=20)for(let x=20;x<780&&!site;x+=20)if(w.terrain(x,y)===1)site={x,y};
 assert.ok(site);
 w.introduce(site.x,site.y,1);
 assert.ok(w.units.every(u=>u.g.aquatic===1&&w.terrain(u.x,u.y)===1));
});
test('terrestrial founders are not placed in water',()=>{
 const w=new Ecosystem(711);
 let site=null;
 for(let y=20;y<440&&!site;y+=20)for(let x=20;x<780&&!site;x+=20)if(w.terrain(x,y)===0)site={x,y};
 assert.ok(site);
 w.introduce(site.x,site.y,1);
 assert.ok(w.units.every(u=>u.g.aquatic===0&&w.terrain(u.x,u.y)!==1));
});

test('species catalog stores a gene snapshot even after extinction',()=>{
 const world=new Ecosystem(801);world.introduce(210,140,1);
 const u=world.units[0],entry=world.species.get(u.category);
 assert.deepEqual(entry.genome,u.g);
 const original={...entry.genome};u.g.wet=0.999;
 assert.deepEqual(entry.genome,original);
 for(const member of [...world.units])world.die(member,'test');
 assert.equal(entry.current,0);
 assert.deepEqual(world.species.get(u.category).genome,original);
});

test('rain replenishes exhausted waterbeds and reduces stress',()=>{
 const w=new Ecosystem(901);const i=w.tiles.findIndex(t=>t===1);
 assert.ok(i>=0);
 w.water[i]=35;w.growth=0;w.stress=80;
 w.rain();
 assert.equal(w.growth,90);assert.equal(w.stress,8);
 assert.equal(w.tiles[i],1);assert.ok(w.water[i]>0);
});
test('player planting directly restores the grass biome',()=>{
 const w=new Ecosystem(902);w.tiles.fill(2);w.grass.fill(0);
 w.paint(220,140,0,1);
 assert.equal(w.terrain(220,140),0);
 assert.equal(w.grass[w.cell(220,140)],100);
 assert.equal(w.food.length,0);
});
test('wind can restore grass on completely barren land without neighbors',()=>{
 const w=new Ecosystem(903);w.tiles.fill(2);w.grass.fill(0);
 w.growth=100;for(let i=0;i<1200;i++)w.step();
 assert.ok(w.seedRainCount>0);
 assert.ok(w.grass.some(x=>x>0));
});
test('painting water preserves land creature safety on its occupied cell',()=>{
 const world=new Ecosystem(904);world.tiles.fill(0);
 const u=world.spawn(200,160,{...world.gene(),aquatic:0});
 const cell=world.cell(u.x,u.y);
 world.paint(200,160,1,2);
 assert.equal(world.tiles[cell],0);
 assert.ok([...world.tiles].some(t=>t===1));
});

test('introduced founder genomes match all four clicked terrains',()=>{
 for(const terrain of [0,1,2,3]){
  const world=new Ecosystem(1100+terrain);
  world.tiles.fill(terrain);
  const result=world.introduce(360,200,1);
  assert.equal(result.individuals,8);
  assert.ok(world.units.every(u=>world.terrain(u.x,u.y)===terrain));
  assert.ok(world.units.every(u=>u.g.aquatic===(terrain===1?1:0)));
  if(terrain===1)assert.ok(world.units.every(u=>u.g.wet>=.8));
  if(terrain===2)assert.ok(world.units.every(u=>u.g.dry>=.84));
  if(terrain===3)assert.ok(world.units.every(u=>u.g.rock>=.84));
 }
});
test('founders stay in the clicked biome near its boundary',()=>{
 const world=new Ecosystem(1105);
 world.tiles.fill(0);
 const cell=world.cell(200,200);
 world.tiles[cell]=1;
 const result=world.introduce(201,201,1);
 assert.equal(result.individuals,8);
 assert.ok(world.units.every(u=>world.terrain(u.x,u.y)===1&&u.g.aquatic===1));
});
test('regular offspring inherit water adaptation rather than changing to terrain',()=>{
 const world=new Ecosystem(1106);
 world.tiles.fill(2);
 const g={...world.gene(),aquatic:1,wet:1,dry:0};
 const parent=world.spawn(210,180,g);
 const child=world.spawn(210,180,{...g},parent);
 assert.equal(child.g.aquatic,1);
 assert.equal(child.g.dry,0);
});

test('larger phenotype variation spans more than threefold speed and sight',()=>{
 const s=new Ecosystem(1555),g=s.gene();
 const quick=morphology({...g,r:3.2,elongation:.75,eyes:6});
 const huge=morphology({...g,r:12,elongation:2.5,eyes:0});
 assert.ok(quick.speed/huge.speed>3);
 assert.ok(quick.eyeRange/huge.eyeRange>4);
});

test('grazing depletes grass and converts it to bare terrain',()=>{
 const w=new Ecosystem(905),i=w.cell(220,140);
 w.tiles[i]=0;w.grass[i]=1.4;
 assert.ok(Math.abs(w.consumeGrass(220,140,1.4)-1.4)<1e-4);
 assert.equal(w.tiles[i],2);assert.equal(w.grass[i],0);
});
test('drinking consumes finite map water',()=>{
 const w=new Ecosystem(906),i=w.cell(220,140);
 w.tiles[i]=1;w.waterbed[i]=1;w.water[i]=36;
 assert.ok(Math.abs(w.consumeWater(220,140,10)-1)<1e-4);
 assert.equal(w.tiles[i],1);assert.equal(w.water[i],35);
});
test('neighboring grass can regrow but total extinction cannot',()=>{
 const w=new Ecosystem(908);w.tiles.fill(2);w.grass.fill(0);
 const i=w.cell(220,140);w.tiles[i]=0;w.grass[i]=50;
 w.growth=100;
 for(let j=0;j<1500;j++)w.step();
 assert.ok(w.grass.some((v,k)=>k!==i&&v>0));
});
test('a decomposing corpse recycles organic matter to soil',()=>{
 const w=new Ecosystem(909);w.tiles.fill(2);w.grass.fill(0);
 const u=w.spawn(220,140,{...w.gene(),aquatic:0});
 w.die(u,'test');w.units=[];
 const i=w.cell(220,140),before=w.soil[i];
 for(let j=0;j<60;j++)w.step();
 assert.ok(w.soil[i]>before);
});

test('offspring remain genetically varied within one large clutch',()=>{
 const w=new Ecosystem(1201);w.introduce(160,140,1);
 const a=w.units[0],b=w.units[1];a.sex='F';b.sex='M';
 a.g.brood=8;b.g.brood=8;a.energy=b.energy=200;
 a.age=b.age=100;
 for(const u of [a,b]){u.g.r=7;u.g.alleles.r=[4,10];u.g.diet=.5;u.g.alleles.diet=[.1,.9];u.g.eyes=6;u.g.alleles.eyes=[2,6];}
 const p=w.conceive(a,b);
 assert.ok(p);assert.ok(p.genomes.length>=10);
 const expressions=new Set(p.genomes.map(g=>[g.eyes,g.r.toFixed(2),g.diet.toFixed(2)].join(':')));
 assert.ok(expressions.size>=4);
});
test('habitat adaptation changes per-step metabolism for different dry traits',()=>{
 const s=new Ecosystem(1202);s.tiles.fill(2);s.grass.fill(0);
 const base=s.gene();
 const a=s.spawn(160,100,{...base,dry:0}),b=s.spawn(540,350,{...base,dry:1});
 a.energy=b.energy=1000;a.age=b.age=100;
 a.hp=b.hp=1000;a.maxHp=b.maxHp=1000;
 s.units=[a,b];s.growth=0;
 // Natural selection favors a creature already adapted to arid terrain.
 for(let i=0;i<12;i++)s.step();
 assert.ok(b.energy>a.energy);
});
test('seasonal precipitation restores depleted waterbeds',()=>{
 const w=new Ecosystem(1203);const i=w.tiles.findIndex(t=>t===1);
 w.water[i]=35;w.growth=0;
 for(let j=0;j<180;j++)w.step();
 assert.equal(w.tiles[i],1);assert.ok(w.water[i]>0);
});
test('corpses enrich soil without creating new ponds',()=>{
 const w=new Ecosystem(1204);w.tiles.fill(2);w.waterbed.fill(0);w.water.fill(0);w.grass.fill(0);
 const u=w.spawn(200,200,{...w.gene(),aquatic:0,r:12});
 w.die(u,'test');w.units=[];
 for(let i=0;i<200;i++)w.step();
 assert.ok(w.soilWater.some(v=>v>0));
 assert.ok([...w.tiles].every(t=>t!==1));
});
test('corpse decomposition cannot create new permanent waterbeds',()=>{
 const w=new Ecosystem(1401);
 w.tiles.fill(2);w.waterbed.fill(0);w.water.fill(0);
 for(let i=0;i<20;i++){
  const u=w.spawn(160+(i%5)*35,150+Math.floor(i/5)*35,{...w.gene(),aquatic:0});
  w.die(u,'test');
 }
 w.units=[];for(let i=0;i<160;i++)w.step();
 assert.ok(w.soilWater.some(v=>v>0));
 assert.ok(w.waterbed.every(v=>v===0));
 assert.ok(w.tiles.every(v=>v!==1));
});
test('natural rainfall setting changes water reserves without increasing waterbed area',()=>{
 const runs=[];
 for(const rainfall of [0,25,100]){
  const w=new Ecosystem(1402);w.rainfall=rainfall;
  const beds=w.waterbed.reduce((a,b)=>a+b,0);
  for(let i=0;i<540;i++)w.step();
  assert.equal(w.waterbed.reduce((a,b)=>a+b,0),beds);
  runs.push(w.water.reduce((a,b)=>a+b,0));
 }
 assert.ok(runs[0]<runs[1]&&runs[1]<runs[2]);
});

test('aquatic plants supply energy without consuming water as food',()=>{
 const w=new Ecosystem(1501);w.tiles.fill(1);w.water.fill(80);w.waterweed.fill(0);
 const x=210,y=150,i=w.cell(x,y);w.waterweed[i]=55;
 const g={...w.gene(),aquatic:1,diet:0};
 const u=w.spawn(x,y,g);u.energy=25;u.age=100;
 w.units=[u];w.growth=0;w.stress=0;
 const water=w.water[i],weed=w.waterweed[i];w.step();
 assert.ok(u.energy>25);assert.ok(w.waterweed[i]<weed);
 assert.ok(w.water[i]>water-.3);
});
test('extinct aquatic vegetation can recover by rare external seeds',()=>{
 const w=new Ecosystem(1502);w.tiles.fill(1);w.water.fill(100);w.waterweed.fill(0);
 w.growth=100;
 for(let i=0;i<120;i++)w.step();
 assert.ok(w.waterweedSeedCount>0);
 assert.ok(w.waterweed.some(v=>v>0));
 const seeded=w.waterweed.findIndex(v=>v>0);
 const before=w.waterweed[seeded];
 for(let j=0;j<24;j++)w.step();
 assert.ok(w.waterweed[seeded]>before);
});

test('fertilizer accelerates grass propagation from surviving neighbors',()=>{
 const run=fertilized=>{
  const w=new Ecosystem(1503);w.tiles.fill(2);w.grass.fill(0);
  const center=w.cell(210,150),near=center+1;
  w.tiles[center]=0;w.grass[center]=70;
  w.soil[near]=fertilized?70:0;w.growth=70;
  w.rand=()=>.2;
  for(let t=0;t<6;t++)w.step();
  return w.grass[near];
 };
 assert.equal(run(false),0);assert.ok(run(true)>0);
});
test('dry and rocky founders can exploit sparse local food without mandatory carnivory',()=>{
 for(const terrain of [2,3]){
  const w=new Ecosystem(1504+terrain);w.tiles.fill(terrain);w.grass.fill(0);
  w.introduce(200,150,1);
  assert.ok(w.units.length>0);
  assert.ok(w.units.every(u=>u.g.aquatic===0&&u.g.diet>=.32&&u.g.diet<=.65&&u.g.jaw>=.9));
 }
});

test('carnivorous slime scavenges on rocky or arid land',()=>{
 const w=new Ecosystem(1507);w.tiles.fill(2);w.grass.fill(0);
 const g={...w.gene(),aquatic:0,diet:1,jaw:1.8};
 const prior=w.spawn(210,150,g);w.die(prior,'test');w.units=[];
 const hunter=w.spawn(210,150,g);hunter.energy=15;hunter.age=100;
 w.units=[hunter];w.growth=0;
 const mass=w.corpses[0].mass;
 w.step();
 assert.ok(hunter.energy>15);
 assert.ok(w.corpses[0].mass<mass);
});

test('predator eyes concentrate toward the forward rim',()=>{
 for(const count of [1,2,3,4]){
  const angles=slimeEyeAngles({eyes:count,diet:.95});
  assert.equal(angles.length,count);
  assert.ok(angles.every(a=>Math.abs(a)<=.57));
 }
});
test('most eyes are slightly forward; rare well-protected herbivores keep full lateral eyes',()=>{
 const front=slimeEyeAngles({eyes:4,diet:.05,guard:.45});
 assert.equal(front.length,4);
 assert.ok(front.some(a=>a<0)&&front.some(a=>a>0));
 assert.ok(front.every(a=>Math.abs(a)<Math.PI/2-.4));
 const lateral=slimeEyeAngles({eyes:2,diet:.05,guard:.99});
 assert.ok(lateral.every(a=>Math.abs(Math.abs(a)-Math.PI/2)<.01));
});
test('many-eyed slimes see around their entire rim and zero eyes stay eyeless',()=>{
 const angles=slimeEyeAngles({eyes:6,diet:.5});
 assert.equal(angles.length,6);
 assert.ok(angles.some(a=>a>Math.PI)&&angles.some(a=>a<Math.PI/2));
 assert.deepEqual(slimeEyeAngles({eyes:0,diet:.5}),[]);
});

test('cosmetic alleles do not split functionally identical slimes into new species',()=>{
 const w=new Ecosystem(1601),g=w.gene();
 const twin={...g,shell:1-g.shell,longevity:1.95,nesting:1-g.nesting};
 assert.equal(w.category(g),w.category(twin));
 const a=w.spawn(180,130,g),b=w.spawn(210,130,twin);
 assert.equal(a.category,b.category);
 assert.equal(w.species.size,1);
});
test('different feeding niches and fundamentally different forms are distinguishable',()=>{
 const w=new Ecosystem(1602),g=w.gene();
 assert.notEqual(w.category({...g,diet:.03}),w.category({...g,diet:.96}));
 assert.notEqual(w.category({...g,eyes:0}),w.category({...g,eyes:6}));
 assert.notEqual(w.category({...g,aquatic:0}),w.category({...g,aquatic:1}));
});
test('manual rain immediately shows rain for many steps, and climate can change',()=>{
 const w=new Ecosystem(1603);
 w.rainfall=70;w.rain();
 assert.equal(w.weather,'rain');
 assert.ok(w.weatherUntil-w.tick>=100);
 for(let i=0;i<40;i++)w.step();
 assert.equal(w.weather,'rain');
 assert.ok(w.weatherStrength>0);
});
test('zero-rain climate does not naturally precipitate',()=>{
 const w=new Ecosystem(1604);w.rainfall=0;
 for(let i=0;i<1000;i++){w.step();assert.ok(w.weather!=='rain');}
});
test('weather changes reproducibly for identical simulation seeds',()=>{
 const a=new Ecosystem(1605),b=new Ecosystem(1605);
 a.rainfall=b.rainfall=95;
 const history=[];
 for(let i=0;i<1250;i++){
  a.step();b.step();
  if(i%50===0)history.push(a.weather);
  assert.equal(a.weather,b.weather);
 }
 assert.ok(new Set(history).size>=2);
});

test('grazing animals carry seeds which germinate when their corpse decomposes',()=>{
 const w=new Ecosystem(1701);w.tiles.fill(2);w.grass.fill(0);
 const x=220,y=140,id=w.cell(x,y),g={...w.gene(),diet:0,aquatic:0};
 w.tiles[id]=0;w.grass[id]=30;
 const u=w.spawn(x,y,g);u.seedBank=12;
 w.die(u,'test');w.units=[];w.tiles[id]=2;w.grass[id]=0;
 w.growth=0;w.rand=()=>0;
 for(let i=0;i<12;i++)w.step();
 assert.equal(w.tiles[id],0);
 assert.ok(w.grass[id]>0);assert.equal(w.corpseSproutCount,1);
});
test('purely carnivorous remains do not carry grass seeds',()=>{
 const w=new Ecosystem(1702);w.tiles.fill(2);w.grass.fill(0);
 const u=w.spawn(220,140,{...w.gene(),diet:1});w.die(u,'test');w.units=[];
 w.growth=0;w.rand=()=>0;
 for(let i=0;i<20;i++)w.step();
 assert.equal(w.corpseSproutCount,0);
 assert.equal(w.tiles[w.cell(220,140)],2);
});
test('five and six-eyed founders are rare under the new gene distribution',()=>{
 const w=new Ecosystem(1703);let many=0;
 for(let i=0;i<5000;i++)if(w.gene().eyes>=5)many++;
 assert.ok(many<150,'multi-eyed frequency exceeded 3%');
 assert.ok(many>10,'rare many-eyed genes must remain possible');
});
test('extra eyes have diminishing sight benefits and higher upkeep and movement cost',()=>{
 const w=new Ecosystem(1704),g=w.gene();
 const two=morphology({...g,eyes:2}),four=morphology({...g,eyes:4}),six=morphology({...g,eyes:6});
 assert.ok(four.eyeRange>two.eyeRange&&six.eyeRange>four.eyeRange);
 assert.ok(six.eyeRange-four.eyeRange<four.eyeRange-two.eyeRange);
 assert.ok(six.upkeep>four.upkeep&&four.upkeep>two.upkeep);
 assert.ok(six.speed<four.speed);
});
test('wind germination is absent when natural plant regeneration is disabled',()=>{
 const w=new Ecosystem(1705);w.tiles.fill(2);w.grass.fill(0);w.growth=0;
 for(let i=0;i<450;i++)w.step();
 assert.equal(w.seedRainCount,0);
 assert.ok(w.grass.every(v=>v===0));
});

test('sustained feeding converts nutritional surplus into visible adult growth',()=>{
 const w=new Ecosystem(1801);w.tiles.fill(0);w.grass.fill(100);
 const g={...w.gene(),aquatic:0,diet:0,r:4};
 const u=w.spawn(200,140,g);u.age=90;u.stage='adult';
 u.energy=175;u.recentFood=12;
 const startHp=u.maxHp;
 for(let i=0;i<70;i++){u.energy=175;u.recentFood=12;w.step();}
 assert.ok(u.growthScale>1.15);
 assert.ok(u.maxHp>startHp);
 assert.equal(u.g.r,4); // Feeding does not mutate the inherited size gene.
});
test('giantism increases reach and metabolism but lowers movement speed',()=>{
 const w=new Ecosystem(1802),u=w.spawn(200,140,w.gene());
 const normal=organismMorphology(u);
 u.growthScale=2.1;
 const giant=organismMorphology(u);
 assert.ok(giant.width>normal.width*2);
 assert.ok(giant.biteReach>normal.biteReach);
 assert.ok(giant.upkeep>normal.upkeep);
 assert.ok(giant.speed<normal.speed);
});
test('starvation cannot generate growth, and acquired growth is bounded',()=>{
 const w=new Ecosystem(1803);w.tiles.fill(2);w.grass.fill(0);
 const u=w.spawn(200,140,{...w.gene(),aquatic:0});
 u.age=90;u.stage='adult';u.energy=40;u.recentFood=0;
 w.step();assert.equal(u.growthScale,1);
 u.energy=300;u.recentFood=100;u.growthScale=MAX_NUTRITION_GROWTH-.0001;
 w.step();
 assert.ok(u.growthScale<=MAX_NUTRITION_GROWTH);
});

test('eye color follows habitat adaptation and eyes stay visibly inside the oval',()=>{
 const w=new Ecosystem(1901),g=w.gene();
 const wet={...g,wet:1,dry:0,rock:0},dry={...g,wet:0,dry:1,rock:0};
 assert.notEqual(slimeEyeColor(wet),slimeEyeColor(dry));
 const pos=slimeEyeLocation(.9,35,20);
 assert.ok((pos.x/35)**2+(pos.y/20)**2<.6);
});
test('grass and waterweed feeding generate separate visual effects',()=>{
 const a=new Ecosystem(1902);a.tiles.fill(0);a.grass.fill(90);
 const grazer=a.spawn(210,150,{...a.gene(),aquatic:0,diet:0});
 grazer.age=100;grazer.energy=20;a.growth=0;
 for(let j=0;j<12;j++)a.step();
 assert.ok(a.effects.some(f=>f.type==='graze'));
 assert.ok(!a.effects.some(f=>f.type==='meal'));
 const b=new Ecosystem(1903);b.tiles.fill(1);b.water.fill(90);b.waterweed.fill(90);
 const swimmer=b.spawn(210,150,{...b.gene(),aquatic:1,diet:0});
 swimmer.age=100;swimmer.energy=20;b.growth=0;
 for(let j=0;j<12;j++)b.step();
 assert.ok(b.effects.some(f=>f.type==='waterweed'));
});
test('drinking gives blue ripple events without a per-step event flood',()=>{
 const w=new Ecosystem(1904);w.tiles.fill(1);w.water.fill(100);w.waterweed.fill(0);
 const u=w.spawn(210,150,{...w.gene(),aquatic:1,diet:0});
 u.age=100;w.growth=0;
 for(let j=0;j<60;j++)w.step();
 const drops=w.effects.filter(f=>f.type==='drink');
 assert.ok(drops.length>=2&&drops.length<=3);
 assert.ok(w.water[w.cell(210,150)]<100);
});
test('direct attack and kill produce different visible effects',()=>{
 const w=new Ecosystem(1905);w.introduce(200,150,1);
 const hunter=w.units[0],prey=w.units[1];
 hunter.g.diet=1;hunter.g.jaw=2.5;hunter.bite=0;prey.hp=500;
 assert.ok(w.attack(hunter,prey));
 assert.ok(w.effects.some(f=>f.type==='strike'));
 assert.ok(!w.effects.some(f=>f.type==='consume'));
 hunter.bite=0;prey.hp=1;
 assert.ok(w.attack(hunter,prey));
 assert.ok(w.effects.some(f=>f.type==='consume'));
});
test('old corpses visibly retain nutrients without becoming dark stains',()=>{
 const w=new Ecosystem(1906);const u=w.spawn(210,150,w.gene());
 w.die(u,'test');w.units=[];
 const corpse=w.corpses[0];corpse.age=200;
 const saved=corpse.mass;
 let ovalCount=0;const colors=[];
 const ctx=new Proxy({canvas:{width:800,height:460},createRadialGradient:()=>({addColorStop(){}}),ellipse:()=>{ovalCount++;}},{
  get(obj,key){return key in obj?obj[key]:()=>{};},
  set(obj,key,v){if(key==='fillStyle')colors.push(v);obj[key]=v;return true;}
 });
 drawWorld(ctx,w,false);
 assert.ok(ovalCount>=1); // The remaining nutrients remain visibly represented.
 assert.ok(colors.includes('#9e9788'));
 assert.ok(colors.includes('#d9cf98')||colors.includes('#7fa07a'));
 assert.equal(corpse.mass,saved);
 assert.equal(w.corpses.length,1);
});

test('color traits derive from wet dry rock adaptation, with no independent genes',()=>{
 const world=new Ecosystem(2001);
 const grass={...world.gene(),wet:0,dry:0,rock:0};
 const water={...grass,wet:1,dry:0,rock:0};
 const desert={...grass,wet:0,dry:1,rock:0};
 const stone={...grass,wet:0,dry:0,rock:1};
 const hsv=[grass,water,desert,stone].map(adaptationColor);
 assert.ok(hsv[0].hue>=90&&hsv[0].hue<=135);
 assert.ok(hsv[1].hue>=170&&hsv[1].hue<=225);
 assert.ok(hsv[2].hue>=20&&hsv[2].hue<=65);
 assert.ok(hsv[3].hue>=245&&hsv[3].hue<=305);
 assert.ok(new Set(hsv.map(x=>Math.round(x.hue))).size===4);
 assert.ok(hsv.every(x=>Number.isFinite(x.hue)&&x.saturation>=58&&x.lightness<=70));
});
test('offspring inherit adapted body color only through their environment genes',()=>{
 const world=new Ecosystem(2002);
 const a=world.gene(),b=world.gene();
 const child=world.recombine(a,b);
 const expected=adaptationColor(child);
 const unrelated={...child,hue:300,saturation:1,lightness:1};
 assert.deepEqual(adaptationColor(unrelated),expected);
 for(const key of ['hue','saturation','lightness']){
  assert.equal(Object.hasOwn(a,key),false);
  assert.equal(Object.hasOwn(child,key),false);
  assert.equal(Object.hasOwn(child.alleles,key),false);
 }
});

test('coincident slimes acquire separate positions without changing genes',()=>{
 const w=new Ecosystem(2101);w.tiles.fill(0);
 const g={...w.gene(),r:7,elongation:1,aquatic:0};
 const a=w.spawn(300,200,g),b=w.spawn(300,200,{...g});
 const before=JSON.stringify(a.g);
 w.resolveUnitOverlap();
 const distance=Math.hypot(a.x-b.x,a.y-b.y);
 assert.ok(distance>bodyCollisionAxes(a).ry+bodyCollisionAxes(b).ry*.30,'overlapping centers remained superimposed');
 assert.equal(JSON.stringify(a.g),before);
 assert.ok([a,b].every(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)));
});
test('giant body has a larger collision footprint and displaces a smaller slime',()=>{
 const w=new Ecosystem(2102);w.tiles.fill(0);
 const a=w.spawn(320,210,{...w.gene(),r:6,elongation:1,aquatic:0});
 const b=w.spawn(325,210,{...w.gene(),r:6,elongation:1,aquatic:0});
 a.growthScale=2.2;b.growthScale=1;
 const originalA=a.x,originalB=b.x;
 const large=bodyCollisionAxes(a),small=bodyCollisionAxes(b);
 assert.ok(large.rx>small.rx*2);
 w.resolveUnitOverlap();
 assert.ok(Math.abs(b.x-originalB)>Math.abs(a.x-originalA));
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>small.ry*2,'larger slimes must displace smaller neighbors');
});
test('elongated slimes need more front-to-front separation than side-by-side',()=>{
 const g={...new Ecosystem(2103).gene(),r:8,elongation:2.6};
 const trial=position=>{
  const w=new Ecosystem(2104);w.tiles.fill(0);
  const a=w.spawn(300,210,g),b=w.spawn(300+position.x,210+position.y,{...g});
  a.angle=b.angle=0;
  w.resolveUnitOverlap();
  return Math.hypot(b.x-a.x,b.y-a.y);
 };
 const frontal=trial({x:6,y:0}),side=trial({x:0,y:6});
 assert.ok(frontal>side*1.5);
});
test('separation respects impassable water tiles for terrestrial slimes',()=>{
 const w=new Ecosystem(2105);w.tiles.fill(0);w.water.fill(0);
 const a=w.spawn(200,210,{...w.gene(),aquatic:0,r:10,elongation:1});
 const b=w.spawn(200,210,{...w.gene(),aquatic:0,r:10,elongation:1});
 for(let y=0;y<460;y+=20)for(let x=220;x<800;x+=20)w.tiles[w.cell(x,y)]=1;
 for(let i=0;i<12;i++)w.resolveUnitOverlap();
 assert.ok([a,b].every(u=>w.terrain(u.x,u.y)!==1));
 assert.ok([a,b].every(u=>u.x>=7&&u.x<=793&&u.y>=7&&u.y<=453));
});

test('aquatic and terrestrial adaptations can evolve in both directions',()=>{
 for(const habitat of [0,1]){
  const w=new Ecosystem(2201+habitat);
  const ancestor=w.gene();
  ancestor.aquatic=habitat;ancestor.alleles.aquatic=[habitat,habitat];
  let conversions=0,dry=0,rock=0;
  for(let i=0;i<5000;i++){
   const child=w.recombine(ancestor,ancestor);
   if(child.aquatic!==habitat)conversions++;
   if(child.dry>ancestor.dry+.15)dry++;
   if(child.rock>ancestor.rock+.15)rock++;
   assert.equal(child.aquatic,child.alleles.aquatic[0]);
  }
  assert.ok(conversions>50&&conversions<450,'Habitat changes should occur but stay uncommon');
  assert.ok(dry>25||rock>25,'Environmental specialists should appear across many offspring');
 }
});
test('locally dispersed habitat-switch eggs land on a viable shore without remote teleporting',()=>{
 const w=new Ecosystem(2203);
 w.tiles.fill(0);w.water.fill(0);
 const cx=w.cell(300,200),row=Math.floor(cx/40);
 for(let y=row-1;y<=row+1;y++)for(let x=16;x<=20;x++){
  const id=y*40+x;w.tiles[id]=1;w.water[id]=100;
 }
 const land=w.shoreEggSite(330,210,{aquatic:0});
 const water=w.shoreEggSite(310,210,{aquatic:1});
 assert.ok(w.terrain(land.x,land.y)!==1);
 assert.equal(w.terrain(water.x,water.y),1);
 const fromWater=w.shoreEggSite(340,210,{aquatic:1});
 assert.equal(w.terrain(fromWater.x,fromWater.y),1);
 assert.ok(Math.hypot(340-fromWater.x,210-fromWater.y)<90);
});
test('albinism is rare, inherited and visually separate from a wound flash',()=>{
 const w=new Ecosystem(2204);
 const ancestor=w.gene();ancestor.albino=0;ancestor.alleles.albino=[0,0];
 const n=5000;let whites=0;
 for(let i=0;i<n;i++){
  const child=w.recombine(ancestor,ancestor);
  whites+=child.albino===1?1:0;
 }
 assert.ok(whites>0&&whites<100,'white mutation should occur but stay below 2%');
 const white={...ancestor,albino:1,alleles:{...ancestor.alleles,albino:[1,1]}};
 assert.equal(w.recombine(white,white).albino,1);
 const color=adaptationColor(white);
 assert.ok(color.saturation<=8&&color.lightness>=88);
 assert.notEqual(slimeEyeColor(white),slimeEyeColor({...white,albino:0}));
});

test('rounded founders dominate while long ovals remain rare',()=>{
 const w=new Ecosystem(2301),count={round:0,oval:0,long:0};
 for(let i=0;i<10000;i++){
  const v=w.gene().elongation;
  if(v<1.38)count.round++;
  else if(v<2.25)count.oval++;
  else count.long++;
 }
 assert.ok(count.round>=7500&&count.round<=9000);
 assert.ok(count.oval>=800&&count.oval<=2300);
 assert.ok(count.long>50&&count.long<400);
});
test('elongation remains heritable and rare long forms can reproduce',()=>{
 const w=new Ecosystem(2302),a=w.gene(),b=w.gene();
 a.elongation=b.elongation=2.65;
 a.alleles.elongation=b.alleles.elongation=[2.65,2.65];
 let long=0;
 for(let i=0;i<150;i++)if(w.recombine(a,b).elongation>2.25)long++;
 assert.ok(long>110);
});
test('elongation mutations make small changes more often than large jumps',()=>{
 const w=new Ecosystem(2303),g=w.gene();
 g.elongation=1.05;g.alleles.elongation=[1.05,1.05];
 let extreme=0;
 for(let i=0;i<2000;i++)if(w.mutate(g).elongation>2.25)extreme++;
 assert.equal(extreme,0);
});

test('physical crowd penalty stays zero for a dispersed colony',()=>{
 const w=new Ecosystem(2401),g={...w.gene(),r:5,elongation:1,aquatic:0};
 const a=w.spawn(120,110,g),b=w.spawn(480,290,g);
 assert.equal(localDensity(a,w.units),0);
 assert.equal(crowdStress(localDensity(a,w.units)),0);
 assert.equal(localDensity(b,w.units),0);
});
test('mixed lineages and mixed diets still exert physical crowd pressure',()=>{
 const w=new Ecosystem(2402),g={...w.gene(),r:6,elongation:1,aquatic:0};
 const anchor=w.spawn(280,190,{...g,diet:0});
 for(let i=0;i<18;i++){
  const other=w.spawn(280+(i%5)*3,190+Math.floor(i/5)*3,{...g,diet:1});
  other.lineage=i+200;
 }
 const pressure=crowdStress(localDensity(anchor,w.units));
 assert.ok(pressure>3);
 assert.ok(pressure>0);
 anchor.stage='adult';anchor.age=100;anchor.energy=300;
 anchor.mateCooldown=0;anchor.infection=0;anchor.crowdStress=pressure;
 // High crowding raises metabolic and reproductive energy costs without a categorical veto.
 assert.equal(w.isReadyToMate(anchor),true);
});
test('larger neighboring slimes exert stronger density load',()=>{
 const w=new Ecosystem(2403),g={...w.gene(),r:5,elongation:1,aquatic:0};
 const a=w.spawn(240,170,g),b=w.spawn(250,170,g);
 const small=localDensity(a,w.units);
 b.growthScale=2.2;
 const large=localDensity(a,w.units);
 assert.ok(large>small);
});
test('high-density groups pay an actual extra energy cost during a simulation tick',()=>{
 const setup=dense=>{
  const w=new Ecosystem(2404);w.tiles.fill(2);w.grass.fill(0);w.water.fill(0);
  const g={...w.gene(),r:5,elongation:1,eyes:1,aquatic:0,diet:0};
  const a=w.spawn(220,170,g);a.age=100;a.energy=300;a.hp=a.maxHp=10000;
  a.hydration=100;a.mateCooldown=300;
  if(dense)for(let i=0;i<18;i++){
   const b=w.spawn(220+(i%5)*3,170+Math.floor(i/5)*3,g);
   b.age=100;b.energy=300;b.hp=b.maxHp=10000;b.mateCooldown=300;
   b.lineage=i+500;
  }
  return {w,a};
 };
 const sparse=setup(false),packed=setup(true);
 sparse.w.step();packed.w.step();
 assert.ok(packed.a.crowdStress>0);
 assert.ok(packed.a.energy<sparse.a.energy-.15);
 assert.ok(packed.a.crowdStress>0);
});

test('acquired giantism incurs strongly rising tissue-volume upkeep',()=>{
 const make=scale=>({growthScale:scale});
 assert.equal(acquiredSizeMaintenance(make(1)),0);
 assert.ok(acquiredSizeMaintenance(make(1.6))>5);
 assert.ok(acquiredSizeMaintenance(make(2.35))>20);
 assert.ok(acquiredSizeMaintenance(make(2.35))>3*acquiredSizeMaintenance(make(1.6)));
});
test('giants can harvest more biomass but have a finite one-step feeding capacity',()=>{
 const small={growthScale:1},giant={growthScale:2.35};
 assert.ok(feedingCapacity(giant)>feedingCapacity(small)*2);
 assert.ok(feedingCapacity(giant)<3);
 const w=new Ecosystem(2501);w.tiles.fill(0);w.grass.fill(100);
 const x=210,y=150;const original=w.grass[w.cell(x,y)];
 const amount=w.consumeGrass(x,y,4);
 assert.ok(amount>0);
 assert.ok(w.grass[w.cell(x,y)]<original);
});
test('a stationary giant without food starves much sooner than an ordinary slime',()=>{
 const simulate=scale=>{
  const w=new Ecosystem(2502);w.tiles.fill(0);w.grass.fill(0);w.growth=0;
  w.water.fill(0);w.waterbed.fill(0);
  const g={...w.gene(),r:5,elongation:1,aquatic:0,diet:0};
  const u=w.spawn(210,150,g);u.growthScale=scale;u.age=100;
  u.maxHp=u.hp=10000;u.energy=energyStorageLimit(u);
  for(let i=0;i<70&&!u.dead;i++)w.step();
  return {alive:!u.dead,energy:u.energy,steps:w.tick};
 };
 const normal=simulate(1),big=simulate(2.35);
 // Starvation is now gradual, not instantaneous at zero energy. The giant
 // still runs out of stored energy far sooner than the ordinary individual.
 assert.equal(normal.alive,true);
 assert.ok(big.energy<=normal.energy);
 assert.ok(big.energy===0);
});
test('an already giant creature cannot indefinitely hoard energy',()=>{
 const w=new Ecosystem(2503);w.tiles.fill(0);w.grass.fill(0);w.growth=0;
 const u=w.spawn(210,150,{...w.gene(),aquatic:0,diet:0});
 u.growthScale=2.2;u.energy=100000;u.age=100;u.hp=u.maxHp=10000;
 w.step();
 assert.ok(u.energy<=energyStorageLimit(u));
});

test('each egg draws a bright shell without an extra dark shadow oval',()=>{
 const w=new Ecosystem(2601);
 w.units=[];w.corpses=[];w.courtships=[];w.eggTrails=[];
 const g=w.gene();
 w.eggs=Array.from({length:18},(_,i)=>({
  id:i,x:240+(i%6)*3,y:180+Math.floor(i/6)*3,
  birthX:240,birthY:180,bornTick:0,g:{...g},age:10,hatchAt:45
 }));
 w.tick=20;
 const setColors=[],ellipses=[];
 const ctx=new Proxy({canvas:{width:800,height:460},
  ellipse(...args){ellipses.push(args);},
  createRadialGradient:()=>({addColorStop(){}})},
  {get(o,k){return k in o?o[k]:()=>{};},
   set(o,k,v){if(k==='fillStyle')setColors.push(v);o[k]=v;return true;}});
 drawWorld(ctx,w,false);
 // Egg body and glint: exactly two ellipses per egg. There is no dark
 // underlay that accumulates into a large stain under overlapping clutches.
 assert.equal(ellipses.length,w.eggs.length*2);
 assert.ok(!setColors.includes('#513e52'));
 assert.ok(!setColors.includes('#4d384d'));
});
test('corpse opacity stays tied to remaining mass, not an arbitrary 65-step timeout',()=>{
 const w=new Ecosystem(2602),u=w.spawn(260,170,w.gene());
 w.die(u,'test');w.units=[];
 const corpse=w.corpses[0];
 const alpha=[];
 const ctx=new Proxy({canvas:{width:800,height:460},
  createRadialGradient:()=>({addColorStop(){}})},
  {get(o,k){return k in o?o[k]:()=>{};},
   set(o,k,v){if(k==='globalAlpha')alpha.push(v);o[k]=v;return true;}});
 corpse.age=200;drawWorld(ctx,w,false);
 assert.ok(alpha.some(n=>n>=.6));
 corpse.mass=corpse.initialMass*.01;alpha.length=0;
 drawWorld(ctx,w,false);
 assert.ok(alpha.some(n=>n>=.39&&n<=.42));
 assert.equal(w.corpses.length,1);
});

test('isolated wet pond can regrow waterweed without a neighboring source',()=>{
 const w=new Ecosystem(2701);w.tiles.fill(2);w.water.fill(0);w.waterweed.fill(0);
 const i=w.cell(220,160);w.tiles[i]=1;w.water[i]=80;
 w.growth=70;w.rand=()=>0;
 for(let n=0;n<12;n++)w.step();
 assert.ok(w.waterweed[i]>0);
 assert.equal(w.waterweedSeedCount,1);
 assert.equal(w.tiles[i],1);
});
test('waterweed seeds cannot germinate in dry or depleted water tiles',()=>{
 const w=new Ecosystem(2702);w.tiles.fill(2);w.waterweed.fill(0);w.water.fill(0);
 const dry=w.cell(220,160),empty=w.cell(240,160),shallow=w.cell(260,160);
 w.tiles[empty]=1;w.tiles[shallow]=1;w.water[shallow]=8;
 w.growth=100;w.rand=()=>0;
 for(let n=0;n<72;n++)w.step();
 assert.equal(w.waterweed[dry],0);
 assert.ok(w.water[empty]>=35);
 assert.ok(w.water[shallow]>=35);
 assert.ok(w.waterweedSeedCount>0);
});
test('waterweed seed arrivals are disabled by zero vegetation growth',()=>{
 const w=new Ecosystem(2703);w.tiles.fill(1);w.water.fill(100);w.waterweed.fill(0);
 w.growth=0;w.rand=()=>0;
 for(let n=0;n<120;n++)w.step();
 assert.equal(w.waterweedSeedCount,0);
 assert.ok(w.waterweed.every(v=>v===0));
});
test('rain and greater water depth improve external aquatic seed germination chance',()=>{
 const sample=(weather,depth)=>{
  const w=new Ecosystem(2704);w.tiles.fill(2);w.water.fill(0);w.waterweed.fill(0);
  const i=w.cell(220,160);w.tiles[i]=1;w.water[i]=depth;
  w.growth=70;w.weather=weather;w.weatherUntil=1e6;w.rand=()=>.007;
  for(let n=0;n<12;n++)w.step();
  return w.waterweed[i];
 };
 assert.ok(sample('rain',100)>0);
 assert.equal(sample('sunny',100),0);
 assert.equal(sample('rain',15),0);
});

test('every slime has the same exceptional growth potential regardless of birth',()=>{
 const w=new Ecosystem(2801),g=w.gene();
 for(let i=0;i<100;i++){
  const u=w.spawn(220,180,{...g});
  assert.ok(u);
  assert.equal(u.growthLimit,undefined);
  w.units.length=0;
 }
 assert.ok(MAX_NUTRITION_GROWTH>=3.5);
});
test('exceptional body can grow past ordinary size when food is continually abundant',()=>{
 const w=new Ecosystem(2802);w.tiles.fill(0);w.grass.fill(100);w.climateEnabled=false;
 const u=w.spawn(220,180,{...w.gene(),aquatic:0,diet:0,r:4,frugality:0,hibernate:0,idealTemp:22,tempTolerance:18});
 u.stage='adult';u.age=100;u.hp=u.maxHp=100000;
 for(let i=0;i<450;i++){
  u.energy=550;u.recentFood=170;
  w.step();
  if(u.dead)break;
 }
 assert.ok(u.growthScale>2.35,'adequately nourished exceptional slime should exceed normal max');
 assert.ok(u.growthScale<=MAX_NUTRITION_GROWTH);
});
test('large dead slimes yield larger visible remains and more nutrients',()=>{
 const w=new Ecosystem(2803),g={...w.gene(),r:5,elongation:1};
 const small=w.spawn(150,160,g),large=w.spawn(400,160,{...g});
 large.growthScale=2.7;
 w.die(small,'test');w.die(large,'test');w.units=[];
 assert.ok(w.corpses[1].mass>w.corpses[0].mass*1.5,'large corpses still yield more nutrients');
 const ellipses=[];
 const ctx=new Proxy({canvas:{width:800,height:460},
  ellipse(...args){ellipses.push({x:ctx._x||0,rx:args[2]});},
  translate(x,y){this._x=x;},
  createRadialGradient:()=>({addColorStop(){}})},
  {get(o,k){return k in o?o[k]:()=>{};},set(o,k,v){o[k]=v;return true;}});
 drawWorld(ctx,w,false);
 assert.ok(ellipses.some(e=>e.x===400&&e.rx>ellipses.find(e=>e.x===150).rx*2));
});

test('ordinary nutrient surplus does not push a slime beyond normal giant size',()=>{
 const w=new Ecosystem(2804);w.tiles.fill(0);w.grass.fill(0);w.growth=0;
 const u=w.spawn(220,180,{...w.gene(),aquatic:0,diet:0,r:4});
 u.stage='adult';u.age=100;u.hp=u.maxHp=100000;u.growthScale=2.35;
 for(let i=0;i<150;i++){
  u.energy=300;u.recentFood=8;
  w.step();
 }
 assert.equal(u.growthScale,2.35);
});
test('large prey yields a more substantial meal and a nutrient-bearing carcass',()=>{
 const experiment=scale=>{
  const w=new Ecosystem(2805);
  const g={...w.gene(),aquatic:0,diet:1,jaw:2};
  const hunter=w.spawn(200,180,g),prey=w.spawn(205,180,{...g});
  prey.growthScale=scale;prey.hp=1;prey.energy=60;
  hunter.energy=40;hunter.bite=0;
  w.attack(hunter,prey);
  return {gain:hunter.energy-40,food:hunter.recentFood,mass:w.corpses[0].mass};
 };
 const small=experiment(1),large=experiment(2.7);
 assert.ok(large.gain>small.gain);
 assert.ok(large.food>small.food);
 assert.ok(large.mass>small.mass);
});

test('visual status flags follow real infection, HP and attack state',()=>{
 const w=new Ecosystem(2901),u=w.spawn(210,150,w.gene());
 assert.deepEqual(organismVisualState(u),{
  infected:false,attacking:false,lifeFade:0,hit:false
 });
 u.infection=40;u.hp=u.maxHp*.25;u.woundFlash=9;u.attackFlash=12;
 const state=organismVisualState(u);
 assert.equal(state.infected,true);assert.equal(state.attacking,true);
 assert.equal(state.hit,true);assert.equal(state.lifeFade,.5);
 u.hp=u.maxHp;u.infection=0;u.woundFlash=0;u.attackFlash=0;
 assert.equal(organismVisualState(u).lifeFade,0);
 assert.equal(organismVisualState(u).infected,false);
 assert.equal(organismVisualState(u).attacking,false);
});
test('an attack illuminates attacker and the flash expires independently of cooldown',()=>{
 const w=new Ecosystem(2902);
 const hunter=w.spawn(210,150,{...w.gene(),diet:1,jaw:2.5});
 const prey=w.spawn(219,150,{...w.gene(),diet:0});
 prey.hp=prey.maxHp=10000;
 hunter.bite=0;
 assert.equal(w.attack(hunter,prey),true);
 assert.ok(hunter.attackFlash>0);
 assert.ok(prey.woundFlash>0);
 assert.ok(w.effects.some(f=>f.type==='strike'&&f.fromX===hunter.x));
 for(let i=0;i<18;i++){w.step();if(hunter.dead)break;}
 assert.equal(hunter.attackFlash,0);
});
test('infection, immediate hit flash, and attack have separate draw colors',()=>{
 const w=new Ecosystem(2903);
 w.units=[];w.eggs=[];w.corpses=[];
 const u=w.spawn(300,210,w.gene());u.infection=44;
 u.hp=u.maxHp*.38;u.attackFlash=14;u.woundFlash=10;
 const styles={stroke:[],fill:[]};
 const ctx=new Proxy({canvas:{width:800,height:460},
  createRadialGradient:()=>({addColorStop(){}})},
  {get(o,k){return k in o?o[k]:()=>{};},
   set(o,k,v){if(k==='strokeStyle')styles.stroke.push(v);
    if(k==='fillStyle')styles.fill.push(v);o[k]=v;return true;}});
 drawWorld(ctx,w,true);
 assert.ok(styles.stroke.includes('rgba(123,43,74,.78)'));
 assert.ok(styles.fill.includes('rgba(104,34,67,.61)'));
 assert.ok(!styles.stroke.includes('rgba(59,212,99,.86)'));
 assert.ok(!styles.fill.includes('rgba(104,248,121,.88)'));
 assert.ok(styles.stroke.includes('rgba(255,148,42,.92)'));
 assert.ok(!styles.fill.includes('rgba(105,34,36,.66)'));
 assert.ok(styles.fill.includes('rgba(255,92,75,.27)'));
});

test('typical eyes face forward while rare side-eye combinations persist',()=>{
 const w=new Ecosystem(3001);
 let forward=0,lateral=0,multi=0;
 for(let i=0;i<6000;i++){
  const g=w.gene();
  if(g.eyes<2||g.eyes>4)continue;
  multi++;
  const angles=slimeEyeAngles(g);
  const far=Math.max(...angles.map(a=>Math.abs(a)));
  if(far<1.05)forward++;
  if(far>1.50)lateral++;
 }
 assert.ok(forward/multi>.9);
 assert.ok(lateral>0&&lateral/multi<.06);
});
test('egg hunter and protective strategies are heritable, not fixed species assignments',()=>{
 const w=new Ecosystem(3002);
 const g=w.gene();
 const hunter={...g,diet:1,guard:0,jaw:1};
 const guardian={...g,diet:0,guard:1,jaw:2.5};
 assert.ok(eggPredationDrive(hunter)>.6);
 assert.ok(protectiveDrive(guardian)>.6);
 assert.ok(protectiveDrive(hunter)<.34);
 assert.notEqual(w.category(hunter),w.category(guardian));
 const inherited={...guardian,alleles:{...guardian.alleles,diet:[0,0],guard:[1,1],jaw:[2.5,2.5]}};
 const child=w.recombine(inherited,inherited);
 assert.ok(protectiveDrive(child)>.6);
});
test('guarding herbivore attacks a nearby egg eater to protect its clutch',()=>{
 const w=new Ecosystem(3003);w.tiles.fill(0);w.grass.fill(100);
 const g=w.gene();
 const parent=w.spawn(210,200,{...g,guard:1,jaw:2.5,diet:0,r:6});
 const predator=w.spawn(221,200,{...g,guard:0,jaw:1.0,diet:1,r:5});
 parent.age=predator.age=90;parent.energy=predator.energy=150;
 parent.bite=0;predator.bite=0;
 w.eggs=[{id:4000,x:214,y:204,g:parent.g,parent:parent.id,otherParent:0,
  generation:1,lineage:parent.lineage,age:0,hatchAt:500,energy:14,dead:false,bornTick:0,
  birthX:214,birthY:204}];
 const before=predator.hp;
 w.step();
 assert.ok(predator.hp<before,'guardian must strike approaching egg hunter');
 assert.ok(parent.defendFlash>0);
 assert.ok(w.logs.some(l=>l.type==='defend'));
 assert.ok(w.eggs.some(e=>!e.dead));
});
test('without eggs the same herbivore does not attack harmlessly',()=>{
 const w=new Ecosystem(3004);w.tiles.fill(0);w.grass.fill(100);
 const g=w.gene();
 const parent=w.spawn(210,200,{...g,guard:1,jaw:2.5,diet:0,r:6});
 const predator=w.spawn(220,200,{...g,guard:0,jaw:1,diet:1,r:5});
 parent.age=predator.age=90;parent.energy=predator.energy=150;
 const before=predator.hp;
 w.step();
 assert.equal(parent.defendFlash,0);
 // Ordinary time passing still spends life HP, but no defense strike occurred.
 assert.ok(predator.hp<before);
 assert.ok(!w.logs.some(l=>l.type==='defend'));
});

test('active guardians show a cyan counterattack distinct from orange hunting',()=>{
 const w=new Ecosystem(3006);w.units=[];w.eggs=[];w.corpses=[];
 const u=w.spawn(220,180,{...w.gene(),guard:1,jaw:2.5,diet:0});
 u.attackFlash=16;u.defendFlash=16;
 const styles=[];
 const ctx=new Proxy({canvas:{width:800,height:460},createRadialGradient:()=>({addColorStop(){}})},{
  get(o,k){return k in o?o[k]:()=>{};},
  set(o,k,v){if(k==='strokeStyle')styles.push(v);o[k]=v;return true;}
 });
 drawWorld(ctx,w,false);
 assert.ok(styles.includes('rgba(75,240,231,.93)'));
 u.defendFlash=0;styles.length=0;drawWorld(ctx,w,false);
 assert.ok(styles.includes('rgba(255,148,42,.92)'));
});
test('defensive hits interrupt an egg eater without providing meat rewards',()=>{
 const w=new Ecosystem(3007);
 const guardian=w.spawn(200,150,{...w.gene(),diet:0,guard:1,jaw:2.5});
 const hunter=w.spawn(206,150,{...w.gene(),diet:1,guard:0});
 guardian.energy=100;hunter.hp=hunter.maxHp=500;
 assert.equal(w.attack(guardian,hunter,true),true);
 assert.equal(guardian.defendFlash,16);
 assert.ok(hunter.bite>=14);
 assert.ok(guardian.energy<100);
 assert.ok(w.logs.some(x=>x.type==='defend'));
});

test('absolute habitat crowding penalizes large bodies more than equally positioned small ones',()=>{
 const make=size=>{
  const w=new Ecosystem(3101);
  const g={...w.gene(),r:5,elongation:1,aquatic:0};
  for(let i=0;i<10;i++){
   const u=w.spawn(260+(i%5)*10,170+Math.floor(i/5)*10,{...g});
   u.growthScale=size;u.age=100;
  }
  return {w,load:habitatCrowding(w.units[0],w.units)};
 };
 const small=make(1),large=make(2.3);
 assert.ok(large.load>small.load*4);
 assert.ok(large.load>1.8);
 assert.ok(small.load<1.8);
 large.w.units[0].habitatLoad=large.load;
 large.w.units[0].energy=75;
 assert.equal(large.w.isReadyToMate(large.w.units[0]),false);
});
test('crowded giants lose more energy than the same isolated giants without food',()=>{
 const setup=dense=>{
  const w=new Ecosystem(3102);w.tiles.fill(0);w.grass.fill(0);w.water.fill(0);w.growth=0;w.climateEnabled=false;
  const g={...w.gene(),r:5,elongation:1,aquatic:0,diet:0,hibernate:0,idealTemp:22,tempTolerance:18};
  const focal=w.spawn(280,190,{...g});
  focal.growthScale=1.7;focal.age=100;focal.maxHp=focal.hp=10000;
  focal.energy=200;focal.mateCooldown=500;
  if(dense)for(let i=0;i<8;i++){
   const u=w.spawn(280+(i%4)*6,190+Math.floor(i/4)*6,{...g});
   u.growthScale=1.7;u.age=100;u.energy=200;u.mateCooldown=500;
  }
  return {w,focal};
 };
 const alone=setup(false),packed=setup(true);
 alone.w.step();packed.w.step();
 assert.ok(packed.focal.habitatLoad>=0);
 assert.ok(packed.focal.energy<alone.focal.energy-4);
});
test('sufficiently crowded adult cannot continue growing merely because its reserves are high',()=>{
 const w=new Ecosystem(3103);w.tiles.fill(0);w.grass.fill(100);
 const g={...w.gene(),r:5,elongation:1,aquatic:0,diet:0};
 const u=w.spawn(280,190,{...g});
 u.growthScale=1.6;u.age=100;u.energy=300;u.recentFood=60;
 for(let i=0;i<12;i++){
  const other=w.spawn(280+(i%4)*6,190+Math.floor(i/4)*6,{...g});
  other.growthScale=1.6;other.age=100;other.energy=300;
 }
 const before=u.growthScale;
 w.step();
 assert.ok(u.habitatLoad>=.8);
 assert.equal(u.growthScale,before);
});
test('a crowded giant colony disperses in a food-rich open plain',()=>{
 const w=new Ecosystem(3104);w.tiles.fill(0);w.grass.fill(100);w.water.fill(0);
 const g={...w.gene(),r:5,elongation:1,aquatic:0,diet:0};
 for(let i=0;i<12;i++){
  const u=w.spawn(275+(i%4)*9,185+Math.floor(i/4)*9,{...g});
  u.growthScale=2;u.age=100;u.hp=u.maxHp=10000;u.energy=230;u.mateCooldown=900;
 }
 const closePairs=()=>{
  let pairs=0;
  for(let i=0;i<w.units.length;i++)for(let j=i+1;j<w.units.length;j++)
   if((w.units[i].x-w.units[j].x)**2+(w.units[i].y-w.units[j].y)**2<55**2)pairs++;
  return pairs;
 };
 const before=closePairs();
 // Smaller slimes cover less distance per step; give dispersal enough
 // elapsed time while retaining the expectation of genuine separation.
 for(let i=0;i<260;i++)w.step();
 assert.ok(closePairs()<before*.70,'colony did not disperse despite free space');
});


import {reproductiveMode,sexualCompatibility,reproductiveUpkeep} from './simulation.js';
test('sex is assigned and reproductive modes inherit within bounds',()=>{
 const s=new Ecosystem(31415);
 for(let i=0;i<100;i++){
  const g=s.gene(),c=s.recombine(g,g);
  assert.ok([0,1,2].includes(reproductiveMode(c)));
  assert.ok([0,1,2].includes(reproductiveMode(s.mutate(g))));
 }
 const female=s.spawn(100,100,{...s.gene(),repro:0});
 const herm=s.spawn(120,100,{...s.gene(),repro:1});
 const solo=s.spawn(140,100,{...s.gene(),repro:2});
 assert.ok(['F','M'].includes(female.sex));
 assert.equal(herm.sex,'H');
 assert.equal(solo.sex,'F');
 assert.ok(reproductiveUpkeep(herm.g)>reproductiveUpkeep(female.g));
});
test('same-sex mating is rejected and hermaphrodites can cross',()=>{
 const s=populated(781),a=s.units[0],b=s.units[1];
 a.sex='F';b.sex='F';a.age=b.age=100;a.energy=b.energy=175;
 assert.equal(sexualCompatibility(a,b),false);
 assert.equal(s.conceive(a,b),null);
 b.sex='H';assert.equal(sexualCompatibility(a,b),true);
 assert.ok(s.conceive(a,b));
});
test('parthenogenesis works alone but ordinary females cannot clone',()=>{
 const s=populated(782),a=s.units[0];
 s.units=[a];a.age=100;a.energy=200;a.sex='F';
 a.g.repro=0;assert.equal(s.conceiveSolo(a),null);
 a.g.repro=2;
 const p=s.conceiveSolo(a);assert.ok(p);
 assert.equal(p.otherParent,null);
 assert.ok(p.genomes.length<=2);
 assert.ok(a.energy<200);
 const egg=s.layEgg(a);assert.ok(egg);
 assert.equal(egg.otherParent,null);
 assert.equal(s.conceiveSolo(a),null);
});
test('resource rivalry damages same-sex competitors regardless of diet',()=>{
 const s=populated(783),a=s.units[0],b=s.units[1];
 a.sex=b.sex='M';a.g.diet=0;a.g.guard=0;a.bite=0;
 const before=b.hp;
 assert.equal(s.attack(a,b,'rival'),true);
 assert.ok(b.hp<before);
 assert.ok(s.effects.some(x=>x.type==='rivalStrike'));
});

import {thermalFitness,localTemperature,TERRAIN_TEMPERATURE_OFFSETS} from './simulation.js';
test('temperature varies with season and weather, and microclimates differ',()=>{
 const w=new Ecosystem(932);
 const initial=w.temperature;
 w.tick=600;w.updateTemperature();
 assert.notEqual(w.temperature,initial);
 assert.ok(localTemperature(22,2)>localTemperature(22,0));
 assert.ok(localTemperature(22,1)<localTemperature(22,0));
 assert.equal(TERRAIN_TEMPERATURE_OFFSETS.length,4);
});
test('thermal adaptation is inherited, bounded, and has a tolerance tradeoff',()=>{
 const w=new Ecosystem(933);
 for(let i=0;i<250;i++){
  const child=w.recombine(w.gene(),w.gene());
  assert.ok(child.idealTemp>=-5&&child.idealTemp<=40);
  assert.ok(child.tempTolerance>=3&&child.tempTolerance<=18);
  const mutated=w.mutate(child);
  assert.ok(mutated.idealTemp>=-5&&mutated.idealTemp<=40);
  assert.ok(mutated.tempTolerance>=3&&mutated.tempTolerance<=18);
 }
 const narrow={idealTemp:22,tempTolerance:6};
 const broad={idealTemp:22,tempTolerance:16};
 assert.ok(thermalFitness(broad,34).comfort>thermalFitness(narrow,34).comfort);
 assert.ok(thermalFitness(broad,22).upkeep>thermalFitness(narrow,22).upkeep);
});
test('comfort improves activity and reproduction, and extremes cause damage',()=>{
 const g={idealTemp:24,tempTolerance:8};
 const ideal=thermalFitness(g,24),hot=thermalFitness(g,44),cold=thermalFitness(g,0);
 assert.equal(ideal.damage,0);
 assert.equal(ideal.reproduction,true);
 assert.ok(ideal.activity>hot.activity);
 assert.ok(hot.damage>0&&cold.damage>0);
 assert.equal(hot.reproduction,false);
 const w=new Ecosystem(934),u=w.spawn(200,200,{...w.gene(),idealTemp:24,tempTolerance:8});
 u.age=100;u.energy=180;
 w.temperature=24;w.temperatureAt=()=>24;
 assert.equal(w.isReadyToMate(u),true);
 w.temperatureAt=()=>44;
 assert.equal(w.isReadyToMate(u),false);
});
test('ambient temperature is recorded and resets with the world',()=>{
 const w=new Ecosystem(935);
 w.baseTemperature=37;w.tick=90;w.updateTemperature();
 assert.ok(w.temperature>30);
 w.snapshot();assert.equal(w.history.at(-1).temperature,w.temperature);
 w.reset();
 assert.equal(w.baseTemperature,22);
 assert.equal(w.temperature,22);
});

test('four seasons cycle in 600-step intervals and climate defaults on',()=>{
 const w=new Ecosystem(3451);
 assert.equal(w.climateEnabled,true);
 assert.equal(w.seasonName(),'spring');
 for(const [step,name] of [[599,'spring'],[600,'summer'],[1200,'autumn'],[1800,'winter'],[2400,'spring']]){
  w.tick=step;assert.equal(w.seasonName(),name);
 }
 w.baseTemperature=12;w.climateEnabled=false;w.tick=900;w.updateTemperature();
 assert.equal(w.temperature,12);
 w.climateEnabled=true;w.updateTemperature();assert.notEqual(w.temperature,12);
 w.reset();assert.equal(w.climateEnabled,true);
});
test('seasonal rendering is visual only and keeps simulation RNG untouched',()=>{
 const w=new Ecosystem(3452);
 w.units=[];w.eggs=[];w.corpses=[];
 let count=0;
 const ctx=new Proxy({canvas:{width:800,height:460},createRadialGradient:()=>({addColorStop(){}})},{
  get(o,k){return k in o?o[k]:()=>{};},
  set(o,k,v){if(k==='fillStyle'&&String(v).includes('rgba('))count++;o[k]=v;return true;}
 });
 const before=w.rng;
 w.tick=1800;drawWorld(ctx,w,false);
 assert.equal(w.rng,before);
 assert.ok(count>0);
});

import {lifeStageScale,juvenileGrowthIncrement} from './simulation.js';
test('juvenile body growth follows nutrients, not elapsed age',()=>{
 const empty={stage:'juvenile',age:150,juvenileGrowth:0};
 assert.equal(lifeStageScale(empty),.55);
 const values=[0,.01,.2,.5,.8,.98,1].map(juvenileGrowth=>
  lifeStageScale({stage:'juvenile',juvenileGrowth}));
 assert.equal(values[0],.55);
 for(let i=1;i<values.length;i++)assert.ok(values[i]>values[i-1]);
 assert.equal(values.at(-1),1);
 assert.ok(values.at(-1)-values.at(-2)<.002);
 assert.equal(lifeStageScale({stage:'adult',juvenileGrowth:1}),1);
});
test('collision size is continuous across nutrient-driven maturity transition',()=>{
 const world=new Ecosystem(4112);
 const u=world.spawn(200,170,world.gene(),{id:1,generation:0,lineage:1});
 u.age=85;u.juvenileGrowth=1;u.stage='juvenile';
 const before=bodyCollisionAxes(u);
 u.stage='adult';
 const after=bodyCollisionAxes(u);
 assert.deepEqual(after,before);
});
test('a starving juvenile does not enlarge just by surviving for many steps',()=>{
 const w=new Ecosystem(4113);
 w.tiles.fill(2);w.grass.fill(0);w.waterweed.fill(0);w.growth=0;
 const u=w.spawn(230,170,{...w.gene(),aquatic:0,diet:0,r:4},
  {id:1,generation:0,lineage:1});
 u.energy=75;u.age=0;
 for(let i=0;i<85&&!u.dead;i++)w.step();
 assert.equal(u.juvenileGrowth,0);
 assert.equal(u.stage,'juvenile');
 assert.equal(lifeStageScale(u),.55);
});
test('juveniles develop faster with more food and without crowding',()=>{
 const w=new Ecosystem(4114),g={...w.gene(),aquatic:0,diet:0,r:4};
 const u=w.spawn(230,170,g,{id:1,generation:0,lineage:1});
 u.energy=110;
 const healthy=juvenileGrowthIncrement(u,4,0,0);
 assert.ok(healthy>0);
 assert.equal(juvenileGrowthIncrement(u,0,0,0),0);
 assert.equal(juvenileGrowthIncrement({...u,energy:20},4,0,0),0);
 assert.ok(juvenileGrowthIncrement(u,4,4,7)<healthy);
 assert.ok(juvenileGrowthIncrement({...u,growthScale:3.8,g:{...g,r:12}},4,0,0)<healthy);
});
import {SpatialLookup,crowdMetrics} from './simulation.js';
test('ecological population targets are below the emergency safety cap',()=>{
 const w=new Ecosystem(8621),g=w.gene();
 for(let i=0;i<601;i++)assert.ok(w.spawn(20+(i*17)%760,20+(i*29)%420,g));
 assert.equal(w.units.length,601);
 for(let i=601;i<2000;i++)assert.ok(w.spawn(20+(i*17)%760,20+(i*29)%420,g));
 assert.equal(w.spawn(100,100,g),null);
});
test('spatial index queries exactly match brute-force neighbors in original order',()=>{
 const w=new Ecosystem(8622),g=w.gene();
 for(let i=0;i<240;i++)w.spawn(15+(i*43)%770,15+(i*59)%430,g);
 const grid=new SpatialLookup(w.units);
 for(const [x,y,r] of [[10,10,55],[320,220,140],[650,430,90],[400,200,12],[400,200,1000]]){
  const actual=grid.query(x,y,r).map(u=>u.id);
  const expected=w.units.filter(u=>(u.x-x)**2+(u.y-y)**2<r*r).map(u=>u.id);
  assert.deepEqual(actual,expected);
 }
});
test('fused crowding calculations match independent calculations',()=>{
 const w=new Ecosystem(8623),g=w.gene();
 for(let i=0;i<80;i++)w.spawn(100+(i*13)%240,100+(i*29)%200,g);
 const spatial=new SpatialLookup(w.units);
 for(const u of w.units.slice(0,12)){
  const near=spatial.query(u.x,u.y,145);
  const metrics=crowdMetrics(u,near);
  assert.ok(Math.abs(metrics.density-localDensity(u,near))<1e-9);
  assert.ok(Math.abs(metrics.habitatLoad-habitatCrowding(u,near))<1e-9);
 }
});

import {lifeFade,livingBodyColor} from './renderer.js';
test('body keeps natural pigment until half life, then fades into corpse color',()=>{
 const g=new Ecosystem(7161).gene(),u={hp:100,maxHp:100};
 for(const hp of [100,75,50]){u.hp=hp;assert.equal(lifeFade(u),0);}
 u.hp=25;assert.equal(lifeFade(u),.5);
 const halfway=livingBodyColor(g,lifeFade(u));
 assert.ok(halfway.startsWith('hsl('));
 assert.notEqual(halfway,livingBodyColor(g,0));
 u.hp=0;assert.equal(lifeFade(u),1);
 assert.equal(livingBodyColor(g,lifeFade(u)),'#9e9788');
 assert.equal(livingBodyColor(g,lifeFade(u),true),'#655f56');
});
test('age and attack consume permanent HP, food cannot restore it',()=>{
 const w=new Ecosystem(7162);
 w.tiles.fill(0);w.grass.fill(100);w.water.fill(100);
 const g={...w.gene(),diet:0,aquatic:0,idealTemp:24,tempTolerance:14};
 const u=w.spawn(240,180,g);u.energy=100;u.age=100;u.mateCooldown=10000;
 w.temperatureAt=()=>24;
 const hp=u.hp;
 for(let i=0;i<20;i++)w.step();
 assert.ok(u.hp<hp);
 const after=u.hp;
 w.grass.fill(100);
 for(let i=0;i<20;i++)w.step();
 assert.ok(u.hp<after);
 const hunter=w.spawn(u.x+2,u.y+2,{...g,diet:1,jaw:2.5});
 hunter.age=100;hunter.hp=hunter.maxHp=10000;
 u.hp=u.maxHp;
 const before=u.hp;
 assert.ok(w.attack(hunter,u));
 assert.ok(u.hp<before);
});
test('soil intervention increases local fertility and can revive depleted dry land',()=>{
 const w=new Ecosystem(8661);
 w.tiles.fill(2);w.grass.fill(0);w.soil.fill(0);w.water.fill(0);
 const center=w.cell(200,180),stone=w.cell(240,180);
 w.tiles[stone]=3;
 const treated=w.fertilize(200,180,2);
 assert.ok(treated>0);
 assert.equal(w.tiles[center],0);
 assert.ok(w.grass[center]>0);
 assert.ok(w.soil[center]>=65);
 assert.equal(w.tiles[stone],3);
 assert.equal(w.soil[stone],0);
 const now=w.grass[center];
 for(let i=0;i<6;i++)w.step();
 assert.ok(w.grass[center]>now);
});
test('resource-based reproduction has no arbitrary crowd-count veto',()=>{
 const w=new Ecosystem(8662),g=w.gene();
 const u=w.spawn(240,180,g);
 u.age=110;u.stage='adult';u.energy=250;u.infection=0;u.mateCooldown=0;
 w.temperatureAt=()=>u.g.idealTemp;
 u.localCrowd=35;u.crowdStress=8;u.habitatLoad=3;
 // Local pressure raises energy needed rather than forbidding healthy adults.
 assert.equal(w.isReadyToMate(u),true);
 u.energy=58;
 assert.equal(w.isReadyToMate(u),false);
});
test('more bodies mean more habitat occupation and higher maintenance',()=>{
 const w=new Ecosystem(8663),g={...w.gene(),r:5,elongation:1,aquatic:0};
 const anchor=w.spawn(300,210,g);anchor.age=100;
 const sparse=habitatCrowding(anchor,w.units);
 for(let i=0;i<15;i++)w.spawn(300+(i%5)*7,210+Math.floor(i/5)*7,g);
 const dense=habitatCrowding(anchor,w.units);
 assert.ok(dense>sparse);
 assert.ok(dense>0);
});

test('organisms stop at reachable food, mate, or shore contact distance',()=>{
 const w=new Ecosystem(4301);w.tiles.fill(0);w.water.fill(0);
 const u=w.spawn(180,220,w.gene());u.g.aquatic=0;u.angle=.4;
 const before={x:u.x,y:u.y,angle:u.angle,rng:w.rng};
 const status=w.navigate(u,{x:187,y:220},0,1,.29,12);
 assert.equal(status,'arrived');
 assert.equal(u.x,before.x);assert.equal(u.y,before.y);
 assert.equal(u.angle,before.angle);assert.equal(w.rng,before.rng);
});
test('blocked shoreline pursuit makes a detour, then abandons unreachable destination',()=>{
 const w=new Ecosystem(4302);w.tiles.fill(0);w.water.fill(0);
 // A water barrier divides the map, so a terrestrial creature cannot
 // cross to its target. No repeated instantaneous 130-degree spin.
 for(let y=0;y<23;y++)w.tiles[y*40+10]=1;
 const u=w.spawn(189,221,w.gene());u.g.aquatic=0;u.angle=0;
 const target={x:280,y:221};
 let detours=0,abandoned=false;
 for(let step=1;step<=160;step++){
  w.tick=step;
  const desired=Math.atan2(target.y-u.y,target.x-u.x);
  const result=w.navigate(u,target,desired,1,.29,8);
  if(result==='detour')detours++;
  if(result==='abandoned'){abandoned=true;break;}
  assert.notEqual(w.terrain(u.x,u.y),1);
 }
 assert.ok(detours>0);
 assert.equal(abandoned,true);
 assert.ok(u.avoidTarget.until>w.tick);
});
test('open terrain progress does not trigger unreachable-goal cooldown',()=>{
 const w=new Ecosystem(4303);w.tiles.fill(0);
 const u=w.spawn(100,220,w.gene());u.angle=0;
 const target={x:300,y:220};
 for(let step=1;step<=75;step++){
  w.tick=step;
  w.navigate(u,target,Math.atan2(target.y-u.y,target.x-u.x),1,.29,8);
 }
 assert.ok(u.x>160);
 assert.equal(u.avoidTarget,undefined);
});
test('a world-edge goal does not keep the creature rotating without movement',()=>{
 const w=new Ecosystem(4304);w.tiles.fill(0);
 const u=w.spawn(793,220,w.gene());u.angle=0;
 const initialY=u.y,goal={x:900,y:220};
 let shifted=false;
 for(let step=1;step<=60;step++){
  w.tick=step;
  w.navigate(u,goal,Math.atan2(goal.y-u.y,goal.x-u.x),1,.29,8);
  if(Math.abs(u.y-initialY)>5)shifted=true;
  assert.ok(u.x<=793&&u.x>=7);
 }
 assert.ok(shifted);
});

test('overgrazing slows regrowth and recovers when grazers leave',()=>{
 const create=crowded=>{
  const w=new Ecosystem(6201);
  w.tiles.fill(2);w.grass.fill(0);w.water.fill(0);w.growth=70;
  const at=w.cell(210,150);
  w.tiles[at]=0;w.grass[at]=40;w.soil[at]=50;
  if(crowded){
   const g={...w.gene(),aquatic:0,diet:0,r:6,elongation:1};
   for(let i=0;i<12;i++){const u=w.spawn(210,150,g);u.energy=80;u.mateCooldown=999;}
  }
  for(let i=0;i<6;i++)w.step();
  return {w,at};
 };
 const open=create(false),packed=create(true);
 assert.ok(open.w.grass[open.at]>packed.w.grass[packed.at]);
 assert.ok(open.w.soil[open.at]>=packed.w.soil[packed.at]);
 const before=packed.w.grass[packed.at];
 packed.w.units=[];
 // A surviving neighboring plant can recolonize an overgrazed empty patch.
 const neighbor=packed.at+1;
 packed.w.tiles[neighbor]=0;packed.w.grass[neighbor]=80;
 packed.w.rand=()=>0;
 for(let i=0;i<18;i++)packed.w.step();
 assert.ok(packed.w.grass[packed.at]>before);
});
test('eating plants draws down finite soil nutrients',()=>{
 const w=new Ecosystem(6202);w.tiles.fill(2);w.grass.fill(0);
 const at=w.cell(210,150);
 w.tiles[at]=0;w.grass[at]=30;w.soil[at]=55;
 assert.ok(w.consumeGrass(210,150,7)>0);
 assert.ok(w.soil[at]<55);
});
test('large inherited body sizes are possible but initially uncommon',()=>{
 const w=new Ecosystem(6203);
 let large=0;
 for(let i=0;i<500;i++)if(w.gene().r>=8.5)large++;
 assert.ok(large>0&&large<65);
});
test('acquired giant shrinks in shortage rather than remaining permanently huge',()=>{
 const w=new Ecosystem(6204);
 w.tiles.fill(2);w.grass.fill(0);w.water.fill(0);
 const u=w.spawn(210,160,{...w.gene(),aquatic:0,diet:0});
 u.age=100;u.growthScale=2;u.energy=30;u.mateCooldown=999;
 const size=u.growthScale;
 w.step();
 assert.ok(u.growthScale<size);
});

test('hungry meat-eaters can attack similarly sized members of their own species',()=>{
 const w=new Ecosystem(6601);
 w.tiles.fill(0);w.grass.fill(0);w.water.fill(0);w.growth=0;w.stress=0;
 const g={...w.gene(),aquatic:0,diet:.85,r:5,elongation:1,eyes:3,jaw:2,mouths:3};
 const hunter=w.spawn(200,180,g),other=w.spawn(205,180,g);
 assert.equal(hunter.category,other.category);
 hunter.energy=35;other.energy=160;
 hunter.age=other.age=90;
 hunter.mateCooldown=other.mateCooldown=900;
 hunter.hp=hunter.maxHp=1000;
 other.hp=other.maxHp=1000;
 hunter.threatDecisions.set(other.id,{flee:false});
 w.step();
 assert.ok(other.hp<1000);
 assert.ok(hunter.attackFlash>0);
});

test('egg hatching keeps birth records but does not create intrusive rings',()=>{
 const w=new Ecosystem(7391);
 const g=w.gene(),parent=w.spawn(200,160,g);
 w.effects=[];w.logs=[];
 const child=w.spawn(210,160,g,parent);
 assert.ok(w.logs.some(entry=>entry.type==='birth'&&entry.message.includes('孵化')));
 assert.ok(!w.effects.some(effect=>effect.type==='birth'));
 w.log('hatch','卵から孵化',{x:210,y:160});
 assert.ok(w.logs.some(entry=>entry.type==='hatch'));
 assert.ok(!w.effects.some(effect=>effect.type==='hatch'));
 w.log('death','死亡',{x:210,y:160});
 assert.ok(w.effects.some(effect=>effect.type==='death'));
});

import {lifeDrain,longevityUpkeep} from './simulation.js';
test('longevity is heritable, mutable, and not an arbitrary species boundary',()=>{
 const w=new Ecosystem(8240),a=w.gene(),b=w.gene();
 assert.ok(a.longevity>=.6&&a.longevity<=2);
 const child=w.recombine(a,b);
 assert.ok(child.longevity>=.6&&child.longevity<=2);
 assert.equal(child.alleles.longevity.length,2);
 assert.equal(w.category({...a,longevity:.6}),w.category({...a,longevity:2}));
 for(let i=0;i<100;i++){
  const m=w.mutate(a);
  assert.ok(m.longevity>=.6&&m.longevity<=2);
 }
});
test('nutrition, temperature, terrain and genes determine irreversible lifespan drain',()=>{
 const w=new Ecosystem(8241),g={...w.gene(),idealTemp:22,tempTolerance:9,
  dry:0,rock:0,longevity:1};
 const u={g,hp:80,maxHp:80,age:120,energy:140};
 const env={temperature:22,terrain:0};
 const ideal=lifeDrain(u,env);
 assert.ok(ideal>0);
 assert.ok(lifeDrain({...u,energy:75},env)>ideal);
 assert.ok(lifeDrain({...u,energy:0},env)>ideal*5);
 assert.ok(lifeDrain(u,{temperature:38,terrain:0})>ideal*1.5);
 assert.ok(lifeDrain(u,{temperature:22,terrain:2})>ideal);
 assert.ok(lifeDrain({...u,g:{...g,longevity:1.9}},env)<ideal*.65);
 assert.ok(lifeDrain({...u,g:{...g,longevity:.7}},env)>ideal);
 assert.ok(longevityUpkeep({...g,longevity:1.9})>longevityUpkeep({...g,longevity:.7}));
});
test('life runs down slowly in a healthy habitat, faster when starved',()=>{
 const w=new Ecosystem(8242);
 w.tiles.fill(0);w.grass.fill(100);w.water.fill(100);
 const g={...w.gene(),longevity:1.85,idealTemp:22,tempTolerance:15,diet:0,aquatic:0};
 const u=w.spawn(220,180,g);
 u.energy=180;u.age=100;u.mateCooldown=10000;
 w.temperatureAt=()=>22;
 const before=u.hp;
 w.step();
 const wellFedLoss=before-u.hp;
 assert.ok(wellFedLoss>0&&wellFedLoss<u.maxHp/1000);
 // Compare the pure aging term at equal age to exclude feeding and combat.
 const healthy=lifeDrain({...u,energy:180},{temperature:22,terrain:0});
 const starved=lifeDrain({...u,energy:0},{temperature:22,terrain:0});
 assert.ok(starved>healthy*5);
});

test('longevity postpones physiological senescence and has no hard death age',()=>{
 const w=new Ecosystem(8243),g=w.gene();
 const short={g:{...g,longevity:.7},age:1000,maxHp:100,hp:100};
 const long={g:{...g,longevity:1.9},age:1000,maxHp:100,hp:100};
 assert.ok(vitality(long).vigor>vitality(short).vigor);
 assert.ok(vitality(long).old<vitality(short).old);
 const oldLong={...long,age:3300};
 assert.ok(lifeDrain(oldLong,{temperature:long.g.idealTemp,terrain:0})>0);
});

test('routine ecological events leave logs without flooding the world with ripples',()=>{
 const w=new Ecosystem(8701);w.effects=[];w.logs=[];
 const at={x:220,y:180};
 for(const type of ['mate','egg','decay','migration','settle','new','info','court','birth','hatch']){
  w.log(type,type,at);
 }
 assert.equal(w.logs.length,10);
 assert.equal(w.effects.length,0);
 w.log('death','death',at);
 assert.equal(w.effects.length,1);
 assert.equal(w.effects[0].type,'death');
});

test('a crowded clutch cannot all mature without enough resources',()=>{
 const simulate=(dense,food)=>{
  const w=new Ecosystem(8123);
  w.tiles.fill(food?0:2);w.grass.fill(food?100:0);
  w.water.fill(100);w.waterbed.fill(0);w.growth=food?80:0;
  const g={...w.gene(),aquatic:0,diet:0,r:4,elongation:1,
   idealTemp:22,tempTolerance:18};
  const ids=[];
  for(let i=0;i<24;i++){
   const x=dense?220+(i%6)*3:30+(i%6)*120;
   const y=dense?170+Math.floor(i/6)*3:50+Math.floor(i/6)*90;
   const u=w.spawn(x,y,g,{id:1,generation:0,lineage:1});
   u.energy=70;u.hydration=100;ids.push(u.id);
  }
  for(let i=0;i<90;i++)w.step();
  const survivors=ids.map(id=>w.units.find(u=>u.id===id)).filter(Boolean);
  return {alive:survivors.length,adults:survivors.filter(u=>u.stage==='adult').length};
 };
 const separated=simulate(false,true);
 const crowded=simulate(true,true);
 const barren=simulate(true,false);
 assert.equal(separated.adults,24);
 assert.ok(crowded.adults<separated.adults);
 assert.equal(barren.adults,0);
 assert.ok(barren.alive<crowded.alive);
});

test('large colonies retain cheap glossy sheen without allocating gradients per small body',()=>{
 const w=new Ecosystem(8911);w.units=[];w.corpses=[];w.eggs=[];w.effects=[];
 const g={...w.gene(),r:4,elongation:1,albino:0};
 for(let i=0;i<260;i++){
  const u=w.spawn(30+(i%20)*36,30+Math.floor(i/20)*29,g);
  u.maxHp=u.hp=100;u.age=50;
 }
 let gradients=0,softSheen=0;
 const ctx=new Proxy({canvas:{width:800,height:460},
  createRadialGradient(){gradients++;return {addColorStop(){}};}},
  {get(o,k){return k in o?o[k]:()=>{};},
   set(o,k,v){if(k==='fillStyle'&&v==='rgba(255,255,255,0.160)')softSheen++;o[k]=v;return true;}});
 drawWorld(ctx,w,false);
 assert.equal(gradients,0);
 assert.ok(softSheen>=250);
});

import {speciesNameFromCategory,genomeCode} from './simulation.js';
test('classification-derived katakana names are deterministic across resets and discovery order',()=>{
 const a=new Ecosystem(9111),b=new Ecosystem(9112);
 const g=a.gene(),key=a.category(g),expected=speciesNameFromCategory(key);
 assert.equal(a.name(key),expected);
 assert.equal(b.name(key),expected);
 a.spawn(120,130,g);
 assert.equal(a.species.get(key).name,expected);
 a.reset();
 a.spawn(120,130,g);
 assert.equal(a.species.get(key).name,expected);
 const c=new Ecosystem(9113);
 c.spawn(100,110,{...c.gene(),diet:1,aquatic:1});
 c.spawn(120,130,g);
 assert.equal(c.species.get(key).name,expected);
});
test('all 108864 ecological classifications have unique readable names of ten kana',()=>{
 const habitats=['land','aquatic','dry','rock'];
 const groups=[['plant','mixed','hunter'],['tiny','medium','large','giant'],
  ['round','oval','long'],['blind','few','several','allround'],
  ['general','guardian','egg-hunter'],['repro0','repro1','repro2'],
  ['temperate','cold','hot'],['red','yellow','green','blue','purple','pink','white']];
 const names=new Set();
 const traverse=(parts,index)=>{
  if(index===groups.length){
   const name=speciesNameFromCategory(parts.join('-'));
   assert.ok(/^[ァ-ヶ]{10}$/.test(name),name);
   assert.ok(!/アア$/.test(name),'unnatural numeric ending '+name);
   assert.ok(!/(.)\\1$/.test(name),'identical final mora '+name);
   assert.ok(!names.has(name),'duplicate '+name);
   names.add(name);return;
  }
  for(const category of groups[index])traverse([...parts,category],index+1);
 };
 for(const habitat of habitats)traverse([habitat],0);
 assert.equal(names.size,108864);
 assert.equal(speciesNameFromCategory('aquatic-hunter-large-oval-few-guardian-repro2-cold-blue'),'ミズベニアオメコギフ');
});
test('pigment name follows color phenotype and remains stable for cosmetic variations',async()=>{
 const {pigmentClass,adaptationColor}=await import('./simulation.js');
 const w=new Ecosystem(9115),g=w.gene();
 assert.equal(pigmentClass({...g,albino:1}),'white');
 const key=w.category(g);
 assert.equal(key.split('-').length,9);
 const before=speciesNameFromCategory(key);
 assert.equal(w.name(key),before);
 const white=w.category({...g,albino:1});
 assert.notEqual(white,key);
 assert.ok(speciesNameFromCategory(white).includes('シロ'));
 const hue=adaptationColor(g).hue;
 assert.ok(hue>=0&&hue<360);
});
test('genome code is stable, quantized, and changes when a trait crosses a bin',()=>{
 const w=new Ecosystem(9114),g=w.gene();
 const code=genomeCode(g);
 assert.equal(code,genomeCode({...g}));
 assert.ok(/^[0-9A-F]{4}(-[0-9A-F]{4}){6}-[0-9A-F]$/.test(code));
 const variant={...g,longevity:2};
 assert.notEqual(genomeCode(variant),code);
 assert.equal(genomeCode({...g,wet:.401}),genomeCode({...g,wet:.402}));
});

import {crowdEnergyCost} from './simulation.js';
test('grazing pressure follows the harvested tile rather than animal positions',()=>{
 const w=new Ecosystem(9281);
 w.tiles.fill(2);w.grass.fill(0);w.water.fill(0);
 const feed=w.cell(210,150),standing=w.cell(170,150);
 w.tiles[feed]=0;w.grass[feed]=65;w.soil[feed]=90;
 w.tiles[standing]=0;w.grass[standing]=65;w.soil[standing]=90;
 const g={...w.gene(),aquatic:0,diet:0,r:4};
 const u=w.spawn(170,150,g);
 u.energy=120;u.age=95;
 assert.ok(w.consumeGrass(210,150,24)>0);
 assert.ok(w.grazingPressure[feed]>0);
 assert.equal(w.grazingPressure[standing],0);
 // The grass tile actually grazed has reduced regeneration next cycle.
 const beforeFeed=w.grass[feed],beforeStanding=w.grass[standing];
 w.units=[];for(let i=0;i<6;i++)w.step();
 assert.ok(w.grass[feed]-beforeFeed<w.grass[standing]-beforeStanding);
 assert.ok(w.grazingPressure[feed]>0);
 const pressure=w.grazingPressure[feed];
 for(let i=0;i<6;i++)w.step();
 assert.ok(w.grazingPressure[feed]<pressure);
});
test('actual aquatic grazing is tracked independently of the organism location',()=>{
 const w=new Ecosystem(9282);
 w.tiles.fill(2);w.grass.fill(0);
 const plant=w.cell(210,150),other=w.cell(170,150);
 w.tiles[plant]=1;w.water[plant]=80;w.waterweed[plant]=50;
 w.tiles[other]=1;w.water[other]=80;w.waterweed[other]=50;
 const taken=w.consumeWaterweed(210,150,12);
 assert.equal(taken,12);
 assert.ok(w.grazingPressure[plant]>0);
 assert.equal(w.grazingPressure[other],0);
});
test('crowding costs keep rising smoothly beyond former fixed upper limits',()=>{
 assert.equal(crowdEnergyCost(0),0);
 assert.ok(crowdEnergyCost(3)>crowdEnergyCost(1));
 assert.ok(crowdEnergyCost(20)>20);
 assert.ok(crowdEnergyCost(30)>crowdEnergyCost(20));
 assert.ok(crowdEnergyCost(30,2)>crowdEnergyCost(30,1));
 assert.ok(crowdStress(50)>9);
 assert.ok(crowdStress(100)>crowdStress(50));
});

import {EcologyLogbook,observeEcology,ECOLOGY_LOG_KEY,ECOLOGY_LOG_INTERVAL} from './ecology-log.js';
test('long-term ecology snapshot captures population resources and cumulative deaths',()=>{
 const w=new Ecosystem(9931);
 const g=w.gene();w.spawn(210,160,g);
 const u=w.spawn(230,180,g);
 w.die(u,'飢餓');
 const row=observeEcology(w);
 assert.equal(row.population,1);
 assert.equal(row.births,2);
 assert.equal(row.deaths,1);
 assert.equal(row.deathStarvation,1);
 assert.ok(row.grass>0);
 assert.ok(row.water>0);
 assert.equal(row.step,0);
});
test('long-term ecology log stores regular steps, distinct runs and csv columns',()=>{
 const values=new Map();
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const b=new EcologyLogbook(storage,'test-1');
 assert.equal(b.sampleCount,0);
 const first=b.start(4);
 assert.equal(ECOLOGY_LOG_INTERVAL,50);
 assert.equal(b.record({step:1,population:2}),false);
 assert.equal(b.record({step:50,population:3}),true);
 assert.equal(b.record({step:50,population:4}),true);
 assert.equal(b.sampleCount,1);
 b.end({step:75,population:5});
 const second=b.start(4);
 b.record({step:0,population:6},true);
 assert.notEqual(first,second);
 assert.equal(b.sampleCount,3);
 const csv=b.toCSV();
 assert.ok(csv.includes('run,version,step,population'));
 assert.ok(csv.includes('test-1,50,4'));
 assert.ok(csv.includes('test-1,75,5'));
 const restored=new EcologyLogbook(storage,'test-1');
 assert.equal(restored.sampleCount,3);
 assert.equal(restored.data.runs.length,2);
});
test('version upgrades discard obsolete ecology logs and never retain stale rows',()=>{
 const values=new Map();
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const first=new EcologyLogbook(storage,'old-code');
 first.start(11);first.record({step:50,population:500},true);
 const upgrade=new EcologyLogbook(storage,'new-code');
 assert.equal(upgrade.sampleCount,0);
 assert.equal(upgrade.data.runs.length,0);
 assert.equal(JSON.parse(values.get(ECOLOGY_LOG_KEY)).version,'new-code');
 upgrade.start(11);upgrade.record({step:50,population:5},true);
 assert.ok(!upgrade.toCSV().includes('500'));
 upgrade.clear();
 assert.equal(new EcologyLogbook(storage,'new-code').sampleCount,0);
});

import {seasonPalette} from './renderer.js';
test('Japan-like seasonal targets are 35C in summer and 0C in winter at default baseline',()=>{
 const w=new Ecosystem(9403);
 w.baseTemperature=22;
 const expect=[{step:300,name:'spring',temp:22},{step:900,name:'summer',temp:35},
  {step:1500,name:'autumn',temp:19},{step:2100,name:'winter',temp:0}];
 for(const sample of expect){
  w.tick=sample.step;
  assert.equal(w.seasonName(),sample.name);
  assert.equal(w.seasonalTemperature(),sample.temp);
 }
 // Weather can shift the current temperature, but seasonal targets stay fixed.
 w.tick=900;w.weather='sunny';w.updateTemperature();
 assert.ok(w.temperature>=33&&w.temperature<=37);
 w.tick=2100;w.weather='cloudy';w.updateTemperature();
 assert.ok(w.temperature>=-2&&w.temperature<=2);
});
test('season temperatures match their visible seasons and change smoothly',()=>{
 const w=new Ecosystem(9401);
 w.weather='cloudy';w.baseTemperature=22;
 const at=step=>{w.tick=step;w.updateTemperature();return w.temperature;};
 const spring=at(300),summer=at(900),autumn=at(1500),winter=at(2100);
 assert.ok(summer>spring+7);
 assert.ok(spring>autumn+2);
 assert.ok(autumn>winter+10);
 assert.ok(winter<4);
 for(const boundary of [600,1200,1800,2400]){
  const before=at(boundary-1),after=at(boundary);
  assert.ok(Math.abs(after-before)<1,'season boundary discontinuity at '+boundary);
 }
 w.climateEnabled=false;w.tick=2100;w.updateTemperature();
 assert.equal(w.temperature,22);
});
test('all four terrain palettes are distinct and spring keeps original greens',()=>{
 const spring=seasonPalette('spring'),summer=seasonPalette('summer'),
  autumn=seasonPalette('autumn'),winter=seasonPalette('winter');
 assert.equal(spring.terrain[0],TERRAIN_COLORS[0]);
 assert.equal(spring.grass,'#89ec5e');
 assert.notEqual(summer.terrain[0],spring.terrain[0]);
 assert.notEqual(autumn.blade,spring.blade);
 assert.notEqual(winter.water,summer.water);
 assert.notEqual(winter.terrain[0],spring.terrain[0]);
});
test('autumn foliage and winter ice render without changing terrain and ecology',()=>{
 const w=new Ecosystem(9402);
 w.units=[];w.eggs=[];w.corpses=[];w.tiles.fill(0);
 w.tiles[0]=1;w.water[0]=90;w.grass[1]=100;
 const firstTiles=[...w.tiles],firstWater=w.water[0],rng=w.rng;
 const colors=[];
 const ctx=new Proxy({canvas:{width:800,height:460},createRadialGradient:()=>({addColorStop(){}})},{
  get(o,k){return k in o?o[k]:()=>{};},
  set(o,k,v){if(k==='fillStyle'||k==='strokeStyle')colors.push(v);o[k]=v;return true;}
 });
 w.tick=1500;w.updateTemperature();
 drawWorld(ctx,w,false);
 assert.ok(colors.includes('#ecbc50')||colors.includes('#b8582d')||colors.includes('#d76d31')||colors.includes('#a63e38'));
 colors.length=0;
 w.tick=2100;w.updateTemperature();
 drawWorld(ctx,w,false);
 assert.ok(colors.includes('rgba(231,249,255,.66)'));
 assert.ok(colors.includes('rgba(255,255,255,.85)'));
 assert.deepEqual([...w.tiles],firstTiles);
 assert.equal(w.water[0],firstWater);
 assert.equal(w.rng,rng);
});

import {performancePolicy,simulationBatch,BROWSER_BACKGROUND_INTERVAL} from './performance-policy.js';
test('video-friendly scheduler reduces drawing and simulation work as the ecosystem grows',()=>{
 const small=performancePolicy(30,true),dense=performancePolicy(300,true),crowded=performancePolicy(600,true);
 assert.ok(small.paintInterval>=45);
 assert.ok(dense.paintInterval>small.paintInterval);
 assert.ok(crowded.paintInterval>dense.paintInterval);
 assert.ok(crowded.stepsPerSecond<small.stepsPerSecond);
 assert.ok(small.uiInterval>=900);
 assert.equal(BROWSER_BACKGROUND_INTERVAL,1000);
 const detailed=performancePolicy(30,false);
 assert.ok(detailed.paintInterval<small.paintInterval);
});
test('slow or hidden frames never create a catch-up simulation burst',()=>{
 const policy=performancePolicy(600,true);
 let batch=simulationBatch(0,100000,policy,8);
 assert.ok(batch.steps<=1);
 assert.ok(batch.carry<2);
 batch=simulationBatch(batch.carry,100000,policy,8);
 assert.ok(batch.steps<=1);
 assert.ok(batch.carry<2);
 const noTime=simulationBatch(0,0,policy,1);
 assert.equal(noTime.steps,0);
 const low=performancePolicy(600,true),high=performancePolicy(600,false);
 let lowSteps=0,highSteps=0,lowCarry=0,highCarry=0;
 // 10 seconds of frame scheduling at 60fps, in fast-forward mode.
 for(let i=0;i<600;i++){
  const a=simulationBatch(lowCarry,1000/60,low,8);
  lowCarry=a.carry;lowSteps+=a.steps;
  const b=simulationBatch(highCarry,1000/60,high,8);
  highCarry=b.carry;highSteps+=b.steps;
 }
 assert.ok(lowSteps<=85,'low-impact mode must limit background resource contention');
 assert.ok(highSteps>lowSteps,'full-speed mode can use more CPU when requested');
});

test('reproductive diagnosis classifies genuine barriers without changing mating rules',()=>{
 const w=new Ecosystem(99001);
 const base={...w.gene(),idealTemp:22,tempTolerance:10};
 const u=w.spawn(200,150,base);
 u.age=100;u.stage='adult';u.energy=180;u.infection=0;u.mateCooldown=0;
 w.temperatureAt=()=>22;
 assert.equal(w.reproductionBlockReason(u),null);
 assert.equal(w.isReadyToMate(u),true);
 w.temperatureAt=()=>45;
 assert.equal(w.reproductionBlockReason(u),'temperature');
 assert.equal(w.isReadyToMate(u),false);
 w.temperatureAt=()=>22;
 u.infection=12;assert.equal(w.reproductionBlockReason(u),'infection');u.infection=0;
 u.stage='juvenile';assert.equal(w.reproductionBlockReason(u),'immature');u.stage='adult';
 u.energy=1;assert.equal(w.reproductionBlockReason(u),'energy');u.energy=180;
 u.mateCooldown=10;assert.equal(w.reproductionBlockReason(u),'cooldown');u.mateCooldown=0;
 u.pregnancy={remaining:10};assert.equal(w.reproductionBlockReason(u),'pregnancy');u.pregnancy=null;
 assert.equal(w.reproductionBlockReason(u),null);
});
test('courtship interruption records specific reason and does not invent a birth',()=>{
 const w=new Ecosystem(99002),g={...w.gene(),idealTemp:22,tempTolerance:10};
 const a=w.spawn(200,150,g),b=w.spawn(207,150,g);
 a.sex='F';b.sex='M';
 for(const u of [a,b]){u.age=110;u.stage='adult';u.energy=200;u.infection=0;u.mateCooldown=0;}
 w.temperatureAt=()=>22;
 assert.ok(w.startCourtship(a,b));
 assert.equal(w.courtshipStarts,1);
 b.infection=20;w.updateCourtships();
 assert.equal(w.courtshipFailures.infection,1);
 assert.ok(w.logs.some(x=>x.type==='courtFail'&&x.message.includes('感染')));
 assert.equal(w.matings,0);
 b.infection=0;
 assert.ok(w.startCourtship(a,b));
 b.x+=100;w.updateCourtships();
 assert.equal(w.courtshipFailures.separated,1);
 assert.equal(w.courtships.length,0);
});
test('reproduction census distinguishes unsuitable temperature from no compatible mate',()=>{
 const w=new Ecosystem(99003),g={...w.gene(),idealTemp:22,tempTolerance:8};
 w.temperatureAt=()=>22;
 const a=w.spawn(200,150,g);
 a.stage='adult';a.age=100;a.energy=180;a.mateCooldown=0;a.infection=0;
 let count=w.reproductionCensus();
 assert.equal(count.ready,1);assert.equal(count.noPartner,1);
 const b=w.spawn(210,150,{...g});b.stage='adult';b.age=100;b.energy=180;b.mateCooldown=0;b.infection=0;
 a.sex='F';b.sex='M';
 count=w.reproductionCensus();
 assert.equal(count.ready,2);assert.equal(count.noPartner,0);
 w.temperatureAt=()=>42;
 count=w.reproductionCensus();
 assert.equal(count.temperature,2);assert.equal(count.ready,0);
 const summary=observeEcology(w);
 assert.equal(summary.reproTemperature,2);
 assert.equal(summary.reproReady,0);
 assert.ok(summary.meanPreferredTemp>0&&summary.meanTempTolerance>0);
});
test('founder thermal genes include cold-hot specialists and heritable differences',()=>{
 const w=new Ecosystem(99004),distribution={cold:0,hot:0,generalist:0};
 for(let i=0;i<800;i++){
  const g=w.gene();
  if(g.idealTemp<12)distribution.cold++;
  if(g.idealTemp>31)distribution.hot++;
  if(g.tempTolerance>=14)distribution.generalist++;
 }
 assert.ok(distribution.cold>15);
 assert.ok(distribution.hot>15);
 assert.ok(distribution.generalist>20);
 const cold={...w.gene(),idealTemp:2,tempTolerance:12};
 const warm={...w.gene(),idealTemp:35,tempTolerance:8};
 assert.ok(thermalFitness(cold,0).comfort>thermalFitness(warm,0).comfort);
 assert.ok(thermalFitness(warm,35).comfort>thermalFitness(cold,35).comfort);
 assert.ok(thermalFitness(warm,35).reproduction);
 assert.equal(thermalFitness(cold,35).reproduction,false);
 assert.ok(w.recombine(cold,cold).idealTemp<20);
});
test('CSV tracks reproductive blockers and failed courtships with distinct columns',()=>{
 const w=new Ecosystem(99005),g={...w.gene(),idealTemp:22,tempTolerance:7};
 const u=w.spawn(205,150,g);u.age=100;u.stage='adult';u.energy=170;
 w.temperatureAt=()=>42;
 w.courtshipStarts=2;w.courtshipFailures.temperature=1;
 const row=observeEcology(w);
 assert.equal(row.reproTemperature,1);
 assert.equal(row.courtshipStarts,2);
 assert.equal(row.courtFailTemperature,1);
 const data=new Map();
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const book=new EcologyLogbook(storage,'repro-diagnostics-test');
 book.start(99005);book.record(row,true);
 const csv=book.toCSV();
 assert.ok(csv.includes('reproTemperature'));
 assert.ok(csv.includes('reproNoPartner'));
 assert.ok(csv.includes('courtFailTemperature'));
 assert.ok(csv.includes('meanPreferredTemp'));
});

test('courtship that never gets close enough times out with a recorded failure',()=>{
 const w=new Ecosystem(99006),g={...w.gene(),idealTemp:22,tempTolerance:10};
 w.temperatureAt=()=>22;
 const a=w.spawn(180,160,g),b=w.spawn(230,160,g);
 a.sex='F';b.sex='M';
 for(const u of [a,b]){u.age=120;u.energy=200;u.stage='adult';u.infection=0;u.mateCooldown=0;}
 assert.ok(w.startCourtship(a,b));
 for(let i=0;i<125;i++)w.updateCourtships();
 assert.equal(w.courtships.length,0);
 assert.equal(w.courtshipFailures.stalled,1);
 assert.ok(w.logs.some(e=>e.type==='courtFail'&&e.message.includes('進展しない')));
 const report=observeEcology(w);
 assert.equal(report.courtFailStalled,1);
});

test('starving organisms forage nearby vegetation before entering dormancy',()=>{
 const w=new Ecosystem(9981),g={...w.gene(),aquatic:0,diet:0,idealTemp:0,
  tempTolerance:5,hibernate:1};
 w.tiles.fill(0);w.grass.fill(80);w.water.fill(90);
 const u=w.spawn(212,151,g);
 u.energy=22;u.age=100;u.hp=u.maxHp=1000;
 w.tick=900;w.baseTemperature=22;w.updateTemperature();
 const before=u.energy;
 for(let i=0;i<8;i++)w.step();
 assert.ok(u.forageSuccess>0,'should eat available grass before sleeping');
 assert.ok(u.energy>before,'feeding should restore energy');
});
test('nearby plant target is the accessible edge rather than tile centre',()=>{
 const w=new Ecosystem(9982),g={...w.gene(),aquatic:0,diet:0};
 w.tiles.fill(2);w.grass.fill(0);
 const tile=w.cell(230,150);w.tiles[tile]=0;w.grass[tile]=70;
 const closest=w.nearestGrass(219,151,65,g);
 assert.ok(closest);
 assert.ok(Math.hypot(closest.x-219,closest.y-151)<13);
 const waterTile=w.cell(230,150);
 w.tiles[waterTile]=1;w.water[waterTile]=80;w.waterweed[waterTile]=80;
 const wet=w.nearestWaterweed(219,151,65);
 assert.ok(wet);
 assert.ok(Math.hypot(wet.x-219,wet.y-151)<13);
});
test('climate-adapted dormancy reduces bad-season expenditure but never restores health',()=>{
 const gene={idealTemp:23,tempTolerance:5,hibernate:1,diet:0,aquatic:0};
 const w=new Ecosystem(9983),g={...w.gene(),...gene};
 w.tiles.fill(0);w.grass.fill(90);w.water.fill(95);
 const u=w.spawn(215,160,g);u.age=110;u.energy=150;u.hp=u.maxHp=500;
 w.tick=1900;w.weather='cloudy';w.updateTemperature();
 assert.ok(thermalFitness(u.g,w.temperatureAt(u.x,u.y)).excess>3);
 const initial={hp:u.hp,energy:u.energy,x:u.x,y:u.y};
 for(let i=0;i<25;i++)w.step();
 assert.equal(u.dormant,true);
 assert.equal(u.x,initial.x);assert.equal(u.y,initial.y);
 assert.ok(u.energy<initial.energy);
 assert.ok(u.hp<initial.hp);
 assert.ok(w.logs.some(e=>e.type==='rest'));
 w.tick=2490;w.updateTemperature();w.step();
 assert.equal(u.dormant,false);
 assert.ok(w.logs.some(e=>e.type==='wake'));
});
test('seasonal egg dormancy delays hatching and consumes finite reserves',()=>{
 const w=new Ecosystem(9984);
 w.tiles.fill(0);w.grass.fill(80);w.water.fill(85);
 const cold={...w.gene(),idealTemp:23,tempTolerance:5,shell:1,hibernate:1};
 const ordinary={...cold,shell:0,hibernate:0};
 const eggs=[
  {id:10001,x:210,y:150,g:cold,age:0,hatchAt:45,energy:30,dead:false,parent:1,otherParent:2,generation:1,lineage:'test'},
  {id:10002,x:230,y:150,g:ordinary,age:0,hatchAt:45,energy:30,dead:false,parent:1,otherParent:2,generation:1,lineage:'test'}
 ];
 w.eggs=eggs;
 w.tick=1850;w.weather='cloudy';w.updateTemperature();
 for(let i=0;i<20;i++)w.step();
 assert.ok(eggs[0].dormant);
 assert.ok(eggs[0].age<eggs[1].age);
 assert.ok(eggs[0].energy<30);
 assert.ok(eggs[0].heatExposure<eggs[1].heatExposure);
});
test('dormancy is inherited and mutates without introducing an immortal strategy',()=>{
 const w=new Ecosystem(9985);
 const high={...w.gene(),hibernate:.95},low={...w.gene(),hibernate:.08};
 for(let i=0;i<40;i++){
  const child=w.recombine(high,high);
  assert.ok(child.hibernate>=0&&child.hibernate<=1);
  assert.ok(w.mutate(child).hibernate>=0&&w.mutate(child).hibernate<=1);
 }
 const dormant=w.spawn(200,150,high);
 dormant.stage='adult';dormant.age=100;dormant.energy=140;dormant.hp=20;
 w.tick=1900;w.updateTemperature();
 for(let i=0;i<1000&&!dormant.dead;i++)w.step();
 assert.ok(dormant.dead||dormant.hp<20);
});

test('ecology CSV reports overwintering animals, eggs and foraging history',()=>{
 const w=new Ecosystem(9986),g={...w.gene(),hibernate:1,idealTemp:22,tempTolerance:6};
 const u=w.spawn(210,150,g);
 u.dormant=true;u.forageSuccess=15;u.forageFailure=4;
 w.eggs.push({id:8123,x:210,y:150,g,age:2,dead:false,dormant:true});
 const row=observeEcology(w);
 assert.equal(row.dormantAdults,1);
 assert.equal(row.dormantEggs,1);
 assert.equal(row.forageSuccess,15);
 assert.equal(row.forageFailure,4);
 assert.ok(row.meanHibernate>.9);
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const book=new EcologyLogbook(storage,'forage-dormancy-test');
 book.start(9986);book.record(row,true);
 const csv=book.toCSV();
 assert.ok(csv.includes('dormantAdults'));
 assert.ok(csv.includes('dormantEggs'));
 assert.ok(csv.includes('forageSuccess'));
 assert.ok(csv.includes('forageFailure'));
 assert.ok(csv.includes('meanHibernate'));
});

import {POND_RESERVE} from './simulation.js';
test('permanent natural ponds survive prolonged drought and drinking',()=>{
 const w=new Ecosystem(98017);
 const ids=[...w.tiles].map((t,i)=>t===1?i:-1).filter(i=>i>=0);
 assert.ok(ids.length>0);
 w.rainfall=0;w.stress=100;
 for(const i of ids)w.water[i]=POND_RESERVE;
 for(let step=0;step<1000;step++)w.step();
 for(const i of ids){
  assert.equal(w.tiles[i],1);
  assert.ok(w.water[i]>=POND_RESERVE);
  assert.equal(w.waterbed[i],1);
 }
 const i=ids[0],x=(i%40+.5)*20,y=(Math.floor(i/40)+.5)*20;
 assert.equal(w.consumeWater(x,y,10000),0);
 assert.equal(w.tiles[i],1);
 w.paint(x,y,3,0);
 assert.equal(w.tiles[i],3);
});
test('overwintering eggs can survive winter and hatch in spring without guaranteed immortality',()=>{
 const w=new Ecosystem(98018);
 w.tiles.fill(0);w.grass.fill(90);w.water.fill(70);
 const g={...w.gene(),idealTemp:23,tempTolerance:8,shell:.85,hibernate:.85};
 const egg={id:9818,x:210,y:150,g,age:0,hatchAt:65,energy:18,dead:false,parent:1,otherParent:2,generation:1,lineage:'test'};
 w.eggs.push(egg);
 w.tick=1800;w.weather='cloudy';w.weatherUntil=1e8;w.updateTemperature();
 for(let i=0;i<590;i++)w.step();
 assert.ok(!egg.dead,'winter egg with reserves should survive');
 assert.ok(egg.age<egg.hatchAt,'temperature should postpone hatching');
 assert.ok(egg.energy>0,'reserve is finite');
 w.tick=2400;w.updateTemperature();
 for(let i=0;i<100&&w.eggs.includes(egg);i++)w.step();
 assert.ok(!w.eggs.includes(egg),'egg should hatch when spring is warm');
 assert.ok(w.units.some(u=>u.generation===1));
});

test('high inherited temperature tolerance reduces thermal injury with an upkeep tradeoff',()=>{
 const narrow={idealTemp:22,tempTolerance:8},broad={idealTemp:22,tempTolerance:18};
 const coldNarrow=thermalFitness(narrow,-10),coldBroad=thermalFitness(broad,-10);
 assert.ok(coldBroad.damage<coldNarrow.damage);
 assert.ok(thermalFitness(broad,22).upkeep>thermalFitness(narrow,22).upkeep);
 assert.ok(thermalFitness(broad,22).reproduction);
 assert.equal(thermalFitness(narrow,-10).reproduction,false);
});

test('aquatic founder remains inside permanent pond during wandering and shoreline pursuit',()=>{
 const w=new Ecosystem(20261107);
 const index=[...w.tiles].findIndex((t,i)=>t===1&&i%40>0&&w.tiles[i-1]!==1);
 assert.ok(index>=0,'shore tile exists');
 const x=(index%40+.5)*20,y=(Math.floor(index/40)+.5)*20;
 const g=w.adaptFounderToTerrain(w.gene(),1),u=w.spawn(x,y,g);
 assert.ok(u);assert.equal(u.g.aquatic,1);
 for(let i=0;i<180;i++){
  w.tick++;
  w.navigate(u,{x:x-120,y},Math.PI,4,.28);
  assert.equal(w.terrain(u.x,u.y),1,'aquatic animal must remain in pond');
 }
});
test('rock refuge conceals prey and eggs without guaranteeing immunity',()=>{
 assert.ok(coverFactor(3)<coverFactor(0));
 assert.ok(coverFactor(1,false)<coverFactor(3));
 assert.ok(coverFactor(1,true)>coverFactor(1,false));
});
test('terrestrial carnivores cannot eat submerged eggs, aquatic carnivores can',()=>{
 const w=new Ecosystem(20261108);
 const i=[...w.tiles].findIndex(t=>t===1),x=(i%40+.5)*20,y=(Math.floor(i/40)+.5)*20;
 const g=w.gene(),land=w.spawn(x+180,y,{...g,aquatic:0,diet:1}),
  swimmer=w.spawn(x,y,{...g,aquatic:1,diet:1});
 const egg={id:9999,x,y,g:{...g,aquatic:0,shell:.5},energy:25,dead:false};
 assert.equal(w.eatEgg(egg,land),false);
 assert.equal(egg.dead,false);
 assert.equal(w.eatEgg(egg,swimmer),true);
});

test('score starts at zero and excludes founder species from discoveries',()=>{
 const w=new Ecosystem(20261109);
 assert.deepEqual(w.runScore,{started:false,ended:false,duration:0,discoveries:0,survivalScore:0,discoveryScore:0,balanceScore:0,total:0});
 const result=w.introduce(170,130,1);
 assert.equal(result.types,1);
 assert.equal(w.runScore.started,true);
 assert.equal(w.runScore.discoveries,0);
 for(let i=0;i<10;i++)w.step();
 assert.equal(w.runScore.duration,10);
 assert.equal(w.runScore.survivalScore,10);
});
test('score counts genuinely novel post-founder species with a 300 point bonus',()=>{
 const w=new Ecosystem(20261110);
 w.introduce(170,130,1);
 const founderCount=w.species.size;
 // A newly classified descendant counts once, not once per individual.
 const candidate=w.units[0].g;
 let novel=null;
 for(const trait of [0,1]){
  const trial={...candidate,eyes:trait===0?0:6,diet:trait===0?1:0,aquatic:0};
  if(!w.species.has(w.category(trial))){novel=trial;break;}
 }
 assert.ok(novel);
 w.spawn(180,140,novel,w.units[0]);
 assert.equal(w.species.size,founderCount+1);
 assert.equal(w.runScore.discoveryScore,300);
 w.spawn(185,140,novel,w.units[0]);
 assert.equal(w.runScore.discoveryScore,300);
});
test('extinction score freezes only after every egg is lost',()=>{
 const w=new Ecosystem(20261111);w.introduce(170,130,1);
 const parent=w.units[0],egg={id:99999,x:parent.x,y:parent.y,g:parent.g,
  parent:parent.id,otherParent:null,generation:1,lineage:parent.lineage,
  age:0,hatchAt:100000,energy:10,dead:false};
 w.eggs.push(egg);
 for(const u of w.units)w.die(u,'test');
 w.units=[];
 w.step();
 assert.equal(w.runScore.ended,false);
 egg.dead=true;
 w.step();
 assert.equal(w.runScore.ended,true);
 const finalScore=w.runScore.total;
 w.step();assert.equal(w.runScore.total,finalScore);
});

import {GameSession,parseMeta,settleMeta} from './game-mode.js';
test('game begins with one founding species and only one introduction',()=>{
 const w=new Ecosystem(4001),run=new GameSession(w);
 assert.equal(run.start(170,130),true);
 assert.equal(run.points,15);
 assert.equal(w.introducedCount,8);
 assert.equal(run.start(170,130),false);
 assert.equal(w.introducedCount,8);
});
test('paid actions require enough points, preserve terrain and reject repeat after extinction',()=>{
 const w=new Ecosystem(4002),run=new GameSession(w);
 assert.equal(run.intervene('rain'),false);
 assert.equal(run.start(170,130),true);
 assert.equal(run.intervene('seed',170,130),[0,1,2].includes(w.terrain(170,130)));
 const remaining=run.points;
 assert.equal(run.intervene('seed',-1,-1),false);
 assert.equal(run.points,remaining);
 assert.equal(run.intervene('rain'),remaining>=8);
 assert.equal(run.points,remaining-(remaining>=8?8:0));
 assert.equal(run.intervene('fertilize',170,130),false);
 run.finished=true;
 assert.equal(run.intervene('rain'),false);
});
test('survival points are earned only at milestones and cannot be farmed by repeated observation',()=>{
 const w=new Ecosystem(4003),run=new GameSession(w);run.start(170,130);
 w.tick=300;run.observe();
 assert.equal(run.points,20);
 run.observe();assert.equal(run.points,20);
 w.tick=600;run.observe();assert.equal(run.points,33);
 run.observe();assert.equal(run.points,33);
});
test('game completion settles lifetime reward once and keeps it across new runs',()=>{
 const w=new Ecosystem(4004),run=new GameSession(w);run.start(170,130);
 w.tick=2500;
 for(const u of w.units)w.die(u,'test');
 w.units=[];w.eggs=[];w.runEndedTick=2500;
 run.observe();assert.equal(run.finished,true);
 assert.equal(run.reward,Math.floor(w.runScore.total/1000));
 const old=parseMeta('{"bank":3,"best":600,"runs":2}');
 const next=settleMeta(old,run);
 assert.equal(next.bank,3+run.reward);assert.equal(next.runs,3);
 assert.equal(parseMeta(JSON.stringify(next)).bank,next.bank);
 run.reset();assert.deepEqual(settleMeta(next,run),next);
});

test('closed eyes are straight tangents to their body outline and follow body rotation',async()=>{
 const {closedEyeTangent}=await import('./renderer.js');
 const close=(v,w)=>Math.abs(v-w)<1e-9;
 const forward=closedEyeTangent(0,12,7),side=closedEyeTangent(Math.PI/2,12,7);
 assert.ok(close(forward.x,0)&&close(forward.y,1),'front eye must close vertically in body space');
 assert.ok(close(side.x,-1)&&close(side.y,0),'side eye must close horizontally in body space');
 const w=new Ecosystem(2026110701);w.units=[];w.eggs=[];w.corpses=[];
 const u=w.spawn(300,200,{...w.gene(),eyes:1});u.angle=Math.PI/2;u.dormant=true;
 const rotations=[],segments=[];let px=0,py=0;
 const ctx=new Proxy({canvas:{width:800,height:460},createRadialGradient:()=>({addColorStop(){}}),
  rotate(angle){rotations.push(angle);},
  moveTo(x,y){px=x;py=y;},
  lineTo(x,y){segments.push({from:[px,py],to:[x,y]});}},
  {get(o,k){return k in o?o[k]:()=>{};},set(o,k,v){o[k]=v;return true;}});
 drawWorld(ctx,w,false);
 assert.ok(rotations.some(a=>close(a,Math.PI/2)),'body rotates normally');
 assert.ok(!rotations.some(a=>close(a,-Math.PI/2)),'eyes must not cancel body rotation');
 assert.ok(segments.some(s=>close(s.from[0],s.to[0])&&s.from[1]!==s.to[1]),'tangent at front draws a vertical local stroke');
});

test('inherited dispersal and sociability remain independent and bounded',()=>{
 const w=new Ecosystem(202611071);
 const mother=w.gene(),father=w.gene();
 mother.dispersal=.95;mother.sociability=.05;
 father.dispersal=.05;father.sociability=.95;
 for(const g of [mother,father]){
  g.alleles.dispersal=[g.dispersal,g.dispersal];
  g.alleles.sociability=[g.sociability,g.sociability];
 }
 const child=w.recombine(mother,father);
 for(const key of ['dispersal','sociability']){
  assert.ok(child[key]>=0&&child[key]<=1);
  assert.ok(Array.isArray(child.alleles[key])&&child.alleles[key].length===2);
 }
 for(let i=0;i<100;i++){
  const m=w.mutate(w.gene());
  assert.ok(m.dispersal>=0&&m.dispersal<=1);
  assert.ok(m.sociability>=0&&m.sociability<=1);
 }
});
test('dispersal tendency lowers tolerance to crowding while sociability raises it',async()=>{
 const {dispersalPressureThreshold}=await import('./simulation.js');
 const avoid=dispersalPressureThreshold({dispersal:1,sociability:0});
 const stay=dispersalPressureThreshold({dispersal:0,sociability:1});
 assert.ok(avoid<stay);
 assert.ok(dispersalPressureThreshold({dispersal:.5,sociability:1})>
   dispersalPressureThreshold({dispersal:.5,sociability:0}));
});
test('well-fed sociable organisms seek a distant conspecific without being forced into contact',()=>{
 const w=new Ecosystem(202611072);
 w.tiles.fill(0);w.grass.fill(100);
 const g={...w.gene(),aquatic:0,diet:0,sociability:1,dispersal:0,
  idealTemp:22,tempTolerance:18};
 const a=w.spawn(180,200,g),b=w.spawn(265,200,g);
 a.sex=b.sex='M';a.energy=b.energy=175;
 a.hp=b.hp=10000;a.maxHp=b.maxHp=10000;
 w.climateEnabled=false;w.baseTemperature=22;w.temperature=22;
 w.tick=29;w.rand=()=>0;
 w.step();
 assert.equal(a.socialTarget?.id,b.id);
 assert.equal(a.refugeTarget,null);
 assert.ok((a.x-b.x)**2+(a.y-b.y)**2>30**2,'not an overlapping swarm');
});

test('well-fed breeding adults pursue mates over nearby food and social targets',()=>{
 const w=new Ecosystem(2026110715);
 w.tiles.fill(0);w.grass.fill(100);w.water.fill(100);
 const gene={...w.gene(),aquatic:0,diet:0,idealTemp:22,tempTolerance:15,
  sociability:1,dispersal:0,guard:1};
 const a=w.spawn(190,215,gene),b=w.spawn(250,215,{...gene});
 a.sex='F';b.sex='M';
 for(const u of [a,b]){u.stage='adult';u.age=110;u.energy=220;u.hp=u.maxHp=5000;u.mateCooldown=0;u.infection=0;}
 w.temperatureAt=()=>22;
 assert.equal(w.isReadyToMate(a),true);
 assert.equal(w.findMate(a,[a,b]),b);
 // A much closer food target must not win over a mate.
 w.nearestGrass=()=>({x:192,y:215});
 let chosen;
 w.navigate=(u,target)=>{if(u===a)chosen=target;return 'moved';};
 w.step();
 assert.equal(chosen,b,'mate must supersede convenient food when reserves are sufficient');
});
test('release manifest version is a valid nonempty fixed-format string',async()=>{
 const {readFileSync}=await import('node:fs');
 const manifest=JSON.parse(readFileSync(new URL('./version.json',import.meta.url),'utf8'));
 assert.match(manifest.version,/^\d{4}\.\d{2}\.\d{2}\.\d+$/);
 assert.ok(manifest.description.length>0);
});

test('mate pursuit is stable across frames instead of repeatedly changing partners',()=>{
 const w=new Ecosystem(2026110731);
 w.tiles.fill(0);w.grass.fill(100);
 const g={...w.gene(),aquatic:0,repro:0,idealTemp:22,tempTolerance:18};
 const a=w.spawn(180,190,g),b=w.spawn(275,190,g),c=w.spawn(300,190,g);
 a.sex='F';b.sex=c.sex='M';
 for(const u of [a,b,c]){u.age=110;u.energy=200;u.stage='adult';u.infection=0;u.mateCooldown=0;u.hp=u.maxHp=500;}
 w.temperatureAt=()=>22;w.tick=20;
 const first=w.findMate(a,[a,b,c]);
 assert.equal(first,b);
 assert.equal(w.mateApproachStarts,1);
 // A different partner becomes temporarily closer: don't lose original intent.
 c.x=190;
 const again=w.findMate(a,[a,b,c]);
 assert.equal(again,b);
 assert.equal(w.mateApproachStarts,1);
 // A missing partner is forgotten and the eligible replacement is pursued.
 b.dead=true;
 const replacement=w.findMate(a,[a,b,c]);
 assert.equal(replacement,c);
 assert.equal(w.mateApproachStarts,2);
});
test('courtship energy reserve prevents immediate cancellation but not starvation',()=>{
 const w=new Ecosystem(2026110732);
 const g={...w.gene(),aquatic:0,repro:0,idealTemp:22,tempTolerance:18};
 const a=w.spawn(180,190,g),b=w.spawn(186,190,g);
 a.sex='F';b.sex='M';w.temperatureAt=()=>22;
 for(const u of [a,b]){u.age=120;u.energy=200;u.stage='adult';u.hp=u.maxHp=800;u.mateCooldown=0;}
 assert.equal(w.startCourtship(a,b),true);
 const min=68+Math.max(0,organismMorphology(a).bodyMass-100)*.22+(a.crowdStress??0)*3.1+(a.habitatLoad??0)*4.2;
 a.energy=min-8;
 assert.equal(w.reproductionBlockReason(a),null,'paired animals have a small energy reserve');
 a.energy=min-16;
 assert.equal(w.reproductionBlockReason(a),'energy','reserve does not permit starvation');
});

test('individual reproductive diagnosis identifies energy threshold, mate distance and pursuit',()=>{
 const w=new Ecosystem(2026110733);
 w.tiles.fill(0);
 const g={...w.gene(),aquatic:0,idealTemp:22,tempTolerance:18,repro:0};
 const a=w.spawn(150,180,g),b=w.spawn(210,180,g);
 a.sex='F';b.sex='M';w.temperatureAt=()=>22;
 for(const u of [a,b]){u.age=120;u.energy=150;u.stage='adult';u.mateCooldown=0;u.hp=u.maxHp=500;}
 a.mateTarget={id:b.id,until:150,since:30};a.behaviorTarget='mate';w.tick=42;
 const d=w.reproductionDiagnostic(a);
 assert.equal(d.id,a.id);assert.equal(d.reason,'ready');assert.equal(d.target,'mate');
 assert.equal(d.mateId,b.id);assert.equal(d.mateDistance,60);assert.equal(d.approachSteps,12);
 assert.ok(d.energy>d.required);
 a.energy=d.required-1;
 assert.equal(w.reproductionDiagnostic(a).reason,'energy');
 assert.equal(w.reproductionDiagnostic(a).energy,+a.energy.toFixed(2));
});
test('individual reproductive diagnosis is read-only',()=>{
 const w=new Ecosystem(2026110734);
 const u=w.spawn(180,180,w.gene());
 const before=w.rng,oldX=u.x,oldY=u.y;
 const one=w.reproductionDiagnostic(u),two=w.reproductionDiagnostic(u);
 assert.deepEqual(one,two);assert.equal(w.rng,before);
 assert.equal(u.x,oldX);assert.equal(u.y,oldY);
});
test('individual reproduction CSV records per-organism observations',async()=>{
 const {EcologyLogbook,INDIVIDUAL_DIAG_FIELDS}=await import('./ecology-log.js');
 const storage={data:new Map(),getItem(k){return this.data.get(k)},setItem(k,v){this.data.set(k,v)}};
 const logs=new EcologyLogbook(storage,'2026.11.07.3');
 const w=new Ecosystem(2026110735);
 w.spawn(150,160,w.gene());w.tick=50;logs.start(w.initialSeed);
 assert.equal(logs.recordIndividuals(w),true);
 assert.ok(logs.toIndividualCSV().includes('required'));
 assert.ok(logs.toIndividualCSV().includes('mateDistance'));
 assert.ok(logs.toIndividualCSV().includes('approachFailures'));
 assert.equal(logs.data.runs[0].individuals.length,1);
 assert.equal(logs.data.runs[0].individuals[0].id,w.units[0].id);
 assert.ok(INDIVIDUAL_DIAG_FIELDS.length>10);
});

test('one-click ZIP archive contains all ecology and individual CSVs intact',async()=>{
 const {zipFiles}=await import('./zip-log.js');
 const files=[['ecology.csv','run,step\r\n1,50\r\n'],['individual.csv','id,reason\r\n1,ready\r\n']];
 const blob=zipFiles(files),bytes=new Uint8Array(await blob.arrayBuffer());
 const view=new DataView(bytes.buffer),decoder=new TextDecoder();
 assert.equal(blob.type,'application/zip');
 let pos=0;
 for(const [name,content] of files){
  assert.equal(view.getUint32(pos,true),0x04034b50);
  const size=view.getUint32(pos+18,true),namelen=view.getUint16(pos+26,true);
  const extra=view.getUint16(pos+28,true);
  const actualName=decoder.decode(bytes.subarray(pos+30,pos+30+namelen));
  const actual=decoder.decode(bytes.subarray(pos+30+namelen+extra,pos+30+namelen+extra+size));
  assert.equal(actualName,name);assert.equal(actual,content);
  pos+=30+namelen+extra+size;
 }
 assert.equal(view.getUint32(pos,true),0x02014b50,'ZIP central directory');
 assert.equal(view.getUint32(bytes.length-22,true),0x06054b50,'ZIP end record');
 assert.equal(view.getUint16(bytes.length-22+10,true),2);
});

test('a compatible active suitor does not cause predator-signal flight',()=>{
 const w=new Ecosystem(2026110801);w.tiles.fill(0);w.grass.fill(100);
 const g={...w.gene(),diet:.08,deception:1,aquatic:0,idealTemp:22,tempTolerance:18,
  sociability:.6,guard:0,eyes:2,r:5};
 const recipient=w.spawn(200,180,g),suitor=w.spawn(226,180,{...g});
 recipient.sex='F';suitor.sex='M';
 for(const u of [recipient,suitor]){
  u.age=120;u.energy=200;u.hp=u.maxHp=1000;u.mateCooldown=0;u.infection=0;
 }
 w.temperatureAt=()=>22;
 assert.ok(dietProfile(suitor.g).signal>.48,'the apparent predator signal must be present');
 assert.equal(w.canMate(recipient,suitor),true);
 suitor.mateTarget={id:recipient.id,until:120,since:0};
 w.tick=10;
 w.step();
 assert.equal(recipient.fleeing,false,'recipient must not flee from its legitimate active suitor');
});
test('unrelated predatory signals still trigger flight during courtship approach',()=>{
 const w=new Ecosystem(2026110802);w.tiles.fill(0);w.grass.fill(100);
 const g={...w.gene(),diet:.08,deception:1,aquatic:0,idealTemp:22,tempTolerance:18,
  sociability:.6,guard:0,eyes:2,r:5};
 const recipient=w.spawn(200,180,g),suitor=w.spawn(235,180,{...g});
 const threat=w.spawn(205,180,{...g,repro:0});
 recipient.sex='F';suitor.sex='M';threat.sex='F';
 for(const u of [recipient,suitor,threat]){
  u.age=120;u.energy=200;u.hp=u.maxHp=1000;u.mateCooldown=0;u.infection=0;
 }
 w.temperatureAt=()=>22;
 suitor.mateTarget={id:recipient.id,until:120,since:0};
 w.tick=10;
 recipient.threatDecisions.set(threat.id,{flee:true});
 w.step();
 assert.equal(recipient.fleeing,true,'third-party threat must continue to cause flight');
});
test('receptive adults can refuse courtship and later accept after recovering',()=>{
 const w=new Ecosystem(2026110803);w.tiles.fill(0);
 const g={...w.gene(),aquatic:0,idealTemp:22,tempTolerance:18,sociability:0,r:4};
 const initiator=w.spawn(200,180,g),recipient=w.spawn(210,180,{...g});
 initiator.sex='M';recipient.sex='F';w.temperatureAt=()=>22;
 for(const u of [initiator,recipient]){
  u.age=120;u.energy=200;u.hp=u.maxHp=1000;u.mateCooldown=0;
 }
 recipient.energy=84;
 assert.equal(w.canMate(initiator,recipient),true,'eligible recipient is not obligated to agree');
 initiator.mateTarget={id:recipient.id,until:100,since:0};
 assert.equal(w.startCourtship(initiator,recipient),false);
 assert.equal(w.courtshipStarts,0);
 assert.equal(initiator.rejectedBy.id,recipient.id);
 assert.equal(w.findMate(initiator,[initiator,recipient]),null,'rejected partner is avoided for a while');
 assert.ok(w.logs.some(e=>e.type==='courtReject'));
 w.tick=100;recipient.energy=200;
 assert.equal(w.startCourtship(initiator,recipient),true);
 assert.equal(initiator.courtPartner,recipient.id);
});

test('juvenile ignores harmless parent and lineage predator-like disguises',async()=>{
 const {suppressFearSignal}=await import('./simulation.js');
 const w=new Ecosystem(2026110804);
 const g={...w.gene(),diet:.08,deception:1,jaw:.2,mouths:1,aquatic:0};
 const parent=w.spawn(200,180,g),child=w.spawn(212,180,{...g},parent);
 const sibling=w.spawn(220,180,{...g},parent);
 child.stage='juvenile';child.energy=60;
 assert.equal(suppressFearSignal(child,parent,12**2,false),true);
 assert.equal(suppressFearSignal(child,sibling,8**2,false),true);
 child.stage='adult';
 assert.equal(suppressFearSignal(child,parent,12**2,false),false,
  'harmless-looking relatives are not permanently exempt once adult');
});
test('a related true carnivore remains a danger even to juveniles',async()=>{
 const {suppressFearSignal}=await import('./simulation.js');
 const w=new Ecosystem(2026110805);
 const g={...w.gene(),diet:.08,deception:1,jaw:.8,mouths:2,aquatic:0};
 const parent=w.spawn(200,180,g),child=w.spawn(220,180,{...g},parent);
 child.stage='juvenile';child.energy=5;
 parent.g.diet=.95;
 assert.equal(suppressFearSignal(child,parent,20**2,true),false);
});
test('starving slimes eat despite distant bluff signals but still flee immediate danger',async()=>{
 const {suppressFearSignal}=await import('./simulation.js');
 const w=new Ecosystem(2026110806);
 const g={...w.gene(),diet:.08,deception:1,jaw:.2,mouths:1,aquatic:0};
 const hungry=w.spawn(200,180,g),bluffer=w.spawn(267,180,{...g});
 hungry.stage='juvenile';hungry.energy=12;
 assert.equal(suppressFearSignal(hungry,bluffer,67**2,true),true);
 assert.equal(suppressFearSignal(hungry,bluffer,33**2,true),false);
 assert.equal(suppressFearSignal(hungry,bluffer,67**2,false),false);
 hungry.energy=65;
 assert.equal(suppressFearSignal(hungry,bluffer,67**2,true),false);
});
test('starving child feeds near deceptive family without losing predator-signal escape',()=>{
 const w=new Ecosystem(2026110807);w.tiles.fill(0);w.grass.fill(100);
 const g={...w.gene(),diet:.08,deception:1,jaw:.2,mouths:1,aquatic:0,
  idealTemp:22,tempTolerance:18,guard:0,eyes:2,r:5};
 const parent=w.spawn(205,180,g),child=w.spawn(208,180,{...g},parent);
 child.stage='juvenile';child.energy=15;child.hp=child.maxHp=1000;
 parent.energy=160;parent.hp=parent.maxHp=1000;
 w.temperatureAt=()=>22;
 w.step();
 assert.equal(child.fleeing,false,'harmless parent does not cause flight');
 assert.ok(child.energy>15,'feeding should increase energy for hungry child');
});

test('behavioral genes are bounded, inherited, and recombined',async()=>{
 const {threatFlightProbability,retaliationProbability}=await import('./simulation.js');
 const w=new Ecosystem(2026110808);
 const a=w.gene(),b=w.gene();
 for(const key of ['caution','predatorSense','retaliation']){
  assert.ok(a[key]>=0&&a[key]<=1);
  assert.equal(a.alleles[key].length,2);
 }
 const child=w.recombine(a,b);
 for(const key of ['caution','predatorSense','retaliation']){
  assert.ok(child[key]>=0&&child[key]<=1);
  assert.ok(child[key]>=Math.min(a[key],b[key])-.001&&child[key]<=Math.max(a[key],b[key])+.001);
 }
 const x=w.spawn(100,100,{...a,caution:0,predatorSense:0,retaliation:0});
 const y=w.spawn(110,100,{...b,diet:1,deception:1});
 assert.equal(threatFlightProbability(x,y),0);
 assert.equal(retaliationProbability(x,y),0);
 x.g.caution=1;x.g.predatorSense=1;x.g.retaliation=1;
 assert.ok(threatFlightProbability(x,y)>.5);
 assert.ok(retaliationProbability(x,y)>0);
});
test('one threat response is retained across a continuous encounter',()=>{
 const w=new Ecosystem(2026110809);w.tiles.fill(0);w.grass.fill(80);
 const g={...w.gene(),aquatic:0,idealTemp:22,tempTolerance:18,
  diet:0,deception:.5,caution:0,predatorSense:0};
 const u=w.spawn(180,180,g),v=w.spawn(212,180,{...g,diet:.9,deception:1});
 u.sex=v.sex='F';
 u.energy=v.energy=150;u.hp=u.maxHp=v.hp=v.maxHp=1500;
 w.temperatureAt=()=>22;
 w.step();
 const first=u.threatDecisions.get(v.id);
 assert.equal(first?.flee,false);
 for(let i=0;i<10;i++)w.step();
 assert.equal(u.threatDecisions.get(v.id),first,'the same encounter should not reroll');
});
test('a received attack causes genetically chosen flight or retaliation',()=>{
 const w=new Ecosystem(2026110810);w.tiles.fill(0);w.grass.fill(80);
 const g={...w.gene(),aquatic:0,diet:0,idealTemp:22,tempTolerance:18,r:5,
  jaw:1.8,mouths:2};
 const victim=w.spawn(160,180,{...g,retaliation:0}),attacker=w.spawn(168,180,{...g,diet:1});
 victim.hp=victim.maxHp=attacker.hp=attacker.maxHp=1500;
 victim.energy=attacker.energy=160;
 w.temperatureAt=()=>22;
 assert.equal(w.attack(attacker,victim),true);
 assert.equal(victim.attackResponse.retaliate,false);
 w.step();
 assert.equal(victim.fleeing,true);
 const other=new Ecosystem(2026110811);other.tiles.fill(0);other.grass.fill(80);
 const responder=other.spawn(160,180,{...g,retaliation:1}),
  enemy=other.spawn(168,180,{...g,diet:1});
 responder.hp=responder.maxHp=enemy.hp=enemy.maxHp=1500;
 responder.energy=enemy.energy=160;
 responder.age=100;enemy.age=100;other.temperatureAt=()=>22;
 responder.attackResponse={id:enemy.id,retaliate:true,until:30};
 other.tick=10;
 other.step();
 assert.ok(enemy.hp<1500,'counterattack must inflict damage');
 assert.ok(other.logs.some(e=>e.message.includes('反撃')));
});

test('water-bound slimes never pursue weeds across disconnected ponds',()=>{
 const w=new Ecosystem(2026110812);
 w.tiles.fill(2);w.grass.fill(0);w.water.fill(0);w.waterweed.fill(0);
 // Two disconnected ponds, separated by impassable land for aquatic organisms.
 const a=w.cell(210,210),b=w.cell(350,210);
 w.tiles[a]=w.tiles[b]=1;w.water[a]=w.water[b]=100;w.waterweed[b]=95;
 assert.equal(w.nearestWaterweed(210,210,165),null);
 w.waterweed[a]=8;
 const local=w.nearestWaterweed(210,210,165);
 assert.ok(local&&w.cell(local.x,local.y)===a,'pond-local edible weed is reachable');
 w.waterweed[a]=0;
 // A same-step painted connection must invalidate cached region labels.
 for(let x=230;x<=330;x+=20)w.paint(x,210,1,0);
 w.waterweed[b]=95;
 assert.ok(w.nearestWaterweed(210,210,165),'connected pond permits food-seeking');
});
test('starving oversized adult sheds maintenance-heavy bulk without free energy',()=>{
 const w=new Ecosystem(2026110813);
 w.tiles.fill(0);w.grass.fill(0);w.water.fill(0);
 const g={...w.gene(),aquatic:0,diet:0,idealTemp:22,tempTolerance:18};
 const u=w.spawn(210,180,g);
 u.stage='adult';u.age=100;u.energy=0;u.growthScale=2.5;
 u.hp=u.maxHp=2000;w.temperatureAt=()=>22;
 w.step();
 assert.ok(u.growthScale<2.49,'catabolism must respond before large animals starve');
 assert.equal(u.energy,0,'shrinking must not generate calories');
 assert.ok(u.hp<2000,'shrinking must not heal damage');
});

test('new ecological genes inherit, recombine, mutate and bound correctly',async()=>{
 const {metabolicFrugality,adultGrowthCeiling,frugalityMaintenanceFactor}=await import('./simulation.js');
 const w=new Ecosystem(2026110820),mother=w.gene(),father=w.gene();
 for(const key of ['frugality','waterGardening']){
  assert.ok(mother[key]>=0&&mother[key]<=1);
  assert.equal(mother.alleles[key].length,2);
 }
 for(let i=0;i<80;i++){
  const child=w.recombine(mother,father),mut=w.mutate(child);
  for(const key of ['frugality','waterGardening']){
   assert.ok(mut[key]>=0&&mut[key]<=1);
   assert.equal(mut.alleles[key].length,2);
  }
 }
 assert.equal(metabolicFrugality({frugality:1}),1);
 assert.ok(frugalityMaintenanceFactor({frugality:1})<frugalityMaintenanceFactor({frugality:0}));
 assert.ok(adultGrowthCeiling({frugality:1})<adultGrowthCeiling({frugality:0}));
});
test('high-efficiency phenotype is more vulnerable to attack',()=>{
 const w=new Ecosystem(2026110821),g=w.gene();
 const preyA=w.spawn(100,100,{...g,frugality:0}),preyB=w.spawn(120,100,{...g,frugality:1});
 const predator=w.spawn(110,110,{...g,diet:1});
 for(const u of [preyA,preyB,predator]){u.hp=u.maxHp=1000;u.age=100;u.energy=160;}
 assert.equal(w.attack(predator,preyA),true);
 predator.bite=0;
 assert.equal(w.attack(predator,preyB),true);
 assert.ok(preyB.hp<preyA.hp,'high-efficiency prey suffers more damage');
});
test('gardeners plant only reachable water beds using acquired propagules and energy',()=>{
 const w=new Ecosystem(2026110822);
 w.tiles.fill(2);w.grass.fill(0);w.water.fill(0);w.waterweed.fill(0);
 const home=w.cell(210,210),target=w.cell(230,210),other=w.cell(350,210);
 for(const id of [home,target,other]){w.tiles[id]=1;w.water[id]=90;}
 const g={...w.gene(),aquatic:1,diet:0,waterGardening:1};
 const gardener=w.spawn(210,210,g);
 gardener.waterSeedBank=2;gardener.energy=140;w.tick=50;
 const before=w.waterweed[target]+w.waterweed[home];
 assert.equal(w.plantWaterweed(gardener),true);
 assert.ok(w.waterweed[target]+w.waterweed[home]>before);
 assert.equal(w.waterweed[other],0);
 assert.ok(gardener.energy<140&&gardener.waterSeedBank<2);
 assert.equal(w.plantWaterweed(gardener),false,'planting has a cooldown');
 gardener.waterSeedBank=0;w.tick=100;
 assert.equal(w.plantWaterweed(gardener),false,'planting cannot create free propagules');
});
test('planting remains unavailable to terrestrial organisms and low-garden genotypes',()=>{
 const w=new Ecosystem(2026110823);
 w.tiles.fill(1);w.water.fill(90);w.waterweed.fill(0);
 const a=w.spawn(180,180,{...w.gene(),aquatic:0,waterGardening:1});
 const b=w.spawn(200,180,{...w.gene(),aquatic:1,waterGardening:0});
 for(const u of [a,b]){u.waterSeedBank=5;u.energy=180;}
 assert.equal(w.plantWaterweed(a),false);
 assert.equal(w.plantWaterweed(b),false);
});

test('dietary innovation occasionally produces heritable carnivorous offspring',()=>{
 const w=new Ecosystem(2026110824),g=w.gene();
 g.diet=.60;g.alleles.diet=[.60,.60];
 let novel=null;
 for(let i=0;i<500;i++){
  const descendant=w.recombine(g,g);
  if(descendant.diet>.72){novel=descendant;break;}
 }
 assert.ok(novel,'rare diet innovations should create an opportunity for carnivory');
 assert.equal(novel.alleles.diet.length,2);
 assert.ok(novel.diet>.72);
});
test('ecology logs capture newly evolving resource strategies',async()=>{
 const {observeEcology,ECOLOGY_LOG_FIELDS}=await import('./ecology-log.js');
 const w=new Ecosystem(2026110825);
 const g={...w.gene(),frugality:.9,waterGardening:.85,aquatic:1};
 w.spawn(100,100,g);
 w.waterPlantings=3;
 const sample=observeEcology(w);
 assert.equal(sample.frugalAdults,1);
 assert.equal(sample.aquaticGardeners,1);
 assert.equal(sample.waterPlantings,3);
 assert.ok(sample.meanFrugality>.8);
 for(const name of ['frugalAdults','aquaticGardeners','waterPlantings','meanFrugality','meanWaterGardening'])
  assert.ok(ECOLOGY_LOG_FIELDS.includes(name));
});

test('acquired land acclimation increases with exposure and decays in water without changing genes',async()=>{
 const {landAcclimationGain,experiencedTerrainFitness}=await import('./simulation.js');
 const w=new Ecosystem(2026110826),g={...w.gene(),aquatic:1};
 const u=w.spawn(210,210,g),original=JSON.stringify(u.g);
 const before=experiencedTerrainFitness(u,0);
 for(let i=0;i<250;i++)u.landAcclimation=landAcclimationGain(u,true);
 assert.ok(u.landAcclimation>.5&&u.landAcclimation<=.72);
 assert.ok(experiencedTerrainFitness(u,0).move>before.move);
 const learned=u.landAcclimation;
 for(let i=0;i<80;i++)u.landAcclimation=landAcclimationGain(u,false);
 assert.ok(u.landAcclimation<learned);
 assert.equal(JSON.stringify(u.g),original,'acquired traits are not inherited mutations');
});
test('aquatic animals identify a grassy shoreline only if connected to their pond',()=>{
 const w=new Ecosystem(2026110827);
 w.tiles.fill(2);w.grass.fill(0);w.water.fill(0);
 const center=w.cell(210,210),shore=w.cell(230,210),other=w.cell(350,210);
 w.tiles[center]=1;w.water[center]=100;
 w.tiles[shore]=0;w.grass[shore]=70;
 w.tiles[other]=0;w.grass[other]=100;
 assert.equal(w.nearestEdibleShore(210,210,150)?.x,230);
 w.grass[shore]=0;
 assert.equal(w.nearestEdibleShore(210,210,150),null);
});

test('starvation unlocks cannibal hunting in weakly carnivorous genotypes',async()=>{
 const {famineCannibalism,effectiveMeatAffinity}=await import('./simulation.js');
 const w=new Ecosystem(2026110829),g={...w.gene(),diet:.10,jaw:1.7,mouths:2,aquatic:0};
 const u=w.spawn(180,190,g);
 u.stage='adult';u.energy=20;
 assert.equal(famineCannibalism(u),true);
 assert.ok(effectiveMeatAffinity(u)>0);
 u.energy=90;
 assert.equal(famineCannibalism(u),false);
 u.stage='juvenile';u.energy=12;
 assert.equal(famineCannibalism(u),false);
});
test('eating flesh gradually changes an individual without altering offspring genes',async()=>{
 const {learnCarnivory,carnivoryExperience,effectiveMeatAffinity}=await import('./simulation.js');
 const w=new Ecosystem(2026110830),g={...w.gene(),diet:.12};
 const u=w.spawn(200,190,g),genome=JSON.stringify(u.g);
 const base=effectiveMeatAffinity(u);
 for(let i=0;i<15;i++)learnCarnivory(u,8);
 assert.ok(carnivoryExperience(u)>.20);
 assert.ok(effectiveMeatAffinity(u)>base);
 assert.equal(JSON.stringify(u.g),genome,'learned habits do not mutate genome');
 const child=w.spawn(205,190,u.g,u);
 assert.equal(child.carnivoryExperience,0,'offspring does not inherit acquired adaptation');
});
test('conspecific kill records cannibal meal and raises digestive acclimation',()=>{
 const w=new Ecosystem(2026110831),g={...w.gene(),aquatic:0,diet:.12,
  jaw:2,mouths:2,r:5};
 const hunter=w.spawn(190,190,g),prey=w.spawn(197,190,{...g});
 hunter.energy=12;hunter.age=120;hunter.stage='adult';prey.hp=1;
 assert.equal(w.attack(hunter,prey),true);
 assert.equal(prey.dead,true);
 assert.equal(w.cannibalMeals,1);
 assert.ok(hunter.carnivoryExperience>0);
});
test('an experienced eater pays energy upkeep and gradually forgets without flesh',()=>{
 const w=new Ecosystem(2026110832);w.tiles.fill(0);w.grass.fill(0);
 const g={...w.gene(),aquatic:0,diet:.10,idealTemp:22,tempTolerance:18};
 const u=w.spawn(200,190,g);
 u.carnivoryExperience=.4;u.hp=u.maxHp=5000;u.energy=100;
 w.temperatureAt=()=>22;
 w.step();
 assert.ok(u.carnivoryExperience<.4,'acclimation decays when meat is absent');
});
test('ecology reports acquired carnivory separately from inherited diet',async()=>{
 const {observeEcology}=await import('./ecology-log.js');
 const w=new Ecosystem(2026110833),g={...w.gene(),diet:.12};
 const u=w.spawn(200,190,g);u.carnivoryExperience=.7;w.cannibalMeals=4;
 const snapshot=observeEcology(w);
 assert.equal(snapshot.learnedCarnivores,1);
 assert.equal(snapshot.cannibalMeals,4);
 assert.ok(snapshot.meanCarnivoryExperience>.65);
 assert.equal(snapshot.carnivores,0,'inherited diet classification stays unchanged');
});

test('a pure herbivore may resort to cannibalism only under extreme famine',async()=>{
 const {famineCannibalism,effectiveMeatAffinity,effectivePlantAffinity}=await import('./simulation.js');
 const w=new Ecosystem(2026110834),g={...w.gene(),diet:0,jaw:1.6,mouths:2};
 const u=w.spawn(210,210,g);u.stage='adult';
 u.energy=70;assert.equal(famineCannibalism(u),false);
 assert.equal(effectiveMeatAffinity(u),0);
 u.energy=15;assert.equal(famineCannibalism(u),true);
 assert.ok(effectiveMeatAffinity(u)>0,'emergency minimal meat digestion enables learning');
 assert.equal(effectivePlantAffinity(u),1);
});
test('learned carnivore can exceed inherited meat affinity but pays a plant-digestion tradeoff',async()=>{
 const {effectiveMeatAffinity,effectivePlantAffinity}=await import('./simulation.js');
 const w=new Ecosystem(2026110835),u=w.spawn(210,210,{...w.gene(),diet:0});
 u.energy=130;
 const plant=effectivePlantAffinity(u);
 u.carnivoryExperience=.85;
 assert.ok(effectiveMeatAffinity(u)>.7,'successful acclimation becomes functionally carnivorous');
 assert.ok(effectivePlantAffinity(u)<plant,'specialization makes plant food less rewarding');
 assert.equal(u.g.diet,0,'acclimation cannot alter inherited diet');
});
test('acquired carnivores are counted separately from genotypic carnivores',async()=>{
 const {observeEcology}=await import('./ecology-log.js');
 const w=new Ecosystem(2026110836),u=w.spawn(200,190,{...w.gene(),diet:0});
 u.carnivoryExperience=.85;u.energy=130;
 const observed=observeEcology(w);
 assert.equal(observed.acquiredCarnivores,1);
 assert.equal(observed.carnivores,0);
});

test('compact slimes move more slowly than their pre-shrink size would imply',()=>{
 const w=new Ecosystem(2026110849);
 const small={...w.gene(),r:4,elongation:1,eyes:2};
 const baseline=3.45/(.65+small.r*small.r*.017);
 const current=morphology(small).speed;
 assert.ok(current<baseline*.82,'halved body radius should have reduced travel speed');
 const extreme={...small,r:15};
 assert.ok(morphology(extreme).speed>0,'rare giant remains mobile');
 assert.ok(current>morphology(extreme).speed,'large bodies still move more slowly');
});
test('eggs are smaller than newly hatched bodies with proportional shell and detail',async()=>{
 const {eggVisualAxes}=await import('./renderer.js');
 const w=new Ecosystem(2026110850);
 for(const r of [3,4.1,7,12,15]){
  for(const shell of [0,.5,1]){
   const g={...w.gene(),r,shell,elongation:1};
   const egg=eggVisualAxes(g);
   const juvenile=w.spawn(160,180,g,{id:50,generation:0,lineage:'test'});
   const childRadius=bodyCollisionAxes(juvenile).ry;
   assert.ok(egg.rx>0&&egg.ry>0);
   assert.ok(egg.rx<childRadius,'egg must not dwarf a hatchling');
   assert.ok(egg.ry<childRadius*1.12,'egg is only slightly taller than the hatchling');
  }
 }
});

test('founding sexual population has both sexes regardless of spawn seed',()=>{
 for(const seed of [72,73,74,75,76,77,78,79,6001,6002]){
  const w=new Ecosystem(seed);
  w.introduce(170,130,1);
  const sexual=w.units.filter(u=>u.g.repro===0);
  if(sexual.length>1){
   assert.ok(sexual.some(u=>u.sex==='F'),String(seed));
   assert.ok(sexual.some(u=>u.sex==='M'),String(seed));
  }
 }
});
test('dry and rock lichen is consumable, sparse, and regrows slowly',()=>{
 const w=new Ecosystem(2026110860);
 for(const terrain of [2,3]){
  const index=w.cell(210,210);
  w.tiles[index]=terrain;w.grass[index]=3;
  const food=w.nearestGrass(210,210,25,{...w.gene(),aquatic:0,dry:1,rock:1});
  assert.ok(food);
  const eaten=w.consumeGrass(210,210,1);
  assert.equal(eaten,1);
  assert.equal(w.tiles[index],terrain);
  assert.equal(w.grass[index],2);
 }
});

test('game mode seeds submerged waterweed and records actual births after intervention',()=>{
 const w=new Ecosystem(2026110865),water=[...w.tiles].findIndex(t=>t===1);
 const x=(water%40+.5)*20,y=(Math.floor(water/40)+.5)*20;
 const run=new GameSession(w);
 assert.equal(run.start(x,y),true);
 w.waterweed[water]=0;
 assert.equal(run.intervene('seed',x,y),true);
 assert.ok(w.waterweed[water]>0);
 assert.ok(run.pendingImpact);
 const startingBirths=[...w.species.values()].reduce((sum,sp)=>sum+sp.total,0);
 w.tick+=100;run.observe();
 assert.equal(run.lastImpact.births,
  [...w.species.values()].reduce((sum,sp)=>sum+sp.total,0)-startingBirths);
 assert.equal(run.lastImpact.deltaPopulation,0);
});
test('biodiversity bonus rewards sustaining multiple species, not a transient burst',()=>{
 const w=new Ecosystem(2026110866),g=w.gene();
 w.introduce(170,130,1);
 const previous=w.runScore.balanceScore;
 const novel={...g,diet:1-g.diet,eyes:g.eyes===1?5:1};
 if(!w.species.has(w.category(novel)))w.spawn(185,130,novel);
 // Score is accumulated through real steps, never by observing the state.
 assert.equal(w.runScore.balanceScore,previous);
 w.climateEnabled=false;
 w.tick=19;w.step();
 assert.ok(w.runScore.balanceScore>=previous);
 assert.equal(w.runScore.total,
  w.runScore.survivalScore+w.runScore.discoveryScore+w.runScore.balanceScore);
});

test('habitat acclimation lowers arid dehydration without granting immortality',async()=>{
 const {terrestrialHydrationDelta}=await import('./simulation.js');
 const g={dry:1,rock:1};
 assert.ok(terrestrialHydrationDelta(g,2,'sunny')<0);
 assert.ok(terrestrialHydrationDelta(g,2,'sunny')>terrestrialHydrationDelta(g,0,'sunny'));
 assert.ok(terrestrialHydrationDelta(g,3,'rain')>terrestrialHydrationDelta(g,3,'sunny'));
 assert.ok(terrestrialHydrationDelta(g,0,'sunny')<0);
});
test('founders start with one compatible pair rather than two unrelated genotypes',()=>{
 const w=new Ecosystem(2026110867),result=w.introduce(170,130,1);
 assert.equal(result.individuals,8);
 const a=w.units[0],b=w.units[1];
 assert.equal(a.stage,'adult');assert.equal(b.stage,'adult');
 assert.equal(a.age,62);assert.equal(b.age,62);
 assert.equal(a.energy,145);assert.equal(b.energy,145);
 if(a.sex!=='H'&&b.sex!=='H'){
  assert.notEqual(a.sex,b.sex);
  assert.equal(a.g.diet,b.g.diet);
  assert.equal(a.g.repro,b.g.repro);
 }
});

test('giantism log separates hereditary mass from acquired adult growth and samples broad IDs',async()=>{
 const {observeEcology,EcologyLogbook,ECOLOGY_LOG_FIELDS,INDIVIDUAL_DIAG_FIELDS}=await import('./ecology-log.js');
 const w=new Ecosystem(2026110870);w.introduce(170,130,1);
 const adults=w.units.filter(u=>u.stage==='adult');
 assert.ok(adults.length>=2);
 adults[0].growthScale=2.5;adults[0].energy=230;adults[0].recentFood=100;
 adults[1].growthScale=1;
 const before=observeEcology(w);
 assert.equal(before.geneticMassMean>0,true);
 assert.ok(before.adultGrowthMean>1);
 assert.ok(before.adultActualMassMean>before.adultGeneticMassMean);
 assert.ok(before.adultGrowthP90>=before.adultGrowthP50);
 assert.equal(before.adultGrowthOver235,1);
 assert.equal(before.geneticSmallCount+before.geneticMediumCount+before.geneticLargeCount+before.geneticGiantCount,w.units.length);
 assert.equal(before.acquiredSmallCount+before.acquiredMediumCount+before.acquiredLargeCount+before.acquiredGiantCount,adults.length);
 const storage={getItem:()=>null,setItem:()=>{}};
 const log=new EcologyLogbook(storage,'giantism-log-test');log.start(2026110870);
 log.record(before,true);log.recordIndividuals(w,true);
 const csv=log.toCSV(),individuals=log.toIndividualCSV();
 for(const name of ['geneticMassMean','adultGrowthP90','adultActualMassMean','adultFrugalityMean','adultGrowingCount'])
  assert.ok(ECOLOGY_LOG_FIELDS.includes(name)&&csv.includes(name),name);
 for(const name of ['geneticMass','growthScale','actualMass','growthLimit','recentFood'])
  assert.ok(INDIVIDUAL_DIAG_FIELDS.includes(name)&&individuals.includes(name),name);
 assert.equal(log.data.runs[0].individuals[0].geneticMass>0,true);
 const empty=new Ecosystem(2026110871),emptyRow=observeEcology(empty);
 assert.equal(emptyRow.adultGrowthMean,0);
 assert.equal(emptyRow.geneticMassP90,0);
});

test('natural suffixes preserve trait family and distinguish temperature and strategy',()=>{
 const base=['land','plant','tiny','round','few','general','repro0','temperate','green'];
 const name=parts=>speciesNameFromCategory(parts.join('-'));
 assert.equal(name(base),'クサバソミドメオラン');
 assert.equal(name(base.slice(0,7).concat('cold','green')),'クサバソミドメオラト');
 assert.equal(name(base.slice(0,7).concat('hot','green')),'クサバソミドメオラス');
 assert.equal(name(base.slice(0,5).concat('guardian','repro0','temperate','green')),'クサバソミドメオラチ');
 assert.equal(name(base.slice(0,3).concat('oval','few','general','repro0','temperate','green')),'クサバソミドメオリン');
});
