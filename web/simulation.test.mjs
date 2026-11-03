// Run with: node --test web/simulation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,morphology,organismMorphology,bodyCollisionAxes,localDensity,crowdStress,acquiredSizeMaintenance,feedingCapacity,energyStorageLimit,MAX_NUTRITION_GROWTH,adaptationColor} from './simulation.js';
import {slimeEyeAngles,slimeEyeColor,slimeEyeLocation,organismVisualState,drawWorld} from './renderer.js';
const populated=seed=>{const s=new Ecosystem(seed);s.introduce(160,135,3);return s;};
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
 for(let i=0;i<egg.hatchAt;i++)s.step();
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
 assert.equal(s.eggTrails.length,1);
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
 s.step();
 assert.equal(grazer.fleeing,true);
});
test('herbivore cannot gain energy by eating an egg',()=>{
 const s=populated(144),hunter=s.units[0],parent=s.units[1],partner=s.units[2];
 hunter.g.diet=0;parent.age=partner.age=100;parent.energy=partner.energy=160;
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
 const [a,b]=s.units;
 a.age=b.age=100;a.energy=b.energy=180;
 assert.ok(s.findMate(a,[a,b])===b);
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
 const [a,b]=s.units;for(const u of [a,b]){u.age=100;u.energy=175;}
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
 const g={...s.gene(),aquatic:0,diet:0},u=s.spawn(250,210,g);s.units=[u];
 u.energy=1e6;for(let i=0;i<480&&!u.dead;i++)s.step();
 assert.equal(u.dead,true);
});
test('aquatic slime dies stranded outside water',()=>{
 const s=new Ecosystem(603);s.tiles.fill(0);
 const g={...s.gene(),aquatic:1},u=s.spawn(250,210,g);s.units=[u];
 u.energy=1e6;for(let i=0;i<115&&!u.dead;i++)s.step();
 assert.equal(u.dead,true);
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
 w.water[i]=0;w.tiles[i]=2;w.growth=0;w.stress=80;
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
 w.tiles[i]=1;w.waterbed[i]=1;w.water[i]=1;
 assert.ok(Math.abs(w.consumeWater(220,140,1)-1)<1e-4);
 assert.equal(w.tiles[i],2);assert.equal(w.water[i],0);
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
 const a=w.units[0],b=w.units[1];
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
 w.water[i]=0;w.tiles[i]=2;w.growth=0;
 for(let j=0;j<180;j++)w.step();
 assert.equal(w.tiles[i],1);assert.ok(w.water[i]>0);
});
test('corpse moisture can establish a new pond on bare land',()=>{
 const w=new Ecosystem(1204);w.tiles.fill(2);w.grass.fill(0);
 const u=w.spawn(200,200,{...w.gene(),aquatic:0,r:12});
 w.die(u,'test');w.units=[];
 for(let i=0;i<200;i++)w.step();
 assert.ok([...w.tiles].some(t=>t===1));
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
test('dry and rocky founders inherit carnivorous traits',()=>{
 for(const terrain of [2,3]){
  const w=new Ecosystem(1504+terrain);w.tiles.fill(terrain);w.grass.fill(0);
  w.introduce(200,150,1);
  assert.ok(w.units.length>0);
  assert.ok(w.units.every(u=>u.g.aquatic===0&&u.g.diet>=.82&&u.g.jaw>=1.2));
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
 const twin={...g,shell:1-g.shell,guard:1-g.guard,nesting:1-g.nesting};
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
 assert.ok(colors.includes('#c2cf9e'));
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
 assert.ok(distance>10,'overlapping centers remained superimposed');
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
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>15);
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
 assert.ok(pressure<=9);
 anchor.stage='adult';anchor.age=100;anchor.energy=300;
 anchor.mateCooldown=0;anchor.infection=0;anchor.crowdStress=pressure;
 assert.equal(w.isReadyToMate(anchor),false);
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
 assert.ok(packed.a.crowdStress<=9);
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
 assert.equal(normal.alive,true);
 assert.equal(big.alive,false);
 assert.ok(big.steps<25);
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
 assert.ok(alpha.some(n=>n>.16&&n<=.26));
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
 assert.equal(w.waterweed[empty],0);
 assert.equal(w.waterweed[shallow],0);
 assert.equal(w.waterweedSeedCount,0);
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
 const w=new Ecosystem(2802);w.tiles.fill(0);w.grass.fill(100);
 const u=w.spawn(220,180,{...w.gene(),aquatic:0,diet:0,r:4});
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
 assert.ok(w.corpses[1].mass>w.corpses[0].mass*3);
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
  infected:false,attacking:false,injured:false,injurySeverity:0,hit:false
 });
 u.infection=40;u.hp=u.maxHp*.25;u.woundFlash=9;u.attackFlash=12;
 const state=organismVisualState(u);
 assert.equal(state.infected,true);assert.equal(state.attacking,true);
 assert.equal(state.hit,true);assert.equal(state.injured,true);
 assert.ok(state.injurySeverity>.6);
 u.hp=u.maxHp;u.infection=0;u.woundFlash=0;u.attackFlash=0;
 assert.equal(organismVisualState(u).injured,false);
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
test('infection, persistent wounds and attacking have distinct draw colors',()=>{
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
 assert.ok(styles.stroke.includes('rgba(59,212,99,.86)'));
 assert.ok(styles.stroke.includes('rgba(255,148,42,.92)'));
 assert.ok(styles.stroke.includes('rgba(185,44,84,.85)'));
 assert.ok(styles.fill.includes('rgba(255,92,75,.27)'));
});
