// Visual game flow: no simulation mutation except purchasing persistent upgrades
// and camera movement through the public callbacks.
import {GAME_UPGRADES,buyGameUpgrade,hasUpgrade} from './game-mode.js';
import {ObservationTracker,cameraSummary,centerOn,gameOverSummary} from './game-experience.js';
const $=id=>document.getElementById(id);
export function mountGameUI({game,session,getMeta,setMeta,getView,setView,
 refresh,render,resetGame,getPlayMode,width=800,height=460}){
 const tracker=new ObservationTracker();
 let following=false,origin=null,founder=null,scanned=-1,finishedShown=false,lastEarned=0;
 const currentCenter=()=>{
  const active=game.units.filter(u=>!u.dead&&u.category===founder);
  if(!active.length){
   // Original category can go extinct while descendants survive as new species.
   // Follow the nearest remaining local group instead of snapping to a
   // permanently empty birthplace.
   if(!game.units.length)return origin;
   const anchor=origin??{x:width/2,y:height/2};
   const nearest=[...game.units].filter(u=>!u.dead)
    .sort((a,b)=>((a.x-anchor.x)**2+(a.y-anchor.y)**2)-
                 ((b.x-anchor.x)**2+(b.y-anchor.y)**2))[0];
   return nearest?{x:nearest.x,y:nearest.y}:origin;
  }
  return {x:active.reduce((v,u)=>v+u.x,0)/active.length,
   y:active.reduce((v,u)=>v+u.y,0)/active.length};
 };
 const showEvents=()=>{
  const feed=$('gameEventFeed');feed.replaceChildren();
  for(const event of tracker.events.slice(0,5)){
   const box=document.createElement('div'),step=document.createElement('small'),
    message=document.createElement('span');
   box.className='game-event-item '+event.kind;
   step.textContent='Step '+event.step;message.textContent=event.message;
   box.append(step,message);
   if(Number.isFinite(event.x)&&Number.isFinite(event.y)){
    const button=document.createElement('button');button.type='button';
    button.textContent='現地を見る';
    button.onclick=()=>{
     following=false;
     setView(centerOn(getView(),event.x,event.y,width,height));
     refresh();render();
    };
    box.append(button);
   }
   feed.append(box);
  }
  if(!tracker.events.length){
   const p=document.createElement('p');p.className='muted';
   p.textContent='ゲーム開始後に重要な出来事を表示します。';feed.append(p);
  }
 };
 const refreshShop=()=>{
  const meta=getMeta();
  $('gameUpgradeShop').hidden=getPlayMode()!=='game';
  for(const [id,key] of [['buyRadar','radar'],['buyReserve','reserve'],
   ['startBuyRadar','radar'],['startBuyReserve','reserve']]){
   const button=$(id),item=GAME_UPGRADES[key],owned=hasUpgrade(meta,key);
   button.textContent=owned?'✓ '+item.label+'（解放済み）':item.label+'（'+item.cost+'pt）';
   button.disabled=owned||meta.bank<item.cost||(session.active&&!session.finished);
  }
  $('startUpgradeStatus').textContent='恒久報酬 '+meta.bank+'pt ／ 遠方探知：'+
   (hasUpgrade(meta,'radar')?'解放済み':'未解放')+' ／ 初期介入：'+
   (hasUpgrade(meta,'reserve')?'20':'15')+'pt';
 };
 const update=()=>{
  const status=cameraSummary(game,getView());
  $('observationStrip').textContent=getPlayMode()==='game'&&session.active?
   '🔎 視野内 '+status.visible+'体 ／ 視野外 '+status.offscreen+'体 ／ 栄養不足 '+status.threatened+'体'+
   (following?' ｜ 🎯 群れ追尾中':' ｜ 📍 視野固定'):
   '🔎 ゲーム開始後に視野内外の個体数を表示します';
  $('followGroup').classList.toggle('active',following);
  $('followGroup').setAttribute('aria-pressed',String(following));
  $('followGroup').disabled=getPlayMode()!=='game'||!session.active;
  $('returnToGroup').disabled=!origin;
  refreshShop();
 };
 const start=(x,y)=>{
  origin={x,y};founder=game.units[0]?.category??null;following=false;
  tracker.start(game);tracker.add('discovery',game.tick,'最初の生命を移入しました。観察を始めましょう',x,y);
  scanned=-1;finishedShown=false;lastEarned=session.earned;
  setView(centerOn({zoom:2.8,x:0,y:0},x,y,width,height));
  showEvents();update();
 };
 const step=()=>{
  if(!session.active||getPlayMode()!=='game')return;
  if(session.earned>lastEarned){
   const delta=session.earned-lastEarned;
   lastEarned=session.earned;
   tracker.add('reward',game.tick,'介入ポイント +'+delta+'pt を獲得！');
   showEvents();
  }
  if(following&&game.tick%5===0){
   const p=currentCenter();
   if(p)setView(centerOn(getView(),p.x,p.y,width,height),false);
  }
  if(game.tick-scanned>=20){
   scanned=game.tick;
   if(tracker.scan(game,getView(),{radar:hasUpgrade(getMeta(),'radar')}).length)
    showEvents();
  }
 };
 const showOver=()=>{
  if(finishedShown||getPlayMode()!=='game'||document.hidden)return;
  finishedShown=true;following=false;
  const end=gameOverSummary(game,session),panel=$('gameOverSummary');
  panel.replaceChildren();
  for(const [name,value] of [
   ['最終スコア',end.score.toLocaleString('ja-JP')],
   ['恒久報酬','+'+end.reward+'pt'],
   ['生存したステップ',end.duration.toLocaleString('ja-JP')],
   ['発見した種',end.species+'種'],
   ['定着した種',end.established+'種'],
   ['主な死亡原因',end.mostCommonDeath+' '+end.mostCommonDeathCount+'件'],
   ['感染発生／自然回復',end.infectionCases+'件 ／ '+end.infectionRecoveries+'件'],
   ['防疫介入',end.clinicActions+'回']
  ]){
   const div=document.createElement('div'),label=document.createElement('small'),
    number=document.createElement('strong');
   label.textContent=name;number.textContent=value;div.append(label,number);panel.append(div);
  }
  $('gameOverDialog').showModal();
 };
 const openStart=()=>{
  refreshShop();
  $('gameStartDialog').showModal();
 };
 const reset=()=>{
  origin=null;founder=null;following=false;scanned=-1;finishedShown=false;lastEarned=0;
  tracker.reset();showEvents();update();
 };
 const manualCamera=()=>{following=false;update();};
 $('followGroup').onclick=()=>{
  if(!origin)return;following=!following;
  if(following){const p=currentCenter();if(p)setView(centerOn(getView(),p.x,p.y,width,height));}
  update();render();
 };
 $('returnToGroup').onclick=()=>{
  const p=currentCenter();if(!p)return;following=false;
  setView(centerOn(getView(),p.x,p.y,width,height));update();render();
 };
 $('startGameConfirm').onclick=()=>{$('gameStartDialog').close();};
 $('cancelGameStart').onclick=()=>{$('gameStartDialog').close();};
 $('gameRetry').onclick=()=>{
  $('gameOverDialog').close();resetGame();openStart();};
 $('gameOverClose').onclick=()=>{$('gameOverDialog').close();};
 for(const [id,key] of [['buyRadar','radar'],['buyReserve','reserve'],
  ['startBuyRadar','radar'],['startBuyReserve','reserve']]){
  $(id).onclick=()=>{
   const purchased=buyGameUpgrade(getMeta(),key);
   if(!purchased)return;
   setMeta(purchased);
   $('upgradeMessage').textContent='解放：'+GAME_UPGRADES[key].label+'（次回から有効）';
   update();refresh();
  };
 }
 showEvents();update();
 return {update,start,step,showOver,openStart,reset,manualCamera,
  startOptions:()=>({reserve:hasUpgrade(getMeta(),'reserve')})};
}
