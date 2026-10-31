// Edenomaly simulation: browser-only; no DOM or Canvas dependencies.
const W=800,H=460,CELL=20,NX=40,NY=23;
export const TERRAIN_NAMES=['草地','水辺','乾燥地','岩場'];
export const TERRAIN_COLORS=['#386e4c','#276484','#927a4b','#505562'];
const GROWTH=[1,.75,.10,.015],DECAY=[.026,.038,.006,.003];
const PREFIX=['モコ','ミュ','ルミ','ネム','ゾル','リュ','シル','ノク','ヴェル','テラ'];
const SUFFIX=['リア','リス','ルン','ミア','ゾア','ティス','ノク','ピア'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Morphology is the source of functional abilities; no separate speed/vision/attack genes.
export const morphology=g=>{
 const width=g.r, length=g.r*g.elongation;
 const bodyMass=width*width*g.elongation;
 const eyeRange=32+g.eyes*13;
 const legsFactor=g.legs===0?.38:Math.min(1.65,.66+.17*g.legs);
 const speed=3.8*legsFactor/(.73+bodyMass*.017);
 const turnRate=clamp(.29/(.75+g.elongation*.21),.12,.29);
 const mouths=g.mouths;
 const biteReach=width*(.7+.15*mouths)+g.jaw*1.6;
 const edibleRatio=clamp(.60+.055*mouths+.06*g.jaw,.62,.88);
 const predatory=g.jaw>=1.16&&mouths>=1;
 const upkeep=.13+bodyMass*.009+g.eyes*.025+g.legs*.022+mouths*.042+g.jaw*.028;
 const foodGain=1+Math.min(.42,(mouths-1)*.13);
 return {width,length,bodyMass,eyeRange,speed,turnRate,biteReach,edibleRatio,predatory,upkeep,foodGain};
};
const distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const HERITABLE=['r','elongation','eyes','mouths','legs','jaw','wet','dry','shell','guard','nesting','hue'];
export const eggTraits=g=>({
 shell:g.shell,guard:g.guard,nesting:g.nesting,
 incubation:Math.round(52+g.shell*44),
 eggEnergy:15+g.shell*12,
 guardingCost:g.guard*.16,
});
export class Ecosystem{
 constructor(seed=971253){this.initialSeed=seed;this.reset();}
 rand(){let x=this.rng;x^=x<<13;x^=x>>>17;x^=x<<5;this.rng=x;return(x>>>0)/4294967296;}
 range(a,b){return a+(b-a)*this.rand();}
 cell(x,y){return clamp(Math.floor(y/CELL),0,NY-1)*NX+clamp(Math.floor(x/CELL),0,NX-1);}
 terrain(x,y){return this.tiles[this.cell(x,y)];}
 gene(){return {r:this.range(3.6,7.3),elongation:this.range(.75,2.45),eyes:1+Math.floor(this.rand()*4),mouths:1+Math.floor(this.rand()*3),legs:2*Math.floor(this.rand()*4),jaw:this.range(.3,1.7),wet:this.rand(),dry:this.rand(),shell:this.rand(),guard:this.rand(),nesting:this.rand(),hue:this.range(0,360)};}
 mutate(g){return {r:clamp(g.r+this.range(-.45,.45),3,9),elongation:clamp(g.elongation+this.range(-.22,.22),.65,3),eyes:clamp(g.eyes+(this.rand()<.13?(this.rand()<.5?-1:1):0),0,6),mouths:clamp(g.mouths+(this.rand()<.12?(this.rand()<.5?-1:1):0),1,4),legs:clamp(g.legs+(this.rand()<.17?(this.rand()<.5?-2:2):0),0,8),jaw:clamp(g.jaw+this.range(-.19,.19),.2,2.5),wet:clamp(g.wet+this.range(-.11,.11),0,1),dry:clamp(g.dry+this.range(-.11,.11),0,1),shell:clamp(g.shell+this.range(-.12,.12),0,1),guard:clamp(g.guard+this.range(-.12,.12),0,1),nesting:clamp(g.nesting+this.range(-.12,.12),0,1),hue:(g.hue+this.range(-18,18)+360)%360};}
 // Each locus is inherited from either parent; small, rare mutations add novel alleles.
 recombine(a,b){
  const child={};
  for(const key of HERITABLE)child[key]=this.rand()<.5?a[key]:b[key];
  // Mutation is secondary to recombination, not a clone-based reproduction mechanism.
  return this.rand()<.18?this.mutate(child):child;
 }
 category(g){return [Math.floor(g.r/2),Math.floor(g.elongation/.65),g.eyes,g.mouths,g.legs,Math.floor(g.jaw/.65),Math.floor(g.wet*3),Math.floor(g.dry*3),Math.floor(g.shell*3),Math.floor(g.guard*3),Math.floor(g.nesting*3),Math.floor(g.hue/120)].join('-');}
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
  const u={id:this.nextId++,x:clamp(x,10,W-10),y:clamp(y,10,H-10),angle:this.range(0,Math.PI*2),g,energy:parent?37:this.range(64,86),age:0,generation:parent?parent.generation+1:0,parent:parent?.id??null,otherParent:parent?.otherParent??null,dead:false,bite:0,stage:parent?'juvenile':'adult',mateCooldown:0};
  u.category=this.category(g);this.units.push(u);
  if(!this.species.has(u.category)){
   const n=this.species.size+1;this.species.set(u.category,{n,name:this.name(n),current:0,total:0,hue:g.hue,first:this.tick});this.discoveries.push(this.tick);this.log('new','新しい形態：'+this.name(n),u);
  }
  const s=this.species.get(u.category);s.current++;s.total++;
  this.log('birth','#'+u.id+' '+(u.stage==='juvenile'?'孵化':'移入')+'（'+s.name+' / 第'+u.generation+'世代）',u);
  return u;
 }
 die(u,cause,consumed=0){
  if(u.dead)return;
  u.dead=true;this.species.get(u.category).current--;
  const mass=Math.max(8,morphology(u.g).bodyMass*1.2+Math.max(0,u.energy)*.4-consumed);
  this.corpses.push({x:u.x,y:u.y,mass,reserve:0,age:0,cause});
  this.log('death','#'+u.id+' 死亡：'+cause,u);
  if(this.species.get(u.category).current===0)this.log('info',this.species.get(u.category).name+' が絶滅');
 }
 chooseNest(u){
  let best={x:u.x,y:u.y},score=-Infinity;
  const trait=u.g.nesting;
  for(let k=0;k<8;k++){
   const x=clamp(u.x+this.range(-34,34),10,W-10),y=clamp(u.y+this.range(-34,34),10,H-10);
   let threat=0;for(const v of this.units){if(v!==u&&!v.dead&&morphology(v.g).predatory&&distance({x,y},v)<45**2)threat++;}
   const landscape=this.terrain(x,y);
   const safe=(landscape===0?1:landscape===1?.4:landscape===2?-.2:-.6)-threat*2;
   const s=trait*safe+this.range(-.6,.6)-(1-trait)*Math.hypot(x-u.x,y-u.y)/50;
   if(s>score){score=s;best={x,y};}
  }
  return best;
 }
 isReadyToMate(u){
  return !u.dead&&u.stage==='adult'&&u.age>60&&u.energy>=85&&u.mateCooldown===0;
 }
 findMate(u,batch){
  if(!this.isReadyToMate(u))return null;
  const sight=Math.max(100,morphology(u.g).eyeRange*1.6);
  let match=null,best=sight*sight;
  for(const v of batch){
   if(v===u||!this.isReadyToMate(v))continue;
   // Direct parent-offspring pairing is excluded.
   if(u.parent===v.id||v.parent===u.id)continue;
   const d=distance(u,v);
   if(d<best){match=v;best=d;}
  }
  return match;
 }
 layEgg(parent,partner){
  if(!partner||parent===partner||!this.isReadyToMate(parent)||!this.isReadyToMate(partner)||this.eggs.length>=220)return null;
  const g=this.recombine(parent.g,partner.g),traits=eggTraits(g),site=this.chooseNest(parent);
  const egg={id:this.nextId++,x:site.x,y:site.y,g,parent:parent.id,otherParent:partner.id,generation:Math.max(parent.generation,partner.generation)+1,age:0,hatchAt:traits.incubation,energy:traits.eggEnergy,dead:false};
  this.eggs.push(egg);
  parent.energy-=37+traits.eggEnergy*.55+parent.g.nesting*6;
  partner.energy-=27;
  parent.mateCooldown=180;partner.mateCooldown=180;
  this.matings++;
  this.log('mate','#'+parent.id+' × #'+partner.id+' が交配',parent);
  this.log('egg','両親 #'+parent.id+' / #'+partner.id+' の卵 #'+egg.id+' が産まれた',egg);
  return egg;
 }
 eatEgg(egg,hunter){
  if(egg.dead)return false;
  egg.dead=true;
  hunter.energy+=egg.energy*(.8+eggTraits(egg.g).shell*.12);
  hunter.bite=Math.round(12+egg.g.shell*27);
  this.log('eggeaten','#'+hunter.id+' が卵 #'+egg.id+' を食べた',egg);
  return true;
 }
 setupTerrain(){
  this.tiles=new Uint8Array(NX*NY);
  const hubs=[{x:10,y:9,t:1,r:6},{x:33,y:18,t:1,r:5},{x:30,y:5,t:2,r:9},{x:7,y:20,t:2,r:5},{x:21,y:17,t:3,r:4},{x:38,y:9,t:3,r:4}];
  for(let y=0;y<NY;y++)for(let x=0;x<NX;x++){
   let t=0;for(const h of hubs)if(Math.hypot(x-h.x,y-h.y)+this.range(-1.4,1.4)<h.r)t=h.t;this.tiles[y*NX+x]=t;
  }
 }
 reset(){
  this.rng=this.initialSeed||971253;this.units=[];this.eggs=[];this.food=[];this.corpses=[];this.species=new Map();this.logs=[];this.effects=[];this.history=[];this.discoveries=[];this.tick=0;this.nextId=1;this.recycled=0;this.matings=0;this.recycledByTerrain=[0,0,0,0];this.growth=55;this.stress=20;
  this.setupTerrain();
  for(let i=0;i<400;i++){const x=this.range(0,W),y=this.range(0,H);if(this.rand()<GROWTH[this.terrain(x,y)])this.addFood(x,y,1,2);}
  for(let i=0;i<27;i++)this.spawn(this.range(35,W-35),this.range(35,H-35),this.gene());
  this.log('info','地形、遺伝、捕食、死体分解の実験を開始');this.snapshot();
 }
 snapshot(){this.history.push({population:this.units.length,eggs:this.eggs.length,food:this.food.length,corpses:this.corpses.length});if(this.history.length>180)this.history.shift();}
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
  for(const egg of this.eggs){
   egg.age++;
   if(egg.age>=egg.hatchAt&&this.units.length<155){
    egg.dead=true;
    const child=this.spawn(egg.x,egg.y,egg.g,{id:egg.parent,otherParent:egg.otherParent,generation:egg.generation-1});
    if(child){child.energy=egg.energy+17;child.stage='juvenile';this.log('hatch','卵 #'+egg.id+' から #'+child.id+' が孵化',egg);}
   }
  }
  this.eggs=this.eggs.filter(e=>!e.dead);
  const batch=this.units.slice();
  for(const u of batch){
   if(u.dead)continue;u.age++;if(u.bite>0)u.bite--;if(u.mateCooldown>0)u.mateCooldown--;
   const g=u.g,t=this.terrain(u.x,u.y),m=morphology(g);
   const youth=u.stage==='juvenile'?.55:1;
   let nearest=null,df=m.eyeRange*m.eyeRange;
   for(const f of this.food){const d=distance(u,f);if(d<df){df=d;nearest=f;}}
   // Eggs are stationary and cannot fight or flee. Guardians only deter some hunters.
   let targetEgg=null,ed=m.eyeRange*m.eyeRange;
   if(u.bite===0&&g.mouths>0)for(const egg of this.eggs){
    if(egg.dead||egg.parent===u.id)continue;
    let d=distance(u,egg);if(d>=ed)continue;
    const guardian=batch.find(v=>v.id===egg.parent&&!v.dead&&v.g.guard>.25&&distance(v,egg)<(14+v.g.guard*43)**2);
    const risk=guardian&&guardian!==u&&morphology(guardian.g).bodyMass>=m.bodyMass*.65?1+guardian.g.guard*3:1;
    d*=risk; if(d<ed){ed=d;targetEgg=egg;}
   }
  let prey=null,pd=m.eyeRange*m.eyeRange;
   if(m.predatory&&u.bite===0)for(const v of batch){if(v===u||v.dead||morphology(v.g).bodyMass>m.bodyMass*m.edibleRatio)continue;const d=distance(u,v);if(d<pd){pd=d;prey=v;}}
   const mate=this.findMate(u,batch);
   let target=prey&&pd<df*1.4?prey:nearest;
   if(mate&&(!target||u.energy>=108))target=mate;
   if(targetEgg&&ed<Math.min(df,pd)*1.15)target=targetEgg;
   // Guarding trades feeding opportunities for staying near the offspring.
   const ownEgg=this.eggs.find(e=>e.parent===u.id&&!e.dead);
   if(ownEgg&&g.guard>.15){
    const guardRadius=12+g.guard*40;
    if(distance(u,ownEgg)>guardRadius**2||!target)target=ownEgg;
   }
   const desired=target?Math.atan2(target.y-u.y,target.x-u.x):u.angle+this.range(-.5,.5);
   const turn=Math.atan2(Math.sin(desired-u.angle),Math.cos(desired-u.angle));u.angle+=clamp(turn,-m.turnRate,m.turnRate)+this.range(-.09,.09);
   const penalty=t===1?(1-g.wet)*.65:t===2?(1-g.dry)*.6:t===3?.73:0;
   const speed=m.speed*(u.stage==='juvenile'?.8:1)*clamp(1-penalty,.23,1);
   u.x=clamp(u.x+Math.cos(u.angle)*speed,7,W-7);u.y=clamp(u.y+Math.sin(u.angle)*speed,7,H-7);
   u.energy-=m.upkeep*youth+(ownEgg?g.guard*.16:0)+this.stress*.0035+(t===1?(1-g.wet)*.45:t===2?(1-g.dry)*.44:t===3?.27:0)+(g.wet+g.dry)*.055;
   if(nearest&&distance(u,nearest)<(m.biteReach+3)**2){u.energy+=nearest.energy*m.foodGain;const pos=this.food.indexOf(nearest);if(pos>=0)this.food.splice(pos,1);this.log('meal','#'+u.id+' が食事した',u);}
   if(targetEgg&&!targetEgg.dead&&u.bite===0&&distance(u,targetEgg)<(m.biteReach+4)**2)this.eatEgg(targetEgg,u);
   if(mate&&this.isReadyToMate(u)&&this.isReadyToMate(mate)&&distance(u,mate)<(u.g.r+mate.g.r+9)**2)this.layEgg(u,mate);
   if(prey&&!prey.dead&&distance(u,prey)<(m.biteReach+prey.g.r)**2){const eaten=Math.max(5,prey.energy*.45)*m.foodGain;u.energy+=eaten;u.bite=30;this.log('pred','#'+u.id+' が #'+prey.id+' を捕食',u);this.die(prey,'捕食',eaten);}
   if(u.stage==='juvenile'&&u.age>=85&&u.energy>=40){u.stage='adult';this.log('mature','#'+u.id+' が成体になった',u);}

   if(u.energy<=0)this.die(u,'飢餓');else if(u.age>1500)this.die(u,'寿命');
  }
  this.units=this.units.filter(u=>!u.dead);this.eggs=this.eggs.filter(e=>!e.dead);
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
