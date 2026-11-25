import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,acquiredSizeMaintenance,frugalityMaintenanceFactor} from '../web/simulation.js';
import {expressDNA} from '../web/genome-model.js';
import {evolutionaryTraitMetrics} from '../web/headless-runner.mjs';

function genotype(seed,changes){
 const w=new Ecosystem(seed),g=w.gene();
 const dna={...g.dna,...changes};
 return expressDNA({dna,alleles:Object.fromEntries(Object.entries(dna).map(([k,v])=>[k,[v,v]]))});
}

test('parental feeding is heritable, has no effect without skill, and spends parental reserves',()=>{
 const w=new Ecosystem(12017),g=genotype(12017,{skillParentFeeding:1,fertility:9});
 const parent=w.spawn(150,150,g),child=w.spawn(155,150,g,parent);
 assert.equal(parent.g.dna.skillParentFeeding,1);
 assert.ok(parent.g.parentFeeding>.35);
 parent.energy=165;child.energy=25;child.stage='juvenile';
 const before=parent.energy;
 w.tick=parent.id%12;
 const result=w.feedOffspring(parent,[child]);
 assert.ok(result);
 assert.ok(child.energy>25);
 assert.ok(parent.energy<before);
 assert.ok(before-parent.energy>child.energy-25,'transfer must not create energy');
 const absent=genotype(12018,{skillParentFeeding:0,fertility:9});
 const noSkill=w.spawn(160,150,absent),other=w.spawn(162,150,absent,noSkill);
 noSkill.energy=165;other.energy=25;other.stage='juvenile';
 w.tick=noSkill.id%12;
 assert.equal(w.feedOffspring(noSkill,[other]),null);
 assert.equal(other.energy,25);
});

test('feeding ability survives linked inheritance and can be lost or gained through alleles',()=>{
 const w=new Ecosystem(12019),homo=genotype(12019,{skillParentFeeding:1}),none=genotype(12020,{skillParentFeeding:0});
 const carrier=expressDNA({dna:{...homo.dna,skillParentFeeding:1},alleles:{...homo.alleles,skillParentFeeding:[1,0]}});
 let expressed=0,unexpressed=0;
 for(let i=0;i<100;i++){
  const child=w.recombine(carrier,none);
  if(child.dna.skillParentFeeding===1)expressed++;else unexpressed++;
 }
 assert.ok(expressed>0);
 assert.ok(expressed<100);
 assert.ok(unexpressed>0);
});

test('skilled nest choice increases the opportunity to inspect distant food without fabricating it',()=>{
 const w=new Ecosystem(12021),low=genotype(12021,{skillNestChoice:0,intellect:9}),high=genotype(12021,{skillNestChoice:1,intellect:9});
 const lowParent=w.spawn(170,170,low),highParent=w.spawn(170,170,high);
 const lowRadius=20+lowParent.g.nestChoice*90,highRadius=20+highParent.g.nestChoice*90;
 assert.ok(highRadius>lowRadius+20);
 assert.equal(lowParent.g.nestChoice,0);
 assert.ok(highParent.g.nestChoice>.35);
 assert.equal(w.nurseryFoodAt(170,170,lowParent.g),w.nurseryFoodAt(170,170,highParent.g));
});

test('efficient physiology has a real but not free inherited maintenance tradeoff',()=>{
 const low=genotype(12022,{stamina:2}),high=genotype(12022,{stamina:9});
 assert.ok(high.frugality>low.frugality);
 assert.ok(frugalityMaintenanceFactor(high)<frugalityMaintenanceFactor(low));
 assert.ok(high.r>low.r,'stamina also increases inherited size and metabolic burden');
 assert.equal(acquiredSizeMaintenance({growthScale:1}),0);
});

test('caregiving adults actively pursue their children rather than waiting for accidental proximity',()=>{
 const w=new Ecosystem(12023),g=genotype(12023,{skillParentFeeding:1,fertility:9});
 w.tiles.fill(0);w.grass.fill(90);
 const parent=w.spawn(150,150,g),child=w.spawn(215,150,g,parent);
 w.units=[parent,child];
 parent.age=100;parent.energy=200;
 child.stage='juvenile';child.energy=30;
 w.step();
 assert.equal(parent.behaviorTarget,'parentFeed','well-fed caregiving parent should navigate to its own hungry offspring');
 const metrics=evolutionaryTraitMetrics(w);
 assert.ok(metrics.parentalCareFraction>0);
 assert.ok(metrics.adultCareFraction>0);
});
