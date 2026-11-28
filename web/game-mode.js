// Game-mode progression is independent of Lab mode and browser storage.
import {WORLD,appendageProgression} from './simulation.js';
import {INTERVENTION_VISUALS} from './intervention-visuals.js';
export const TERRAIN_SCULPT_COST=Object.freeze({0:3,1:5,2:2,3:4,4:6,5:7});
export const INTERVENTIONS=Object.freeze({
 seed:{cost:5,label:'草・水草の種をまく'},
 terrain0:{cost:3,label:'草地をひらく（1マス）'},
 terrain1:{cost:5,label:'水路を掘る（1マス）'},
 terrain2:{cost:2,label:'乾燥地をつくる（1マス）'},
 terrain3:{cost:4,label:'岩の防壁をつくる（1マス）'},
 terrain4:{cost:6,label:'湿地を整える（1マス）'},
 terrain5:{cost:7,label:'火山地へ整地（1マス）'},
 rain:{cost:8,label:'雨を降らせる'},
 fertilize:{cost:10,label:'土壌を肥やす'},
 clinic:{cost:9,label:'防疫・治療支援'},
 nursery:{cost:7,label:'繁殖保護区（260ステップ）'},
 oasis:{cost:6,label:'給水拠点（200ステップ）'},
 veteranCare:{cost:9,label:'長寿個体を支援（個体指定）'},
 reserveForest:{cost:40,label:'広域植生再生（半径約110px）'},
 sanctuary:{cost:50,label:'広域生命保護区（500ステップ）'},
 lakeMaker:{cost:75,label:'湖沼造成（既存水域と接続）'},
 worldShaper:{cost:1000,label:'大地改造（乾燥地・草地を広域湿地化）'},
 mutationPulse:{cost:2000,label:'突然変異の波（400ステップ）'},
 evolutionSanctuary:{cost:4000,label:'進化の聖域（600ステップ）'},
 autoSeeder:{cost:240,label:'自動種まき機（600ステップ）'},
 autoIrrigator:{cost:220,label:'自動給水機（600ステップ）'}
});
const integer=n=>Number.isFinite(Number(n))?Math.max(0,Math.floor(Number(n))):0;
// Persistent unlocks are one-time purchases using the existing earned bank.
// No passive automation, no purchases that charge the user real money.
export const GAME_UPGRADES=Object.freeze({
 radar:Object.freeze({cost:3,label:'遠方の生命反応',description:'視野外の新種・移住の兆候を知らせ、現地へ移動できる'}),
 reserve:Object.freeze({cost:4,label:'初期支援ポイント＋5',description:'次の試行以降の介入ポイントを15→20に増やす'})
});
export const hasUpgrade=(meta,key)=>meta?.upgrades?.[key]===true;
export const buyGameUpgrade=(meta,key)=>{
 const item=GAME_UPGRADES[key];
 if(!item||hasUpgrade(meta,key)||integer(meta?.bank)<item.cost)return null;
 return {...meta,bank:integer(meta.bank)-item.cost,
  upgrades:{...meta.upgrades,[key]:true}};
};

