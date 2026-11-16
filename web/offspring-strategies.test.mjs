import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem} from './simulation.js';

test('all four offspring survival traits are inherited and may mutate',()=>{
 const w=new Ecosystem(2026111701);
 const names=['nestChoice','parentFeeding','yolkReserve','juvenileCannibalism'];
 const a=w.gene(),b=w.gene();
 for(const key of names){
  assert.ok(a[key]>=0&&a[key]<=1,key);
  assert.equal(a.alleles[key].length,2,key);
 }
 const child=w.recombine(a,b);
 for(const key of names)assert.ok(child[key]>=0&&child[key]<=1,key);
 assert.equal(w.mutate(child).alleles.nestChoice.length,2);
});

test('nutrition-sensitive nest seeking favors food while costing finite travel energy',()=>{
 const w=new Ecosystem(2026111702),g={...w.gene(),aquatic:0,nestChoice:1};
 w.tiles.fill(3);w.grass.fill(0);w.climateEnabled=false;
 const parent=w.spawn(220,180,g);
 const near=w.cell(240,180);w.tiles[near]=0;w.grass[near]=100;
 w.rand=()=>.5;
 const nest=w.chooseNest(parent);
 assert.ok(w.nurseryFoodAt(240,180,g)>w.nurseryFoodAt(220,180,g));
 assert.equal(w.nurseryFoodAt(220,180,g),0);
 assert.ok(nest);
});

test('egg yolk reserve transfers parent calories with a conversion penalty',()=>{
 const w=new Ecosystem(2026111703),g={...w.gene(),aquatic:0,yolkReserve:1};
 const parent=w.spawn(220,180,g);
 parent.energy=210;parent.pregnancy={
  genomes:[g,g],parent:parent.id,otherParent:null,
  lineage:parent.lineage,generation:1,remaining:0,total:20
 };
 const before=parent.energy;
 w.layEgg(parent);
 assert.equal(w.eggs.length,2);
 assert.ok(w.eggs[0].energy>11+g.shell*9);
 assert.ok(parent.energy<=before-30);
 const committed=before-parent.energy;
 const extra=w.eggs.reduce((sum,e)=>sum-(11+g.shell*9)+e.energy,0);
 assert.ok(extra<committed,'yolk energy is not free');
});

test('feeding benefits juvenile but costs parent more than child receives',()=>{
 const w=new Ecosystem(2026111704),g={...w.gene(),parentFeeding:1};
 const parent=w.spawn(220,180,g);parent.energy=180;parent.stage='adult';
 const child=w.spawn(225,180,g,parent);child.energy=20;child.stage='juvenile';
 w.tick=parent.id%12;
 const p0=parent.energy,c0=child.energy;
 assert.equal(w.feedOffspring(parent,[child]),child);
 assert.ok(parent.energy<p0);
 assert.ok(child.energy>c0);
 assert.ok(p0-parent.energy>child.energy-c0);
 assert.ok(child.receivedParentFood>0);
 parent.energy=40;
 assert.equal(w.feedOffspring(parent,[child]),null);
});

test('a parent with no resources does not manufacture egg yolk or food',()=>{
 const w=new Ecosystem(2026111705),g={...w.gene(),yolkReserve:1,parentFeeding:1};
 const parent=w.spawn(220,180,g);parent.energy=29;
 parent.pregnancy={genomes:[g],parent:parent.id,otherParent:null,
  lineage:parent.lineage,generation:1,remaining:0,total:20};
 w.layEgg(parent);
 assert.ok(w.eggs[0].energy<=11+g.shell*9+1e-5);
 const juvenile=w.spawn(225,180,g,parent);juvenile.energy=0;
 assert.equal(w.feedOffspring(parent,[juvenile]),null);
});

test('desperate cannibal offspring pays a baseline metabolic price',()=>{
 const w=new Ecosystem(2026111706),g={...w.gene(),juvenileCannibalism:1};
 const child=w.spawn(210,160,g,{id:111,generation:0,lineage:11});
 child.age=15;child.energy=5;
 w.tiles.fill(3);w.grass.fill(0);w.waterweed.fill(0);
 const before=child.energy;
 w.step();
 assert.ok(child.energy<before);
});
