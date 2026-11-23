import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem} from './simulation.js';
import {speciesReport,speciesCSV,parseSpeciesCSV,medianOf} from './species-statistics.js';

test('species metrics report every born individual and exact middle values',()=>{
 const w=new Ecosystem(20261110),g=w.gene();
 // Constitution remains a continuous per-species locus and is not a species
 // identity boundary; cosmetic feature changes may create new species.
 const a={...g,longevity:.6},b={...g,longevity:1.1},c={...g,longevity:1.9};
 const ua=w.spawn(160,140,a),ub=w.spawn(165,140,b),uc=w.spawn(170,140,c);
 const key=ua.category;
 assert.equal(ub.category,key);
 assert.equal(uc.category,key);
 const rows=speciesReport(w);
 const trait=rows.find(r=>r.category===key&&r.metric==='longevity'&&r.scope==='birth');
 assert.deepEqual([trait.min,trait.median,trait.max,trait.samples],[.6,1.1,1.9,3]);
 assert.equal(trait.species,w.species.get(key).name);
 assert.ok(rows.some(r=>r.scope==='birth'&&r.metric==='geneticMass'));
 assert.ok(rows.some(r=>r.scope==='living'&&r.metric==='energy'));
 assert.ok(rows.some(r=>r.scope==='living'&&r.metric==='actualMass'));
 const before=w.rng;speciesReport(w);
 assert.equal(w.rng,before,'analytics must never consume simulation RNG');
 w.die(ua,'test');w.die(ub,'test');w.die(uc,'test');
 const extinct=speciesReport(w);
 assert.equal(w.species.get(key).current,0);
 assert.equal(extinct.find(r=>r.category===key&&r.scope==='birth'&&r.metric==='longevity').samples,3);
 assert.ok(!extinct.some(r=>r.category===key&&r.scope==='living'));
});
test('exact median updates after births and remains stable without new births',()=>{
 const w=new Ecosystem(20261111),g=w.gene();
 for(const value of [.7,1.1,1.5,1.9])w.spawn(180,140,{...g,longevity:value});
 const get=()=>speciesReport(w).find(r=>r.metric==='longevity'&&r.scope==='birth').median;
 assert.equal(get(),1.3);assert.equal(get(),1.3);
 w.spawn(180,140,{...g,longevity:1.7});
 assert.equal(get(),1.5,'birth should invalidate median cache');
 assert.equal(medianOf([9,1,4,7]),5.5);
});
test('species reports can still be exported as CSV and reopened',()=>{
 const w=new Ecosystem(20261112),g=w.gene();
 w.spawn(180,120,g);
 const original=speciesReport(w,{run:2,version:'test'});
 const parsed=parseSpeciesCSV(speciesCSV(original));
 assert.equal(parsed.length,original.length);
 assert.deepEqual(parsed.slice(0,10),original.slice(0,10));
});
test('in-game species analysis opens without uploading a file',async()=>{
 const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
 const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const viewer=await readFile(new URL('./species-report-viewer.js',import.meta.url),'utf8');
 const reportHtml=await readFile(new URL('./species-report.html',import.meta.url),'utf8');
 assert.ok(html.includes('id="openSpeciesStatistics"'));
 assert.ok(html.includes('id="speciesStatisticsDialog"'));
 assert.ok(html.includes('species-report.html?embedded=1'));
 assert.ok(app.includes("speciesReport(game,{run:1,version:LOG_VERSION})"));
 assert.ok(app.includes('speciesDialog.showModal()'));
 assert.ok(app.includes('speciesDialog.addEventListener(\'close\''));
 assert.ok(viewer.includes("event.data?.type!=='edenomaly:species-report'"));
 assert.ok(viewer.includes('loadRows(event.data.rows'));
 assert.ok(reportHtml.includes('id="uploadPanel"'));
});
