import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,WORLD} from './simulation.js';
import {DNA_KEYS,expressDNA} from './genome-model.js';
import {LINKAGE_GROUPS} from './linkage-model.js';

test('digging is inherited and covered by the chromosome model',()=>{
 assert.ok(DNA_KEYS.includes('skillDig'));
 assert.equal(LINKAGE_GROUPS.flat().filter(k=>k==='skillDig').length,1);
 const w=new Ecosystem(2026112811);
 const g=w.gene();
 const child=expressDNA({dna:{...g.dna,skillDig:1}});
 assert.equal(child.dna.skillDig,1);
 assert.ok(child.digging>0);
});

test('digging produces a dry hole before rainfall and uses energy',()=>{
 const w=new Ecosystem(2026112812);
 w.wildernessMode=true;w.reset();
 const u={dead:false,dormant:false,stage:'adult',g:{dna:{skillDig:1},aquatic:0},
  energy:200,hydration:100,x:w.wildernessOrigin.x,y:w.wildernessOrigin.y,id:777};
 assert.equal(w.excavate(u),true);
 assert.ok([...w.excavationDepth].some(d=>d>0));
 assert.equal(w.tiles.filter(t=>t===1).length,3,'no free pond from excavation alone');
 assert.ok(u.energy<200);
 for(let tick=12;tick<=240;tick+=12){w.tick=tick;w.weather='sunny';w.updateExcavations();}
 assert.equal(w.tiles.filter(t=>t===1).length,3,'no rain means no new pond');
});

test('rain fills holes and opens connected water channels',()=>{
 const w=new Ecosystem(2026112813);
 w.wildernessMode=true;w.reset();
 const cx=Math.floor(WORLD.columns/2),cy=Math.floor(WORLD.rows/2);
 const holeA=cy*WORLD.columns+cx+3;
 const holeB=cy*WORLD.columns+cx+4;
 for(const i of [holeA,holeB]){
  assert.equal(w.tiles[i],2);
  w.excavationDepth[i]=3;
 }
 const originalCount=w.tiles.filter(t=>t===1).length;
 w.weather='rain';w.weatherStrength=1;w.rainfall=100;
 for(let tick=12;tick<=240;tick+=12){w.tick=tick;w.updateExcavations();}
 assert.equal(w.tiles[holeA],1);
 assert.equal(w.tiles[holeB],1);
 assert.equal(w.tiles.filter(t=>t===1).length,originalCount+2);
 assert.ok(w.rainPondEvents>=2);
 assert.equal(w.excavationDepth[holeA],0,'filled holes become permanent water terrain');
 w.reset();
 assert.equal(w.excavationDepth.filter(x=>x>0).length,0);
});
