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

test('round tail behind and mirrored horns in front of the body',()=>{
 const {ctx,calls}=recordingCanvas();
 const gene={wet:.8,dry:.2,rock:.2,albino:0,tailLength:.75,
  hornLength:.72,antennaLength:0,pattern:0,guard:.8,eyes:3};
 drawOrnamentsBehind(ctx,gene,8,6,100,4);
 const tails=calls.ellipses.filter(p=>p[0]<-8);
 assert.ok(tails.length>=2,'visible rear bead tail');
 const before=calls.ellipses.length;
 drawOrnamentsFront(ctx,gene,8,6,100,4);
 const lobes=calls.ellipses.slice(before).filter(p=>p[2]>1&&p[3]>1);
 assert.ok(lobes.length>=4,'paired double nubs are drawn over body');
 assert.ok(lobes.some(p=>p[1]>4)&&lobes.some(p=>p[1]<-4));
 assert.equal(calls.curve.length,0,'no triangular points or filaments');
});
test('horns always form a mirrored pair even if their guard or eye genes change',()=>{
 for(const guard of [0,.2,.7,1]){
  for(const hornLength of [.1,.4,.85]){
   const {ctx,calls}=recordingCanvas();
   const gene={wet:.3,dry:.2,rock:.3,albino:0,tailLength:0,
    hornLength,antennaLength:0,pattern:0,guard,eyes:3};
   drawOrnamentsFront(ctx,gene,10,7,100,4);
   const groups=calls.ellipses.filter(([x,y,rx,ry])=>rx>1&&ry>1);
   assert.ok(groups.some(p=>p[1]<0),'horn on upper side');
   assert.ok(groups.some(p=>p[1]>0),'horn on lower side');
   for(const [x,y,rx,ry] of groups.filter(p=>p[1]<0)){
    assert.ok(groups.some(p=>Math.abs(p[0]-x)<1e-9&&
     Math.abs(p[1]+y)<1e-9&&Math.abs(p[2]-rx)<1e-9&&
     Math.abs(p[3]-ry)<1e-9),'matching mirrored horn bead');
   }
   assert.ok(groups.every(p=>p[0]>0),'both horns attach in forward half');
  }
 }
});
test('head-only antennae form symmetric short bulb chains',()=>{
 for(const eyes of [0,1,2,4,6]){
  const g={wet:.6,dry:.5,rock:.1,albino:0,tailLength:0,hornLength:0,
   antennaLength:.8,pattern:0,guard:.3,eyes,deception:.2};
  const {ctx,calls}=recordingCanvas();
  drawOrnamentsFront(ctx,g,8,6,24,5);
  assert.equal(calls.curve.length,0,'no filaments');
  const centers=calls.ellipses.filter(p=>p[2]>.7&&p[3]>.7);
  assert.ok(centers.length>=4,'short rounded feelers');
  assert.ok(centers.every(p=>p[0]>0),'all feelers in forward half');
  assert.ok(centers.some(p=>p[1]>0)&&centers.some(p=>p[1]<0));
  for(const p of centers.filter(p=>p[1]<0))
   assert.ok(centers.some(q=>Math.abs(p[0]-q[0])<1e-9&&
     Math.abs(p[1]+q[1])<1e-9),'matched feelers');
 }
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
