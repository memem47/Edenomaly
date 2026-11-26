// Read-only, deterministic guidance for player decisions. No RNG, terrain
// mutations, or hidden autoplacement. Preview never changes the chosen genome.
import {terrainFitness,thermalFitness,dietProfile,WORLD} from './simulation.js';
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
export function placementAssessment(world,g,x,y){
 const tile=world.cell(x,y),terrain=world.tiles[tile];
 const sameWater=terrain===1,fish=g.aquatic===1;
 const local=[];
 const cx=tile%WORLD.columns,cy=Math.floor(tile/WORLD.columns);
 let food=0,water=0,grass=0;
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
  const xx=cx+dx,yy=cy+dy;
  if(xx<0||xx>=WORLD.columns||yy<0||yy>=WORLD.rows||dx*dx+dy*dy>4)continue;
  const i=yy*WORLD.columns+xx;
  food+=fish?world.waterweed[i]:world.grass[i];
  grass+=world.grass[i];water+=world.tiles[i]===1?1:0;
 }
 const t=terrainFitness(g,terrain);
 const thermal=thermalFitness(g,world.temperatureAt(x,y));
 const diet=dietProfile(g);
 const reasons=[];
 if(fish!==sameWater)reasons.push(fish?'水生個体なのに水域外':'陸生個体なのに水中');
 if(diet.meat>.68)reasons.push('初期には獲物がいないため肉食に不向き');
 if(food<22&&diet.plant>.35)reasons.push('付近の植物が極端に少ない');
 if(thermal.excess>2)reasons.push('適温・耐性から大きく外れている');
 if(t.fitness<.65)reasons.push('この地形への適応が弱い');
 if(!fish&&water===0)reasons.push('近くに水場がなく脱水に注意');
 const severe=fish!==sameWater||diet.meat>.68||(food<8&&diet.plant>.35);
 const suitability=clamp(100-(fish!==sameWater?65:0)-(diet.meat>.68?50:0)-
  (food<22?22:food<65?9:0)-Math.max(0,thermal.excess)*8-
  Math.max(0,.85-t.fitness)*30-(!fish&&water===0?12:0),0,100);
 return {terrain,suitability:Math.round(suitability),severe,food:Math.round(food),
  warning:reasons.length?reasons.join('・'):'大きな警告なし',
  advice:severe?'能力または地点を変更すると生存しやすくなります':
   reasons.length?'食料・水源・温度の状態に注意してください':'生存を試せる環境です'};
}
export function populationDiagnosis(world){
 const units=world.units.filter(u=>!u.dead);
 if(!units.length)return {summary:'移入する生命がまだいません。',recommendation:'能力を設定して移入してください。'};
 const n=units.length;
 const low=units.filter(u=>u.energy<65).length;
 const infected=units.filter(u=>u.infection>0).length;
 const dry=units.filter(u=>u.hydration<40).length;
 const noFood=units.filter(u=>(u.forageFailure??0)>(u.forageSuccess??0)*1.5+4).length;
 const crowded=units.filter(u=>(u.habitatLoad??0)>.65).length;
 const stressed=units.filter(u=>(u.hp??u.maxHp)<u.maxHp*.5).length;
 const problems=[
  {count:infected,label:'感染',action:'🩺 防疫で感染個体を治療'},
  {count:dry,label:'水分不足',action:'💧 給水拠点や雨で水を補給'},
  {count:noFood,label:'採食失敗',action:'🌱 植物のある場所へ誘導し、種を補充'},
  {count:low,label:'栄養不足',action:'🌱 草・水草の種を補充'},
  {count:crowded,label:'過密',action:'餌場を増やし、群れの移動と分散を観察'}
 ];
 const main=problems.sort((a,b)=>b.count-a.count)[0];
 return {population:n,low,infected,dry,noFood,crowded,stressed,
  summary:'栄養不足 '+low+'/'+n+'・採食失敗 '+noFood+'/'+n+'・脱水 '+dry+'/'+n+
   '・感染 '+infected+'/'+n+'・過密 '+crowded+'/'+n,
  recommendation:main.count>0?main.action:'大きな危険の兆候はありません。'};
}
export function deathDiagnosis(u){
 if((u.infection??0)>0||u.lastHpLossSource==='infection')return '感染';
 if((u.hydration??100)<25||u.lastHpLossSource==='dehydration')return '脱水';
 if((u.forageFailure??0)>Math.max(5,(u.forageSuccess??0)*2))
  return '採食失敗・食料探索';
 if((u.habitatLoad??0)>.65)return '局所過密';
 if((u.energy??100)<60)return '摂取エネルギー不足';
 return '複合的な衰弱';
}
