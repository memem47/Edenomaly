// Game-mode progression is independent of Lab mode and browser storage.
export const INTERVENTIONS=Object.freeze({
 seed:{cost:5,label:'草・水草の種をまく'},
 rain:{cost:8,label:'雨を降らせる'},
 fertilize:{cost:10,label:'土壌を肥やす'},
 clinic:{cost:9,label:'防疫・治療支援'}
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
  const result=this.world.introduce(x,y,1);
  if(result.types!==1||result.individuals<=0)return false;
  this.active=true;this.points=15+(options.reserve===true?5:0);
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
  const w=this.world,c=w.cell(x,y),cx=c%40,cy=Math.floor(c/40);
  let biomass=0;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   if(dx*dx+dy*dy>4)continue;
   const tx=cx+dx,ty=cy+dy;if(tx<0||tx>=40||ty<0||ty>=23)continue;
   const id=ty*40+tx;biomass+=w.grass[id]+w.waterweed[id];
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
  for(let n=1;n<=score.discoveries;n++)this.grant('discovery:'+n,10,'新種 '+n+'種');
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
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=800||y>=460)return false;
  if(kind==='clinic')return w.units.some(u=>!u.dead&&u.infection>0&&(u.x-x)**2+(u.y-y)**2<=65**2);
  if(kind==='seed')return [0,1,2,3].includes(w.tiles[w.cell(x,y)]);
  if(kind==='fertilize')return w.tiles[w.cell(x,y)]!==3;
  return false;
 }
 intervene(kind,x,y){
  if(!this.canIntervene(kind,x,y))return false;
  const w=this.world;
  const tracked=kind==='rain'?
    {x:Math.min(799,Math.max(0,Number.isFinite(x)?x:400)),
     y:Math.min(459,Math.max(0,Number.isFinite(y)?y:230))}:{x,y};
  const before=this.localFood(tracked.x,tracked.y);
  const previousPopulation=w.units.length;
  const previousInfected=w.units.filter(u=>u.infection>0).length;
  const previousBirths=[...w.species.values()].reduce((sum,sp)=>sum+sp.total,0);
  if(kind==='seed'){
   // Seeds support grass, dry-land restoration and underwater weeds.
   // Rocks cannot be converted to pasture by a cheap seed action.
   const cx=Math.floor(x/20),cy=Math.floor(y/20);
   let improved=0;
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    if(dx*dx+dy*dy>4)continue;
    const xx=cx+dx,yy=cy+dy;
    if(xx<0||xx>=40||yy<0||yy>=23)continue;
    const i=yy*40+xx;
    // High mountain lichen can be reintroduced without changing rock into
    // grass. Regrowth remains limited by rainfall and grazing pressure.
    if(w.tiles[i]===3){
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
    if(w.tiles[i]===0)w.soilWater[i]=Math.min(100,w.soilWater[i]+15);
    // Wet crevices let lichen recolonize mountain rock; arid soil
    // also retains a little water after a rare rain event.
    if(w.tiles[i]===3)w.soilWater[i]=Math.min(100,w.soilWater[i]+24);
    if(w.tiles[i]===2)w.soilWater[i]=Math.min(100,w.soilWater[i]+10);
   }
  }else if(kind==='fertilize'){
   if(!w.fertilize(x,y,2))return false;
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
