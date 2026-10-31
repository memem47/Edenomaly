// Run with: node --test web/simulation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,morphology} from './simulation.js';
test('same seed creates same initial ecosystem',()=>{const a=new Ecosystem(42),b=new Ecosystem(42);assert.deepEqual(a.tiles,b.tiles);assert.deepEqual(a.units,b.units);});
test('species counts reconcile',()=>{const s=new Ecosystem();for(let i=0;i<25;i++)s.step();assert.equal([...s.species.values()].reduce((v,x)=>v+x.current,0),s.units.length);assert.ok([...s.species.values()].every(x=>x.total>=x.current));});
test('death creates a decomposable corpse',()=>{const s=new Ecosystem();let u=s.units[0];s.die(u,'test');assert.equal(s.corpses.length,1);assert.equal(s.species.get(u.category).current>=0,true);});
test('terrain painting changes terrain',()=>{const s=new Ecosystem();s.paint(100,100,3,2);assert.equal(s.terrain(100,100),3);});

test('morphological genes are inherited and bounded',()=>{const s=new Ecosystem(42);for(let i=0;i<300;i++)s.step();for(const u of s.units){assert.ok(u.g.elongation>=.65&&u.g.elongation<=3);assert.ok(u.g.eyes>=0&&u.g.eyes<=6);assert.ok(u.g.mouths>=1&&u.g.mouths<=4);assert.ok(u.g.legs>=0&&u.g.legs<=8&&u.g.legs%2===0);}});
test('more eyes increase sight but cost energy',()=>{const g=new Ecosystem().gene();assert.ok(morphology({...g,eyes:6}).eyeRange>morphology({...g,eyes:0}).eyeRange);assert.ok(morphology({...g,eyes:6}).upkeep>morphology({...g,eyes:0}).upkeep);});
test('more legs increase movement while requiring energy',()=>{const g=new Ecosystem().gene();assert.ok(morphology({...g,legs:8}).speed>morphology({...g,legs:0}).speed);assert.ok(morphology({...g,legs:8}).upkeep>morphology({...g,legs:0}).upkeep);});
test('longer body raises mass and energy consumption',()=>{const g=new Ecosystem().gene();assert.ok(morphology({...g,elongation:2.8}).bodyMass>morphology({...g,elongation:.8}).bodyMass);assert.ok(morphology({...g,elongation:2.8}).upkeep>morphology({...g,elongation:.8}).upkeep);});
test('mouth number influences feeding and attack reach',()=>{const g=new Ecosystem().gene();assert.ok(morphology({...g,mouths:4}).foodGain>morphology({...g,mouths:1}).foodGain);assert.ok(morphology({...g,mouths:4}).biteReach>morphology({...g,mouths:1}).biteReach);});

