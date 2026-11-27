import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,parentalMutationChance} from './simulation.js';
import {GameSession} from './game-mode.js';

test('older parents have a higher but bounded chance of mutation',()=>{
 assert.equal(parentalMutationChance(0,0),.4);
 assert.equal(parentalMutationChance(300,0),.4);
 assert.ok(parentalMutationChance(950,0)>.5);
 assert.ok(parentalMutationChance(1800,0)>.70);
 assert.ok(parentalMutationChance(1800,1800)>parentalMutationChance(1800,0));
 assert.ok(parentalMutationChance(100000,100000)<=.79);
 assert.equal(parentalMutationChance(-1,NaN),.4);
});
test('age affects the child at conception, not parental genomes or taxonomy rules',()=>{
 const a=new Ecosystem(8008),b=new Ecosystem(8008);
 const parentA=a.gene(),parentB=b.gene();
 assert.deepEqual(parentA,parentB);
 const young=a.recombine(parentA,parentA,0,0);
 const old=b.recombine(parentB,parentB,1900,1900);
 assert.deepEqual(Object.keys(young.dna),Object.keys(old.dna));
 assert.deepEqual(parentA.dna,parentB.dna);
 assert.equal(young.genomeModel,2);
 assert.equal(old.genomeModel,2);
});
test('veteran care costs 9 points, targets a single older adult and does not guarantee survival',()=>{
 const w=new Ecosystem(22004),session=new GameSession(w);
 w.tiles.fill(0);w.grass.fill(90);
 const g=w.gene();assert.ok(session.start(180,160,{founderGenome:g}));
 const elder=w.units[0],near=w.units[1];
 elder.age=550;near.age=10;
 elder.stage='adult';near.stage='adult';elder.energy=52;elder.hydration=30;elder.infection=70;
 elder.x=280;elder.y=220;near.x=430;near.y=330;
 assert.equal(session.canIntervene('veteranCare',near.x,near.y),false);
 assert.equal(session.canIntervene('veteranCare',elder.x,elder.y),true);
 const before=session.points;
 assert.equal(session.intervene('veteranCare',elder.x,elder.y),true);
 assert.equal(session.points,before-9);
 assert.ok(elder.energy>52&&elder.hydration>30&&elder.infection<70);
 assert.equal(near.energy,w.units[1].energy);
 assert.ok(elder.hp<=elder.maxHp,'the intervention does not make elders immortal');
});
