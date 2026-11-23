import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem} from './simulation.js';
import {FOUNDER_FIELDS,founderLevel,editFounderGenome} from './founder-designer.js';
import {BASIC_STATS,basicStatLevel,editBasicStat} from './basic-stats.js';
import {BASIC_STAT_GROUPS,basicStatValues,basicStatScore,geneLevel} from './basic-stat-score.js';
import {abilityListHTML} from './ability-bars.js';
import {founderFormulaHTML,formulaMappingRows,FOUNDER_DERIVED_FORMULAS} from './founder-formulas.js';
import {speciesReport} from './species-statistics.js';

test('every game-time stat uses identical six-stat levels to founder editor (DNA v2)',async()=>{
 const g=new Ecosystem(61513).gene();
 assert.equal(BASIC_STAT_GROUPS.length,6);
 assert.equal(g.genomeModel,2);
 for(const stat of BASIC_STATS){
  assert.equal(basicStatScore(g,stat.key),g.dna[stat.key]);
  assert.equal(basicStatLevel(g,stat.key),g.dna[stat.key]);
  assert.equal(basicStatValues(g)['stat_'+stat.key],g.dna[stat.key]);
 }
 const html=abilityListHTML(g);
 for(const stat of BASIC_STATS)assert.ok(html.includes(stat.name));
 assert.equal((html.match(/class="ability-bar" /g)||[]).length,6);
});
test('founder-only mapping lists all 37 loci and derived physiology formulas (DNA v2)',async()=>{
 const {GENETIC_LOCUS_LIMITS}=await import('./simulation.js');
 const rows=formulaMappingRows();
 assert.equal(FOUNDER_FIELDS.length,19);
 assert.equal(rows.length,37);
 assert.deepEqual(new Set(rows.map(row=>row.key)),new Set(Object.keys(GENETIC_LOCUS_LIMITS)));
 assert.ok(FOUNDER_DERIVED_FORMULAS.length>=5);
 const html=founderFormulaHTML();
 assert.ok(html.includes('19遺伝子')&&html.includes('37応用パラメータ'));
 assert.ok(html.includes('体重 bodyMass'));
 assert.ok(html.includes('基礎代謝'));
});
test('individual birth samples retain exact six-stat quantiles, not averaged allele medians',()=>{
 const w=new Ecosystem(61514);
 const base=editFounderGenome(w.gene(),{resist:.5,frugality:.5,tempTolerance:10});
 const low=editFounderGenome(base,{retaliation:0,guard:0});
 const high=editFounderGenome(base,{retaliation:1,guard:1});
 const a=w.spawn(130,130,low),b=w.spawn(135,130,high);
 // Distinct morphology can create two categories. Both must retain the
 // exact per-individual stat for each recorded birth.
 const rows=speciesReport(w);
 for(const u of [a,b]){
  const item=rows.find(r=>r.category===u.category&&r.metric==='stat_power'&&r.scope==='birth');
  assert.ok(item,'missing birth stat for '+u.category);
  assert.ok(item.min<=basicStatLevel(u.g,'power')&&item.max>=basicStatLevel(u.g,'power'));
 }
 for(const stat of BASIC_STATS)
  assert.ok(rows.some(r=>r.metric==='stat_'+stat.key&&r.scope==='living'));
});
test('formula reference exists only in the founder editor, not game views',async()=>{
 const read=path=>readFile(new URL(path,import.meta.url),'utf8');
 const ui=await read('./founder-screens.js'),app=await read('./app.js');
 const viewer=await read('./species-report-viewer.js');
 assert.match(ui,/founderFormulaHTML\(\)/);
 assert.ok(ui.indexOf('founderFormulaHTML()')<ui.indexOf('function showNextDiscovery()'));
 const discovery=ui.slice(ui.indexOf('function showNextDiscovery()'));
 assert.ok(!discovery.includes('founderFormulaHTML'));
 assert.ok(!discovery.includes('phenotypeBarsHTML(g)'));
 assert.ok(app.includes('basicStatScore('));
 assert.ok(!app.includes('phenotypeBarsHTML(selected.g)'));
 assert.ok(viewer.includes('basicMetrics.has(r.metric)'));
});
