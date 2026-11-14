import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem} from './simulation.js';
import {GameSession} from './game-mode.js';

test('nursery protects eggs without making them invulnerable or changing genes',()=>{
 const w=new Ecosystem(151),s=new GameSession(w);
 assert.ok(s.start(200,170));
 assert.equal(s.intervene('nursery',200,170),true);
 assert.equal(s.points,8);
 assert.equal(w.supportZones[0].until,w.tick+260);
 assert.equal(s.interventionHistory[0].kind,'nursery');
 assert.equal(s.intervene('nursery',-2,170),false);
});
test('oasis gives water, not food, and expires on schedule',()=>{
 const w=new Ecosystem(152),s=new GameSession(w);
 assert.ok(s.start(200,170));
 const u=w.units[0];u.hydration=20;
 const energy=u.energy,genes=JSON.stringify(u.g);
 assert.ok(s.intervene('oasis',u.x,u.y));
 assert.equal(s.points,9);
 assert.equal(u.hydration,50);
 assert.equal(u.energy,energy);
 assert.equal(JSON.stringify(u.g),genes);
 assert.equal(w.supportZones[0].until,w.tick+200);
 assert.equal(s.canIntervene('oasis',-1,1),false);
});
test('disease starts absent, and environmental spillover counter is initialized',()=>{
 const w=new Ecosystem(153),s=new GameSession(w);
 s.start(200,170);
 assert.equal(w.infectionCases,0);
 assert.equal(w.infectionIntroductions,0);
 assert.ok(w.units.every(u=>u.infection===0));
});
