// Edenomaly simulation: browser-only; no DOM or Canvas dependencies.
const W=800,H=460,CELL=20,NX=40,NY=23;
export const TERRAIN_NAMES=['草地','水辺','乾燥地','岩場'];
export const TERRAIN_COLORS=['#386e4c','#276484','#927a4b','#505562'];
// Relative nutrient input: grass > wetland > dryland > rock.
export const TERRAIN_FERTILITY=[1,.58,.14,.055];
const GROWTH=TERRAIN_FERTILITY,DECAY=[.026,.038,.006,.003];
const PREFIX=['モコ','ミュ','ルミ','ネム','ゾル','リュ','シル','ノク','ヴェル','テラ'];
const SUFFIX=['リア','リス','ルン','ミア','ゾア','ティス','ノク','ピア'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const terrainFitness=(g,t)=>{
 // Traits are inherited; acquired acclimatization is deliberately not simulated.
 const tolerance=[1, g.wet, g.dry, g.rock??.2][t];
 const fitness=t===0?1:clamp(.28+.95*tolerance,.28,1.23);
 return {fitness,move:clamp(.43+.57*fitness,.45,1.14),
   upkeep:t===0?0:(1-tolerance)*[0,.38,.51,.61][t]+tolerance*.045};
};
export const dietProfile=g=>{
 const diet=clamp(g.diet,0,1);
 // The visual signal is heritable separately from feeding ability.
 const signal=clamp(diet+(g.deception-.5)*1.35,0,1);
 return {diet,plant:1-diet,meat:diet,signal,
  label:diet<.3?'栄養食':diet>.7?'肉食':'雑食'};
};
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
 const predatory=dietProfile(g).meat>.14&&g.jaw>=.55&&mouths>=1;
 const upkeep=.13+bodyMass*.009+g.eyes*.025+g.legs*.022+mouths*.042+g.jaw*.028+Math.abs(g.deception-.5)*.055;
 const foodGain=1+Math.min(.42,(mouths-1)*.13);
 return {width,length,bodyMass,eyeRange,speed,turnRate,biteReach,edibleRatio,predatory,upkeep,foodGain};
};
const distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const HERITABLE=['r','elongation','eyes','mouths','legs','jaw','wet','dry','shell','guard','nesting','hue','saturation','lightness','pattern','brood','diet','deception','rock'];
export const eggTraits=g=>({
 shell:g.shell,guard:g.guard,nesting:g.nesting,
 incubation:Math.round(34+g.shell*30),
 eggEnergy:11+g.shell*9,
 guardingCost:g.guard*.16,
});
export class Ecosystem{
 constructor(seed=971253){this.initialSeed=seed;this.reset();}
 rand(){let x=this.rng;x^=x<<13;x^=x>>>17;x^=x<<5;this.rng=x;return(x>>>0)/4294967296;}
 range(a,b){return a+(b-a)*this.rand();}
 cell(x,y){return clamp(Math.floor(y/CELL),0,NY-1)*NX+clamp(Math.floor(x/CELL),0,NX-1);}
 terrain(x,y){return this.tiles[this.cell(x,y)];}
 gene(){return {r:this.range(3.6,7.3),elongation:this.range(.75,2.45),eyes:1+Math.floor(this.rand()*4),mouths:1+Math.floor(this.rand()*3),legs:2*Math.floor(this.rand()*4),jaw:this.range(.3,1.7),wet:this.rand(),dry:this.rand(),shell:this.rand(),guard:this.rand(),nesting:this.rand(),hue:this.range(0,360),saturation:this.range(48,100),lightness:this.range(42,81),pattern:Math.floor(this.rand()*4),brood:2+Math.floor(this.rand()*4),diet:this.rand(),deception:clamp(.5+this.range(-.32,.32),0,1),rock:this.rand()};}
 mutate(g){return {r:clamp(g.r+this.range(-.45,.45),3,9),elongation:clamp(g.elongation+this.range(-.22,.22),.65,3),eyes:clamp(g.eyes+(this.rand()<.13?(this.rand()<.5?-1:1):0),0,6),mouths:clamp(g.mouths+(this.rand()<.12?(this.rand()<.5?-1:1):0),1,4),legs:clamp(g.legs+(this.rand()<.17?(this.rand()<.5?-2:2):0),0,8),jaw:clamp(g.jaw+this.range(-.19,.19),.2,2.5),wet:clamp(g.wet+this.range(-.11,.11),0,1),dry:clamp(g.dry+this.range(-.11,.11),0,1),shell:clamp(g.shell+this.range(-.12,.12),0,1),guard:clamp(g.guard+this.range(-.12,.12),0,1),nesting:clamp(g.nesting+this.range(-.12,.12),0,1),hue:(g.hue+this.range(-32,32)+360)%360,saturation:clamp(g.saturation+this.range(-9,9),35,100),lightness:clamp(g.lightness+this.range(-9,9),35,85),pattern:clamp(g.pattern+(this.rand()<.15?(this.rand()<.5?-1:1):0),0,3),brood:clamp(g.brood+(this.rand()<.2?(this.rand()<.5?-1:1):0),1,8),diet:clamp(g.diet+this.range(-.16,.16),0,1),deception:clamp(g.deception+this.range(-.16,.16),0,1),rock:clamp(g.rock+this.range(-.13,.13),0,1)};}
 // Each locus is inherited from either parent; small, rare mutations add novel alleles.
 recombine(a,b){
  const child={};
  for(const key of HERITABLE)child[key]=this.rand()<.5?a[key]:b[key];
  // Mutation is secondary to recombination, not a clone-based reproduction mechanism.
  return this.rand()<.18?this.mutate(child):child;
 }
 category(g){return [Math.floor(g.r/2),Math.floor(g.elongation/.65),g.eyes,g.mouths,g.legs,Math.floor(g.jaw/.65),Math.floor(g.wet*3),Math.floor(g.dry*3),Math.floor(g.shell*3),Math.floor(g.guard*3),Math.floor(g.nesting*3),Math.floor(g.hue/60),Math.floor(g.saturation/25),Math.floor(g.lightness/25),g.pattern,Math.ceil(g.brood/2),Math.floor(g.diet*4),Math.floor(dietProfile(g).signal*4),Math.floor(g.rock*3)].join('-');}
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
  const u={id:this.nextId++,x:clamp(x,10,W-10),y:clamp(y,10,H-10),angle:this.range(0,Math.PI*2),g,energy:parent?37:this.range(64,86),age:0,generation:parent?parent.generation+1:0,parent:parent?.id??null,otherParent:parent?.otherParent??null,dead:false,bite:0,stage:parent?'juvenile':'adult',mateCooldown:0,courtPartner:null,pregnancy:null,lastTerrain:this.terrain(x,y),migrations:0,refugeTarget:null};
  u.category=this.category(g);this.units.push(u);
  if(!this.species.has(u.category)){
   const n=this.species.size+1;this.species.set(u.category,{n,name:this.name(n),current:0,total:0,hue:g.hue,saturation:g.saturation,lightness:g.lightness,pattern:g.pattern,diet:dietProfile(g).label,first:this.tick});this.discoveries.push(this.tick);this.log('new','新しい形態：'+this.name(n),u);
  }
  const s=this.species.get(u.category);s.current++;s.total++;
  this.log('birth','#'+u.id+' '+(u.stage==='juvenile'?'孵化':'移入')+'（'+s.name+' / 第'+u.generation+'世代）',u);
  return u;
 }
 die(u,cause,consumed=0){
  if(u.dead)return;
  u.dead=true;u.courtPartner=null;this.species.get(u.category).current--;
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
   const safe=terrainFitness(u.g,landscape).fitness*.9+GROWTH[landscape]*.6-threat*2;
   const s=trait*safe+this.range(-.6,.6)-(1-trait)*Math.hypot(x-u.x,y-u.y)/50;
   if(s>score){score=s;best={x,y};}
  }
  return best;
 }
 isReadyToMate(u){
  return !u.dead&&u.stage==='adult'&&u.age>42&&u.energy>=65&&u.mateCooldown===0&&!u.pregnancy;
 }
 findMate(u,batch){
  if(!this.isReadyToMate(u))return null;
  const sight=Math.max(100,morphology(u.g).eyeRange*1.6);
  let match=null,best=sight*sight;
  for(const v of batch){
   if(v===u||!this.isReadyToMate(v)||v.courtPartner&&v.courtPartner!==u.id)continue;
   // Direct parent-offspring pairing is excluded.
   if(u.parent===v.id||v.parent===u.id)continue;
   const d=distance(u,v);
   if(d<best){match=v;best=d;}
  }
  return match;
 }
 // A pair must remain close while courting; pairing is not permanent.
 startCourtship(a,b){
  if(!a||!b||a===b||a.courtPartner||b.courtPartner||!this.isReadyToMate(a)||!this.isReadyToMate(b))return false;
  a.courtPartner=b.id;b.courtPartner=a.id;
  this.courtships.push({a:a.id,b:b.id,progress:0,required:24});
  this.log('court','#'+a.id+' と #'+b.id+' が求愛を開始',a);
  return true;
 }
 cancelCourtship(pair){
  const a=this.units.find(u=>u.id===pair.a),b=this.units.find(u=>u.id===pair.b);
  if(a&&a.courtPartner===pair.b)a.courtPartner=null;
  if(b&&b.courtPartner===pair.a)b.courtPartner=null;
 }
 // Fertilization combines both parents' genomes. The egg does not appear yet.
 conceive(parent,partner){
  if(!partner||parent===partner||!this.isReadyToMate(parent)||!this.isReadyToMate(partner)||this.eggs.length>=220)return null;
  // An inherited brood-size trait trades clutch size against parental energy.
  const desired=clamp(Math.round((parent.g.brood+partner.g.brood)/2),1,8);
  const affordable=clamp(Math.floor((Math.min(parent.energy,160)-26)/8),1,8);
  const count=Math.min(desired,affordable,220-this.eggs.length);
  if(count<1)return null;
  const genomes=Array.from({length:count},()=>this.recombine(parent.g,partner.g));
  const pregnancy={genomes,parent:parent.id,otherParent:partner.id,generation:Math.max(parent.generation,partner.generation)+1,remaining:36,total:36};
  parent.pregnancy=pregnancy;
  parent.energy-=15+count*8+parent.g.nesting*3;partner.energy-=10+count*2;
  parent.mateCooldown=145;partner.mateCooldown=145;
  this.matings++;
  this.log('mate','#'+parent.id+' × #'+partner.id+' が交配（卵 '+count+' 個を準備）',parent);
  return pregnancy;
 }
 layEgg(parent,partner=null){
  // Explicit test helper: two parents can conceive; actual egg laying is delayed.
  if(partner)return this.conceive(parent,partner);
  if(!parent.pregnancy||this.eggs.length>=220)return null;
  const p=parent.pregnancy,site=this.chooseNest(parent);
  const count=Math.min(p.genomes.length,220-this.eggs.length);
  if(count===0)return null;
  const laid=[];
  for(let i=0;i<count;i++){
   const g=p.genomes[i],traits=eggTraits(g);
   const egg={id:this.nextId++,x:clamp(site.x+this.range(-11,11),6,W-6),y:clamp(site.y+this.range(-11,11),6,H-6),g,parent:p.parent,otherParent:p.otherParent,generation:p.generation,age:0,hatchAt:traits.incubation,energy:traits.eggEnergy,dead:false};
   laid.push(egg);this.eggs.push(egg);
  }
  parent.pregnancy=null;
  this.log('egg','#'+parent.id+' が '+laid.length+' 個の卵を産んだ（相手 #'+p.otherParent+'）',parent);
  this.eggTrails.push({parent:parent.id,egg:laid[0].id,x1:parent.x,y1:parent.y,x2:site.x,y2:site.y,age:0,life:65});
  return laid[0];
 }
 updateCourtships(){
  for(const pair of this.courtships){
   const a=this.units.find(u=>u.id===pair.a),b=this.units.find(u=>u.id===pair.b);
   if(!a||!b||!this.isReadyToMate(a)||!this.isReadyToMate(b)||distance(a,b)>65**2){
    this.cancelCourtship(pair);pair.done=true;continue;
   }
   if(distance(a,b)<35**2)pair.progress++;
   if(pair.progress>=pair.required){
    this.cancelCourtship(pair);pair.done=true;
    this.conceive(a,b);
   }
  }
  this.courtships=this.courtships.filter(p=>!p.done);
 }
 eatEgg(egg,hunter){
  if(egg.dead||dietProfile(hunter.g).meat===0)return false;
  egg.dead=true;
  hunter.energy+=egg.energy*(.8+eggTraits(egg.g).shell*.12)*dietProfile(hunter.g).meat;
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
  this.rng=this.initialSeed||971253;this.units=[];this.eggs=[];this.food=[];this.corpses=[];this.species=new Map();this.logs=[];this.effects=[];this.history=[];this.discoveries=[];this.tick=0;this.nextId=1;this.recycled=0;this.matings=0;this.migrations=0;this.courtships=[];this.eggTrails=[];this.recycledByTerrain=[0,0,0,0];this.growth=70;this.stress=15;
  this.setupTerrain();
  for(let i=0;i<400;i++){const x=this.range(0,W),y=this.range(0,H);if(this.rand()<GROWTH[this.terrain(x,y)])this.addFood(x,y,1,2);}
  // Initial colonies create opportunities for mating without guaranteeing survival.
  const colonies=[{x:160,y:135},{x:405,y:300},{x:655,y:160}];
  for(let i=0;i<36;i++){
   const hub=colonies[i%colonies.length];
   const u=this.spawn(clamp(hub.x+this.range(-48,48),20,W-20),clamp(hub.y+this.range(-48,48),20,H-20),this.gene());
   if(u){u.age=Math.floor(this.range(40,57));u.energy=this.range(95,120);}
  }
  this.log('info','地形、遺伝、捕食、死体分解の実験を開始');this.snapshot();
 }
 snapshot(){this.history.push({population:this.units.length,eggs:this.eggs.length,food:this.food.length,corpses:this.corpses.length});if(this.history.length>180)this.history.shift();}
 step(){
  this.tick++;
  const attempts=4+Math.floor(this.growth/7);
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
   if(u.pregnancy){u.pregnancy.remaining--;if(u.pregnancy.remaining<=0)this.layEgg(u);}
   const g=u.g,t=this.terrain(u.x,u.y),m=morphology(g),diet=dietProfile(g),home=terrainFitness(g,t);
   const youth=u.stage==='juvenile'?.50:1;
   let nearest=null,df=m.eyeRange*m.eyeRange;
   if(diet.plant>0)for(const f of this.food){const d=distance(u,f);if(d<df){df=d;nearest=f;}}
   // Eggs are stationary and cannot fight or flee. Guardians only deter some hunters.
   let targetEgg=null,ed=m.eyeRange*m.eyeRange;
   if(u.bite===0&&diet.meat>.12&&g.mouths>0)for(const egg of this.eggs){
    if(egg.dead||egg.parent===u.id||egg.otherParent===u.id)continue;
    let d=distance(u,egg);if(d>=ed)continue;
    const guardian=batch.find(v=>v.id===egg.parent&&!v.dead&&v.g.guard>.25&&distance(v,egg)<(14+v.g.guard*43)**2);
    const risk=guardian&&guardian!==u&&morphology(guardian.g).bodyMass>=m.bodyMass*.65?1+guardian.g.guard*3:1;
    d*=risk; if(d<ed){ed=d;targetEgg=egg;}
   }
  let prey=null,pd=m.eyeRange*m.eyeRange;
   if(m.predatory&&u.bite===0)for(const v of batch){
    if(v===u||v.dead||v.id===u.courtPartner||morphology(v.g).bodyMass>m.bodyMass*m.edibleRatio)continue;
    const d=distance(u,v);if(d<pd){pd=d;prey=v;}
   }
   // Prey respond to the perceived, visible feeding signal, not hidden genome.
   let danger=null,dangerD=m.eyeRange*m.eyeRange*1.6;
   for(const v of batch){
    if(v===u||v.dead)continue;
    const visible=dietProfile(v.g).signal;
    if(visible<.48||morphology(v.g).bodyMass<m.bodyMass*.55)continue;
    const d=distance(u,v);
    if(d<dangerD){danger=v;dangerD=d;}
   }
   const flight=!!danger&&(diet.diet<.7||morphology(danger.g).bodyMass>m.bodyMass*1.5);
   u.fleeing=flight;
   // Competition is local crowding for the same food, not an arbitrary caste.
   // When nearby rivals monopolize a rich tile, search for a less crowded refuge.
   let rivals=0,stronger=0;
   if(diet.plant>.25)for(const v of batch){
    if(v===u||v.dead||dietProfile(v.g).plant<.25)continue;
    if(distance(u,v)<48**2){rivals++;if(morphology(v.g).bodyMass>m.bodyMass*.95)stronger++;}
   }
   const pressure=(rivals+stronger*.7)/(1+GROWTH[t]*5);
   const seekRefuge=!u.courtPartner&&!u.pregnancy&&!flight&&pressure>1.35&&u.energy<115;
   if(seekRefuge&&(this.tick+u.id)%14===0){
    let best=null,bestScore=-Infinity;
    for(let i=0;i<12;i++){
     const x=clamp(u.x+this.range(-120,120),8,W-8),y=clamp(u.y+this.range(-120,120),8,H-8);
     const terrain=this.terrain(x,y);
     let competitors=0;
     for(const v of batch)if(v!==u&&!v.dead&&dietProfile(v.g).plant>.25&&distance({x,y},v)<48**2)competitors++;
     const fit=terrainFitness(g,terrain).fitness;
     const score=fit*.85+GROWTH[terrain]*.6-competitors*.37+this.range(-.12,.12);
     if(score>bestScore){bestScore=score;best={x,y,terrain};}
    }
    if(best&&best.terrain!==t&&bestScore>home.fitness*.85+GROWTH[t]*.6-pressure*.26){
     u.refugeTarget={x:best.x,y:best.y,until:this.tick+85};
     this.log('migration','#'+u.id+' が競争を避けて'+TERRAIN_NAMES[best.terrain]+'へ移動を開始',u);
    }
   }
   if(u.refugeTarget&&(this.tick>=u.refugeTarget.until||distance(u,u.refugeTarget)<12**2))u.refugeTarget=null;
   const mate=u.courtPartner?batch.find(v=>v.id===u.courtPartner&&!v.dead):this.findMate(u,batch);
   let target=prey&&pd<df*1.4?prey:nearest;
   if(mate&&(u.courtPartner||!target||u.energy>=86))target=mate;
   if(targetEgg&&ed<Math.min(df,pd)*1.15)target=targetEgg;
   if(u.refugeTarget&&!flight&&!u.courtPartner)target=u.refugeTarget;
   // Guarding trades feeding opportunities for staying near the offspring.
   const ownEgg=this.eggs.find(e=>e.parent===u.id&&!e.dead);
   if(ownEgg&&g.guard>.15&&!flight){
    const guardRadius=12+g.guard*40;
    if(distance(u,ownEgg)>guardRadius**2||!target)target=ownEgg;
   }
   // Immediate escape overrides food, reproduction and egg guarding.
   if(flight)target=null;
   const desired=flight?Math.atan2(u.y-danger.y,u.x-danger.x)
      :target?Math.atan2(target.y-u.y,target.x-u.x):u.angle+this.range(-.5,.5);
   const turn=Math.atan2(Math.sin(desired-u.angle),Math.cos(desired-u.angle));u.angle+=clamp(turn,-m.turnRate,m.turnRate)+this.range(-.09,.09);
   const terrainMove=home.move;
   const courtingMate=u.courtPartner?batch.find(v=>v.id===u.courtPartner):null;
   const speed=m.speed*(u.stage==='juvenile'?.8:1)*terrainMove
     *(flight?1.24:courtingMate&&distance(u,courtingMate)<22**2?.20:1);
   u.x=clamp(u.x+Math.cos(u.angle)*speed,7,W-7);u.y=clamp(u.y+Math.sin(u.angle)*speed,7,H-7);
   u.energy-=m.upkeep*youth+(flight?.10:0)+(ownEgg?g.guard*.16:0)+this.stress*.0035+home.upkeep+(g.wet+g.dry+g.rock)*.055;
   if(!flight&&diet.plant>0&&nearest&&distance(u,nearest)<(m.biteReach+3)**2){u.energy+=nearest.energy*m.foodGain*diet.plant*home.fitness;const pos=this.food.indexOf(nearest);if(pos>=0)this.food.splice(pos,1);this.log('meal','#'+u.id+' が食事した',u);}
   if(!flight&&targetEgg&&!targetEgg.dead&&u.bite===0&&distance(u,targetEgg)<(m.biteReach+4)**2)this.eatEgg(targetEgg,u);
   if(!flight&&mate&&!u.courtPartner&&!mate.courtPartner&&distance(u,mate)<38**2)this.startCourtship(u,mate);
   if(!flight&&diet.meat>0&&prey&&!prey.dead&&distance(u,prey)<(m.biteReach+prey.g.r)**2){const eaten=Math.max(5,prey.energy*.45)*m.foodGain*diet.meat;u.energy+=eaten;u.bite=30;this.log('pred','#'+u.id+' が #'+prey.id+' を捕食',u);this.die(prey,'捕食',eaten);}
   const newTerrain=this.terrain(u.x,u.y);
   if(newTerrain!==u.lastTerrain){u.lastTerrain=newTerrain;u.migrations++;this.migrations++;}
   if(u.stage==='juvenile'&&u.age>=65&&u.energy>=32){u.stage='adult';this.log('mature','#'+u.id+' が成体になった',u);}

   if(u.energy<=0)this.die(u,'飢餓');else if(u.age>1500)this.die(u,'寿命');
  }
  this.updateCourtships();
  this.units=this.units.filter(u=>!u.dead);this.eggs=this.eggs.filter(e=>!e.dead);
  for(const trail of this.eggTrails)trail.age++;
  this.eggTrails=this.eggTrails.filter(t=>t.age<t.life);
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
