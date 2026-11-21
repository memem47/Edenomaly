import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Ecosystem} from './simulation.js';
import {editFounderGenome} from './founder-designer.js';
import {drawFounderAppearance} from './founder-preview.js';

function fakeCanvas(){
 const calls=[];
 const gradient={addColorStop(...args){calls.push(['gradient',...args]);}};
 const ctx=new Proxy({},{
  get(_,key){
   if(key==='createRadialGradient'||key==='createLinearGradient')return (...args)=>{calls.push([key,...args]);return gradient;};
   if(key==='canvas')return {width:320,height:220};
   return (...args)=>{calls.push([key,...args]);};
  },
  set(){return true;}
 });
 return {width:320,height:220,getContext:()=>ctx,calls};
}

test('before-and-after preview renders both genomes with shared world graphics',()=>{
 const world=new Ecosystem(202611211),baseline=world.gene();
 const edited=editFounderGenome(baseline,{eyes:6,r:12,elongation:2.7,hornLength:1,pattern:1});
 const initial=JSON.stringify(baseline),after=JSON.stringify(edited);
 const a=fakeCanvas(),b=fakeCanvas();
 drawFounderAppearance(a,baseline,18);
 drawFounderAppearance(b,edited,18);
 assert.ok(a.calls.length>25);
 assert.ok(b.calls.length>25);
 assert.ok(b.calls.some(call=>call[0]==='createRadialGradient'));
 assert.equal(JSON.stringify(baseline),initial);
 assert.equal(JSON.stringify(edited),after);
 assert.equal(world.tick,0,'preview cannot advance the ecosystem');
 assert.equal(world.units.length,0,'preview cannot spawn live organisms');
});

test('preview is wired into initial render, slider changes, and animation',async()=>{
 const ui=await readFile(new URL('./founder-screens.js',import.meta.url),'utf8');
 const css=await readFile(new URL('./style.css',import.meta.url),'utf8');
 assert.ok(!ui.includes('founderBeforeCanvas'));
 assert.ok(ui.includes('founderAfterCanvas'));
 assert.ok(ui.includes('type="number" data-trait='));
 assert.ok(ui.includes('drawFounderAppearance(edited,g,previewTick)'));
 assert.ok(ui.includes('updateEditorSummary();'));
 assert.ok(ui.includes('requestAnimationFrame(animatePreview)'));
 assert.ok(css.includes('.founder-preview-section'));
 assert.ok(css.includes('position:sticky'));
});

test('every editable ability changes a functional visual channel',async()=>{
 const {abilityAppearance}=await import('./slime-ornaments.js');
 const {FOUNDER_FIELDS}=await import('./founder-designer.js');
 const g=new Ecosystem(202611213).gene();
 for(const [key,,min,max] of FOUNDER_FIELDS){
  assert.notDeepEqual(abilityAppearance({...g,[key]:min}),abilityAppearance({...g,[key]:max}),key);
 }
});
