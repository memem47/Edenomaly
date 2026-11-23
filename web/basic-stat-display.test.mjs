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

test('every game-time stat uses identical six-stat levels to founder editor',()=>{
 const g=new Ecosystem(61513).gene();
 assert.equal(BASIC_STAT_GROUPS.length,6);
 for(const stat of BASIC_STATS){
  assert.equal(basicStatScore(g,stat.key),basicStatLevel(g,stat.key));
  assert.equal(basicStatValues(g)['stat_'+stat.key],basicStatLevel(g,stat.key));
 }
 for(const [key] of FOUNDER_FIELDS)
  assert.equal(geneLevel(g,key),founderLevel(key,g[key]),key);
 const html=abilityListHTML(g);
 for(const stat of BASIC_STATS)assert.ok(html.includes(stat.name));
 assert.equal((html.match(/class="ability-bar" /g)||[]).length,6);
 assert.ok(!html.includes('卵殻'));
 assert.ok(!html.includes('水草栽培'));
});
test('founder-only mapping lists all 37 loci and derived physiology formulas',()=>{
 const rows=formulaMappingRows();
 assert.equal(rows.length,37);
 assert.deepEqual(new Set(rows.map(x=>x.key)),new Set(FOUNDER_FIELDS.map(([key])=>key)));
 for(const stat of BASIC_STATS){
  for(const key of stat.genes)assert.equal(rows.find(row=>row.key===key).stat,stat.name);
 }
 for(const key of ['diet','repro','aquatic','albino'])
  assert.equal(rows.find(row=>row.key===key).stat,'独立設定');
 assert.ok(FOUNDER_DERIVED_FORMULAS.length>=12);
 const html=founderFormulaHTML();
 assert.ok(html.includes('全37遺伝子'));
 assert.ok(html.includes('基本ステータス'));
 assert.ok(html.includes('体重 bodyMass'));
 assert.ok(html.includes('基礎代謝 upkeep'));
 assert.ok(html.includes('独立設定'));
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
