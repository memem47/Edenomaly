import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem} from './simulation.js';
import {editFounderGenome} from './founder-designer.js';
import {DERIVED_FIELDS,DERIVED_GROUPS,formatDerivedValue,derivedDashboardHTML,refreshDerivedDashboard} from './founder-derived-dashboard.js';
import {GENOME_DERIVATION_FORMULAS} from './founder-formulas.js';

test('all thirty-seven calculated parameters appear in the live right column',()=>{
 assert.equal(DERIVED_FIELDS.length,37);
 assert.deepEqual(new Set(DERIVED_FIELDS.map(field=>field.key)),
  new Set(GENOME_DERIVATION_FORMULAS.map(([key])=>key)));
 const html=derivedDashboardHTML();
 assert.equal((html.match(/data-derived-value=/g)||[]).length,37);
 assert.equal((html.match(/data-derived-row=/g)||[]).length,37);
 for(const group of DERIVED_GROUPS)assert.ok(html.includes(group.name));
 for(const field of DERIVED_FIELDS){
  assert.ok(html.includes(field.formula.replaceAll('&','&amp;').replaceAll('<','&lt;'))||
   html.includes(field.formula),field.key);
 }
});
test('editing each inherited core stat drives live derived values without changing DNA',()=>{
 const w=new Ecosystem(20261123201),g=w.gene(),before=JSON.stringify(g);
 for(const key of ['power','agility','stamina','intellect','adaptation','fertility']){
  const edited=editFounderGenome(g,{[key]:g.dna[key]===10?1:10});
  assert.equal(edited.genomeModel,2);
  assert.ok(DERIVED_FIELDS.some(row=>Math.abs(edited[row.key]-g[row.key])>1e-7),key);
 }
 assert.equal(JSON.stringify(g),before);
});
test('readout changes only text and class, not simulated genome and not world RNG',()=>{
 const w=new Ecosystem(20261123202),base=w.gene(),g=editFounderGenome(base,{stamina:10,fertility:10});
 const root={
  select:new Map(),
  querySelector(selector){return this.select.get(selector)??null;}
 };
 for(const {key} of DERIVED_FIELDS){
  const row={states:new Set(),classList:{toggle(cls,on){if(on)row.states.add(cls);else row.states.delete(cls);}}};
  root.select.set('[data-derived-value="'+key+'"]',{textContent:'',closest(){return row;}});
  root.select.set('[data-derived-delta="'+key+'"]',{textContent:'',className:''});
 }
 const original=JSON.stringify(g),rng=w.rng;
 refreshDerivedDashboard(root,g,base);
 assert.equal(JSON.stringify(g),original);assert.equal(w.rng,rng);
 for(const {key} of DERIVED_FIELDS){
  const el=root.select.get('[data-derived-value="'+key+'"]');
  assert.notEqual(el.textContent,'');
 }
 assert.equal(formatDerivedValue('idealTemp',23),'23.0℃');
 assert.equal(formatDerivedValue('brood',3),'3個');
 assert.equal(formatDerivedValue('resist',.5),'50%');
});
test('founder editor keeps all DNA categories and 37 outputs together on screen',async()=>{
 const read=name=>readFile(new URL(name,import.meta.url),'utf8');
 const ui=await read('./founder-screens.js'),css=await read('./style.css');
 const start=ui.indexOf('editorBody.innerHTML='),end=ui.indexOf('editorFoot.innerHTML=',start);
 const editor=ui.slice(start,end);
 assert.ok(editor.includes('founder-two-columns'));
 assert.ok(editor.includes('founder-genome-column'));
 assert.ok(editor.includes('founder-phenotype-column'));
 assert.ok(editor.includes('derivedDashboardHTML()'));
 assert.ok(editor.includes('founder-strategy-grid'));
 assert.ok(editor.includes('founder-skills-grid'));
 assert.ok(editor.includes('data-basic-stat'));
 assert.ok(!editor.includes('id="founderGeneEditor" hidden'));
 assert.match(ui,/refreshDerivedDashboard\(editorBody,g,base\)/);
 assert.match(css,/#founderEditorDialog\.genome-dialog/);
 assert.match(css,/height:min\(910px,calc\(100dvh - 12px\)\)/);
 assert.match(css,/#founderEditorDialog \.founder-two-columns\{display:grid/);
 assert.match(css,/@media\(max-width:740px\)/);
});
