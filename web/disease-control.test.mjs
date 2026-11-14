import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem} from './simulation.js';
import {GameSession} from './game-mode.js';
import {EcologyLogbook,observeEcology} from './ecology-log.js';
import {gameRunReport,saveGameRunReport,readGameRunHistory} from './game-run-log.js';
import {ObservationTracker,centerOn} from './game-experience.js';

test('9 point local clinic reduces infections and protects nearby life temporarily',()=>{
 const w=new Ecosystem(202611141),s=new GameSession(w);
 assert.ok(s.start(150,130));
 const focus=w.units[0],remote=w.spawn(700,420,focus.g);
 focus.infection=70;remote.infection=90;
 const before=s.points;
 assert.ok(s.canIntervene('clinic',focus.x,focus.y));
 assert.ok(s.intervene('clinic',focus.x,focus.y));
 assert.equal(s.points,before-9);
 assert.equal(s.spent,9);
 assert.equal(focus.infection,25,'illness duration shortened by 45 ticks');
 assert.equal(remote.infection,90,'far-off infections unaffected');
 assert.ok(focus.infectionProtectionUntil>=w.tick+110);
 assert.ok(s.interventionHistory.at(-1).infectedBefore>=2);
 assert.equal(s.interventionHistory.at(-1).kind,'clinic');
 assert.equal(s.canIntervene('clinic',650,130),false,'no free empty-area action');
 assert.equal(s.canIntervene('clinic',focus.x,focus.y),true,'can treat residual infection');
});

test('local intervention never alters genome or restores HP or creates descendants',()=>{
 const w=new Ecosystem(202611142),s=new GameSession(w);
 s.start(210,150);
 const u=w.units[0];u.infection=70;u.hp=20;
 const dna=JSON.stringify(u.g),before=w.units.length;
 assert.ok(s.intervene('clinic',u.x,u.y));
 assert.equal(JSON.stringify(u.g),dna);
 assert.equal(u.hp,20,'no free healing');
 assert.equal(w.units.length,before);
 assert.ok(!w.units.some(x=>x.infectionProtectionUntil>w.tick+111));
});

test('visible infected organisms trigger a rate-limited actionable warning',()=>{
 const w=new Ecosystem(202611143),g=w.gene(),u=w.spawn(155,160,g);
 const tracker=new ObservationTracker();tracker.start(w);u.infection=40;
 const view=centerOn({zoom:3,x:0,y:0},155,160);w.tick=20;
 const first=tracker.scan(w,view);
 assert.ok(first.some(e=>e.kind==='infection'&&e.message.includes('防疫')));
 const warning=first.find(e=>e.kind==='infection');
 assert.ok(Number.isFinite(warning.x)&&Number.isFinite(warning.y));
 w.tick=40;assert.ok(!tracker.scan(w,view).some(e=>e.kind==='infection'));
 w.tick=100;assert.ok(tracker.scan(w,view).some(e=>e.kind==='infection'));
});

test('completed run snapshot persists 50 step ecology, causes and interventions across app versions',()=>{
 const state=new Map(),storage={
  getItem:k=>state.get(k)??null,setItem:(k,v)=>state.set(k,v)
 };
 const w=new Ecosystem(202611144),session=new GameSession(w);
 const book=new EcologyLogbook(storage,'2026.11.14.2');
 session.start(190,150);book.start(w.initialSeed);
 book.record(observeEcology(w),true);
 w.units[0].infection=60;
 assert.ok(session.intervene('clinic',w.units[0].x,w.units[0].y));
 w.tick=53;w.deathCauses['感染症']=2;
 book.record(observeEcology(w),true);
 w.units=[];w.eggs=[];w.runEndedTick=53;session.observe();
 const report=gameRunReport(w,session,book,'2026.11.14.2','runA');
 assert.equal(report.samples.length,2);
 assert.equal(report.step,53);
 assert.equal(report.deathCauses['感染症'],2);
 assert.equal(report.interventions[0].kind,'clinic');
 assert.ok(saveGameRunReport(storage,report));
 assert.equal(readGameRunHistory(storage)[0].runId,'runA');
 // A newer app build must not delete the independent game run history.
 const newer=new EcologyLogbook(storage,'2026.11.15.0');
 assert.ok(newer);
 assert.equal(readGameRunHistory(storage)[0].samples.length,2);
 const replaced={...report,score:999};
 assert.ok(saveGameRunReport(storage,replaced));
 assert.equal(readGameRunHistory(storage).length,1,'repeat saving is idempotent');
 assert.equal(readGameRunHistory(storage)[0].score,999);
});

test('game UI exports terminal snapshots, archive, and manual ZIP fallback',async()=>{
 const {readFile}=await import('node:fs/promises');
 const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
 for(const id of ['downloadGameReport','gameLogStatus','gameLogHelp'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(app.includes('ecologyLog.end(final)'));
 assert.ok(app.includes('speciesLog.end(game)'));
 assert.ok(app.includes('exportAllLogs(true)'));
 assert.ok(app.includes('saveGameRunReport(localLogStorage,lastGameReport)'));
 assert.ok(app.includes('edenomaly-game-report.json'));
});
