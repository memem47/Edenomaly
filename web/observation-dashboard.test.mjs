import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem,functionalOrnaments,morphology,speciesFeatureName,speciesAppearanceCategory} from './simulation.js';
import {FOUNDER_FIELDS,editFounderGenome} from './founder-designer.js';
import {abilityPosition,abilityListHTML,phenotypeBarsHTML} from './ability-bars.js';
import {DASHBOARD_TABS} from './dashboard-tabs.js';

test('independent appearance sliders are no longer exposed',()=>{
 for(const key of ['tailLength','hornLength','antennaLength','pattern'])
  assert.equal(FOUNDER_FIELDS.some(([trait])=>trait===key),false,key);
 assert.ok(!FOUNDER_FIELDS.some(([key])=>key==='jaw'));
 assert.ok(FOUNDER_FIELDS.some(([key])=>key==='predatorSense'));
});
test('combat, perception and aquatic ability determine the visible body',()=>{
 const world=new Ecosystem(2026112102),initial=world.gene();
 const low={...initial,jaw:.2,guard:0,wet:0,dispersal:0,predatorSense:0,eyes:2,deception:0,resist:0,aquatic:0};
 const jaw={...low,jaw:2.5,guard:1};
 const sense={...low,predatorSense:1,eyes:6};
 const aquatic={...low,wet:1,dispersal:1,aquatic:1};
 const stealth={...low,deception:1,resist:1};
 assert.ok(functionalOrnaments(jaw).horn>functionalOrnaments(low).horn);
 assert.ok(functionalOrnaments(sense).antenna>functionalOrnaments(low).antenna);
 assert.ok(functionalOrnaments(aquatic).tail>functionalOrnaments(low).tail);
 assert.ok(functionalOrnaments(stealth).pattern>functionalOrnaments(low).pattern);
 assert.ok(morphology(jaw).biteReach>morphology(low).biteReach);
 assert.ok(morphology(sense).eyeRange>morphology(low).eyeRange);
});
test('legacy cosmetic loci cannot change morphology or species identities',()=>{
 const g=new Ecosystem(2026112103).gene();
 const a={...g,tailLength:0,hornLength:0,antennaLength:0,pattern:0};
 const b={...g,tailLength:1,hornLength:1,antennaLength:1,pattern:1};
 assert.deepEqual(functionalOrnaments(a),functionalOrnaments(b));
 assert.equal(speciesFeatureName(a),speciesFeatureName(b));
 assert.equal(speciesAppearanceCategory(a),speciesAppearanceCategory(b));
 assert.deepEqual(morphology(a),morphology(b));
});
test('ability meters include explicit numerical min/max and bounded fill',()=>{
 assert.equal(abilityPosition(-10,0,1),0);
 assert.equal(abilityPosition(2,0,1),100);
 assert.equal(abilityPosition(.5,0,1),50);
 const g=new Ecosystem(2026112104).gene();
 const html=abilityListHTML(g);
 assert.ok(html.includes('最小 '));
 assert.ok(html.includes('最大 '));
 assert.ok(html.includes('role="meter"'));
 assert.ok(html.includes('ability-fill'));
 assert.ok(phenotypeBarsHTML(g).includes('能力から決まる外見'));
});
test('dashboard tab groups expose all key operations and diagnostics',async()=>{
 const src=await readFile(new URL('./dashboard-tabs.js',import.meta.url),'utf8');
 assert.deepEqual(DASHBOARD_TABS.map(t=>t.id),['operations','catalog','ecology','history','stats']);
 assert.ok(src.includes("doc.querySelector('.shell>.game-controls')"));
 assert.ok(src.includes("doc.querySelector('.shell>.score-strip')"));
 assert.ok(src.includes("doc.getElementById('gameEventPanel')"));
 assert.ok(src.includes("panel.hidden=!active"));
 assert.ok(src.includes("grid.append(item)"));
});