export class GameSession{
 constructor(world){this.world=world;this.reset();}
 reset(){this.rewardClaimed=false;this.active=false;this.finished=false;this.points=0;this.earned=0;this.spent=0;this.milestones=new Set();this.maxGeneration=0;this.lastDiscoveries=0;this.lastMigrations=0;this.finalScore=0;this.reward=0;this.interventionHistory=[];this.pendingImpact=null;this.lastImpact=null;}
 start(x,y,options={}){
  if(this.active||this.finished||this.world.introducedCount>0)return false;
  const result=this.world.introduce(x,y,1,options.founderGenome??null);
  if(result.types!==1||result.individuals<=0)return false;
  this.active=true;this.points=(this.world.wildernessMode?180:15)+(options.reserve===true?5:0);
  this.maxGeneration=0;this.lastDiscoveries=this.world.runScore.discoveries;this.lastMigrations=this.world.migrations;
  this.world.log('info','ゲーム開始：介入ポイント'+this.points);
  return true;
 }
 grant(key,amount,label){
  if(this.milestones.has(key)||!this.active||this.finished)return false;
  this.milestones.add(key);this.points+=amount;this.earned+=amount;
  this.world.log('info','達成：'+label+' / 介入ポイント +'+amount);
  return true;
 }
 localFood(x,y){
  const w=this.world,c=w.cell(x,y),cx=c%WORLD.columns,cy=Math.floor(c/WORLD.columns);
  let biomass=0;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   if(dx*dx+dy*dy>4)continue;
   const tx=cx+dx,ty=cy+dy;if(tx<0||tx>=WORLD.columns||ty<0||ty>=WORLD.rows)continue;
   const id=ty*WORLD.columns+tx;biomass+=w.grass[id]+w.waterweed[id];
  }
  return biomass;
 }
 observe(){
  if(!this.active||this.finished)return;
  if(this.pendingImpact&&this.world.tick>=this.pendingImpact.step+100){
   const a=this.pendingImpact;
   this.lastImpact={kind:a.kind,step:a.step,
    deltaFood:Math.round(this.localFood(a.x,a.y)-a.food),
    births:[...this.world.species.values()].reduce((sum,sp)=>sum+sp.total,0)-a.births,
    deltaPopulation:this.world.units.length-a.population,
    deltaInfected:this.world.units.filter(u=>u.infection>0).length-a.infectedBefore};
   this.pendingImpact=null;
  }
  const w=this.world,score=w.runScore;
  // Only after ecosystem has actually lived that long, not on free reset/idle.
  for(let n=300;n<=score.duration;n+=300)this.grant('survive:'+n,5,n+'ステップ生存');
  for(let n=1;n<=score.discoveries;n++)this.grant('discovery:'+n,20,'新種 '+n+'種');
  // Discovering successively rare visible limbs is a long-term game goal.
  // Rewards are one-time per stage and require an actually discovered species.
  const bestStage=Math.max(0,...[...w.species.values()].map(sp=>
   appendageProgression(sp.genome).stage));
  for(const [stage,points,label] of [
   [1,100,'しっぽを持つ種族'],[2,200,'足を持つ種族'],
   [3,400,'手を持つ種族'],[4,800,'天使の羽を持つ完全形'],
   [5,800,'悪魔の羽を持つ完全形']
  ])if(stage<=3?bestStage>=stage:
   [...w.species.values()].some(sp=>appendageProgression(sp.genome).stage===stage)){
   this.grant('appendage:'+stage,points,'進化目標：'+label);
  }
  if(bestStage>=4)this.grant('rare:completeForm',3000,'究極：しっぽ・足・手・羽を揃えた種族');
  // True one-time rarity bonuses. Repeated observation or replanting cannot
  // farm points; rewards require naturally observed milestones.
  if(w.units.some(u=>!u.dead&&u.age>=1500))
   this.grant('rare:ancient',35,'希少：1500ステップ生存した長寿個体');
  const livingCategories=new Set(w.units.filter(u=>!u.dead).map(u=>u.category));
  if(livingCategories.size>=3)this.grant('rare:coexist3',30,'希少：3種が同時に共存');
  if(livingCategories.size>=5)this.grant('rare:coexist5',65,'希少：5種が同時に共存');
  if((w.cultivationEvents??0)>0)this.grant('rare:farmer',25,'希少：種まきによる餌場の造成');
  if((w.pondCreationEvents??0)>0)this.grant('rare:pond',60,'希少：生命が水場を造成');
  if([...w.species.values()].some(sp=>appendageProgression(sp.genome).stage===4)&&
     [...w.species.values()].some(sp=>appendageProgression(sp.genome).stage===5))
   this.grant('rare:dualwings',120,'究極：天使型・悪魔型の両方を発見');
  // Separate discovery from ecological success. A new category is not
  // established until it has both three generations and a 12-body peak.
  for(const [category,sp] of w.species){
   if(sp.establishedByGeneration)
    this.grant('generation:'+category,5,'3世代継続：'+sp.name);
   if(sp.establishedByPopulation)
    this.grant('population:'+category,5,'12体到達：'+sp.name);
   if(sp.establishedByGeneration&&sp.establishedByPopulation)
    this.grant('established:'+category,15,'定着成功：'+sp.name);
  }
  const highest=w.units.reduce((n,u)=>Math.max(n,u.generation),this.maxGeneration);
  for(let n=this.maxGeneration+1;n<=highest;n++)this.grant('generation:'+n,3,'第'+n+'世代');
  this.maxGeneration=highest;
  for(let n=600;n<=score.duration;n+=600)this.grant('season:'+n,8,'季節の節目 '+n+'ステップ');
  if(w.migrations>0)this.grant('migration:first',6,'初めての移住成功');
  this.lastMigrations=w.migrations;
  if(score.ended){
   this.finished=true;this.finalScore=score.total;
   this.reward=Math.floor(this.finalScore/1000);
   w.log('info','ゲーム終了：'+this.finalScore+'点 / 恒久報酬 +'+this.reward);
  }
 }
 canIntervene(kind,x,y){
  if(!this.active||this.finished||!INTERVENTIONS[kind]||this.points<INTERVENTIONS[kind].cost)return false;
  const w=this.world;
  if(kind==='rain')return true;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=WORLD.width||y>=WORLD.height)return false;
  if(/^terrain[0-5]$/.test(kind)){
   const target=Number(kind.slice(-1)),i=w.cell(x,y),from=w.tiles[i];
   if(from===target)return false;
   if(w.units.some(u=>!u.dead&&w.cell(u.x,u.y)===i)||
      w.eggs.some(e=>!e.dead&&w.cell(e.x,e.y)===i))return false;
   if(target===1){
    const cx=i%WORLD.columns,cy=Math.floor(i/WORLD.columns);
    const n=[cx>0?i-1:-1,cx<WORLD.columns-1?i+1:-1,cy>0?i-WORLD.columns:-1,cy<WORLD.rows-1?i+WORLD.columns:-1];
    if(!n.some(j=>j>=0&&w.tiles[j]===1))return false;
   }
   return true;
  }
  if(kind==='autoSeeder'||kind==='autoIrrigator')return !w.automationZones?.some(z=>z.kind===kind&&z.until>w.tick&&(z.x-x)**2+(z.y-y)**2<100**2);
  if(kind==='mutationPulse')return w.tick>=(w.mutationPulseUntil??0);
  if(kind==='evolutionSanctuary')return w.units.some(u=>!u.dead&&(u.x-x)**2+(u.y-y)**2<125**2);
  if(kind==='worldShaper'){
   const cx=Math.floor(x/WORLD.cell),cy=Math.floor(y/WORLD.cell);
   for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
    if(dx*dx+dy*dy>16)continue;
    const xx=cx+dx,yy=cy+dy;
    if(xx<1||yy<1||xx>=WORLD.columns-1||yy>=WORLD.rows-1)continue;
    const i=yy*WORLD.columns+xx;
    if(![0,2].includes(w.tiles[i]))continue;
    if(w.units.some(u=>!u.dead&&w.cell(u.x,u.y)===i)||w.eggs.some(e=>!e.dead&&w.cell(e.x,e.y)===i))continue;
    return true;
   }
   return false;
  }
  if(kind==='reserveForest'){
   const cx=Math.floor(x/WORLD.cell),cy=Math.floor(y/WORLD.cell);
   for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){
    if(dx*dx+dy*dy>25)continue;
    const xx=cx+dx,yy=cy+dy;
    if(xx<0||yy<0||xx>=WORLD.columns||yy>=WORLD.rows)continue;
    const i=yy*WORLD.columns+xx;
    if([0,2,4].includes(w.tiles[i])&&w.grass[i]<78)return true;
   }
   return false;
  }
  if(kind==='sanctuary')return w.units.some(u=>!u.dead&&(u.x-x)**2+(u.y-y)**2<125**2)||
    w.eggs.some(e=>!e.dead&&(e.x-x)**2+(e.y-y)**2<125**2);
  if(kind==='lakeMaker'){
   const cx=Math.floor(x/WORLD.cell),cy=Math.floor(y/WORLD.cell);
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    if(dx*dx+dy*dy>4)continue;
    const xx=cx+dx,yy=cy+dy;
    if(xx<1||yy<1||xx>=WORLD.columns-1||yy>=WORLD.rows-1)continue;
    const i=yy*WORLD.columns+xx;
    if(w.tiles[i]!==0&&w.tiles[i]!==4)continue;
    if(w.units.some(u=>!u.dead&&w.cell(u.x,u.y)===i)||
       w.eggs.some(e=>!e.dead&&w.cell(e.x,e.y)===i))continue;
    if([i-1,i+1,i-WORLD.columns,i+WORLD.columns].some(j=>w.tiles[j]===1))return true;
   }
   return false;
  }
  if(kind==='veteranCare')return w.units.some(u=>!u.dead&&u.stage==='adult'&&
   u.age>=300&&(u.x-x)**2+(u.y-y)**2<=36**2);
  if(kind==='nursery')return w.units.some(u=>!u.dead&&(u.x-x)**2+(u.y-y)**2<=80**2)||w.eggs.some(e=>!e.dead&&(e.x-x)**2+(e.y-y)**2<=80**2);
  if(kind==='oasis')return w.tiles[w.cell(x,y)]!==3&&w.units.some(u=>!u.dead&&(u.x-x)**2+(u.y-y)**2<=80**2);
  if(kind==='clinic')return w.units.some(u=>!u.dead&&u.infection>0&&(u.x-x)**2+(u.y-y)**2<=65**2);
  if(kind==='seed')return [0,1,2,3,4,5].includes(w.tiles[w.cell(x,y)]);
  if(kind==='fertilize')return w.tiles[w.cell(x,y)]!==3;
  return false;
 }
 intervene(kind,x,y){
  if(!this.canIntervene(kind,x,y))return false;
  const w=this.world;
  const tracked=kind==='rain'?
    {x:Math.min(WORLD.width-1,Math.max(0,Number.isFinite(x)?x:WORLD.width/2)),
     y:Math.min(WORLD.height-1,Math.max(0,Number.isFinite(y)?y:WORLD.height/2))}:{x,y};
  const before=this.localFood(tracked.x,tracked.y);
  const previousPopulation=w.units.length;
  const previousInfected=w.units.filter(u=>u.infection>0).length;
  const previousBirths=[...w.species.values()].reduce((sum,sp)=>sum+sp.total,0);
  if(/^terrain[0-5]$/.test(kind)){
   if(!w.reshapeTerrainCell(x,y,Number(kind.slice(-1))))return false;
  }else if(kind==='autoSeeder'||kind==='autoIrrigator'){
   w.automationZones??=[];
   w.automationZones.push({kind,x,y,until:w.tick+600,nextTick:w.tick+20,interval:20});
   w.log('info',(kind==='autoSeeder'?'自動種まき機':'自動給水機')+'を600ステップ設置');
  }else if(kind==='mutationPulse'){
   w.mutationPulseUntil=w.tick+400;
   w.log('info','突然変異の波：400ステップの間、交配時の変異機会が増加（新種は保証しない）');
  }else if(kind==='evolutionSanctuary'){
   w.supportZones??=[];
   w.supportZones.push({kind:'evolutionSanctuary',x,y,until:w.tick+600});
   w.log('info','進化の聖域：600ステップの間、指定区域で卵・水分・繁殖環境を保護');
  }else if(kind==='worldShaper'){
   const cx=Math.floor(x/WORLD.cell),cy=Math.floor(y/WORLD.cell);
   let changed=0;
   for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
    if(dx*dx+dy*dy>16)continue;
    const xx=cx+dx,yy=cy+dy;
    if(xx<1||yy<1||xx>=WORLD.columns-1||yy>=WORLD.rows-1)continue;
    const i=yy*WORLD.columns+xx;
    if(![0,2].includes(w.tiles[i]))continue;
    if(w.units.some(u=>!u.dead&&w.cell(u.x,u.y)===i)||w.eggs.some(e=>!e.dead&&w.cell(e.x,e.y)===i))continue;
    w.tiles[i]=4;w.terrainLevels[i]=3;w.soilWater[i]=Math.max(70,w.soilWater[i]);
    w.grass[i]=Math.max(25,w.grass[i]);changed++;
   }
   if(!changed)return false;
   w.log('info','大地改造：'+changed+'マスを湿地へ改造');
  }else if(kind==='reserveForest'){
   const cx=Math.floor(x/WORLD.cell),cy=Math.floor(y/WORLD.cell);
   let changed=0;
   for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){
    if(dx*dx+dy*dy>25)continue;
    const xx=cx+dx,yy=cy+dy;
    if(xx<0||yy<0||xx>=WORLD.columns||yy>=WORLD.rows)continue;
    const i=yy*WORLD.columns+xx,t=w.tiles[i];
    if(![0,2,4].includes(t))continue;
    if(t===2&&w.soilWater[i]>=25)w.tiles[i]=0;
    if(w.grass[i]<78){
     w.grass[i]=Math.min(88,w.grass[i]+52);
     w.soilWater[i]=Math.min(100,w.soilWater[i]+26);
     w.soil[i]=Math.min(100,w.soil[i]+15);changed++;
    }
   }
   if(!changed)return false;
   w.log('info','広域植生再生：'+changed+'マスの生産力を改善');
  }else if(kind==='sanctuary'){
   w.supportZones??=[];
   w.supportZones.push({kind:'sanctuary',x,y,until:w.tick+500});
   w.log('info','広域生命保護区：卵・水分・感染を500ステップ保護');
  }else if(kind==='lakeMaker'){
   const cx=Math.floor(x/WORLD.cell),cy=Math.floor(y/WORLD.cell);
   let changed=0;
   // Start at existing shoreline and grow a connected body of water,
   // no disconnected ponds or killing a creature on the target cell.
   for(let pass=0;pass<5;pass++)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    if(dx*dx+dy*dy>4)continue;
    const xx=cx+dx,yy=cy+dy;
    if(xx<1||yy<1||xx>=WORLD.columns-1||yy>=WORLD.rows-1)continue;
    const i=yy*WORLD.columns+xx;
    if(![0,4].includes(w.tiles[i]))continue;
    if(w.units.some(u=>!u.dead&&w.cell(u.x,u.y)===i)||
       w.eggs.some(e=>!e.dead&&w.cell(e.x,e.y)===i))continue;
    if(![i-1,i+1,i-WORLD.columns,i+WORLD.columns].some(j=>w.tiles[j]===1))continue;
    w.tiles[i]=1;w.terrainLevels[i]=2;w.waterbed[i]=1;
    w.water[i]=Math.min(78,Math.max(25,w.soilWater[i]*.7));
    w.waterweed[i]=0;w.grass[i]=0;
    w.soilWater[i]=Math.max(0,w.soilWater[i]-25);changed++;
   }
   if(!changed)return false;
   w._waterRegionTick=null;w._waterRegions=null;
   w.log('info','広域水域造成：'+changed+'マスを池へ接続（水草は自然繁殖待ち）');
  }else if(kind==='seed'){
   // Seeds support grass, dry-land restoration and underwater weeds.
   // Rocks cannot be converted to pasture by a cheap seed action.
   const cx=Math.floor(x/20),cy=Math.floor(y/20);
   let improved=0;
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    if(dx*dx+dy*dy>4)continue;
    const xx=cx+dx,yy=cy+dy;
    if(xx<0||xx>=WORLD.columns||yy<0||yy>=WORLD.rows)continue;
    const i=yy*WORLD.columns+xx;
    // High mountain lichen can be reintroduced without changing rock into
    // grass. Regrowth remains limited by rainfall and grazing pressure.
    if(w.tiles[i]===3||w.tiles[i]===5){
     const old=w.grass[i];
     w.grass[i]=Math.min(23,Math.max(4,old)+8);
     if(w.grass[i]>old)improved++;
     continue;
    }
    if(w.tiles[i]===1){
     const old=w.waterweed[i];
     w.waterweed[i]=Math.min(100,Math.max(10,old)+25);
     if(w.waterweed[i]>old)improved++;
    }else{
     const old=w.grass[i];
     if(w.tiles[i]===2)w.tiles[i]=0;
     w.grass[i]=Math.min(100,Math.max(10,old)+30);
     if(w.grass[i]>old)improved++;
    }
   }
   if(improved===0)return false;
  }else if(kind==='rain'){
   // Local intervention cannot permanently alter global growth/stress sliders.
   w.weather='rain';w.weatherStrength=.8;w.weatherUntil=Math.max(w.weatherUntil,w.tick+120);
   w.replenishWater(24);
   for(let i=0;i<w.tiles.length;i++){
    if(w.tiles[i]===0||w.tiles[i]===4)w.soilWater[i]=Math.min(100,w.soilWater[i]+15);
    // Wet crevices let lichen recolonize mountain rock; arid soil
    // also retains a little water after a rare rain event.
    if(w.tiles[i]===3)w.soilWater[i]=Math.min(100,w.soilWater[i]+24);
    if(w.tiles[i]===2)w.soilWater[i]=Math.min(100,w.soilWater[i]+10);
   }
  }else if(kind==='fertilize'){
   if(!w.fertilize(x,y,2))return false;
  }else if(kind==='nursery'){
   w.supportZones??=[];
   w.supportZones.push({kind,x,y,until:w.tick+260});
   w.log('info','繁殖保護区：周辺の卵の捕食を75%抑制（260ステップ）');
  }else if(kind==='oasis'){
   w.supportZones??=[];
   w.supportZones.push({kind,x,y,until:w.tick+200});
   for(const u of w.units)if(!u.dead&&(u.x-x)**2+(u.y-y)**2<=65**2)u.hydration=Math.min(100,u.hydration+30);
   const cx=Math.floor(x/20),cy=Math.floor(y/20);
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const xx=cx+dx,yy=cy+dy;if(xx<0||xx>=WORLD.columns||yy<0||yy>=WORLD.rows||dx*dx+dy*dy>4)continue;
    const i=yy*WORLD.columns+xx;if(w.tiles[i]!==3&&w.tiles[i]!==5)w.soilWater[i]=Math.min(100,w.soilWater[i]+35);
   }
   w.log('info','給水拠点：周辺の水分を補給（200ステップ）');
  }else if(kind==='veteranCare'){
   // Target a particular reproductively mature old individual rather than
   // handing every species free survival or a guaranteed mutation.
   const target=w.units.filter(u=>!u.dead&&u.stage==='adult'&&u.age>=300&&
    (u.x-x)**2+(u.y-y)**2<=36**2)
    .sort((a,b)=>(a.x-x)**2+(a.y-y)**2-(b.x-x)**2-(b.y-y)**2)[0];
   if(!target)return false;
   target.energy=Math.min(210,target.energy+45);
   target.hydration=Math.min(100,target.hydration+24);
   target.infection=Math.max(0,target.infection-28);
   target.infectionProtectionUntil=Math.max(target.infectionProtectionUntil??0,w.tick+160);
   w.log('info','長寿個体 #'+target.id+'（'+Math.floor(target.age)+'ステップ生存）へ食料・給水・防疫支援');
  }else if(kind==='clinic'){
   // A bounded area intervention. It is not permanent immunity, HP healing,
   // or a species-wide cure; untreated colonies remain vulnerable.
   let treated=0;
   for(const u of w.units){
    if(u.dead||(u.x-x)**2+(u.y-y)**2>65**2)continue;
    if(u.infection>0){u.infection=Math.max(0,u.infection-45);treated++;}
    u.infectionProtectionUntil=Math.max(u.infectionProtectionUntil??0,w.tick+110);
   }
   if(!treated)return false;
   w.log('info','防疫：'+treated+'体を処置、周囲の接触感染を一時的に抑制');
  }
  // Cosmetic feedback is awarded only on a successful, charged intervention.
  // Persistent overlays use actual simulation steps; short pulses use render frames.
  const visual=INTERVENTION_VISUALS[kind];
  if(visual){
   // Reserve room for a visible player action even when combat saturated the
   // temporary-effects queue. Discard only the oldest cosmetic effect.
   if(!w.addVisualEffect('playerIntervention',tracked,{kind,ttl:32})&&!w.headless){
    w.effects.shift();
    w.addVisualEffect('playerIntervention',tracked,{kind,ttl:32});
   }
   if(visual.duration){
    w.interventionVisuals=(w.interventionVisuals??[]).filter(v=>v.until>w.tick).slice(-47);
    w.interventionVisuals.push({kind,x:tracked.x,y:tracked.y,started:w.tick,until:w.tick+visual.duration});
   }
  }
  const spec=INTERVENTIONS[kind];
  this.points-=spec.cost;this.spent+=spec.cost;
  const record={kind,step:w.tick,x:tracked.x,y:tracked.y,
   infectedBefore:previousInfected,
   infectedAfter:w.units.filter(u=>u.infection>0).length,
   food:before,foodAfter:this.localFood(tracked.x,tracked.y),
   population:previousPopulation,births:previousBirths,cost:spec.cost};
  this.interventionHistory.push(record);
  this.pendingImpact=record;
  this.lastImpact=null;
  w.log('info','介入：'+spec.label+' / -'+spec.cost+'pt');
  return true;
 }
}
// Sanitized browser-stored meta-progression. Replays never grant a second reward.
export const parseMeta=raw=>{
 try{
  const obj=typeof raw==='string'?JSON.parse(raw):raw;
  return {bank:integer(obj?.bank),best:integer(obj?.best),runs:integer(obj?.runs),
   upgrades:{radar:obj?.upgrades?.radar===true,reserve:obj?.upgrades?.reserve===true}};
 }catch{return {bank:0,best:0,runs:0,upgrades:{radar:false,reserve:false}};}
};
// Claim a completed run exactly once. Unlocks are part of persisted meta and
// must survive reward settlement; the browser also guards recording per run.
export const settleMeta=(meta,session)=>{
 if(!session.finished||!session.active||session.rewardClaimed)return meta;
 session.rewardClaimed=true;
 return {...meta,bank:integer(meta.bank)+integer(session.reward),
  best:Math.max(integer(meta.best),integer(session.finalScore)),
  runs:integer(meta.runs)+1};
};
