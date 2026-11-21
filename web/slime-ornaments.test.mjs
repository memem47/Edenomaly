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
  arc(){calls.arc++;},stroke(){calls.strokes++;},fill(){calls.fill++}
 },{get(o,key){return key in o?o[key]:()=>{};},set(o,k,v){o[k]=v;return true;}});
 return {ctx,calls};
};
const bare={wet:0,dry:.2,rock:.2,aquatic:0,dispersal:0,jaw:.2,guard:0,
 predatorSense:0,eyes:2,deception:0,resist:0,albino:0};
const horn={...bare,jaw:2.5,guard:1};
const tail={...bare,wet:1,aquatic:1,dispersal:1};
const antenna={...bare,predatorSense:1,eyes:6};
const spotted={...bare,deception:1,resist:1};

test('appearance derives from real abilities rather than decorative genes',()=>{
 assert.equal(ornamentVisibility(0),0);
 assert.ok(ornamentVisibility(.1)>.3);
 assert.ok(ornamentTraits(horn).horn>ornamentTraits(bare).horn);
 assert.ok(ornamentTraits(tail).tail>ornamentTraits(bare).tail);
 assert.ok(ornamentTraits(antenna).antenna>ornamentTraits(bare).antenna);
 assert.ok(ornamentTraits(spotted).pattern>ornamentTraits(bare).pattern);
 assert.deepEqual(ornamentTraits({...horn,tailLength:1,hornLength:0,antennaLength:1,pattern:1}),ornamentTraits(horn));
});
test('round tails and mirrored horns remain attached to slime silhouette',()=>{
 const {ctx,calls}=recordingCanvas(),g={...horn,...tail,jaw:2.5,guard:1};
 drawOrnamentsBehind(ctx,g,8,6,100,4);
 assert.ok(calls.ellipses.filter(p=>p[0]<-8).length>=2);
 const before=calls.ellipses.length;
 drawOrnamentsFront(ctx,g,8,6,100,4);
 const lobes=calls.ellipses.slice(before).filter(p=>p[2]>.7&&p[3]>.7);
 assert.ok(lobes.length>=4,'two rounded forehead horns with bead tips');
 assert.ok(lobes.some(p=>p[1]>1)&&lobes.some(p=>p[1]<-1));
 assert.ok(lobes.every(([x,y,rx,ry])=>(x+rx)**2/8**2+(Math.abs(y)+ry)**2/6**2<1.5));
 assert.equal(calls.curve.length,0);
});
test('defensive horns form a symmetric pair, independently of former horn gene',()=>{
 for(const guard of [.6,.8,1]){
  const g={...horn,guard};
  const {ctx,calls}=recordingCanvas();
  drawOrnamentsFront(ctx,g,10,7,100,4);
  const groups=calls.ellipses.filter(([x,y,rx,ry])=>rx>1&&ry>1);
  assert.ok(groups.some(p=>p[1]<0));
  assert.ok(groups.some(p=>p[1]>0));
  for(const [x,y,rx,ry]of groups.filter(p=>p[1]<0))
   assert.ok(groups.some(p=>Math.abs(p[0]-x)<1e-9&&Math.abs(p[1]+y)<1e-9&&
    Math.abs(p[2]-rx)<1e-9&&Math.abs(p[3]-ry)<1e-9));
  assert.ok(groups.every(p=>p[0]>0));
 }
});
test('high predator sensing produces paired antennae on the forward face',()=>{
 for(const eyes of [0,1,2,4,6]){
  const g={...antenna,eyes}, {ctx,calls}=recordingCanvas();
  drawOrnamentsFront(ctx,g,8,6,24,5);
  const centers=calls.ellipses.filter(p=>p[2]>.7&&p[3]>.7);
  assert.ok(centers.length>=4);
  assert.ok(centers.every(p=>p[0]>0&&Math.abs(p[1])<4));
  assert.ok(centers.some(p=>p[1]>0)&&centers.some(p=>p[1]<0));
  assert.equal(calls.curve.length,0);
 }
});
test('unadapted form is plain, evolved camouflage adds soft spots',()=>{
 let {ctx,calls}=recordingCanvas();
 drawOrnamentsBehind(ctx,bare,8,6);
 drawOrnamentsFront(ctx,bare,8,6);
 assert.equal(calls.fill,0);
 ({ctx,calls}=recordingCanvas());
 drawOrnamentsFront(ctx,spotted,8,6);
 assert.ok(calls.ellipse>=3);
 assert.equal(calls.curve.length,0);
});
test('rendering ornaments never consumes ecosystem randomness',()=>{
 const w=new Ecosystem(202611112),g=w.gene(),before=w.rng;
 const {ctx}=recordingCanvas();
 for(let i=0;i<30;i++){drawOrnamentsBehind(ctx,g,7,5,i,1);drawOrnamentsFront(ctx,g,7,5,i,1);}
 assert.equal(w.rng,before);
});
