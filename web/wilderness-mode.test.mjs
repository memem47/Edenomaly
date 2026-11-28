import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,WORLD} from './simulation.js';
import {GameSession,INTERVENTIONS} from './game-mode.js';
import {INTERVENTION_VISUALS,activeInterventionVisuals} from './intervention-visuals.js';

test('wilderness starts with exactly three meadow and three connected pond tiles',()=>{
 const w=new Ecosystem(2026112809);
 w.wildernessMode=true;w.reset();
 assert.equal(w.tiles.filter(t=>t===0).length,3);
 assert.equal(w.tiles.filter(t=>t===1).length,3);
 assert.equal(w.tiles.filter(t=>t===2).length,WORLD.columns*WORLD.rows-6);
 assert.ok(w.wildernessOrigin && w.terrain(w.wildernessOrigin.x,w.wildernessOrigin.y)===0);
 assert.ok(w.grass[w.cell(w.wildernessOrigin.x,w.wildernessOrigin.y)]>0);
 w.wildernessMode=false;w.reset();
 assert.ok(w.tiles.filter(t=>t===0).length>3,'regular worlds remain unchanged');
});

test('automatic fields charge once, improve resources, expire and reset',()=>{
 const w=new Ecosystem(2026112810);
 w.wildernessMode=true;w.reset();
 const site=w.wildernessOrigin;
 const g=w.adaptFounderToTerrain(w.gene(),0);
 const session=new GameSession(w);
 assert.equal(session.start(site.x,site.y,{founderGenome:g}),true);
 assert.equal(session.points,300);
 session.points=600;
 assert.ok(session.intervene('autoSeeder',site.x,site.y));
 assert.ok(session.intervene('autoIrrigator',site.x,site.y));
 assert.equal(session.spent,INTERVENTIONS.autoSeeder.cost+INTERVENTIONS.autoIrrigator.cost);
 assert.ok(activeInterventionVisuals(w).some(z=>z.kind==='autoSeeder'));
 assert.equal(session.intervene('autoSeeder',site.x,site.y),false,'cannot stack same machine within its radius');
 const before=w.grass.reduce((sum,n)=>sum+n,0);
 for(let tick=1;tick<=40;tick++){w.tick=tick;w.runAutomationZones();}
 assert.ok(w.grass.reduce((sum,n)=>sum+n,0)>before,'periodic seeds grow biomass');
 w.tick=601;
 w.runAutomationZones();
 assert.equal(w.automationZones.length,0);
 assert.equal(activeInterventionVisuals(w).length,0);
 w.reset();
 assert.equal(w.automationZones.length,0);
});

test('every paid intervention includes a visual definition',()=>{
 for(const kind of Object.keys(INTERVENTIONS))assert.ok(INTERVENTION_VISUALS[kind],kind);
});
