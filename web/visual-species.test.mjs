import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,visibleSpeciesCategory,speciesNameFromCategory,
 visibleSkillMask,VISIBLE_SPECIES_SKILLS,pigmentClass} from './simulation.js';
import {editFounderGenome} from './founder-designer.js';

test('identical visible phenotypes have exactly the same species and name despite hidden traits',()=>{
 const w=new Ecosystem(2026112808),base=w.gene();
 const a=editFounderGenome(base,{skillCooperate:0,skillAmbush:0});
 const b=editFounderGenome(base,{skillCooperate:1,skillAmbush:1});
 assert.equal(visibleSpeciesCategory(a),visibleSpeciesCategory(b));
 assert.equal(w.category(a),w.category(b));
 assert.equal(w.name(w.category(a)),w.name(w.category(b)));
});
test('every major inherited skill has a visible emblem and a distinct species class',()=>{
 const w=new Ecosystem(2026112809);
 const base=editFounderGenome(w.gene(),Object.fromEntries(VISIBLE_SPECIES_SKILLS.map(k=>[k,0])));
 for(let i=0;i<VISIBLE_SPECIES_SKILLS.length;i++){
  const key=VISIBLE_SPECIES_SKILLS[i],child=editFounderGenome(base,{[key]:1});
  assert.equal(visibleSkillMask(child),1<<i,key);
  assert.notEqual(w.category(base),w.category(child),key);
  assert.notEqual(w.name(w.category(base)),w.name(w.category(child)),key);
 }
});
test('visible color, actual body size and eye number classify different species',()=>{
 const w=new Ecosystem(10102),a=w.gene();
 const b={...a,r:15};
 assert.notEqual(w.category(a),w.category(b));
 const eyes={...a,eyes:a.eyes===0?6:0};
 assert.notEqual(w.category(a),w.category(eyes));
 assert.equal(typeof pigmentClass(a),'string');
});
test('visual species keys sample every class dimension without name collisions',()=>{
 const names=new Set();
 for(let c=0;c<7;c++)for(let size=0;size<3;size++)for(let shape=0;shape<3;shape++)
 for(let eyes=0;eyes<4;eyes++)for(let appendage=0;appendage<6;appendage++)
 for(let diet=0;diet<3;diet++)for(let aquatic=0;aquatic<2;aquatic++)
 for(let repro=0;repro<3;repro++)for(const mask of [0,1,17,85,170,255]){
  const key=['vis',c,size,shape,eyes,appendage,diet,aquatic,repro,mask].join('-');
  const name=speciesNameFromCategory(key);
  assert.match(name,/^[ァ-ヶ]{6}$/);
  if(names.has(name))throw new Error('Name collision: '+key+' => '+name);
  names.add(name);
 }
 assert.equal(names.size,7*3*3*4*6*3*2*3*6);
});
