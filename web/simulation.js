// Edenomaly simulation: browser-only; no DOM or Canvas dependencies.
const W=800,H=460,CELL=20,NX=40,NY=23;
export const TERRAIN_NAMES=['草地','水辺','乾燥地','岩場'];
export const TERRAIN_COLORS=['#386e4c','#276484','#927a4b','#505562'];
const GROWTH=[1,.75,.10,.015],DECAY=[.026,.038,.006,.003];
const PREFIX=['モコ','ミュ','ルミ','ネム','ゾル','リュ','シル','ノク','ヴェル','テラ'];
const SUFFIX=['リア','リス','ルン','ミア','ゾア','ティス','ノク','ピア'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
export class Ecosystem{
 constructor(seed=971253){this.initialSeed=seed;this.reset();}
 rand(){let x=this.rng;x^=x<<13;x^=x>>>17;x^=x<<5;this.rng=x;return(x>>>0)/4294967296;}
 range(a,b){return a+(b-a)*this.rand();}
 cell(x,y){return clamp(Math.floor(y/CELL),0,NY-1)*NX+clamp(Math.floor(x/CELL),0,NX-1);}
 terrain(x,y){return this.tiles[this.cell(x,y)];}
 gene(){return {r:this.range(4.2,8),jaw:this.range(.3,1.7),wet:this.rand(),dry:this.rand(),hue:this.range(0,360)};}
 mutate(g){return {r:clamp(g.r+this.range(-.7,.7),3,12),jaw:clamp(g.jaw+this.range(-.22,.22),.2,2.5),wet:clamp(g.wet+this.range(-.11,.11),0,1),dry:clamp(g.dry+this.range(-.11,.11),0,1),hue:(g.hue+this.range(-18,18)+360)%360};}
 category(g){return [Math.floor(g.r/2),Math.floor(g.jaw/.65),Math.floor(g.wet*3),Math.floor(g.dry*3),Math.floor(g.hue/120)].join('-');}
 name(n){return PREFIX[(n*7+2)%PREFIX.length]+SUFFIX[(n*3+1)%SUFFIX.length]+'-'+String(n).padStart(3,'0');}
 log(type,message,point){this.logs.unshift({type,message,step:this.tick});if(this.logs.length>500)this.logs.pop();if(point&&this.effects.length<140)this.effects.push({type,x:point.x,y:point.y,age:0});}
 addFood(x,y,n,spread=8,source='natural'){
  for(let i=0;i<n&&this.food.length<1600;i++){
   const px=clamp(x+this.range(-spread,spread),4,W-4),py=clamp(y+this.range(-spread,spread),4,H-4);
   const amount=this.range(7,14);this.food.push({x:px,y:py,energy:amount,source});
   if(source==='corpse'){this.recycled++;this.recycledByTerrain[this.terrain(px,py)]++;}
  }
 }
 spawn(x,y,g,parent=null){
  if(this.units.length>=155)return null;
  const u={id:this.nextId++,x:clamp(x,10,W-10),y:clamp(y,10,H-10),angle:this.range(0,Math.PI*2),g,energy:parent?37:this.range(64,86),age:0,generation:parent?parent.generation+1:0,parent:parent?.id??null,dead:false,bite:0};
  u.category=this.category(g);this.units.push(u);
  if(!this.species.has(u.category)){
   const n=this.species.size+1;this.species.set(u.category,{n,name:this.name(n),current:0,total:0,hue:g.hue,first:this.tick});this.discoveries.push(this.tick);this.log('new','新しい形態：'+this.name(n),u);
  }
  const s=this.species.get(u.category);s.current++;s.total++;
  this.log('birth','#'+u.id+' 誕生（'+s.name+' / 第'+u.generation+'世代）',u);
  return u;
 }
 die(u,cause,consumed=0){
  if(u.dead)return;
  u.dead=true;this.species.get(u.category).current--;
  const mass=Math.max(8,u.g.r*6+Math.max(0,u.energy)*.4-consumed);
  this.corpses.push({x:u.x,y:u.y,mass,reserve:0,age:0,cause});
  this.log('death','#'+u.id+' 死亡：'+cause,u);
  if(this.species.get(u.category).current===0)this.log('info',this.species.get(u.category).name+' が絶滅');
 }
 setupTerrain(){
  this.tiles=new Uint8Array(NX*NY);
  const hubs=[{x:10,y:9,t:1,r:6},{x:33,y:18,t:1,r:5},{x:30,y:5,t:2,r:9},{x:7,y:20,t:2,r:5},{x:21,y:17,t:3,r:4},{x:38,y:9,t:3,r:4}];
  for(let y=0;y<NY;y++)for(let x=0;x<NX;x++){
   let t=0;for(const h of hubs)if(Math.hypot(x-h.x,y-h.y)+this.range(-1.4,1.4)<h.r)t=h.t;this.tiles[y*NX+x]=t;
  }
 }
 reset(){
  this.rng=this.initialSeed||971253;this.units=[];this.food=[];this.corpses=[];this.species=new Map();this.logs=[];this.effects=[];this.history=[];this.discoveries=[];this.tick=0;this.nextId=1;this.recycled=0;this.recycledByTerrain=[0,0,0,0];this.growth=55;this.stress=20;
  this.setupTerrain();
  for(let i=0;i<400;i++){const x=this.range(0,W),y=this.range(0,H);if(this.rand()<GROWTH[this.terrain(x,y)])this.addFood(x,y,1,2);}
  for(let i=0;i<27;i++)this.spawn(this.range(35,W-35),this.range(35,H-35),this.gene());
  this.log('info','地形、遺伝、捕食、死体分解の実験を開始');this.snapshot();
 }
 snapshot(){this.history.push({population:this.units.length,food:this.food.length,corpses:this.corpses.length});if(this.history.length>180)this.history.shift();}
 step(){
  this.tick++;
  const attempts=2+Math.floor(this.growth/10);
  for(let i=0;i<attempts;i++){
   const id=Math.floor(this.rand()*this.tiles.length),t=this.tiles[id];
   if(this.rand()<GROWTH[t]*this.growth/100&&this.food.length<1500)this.addFood((id%NX+this.rand())*CELL,(Math.floor(id/NX)+this.rand())*CELL,1,0);
  }
  for(let i=this.corpses.length-1;i>=0;i--){
   const c=this.corpses[i];c.age++;
   const loss=Math.min(c.mass,Math.max(.03,c.mass*DECAY[this.terrain(c.x,c.y)]));c.mass-=loss;c.reserve+=loss;
   while(c.reserve>=9&&this.food.length<1580){c.reserve-=9;this.addFood(c.x,c.y,1,Math.min(17,5+c.age*.02),'corpse');}
   if(c.mass<.6){if(c.reserve>=4&&this.food.length<1580)this.addFood(c.x,c.y,1,8,'corpse');this.corpses.splice(i,1);this.log('decay','死体が分解されて栄養になった',c);}
  }
  const batch=this.units.slice();
  for(const u of batch){
   if(u.dead)continue;u.age++;if(u.bite>0)u.bite--;
   const g=u.g,t=this.terrain(u.x,u.y);
   let nearest=null,df=3700;
   for(const f of this.food){const d=distance(u,f);if(d<df){df=d;nearest=f;}}
   let prey=null,pd=1900;
   if(g.jaw>1.33&&u.bite===0)for(const v of batch){if(v===u||v.dead||v.g.r>g.r*.75)continue;const d=distance(u,v);if(d<pd){pd=d;prey=v;}}
   const target=prey&&pd<df*1.4?prey:nearest;
   const desired=target?Math.atan2(target.y-u.y,target.x-u.x):u.angle+this.range(-.5,.5);
   const turn=Math.atan2(Math.sin(desired-u.angle),Math.cos(desired-u.angle));u.angle+=clamp(turn,-.23,.23)+this.range(-.09,.09);
   const penalty=t===1?(1-g.wet)*.65:t===2?(1-g.dry)*.6:t===3?.73:0;
   const speed=3.7/(.75+g.r*.13)*clamp(1-penalty,.23,1);
   u.x=clamp(u.x+Math.cos(u.angle)*speed,7,W-7);u.y=clamp(u.y+Math.sin(u.angle)*speed,7,H-7);
   u.energy-=.17+g.r*.052+g.jaw*.025+this.stress*.0035+(t===1?(1-g.wet)*.45:t===2?(1-g.dry)*.44:t===3?.27:0)+(g.wet+g.dry)*.055;
   if(nearest&&distance(u,nearest)<(g.r+4)**2){u.energy+=nearest.energy;const pos=this.food.indexOf(nearest);if(pos>=0)this.food.splice(pos,1);this.log('meal','#'+u.id+' が食事した',u);}
   if(prey&&!prey.dead&&distance(u,prey)<(g.r+prey.g.r+2)**2){const eaten=Math.max(5,prey.energy*.45);u.energy+=eaten;u.bite=30;this.log('pred','#'+u.id+' が #'+prey.id+' を捕食',u);this.die(prey,'捕食',eaten);}
   if(u.energy>115&&u.age>52&&this.units.length<155){u.energy-=54;this.spawn(u.x+this.range(-12,12),u.y+this.range(-12,12),this.mutate(g),u);}
   if(u.energy<=0)this.die(u,'飢餓');else if(u.age>1500)this.die(u,'寿命');
  }
  this.units=this.units.filter(u=>!u.dead);
  if(this.tick%20===0)this.snapshot();
  if(this.tick%160===0&&this.units.length===0)this.log('info','全個体が絶滅。生命を移入できます');
 }
 paint(x,y,type,radius){const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL);for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){if(dx*dx+dy*dy>radius*radius)continue;const xx=cx+dx,yy=cy+dy;if(xx>=0&&xx<NX&&yy>=0&&yy<NY)this.tiles[yy*NX+xx]=type;}}
 introduce(x,y){for(let i=0;i<5;i++)this.spawn(x+this.range(-15,15),y+this.range(-15,15),this.gene());this.log('info','生命を5体移入');}
 epidemic(){let n=0;for(const u of this.units)if(this.rand()<.55){this.die(u,'疫病');n++;}this.units=this.units.filter(u=>!u.dead);this.log('info','疫病で'+n+'体が死亡');}
 drought(){this.growth=7;this.stress=85;this.food=this.food.slice(0,Math.floor(this.food.length*.2));this.log('info','干ばつが発生した');}
 rain(){this.growth=90;this.stress=8;this.log('info','降雨により栄養供給が増加した');}
 get livingSpecies(){return [...this.species.values()].filter(s=>s.current>0).length;}
 get recentSpecies(){return this.discoveries.filter(t=>this.tick-t<300).length;}
}
export const WORLD={width:W,height:H,cell:CELL,columns:NX,rows:NY};
