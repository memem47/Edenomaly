import test from 'node:test';
import assert from 'node:assert/strict';
import {differenceMagnitude,rankDifferences} from './discovery-diff.js';
test('ranks by normalized change rather than unrelated raw units',()=>{
 const rows=[
  {index:0,score:differenceMagnitude('idealTemp',25,[20],-5,40)},
  {index:1,score:differenceMagnitude('eyes',5,[2],0,6)},
  {index:2,score:differenceMagnitude('dry',.75,[.5],0,1)}
 ];
 assert.deepEqual(rankDifferences(rows).map(r=>r.index),[1,2,0]);
});
test('uses larger absolute distance from either parent regardless of sign',()=>{
 assert.equal(differenceMagnitude('wet',.5,[.2,.9],0,1),.4);
 assert.equal(differenceMagnitude('wet',.5,[.9,.2],0,1),.4);
});
test('derived metrics use relative scale; no parents or zero range are safe',()=>{
 assert.equal(differenceMagnitude('speed',4,[2]),.5);
 assert.equal(differenceMagnitude('unknown',4,[]),0);
 assert.ok(Number.isFinite(differenceMagnitude('x',1,[0],0,0)));
});
test('same difference preserves listed order',()=>{
 assert.deepEqual(rankDifferences([{index:2,score:.2},{index:0,score:.2}]).map(r=>r.index),[0,2]);
});
