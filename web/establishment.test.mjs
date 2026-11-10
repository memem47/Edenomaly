import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,terrainFitness,terrestrialHydrationDelta,effectivePlantAffinity,morphology} from './simulation.js';
import {GameSession} from './game-mode.js';

test('three generations and a concurrent 12-body peak jointly establish one species',()=>{
 const w=new Ecosystem(202611111),session=new GameSession(w);
 assert.ok(session.start(170,130));
 const g=w.units[0].g,key=w.units[0].category,sp=w.species.get(key);
 assert.equal(sp.current,8);
 assert.equal(w.runScore.establishedSpecies,0);
 for(let i=0;i<4;i++)w.spawn(170,130,g);
 assert.equal(sp.peakCurrent,12);
 assert.equal(sp.establishedByPopulation,true);
 assert.equal(sp.establishedByGeneration,false);
 assert.equal(w.runScore.establishedSpecies,0);
 const first=w.spawn(170,130,g,w.units[0]);
 const second=w.spawn(170,130,g,first);
 assert.equal(second.generation,2);
 assert.equal(sp.establishedByGeneration,true);
 assert.equal(w.runScore.establishedSpecies,1);
 assert.equal(w.runScore.establishmentScore,450);
 const before=session.points;
 session.observe();
 assert.equal(session.points,before+25,'5+5+15 intervention points for three milestones');
 session.observe();
 assert.equal(session.points,before+25,'milestone points cannot be claimed twice');
 assert.ok(session.milestones.has('established:'+key));
 for(const u of [...w.units])w.die(u,'test');
 assert.equal(sp.current,0);
 assert.equal(w.runScore.establishedSpecies,1,'historic establishment survives extinction');
});

test('many births in first generation are not mistaken for three generations',()=>{
 const w=new Ecosystem(202611112);
 const g=w.gene();
 for(let i=0;i<20;i++)w.spawn(170,140,g);
 const sp=[...w.species.values()][0];
 assert.equal(sp.peakCurrent,20);
 assert.equal(sp.establishedByPopulation,true);
 assert.equal(sp.establishedByGeneration,false);
});

test('rock adaptation has an ecological water economy without creating new genes',()=>{
 const g={...new Ecosystem(202611113).gene(),rock:1,dry:0};
 const weak={...g,rock:0};
 assert.ok(terrestrialHydrationDelta(g,3,'sunny')>terrestrialHydrationDelta(weak,3,'sunny'));
 assert.ok(terrainFitness(g,3).move>terrainFitness(weak,3).move);
 assert.ok(terrainFitness(g,3).upkeep<terrainFitness(weak,3).upkeep);
});

test('omnivore enhancement preserves all plant diet endpoints and maintenance mass costs',()=>{
 const g=new Ecosystem(202611114).gene();
 const u={g:{...g,diet:0},carnivoryExperience:0};
 assert.equal(effectivePlantAffinity(u),1);
 u.g.diet=1;
 assert.equal(effectivePlantAffinity(u),0);
 u.g.diet=.5;
 assert.ok(effectivePlantAffinity(u)>.5);
 const small=morphology({...g,r:3.2}),large=morphology({...g,r:7});
 assert.ok(large.upkeep>small.upkeep);
});
