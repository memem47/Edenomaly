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
 const aquatic=g.aquatic===1;
 const passable=t!==1||aquatic;
 const sight=t===1?(aquatic?clamp(.92+g.wet*.34,.92,1.26):.18):t===2?clamp(.52+g.dry*.56,.52,1.08):t===3?clamp(.67+(g.rock??.2)*.43,.67,1.10):1;
 const hazard=t===1?(aquatic?0:.7):
   t===2?clamp((.50-g.dry)*1.3,0,.65):
   t===3?clamp((.45-(g.rock??.2))*.28,0,.15):0;
 return {fitness,passable,sight,hazard,move:(t===1?(aquatic?.50+g.wet*.26:.035):t===2?.17+g.dry*.42:t===3?.13+(g.rock??.2)*.36:.58),
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
 const eyeRange=20+g.eyes*14;
 const speed=3.45/(.65+bodyMass*.017);
 const turnRate=clamp(.29/(.75+g.elongation*.21),.12,.29);
 const mouths=g.mouths;
 const biteReach=width*(.7+.15*mouths)+g.jaw*1.6;
 const edibleRatio=clamp(.60+.055*mouths+.06*g.jaw,.62,.88);
 const predatory=dietProfile(g).meat>.14&&g.jaw>=.55&&mouths>=1;
 const upkeep=.09+bodyMass*.008+Math.max(0,bodyMass-110)**1.2*.002+g.eyes*.018+mouths*.03+g.jaw*.02+Math.abs(g.deception-.5)*.035+(g.resist??.4)*.04;
 const foodGain=1+Math.min(.42,(mouths-1)*.13);
 return {width,length,bodyMass,eyeRange,speed,turnRate,biteReach,edibleRatio,predatory,upkeep,foodGain};
};
const distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
// Health and senescence directly affect movement, fighting and mating.
export const vitality=u=>{
 const max=u.maxHp??Math.max(25,Math.round(morphology(u.g).bodyMass*.48+25));
 const health=clamp((u.hp??max)/max,0,1);
 const old=clamp((u.age-420)/900,0,1);
 const vigor=clamp((.40+.60*health)*(1-.60*old),.12,1);
 return {max,health,old,vigor};
};
export const rearPosition=(u,offset=0)=>({
 x:clamp(u.x-Math.cos(u.angle)*(u.g.r*u.g.elongation+5+offset),6,W-6),
 y:clamp(u.y-Math.sin(u.angle)*(u.g.r*u.g.elongation+5+offset),6,H-6)
});
const HERITABLE=['r','elongation','eyes','mouths','jaw','wet','dry','shell','guard','nesting','hue','saturation','lightness','brood','diet','deception','rock','resist','aquatic'];
const INTEGER_GENES=new Set(['eyes','mouths','brood','aquatic']);
const LIMITS={r:[3,15],elongation:[.65,3],eyes:[0,6],mouths:[1,4],jaw:[.2,2.5],wet:[0,1],dry:[0,1],rock:[0,1],shell:[0,1],guard:[0,1],nesting:[0,1],hue:[0,360],saturation:[35,100],lightness:[35,85],brood:[1,8],diet:[0,1],deception:[0,1],resist:[0,1],aquatic:[0,1]};
const alleleExpression=(key,pair)=>{
 // Eyes: more-eye allele is dominant; hidden low-eye alleles can reappear in grandchildren.
 // Other continuous traits use incomplete dominance (mean of the two inherited copies).
 const raw=key==='eyes'||key==='aquatic'?Math.max(...pair):(pair[0]+pair[1])/2;
 const [lo,hi]=LIMITS[key];
 const val=clamp(INTEGER_GENES.has(key)?Math.round(raw):raw,lo,hi);
 return key==='hue'?val%360:val;
};
const allelePair=(g,key)=>{
 const pair=g.alleles?.[key];
 return Array.isArray(pair)&&pair.length===2&&Math.abs(alleleExpression(key,pair)-g[key])<1e-6?pair:[g[key],g[key]];
};
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
 gene(){
  const g={r:this.rand()<.15?this.range(8.5,12):this.range(3.1,7.5),
   elongation:this.range(.65,2.85),eyes:Math.floor(this.rand()*7),
   mouths:1+Math.floor(this.rand()*4),jaw:this.range(.2,2.5),
   wet:this.rand(),dry:this.rand(),rock:this.rand(),
   shell:this.rand(),guard:this.rand(),nesting:this.rand(),
   hue:this.range(0,360),saturation:this.range(48,100),lightness:this.range(42,81),
   brood:1+Math.floor(this.rand()*8),diet:this.rand(),
   deception:clamp(.5+this.range(-.42,.42),0,1),resist:this.rand(),
   aquatic:this.rand()<.25?1:0};
  // Each founding individual carries two genetic copies per locus, including
  // recessive alleles that are not necessarily visible in its phenotype.
  g.alleles={};
  for(const key of HERITABLE){
   let second=g[key];
   if(key==='eyes'&&this.rand()<.48)second=Math.floor(this.rand()*(g.eyes+1));
   else if(key!=='aquatic'&&key!=='eyes'&&this.rand()<.38){
    const range=LIMITS[key][1]-LIMITS[key][0];
    second=clamp(g[key]+this.range(-.36,.36)*range,...LIMITS[key]);
   }
   const pair=[g[key],second];
   g.alleles[key]=pair;
   g[key]=alleleExpression(key,pair);
  }
  return g;
 }
 mutate(g){
  const next={...g,alleles:{}};
  for(const key of HERITABLE)next.alleles[key]=[...allelePair(g,key)];
  // Most offspring inherit their grandparents' alleles without change.
  // A mutation alters a single genetic copy, not the entire visible phenotype.
  const key=HERITABLE[Math.floor(this.rand()*HERITABLE.length)];
  const index=this.rand()<.5?0:1;
  const [lo,hi]=LIMITS[key],width=hi-lo;
  let value=next.alleles[key][index];
  if(key==='aquatic')value=1-value;
  else if(INTEGER_GENES.has(key))value+=this.rand()<.5?-1:1;
  else value+=this.range(-.12,.12)*width;
  next.alleles[key][index]=clamp(value,lo,hi);
  for(const trait of HERITABLE)next[trait]=alleleExpression(trait,next.alleles[trait]);
  return next;
 }
 recombine(a,b){
  const child={alleles:{}};
  for(const key of HERITABLE){
   const maternal=allelePair(a,key),paternal=allelePair(b,key);
   const pair=[maternal[this.rand()<.5?0:1],paternal[this.rand()<.5?0:1]];
   child.alleles[key]=pair;
   child[key]=alleleExpression(key,pair);
  }
  return this.rand()<.12?this.mutate(child):child;
 }
 category(g){return [Math.floor(g.r/2),Math.floor(g.elongation/.65),g.eyes,g.mouths,Math.floor(g.jaw/.65),Math.floor(g.wet*3),Math.floor(g.dry*3),Math.floor(g.shell*3),Math.floor(g.guard*3),Math.floor(g.nesting*3),Math.floor(g.hue/60),Math.floor(g.saturation/25),Math.floor(g.lightness/25),Math.ceil(g.brood/2),Math.floor(g.diet*4),Math.floor(dietProfile(g).signal*4),Math.floor(g.rock*3),Math.floor((g.resist??.4)*3),g.aquatic??0].join('-');}
 name(n){return PREFIX[(n*7+2)%PREFIX.length]+SUFFIX[(n*3+1)%SUFFIX.length]+'-'+String(n).padStart(3,'0');}
 log(type,message,point){this.logs.unshift({type,message,step:this.tick});if(this.logs.length>500)this.logs.pop();if(point&&this.effects.length<140)this.effects.push({type,x:point.x,y:point.y,age:0});}
 addFood(x,y,n,spread=8,source='natural'){
  for(let i=0;i<n&&this.food.length<1600;i++){
   const px=clamp(x+this.range(-spread,spread),4,W-4),py=clamp(y+this.range(-spread,spread),4,H-4);
   const amount=this.range(7,14);this.food.push({x:px,y:py,energy:amount,source,age:0});
   if(source==='corpse'){this.recycled++;this.recycledByTerrain[this.terrain(px,py)]++;}
  }
 }
 spawn(x,y,g,parent=null){
  if(this.units.length>=155)return null;
  const u={id:this.nextId++,x:clamp(x,10,W-10),y:clamp(y,10,H-10),angle:this.range(0,Math.PI*2),g,energy:parent?37:this.range(64,86),age:0,generation:parent?parent.generation+1:0,parent:parent?.id??null,otherParent:parent?.otherParent??null,dead:false,bite:0,stage:parent?'juvenile':'adult',hp:Math.max(25,Math.round(morphology(g).bodyMass*.48+25)),maxHp:Math.max(25,Math.round(morphology(g).bodyMass*.48+25)),woundFlash:0,mateCooldown:0,courtPartner:null,pregnancy:null,lineage:parent?.lineage??null,infection:0,hydration:100,stranded:0,submerged:0,lastTerrain:this.terrain(x,y),migrations:0,refugeTarget:null};
  u.category=this.category(g);u.lineage??=u.id;this.units.push(u);
  if(!this.species.has(u.category)){
   const n=this.species.size+1;this.species.set(u.category,{n,name:this.name(n),current:0,total:0,hue:g.hue,saturation:g.saturation,lightness:g.lightness,diet:dietProfile(g).label,first:this.tick,genome:{...g,alleles:Object.fromEntries(Object.entries(g.alleles??{}).map(([key,pair])=>[key,[...pair]]))}});this.discoveries.push(this.tick);this.log('new','新しい形態：'+this.name(n),u);
  }
  const s=this.species.get(u.category);s.current++;s.total++;
  this.log('birth','#'+u.id+' '+(u.stage==='juvenile'?'孵化':'移入')+'（'+s.name+' / 第'+u.generation+'世代）',u);
  return u;
 }
 die(u,cause,consumed=0){
  if(u.dead)return;
  u.dead=true;u.courtPartner=null;this.species.get(u.category).current--;
  const mass=Math.max(8,morphology(u.g).bodyMass*1.2+Math.max(0,u.energy)*.4-consumed);
  this.corpses.push({x:u.x,y:u.y,angle:u.angle,g:{...u.g},stage:u.stage,deathAge:u.age,mass,initialMass:mass,reserve:0,age:0,cause});
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
  return !u.dead&&u.infection===0&&(u.localCrowd??0)<9&&u.stage==='adult'&&u.age>42&&u.energy>=65+Math.max(0,morphology(u.g).bodyMass-100)*.22&&u.mateCooldown===0&&!u.pregnancy&&vitality(u).vigor>.35;
 }
 findMate(u,batch){
  if(!this.isReadyToMate(u))return null;
  const sight=Math.max(52,morphology(u.g).eyeRange*1.3);
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
  const largeParentCost=Math.max(0,morphology(parent.g).bodyMass-100)*.18;
  const affordable=clamp(Math.floor((Math.min(parent.energy,180)-26-largeParentCost)/8),1,8);
  const count=Math.min(desired,affordable,220-this.eggs.length);
  if(count<1)return null;
  const genomes=Array.from({length:count},()=>this.recombine(parent.g,partner.g));
  const pregnancy={genomes,parent:parent.id,otherParent:partner.id,lineage:this.rand()<.5?parent.lineage:partner.lineage,generation:Math.max(parent.generation,partner.generation)+1,remaining:36,total:36};
  parent.pregnancy=pregnancy;
  parent.energy-=15+count*8+parent.g.nesting*3+largeParentCost;partner.energy-=10+count*2+Math.max(0,morphology(partner.g).bodyMass-100)*.08;
  parent.mateCooldown=145;partner.mateCooldown=145;
  this.matings++;
  this.log('mate','#'+parent.id+' × #'+partner.id+' が交配（卵 '+count+' 個を準備）',parent);
  return pregnancy;
 }
 layEgg(parent,partner=null){
  // Explicit test helper: two parents can conceive; actual egg laying is delayed.
  if(partner)return this.conceive(parent,partner);
  if(!parent.pregnancy||this.eggs.length>=220)return null;
  const p=parent.pregnancy;
  // Oviposition is anchored behind the parent's actual facing direction.
  const site=rearPosition(parent,7);
  const count=Math.min(p.genomes.length,220-this.eggs.length);
  if(count===0)return null;
  const laid=[];
  for(let i=0;i<count;i++){
   const g=p.genomes[i],traits=eggTraits(g);
   const rear=rearPosition(parent,5+i*2.5);
   const egg={id:this.nextId++,x:clamp(rear.x+Math.cos(parent.angle+Math.PI/2)*this.range(-6,6),6,W-6),y:clamp(rear.y+Math.sin(parent.angle+Math.PI/2)*this.range(-6,6),6,H-6),g,parent:p.parent,otherParent:p.otherParent,generation:p.generation,lineage:p.lineage,age:0,hatchAt:traits.incubation,energy:traits.eggEnergy,dead:false,bornTick:this.tick,birthX:parent.x-Math.cos(parent.angle)*(parent.g.r*parent.g.elongation+1),birthY:parent.y-Math.sin(parent.angle)*(parent.g.r*parent.g.elongation+1)};
   laid.push(egg);this.eggs.push(egg);
  }
  parent.pregnancy=null;
  this.log('egg','#'+parent.id+' が '+laid.length+' 個の卵を産んだ（相手 #'+p.otherParent+'）',parent);
  const tail=rearPosition(parent,0);
  this.eggTrails.push({parent:parent.id,egg:laid[0].id,x1:tail.x,y1:tail.y,x2:site.x,y2:site.y,age:0,life:38});
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
  if(this.effects.length<140)this.effects.push({type:'consume',x:egg.x,y:egg.y,age:0});
  return true;
 }
 attack(hunter,prey){
  if(hunter===prey||hunter.dead||prey.dead||hunter.bite>0||dietProfile(hunter.g).meat<=0)return false;
  const mm=morphology(hunter.g),v=vitality(hunter),def=vitality(prey);
  const damage=Math.max(2,(4+hunter.g.jaw*7+mm.bodyMass*.065)*dietProfile(hunter.g).meat*v.vigor);
  prey.hp=Math.max(0,prey.hp-damage);
  prey.woundFlash=14;
  hunter.bite=22;
  if(this.effects.length<140)this.effects.push({type:'strike',x:prey.x,y:prey.y,fromX:hunter.x,fromY:hunter.y,age:0});
  this.log('attack','#'+hunter.id+' が #'+prey.id+' に '+Math.round(damage)+' ダメージ',prey);
  if(prey.hp<=0){
   const gained=Math.max(5,prey.energy*.35)*dietProfile(hunter.g).meat;
   hunter.energy+=gained;this.die(prey,'捕食',gained);
   if(this.effects.length<140)this.effects.push({type:'consume',x:prey.x,y:prey.y,age:0});
   this.log('pred','#'+hunter.id+' が #'+prey.id+' を捕食',prey);
  }
  return true;
 }
 nearWater(x,y,radius=1){
  const cx=this.cell(x,y)%NX,cy=Math.floor(this.cell(x,y)/NX);
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   const a=cx+dx,b=cy+dy;
   if(a>=0&&a<NX&&b>=0&&b<NY&&this.tiles[b*NX+a]===1)return true;
  }
  return false;
 }
 nearestWater(x,y,maxRange=145){
  let best=null,dist=maxRange*maxRange;
  for(let i=0;i<this.tiles.length;i++){
   if(this.tiles[i]!==1)continue;
   const a=(i%NX+.5)*CELL,b=(Math.floor(i/NX)+.5)*CELL;
   const d=(x-a)**2+(y-b)**2;
   if(d<dist){best={x:a,y:b};dist=d;}
  }
  return best;
 }
 setupTerrain(){
  this.tiles=new Uint8Array(NX*NY);
  const hubs=[{x:10,y:9,t:1,r:6},{x:33,y:18,t:1,r:5},{x:30,y:5,t:2,r:9},{x:7,y:20,t:2,r:5},{x:21,y:17,t:3,r:4},{x:38,y:9,t:3,r:4}];
  for(let y=0;y<NY;y++)for(let x=0;x<NX;x++){
   let t=0;for(const h of hubs)if(Math.hypot(x-h.x,y-h.y)+this.range(-1.4,1.4)<h.r)t=h.t;this.tiles[y*NX+x]=t;
  }
 }
 reset(){
  this.rng=this.initialSeed||971253;this.units=[];this.eggs=[];this.food=[];this.corpses=[];this.species=new Map();this.logs=[];this.effects=[];this.history=[];this.discoveries=[];this.tick=0;this.nextId=1;this.recycled=0;this.introducedCount=0;this.matings=0;this.migrations=0;this.terrainCrossings=0;this.courtships=[];this.eggTrails=[];this.recycledByTerrain=[0,0,0,0];this.growth=70;this.stress=15;
  this.setupTerrain();
  this.grass=new Float32Array(this.tiles.length);
  this.water=new Float32Array(this.tiles.length);
  this.waterbed=new Uint8Array(this.tiles.length);
  this.soil=new Float32Array(this.tiles.length);
  for(let i=0;i<this.tiles.length;i++){
   if(this.tiles[i]===0)this.grass[i]=65+this.rand()*35;
   if(this.tiles[i]===1){this.water[i]=80+this.rand()*20;this.waterbed[i]=1;}
  }
  this.log('info','生命は未移入。種類数を選んでフィールドへ生命を移入してください');this.snapshot();
 }
 snapshot(){this.history.push({population:this.units.length,eggs:this.eggs.length,food:this.grass.reduce((a,b)=>a+b,0),corpses:this.corpses.length});if(this.history.length>180)this.history.shift();}
 step(){
  this.tick++;
  // Map resources are finite. Grass regrows only from living adjacent patches,
  // so complete overgrazing cannot recover without intervention.
  if(this.tick%6===0){
   const next=this.grass.slice();
   for(let i=0;i<this.tiles.length;i++){
    if(this.tiles[i]===0&&this.grass[i]>0){
     next[i]=Math.min(100,this.grass[i]+(.17+this.soil[i]*.018)*this.growth/70);
    }
    if(this.grass[i]<=0&&this.tiles[i]!==1&&this.tiles[i]!==3){
     const x=i%NX,y=Math.floor(i/NX);
     const neighbors=[x>0?i-1:-1,x<NX-1?i+1:-1,y>0?i-NX:-1,y<NY-1?i+NX:-1];
     // A completely bare world contains no propagules.
     if(neighbors.some(j=>j>=0&&this.grass[j]>18)&&this.rand()<.035*this.growth/70)
      next[i]=4;
    }
    this.soil[i]*=.995;
   }
   this.grass=next;
  }
  // Standing water evaporates naturally. Rain replenishes depleted waterbeds.
  if(this.tick%8===0){
   for(let i=0;i<this.tiles.length;i++)if(this.water[i]>0){
    this.water[i]=Math.max(0,this.water[i]-(.16+this.stress*.003));
    if(this.water[i]===0&&this.tiles[i]===1)this.tiles[i]=2;
   }
  }
  for(let i=this.corpses.length-1;i>=0;i--){
   const c=this.corpses[i];c.age++;
   const loss=Math.min(c.mass,Math.max(.03,c.mass*DECAY[this.terrain(c.x,c.y)]));c.mass-=loss;c.reserve+=loss;
   const id=this.cell(c.x,c.y);
   // Decomposition nourishes soil; tissues also return moisture to the world.
   this.soil[id]=Math.min(100,this.soil[id]+loss*.33);
   if(this.tiles[id]!==1&&this.tiles[id]!==3){
    // Cadaver-derived moisture can form a small new pool on barren ground,
    // never instantly submerging an occupied terrestrial cell.
    c.moisture=(c.moisture??0)+loss*.22;
    if(c.moisture>15&&this.tiles[id]===2&&!this.units.some(u=>!u.dead&&u.g.aquatic!==1&&this.cell(u.x,u.y)===id)){
     this.tiles[id]=1;this.waterbed[id]=1;this.water[id]=Math.min(100,24+c.moisture);
     this.grass[id]=0;c.moisture=0;
    }
    if(this.grass[id]>0)this.grass[id]=Math.min(100,this.grass[id]+loss*.12);
    else if(this.soil[id]>12&&this.rand()<.12){this.tiles[id]=0;this.grass[id]=4;}
   }
   if(c.mass<.6){this.corpses.splice(i,1);this.recycled++;this.recycledByTerrain[this.terrain(c.x,c.y)]++;this.log('decay','死体の有機物と水分が地形に還元された',c);}
  }
  for(const egg of this.eggs){
   egg.age++;
   if(egg.age>=egg.hatchAt&&this.units.length<155){
    egg.dead=true;
    const child=this.spawn(egg.x,egg.y,egg.g,{id:egg.parent,otherParent:egg.otherParent,generation:egg.generation-1,lineage:egg.lineage});
    if(child){child.energy=egg.energy+17;child.stage='juvenile';this.log('hatch','卵 #'+egg.id+' から #'+child.id+' が孵化',egg);}
   }
  }
  this.eggs=this.eggs.filter(e=>!e.dead);
  const batch=this.units.slice();
  for(const u of batch){
   if(u.dead)continue;u.age++;if(u.bite>0)u.bite--;if(u.woundFlash>0)u.woundFlash--;if(u.mateCooldown>0)u.mateCooldown--;
   if(u.pregnancy){u.pregnancy.remaining--;if(u.pregnancy.remaining<=0)this.layEgg(u);}
   const g=u.g,t=this.terrain(u.x,u.y),m=morphology(g),diet=dietProfile(g),home=terrainFitness(g,t);
   const youth=u.stage==='juvenile'?.50:1,body=vitality(u),sight=m.eyeRange*home.sight;
   const aquatic=g.aquatic===1,underwater=t===1&&this.water[this.cell(u.x,u.y)]>0;
   if(aquatic){
    u.stranded=underwater?0:u.stranded+1;
    u.hydration=underwater?Math.min(100,u.hydration+1.6):u.hydration-.85;
    if(underwater)this.consumeWater(u.x,u.y,.095);
   }else{
    u.submerged=underwater?u.submerged+1:0;
    const drinking=this.nearWater(u.x,u.y,1);
    u.hydration=drinking?Math.min(100,u.hydration+.9):u.hydration-.24;
    if(drinking)this.drinkNearby(u.x,u.y,.12);
   }
   if((aquatic&&u.stranded>95)||(!aquatic&&u.submerged>24)||u.hydration<=0){
    this.die(u,aquatic?'離水':u.submerged>24?'溺水':'脱水');continue;
   }
   if(u.hydration<18)u.hp-=.06;
   let nearest=null,df=sight*sight;
   if(diet.plant>0){nearest=this.nearestGrass(u.x,u.y,sight,g);if(nearest)df=distance(u,nearest);}
   // Eggs are stationary and cannot fight or flee. Guardians only deter some hunters.
   let targetEgg=null,ed=sight*sight;
   if(u.bite===0&&diet.meat>.12&&g.mouths>0)for(const egg of this.eggs){
    if(egg.dead||egg.parent===u.id||egg.otherParent===u.id)continue;
    let d=distance(u,egg);if(d>=ed)continue;
    const guardian=batch.find(v=>v.id===egg.parent&&!v.dead&&v.g.guard>.25&&distance(v,egg)<(14+v.g.guard*43)**2);
    const risk=guardian&&guardian!==u&&morphology(guardian.g).bodyMass>=m.bodyMass*.65?1+guardian.g.guard*3:1;
    d*=risk; if(d<ed){ed=d;targetEgg=egg;}
   }
  let prey=null,pd=sight*sight;
   if(m.predatory&&u.bite===0)for(const v of batch){
    if(v===u||v.dead||v.id===u.courtPartner||morphology(v.g).bodyMass>m.bodyMass*m.edibleRatio)continue;
    const d=distance(u,v);if(d<pd){pd=d;prey=v;}
   }
   // Prey respond to the perceived, visible feeding signal, not hidden genome.
   let danger=null,dangerD=sight*sight*1.6;
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
   // Kin-specific contact disease is more likely in dense founder lineages.
   // A new mutation is not instantly immune: lineage persists across offspring.
   let relatives=0,infectious=0;
   for(const v of batch)if(v!==u&&!v.dead&&v.lineage===u.lineage&&distance(u,v)<38**2){
    relatives++;if(v.infection>0)infectious++;
   }
   const crowd=Math.max(0,relatives-2);
   if(u.infection>0){
    u.infection--;
    u.hp-=(.19+crowd*.055)*(1-(g.resist??.4)*.7);
   }else if(crowd>0&&this.rand()<Math.min(.10,crowd*.0025+infectious*.014)*(1-(g.resist??.4)*.9)){
    u.infection=Math.max(25,70+Math.floor(this.rand()*55)-Math.round((g.resist??.4)*40));
    this.log('ill','#'+u.id+' が密集地で感染',u);
   }
   // Crowded colonies consume more energy and stop producing offspring as easily.
   u.energy-=Math.min(.85,Math.max(0,rivals-3)*.075);
   u.localCrowd=relatives;
   const seekRefuge=!u.courtPartner&&!u.pregnancy&&!flight&&(pressure>1.35||relatives>7)&&u.energy<130;
   if(seekRefuge&&(this.tick+u.id)%14===0){
    let best=null,bestScore=-Infinity;
    for(let i=0;i<12;i++){
     const x=clamp(u.x+this.range(-65,65),8,W-8),y=clamp(u.y+this.range(-65,65),8,H-8);
     const terrain=this.terrain(x,y);
     let competitors=0;
     for(const v of batch)if(v!==u&&!v.dead&&dietProfile(v.g).plant>.25&&distance({x,y},v)<48**2)competitors++;
     const habitat=terrainFitness(g,terrain);
     if(!habitat.passable)continue;
     const fit=habitat.fitness;
     const score=fit*.85+GROWTH[terrain]*.6-competitors*.37+this.range(-.12,.12);
     if(score>bestScore){bestScore=score;best={x,y,terrain};}
    }
    if(best&&best.terrain!==t&&bestScore>home.fitness*.85+GROWTH[t]*.6-pressure*.26){
     u.refugeTarget={x:best.x,y:best.y,until:this.tick+85};
     this.log('migration','#'+u.id+' が競争を避けて'+TERRAIN_NAMES[best.terrain]+'へ移動を開始',u);
    }
   }
   if(u.refugeTarget){
    if(distance(u,u.refugeTarget)<12**2){
     const destination=this.terrain(u.refugeTarget.x,u.refugeTarget.y);
     this.migrations++;u.migrations++;
     this.log('settle','#'+u.id+' が'+TERRAIN_NAMES[destination]+'に移住',u);
     u.refugeTarget=null;
    }else if(this.tick>=u.refugeTarget.until)u.refugeTarget=null;
   }
   const mate=u.courtPartner?batch.find(v=>v.id===u.courtPartner&&!v.dead):this.findMate(u,batch);
   let target=prey&&pd<df*1.4?prey:nearest;
   if(mate&&(u.courtPartner||!target||u.energy>=86))target=mate;
   if(targetEgg&&ed<Math.min(df,pd)*1.15)target=targetEgg;
   if(u.refugeTarget&&!flight&&!u.courtPartner)target=u.refugeTarget;
   const nearFood=nearest&&distance(u,nearest)<Math.max(14,sight*.55)**2;
   const criticalWater=u.hydration<24||aquatic&&!underwater&&u.stranded>35;
   if((aquatic&&!underwater||!aquatic&&u.hydration<45&&!this.nearWater(u.x,u.y,1))&&(!nearFood||criticalWater)){
    const water=this.nearestWater(u.x,u.y);if(water)target=water;
   }
   // Guarding trades feeding opportunities for staying near the offspring.
   const ownEgg=this.eggs.find(e=>e.parent===u.id&&!e.dead);
   if(ownEgg&&g.guard>.15&&!flight&&!criticalWater&&u.energy>45){
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
   const speed=m.speed*body.vigor*(u.stage==='juvenile'?.8:1)*terrainMove
     *(flight?1.24:courtingMate&&distance(u,courtingMate)<22**2?.20:1);
   const nextX=clamp(u.x+Math.cos(u.angle)*speed,7,W-7);
   const nextY=clamp(u.y+Math.sin(u.angle)*speed,7,H-7);
   if(terrainFitness(g,this.terrain(nextX,nextY)).passable){u.x=nextX;u.y=nextY;}
   else u.angle+=Math.PI*.72;
   u.hp-=home.hazard;
   u.energy-=m.upkeep*youth*(1+body.old*.18)+(flight?.10:0)+(ownEgg?g.guard*.16:0)+this.stress*.0035+home.upkeep+(g.wet+g.dry+g.rock)*.055;
   if(!flight&&diet.plant>0&&nearest&&distance(u,nearest)<(m.biteReach+13)**2){
    const eaten=this.consumeGrass(nearest.x,nearest.y,Math.min(2.5,1.25*m.foodGain));
    if(eaten>0){u.energy+=eaten*5.8*diet.plant*home.fitness;
     u.hp=Math.min(u.maxHp,u.hp+eaten*.22*(1-body.old*.6));this.log('meal','#'+u.id+' が草を食べた',u);}
   }
   if(!flight&&targetEgg&&!targetEgg.dead&&u.bite===0&&distance(u,targetEgg)<(m.biteReach+4)**2)this.eatEgg(targetEgg,u);
   if(!flight&&mate&&!u.courtPartner&&!mate.courtPartner&&distance(u,mate)<38**2)this.startCourtship(u,mate);
   if(!flight&&diet.meat>0&&prey&&!prey.dead&&distance(u,prey)<(m.biteReach+prey.g.r)**2)this.attack(u,prey);
   const newTerrain=this.terrain(u.x,u.y);
   if(newTerrain!==u.lastTerrain){u.lastTerrain=newTerrain;this.terrainCrossings++;}
   if(u.stage==='juvenile'&&u.age>=65&&u.energy>=32){u.stage='adult';this.log('mature','#'+u.id+' が成体になった',u);}

   if(u.hp<=0)this.die(u,u.infection>0?'感染症':'環境衰弱');else if(u.energy<=0)this.die(u,'飢餓');else if(u.age>1500)this.die(u,'寿命');
  }
  this.updateCourtships();
  this.units=this.units.filter(u=>!u.dead);this.eggs=this.eggs.filter(e=>!e.dead);
  for(const trail of this.eggTrails)trail.age++;
  this.eggTrails=this.eggTrails.filter(t=>t.age<t.life);
  if(this.tick%20===0)this.snapshot();
  if(this.tick%160===0&&this.units.length===0)this.log('info','全個体が絶滅。生命を移入できます');
 }
 paint(x,y,type,radius){const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL);for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){if(dx*dx+dy*dy>radius*radius)continue;const xx=cx+dx,yy=cy+dy;if(xx>=0&&xx<NX&&yy>=0&&yy<NY){
  // Do not instantly submerge terrestrial organisms when creating ponds.
  if(type===1&&this.units.some(u=>u.g.aquatic!==1&&this.cell(u.x,u.y)===yy*NX+xx))continue;
  this.tiles[yy*NX+xx]=type;
 }}}
 adaptFounderToTerrain(g,t){
  const adapted={...g};
  adapted.aquatic=t===1?1:0;
  if(t===1)adapted.wet=Math.max(.83,adapted.wet);
  if(t===2)adapted.dry=Math.max(.86,adapted.dry);
  if(t===3)adapted.rock=Math.max(.86,adapted.rock);
  // Grassland founders are terrestrial, and require nearby access to water.
  adapted.alleles=Object.fromEntries(Object.entries(g.alleles??{}).map(([key,pair])=>[key,[...pair]]));
  for(const key of ['aquatic','wet','dry','rock'])if(adapted[key]!==g[key])adapted.alleles[key]=[adapted[key],adapted[key]];
  return adapted;
 }
 founderSite(x,y,terrain){
  for(let attempt=0;attempt<24;attempt++){
   const px=clamp(x+this.range(-12,12),10,W-10);
   const py=clamp(y+this.range(-12,12),10,H-10);
   if(this.terrain(px,py)===terrain)return {x:px,y:py};
  }
  return {x:clamp(x,10,W-10),y:clamp(y,10,H-10)};
 }
 introduce(x,y,typeCount=1){
  // Exactly N morphological founder types, 8 independent individuals per type.
  // The founding population is intentionally clustered, enabling sexual reproduction.
  const count=clamp(Math.trunc(Number(typeCount)||1),1,6);
  const founders=[];const used=new Set();
  for(let k=0;k<count;k++){
   let g,key;
   for(let attempt=0;attempt<60;attempt++){
    g=this.gene();key=this.category(g);
    // A single founder type must be able to use ambient nutrients;
    // later types remain fully random (including predators).
    if(k===0&&(g.diet>.28||morphology(g).bodyMass>100||g.eyes<2))continue;
    if(!used.has(key))break;
   }
   if(used.has(key))continue;
   // Introduced founders adapt genetically to the terrain actually clicked.
   // Natural offspring still inherit their parents' DNA without this shortcut.
   const placedTerrain=this.terrain(x,y);
   g=this.adaptFounderToTerrain(g,placedTerrain);
   key=this.category(g);
   if(used.has(key))continue;
   used.add(key);
   const foundingLineage='founder-'+this.nextId;
   let spawned=0;
   for(let i=0;i<8;i++){
    // Small variation, but no change to the adaptation category of the founder.
    let variant={...g};
    if(i>0){
     const trial={...g,wet:clamp(g.wet+this.range(-.018,.018),0,1),
       dry:clamp(g.dry+this.range(-.018,.018),0,1),
       rock:clamp(g.rock+this.range(-.018,.018),0,1)};
     if(this.category(trial)===key)variant=trial;
    }
    // The clicked terrain is authoritative; never drift into another biome.
    const site=this.founderSite(x,y,placedTerrain);
    const sx=site.x,sy=site.y;
    const u=this.spawn(sx,sy,variant);
    if(!u)break;
    u.lineage=foundingLineage;
    u.age=Math.floor(this.range(40,57));
    u.energy=this.range(115,145);
    u.hydration=this.range(85,100);
    spawned++;
   }
   if(spawned)founders.push({category:key,count:spawned});
  }
  const total=founders.reduce((n,f)=>n+f.count,0);
  this.introducedCount+=total;
  this.log('info',founders.length+'種類・'+total+'体の生命を移入');
  return {types:founders.length,individuals:total};
 }
 epidemic(){let n=0;for(const u of this.units)if(this.rand()<.55){this.die(u,'疫病');n++;}this.units=this.units.filter(u=>!u.dead);this.log('info','疫病で'+n+'体が死亡');}
 drought(){this.growth=7;this.stress=85;this.food=this.food.slice(0,Math.floor(this.food.length*.2));this.log('info','干ばつが発生した');}
 rain(){
  this.growth=90;this.stress=8;
  // Rain revives edible resources close to occupied grass/wetland habitats.
  // This makes ecosystem care possible without introducing more creatures.
  let gained=0;
  const occupied=new Set();
  for(const u of this.units){
   const cell=this.cell(u.x,u.y);
   if(occupied.has(cell))continue;
   occupied.add(cell);
   const t=this.terrain(u.x,u.y);
   if(t===0||t===1){
    const before=this.food.length;
    this.addFood(u.x,u.y,4,18,'rain');
    gained+=this.food.length-before;
   }
  }
  this.log('info','降雨：環境負荷を緩和し、生息地に栄養を'+gained+'粒再生');
 }
 get livingSpecies(){return [...this.species.values()].filter(s=>s.current>0).length;}
 get recentSpecies(){return this.discoveries.filter(t=>this.tick-t<300).length;}
}
export const WORLD={width:W,height:H,cell:CELL,columns:NX,rows:NY};
