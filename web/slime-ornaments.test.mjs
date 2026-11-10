import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem} from './simulation.js';
import {ornamentTraits,ornamentVisibility,drawOrnamentsBehind,drawOrnamentsFront} from './slime-ornaments.js';

const recordingCanvas=()=>{
 const calls={move:[],curve:[],ellipses:[],ellipse:0,arc:0,strokes:0,fill:0};
 const ctx=new Proxy({
  moveTo(...args){calls.move.push(args);},
  bezierCurveTo(...args){calls.curve.push(args);},
  quadraticCurveTo(...args){calls.curve.push(args);},
  ellipse(...args){calls.ellipse++;calls.ellipses.push(args);},
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

test('cute round tail and forehead nubs remain visible without sharp curves',()=>{
 const {ctx,calls}=recordingCanvas();
 const gene={wet:.8,dry:.2,rock:.2,albino:0,tailLength:.75,
  hornLength:.72,antennaLength:0,pattern:0,guard:.8,eyes:3};
 drawOrnamentsBehind(ctx,gene,8,6,100,4);
 assert.ok(calls.ellipses.length>=7,'bead tail and pair of double nubs');
 assert.ok(calls.ellipses.some(p=>p[0]<-8),'tail reaches rear of body');
 assert.ok(calls.ellipses.some(p=>p[0]>0&&p[1]<-4),'horns stay at forehead');
 assert.equal(calls.curve.length,0,'no triangular points or filaments');
 assert.ok(calls.fill>=7);
});
test('horns always form a left-right symmetric pair independent of guard',()=>{
 for(const guard of [0,.2,.7,1]){
  for(const hornLength of [.1,.4,.85]){
   const {ctx,calls}=recordingCanvas();
   const gene={wet:.3,dry:.2,rock:.3,albino:0,tailLength:0,
    hornLength,antennaLength:0,pattern:0,guard,eyes:3};
   drawOrnamentsBehind(ctx,gene,10,7,100,4);
   // Every bead has two calls, base and gleam, so compare the base beads
   // by matching identical ellipses across the forward (X) axis.
   const groups=calls.ellipses.filter(([x,y,rx,ry])=>rx>1&&ry>1);
   assert.ok(groups.some(p=>p[1]<0),'horn on upper side');
   assert.ok(groups.some(p=>p[1]>0),'horn on lower side');
   for(const [x,y,rx,ry] of groups.filter(p=>p[1]<0)){
    assert.ok(groups.some(p=>Math.abs(p[0]-x)<1e-9&&
     Math.abs(p[1]+y)<1e-9&&Math.abs(p[2]-rx)<1e-9&&
     Math.abs(p[3]-ry)<1e-9),'horn bead has matching mirrored counterpart');
   }
   assert.ok(groups.every(p=>p[0]>0),'both horns attach in the forward half');
  }
 }
});
test('antennae attach only at the head and use connected spheres',()=>{
 const g={wet:.6,dry:.5,rock:.1,albino:0,tailLength:0,hornLength:0,
  antennaLength:.8,pattern:0,guard:.3,eyes:4,deception:.2};
 const {ctx,calls}=recordingCanvas();
 drawOrnamentsFront(ctx,g,8,6,24,5);
 assert.equal(calls.curve.length,0,'no long thin or curved antenna lines');
 const centers=calls.ellipses.map(p=>({x:p[0],y:p[1]}));
 assert.ok(centers.length>=4,'rounded antenna segments and tips');
 assert.ok(centers.every(p=>p.x>0),'all feelers remain on the front half');
 assert.ok(centers.every(p=>p.y<0),'all feelers remain on the forehead');
});
test('zero ornaments do not draw and freckles appear as soft ovals',()=>{
 const g={wet:.6,dry:.5,rock:.1,albino:0,tailLength:0,hornLength:0,
  antennaLength:0,pattern:0,guard:.3,eyes:4,deception:.2};
 let {ctx,calls}=recordingCanvas();
 drawOrnamentsBehind(ctx,g,8,6);
 drawOrnamentsFront(ctx,g,8,6);
 assert.equal(calls.fill,0);
 ({ctx,calls}=recordingCanvas());
 drawOrnamentsFront(ctx,{...g,antennaLength:.08,pattern:.07},8,6,24,5);
 assert.ok(calls.ellipse>=4,'soft oval spots and plump feelers');
 assert.equal(calls.curve.length,0);
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
