// Game-mode progression is independent of Lab mode and browser storage.
export const INTERVENTIONS=Object.freeze({
 seed:{cost:5,label:'草の種をまく'},
 rain:{cost:8,label:'雨を降らせる'},
 fertilize:{cost:10,label:'土壌を肥やす'}
});
const integer=n=>Number.isFinite(Number(n))?Math.max(0,Math.floor(Number(n))):0;
export class GameSession{
 constructor(world){this.world=world;this.reset();}
 reset(){this.active=false;this.finished=false;this.points=0;this.earned=0;this.spent=0;this.milestones=new Set();this.maxGeneration=0;this.lastDiscoveries=0;this.lastMigrations=0;this.finalScore=0;this.reward=0;}
 start(x,y){
  if(this.active||this.finished||this.world.introducedCount>0)return false;
  const result=this.world.introduce(x,y,1);
  if(result.types!==1||result.individuals<=0)return false;
  this.active=true;this.points=15;
  this.maxGeneration=0;this.lastDiscoveries=this.world.runScore.discoveries;this.lastMigrations=this.world.migrations;
  this.world.log('info','ゲーム開始：介入ポイント15');
  return true;
 }
 grant(key,amount,label){
  if(this.milestones.has(key)||!this.active||this.finished)return false;
  this.milestones.add(key);this.points+=amount;this.earned+=amount;
  this.world.log('info','達成：'+label+' / 介入ポイント +'+amount);
  return true;
 }
 observe(){
  if(!this.active||this.finished)return;
  const w=this.world,score=w.runScore;
  // Only after ecosystem has actually lived that long, not on free reset/idle.
  for(let n=300;n<=score.duration;n+=300)this.grant('survive:'+n,5,n+'ステップ生存');
  for(let n=1;n<=score.discoveries;n++)this.grant('discovery:'+n,10,'新種 '+n+'種');
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
  if(kind==='seed')return w.tiles[w.cell(x,y)]===0;
  if(kind==='fertilize')return w.tiles[w.cell(x,y)]!==3;
  return false;
 }
 intervene(kind,x,y){
  if(!this.canIntervene(kind,x,y))return false;
  const w=this.world;
  if(kind==='seed'){
   // Seed existing grassland; do not terraform water or rock for only 5 points.
   const cx=Math.floor(x/20),cy=Math.floor(y/20);
   let improved=0;
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    if(dx*dx+dy*dy>4)continue;
    const xx=cx+dx,yy=cy+dy;
    if(xx<0||xx>=40||yy<0||yy>=23)continue;
    const i=yy*40+xx;
    if(w.tiles[i]!==0)continue;
    const old=w.grass[i];w.grass[i]=Math.min(100,Math.max(10,old)+30);
    if(w.grass[i]>old)improved++;
   }
   if(improved===0)return false;
  }else if(kind==='rain'){
   // Local intervention cannot permanently alter global growth/stress sliders.
   w.weather='rain';w.weatherStrength=.8;w.weatherUntil=Math.max(w.weatherUntil,w.tick+120);
   w.replenishWater(24);
   for(let i=0;i<w.tiles.length;i++){
    if(w.tiles[i]===0)w.soilWater[i]=Math.min(100,w.soilWater[i]+15);
   }
  }else if(kind==='fertilize'){
   if(!w.fertilize(x,y,2))return false;
  }
  const spec=INTERVENTIONS[kind];
  this.points-=spec.cost;this.spent+=spec.cost;
  w.log('info','介入：'+spec.label+' / -'+spec.cost+'pt');
  return true;
 }
}
// Sanitized browser-stored meta-progression. Replays never grant a second reward.
export const parseMeta=raw=>{
 try{
  const obj=typeof raw==='string'?JSON.parse(raw):raw;
  return {bank:integer(obj?.bank),best:integer(obj?.best),runs:integer(obj?.runs)};
 }catch{return {bank:0,best:0,runs:0};}
};
export const settleMeta=(meta,session)=>session.finished&&session.active?
 {bank:integer(meta.bank)+integer(session.reward),best:Math.max(integer(meta.best),integer(session.finalScore)),runs:integer(meta.runs)+1}:meta;