import {eggTraits} from './simulation.js';
test('egg hatches into a juvenile and grows into adult',()=>{
 const s=new Ecosystem(19),parent=s.units[0],partner=s.units[1];s.units=[parent,partner];
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
test('eggs can be eaten and are removed',()=>{const s=new Ecosystem(11),parent=s.units[0],predator=s.units[1];parent.age=predator.age=100;parent.energy=predator.energy=160;s.layEgg(parent,predator);const e=s.layEgg(parent);assert.ok(s.eatEgg(e,predator));assert.equal(e.dead,true);assert.ok(s.logs.some(l=>l.type==='eggeaten'));});
test('shell trades material for longer incubation and chewing',()=>{const g=new Ecosystem(4).gene();assert.ok(eggTraits({...g,shell:1}).incubation>eggTraits({...g,shell:0}).incubation);assert.ok(eggTraits({...g,shell:1}).eggEnergy>eggTraits({...g,shell:0}).eggEnergy);});
test('egg protection genes are inherited and bounded',()=>{const s=new Ecosystem(30);for(let i=0;i<100;i++){const g=s.mutate(s.gene());for(const k of ['guard','shell','nesting'])assert.ok(g[k]>=0&&g[k]<=1);}});

test('mating requires two distinct adults and consumes energy',()=>{
 const s=new Ecosystem(21),a=s.units[0],b=s.units[1];
 a.age=b.age=100;a.energy=b.energy=160;
 assert.equal(s.layEgg(a,a),null);
 assert.equal(s.layEgg(a,{...b,stage:'juvenile'}),null);
 const pregnancy=s.layEgg(a,b);assert.ok(pregnancy);assert.equal(s.eggs.length,0);
 const e=s.layEgg(a);assert.ok(e);assert.equal(e.parent,a.id);assert.equal(e.otherParent,b.id);assert.ok(a.energy<160&&b.energy<160);
 assert.ok(a.mateCooldown>0&&b.mateCooldown>0);
 assert.equal(s.layEgg(a,b),null);
});
test('recombination combines both parents without relying on mutation',()=>{
 const s=new Ecosystem(52),a=s.gene(),b=s.gene();
 for(const k of Object.keys(a))b[k]=a[k]+(k==='hue'?50:k==='legs'?2:k==='eyes'||k==='mouths'?1:.2);
 const original=s.mutate;s.mutate=()=>{throw new Error('mutation must not be necessary');};
 s.rand=(()=>{let n=0;return ()=>{n++;return n<=12?(n%2?.1:.9):.9;};})();
 const c=s.recombine(a,b);
 assert.equal(c.r,a.r);assert.equal(c.elongation,b.elongation);assert.equal(c.eyes,a.eyes);assert.equal(c.mouths,b.mouths);
 s.mutate=original;
});
test('mate search excludes self juveniles and direct descendants',()=>{
 const s=new Ecosystem(33),a=s.units[0],b=s.units[1];
 a.age=b.age=100;a.energy=b.energy=120;
 a.x=b.x=100;a.y=b.y=100;
 assert.equal(s.findMate(a,[a,b]),b);
 b.stage='juvenile';assert.equal(s.findMate(a,[a,b]),null);
 b.stage='adult';b.parent=a.id;assert.equal(s.findMate(a,[a,b]),null);
});

test('isolated adult cannot produce an egg by cloning',()=>{
 const s=new Ecosystem(66),a=s.units[0];
 s.units=[a];a.age=100;a.energy=200;
 s.food=[];s.growth=0;
 for(let i=0;i<25;i++)s.step();
 assert.equal(s.eggs.length,0);
 assert.equal(s.matings,0);
});

test('courtship links both living parents before conception',()=>{
 const s=new Ecosystem(88),a=s.units[0],b=s.units[1];
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
 const s=new Ecosystem(89),a=s.units[0],b=s.units[1];
 s.units=[a,b];for(const u of s.units){u.age=100;u.energy=200;}
 a.x=100;a.y=100;b.x=105;b.y=105;
 assert.ok(s.startCourtship(a,b));b.x=600;
 s.updateCourtships();
 assert.equal(s.courtships.length,0);assert.equal(s.matings,0);
 assert.equal(a.courtPartner,null);assert.equal(b.courtPartner,null);
});

test('genetic brood size controls clutch count and preserves both parents',()=>{
 const small=new Ecosystem(91),a=small.units[0],b=small.units[1];
 for(const u of [a,b]){u.age=100;u.energy=160;u.g.brood=1;}
 assert.ok(small.conceive(a,b));small.layEgg(a);
 assert.equal(small.eggs.length,1);
 const large=new Ecosystem(91),c=large.units[0],d=large.units[1];
 for(const u of [c,d]){u.age=100;u.energy=160;u.g.brood=8;}
 assert.ok(large.conceive(c,d));large.layEgg(c);
 assert.equal(large.eggs.length,8);
 assert.ok(large.eggs.every(e=>e.parent===c.id&&e.otherParent===d.id));
 assert.equal(new Set(large.eggs.map(e=>e.id)).size,8);
});
test('large clutches cost more parental energy',()=>{
 const run=brood=>{
  const s=new Ecosystem(93),a=s.units[0],b=s.units[1];
  for(const u of [a,b]){u.age=100;u.energy=160;u.g.brood=brood;}
  s.conceive(a,b);return 160-a.energy;
 };
 assert.ok(run(8)>run(1));
});
test('pigment and brood genes remain within bounds after mutation',()=>{
 const s=new Ecosystem(94);
 for(let i=0;i<100;i++){
  const g=s.mutate(s.gene());
  assert.ok(g.brood>=1&&g.brood<=8&&Number.isInteger(g.brood));
  assert.ok(g.pattern>=0&&g.pattern<=3&&Number.isInteger(g.pattern));
  assert.ok(g.saturation>=35&&g.saturation<=100);
  assert.ok(g.lightness>=35&&g.lightness<=85);
 }
});

import {dietProfile} from './simulation.js';
test('diet genes define strict nutritional endpoints',()=>{
 const g=new Ecosystem(140).gene();
 assert.deepEqual([dietProfile({...g,diet:0}).plant,dietProfile({...g,diet:0}).meat],[1,0]);
 assert.deepEqual([dietProfile({...g,diet:1}).plant,dietProfile({...g,diet:1}).meat],[0,1]);
 assert.ok(dietProfile({...g,diet:.5}).plant>0&&dietProfile({...g,diet:.5}).meat>0);
});
test('feeding signal can be inherited independently of actual diet',()=>{
 const s=new Ecosystem(141),g=s.gene();
 const plantDisguise=dietProfile({...g,diet:1,deception:0});
 const predatorBluff=dietProfile({...g,diet:0,deception:1});
 assert.equal(plantDisguise.meat,1);assert.ok(plantDisguise.signal<.48);
 assert.equal(predatorBluff.meat,0);assert.ok(predatorBluff.signal>.52);
});
test('diet and deception alleles survive crossover and bounded mutation',()=>{
 const s=new Ecosystem(142),a=s.gene(),b={...a,diet:1,deception:1};
 a.diet=0;a.deception=0;
 const c=s.recombine(a,b);
 assert.ok([0,1].includes(c.diet)||c.diet>=0&&c.diet<=1);
 for(let i=0;i<100;i++){const g=s.mutate(s.gene());assert.ok(g.diet>=0&&g.diet<=1);assert.ok(g.deception>=0&&g.deception<=1);}
});
test('nutrient eater runs away from apparent large predator',()=>{
 const s=new Ecosystem(143),grazer=s.units[0],hunter=s.units[1];
 s.units=[grazer,hunter];s.food=[];
 grazer.x=100;grazer.y=100;grazer.g.diet=0;grazer.g.deception=.5;
 hunter.x=120;hunter.y=100;hunter.g.diet=1;hunter.g.deception=.8;
 hunter.g.r=Math.max(hunter.g.r,grazer.g.r*1.5);hunter.g.elongation=grazer.g.elongation;grazer.g.eyes=6;
 s.step();
 assert.equal(grazer.fleeing,true);
});
test('herbivore cannot gain energy by eating an egg',()=>{
 const s=new Ecosystem(144),hunter=s.units[0],parent=s.units[1],partner=s.units[2];
 hunter.g.diet=0;parent.age=partner.age=100;parent.energy=partner.energy=160;
 s.conceive(parent,partner);const egg=s.layEgg(parent);
 const before=hunter.energy;
 assert.equal(s.eatEgg(egg,hunter),false);
 assert.equal(hunter.energy,before);assert.equal(egg.dead,false);
});

test('strict carnivore leaves nutrient particles uneaten',()=>{
 const s=new Ecosystem(145),u=s.units[0];
 s.units=[u];u.g.diet=1;u.energy=100;s.food=[{x:u.x,y:u.y,energy:20,source:'natural'}];s.growth=0;
 s.step();assert.equal(s.food.length,1);
});
test('strict nutrient eater does not hunt living prey',()=>{
 const s=new Ecosystem(146),a=s.units[0],b=s.units[1];
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
 const g=new Ecosystem(204).gene();
 assert.ok(terrainFitness({...g,dry:1},2).fitness>terrainFitness({...g,dry:0},2).fitness);
 assert.ok(terrainFitness({...g,dry:1},2).upkeep<terrainFitness({...g,dry:0},2).upkeep);
 assert.ok(terrainFitness({...g,rock:1},3).fitness>terrainFitness({...g,rock:0},3).fitness);
 assert.ok(terrainFitness({...g,wet:1},1).fitness>terrainFitness({...g,wet:0},1).fitness);
});
test('rock adaptation is inherited and bounded',()=>{
 const s=new Ecosystem(205),a=s.gene(),b=s.gene();
 a.rock=0;b.rock=1;
 const c=s.recombine(a,b);assert.ok(c.rock>=0&&c.rock<=1);
 for(let i=0;i<100;i++){const g=s.mutate(s.gene());assert.ok(g.rock>=0&&g.rock<=1);}
});
test('completed refuge migration is distinct from terrain crossing',()=>{
 const s=new Ecosystem(206),u=s.units[0];
 s.units=[u];s.migrations=0;
 u.refugeTarget={x:u.x,y:u.y,until:s.tick+20};
 s.step();
 assert.equal(s.migrations,1);assert.equal(u.migrations,1);
 assert.equal(u.refugeTarget,null);
});
test('painted terrain updates the fitness calculation',()=>{
 const s=new Ecosystem(207),g=s.gene();
 g.dry=1;g.rock=0;
 s.paint(100,100,2,2);const arid=terrainFitness(g,s.terrain(100,100));
 s.paint(100,100,3,2);const rocky=terrainFitness(g,s.terrain(100,100));
 assert.ok(arid.fitness>rocky.fitness);
});
