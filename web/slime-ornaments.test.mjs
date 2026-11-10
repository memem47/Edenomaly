import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem} from './simulation.js';
import {ornamentTraits,ornamentVisibility,drawOrnamentsBehind,drawOrnamentsFront} from './slime-ornaments.js';

const recordingCanvas=()=>{
 const calls={move:[],curve:[],ellipse:0,arc:0,strokes:0,fill:0};
 const ctx=new Proxy({
  moveTo(...args){calls.move.push(args);},
  bezierCurveTo(...args){calls.curve.push(args);},
  quadraticCurveTo(...args){calls.curve.push(args);},
  ellipse(){calls.ellipse++;},
  arc(){calls.arc++;},
  stroke(){calls.strokes++;},
  fill(){calls.fill++;}
 },{get(o,key){return key in o?o[key]:()=>{};},set(o,k,v){o[k]=v;return true;}});
 return {ctx,calls};
};

test('visual size is more readable at low gene expression without changing genotype',()=>{
 assert.equal(ornamentVisibility(0),0);
 assert.ok(ornamentVisibility(.10)>.30);
 assert.ok(ornamentVisibility(.15)>.40);
 assert.ok(ornamentVisibility(.5)<1);
 assert.equal(ornamentVisibility(1),1);
 const world=new Ecosystem(20261111),gene=world.gene(),before=JSON.stringify(gene);
 const {ctx}=recordingCanvas();
 drawOrnamentsBehind(ctx,{...gene,tailLength:.1,hornLength:.1},8,6,125,8);
 drawOrnamentsFront(ctx,{...gene,antennaLength:.1,pattern:.1},8,6,125,8);
 assert.equal(JSON.stringify(gene),before);
});

test('enlarged tail and horns extend beyond silhouette in drawing coordinates',()=>{
 const {ctx,calls}=recordingCanvas();
 const gene={wet:.8,dry:.2,rock:.2,albino:0,tailLength:.15,
  hornLength:.18,antennaLength:0,pattern:0,guard:.8,eyes:3};
 drawOrnamentsBehind(ctx,gene,8,6,100,4);
 const points=calls.curve.flatMap(args=>args.reduce((arr,v,i)=>i%2===0?[...arr,{x:v,y:args[i+1]}]:arr,[]));
 assert.ok(points.some(p=>p.x<-12),'tail must extend several pixels behind an 8px-radius slime');
 assert.ok(points.some(p=>p.y<-10),'horns must be above body and readable');
 assert.ok(calls.fill>=3,'tail and both horns are drawn');
});

test('zero ornament genes draw no appendages, visible antennae and pattern do',()=>{
 const g={wet:.6,dry:.5,rock:.1,albino:0,tailLength:0,hornLength:0,
  antennaLength:0,pattern:0,guard:.3,eyes:4,deception:.2};
 let {ctx,calls}=recordingCanvas();
 drawOrnamentsBehind(ctx,g,8,6);
 drawOrnamentsFront(ctx,g,8,6);
 assert.equal(calls.fill,0);
 ({ctx,calls}=recordingCanvas());
 drawOrnamentsFront(ctx,{...g,antennaLength:.08,pattern:.07},8,6,24,5);
 assert.ok(calls.arc>=1,'antenna tip must be rendered');
 assert.ok(calls.ellipse>=2,'membrane and spots must be rendered');
});

test('ornaments never advance the ecosystem RNG',()=>{
 const w=new Ecosystem(202611112),g=w.gene(),prior=w.rng;
 const {ctx}=recordingCanvas();
 for(let i=0;i<30;i++){
  drawOrnamentsBehind(ctx,g,7,5,i,1);
  drawOrnamentsFront(ctx,g,7,5,i,1);
 }
 assert.equal(w.rng,prior);
 assert.deepEqual(ornamentTraits({...g,tailLength:2}).tail,1);
});
