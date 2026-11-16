import test from 'node:test';
import assert from 'node:assert/strict';
import {Ecosystem,seasonalPlantGrowth} from './simulation.js';

test('winter dormancy, spring rebound and summer drought have distinct rates',()=>{
 const spring=seasonalPlantGrowth('spring',19,0,45,3);
 const autumn=seasonalPlantGrowth('autumn',19,0,45,3);
 const winter=seasonalPlantGrowth('winter',0,0,45,3);
 const drySummer=seasonalPlantGrowth('summer',36,0,0,3);
 const wetSummer=seasonalPlantGrowth('summer',36,0,100,3);
 assert.ok(spring>autumn&&autumn>winter);
 assert.ok(drySummer<wetSummer);
 assert.ok(seasonalPlantGrowth('winter',2,0,40,5)>
  seasonalPlantGrowth('winter',2,0,40,1),'forest shelter buffers winter');
 assert.ok(seasonalPlantGrowth('spring',12,1)>seasonalPlantGrowth('winter',0,1));
 assert.equal(seasonalPlantGrowth('none',22,0),1);
});

function forestPatch(seed,step){
 const w=new Ecosystem(seed),i=w.cell(220,160);
 w.tiles.fill(3);w.grass.fill(0);w.waterweed.fill(0);
 w.tiles[i]=0;w.grass[i]=35;w.terrainLevels[i]=3;
 w.weather='sunny';w.weatherUntil=10000;w.growth=70;
 w.tick=step;w.soilWater[i]=60;
 return {w,i};
}
test('same isolated grass patch grows in spring, loses foliage in winter',()=>{
 const spring=forestPatch(2026111601,240);
 const winter=forestPatch(2026111601,2040);
 for(let n=0;n<120;n++){spring.w.step();winter.w.step();}
 assert.ok(spring.w.grass[spring.i]>35,'spring rebound');
 assert.ok(winter.w.grass[winter.i]<35,'winter winter-dieback');
 assert.ok(winter.w.grass[winter.i]>0,'roots survive winter');
 assert.ok(spring.w.grass[spring.i]>winter.w.grass[winter.i]*1.4);
});

test('soil moisture replenishes during rain and is lost in summer sun',()=>{
 const {w,i}=forestPatch(2026111602,850);
 w.soilWater[i]=30;
 w.weather='sunny';w.weatherUntil=10000;
 for(let n=0;n<24;n++)w.step();
 const afterSun=w.soilWater[i];
 assert.ok(afterSun<30);
 w.weather='rain';w.rainfall=80;w.weatherUntil=10000;
 for(let n=0;n<24;n++)w.step();
 assert.ok(w.soilWater[i]>afterSun);
});

test('winter aquatic vegetation drops but does not vanish without grazing',()=>{
 const w=new Ecosystem(2026111603),i=w.tiles.findIndex(t=>t===1);
 assert.ok(i>=0);
 w.waterweed.fill(0);w.waterweed[i]=65;
 w.water[i]=90;w.weather='sunny';w.weatherUntil=10000;
 w.tick=2000;w.growth=0;
 for(let n=0;n<100;n++)w.step();
 assert.ok(w.waterweed[i]<65);
 assert.ok(w.waterweed[i]>3);
});

test('disabling climate preserves year-round growth even in winter tick range',()=>{
 const {w,i}=forestPatch(2026111604,2010);
 w.climateEnabled=false;
 const before=w.grass[i];for(let n=0;n<90;n++)w.step();
 assert.ok(w.grass[i]>before);
});
