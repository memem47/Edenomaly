import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem} from './simulation.js';
import {GameSession,parseMeta,buyGameUpgrade,hasUpgrade,settleMeta} from './game-mode.js';
import {ObservationTracker,cameraSummary,centerOn,visibleInView,gameOverSummary} from './game-experience.js';

test('camera summary splits observed and offscreen life with non-mutating coordinates',()=>{
 const w=new Ecosystem(2026111401),a=w.gene();
 w.spawn(120,100,a);w.spawn(700,390,a);
 const zoom=centerOn({zoom:4,x:0,y:0},120,100);
 const stats=cameraSummary(w,zoom);
 assert.deepEqual({visible:stats.visible,offscreen:stats.offscreen},{visible:1,offscreen:1});
 assert.ok(visibleInView(zoom,120,100));
 assert.ok(!visibleInView(zoom,700,390));
 assert.equal(w.tick,0);
});
test('important events keep unseen species unnamed and gate remote clues behind a radar',()=>{
 const w=new Ecosystem(2026111402),base=w.gene();
 const founder=w.spawn(120,100,{...base,hornLength:0,tailLength:.8});
 const view=centerOn({zoom:4,x:0,y:0},120,100);
 const plain=new ObservationTracker(),radar=new ObservationTracker();
 plain.start(w);radar.start(w);
 const variant={...base,hornLength:.8,tailLength:0};
 const remote=w.spawn(700,400,variant);
 assert.notEqual(founder.category,remote.category);
 w.tick=20;
 const normal=plain.scan(w,view);
 const informed=radar.scan(w,view,{radar:true});
 assert.ok(!normal.some(e=>e.kind==='remote'),'remote discovery should not spoil without scanner');
 const hidden=informed.find(e=>e.kind==='remote');
 assert.ok(hidden);
 assert.ok(!hidden.message.includes(w.species.get(remote.category).name),'do not spoil species name');
 assert.ok(Number.isFinite(hidden.x));
 assert.equal(radar.scan(w,view,{radar:true}).length,0,'no duplicate events at same step');
});
test('hunger alerts are rate limited and no random numbers are consumed',()=>{
 const w=new Ecosystem(2026111403),g=w.gene(),a=w.spawn(120,100,g);
 const camera=centerOn({zoom:3,x:0,y:0},120,100),t=new ObservationTracker();
 t.start(w);a.energy=3;w.tick=20;
 const rng=w.rng,ev=t.scan(w,camera);
 assert.ok(ev.some(e=>e.kind==='danger'));
 w.tick=40;
 assert.ok(!t.scan(w,camera).some(e=>e.kind==='danger'));
 w.tick=160;
 assert.ok(t.scan(w,camera).some(e=>e.kind==='danger'));
 assert.equal(w.rng,rng);
});
test('rewards are spent once outside a run and unlocks persist in older stored meta',()=>{
 let meta=parseMeta('{"bank":8,"best":100,"runs":2}');
 assert.equal(meta.upgrades.radar,false);
 const bought=buyGameUpgrade(meta,'radar');
 assert.ok(bought);
 assert.equal(bought.bank,5);
 assert.ok(hasUpgrade(bought,'radar'));
 assert.equal(buyGameUpgrade(bought,'radar'),null,'no double purchase');
 assert.equal(buyGameUpgrade(bought,'invalid'),null);
 const reserve=buyGameUpgrade(bought,'reserve');
 assert.ok(hasUpgrade(reserve,'reserve'));
 assert.equal(reserve.bank,1);
 assert.deepEqual(parseMeta(JSON.stringify(reserve)),reserve);
 const world=new Ecosystem(2026111404),session=new GameSession(world);
 assert.ok(session.start(160,140,{reserve:true}));
 assert.equal(session.points,20);
 const world2=new Ecosystem(2026111405),session2=new GameSession(world2);
 assert.ok(session2.start(160,140));
 assert.equal(session2.points,15);
 world.units=[];world.eggs=[];world.runEndedTick=1000;session.observe();
 const ended=settleMeta(reserve,session);
 assert.equal(ended.bank,1+session.reward);
 assert.ok(hasUpgrade(ended,'radar'));
 assert.deepEqual(settleMeta(ended,session),{...ended,bank:ended.bank+session.reward},
  'settleMeta is controlled by the existing rewardRecorded UI guard');
});
test('game over summary retains reward and causal death summary',()=>{
 const w=new Ecosystem(2026111406),s=new GameSession(w);
 assert.ok(s.start(150,100));
 w.deathCauses={飢餓:4,感染:2};
 w.units=[];w.eggs=[];w.runEndedTick=200;
 s.observe();
 const out=gameOverSummary(w,s);
 assert.equal(out.mostCommonDeath,'飢餓');
 assert.equal(out.mostCommonDeathCount,4);
 assert.equal(out.reward,s.reward);
});
test('game screen connects start, reward, end, observation, and camera controls',async()=>{
 const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
 const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const ui=await readFile(new URL('./game-ui.js',import.meta.url),'utf8');
 for(const id of ['gameStartDialog','gameOverDialog','gameOverSummary','buyRadar',
  'buyReserve','observationStrip','gameEventFeed','followGroup','returnToGroup',
  'gameRetry','startGameConfirm']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.ok(app.includes('gameUI.start(x,y)'));
 assert.ok(app.includes('gameUI.startOptions()'));
 assert.ok(app.includes('gameUI.showOver()'));
 assert.ok(app.includes('gameUI.step()'));
 assert.ok(ui.includes("setView(centerOn({zoom:2.8"));
});
