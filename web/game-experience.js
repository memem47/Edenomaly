// Game experience layer: observation only. This file does not modify
// organism logic, economy, random state or species classifications.
import {fitView} from './viewport.js';
export const visibleInView=(view,x,y,width=800,height=460)=>{
 const v=fitView(view,width,height);
 return x>=v.x&&y>=v.y&&x<=v.x+width/v.zoom&&y<=v.y+height/v.zoom;
};
export const centerOn=(view,x,y,width=800,height=460)=>fitView({
 zoom:view.zoom,x:x-width/(2*view.zoom),y:y-height/(2*view.zoom)},width,height);
export function cameraSummary(world,view){
 let visible=0,threatened=0,offscreen=0;
 for(const u of world.units){
  if(u.dead)continue;
  if(visibleInView(view,u.x,u.y)){visible++;if(u.energy<55)threatened++;}
  else offscreen++;
 }
 return {visible,offscreen,threatened};
}
export const observationDirection=(x,y)=>[
 y<460/3?'北':y>460*2/3?'南':'中央',
 x<800/3?'西':x>800*2/3?'東':'中央'
].filter(v=>v!=='中央').join('')||'中央';
export class ObservationTracker{
 constructor(){this.reset();}
 reset(){
  this.seen=new Set();
  this.events=[];
  this.cooldown=new Map();
  this.lastScannedStep=-1;
  this.lastMilestones=new Set();
  this.lastRemotePosition=null;
 }
 start(world){
  this.reset();
  for(const key of world.species.keys())this.seen.add(key);
 }
 add(kind,step,message,x=null,y=null,{remote=false}={}){
  const event={id:String(step)+':'+kind+':'+this.events.length,
   kind,step,message,x,y,remote};
  this.events.unshift(event);
  if(this.events.length>32)this.events.length=32;
  return event;
 }
 scan(world,view,{radar=false}={}){
  if(world.tick===this.lastScannedStep)return [];
  this.lastScannedStep=world.tick;
  const added=[];
  for(const [key,sp] of world.species){
   const unit=world.units.find(u=>!u.dead&&u.category===key);
   const pos=unit?{x:unit.x,y:unit.y}:null;
   const remote=pos?!visibleInView(view,pos.x,pos.y):false;
   if(!this.seen.has(key)){
    this.seen.add(key);
    if(!remote||radar){
     const direction=pos?observationDirection(pos.x,pos.y):'';
     added.push(this.add(remote?'remote':'discovery',world.tick,
      remote?'遠方の'+direction+'側で新しい生命反応。移動して確認しましょう':
      '新しい種族を発見：'+sp.name,pos?.x??null,pos?.y??null,{remote}));
    }
   }
   if(sp.establishedByGeneration&&sp.establishedByPopulation&&!this.lastMilestones.has(key)){
    this.lastMilestones.add(key);
    if(!remote||radar)added.push(this.add('established',world.tick,
     remote?'離れた場所で種族が定着しました':'定着成功：'+sp.name,
     pos?.x??null,pos?.y??null,{remote}));
   }
  }
  const summary=cameraSummary(world,view);
  if(summary.visible>0&&summary.threatened/summary.visible>=.5
   &&world.tick-(this.cooldown.get('hunger')??-999)>=120){
   this.cooldown.set('hunger',world.tick);
   added.push(this.add('danger',world.tick,
    '観察中の群れでエネルギー不足が拡大（'+summary.threatened+'/'+summary.visible+'体）'));
  }
  if(summary.offscreen>0&&world.tick-(this.cooldown.get('outside')??-999)>=280){
   this.cooldown.set('outside',world.tick);
   added.push(this.add('migration',world.tick,
    '視野外で'+summary.offscreen+'体が生活しています。追うか、見守るか選べます'));
  }
  return added;
 }
}
export function gameOverSummary(world,session){
 const causes=Object.entries(world.deathCauses??{}).sort((a,b)=>b[1]-a[1]);
 const last=world.runScore;
 return {score:session.finalScore,reward:session.reward,duration:last.duration,
  species:world.species.size,established:last.establishedSpecies,
  births:[...world.species.values()].reduce((n,sp)=>n+sp.total,0),
  longestGeneration:Math.max(0,...[...world.species.values()].map(sp=>sp.maxGeneration??0)),
  mostCommonDeath:causes[0]?.[0]??'記録なし',mostCommonDeathCount:causes[0]?.[1]??0};
}
