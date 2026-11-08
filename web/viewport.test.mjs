import test from 'node:test';
import assert from 'node:assert/strict';
import {fitView,screenToWorld,worldToScreen,zoomAround,panBy,MAX_ZOOM} from './viewport.js';
const W=800,H=460;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} is not ${b}`);

test('zoom 1 covers exactly the original simulation world',()=>{
 const view=fitView({zoom:1,x:200,y:100},W,H);
 assert.deepEqual(view,{zoom:1,x:0,y:0});
 assert.deepEqual(screenToWorld(view,75,140,W,H),{x:75,y:140});
 assert.deepEqual(worldToScreen(view,400,230,W,H),{x:400,y:230});
});

test('zoom anchors the actual mouse position and inverts to world coordinates',()=>{
 const before={zoom:1,x:0,y:0};
 const anchor={x:164,y:328};
 const target=zoomAround(before,3,anchor.x,anchor.y,W,H);
 const world=screenToWorld(target,anchor.x,anchor.y,W,H);
 close(world.x,anchor.x);close(world.y,anchor.y);
 const screen=worldToScreen(target,world.x,world.y,W,H);
 close(screen.x,anchor.x);close(screen.y,anchor.y);
});

test('panning stays inside edges and cannot move outside the world',()=>{
 const zoom=zoomAround({zoom:1,x:0,y:0},4,400,230,W,H);
 let view=panBy(zoom,-99999,-99999,W,H);
 close(view.x,W-W/4);close(view.y,H-H/4);
 view=panBy(view,99999,99999,W,H);
 close(view.x,0);close(view.y,0);
});

test('zooming back to full view resets pan, no matter the anchor or starting view',()=>{
 const view=zoomAround({zoom:4,x:150,y:85},1,55,87,W,H);
 assert.deepEqual(view,{zoom:1,x:0,y:0});
});

test('magnification always fits within the permitted range',()=>{
 assert.equal(fitView({zoom:999,x:0,y:0},W,H).zoom,MAX_ZOOM);
 assert.equal(fitView({zoom:0,x:1,y:1},W,H).zoom,1);
 const world=screenToWorld({zoom:6,x:9999,y:9999},900,800,W,H);
 assert.ok(world.x<W&&world.x>=0&&world.y<H&&world.y>=0);
});

test('after moving the camera, a pointer event still targets the correct slime or terrain',()=>{
 const camera={zoom:2.5,x:180,y:60};
 const target={x:350,y:200};
 const pixel=worldToScreen(camera,target.x,target.y,W,H);
 const hit=screenToWorld(camera,pixel.x,pixel.y,W,H);
 close(hit.x,target.x);close(hit.y,target.y);
});
