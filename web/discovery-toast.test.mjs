import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDiscoveryToastQueue} from './discovery-toast-queue.js';

function fakeClock(){
 const jobs=new Map();let next=0;
 return {
  schedule(fn,delay){assert.equal(delay,5000);const id=++next;jobs.set(id,fn);return id;},
  cancel(id){jobs.delete(id);},
  advance(){const id=jobs.keys().next().value;if(id===undefined)return false;
   const fn=jobs.get(id);jobs.delete(id);fn();return true;},
  get size(){return jobs.size;}
 };
}
test('new species notifications appear for five seconds without advancing simulation time',()=>{
 const time=fakeClock(),shown=[],hidden=[],q=createDiscoveryToastQueue({
  show:item=>shown.push(item),hide:item=>hidden.push(item),
  schedule:time.schedule,cancel:time.cancel
 });
 const a={species:{name:'A'}},b={species:{name:'B'}},c={species:{name:'C'}};
 q.push([a,b,c]);assert.deepEqual(shown,[a]);
 assert.equal(q.pending,2);assert.equal(q.current,a);
 time.advance();assert.deepEqual(shown,[a,b]);assert.deepEqual(hidden,[a]);
 time.advance();assert.deepEqual(shown,[a,b,c]);
 time.advance();assert.equal(q.current,null);assert.equal(time.size,0);
 assert.deepEqual(hidden,[a,b,c]);
});
test('reset cancels old notifications and allows fresh game notifications',()=>{
 const time=fakeClock(),shown=[],hidden=[],q=createDiscoveryToastQueue({
  show:x=>shown.push(x),hide:x=>hidden.push(x),
  schedule:time.schedule,cancel:time.cancel
 });
 q.push(['before','queued']);q.clear();
 assert.equal(time.size,0);assert.equal(q.pending,0);
 assert.equal(q.current,null);assert.deepEqual(hidden,['before']);
 q.push(['after']);assert.deepEqual(shown,['before','after']);
 assert.equal(time.size,1);
});
test('game UI exposes a persistent detailed/quick setting and quick mode never pauses',async()=>{
 const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const screen=await readFile(new URL('./founder-screens.js',import.meta.url),'utf8');
 const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
 const css=await readFile(new URL('./style.css',import.meta.url),'utf8');
 assert.ok(html.includes('id="discoveryDisplayMode"'));
 assert.ok(html.includes('value="detailed"'));
 assert.ok(html.includes('value="quick"'));
 assert.ok(app.includes('edenomaly.discoveryDisplayMode'));
 assert.ok(app.includes('if(unseen.length&&screens.announce(unseen)){running=false;acc=0;}'));
 assert.ok(screen.includes("if(getDiscoveryMode()==='quick')"));
 assert.ok(screen.includes('quickQueue.push(categories)'));
 assert.ok(screen.includes('return false; // Never stop game time'));
 assert.ok(screen.includes('drawFounderAppearance(portrait,sp.genome,0)'));
 assert.ok(screen.includes('name.textContent=sp.name'));
 assert.ok(screen.includes('quickQueue.clear()'));
 assert.ok(css.includes('position:fixed;top:14px;left:14px'));
});
