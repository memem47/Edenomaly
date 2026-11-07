// Edenomaly simulation: browser-only; no DOM or Canvas dependencies.
const W=800,H=460,CELL=20,NX=40,NY=23;
export const TERRAIN_NAMES=['草地','水辺','乾燥地','岩場'];
export const TERRAIN_COLORS=['#54c74c','#279cfa','#edb85c','#8980bf'];
// Relative nutrient input: grass > wetland > dryland > rock.
export const TERRAIN_FERTILITY=[1,.58,.14,.055];
const GROWTH=TERRAIN_FERTILITY,DECAY=[.026,.038,.006,.003];
// Each species name is a reversible, deterministic transcription of its
// ecological classification. Unlike discovery-order names, it survives reset.
const SPECIES_HABITAT=['land','aquatic','dry','rock'];
const SPECIES_HABITAT_KANA=['モ','ル','ガ','ロ'];
const SPECIES_TRAITS=[
 ['plant','mixed','hunter'],
 ['tiny','medium','large','giant'],
 ['round','oval','long'],
 ['blind','few','several','allround'],
 ['general','guardian','egg-hunter'],
 ['repro0','repro1','repro2'],
 ['temperate','cold','hot']
];
const HEX_KANA=['ア','カ','サ','タ','ナ','ハ','マ','ヤ','ラ','ワ','キ','シ','チ','ニ','ヒ','ミ'];
export const speciesNameFromCategory=key=>{
 const match=/^(land|aquatic|dry|rock)-(plant|mixed|hunter)-(tiny|medium|large|giant)-(round|oval|long)-(blind|few|several|allround)-(general|guardian|egg-hunter)-(repro[012])-(temperate|cold|hot)$/.exec(key);
 if(!match)throw new Error('Invalid species classification: '+key);
 const habitat=SPECIES_HABITAT.indexOf(match[1]);
 let number=0;
 for(let i=0;i<SPECIES_TRAITS.length;i++){
  const choices=SPECIES_TRAITS[i];
  number=number*choices.length+choices.indexOf(match[i+2]);
 }
 // 3 hexadecimal digits encode all 3888 non-habitat combinations.
 return SPECIES_HABITAT_KANA[habitat]+
  HEX_KANA[(number>>8)&15]+HEX_KANA[(number>>4)&15]+HEX_KANA[number&15];
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Visual color is a derived phenotype, never a separate inherited trait.
// Low adaptation values produce green; wet->cyan/blue, dry->amber,
// rock->violet. Circular hue mixing avoids a discontinuity around 360 degrees.
export const adaptationColor=g=>{
 if(g.albino===1)return {hue:0,saturation:4,lightness:91};
 const wet=clamp(g.wet??0,0,1),dry=clamp(g.dry??0,0,1),rock=clamp(g.rock??0,0,1);
 const anchors=[[118,.42],[199,2.5*wet*wet],[32,2.4*dry*dry],[280,2.4*rock*rock]];
 let x=0,y=0;
 for(const [h,w] of anchors){const a=h*Math.PI/180;x+=Math.cos(a)*w;y+=Math.sin(a)*w;}
 const hue=(Math.atan2(y,x)*180/Math.PI+360)%360;
 const strength=Math.max(wet,dry,rock);
 const contrast=Math.max(wet,dry,rock)-Math.min(wet,dry,rock);
 return {hue,saturation:clamp(64+strength*19+contrast*8,58,92),
  lightness:clamp(57+wet*5+dry*3+rock*2-contrast*3,48,70)};
};
export const TERRAIN_TEMPERATURE_OFFSETS=[0,-4,7,-3];
export const localTemperature=(ambient,terrain)=>ambient+TERRAIN_TEMPERATURE_OFFSETS[terrain];
export const thermalFitness=(g,temp)=>{
 const ideal=clamp(g.idealTemp??22,-5,40),tolerance=clamp(g.tempTolerance??9,3,18);
 const delta=Math.abs(temp-ideal),comfort=clamp(1-delta/tolerance,0,1),excess=Math.max(0,delta-tolerance);
 return {ideal,tolerance,comfort,excess,activity:clamp(1.09-.033*delta,.33,1.09),
  upkeep:.035*delta+.095*excess+Math.max(0,tolerance-7)*.045,
  // Broad-tolerance genes reduce the severity of extreme-weather injury.
  // They already incur metabolic upkeep, so this is not a free immunity.
  damage:excess>0?Math.min(2.5,excess*.038*
   (1-.42*clamp((tolerance-8)/10,0,1))):0,
  reproduction:excess<tolerance*.16};
};
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
// Ephemeral per-step caches avoid recalculating traits for the same agents.
let stepCache=null;
export const dietProfile=g=>{
 if(stepCache){const cached=stepCache.diet.get(g);if(cached)return cached;}
 const diet=clamp(g.diet,0,1);
 // The visual signal is heritable separately from feeding ability.
 const signal=clamp(diet+(g.deception-.5)*1.35,0,1);
 const value={diet,plant:1-diet,meat:diet,signal,
  label:diet<.3?'栄養食':diet>.7?'肉食':'雑食'};
  if(stepCache)stepCache.diet.set(g,value);
  return value;
};
// Morphology is the source of functional abilities; no separate speed/vision/attack genes.
export const morphology=g=>{
 const width=g.r, length=g.r*g.elongation;
 const bodyMass=width*width*g.elongation;
 const eyeRange=20+Math.min(g.eyes,3)*14+Math.max(0,g.eyes-3)*7;
 const speed=3.45/(.65+bodyMass*.017)*(1-Math.max(0,g.eyes-3)*.055);
 const turnRate=clamp(.29/(.75+g.elongation*.21),.12,.29);
 const mouths=g.mouths;
 const biteReach=width*(.7+.15*mouths)+g.jaw*1.6;
 const edibleRatio=clamp(.60+.055*mouths+.06*g.jaw,.62,.88);
 const predatory=dietProfile(g).meat>.14&&g.jaw>=.55&&mouths>=1;
 const upkeep=.09+bodyMass*.008+Math.max(0,bodyMass-110)**1.2*.002+g.eyes*.045+Math.max(0,g.eyes-3)**2*.06+mouths*.03+g.jaw*.02+Math.abs(g.deception-.5)*.035+(g.resist??.4)*.04;
 const foodGain=1+Math.min(.42,(mouths-1)*.13);
 return {width,length,bodyMass,eyeRange,speed,turnRate,biteReach,edibleRatio,predatory,upkeep,foodGain};
};
// Nutrition-derived growth changes physical performance without changing inherited genes.
export const organismMorphology=u=>{
 if(stepCache){const cached=stepCache.morph.get(u);if(cached&&cached.scale===(u.growthScale??1))return cached.value;}
 const value=morphology({...u.g,r:u.g.r*(u.growthScale??1)});
 if(stepCache)stepCache.morph.set(u,{scale:u.growthScale??1,value});
 return value;
};
// Every slime can grow exceptionally large, but only when sustained food
// intake exceeds the steep maintenance cost and the local food supply lasts.
export const NORMAL_NUTRITION_GROWTH=2.35;
export const MAX_NUTRITION_GROWTH=3.8;
export const individualGrowthLimit=()=>MAX_NUTRITION_GROWTH;
// The extra cost of acquired size follows approximate tissue volume.
// Heritable body size is already reflected in morphology.upkeep.
export const acquiredSizeMaintenance=u=>{
 const scale=Math.max(1,u.growthScale??1);
 return 1.85*(scale**3-1);
};
export const feedingCapacity=u=>{
 const scale=Math.max(1,u.growthScale??1);
 return Math.min(3.8,1+1.15*(scale-1));
};
export const energyStorageLimit=u=>210+30*Math.max(0,(u.growthScale??1)-1);

// Crowding is measured by physical proximity, regardless of kinship or diet.
// A large nearby body occupies more shared space than a small one.
export const localDensity=(u,neighbors)=>{
 const self=bodyCollisionAxes(u);
 const selfArea=Math.max(1,self.rx*self.ry);
 const reach=48+Math.min(14,self.rx*.45);
 let load=0;
 for(const v of neighbors){
  if(v===u||v.dead)continue;
  const d=Math.hypot(v.x-u.x,v.y-u.y);
  if(d>=reach)continue;
  const body=bodyCollisionAxes(v);
  const relativeArea=Math.sqrt(Math.max(1,body.rx*body.ry)/selfArea);
  load+=Math.min(2.3,Math.max(.55,relativeArea))*Math.max(0,1-d/reach);
 }
 return load;
};
// Single neighboring scan for both relative density and absolute habitat load.
export const crowdMetrics=(u,neighbors)=>{
 const axes=bodyCollisionAxes(u),area=Math.max(1,axes.rx*axes.ry);
 const reach=48+Math.min(14,axes.rx*.45);
 let density=0,occupied=axes.rx*axes.ry;
 for(const v of neighbors){
  if(v===u||v.dead)continue;
  const dx=v.x-u.x,dy=v.y-u.y,d2=dx*dx+dy*dy;
  if(d2>=65*65)continue;
  const d=Math.sqrt(d2),body=bodyCollisionAxes(v),otherArea=body.rx*body.ry;
  if(d<reach){
   const relativeArea=Math.sqrt(Math.max(1,otherArea)/area);
   density+=Math.min(2.3,Math.max(.55,relativeArea))*(1-d/reach);
  }
  occupied+=otherArea*(1-d/65);
 }
 return {density,habitatLoad:Math.max(0,occupied/450-.30)};
};
// Smoothly increasing overcrowding penalties, without a fixed ceiling.
export const crowdStress=density=>9*Math.asinh(Math.max(0,density-2.5)/9);
export const crowdEnergyCost=(load,growthScale=1)=>{
 const demand=Math.max(0,load)*(2.2+Math.max(0,growthScale-1)*3.5);
 return 20*Math.asinh(demand/20);
};
// Carrying capacity is based on ABSOLUTE occupied area, not body size relative
// to the focal slime. Large individuals exhaust the space and resources of a
// small patch even when every neighbor is similarly large.
export const habitatCrowding=(u,neighbors)=>{
 const a=bodyCollisionAxes(u),radius=65;
 let occupied=a.rx*a.ry;
 for(const v of neighbors){
  if(v===u||v.dead)continue;
  const d=Math.hypot(v.x-u.x,v.y-u.y);
  if(d>=radius)continue;
  const b=bodyCollisionAxes(v);
  occupied+=b.rx*b.ry*(1-d/radius);
 }
 return Math.max(0,(occupied/450-.30));
};


// Collision geometry follows the actual drawn ellipse, including adult growth.
// Treats infants as smaller bodies; collisions are soft, not rigid-body physics.
// Hatchlings grow with accumulated nutrition, not merely with age.
export const lifeStageScale=u=>{
 if(u.stage!=='juvenile')return 1;
 const t=clamp(u.juvenileGrowth??0,0,1);
 return .55+.45*t*t*(3-2*t);
};
// Growth competes directly with maintenance for calories actually eaten.
// Density and large body mass make growth slower without a population cap.
export const juvenileGrowthIncrement=(u,food,habitatLoad=0,crowdStress=0)=>{
 if(u.stage!=='juvenile'||food<=0||u.energy<=42)return 0;
 const surplus=clamp((u.energy-42)/58,0,1);
 const crowd=1+Math.max(0,habitatLoad)*.85+Math.max(0,crowdStress)*.13;
 const massCost=Math.max(1,Math.sqrt(organismMorphology(u).bodyMass)/9);
 return Math.min(.032,food*.013)*surplus/crowd/massCost;
};
export const bodyCollisionAxes=u=>{
 if(stepCache){const c=stepCache.axes.get(u);if(c&&c.stage===u.stage&&c.age===u.age&&c.scale===(u.growthScale??1)&&c.juvenileGrowth===(u.juvenileGrowth??0))return c.value;}
 const scale=lifeStageScale(u)*(u.growthScale??1)*(1-clamp(((u.age??0)-420)/900,0,1)*.12);
 const ry=Math.max(2,u.g.r*scale*1.06);
 const value={rx:ry*Math.max(1,Math.min(3,u.g.elongation??1)),ry};
 if(stepCache)stepCache.axes.set(u,{stage:u.stage,age:u.age,scale:u.growthScale??1,juvenileGrowth:u.juvenileGrowth??0,value});
 return value;
};
const ellipseExtent=(u,axes,nx,ny)=>{
 const a=u.angle??0,cos=Math.cos(a),sin=Math.sin(a);
 const lx=nx*cos+ny*sin,ly=-nx*sin+ny*cos;
 return 1/Math.sqrt((lx/axes.rx)**2+(ly/axes.ry)**2);
};
const distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
export class SpatialLookup{
 constructor(items,cellSize=64){
  this.cellSize=cellSize;this.grid=new Map();this.order=new Map();
  for(let i=0;i<items.length;i++){
   const item=items[i],key=Math.floor(item.x/cellSize)+','+Math.floor(item.y/cellSize);
   this.order.set(item,i);
   let bucket=this.grid.get(key);if(!bucket){bucket=[];this.grid.set(key,bucket);}bucket.push(item);
  }
 }
 query(x,y,radius,stable=true){
  const size=this.cellSize,r2=radius*radius,found=[];
  for(let cy=Math.floor((y-radius)/size);cy<=Math.floor((y+radius)/size);cy++)
   for(let cx=Math.floor((x-radius)/size);cx<=Math.floor((x+radius)/size);cx++){
    const bucket=this.grid.get(cx+','+cy);if(!bucket)continue;
    for(const item of bucket)if((item.x-x)**2+(item.y-y)**2<r2)found.push(item);
   }
  if(stable)found.sort((a,b)=>this.order.get(a)-this.order.get(b));
  return found;
 }
}
// Health and senescence directly affect movement, fighting and mating.
// Lifespan evolves independently of body size and maximum HP.
// Food, appropriate habitat and temperature slow aging, without healing HP.
export const lifeDrain=(u,{temperature=22,terrain=0}={})=>{
 const g=u.g,longevity=clamp(g.longevity??1,.6,2);
 const energy=u.energy??100,max=Math.max(1,u.maxHp??50);
 const foodFactor=energy>=110?.55:energy>=65?.55+(110-energy)*.45/45:
   energy>=25?1+(65-energy)*1.35/40:energy>0?2.35+(25-energy)*1.65/25:4;
 const climate=thermalFitness(g,temperature);
 const climateFactor=1+(1-climate.comfort)*.42+climate.excess*.09;
 const habitat=terrainFitness(g,terrain);
 const terrainFactor=1+Math.max(0,1-habitat.fitness)*1.5;
 const ageFactor=1+Math.max(0,(u.age??0)-550)/(1250*longevity);
 return max/1300/longevity*ageFactor*foodFactor*climateFactor*terrainFactor;
};
export const longevityUpkeep=g=>{
 const x=Math.max(0,(g.longevity??1)-.9);
 return .34*x*x;
};
export const vitality=u=>{
 const max=u.maxHp??Math.max(25,Math.round(organismMorphology(u).bodyMass*.48+25));
 const health=clamp((u.hp??max)/max,0,1);
 const longevity=clamp(u.g?.longevity??1,.6,2);
 const old=clamp((u.age-420*longevity)/(900*longevity),0,1);
 const vigor=clamp((.40+.60*health)*(1-.60*old),.12,1);
 return {max,health,old,vigor};
};
export const rearPosition=(u,offset=0)=>({
 x:clamp(u.x-Math.cos(u.angle)*(u.g.r*u.g.elongation+5+offset),6,W-6),
 y:clamp(u.y-Math.sin(u.angle)*(u.g.r*u.g.elongation+5+offset),6,H-6)
});
const HERITABLE=['repro','idealTemp','tempTolerance','hibernate','longevity','r','elongation','eyes','mouths','jaw','wet','dry','shell','guard','nesting','brood','diet','deception','rock','resist','aquatic','albino','dispersal','sociability'];
// Natural ponds always retain a viable reservoir. Drought reduces excess
// water depth, but only deliberate terrain painting may remove a water tile.
export const POND_RESERVE=35;
const INTEGER_GENES=new Set(['eyes','mouths','brood','aquatic','albino','repro']);
// Detailed phenotype code: one rounded hexadecimal digit per expressed
// inherited trait, in fixed gene order. Same genome -> same code after reset;
// mutations too small to cross a quantization boundary share a code.
export const genomeCode=g=>HERITABLE.map(key=>{
 const [lo,hi]=LIMITS[key];
 const v=Number(g[key]);
 const step=Number.isFinite(v)?Math.round(clamp((v-lo)/(hi-lo),0,1)*15):0;
 return step.toString(16).toUpperCase();
}).join('').match(/.{1,4}/g).join('-');

const LIMITS={repro:[0,2],idealTemp:[-5,40],tempTolerance:[3,18],hibernate:[0,1],longevity:[.6,2],r:[3,15],elongation:[.65,3],eyes:[0,6],mouths:[1,4],jaw:[.2,2.5],wet:[0,1],dry:[0,1],rock:[0,1],shell:[0,1],guard:[0,1],nesting:[0,1],brood:[1,8],diet:[0,1],deception:[0,1],resist:[0,1],aquatic:[0,1],albino:[0,1],dispersal:[0,1],sociability:[0,1]};
const alleleExpression=(key,pair)=>{
 // Eyes: more-eye allele is dominant; hidden low-eye alleles can reappear in grandchildren.
 // Other continuous traits use incomplete dominance (mean of the two inherited copies).
 const raw=key==='repro'?Math.max(...pair):key==='eyes'?Math.max(...pair):key==='aquatic'?pair[0]:key==='albino'?Math.max(...pair):(pair[0]+pair[1])/2;
 const [lo,hi]=LIMITS[key];
 const val=clamp(INTEGER_GENES.has(key)?Math.round(raw):raw,lo,hi);
 return val;
};
const allelePair=(g,key)=>{
 const pair=g.alleles?.[key];
 return Array.isArray(pair)&&pair.length===2&&Math.abs(alleleExpression(key,pair)-g[key])<1e-6?pair:[g[key],g[key]];
};
// Strategies emerge from existing inherited diet, jaw and guarding traits.
// 0 = separate sexes, 1 = hermaphrodite, 2 = facultative parthenogenesis.
export const reproductiveMode=g=>Math.round(clamp(g.repro??0,0,2));
export const sexLabel=u=>u.sex==='H'?'⚥':u.sex==='F'?'♀':'♂';
export const sexualCompatibility=(a,b)=>{
 if(!a||!b||a===b||a.dead||b.dead)return false;
 const x=a.sex??'F',y=b.sex??'M';
 return (x==='H'||y==='H'||x!==y)&&!(x==='M'&&y==='M');
};
export const reproductiveUpkeep=g=>reproductiveMode(g)===1?.23:reproductiveMode(g)===2?.14:0;
export const eggPredationDrive=g=>clamp(dietProfile(g).meat*(1-.65*(g.guard??0))*(1.1-.08*(g.jaw??1)),0,1);
export const protectiveDrive=g=>clamp((g.guard??0)*(.35+.65*clamp((g.jaw??1)/2.5,0,1)),0,1);
// Shelter changes detection, not invulnerability.
export const coverFactor=(terrain,observerAquatic=false)=>terrain===3?.34:
 terrain===1?(observerAquatic?.80:.06):1;
 // Higher dispersal means lower crowd tolerance; social affinity raises it.
export const dispersalPressureThreshold=g=>2.15+
 (1-clamp(g.dispersal??.45,0,1))*1.05+clamp(g.sociability??.45,0,1)*.65;
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
  // Most founders prefer mild temperatures, but rare cold/hot specialists
  // and broad-tolerance generalists can already exist before selection.
  // Preserve the existing two random draws per genome: adding extra
  // draws would also perturb unrelated size/diet/sex traits for fixed seeds.
  const thermalRoll=this.rand(),toleranceRoll=this.rand();
  const founderIdeal=thermalRoll<.15?-3+thermalRoll/.15*15:
   thermalRoll<.30?30+(thermalRoll-.15)/.15*10:
   15+(thermalRoll-.30)/.70*14;
  const founderTolerance=toleranceRoll<.20?14+toleranceRoll/.20*4:
   toleranceRoll<.30?4+(toleranceRoll-.20)/.10*4:
   8+(toleranceRoll-.30)/.70*6;
  const g={idealTemp:founderIdeal,tempTolerance:founderTolerance,longevity:this.range(.8,1.5),repro:(()=>{const roll=this.rand();return roll<.004?1:roll<.006?2:0;})(),r:this.rand()<.065?this.range(8.5,12):this.range(3.1,7.5),
   elongation:(()=>{const roll=this.rand();
    return roll<.82?this.range(.94,1.16):roll<.98?this.range(1.43,2.04):this.range(2.35,2.83);
   })(),eyes:(()=>{const roll=this.rand();return roll<.08?0:roll<.36?1:roll<.71?2:roll<.90?3:roll<.975?4:roll<.995?5:6;})(),
   mouths:1+Math.floor(this.rand()*4),jaw:this.range(.2,2.5),
   wet:this.rand(),dry:this.rand(),rock:this.rand(),
   shell:this.rand(),guard:this.rand(),nesting:this.rand(),
   brood:1+Math.floor(this.rand()*8),diet:this.rand(),
   deception:clamp(.5+this.range(-.42,.42),0,1),resist:this.rand(),
   aquatic:this.rand()<.25?1:0,albino:this.rand()<.0015?1:0};
  // Each founding individual carries two genetic copies per locus, including
  // recessive alleles that are not necessarily visible in its phenotype.
  g.alleles={};
  for(const key of HERITABLE){
   if(key==='hibernate'||key==='dispersal'||key==='sociability')continue; // preserve older founder RNG sequence
   let second=g[key];
   if(key==='repro')second=0;
    else if(key==='idealTemp')second=clamp(g.idealTemp+this.range(-3,3),...LIMITS.idealTemp);
    else if(key==='tempTolerance')second=clamp(g.tempTolerance+this.range(-2,2),...LIMITS.tempTolerance);
     else if(key==='hibernate')second=clamp(g.hibernate+this.range(-.14,.14),0,1);
    else if(key==='longevity')second=clamp(g.longevity+this.range(-.2,.2),...LIMITS.longevity);
    else if(key==='elongation')second=clamp(g.elongation+this.range(-.11,.11),...LIMITS.elongation);
   else if(key==='albino')second=0;
   else if(key==='aquatic'&&this.rand()<.14)second=1-g.aquatic;
   else if(key==='eyes'&&this.rand()<.82)second=Math.max(0,g.eyes-1-Math.floor(this.rand()*3));
   else if(key!=='aquatic'&&key!=='eyes'&&this.rand()<.75){
    const range=LIMITS[key][1]-LIMITS[key][0];
    second=clamp(g[key]+this.range(-.36,.36)*range,...LIMITS[key]);
   }
   const pair=[g[key],second];
   g.alleles[key]=pair;
   g[key]=alleleExpression(key,pair);
  }
  // An existing inherited trait combination seeds a new independently
  // recombining mutation locus without shifting all previous seed outcomes.
  g.hibernate=clamp(.07+g.shell*.57+g.guard*.44,0,1);
  g.alleles.hibernate=[g.hibernate,g.hibernate];
  // Seed two behavioral loci from existing variation without consuming extra
  // random draws or perturbing older morphology and reproduction trajectories.
  // Their values can subsequently mutate and recombine independently.
  g.dispersal=clamp(.08+g.dry*.42+g.eyes/6*.28+g.jaw/2.5*.13,0,1);
  g.sociability=clamp(.08+g.guard*.42+g.nesting*.27+g.brood/8*.22,0,1);
  g.alleles.dispersal=[g.dispersal,g.dispersal];
  g.alleles.sociability=[g.sociability,g.sociability];
  return g;
 }
 mutate(g){
  const next={...g,alleles:{}};
  for(const key of HERITABLE)next.alleles[key]=[...allelePair(g,key)];
  // Occasionally change 2-3 independent genetic loci in one descendant.
  // Different siblings can develop a genuinely distinct body or feeding style.
  const changes=1+(this.rand()<.28?1:0)+(this.rand()<.08?1:0);
  for(let n=0;n<changes;n++){
   const key=HERITABLE[Math.floor(this.rand()*HERITABLE.length)];
   // Do not let the generic mutation path make albinos common.
   if(key==='albino'&&this.rand()<.93)continue;
    if(key==='repro'&&this.rand()<.95)continue;
   const index=this.rand()<.5?0:1;
   const [lo,hi]=LIMITS[key],width=hi-lo;
   let value=next.alleles[key][index];
   if(key==='repro')value=this.rand()<.5?1:2;
    else if(key==='idealTemp')value+=this.range(-7,7);
    else if(key==='tempTolerance')value+=this.range(-3.5,3.5);
     else if(key==='longevity')value+=this.range(-.20,.20);
    else if(key==='aquatic')value=1-value;
   else if(key==='albino')value=1-value;
   else if(key==='elongation')value+=this.rand()<.85?this.range(-.13,.08):this.range(-.20,.24);
   else if(INTEGER_GENES.has(key))value+=this.rand()<.5?-1:1;
   else value+=this.range(-.24,.24)*width;
   next.alleles[key][index]=clamp(value,lo,hi);
  }
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
  // Rare body-plan changes create stable aquatic/terrestrial lineages.
  // Selection still decides whether an innovator survives its habitat.
  if(this.rand()<.038){
   const habitat=1-child.aquatic;
   child.alleles.aquatic=[habitat,habitat];child.aquatic=habitat;
   if(habitat===1){
    child.wet=Math.max(child.wet,.68);
    child.alleles.wet=[child.wet,child.wet];
   }else{
    child.dry=Math.max(child.dry,.52);
    child.alleles.dry=[child.dry,child.dry];
   }
  }
  // Noticeable but infrequent jumps allow dry or rocky specialization.
  if(this.rand()<.13){
   const trait=this.rand()<.5?'dry':'rock';
   const improved=clamp(child[trait]+this.range(.18,.43),0,1);
   child.alleles[trait]=[improved,improved];child[trait]=improved;
  }
  // Extremely rare stable inherited pigment loss, distinct from damage flash.
  if(this.rand()<.0025){child.albino=1;child.alleles.albino=[1,1];}
  return this.rand()<.32?this.mutate(child):child;
 }
 category(g){
  // A species represents a recognizable ecological/morphological strategy.
  // Cosmetic color and small differences in 19 separate genes must NOT generate
  // hundreds of nominally different species.
  const m=morphology(g),d=dietProfile(g).diet;
  const diet=d<.32?'plant':d>.70?'hunter':'mixed';
  const body=m.bodyMass<45?'tiny':m.bodyMass<105?'medium':m.bodyMass<195?'large':'giant';
  const eyes=g.eyes===0?'blind':g.eyes<=2?'few':g.eyes<=4?'several':'allround';
  const shape=g.elongation<1.38?'round':g.elongation<2.25?'oval':'long';
  const strategy=protectiveDrive(g)>.52?'guardian':eggPredationDrive(g)>.62?'egg-hunter':'general';
  // Habitat is a functional trait, not just a difference in appearance.
  const habitat=g.aquatic===1?'aquatic':g.dry>=.70&&g.dry>g.rock+.10?'dry':g.rock>=.70&&g.rock>g.dry+.10?'rock':'land';
  const thermal=g.idealTemp<12?'cold':g.idealTemp>31?'hot':'temperate';
   return [habitat,diet,body,shape,eyes,strategy,'repro'+reproductiveMode(g),thermal].join('-');
 }
 name(category){return speciesNameFromCategory(category);}
 addVisualEffect(type,point,extra={}){
  // Visual effects must never change simulation RNG or ecology. Avoid flooding
  // the renderer with dozens of repeated feeding and drinking events per step.
  if(!point||this.effects.length>=140)return false;
  this.effects.push({type,x:point.x,y:point.y,age:0,...extra});
  return true;
 }
 log(type,message,point){
  this.logs.unshift({type,message,step:this.tick});
  if(this.logs.length>500)this.logs.pop();
  // Only deaths need a world-space notification ring. Mating, egg-laying,
  // migration, decomposition, species discovery and ordinary info remain in
  // the log but no longer fill dense colonies with expanding circles.
  if(point&&type==='death')this.addVisualEffect('death',point);
 }
 addFood(x,y,n,spread=8,source='natural'){
  // Compatibility with older controls/tests: fertilizer replenishes the map,
  // never creates floating food objects.
  const radius=Math.max(1,Math.ceil(spread/CELL));
  this.paint(x,y,0,radius);
  if(source==='corpse')this.recycled++;
 }

 spawn(x,y,g,parent=null){
  // Safety guard only: far above the intended ecological carrying capacity.
  if(this.units.length>=2000)return null;
  const mode=reproductiveMode(g);
   const sex=mode===1?'H':mode===2?'F':(this.rand()<.5?'F':'M');
   const u={sex,id:this.nextId++,x:clamp(x,10,W-10),y:clamp(y,10,H-10),angle:this.range(0,Math.PI*2),g,energy:parent?58:this.range(64,86),age:0,generation:parent?parent.generation+1:0,parent:parent?.id??null,otherParent:parent?.otherParent??null,dead:false,bite:0,stage:parent?'juvenile':'adult',hp:Math.max(25,Math.round(morphology(g).bodyMass*.48+25)),maxHp:Math.max(25,Math.round(morphology(g).bodyMass*.48+25)),woundFlash:0,attackFlash:0,defendFlash:0,mateCooldown:0,courtPartner:null,pregnancy:null,lineage:parent?.lineage??null,infection:0,hydration:100,seedBank:0,growthScale:1,juvenileGrowth:parent?0:1,juvenileFood:0,recentFood:0,dormant:false,forageSuccess:0,forageFailure:0,stranded:0,submerged:0,lastTerrain:this.terrain(x,y),migrations:0,refugeTarget:null,socialTarget:null,mateTarget:null,mateApproachFailures:0,behaviorTarget:'idle'};
  u.category=this.category(g);u.lineage??=u.id;this.units.push(u);
  if(!this.species.has(u.category)){
   const n=this.species.size+1;this.species.set(u.category,{n,name:this.name(u.category),current:0,total:0,diet:dietProfile(g).label,first:this.tick,genome:{...g,alleles:Object.fromEntries(Object.entries(g.alleles??{}).map(([key,pair])=>[key,[...pair]]))}});this.discoveries.push(this.tick);this.log('new','新しい形態：'+this.name(u.category),u);
  }
  const s=this.species.get(u.category);s.current++;s.total++;
  this.log('birth','#'+u.id+' '+(u.stage==='juvenile'?'孵化':'移入')+'（'+s.name+' / 第'+u.generation+'世代）',u);
  return u;
 }
 die(u,cause,consumed=0){
  if(u.dead)return;
  u.dead=true;u.courtPartner=null;this.species.get(u.category).current--;
  this.deathCauses[cause]=(this.deathCauses[cause]??0)+1;
  const mass=Math.max(8,organismMorphology(u).bodyMass*1.2+Math.max(0,u.energy)*.4-consumed);
  this.corpses.push({x:u.x,y:u.y,angle:u.angle,g:{...u.g},growthScale:u.growthScale??1,stage:u.stage,deathAge:u.age,mass,initialMass:mass,reserve:0,age:0,cause,seedBank:u.seedBank??0,seedPlanted:false});
  this.log('death','#'+u.id+' 死亡：'+cause,u);
  if(this.species.get(u.category).current===0)this.log('info',this.species.get(u.category).name+' が絶滅');
 }
 chooseNest(u){
  let best={x:u.x,y:u.y},score=-Infinity;
  const trait=u.g.nesting;
  for(let k=0;k<8;k++){
   const x=clamp(u.x+this.range(-34,34),10,W-10),y=clamp(u.y+this.range(-34,34),10,H-10);
   let threat=0;for(const v of this.units){if(v!==u&&!v.dead&&organismMorphology(v).predatory&&distance({x,y},v)<45**2)threat++;}
   const landscape=this.terrain(x,y);
   const sheltered=landscape===3?.85:landscape===1&&u.g.aquatic===1?1.1:0;
    const safe=terrainFitness(u.g,landscape).fitness*.9+GROWTH[landscape]*.6+sheltered-threat*2;
   const s=trait*safe+this.range(-.6,.6)-(1-trait)*Math.hypot(x-u.x,y-u.y)/50;
   if(s>score){score=s;best={x,y};}
  }
  return best;
 }
 canMate(a,b){
  if(!sexualCompatibility(a,b)||!this.isReadyToMate(a)||!this.isReadyToMate(b))return false;
  if(a.parent===b.id||b.parent===a.id)return false;
  return true;
 }
 // The same diagnostic conditions govern actual reproduction and the
 // persistent 50-step census: no mismatch between displayed reasons and rules.
 reproductionBlockReason(u){
  if(!u||u.dead)return 'dead';
  if(!thermalFitness(u.g,this.temperatureAt(u.x,u.y)).reproduction)return 'temperature';
  if(u.infection>0)return 'infection';
  if(u.dormant)return 'dormant';
  if(u.stage!=='adult'||u.age<=42)return 'immature';
  // Paired individuals can spend a modest reserved energy budget while courting.
  const courtshipReserve=u.courtPartner?14:0;
  if(u.energy<68+Math.max(0,organismMorphology(u).bodyMass-100)*.22+
   (u.crowdStress??0)*3.1+(u.habitatLoad??0)*4.2-courtshipReserve)return 'energy';
  if(u.mateCooldown>0)return 'cooldown';
  if(u.pregnancy)return 'pregnancy';
  if(vitality(u).vigor<=.35)return 'weak';
  return null;
 }
 isReadyToMate(u){return this.reproductionBlockReason(u)===null;}
 // Read-only diagnosis for UI and CSV; does not alter simulation state.
 reproductionDiagnostic(u){
  const required=68+Math.max(0,organismMorphology(u).bodyMass-100)*.22+
   (u.crowdStress??0)*3.1+(u.habitatLoad??0)*4.2-(u.courtPartner?14:0);
  const eligible=this.units.filter(v=>v!==u&&!v.dead&&sexualCompatibility(u,v)&&
   u.parent!==v.id&&v.parent!==u.id&&this.isReadyToMate(v));
  const closest=eligible.reduce((best,v)=>!best||distance(u,v)<distance(u,best)?v:best,null);
  const mate=eligible.find(v=>v.id===u.courtPartner)||eligible.find(v=>v.id===u.mateTarget?.id)||closest;
  const mateDistance=mate?Math.sqrt(distance(u,mate)):null;
  const reason=this.reproductionBlockReason(u);
  return {id:u.id,sex:u.sex,step:this.tick,energy:+u.energy.toFixed(2),
   required:+required.toFixed(2),reason:reason??'ready',
   mateId:mate?.id??null,mateDistance:mateDistance===null?null:+mateDistance.toFixed(2),
   target:u.behaviorTarget??'idle',approachSteps:u.mateTarget?.since===undefined?0:
    Math.max(0,this.tick-u.mateTarget.since),
   approachFailures:u.mateApproachFailures??0,
   courtPartner:u.courtPartner??null,hpPercent:+(100*u.hp/Math.max(1,u.maxHp)).toFixed(1)};
 }
 // Count inability to reproduce separately from courtships that actually failed.
 reproductionCensus(){
  const live=this.units.filter(u=>!u.dead);
  const counts={ready:0,temperature:0,infection:0,dormant:0,immature:0,energy:0,
   cooldown:0,pregnancy:0,weak:0,noPartner:0,paired:0};
  const available=[],lookup=new SpatialLookup(live);
  for(const u of live){
   const reason=this.reproductionBlockReason(u);
   if(reason){counts[reason]++;continue;}
   counts.ready++;available.push(u);
  }
  const eligible=new Set(available);
  for(const u of available){
   if(u.courtPartner){counts.paired++;continue;}
   const sight=Math.max(85,organismMorphology(u).eyeRange*1.55);
   const options=lookup.query(u.x,u.y,sight,false);
   if(!options.some(v=>v!==u&&eligible.has(v)&&!v.courtPartner&&
    sexualCompatibility(u,v)&&u.parent!==v.id&&v.parent!==u.id&&
    distance(u,v)<sight*sight))counts.noPartner++;
  }
  return counts;
 }
 findMate(u,batch){
  if(!this.isReadyToMate(u)){u.mateTarget=null;return null;}
  // Mate-seeking uses a wider search than foraging to connect dispersed founders.
  const sight=Math.max(120,organismMorphology(u).eyeRange*1.55);
  const compatible=v=>v&&v!==u&&this.canMate(u,v)&&
   (!v.courtPartner||v.courtPartner===u.id)&&distance(u,v)<sight*sight;
  // Retain a viable partner rather than switching to a nearer animal each tick.
  const remembered=u.mateTarget&&u.mateTarget.until>this.tick?
   batch.find(v=>v.id===u.mateTarget.id):null;
  if(compatible(remembered))return remembered;
  if(u.mateTarget)u.mateTarget=null;
  let match=null,best=sight*sight;
  for(const v of batch){
   if(!compatible(v))continue;
   const d=distance(u,v);
   if(d<best){match=v;best=d;}
  }
  if(match){
   u.mateTarget={id:match.id,until:this.tick+100,since:this.tick};
   this.mateApproachStarts++;
   this.log('mateSeek','#'+u.id+' が繁殖相手 #'+match.id+' に接近開始',u);
  }
  return match;
 }
 // A pair must remain close while courting; pairing is not permanent.
 startCourtship(a,b){
  if(!a||!b||a===b||a.courtPartner||b.courtPartner||!this.canMate(a,b))return false;
  a.courtPartner=b.id;b.courtPartner=a.id;
  this.courtships.push({a:a.id,b:b.id,progress:0,required:24,elapsed:0});
  this.courtshipStarts++;
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
  if(!partner||!this.canMate(parent,partner)||this.eggs.length>=2500)return null;
  // Whichever organism can lay eggs becomes the gestating parent.
  if(parent.sex==='M'&&partner.sex!=='M')return this.conceive(partner,parent);
  // An inherited brood-size trait trades clutch size against parental energy.
  const desired=clamp(Math.round((parent.g.brood+partner.g.brood)/2)*2+2,4,18);
  const largeParentCost=Math.max(0,organismMorphology(parent).bodyMass-100)*.18;
  const affordable=clamp(Math.floor((Math.min(parent.energy,220)-55-largeParentCost)/7),1,18);
  const count=Math.min(desired,affordable,2500-this.eggs.length);
  if(count<1)return null;
  const genomes=Array.from({length:count},()=>this.recombine(parent.g,partner.g));
  const pregnancy={genomes,parent:parent.id,otherParent:partner.id,lineage:this.rand()<.5?parent.lineage:partner.lineage,generation:Math.max(parent.generation,partner.generation)+1,remaining:25,total:25};
  parent.pregnancy=pregnancy;
  const dual=reproductiveMode(parent.g)===1||reproductiveMode(partner.g)===1;
  parent.energy-=16+count*5+parent.g.nesting*3+largeParentCost+(dual?4:0);
  partner.energy-=8+count*1.5+Math.max(0,organismMorphology(partner).bodyMass-100)*.08;
  parent.mateCooldown=90;partner.mateCooldown=90;
  this.matings++;
  this.log('mate','#'+parent.id+' × #'+partner.id+' が交配（卵 '+count+' 個を準備）',parent);
  return pregnancy;
 }
 conceiveSolo(parent){
  if(reproductiveMode(parent.g)!==2||parent.sex!=='F'||!this.isReadyToMate(parent)||parent.energy<115||this.eggs.length>=2500)return null;
  // Few expensive eggs, with reduced recombination and no unrelated genome.
  const count=Math.min(1+Math.floor(parent.g.brood/4),2500-this.eggs.length);
  const genomes=Array.from({length:count},()=>this.rand()<.025?this.mutate(this.recombine(parent.g,parent.g)):this.recombine(parent.g,parent.g));
  const pregnancy={genomes,parent:parent.id,otherParent:null,lineage:parent.lineage,generation:parent.generation+1,remaining:32,total:32};
  parent.pregnancy=pregnancy;
  parent.energy-=25+count*11+parent.g.nesting*3;
  parent.mateCooldown=175;
  this.matings++;
  this.log('mate','#'+parent.id+' が単為生殖（卵 '+count+' 個を準備）',parent);
  return pregnancy;
 }
 shoreEggSite(x,y,g){
  // Small-scale egg drift along coastlines makes a habitat-switch mutation
  // viable without teleporting offspring across the map.
  const suitable=(xx,yy)=>{
   const id=this.cell(xx,yy),t=this.tiles[id];
   return g.aquatic===1?t===1&&this.water[id]>8:t!==1&&this.nearWater(xx,yy,2);
  };
  if(suitable(x,y))return {x,y};
  const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL),reach=4;
  let nearest=null,dist=Infinity;
  for(let dy=-reach;dy<=reach;dy++)for(let dx=-reach;dx<=reach;dx++){
   const xx=cx+dx,yy=cy+dy;
   if(xx<0||xx>=NX||yy<0||yy>=NY)continue;
   const px=(xx+.5)*CELL,py=(yy+.5)*CELL;
   if(!suitable(px,py))continue;
   const d=(x-px)**2+(y-py)**2;
   if(d<dist){dist=d;nearest={x:px,y:py};}
  }
  return nearest??{x,y};
 }
 layEgg(parent,partner=null){
  // Explicit test helper: two parents can conceive; actual egg laying is delayed.
  if(partner)return this.conceive(parent,partner);
  if(!parent.pregnancy||this.eggs.length>=2500)return null;
  const p=parent.pregnancy;
  // Oviposition is anchored behind the parent's actual facing direction.
  const count=Math.min(p.genomes.length,2500-this.eggs.length);
  if(count===0)return null;
  const laid=[];
  for(let i=0;i<count;i++){
   const g=p.genomes[i],traits=eggTraits(g);
   const rear=rearPosition(parent,3+i*.65);
   const egg={id:this.nextId++,x:clamp(rear.x+Math.cos(parent.angle+Math.PI/2)*this.range(-3,3),6,W-6),y:clamp(rear.y+Math.sin(parent.angle+Math.PI/2)*this.range(-6,6),6,H-6),g,parent:p.parent,otherParent:p.otherParent,generation:p.generation,lineage:p.lineage,age:0,hatchAt:traits.incubation,energy:traits.eggEnergy,dead:false,bornTick:this.tick,birthX:parent.x-Math.cos(parent.angle)*(parent.g.r*parent.g.elongation+2),birthY:parent.y-Math.sin(parent.angle)*(parent.g.r*parent.g.elongation+2)};
   if(g.aquatic!==parent.g.aquatic){
     const site=this.shoreEggSite(egg.x,egg.y,g);
     egg.x=site.x;egg.y=site.y;
    }
    // Shore-dwellers with strong inherited nesting instinct deposit eggs
    // underwater, outside the reach of terrestrial egg predators.
    if(g.aquatic!==1&&parent.g.nesting>.68&&this.nearWater(egg.x,egg.y,3)){
     const waterSite=this.nearestWater(egg.x,egg.y);
     if(waterSite&&distance(egg,waterSite)<70**2){
      egg.x=waterSite.x;egg.y=waterSite.y;egg.submergedNest=true;
     }
    }
   laid.push(egg);this.eggs.push(egg);
  }
  parent.pregnancy=null;
  this.log('egg','#'+parent.id+' が '+laid.length+' 個の卵を産んだ（'+(p.otherParent===null?'単為生殖':'相手 #'+p.otherParent)+'）',parent);
  return laid[0];
 }
 updateCourtships(){
  for(const pair of this.courtships){
   const a=this.units.find(u=>u.id===pair.a),b=this.units.find(u=>u.id===pair.b);
   pair.elapsed=(pair.elapsed??0)+1;
   const reason=!a||!b||a.dead||b.dead?'partnerMissing':
    !sexualCompatibility(a,b)?'incompatible':
    this.reproductionBlockReason(a)||this.reproductionBlockReason(b)||
     (a.parent===b.id||b.parent===a.id?'incompatible':null)||
     (distance(a,b)>65**2?'separated':null)||
     (pair.elapsed>120?'stalled':null);
   if(reason){
    this.courtshipFailures[reason]=(this.courtshipFailures[reason]??0)+1;
    this.log('courtFail','#'+pair.a+' × #'+pair.b+' 求愛中断：'+
     ({partnerMissing:'相手の死亡・消失',incompatible:'繁殖不適合',
       separated:'離れすぎ',stalled:'距離を詰められず進展しない',temperature:'気温が不適合',infection:'感染',
       immature:'未成熟',energy:'エネルギー不足',cooldown:'繁殖休止',
       pregnancy:'妊娠中',weak:'生命力不足'}[reason]||reason));
    this.cancelCourtship(pair);pair.done=true;continue;
   }
   if(distance(a,b)<35**2)pair.progress++;
   if(pair.progress>=pair.required){
    this.cancelCourtship(pair);pair.done=true;
    if(!this.conceive(a.sex==='M'?b:a,a.sex==='M'?a:b)){
     this.courtshipFailures.conception=(this.courtshipFailures.conception??0)+1;
     this.log('courtFail','#'+pair.a+' × #'+pair.b+' 受精不成立：産卵枠または繁殖条件');
    }
   }
  }
  this.courtships=this.courtships.filter(p=>!p.done);
 }
 eatEgg(egg,hunter){
  if(egg.dead||dietProfile(hunter.g).meat===0)return false;
   if(this.terrain(egg.x,egg.y)===1&&hunter.g.aquatic!==1)return false;
  egg.dead=true;
  const nutrients=egg.energy*(.8+eggTraits(egg.g).shell*.12)*dietProfile(hunter.g).meat;
  hunter.energy+=nutrients;
  if(hunter.stage==='juvenile')hunter.juvenileFood=(hunter.juvenileFood??0)+nutrients;
  hunter.bite=Math.round(12+egg.g.shell*27);
  this.log('eggeaten','#'+hunter.id+' が卵 #'+egg.id+' を食べた',egg);
  this.addVisualEffect('consume',egg);
  return true;
 }
 attack(hunter,prey,defensive=false){
  if(hunter===prey||hunter.dead||prey.dead||hunter.bite>0||(!defensive&&dietProfile(hunter.g).meat<=0)||(defensive===true&&protectiveDrive(hunter.g)<=.34))return false;
  const mm=organismMorphology(hunter),v=vitality(hunter),def=vitality(prey);
  const damage=Math.max(2,(4+hunter.g.jaw*7+mm.bodyMass*.065)*(defensive==='rival'?.42:defensive?.65+protectiveDrive(hunter.g)*.65:dietProfile(hunter.g).meat)*v.vigor);
  prey.hp=Math.max(0,prey.hp-damage);
  if(defensive){hunter.energy-=defensive==='rival'?4:2.5;prey.bite=Math.max(prey.bite,14);}
  prey.woundFlash=14;
  hunter.bite=22;
  hunter.attackFlash=16;
  if(defensive===true)hunter.defendFlash=16;
  this.addVisualEffect(defensive==='rival'?'rivalStrike':'strike',prey,{fromX:hunter.x,fromY:hunter.y});
  this.log(defensive==='rival'?'rival':defensive?'defend':'attack','#'+hunter.id+(defensive==='rival'?' が同性の #':defensive?' が卵を守って #':' が #')+prey.id+' に '+Math.round(damage)+' ダメージ',prey);
  if(prey.hp<=0){
   // A large prey supplies an exceptional meal, but the eaten tissue is
   // removed from the corpse so nutrients are never counted twice.
   const meat=defensive===true?0:dietProfile(hunter.g).meat*(defensive==='rival'?.65:1);
   const tissue=Math.max(4,organismMorphology(prey).bodyMass*.23);
   const gained=(Math.max(5,prey.energy*.35)+tissue)*meat;
   hunter.energy+=gained;
   if(hunter.stage==='juvenile')hunter.juvenileFood=(hunter.juvenileFood??0)+gained;
   hunter.recentFood=(hunter.recentFood??0)+tissue*meat*1.3;
   this.die(prey,defensive==='rival'?'同性間の争い':defensive?'防衛':'捕食',tissue*meat);
   this.addVisualEffect('consume',prey);
   if(meat>0)this.log('pred','#'+hunter.id+' が #'+prey.id+' を捕食',prey);
  }
  return true;
 }
 consumeWaterweed(x,y,amount){
  const i=this.cell(x,y);
  if(this.tiles[i]!==1||this.water[i]<=0)return 0;
  const taken=Math.min(this.waterweed[i],amount);
  this.waterweed[i]-=taken;
  // Record harvesting on the plant's tile rather than the eater's tile.
  if(taken>0)this.grazingPressure[i]+=taken/6;
   if(taken>0)this.soil[i]=Math.max(0,this.soil[i]-taken*.05);
  if(this.waterweed[i]<.001)this.waterweed[i]=0;
  return taken;
 }
 nearestWaterweed(x,y,radius){
  let best=null,score=radius*radius;
  const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL),reach=Math.ceil(radius/CELL)+1;
  for(let yy=Math.max(0,cy-reach);yy<=Math.min(NY-1,cy+reach);yy++)
   for(let xx=Math.max(0,cx-reach);xx<=Math.min(NX-1,cx+reach);xx++){
    const i=yy*NX+xx;
    if(this.tiles[i]!==1||this.water[i]<=0||this.waterweed[i]<=.2)continue;
    // Approach the reachable edge of a food tile instead of its centre.
    // This reduces needless movement before taking the first bite.
    const px=clamp(x,xx*CELL+2,(xx+1)*CELL-2);
    const py=clamp(y,yy*CELL+2,(yy+1)*CELL-2);
    const d=(px-x)**2+(py-y)**2;
    if(d<score){best={x:px,y:py};score=d;}
   }
  return best;
 }
 consumeGrass(x,y,amount){
  const i=this.cell(x,y);
  if(this.tiles[i]!==0)return 0;
  const taken=Math.min(this.grass[i],amount);
  this.grass[i]-=taken;
  if(taken>0)this.grazingPressure[i]+=taken/6;
   if(taken>0)this.soil[i]=Math.max(0,this.soil[i]-taken*.12);
  // An exhausted pasture becomes bare ground until grass spreads in again.
  if(this.grass[i]<=.001){this.grass[i]=0;this.tiles[i]=2;}
  return taken;
 }
 consumeWater(x,y,amount){
  const i=this.cell(x,y);if(this.tiles[i]!==1)return 0;
  const taken=Math.min(Math.max(0,this.water[i]-POND_RESERVE),amount);
  this.water[i]-=taken;
  return taken;
 }
 nearWater(x,y,radius=1){
  const cx=this.cell(x,y)%NX,cy=Math.floor(this.cell(x,y)/NX);
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   const a=cx+dx,b=cy+dy;
   if(a>=0&&a<NX&&b>=0&&b<NY){
    const id=b*NX+a;
    if(this.tiles[id]===1&&this.water[id]>0)return true;
   }
  }
  return false;
 }
 drinkNearby(x,y,amount){
  const cx=this.cell(x,y)%NX,cy=Math.floor(this.cell(x,y)/NX);
  let best=-1,bestD=Infinity;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const a=cx+dx,b=cy+dy;if(a<0||a>=NX||b<0||b>=NY)continue;
   const id=b*NX+a;if(this.tiles[id]!==1||this.water[id]<=0)continue;
   const d=dx*dx+dy*dy;if(d<bestD){bestD=d;best=id;}
  }
  if(best>=0)return this.consumeWater((best%NX+.5)*CELL,(Math.floor(best/NX)+.5)*CELL,amount);
  return 0;
 }
 nearestWater(x,y,maxRange=145){
  let best=null,dist=maxRange*maxRange;
  for(let i=0;i<this.tiles.length;i++){
   if(this.tiles[i]!==1||this.water[i]<=0)continue;
   const a=(i%NX+.5)*CELL,b=(Math.floor(i/NX)+.5)*CELL;
   const d=(x-a)**2+(y-b)**2;
   if(d<dist){best={x:a,y:b};dist=d;}
  }
  return best;
 }
 nearestGrass(x,y,radius,g){
  let best=null,score=radius*radius;
  const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL),reach=Math.ceil(radius/CELL)+1;
  for(let yy=Math.max(0,cy-reach);yy<=Math.min(NY-1,cy+reach);yy++)
   for(let xx=Math.max(0,cx-reach);xx<=Math.min(NX-1,cx+reach);xx++){
    const id=yy*NX+xx;if(this.tiles[id]!==0||this.grass[id]<=.2)continue;
    if(!terrainFitness(g,0).passable)continue;
    const a=clamp(x,xx*CELL+2,(xx+1)*CELL-2);
    const b=clamp(y,yy*CELL+2,(yy+1)*CELL-2);
    const d=(a-x)**2+(b-y)**2;
    if(d<score){score=d;best={x:a,y:b};}
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
  this.rng=this.initialSeed||971253;this.units=[];this.eggs=[];this.food=[];this.corpses=[];this.species=new Map();this.logs=[];this.effects=[];this.history=[];this.discoveries=[];this.tick=0;this.nextId=1;this.recycled=0;this.introducedCount=0;this.runStartTick=null;this.runEndedTick=null;this.founderSpeciesCount=0;this.deathCauses={};this.courtshipFailures={};this.courtshipStarts=0;this.mateApproachStarts=0;this.mateApproachStalled=0;this.matings=0;this.migrations=0;this.terrainCrossings=0;this.courtships=[];this.eggTrails=[];this.recycledByTerrain=[0,0,0,0];this.growth=70;this.stress=15;this.rainfall=25;this.weather='sunny';this.weatherUntil=240;this.weatherStrength=0;this.baseTemperature=22;this.temperature=22;this.temperatureHistory=[];this.climateEnabled=true;this.seasonLength=600;
  this.setupTerrain();
  this.grass=new Float32Array(this.tiles.length);
  this.water=new Float32Array(this.tiles.length);
  this.waterbed=new Uint8Array(this.tiles.length);
  this.soil=new Float32Array(this.tiles.length);
  this.soilWater=new Float32Array(this.tiles.length);
   this.grazingPressure=new Float32Array(this.tiles.length);
  this.waterweed=new Float32Array(this.tiles.length);
  this.seedRainCount=0;this.waterweedSeedCount=0;this.corpseSproutCount=0;
  for(let i=0;i<this.tiles.length;i++){
   if(this.tiles[i]===0)this.grass[i]=65+this.rand()*35;
   if(this.tiles[i]===1){this.water[i]=80+this.rand()*20;this.waterbed[i]=1;this.waterweed[i]=48+this.rand()*30;}
  }
  this.log('info','生命は未移入。種類数を選んでフィールドへ生命を移入してください');this.snapshot();
 }
 snapshot(){this.history.push({population:this.units.length,eggs:this.eggs.length,food:this.grass.reduce((a,b)=>a+b,0)+this.waterweed.reduce((a,b)=>a+b,0),corpses:this.corpses.length,temperature:this.temperature});if(this.history.length>180)this.history.shift();}
 seasonIndex(){return Math.floor((this.tick%(this.seasonLength*4))/this.seasonLength);}
 seasonName(){return ['spring','summer','autumn','winter'][this.seasonIndex()];}
 seasonProgress(){return (this.tick%this.seasonLength)/this.seasonLength;}
 // Seasons and ambient temperature share the exact same 600-step clock.
 // Each boundary has a defined temperature, so there is no abrupt jump.
 // Spring is the user's baseline, summer is warmer, autumn cools and
 // winter reaches freezing temperatures. Late winter thaws into spring.
 seasonalTemperature(){
  const offsets=[0,13,-3,-22,0];
  const index=this.seasonIndex(),progress=this.seasonProgress();
  // Keep each season characteristic for most of its span, then transition
  // smoothly during the final quarter (including late-winter thaw).
  const transition=Math.max(0,Math.min(1,(progress-.75)/.25));
  const eased=transition*transition*(3-2*transition);
  return this.baseTemperature+offsets[index]+
   (offsets[index+1]-offsets[index])*eased;
 }
 updateTemperature(){
  if(!this.climateEnabled){this.temperature=this.baseTemperature;return;}
  const seasonal=this.seasonalTemperature();
  // Weather and short variations are small relative to seasonal changes.
  const weather=this.weather==='sunny'?1:this.weather==='rain'?-2:-.5;
  const shorter=.8*Math.sin(this.tick*Math.PI*2/370+1.2);
  this.temperature=clamp(seasonal+weather+shorter,-25,55);
  if(this.tick%80===0){this.temperatureHistory.push(this.temperature);if(this.temperatureHistory.length>120)this.temperatureHistory.shift();}
 }
 temperatureAt(x,y){return localTemperature(this.temperature,this.terrain(x,y));}
 updateWeather(){
  // Deterministic climate phases; rain frequency follows the rain slider.
  if(this.tick>=this.weatherUntil){
   const roll=this.rand(),rainChance=this.rainfall===0?0:clamp(.12+this.rainfall/100*.60,0,.70);
   this.weather=roll<rainChance?'rain':roll<rainChance+.40?'cloudy':'sunny';
   this.weatherStrength=this.weather==='rain'?clamp(this.rainfall/100,.1,1):0;
   this.weatherUntil=this.tick+160+Math.floor(this.rand()*180);
   this.log('info','天候：'+({rain:'雨',cloudy:'曇り',sunny:'晴れ'}[this.weather]));
  }
  if(this.weather==='rain'&&this.rainfall>0&&this.tick%30===0)
   this.replenishWater(1.8*this.weatherStrength);
 }
 // Steering helper: a goal inside impassable terrain must not trap an
 // organism in a turn-into-obstacle / reverse-heading loop.
 navigate(u,target,desired,speed,turnRate,arrivalRadius=0){
  if(target){
   const d=Math.sqrt(distance(u,target)),previous=u.pathCheckpoint;
   if(!previous||(target.x-previous.x)**2+(target.y-previous.y)**2>20*20){
    u.pathCheckpoint={x:target.x,y:target.y,startDistance:d,tick:this.tick};
    u.detourUntil=0;
   }else if(this.tick-previous.tick>=48){
    if(d>previous.startDistance-3&&d>arrivalRadius+7){
     u.avoidTarget={x:target.x,y:target.y,until:this.tick+150};
     u.pathCheckpoint=null;u.detourUntil=0;
     return 'abandoned';
    }
    u.pathCheckpoint={x:target.x,y:target.y,startDistance:d,tick:this.tick};
   }
  }else u.pathCheckpoint=null;
  if(target&&distance(u,target)<=arrivalRadius*arrivalRadius){
   u.detourUntil=0;u.blockedSteps=0;
   return 'arrived';
  }
  if((u.detourUntil??0)>this.tick)desired=u.detourHeading;
  const turn=Math.atan2(Math.sin(desired-u.angle),Math.cos(desired-u.angle));
  u.angle+=clamp(turn,-turnRate,turnRate)+this.range(-.04,.04);
  const canMove=angle=>{
   const nx=clamp(u.x+Math.cos(angle)*speed,7,W-7);
   const ny=clamp(u.y+Math.sin(angle)*speed,7,H-7);
   if((nx-u.x)**2+(ny-u.y)**2<=Math.max(.0001,speed*speed*.04))return null;
   const nextTerrain=this.terrain(nx,ny);
    // Aquatic organisms cannot wander out of a pond, but stranded ones can
    // still return from the shore after a habitat-change mutation.
    if(u.g.aquatic===1&&this.terrain(u.x,u.y)===1&&nextTerrain!==1)return null;
    return terrainFitness(u.g,nextTerrain).passable?{x:nx,y:ny}:null;
  };
  let next=canMove(u.angle);
  if(next){u.x=next.x;u.y=next.y;u.blockedSteps=0;return 'moved';}
  u.blockedSteps=(u.blockedSteps??0)+1;
  const sign=u.detourSide??(u.id%2===0?1:-1);
  for(const sweep of [.45,.90,1.40,1.95,2.55,Math.PI]){
   for(const direction of [sign,-sign]){
    const candidate=u.angle+direction*sweep;
    next=canMove(candidate);
    if(!next)continue;
    u.detourSide=direction;u.detourHeading=candidate;
    u.detourUntil=this.tick+22;
    u.angle=candidate;u.x=next.x;u.y=next.y;
    return 'detour';
   }
  }
  // Truly enclosed: avoid a new 130-degree rotation on every frame.
  u.detourUntil=0;
  if(u.blockedSteps>12){u.blockedSteps=0;u.refugeTarget=null;}
  return 'blocked';
 }
 step(){
  stepCache={diet:new WeakMap(),morph:new WeakMap(),axes:new WeakMap()};
  this.tick++;
  this.updateWeather();
  this.updateTemperature();
  // Regrowth is suppressed by local biomass demand instead of a population threshold.
  if(this.tick%6===0){
   // Track actual plant harvests in consumeGrass/consumeWaterweed.
  }
  // Map resources are finite. Grass regrows only from living adjacent patches,
  // so complete overgrazing cannot recover without intervention.
  if(this.tick%6===0){
   const next=this.grass.slice();
   for(let i=0;i<this.tiles.length;i++){
    if(this.tiles[i]===0&&this.grass[i]>0){
     const localGrazing=this.grazingPressure[i];
      const productivity=clamp(.28+this.soil[i]/120,.28,1.12);
      const regen=(1.8+this.soil[i]*.05)*this.growth/70*productivity/(1+localGrazing*.52);
      next[i]=Math.min(100,this.grass[i]+regen);
      if(localGrazing>2.5){
       next[i]=Math.max(0,next[i]-Math.min(4.5,(localGrazing-2.5)*.23));
       this.soil[i]=Math.max(0,this.soil[i]-.075*Math.min(10,localGrazing));
       if(next[i]<.2){next[i]=0;this.tiles[i]=2;}
      }
    }
    if(this.grass[i]<=0&&this.tiles[i]!==1&&this.tiles[i]!==3){
     const x=i%NX,y=Math.floor(i/NX);
     const neighbors=[x>0?i-1:-1,x<NX-1?i+1:-1,y>0?i-NX:-1,y<NY-1?i+NX:-1];
     // A completely bare world contains no propagules.
     // Fertilized patches spread faster, but never create plants without seeds.
     const fertile=clamp(this.soil[i]/55,0,1.5);
     if(neighbors.some(j=>j>=0&&this.grass[j]>18)&&this.rand()<(.08+.20*fertile)*this.growth/70){
      next[i]=4;this.tiles[i]=0;
     }
    }
    // Waterweed is a separate, edible plant resource: water itself is not food.
    if(this.tiles[i]===1&&this.water[i]>0&&this.waterweed[i]>0)
     this.waterweed[i]=Math.min(100,this.waterweed[i]+(.55+this.soil[i]*.024)*this.growth/70/(1+this.grazingPressure[i]*.4));
    this.soil[i]*=.997;
   }
   this.grass=next;
   // Decaying 6-step grazing history lets abandoned pastures regenerate.
   for(let i=0;i<this.grazingPressure.length;i++)this.grazingPressure[i]*=.5;
  }
  // Windborne seeds occasionally arrive on bare soil even without nearby grass.
  // Rain makes germination more likely, while dry/rocky soil is less welcoming.
  if(this.tick%12===0&&this.growth>0){
   const attempts=6;
   for(let n=0;n<attempts;n++){
    const id=Math.floor(this.rand()*this.tiles.length);
    if(this.tiles[id]!==2||this.grass[id]>0)continue;
    const humidity=this.weather==='rain'?1.8:1;
    if(this.rand()<(.10+this.soil[id]*.005)*humidity*this.growth/70){
     this.tiles[id]=0;this.grass[id]=5+this.rand()*5;
     this.seedRainCount++;
    }
   }
  }
  // Aquatic plants spread locally, but an extinct pond can also recover via
  // rare windborne / waterfowl-carried seeds. No spontaneous growth on dry land.
  // Germination needs actual water; wetter ponds and rain favor seed arrival.
  if(this.tick%12===0&&this.growth>0){
   const next=this.waterweed.slice();
   for(let i=0;i<this.tiles.length;i++)if(this.tiles[i]===1&&this.water[i]>=12&&this.waterweed[i]<=.001){
    const x=i%NX,y=Math.floor(i/NX);
    const adjacent=[x>0?i-1:-1,x<NX-1?i+1:-1,y>0?i-NX:-1,y<NY-1?i+NX:-1];
    if(adjacent.some(j=>j>=0&&this.tiles[j]===1&&this.waterweed[j]>15)&&this.rand()<.08*this.growth/70){
     next[i]=3;
    }else{
     const rain=this.weather==='rain'?1.7:1;
     const depth=clamp(this.water[i]/65,.25,1);
     if(this.rand()<.006*rain*depth*this.growth/70){
      next[i]=4+this.rand()*3;
      this.waterweedSeedCount++;
     }
    }
   }
   this.waterweed=next;
  }
  // Ponds are permanent terrain. Rain affects water above the minimum
  // reservoir; no climatic condition is allowed to erase a water tile.
  if(this.tick%180===0&&this.rainfall>0)
   this.replenishWater(12*this.rainfall/100);
  if(this.tick%8===0){
   for(let i=0;i<this.tiles.length;i++)if(this.tiles[i]===1)
    this.water[i]=Math.max(POND_RESERVE,this.water[i]-(.16+this.stress*.003));
  }
  for(let i=this.corpses.length-1;i>=0;i--){
   const c=this.corpses[i];c.age++;
   const loss=Math.min(c.mass,Math.max(.03,c.mass*DECAY[this.terrain(c.x,c.y)]));c.mass-=loss;c.reserve+=loss;
   const id=this.cell(c.x,c.y);
   // Decomposition nourishes soil; tissues also return moisture to the world.
   this.soil[id]=Math.min(100,this.soil[id]+loss*.65);
   // Corpse moisture stays in the soil. It never creates permanent ponds;
   // rainfall and explicitly painted waterbeds control surface-water area.
   this.soilWater[id]=Math.min(100,this.soilWater[id]+loss*.12);
   // Existing nearby water may receive a small fraction, without flooding land.
   if(this.tiles[id]===1){
    this.water[id]=Math.min(100,this.water[id]+loss*.025);
    if(this.waterweed[id]>0)this.waterweed[id]=Math.min(100,this.waterweed[id]+loss*.3);
   }
   if(this.tiles[id]!==1&&this.tiles[id]!==3){
    if(this.grass[id]>0)this.grass[id]=Math.min(100,this.grass[id]+loss*.12);
    // Fertilizer alone cannot germinate a grassland with no surviving seeds.
    // Neighboring grass spreads into the fertilized cell in the growth phase.
   }
   // Plants can sprout from undigested seeds in herbivorous remains.
   // The corpse acts as fertilizer as well as a seed carrier; bare rock and
   // open water are not converted into pasture.
   if(!c.seedPlanted&&(c.seedBank??0)>=.5&&c.age>=10&&this.tiles[id]===2){
    const chance=clamp(.12+c.seedBank*.04,0,.8);
    if(this.rand()<chance){
     this.tiles[id]=0;this.grass[id]=Math.min(20,4+c.seedBank);
     c.seedPlanted=true;this.corpseSproutCount++;
     this.log('info','草食スライムの死骸から草が芽吹いた',c);
    }
   }
   if(c.mass<.6){this.corpses.splice(i,1);this.recycled++;this.recycledByTerrain[this.terrain(c.x,c.y)]++;this.log('decay','死体の有機物と水分が地形に還元された',c);}
  }
  for(const egg of this.eggs){
   const eggClimate=thermalFitness(egg.g,this.temperatureAt(egg.x,egg.y));
   // Thick-shelled / dormant genotypes can delay hatching through a
   // hostile season, at the expense of reserves and delayed reproduction.
   const eggRest=eggClimate.excess>2&&
    ((egg.g.hibernate??0)>.52||(egg.g.shell??0)>.58);
   egg.dormant=eggRest;
   egg.age+=eggRest?.008:eggClimate.excess>0?.32:clamp(.72+eggClimate.comfort*.28,.72,1);
   egg.heatExposure=(egg.heatExposure??0)+eggClimate.excess*(eggRest?.0003:.016);
   if(eggRest)egg.energy-=.0025+eggClimate.excess*.00035;
   if(egg.energy<=0){egg.dead=true;this.log('death','卵 #'+egg.id+' が休眠中に栄養を使い切った',egg);continue;}
   if(egg.heatExposure>22){egg.dead=true;this.log('death','卵 #'+egg.id+' が極端な気温で死亡',egg);continue;}

   if(!egg.dead&&egg.age>=egg.hatchAt&&this.units.length<2000){
    egg.dead=true;
    const hatchSite=egg.g.aquatic!==1&&this.terrain(egg.x,egg.y)===1?
      this.shoreEggSite(egg.x,egg.y,egg.g):{x:egg.x,y:egg.y};
     const child=this.spawn(hatchSite.x,hatchSite.y,egg.g,{id:egg.parent,otherParent:egg.otherParent,generation:egg.generation-1,lineage:egg.lineage});
    if(child){child.energy=egg.energy+35;child.stage='juvenile';this.log('hatch','卵 #'+egg.id+' から #'+child.id+' が孵化',egg);}
   }
  }
  this.eggs=this.eggs.filter(e=>!e.dead);
  const batch=this.units.slice();
  const unitGrid=new SpatialLookup(batch),eggGrid=new SpatialLookup(this.eggs),corpseGrid=new SpatialLookup(this.corpses);
  const byId=new Map(batch.map(u=>[u.id,u]));
  const firstEggByParent=new Map();
  for(const egg of this.eggs)if(!egg.dead&&!firstEggByParent.has(egg.parent))firstEggByParent.set(egg.parent,egg);
  for(const u of batch){
   if(u.dead)continue;u.age++;u.juvenileFood=0;if(u.bite>0)u.bite--;if(u.woundFlash>0)u.woundFlash--;if(u.attackFlash>0)u.attackFlash--;if(u.defendFlash>0)u.defendFlash--;if(u.mateCooldown>0)u.mateCooldown--;
   if(u.pregnancy){u.pregnancy.remaining--;if(u.pregnancy.remaining<=0)this.layEgg(u);}
   const g=u.g,t=this.terrain(u.x,u.y),m=organismMorphology(u),diet=dietProfile(g),home=terrainFitness(g,t);
   const youth=u.stage==='juvenile'?.50:1,body=vitality(u),sight=m.eyeRange*home.sight;
   const thermal=thermalFitness(g,this.temperatureAt(u.x,u.y));
   u.thermalComfort=thermal.comfort;u.temperature=this.temperatureAt(u.x,u.y);
   // Life declines naturally each step; damage, infection, and harsh environments
   // consume the same finite reserve. Feeding provides energy, not extra years.
   // Hysteresis: entering hibernation needs reserves; remaining asleep
   // requires less, so organisms do not repeatedly wake and starve midwinter.
   const canRest=u.stage==='adult'&&g.aquatic!==1&&(g.hibernate??0)>.52&&
    thermal.excess>2&&(u.dormant?u.energy>22:u.energy>112)&&
    !u.pregnancy&&!u.courtPartner&&terrainFitness(g,t).fitness>.75;
   if(canRest){
    if(!u.dormant){u.dormant=true;this.log('rest','#'+u.id+' が休眠に入った',u);}
    // Dormancy is costly and does not restore HP: weak/slim individuals
    // still perish, while well-fed seasonal specialists can overwinter.
    u.hp-=lifeDrain(u,{temperature:u.temperature,terrain:t})*.34+thermal.damage*.07;
    u.energy-=.04+organismMorphology(u).bodyMass*.0009;
    u.hydration=Math.max(0,u.hydration-.028);
    if(u.hydration<=0||u.energy<=0||u.hp<=0){
     this.die(u,u.hydration<=0?'脱水':u.energy<=0?'飢餓':'気温による衰弱');
    }
    continue;
   }
   if(u.dormant){u.dormant=false;this.log('wake','#'+u.id+' が休眠から目覚めた',u);}
   // Maintaining dormancy-capable physiology carries a year-round cost.
   u.hp-=lifeDrain(u,{temperature:u.temperature,terrain:t});
   u.hp-=thermal.damage;u.energy-=thermal.upkeep+(g.hibernate??0)*.075;
   const near=unitGrid.query(u.x,u.y,Math.max(145,sight*1.6),false);
   const aquatic=g.aquatic===1,underwater=t===1&&this.water[this.cell(u.x,u.y)]>0;
   if(aquatic){
    u.stranded=underwater?0:u.stranded+1;
    u.hydration=underwater?Math.min(100,u.hydration+1.6):u.hydration-.85;
    if(underwater){const consumed=this.consumeWater(u.x,u.y,.095);if(consumed>0&&(this.tick+u.id)%24===0)this.addVisualEffect('drink',u);}
   }else{
    u.submerged=underwater?u.submerged+1:0;
    const drinking=this.nearWater(u.x,u.y,1);
    u.hydration=drinking?Math.min(100,u.hydration+.9):u.hydration-.24;
    if(drinking){const consumed=this.drinkNearby(u.x,u.y,.12);if(consumed>0&&(this.tick+u.id)%24===0)this.addVisualEffect('drink',u);}
   }
   if((aquatic&&u.stranded>95)||(!aquatic&&u.submerged>24)||u.hydration<=0){
    this.die(u,aquatic?'離水':u.submerged>24?'溺水':'脱水');continue;
   }
   if(u.hydration<18)u.hp-=.06;
   let nearest=null,df=sight*sight;
   if(diet.plant>0){
    // Search farther only while hungry; no new food is generated.
    const forageRadius=u.energy<80?Math.min(165,Math.max(65,sight*1.9)):sight;
    nearest=aquatic?this.nearestWaterweed(u.x,u.y,forageRadius):this.nearestGrass(u.x,u.y,forageRadius,g);
    if(nearest)df=distance(u,nearest);
    if(u.energy<80&&!nearest)u.forageFailure++;
   }
   let nearestCorpse=null,corpseDist=sight*sight;
   if(diet.meat>.3)for(const corpse of corpseGrid.query(u.x,u.y,sight)){
    if(corpse.mass<1)continue;
    const d=distance(u,corpse);
    if(d<corpseDist){corpseDist=d;nearestCorpse=corpse;}
   }
   // Eggs are stationary and cannot fight or flee. Guardians only deter some hunters.
   let targetEgg=null,ed=sight*sight*(.65+eggPredationDrive(g)*1.5);
   if(u.bite===0&&eggPredationDrive(g)>.24&&g.mouths>0)for(const egg of eggGrid.query(u.x,u.y,Math.sqrt(ed))){
    if(egg.dead||egg.parent===u.id||egg.otherParent===u.id)continue;
     const eggTerrain=this.terrain(egg.x,egg.y);
     if(eggTerrain===1&&!aquatic)continue;
     let d=distance(u,egg),cover=coverFactor(eggTerrain,aquatic);
     if(d>=ed*cover*cover)continue;
     d/=Math.max(.1,cover)**2;
    const guardian=byId.get(egg.parent);
    const guarded=guardian&&!guardian.dead&&guardian.g.guard>.25&&distance(guardian,egg)<(14+guardian.g.guard*43)**2;
    const risk=guarded&&guardian!==u&&organismMorphology(guardian).bodyMass>=m.bodyMass*.65?1+guardian.g.guard*3:1;
    d*=risk; if(d<ed){ed=d;targetEgg=egg;}
   }
  let prey=null,pd=sight*sight;
   if(m.predatory&&u.bite===0)for(const v of near){
    if(v===u||v.dead||v.id===u.courtPartner)continue;
      const preyTerrain=this.terrain(v.x,v.y);
      if(preyTerrain===1&&!aquatic)continue;
      const preyMass=organismMorphology(v).bodyMass;
     // Under famine, capable predators risk attacking similarly sized
     // conspecifics; successful attacks yield calories, not free biomass.
     const hungry=u.energy<65&&diet.meat>.24;
     const cannibal=hungry&&v.category===u.category;
     if(preyMass>m.bodyMass*(cannibal?1.15:m.edibleRatio))continue;
    const d=distance(u,v)/Math.max(.1,coverFactor(preyTerrain,aquatic))**2;
     if(d<pd){pd=d;prey=v;}
   }
   // Prey respond to the perceived, visible feeding signal, not hidden genome.
   let danger=null,dangerD=sight*sight*1.6;
   for(const v of near){
    if(v===u||v.dead)continue;
    const visible=dietProfile(v.g).signal;
    if(visible<.48||organismMorphology(v).bodyMass<m.bodyMass*.55)continue;
    const d=distance(u,v)/Math.max(.1,coverFactor(t,aquatic))**2;
     if(d<dangerD){danger=v;dangerD=d;}
   }
   // Guardians attack only nearby threats to their own or related eggs.
   let defenderTarget=null,defendDist=65*65;
   if(protectiveDrive(g)>.34&&u.bite===0&&u.energy>18){
    const guardedEggs=eggGrid.query(u.x,u.y,78).filter(e=>!e.dead&&(e.parent===u.id||e.lineage===u.lineage));
    if(guardedEggs.length)for(const v of near){
     if(v===u||v.dead||v.lineage===u.lineage||eggPredationDrive(v.g)<.30)continue;
     if(!guardedEggs.some(e=>distance(v,e)<54*54))continue;
     const d=distance(u,v);
     if(d<defendDist){defendDist=d;defenderTarget=v;}
    }
   }
   const flight=!defenderTarget&&!!danger&&(diet.diet<.7||organismMorphology(danger).bodyMass>m.bodyMass*1.5);
   u.fleeing=flight;
   // Competition is local crowding for the same food, not an arbitrary caste.
   // When nearby rivals monopolize a rich tile, search for a less crowded refuge.
   let rivals=0,stronger=0;
   if(diet.plant>.25)for(const v of near){
    if(v===u||v.dead||dietProfile(v.g).plant<.25)continue;
    if(distance(u,v)<48**2){rivals++;if(organismMorphology(v).bodyMass>m.bodyMass*.95)stronger++;}
   }
   const {density,habitatLoad}=crowdMetrics(u,near);
   const congestion=crowdStress(density);
   u.crowdStress=congestion;
   u.habitatLoad=habitatLoad;
   const pressure=(rivals+stronger*.7)/(1+GROWTH[t]*5)+congestion*.6+habitatLoad*.55;
   const dispersal=clamp(g.dispersal??.45,0,1),sociability=clamp(g.sociability??.45,0,1);
   // Kin-specific contact disease is more likely in dense founder lineages.
   // A new mutation is not instantly immune: lineage persists across offspring.
   let relatives=0,infectious=0;
   for(const v of near)if(v!==u&&!v.dead&&v.lineage===u.lineage&&distance(u,v)<38**2){
    relatives++;if(v.infection>0)infectious++;
   }
   const crowd=Math.max(0,relatives-2)+congestion*.65;
   if(u.infection>0){
    u.infection--;
    u.hp-=(.19+crowd*.055)*(1-(g.resist??.4)*.7);
   }else if(crowd>0&&this.rand()<Math.min(.10,crowd*.0025+infectious*.014)*(1-(g.resist??.4)*.9)){
    u.infection=Math.max(25,70+Math.floor(this.rand()*55)-Math.round((g.resist??.4)*40));
    this.log('ill','#'+u.id+' が密集地で感染',u);
   }
   // Crowded colonies consume more energy and stop producing offspring as easily.
   u.energy-=Math.min(.85,Math.max(0,rivals-3)*.075)+congestion*.11;
   // The area burden is especially expensive for large, near-stationary bodies.
   u.energy-=crowdEnergyCost(habitatLoad,u.growthScale??1);
   u.localCrowd=relatives;
   // Genetic dispersal controls crowd tolerance; a partner nearby tempers
   // dispersal until serious pressure makes staying ecologically expensive.
   const partnerNearby=u.energy>90&&this.isReadyToMate(u)&&
    near.some(v=>v!==u&&!v.dead&&this.isReadyToMate(v)&&
     sexualCompatibility(u,v)&&distance(u,v)<85**2);
   const retreatThreshold=dispersalPressureThreshold(g);
   const crowdEscape=pressure>retreatThreshold||habitatLoad>2.0+(1-dispersal)*1.1;
   const seekRefuge=!u.courtPartner&&!u.mateTarget&&!u.pregnancy&&!flight&&u.energy>75&&
    (thermal.excess>2||crowdEscape&&(!partnerNearby||pressure>retreatThreshold*1.6));
   if(seekRefuge&&(this.tick+u.id)%14===0){
    let best=null,bestScore=-Infinity;
    for(let i=0;i<12;i++){
     const x=clamp(u.x+this.range(-65,65),8,W-8),y=clamp(u.y+this.range(-65,65),8,H-8);
     const terrain=this.terrain(x,y);
     let competitors=0;
     for(const v of unitGrid.query(x,y,48,false))if(v!==u&&!v.dead&&dietProfile(v.g).plant>.25)competitors++;
     const habitat=terrainFitness(g,terrain);
     if(!habitat.passable)continue;
     const fit=habitat.fitness;
     const thermalBenefit=thermalFitness(g,localTemperature(this.temperature,terrain));
      const score=fit*.85+GROWTH[terrain]*.6+thermalBenefit.comfort*.30-thermalBenefit.excess*.06-competitors*.37+
       (terrain===1&&aquatic?.9:0)+this.range(-.12,.12);
     if(score>bestScore){bestScore=score;best={x,y,terrain};}
    }
    if(best&&bestScore>home.fitness*.85+GROWTH[t]*.6+thermal.comfort*.30-thermal.excess*.06-pressure*.26){
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
   const mate=u.courtPartner?(byId.get(u.courtPartner)??null):this.findMate(u,near);
    // Without an eligible partner, a well-fed parthenogen can repopulate alone.
    if(!mate&&!u.courtPartner&&reproductiveMode(g)===2&&u.sex==='F'&&
       u.energy>120&&(this.tick+u.id)%135===0)this.conceiveSolo(u);
    // Competition over mates and scarce food can escalate into same-sex fighting.
    // Peaceful cohabitation remains the default when space and nutrition suffice.
    let rival=null;
    if(!u.courtPartner&&!u.pregnancy&&u.stage==='adult'&&u.bite===0&&u.energy>35&&
       (pressure>1.1||u.energy<83)&&((this.tick+u.id)%23===0)){
     const candidates=near.filter(v=>v!==u&&!v.dead&&v.stage==='adult'&&
        v.sex===u.sex&&v.sex!=='H'&&v.lineage!==u.lineage&&
        distance(u,v)<Math.min(38,sight)**2);
     if(candidates.length&&this.rand()<Math.min(.55,.12+pressure*.12))
      rival=candidates.reduce((best,v)=>!best||distance(u,v)<distance(u,best)?v:best,null);
    }
   let target=prey&&pd<df*1.4?prey:nearest;
   if(nearestCorpse&&corpseDist<Math.min(df,pd)*1.35)target=nearestCorpse;
   if(mate&&(u.courtPartner||!target||u.energy>=112))target=mate;
   if(targetEgg&&ed<Math.min(df,pd)*1.15)target=targetEgg;
   if(defenderTarget&&!u.courtPartner)target=defenderTarget;
    if(rival&&!mate&&!defenderTarget&&!flight)target=rival;
   if(u.refugeTarget&&!flight&&!u.courtPartner&&!mate&&u.energy>=85)target=u.refugeTarget;
   // Social attraction is gentle: no swarm into a dense pile, and never
   // override escape, courtship, urgent hunger, or migration.
   if(!flight&&!mate&&!u.courtPartner&&!u.pregnancy&&!u.refugeTarget&&
      u.energy>105&&sociability>.22){
    if((this.tick+u.id)%31===0){
     const candidates=near.filter(v=>v!==u&&!v.dead&&v.category===u.category&&
      terrainFitness(g,this.terrain(v.x,v.y)).passable&&
      distance(u,v)>40**2&&distance(u,v)<135**2);
     if(candidates.length&&this.rand()<sociability*.85){
      const companion=candidates.reduce((best,v)=>!best||distance(u,v)<distance(u,best)?v:best,null);
      u.socialTarget={id:companion.id,until:this.tick+78};
     }
    }
    const companion=u.socialTarget&&u.socialTarget.until>this.tick?byId.get(u.socialTarget.id):null;
    if(companion&&!companion.dead&&companion.category===u.category&&
       distance(u,companion)>34**2&&distance(u,companion)<155**2&&
       (!target||u.energy>121))target=companion;
    else if(!companion||distance(u,companion)<=34**2)u.socialTarget=null;
   }else u.socialTarget=null;
   const nearFood=nearest&&distance(u,nearest)<Math.max(14,sight*.55)**2;
   const criticalWater=u.hydration<24||aquatic&&!underwater&&u.stranded>35;
   if((aquatic&&!underwater||!aquatic&&u.hydration<45&&!this.nearWater(u.x,u.y,1))&&(!nearFood||criticalWater)){
    const water=this.nearestWater(u.x,u.y);if(water)target=water;
   }
   // Guarding trades feeding opportunities for staying near the offspring.
   const ownEgg=firstEggByParent.get(u.id);
   if(ownEgg&&g.guard>.15&&!flight&&!defenderTarget&&!criticalWater&&u.energy>85){
    const guardRadius=12+g.guard*40;
    if(distance(u,ownEgg)>guardRadius**2||!target)target=ownEgg;
   }
   // Well-fed, reproduction-ready adults seek an eligible mate BEFORE
   // foraging, guarding eggs, social regrouping and voluntary dispersal.
   // Danger and critical dehydration remain higher priorities.
   const breedingPriority=!flight&&!criticalWater&&mate&&!mate.dead&&
    (u.courtPartner||this.isReadyToMate(u)&&u.energy>=112);
   if(breedingPriority){target=mate;u.refugeTarget=null;u.socialTarget=null;}
   // A blocked food/refuge target may be abandoned, but a compatible mate
   // should not be discarded by an unrelated avoidance marker.
   if(target&&!breedingPriority&&u.avoidTarget&&u.avoidTarget.until>this.tick&&
      distance(target,u.avoidTarget)<20*20&&!flight)target=null;
   // Immediate escape overrides food, reproduction and egg guarding.
   if(flight)target=null;
   const desired=flight?Math.atan2(u.y-danger.y,u.x-danger.x)
      :target?Math.atan2(target.y-u.y,target.x-u.x):u.angle+this.range(-.5,.5);
   const terrainMove=home.move;
   const courtingMate=u.courtPartner?byId.get(u.courtPartner):null;
   const speed=m.speed*body.vigor*thermal.activity*(u.stage==='juvenile'?.8:1)*terrainMove
     *(flight?1.24:courtingMate&&distance(u,courtingMate)<22**2?.20:1)
     *(flight?1:Math.max(.55,1-congestion*.06));
   // Targets are satisfied at contact range. Repeatedly overshooting food
   // or a partner looks like stationary spinning, and wastes resources.
   const arrivalRadius=!target||flight?0:
     target===mate||target===courtingMate?18:
     target===nearest||target===nearestCorpse?Math.max(7,m.biteReach+5):
     target===ownEgg?14:
     target===byId.get(u.socialTarget?.id)?30:
     target===targetEgg?Math.max(3,m.biteReach*.75):
     target===prey||target===defenderTarget||target===rival?Math.max(3,m.biteReach*.7):
     target===u.refugeTarget?11:
     this.terrain(target.x,target.y)===1&&g.aquatic!==1?25:9;
   u.behaviorTarget=flight?'escape':breedingPriority?'mate':
    target===nearest||target===nearestCorpse?'food':
    target===u.refugeTarget?'disperse':
    target===byId.get(u.socialTarget?.id)?'social':
    target===ownEgg?'guard':
    target?'other':'wander';
   const navigation=this.navigate(u,target,desired,speed,m.turnRate,arrivalRadius);
   if(navigation==='abandoned'&&breedingPriority&&u.mateTarget?.id===mate.id){
    this.mateApproachStalled++;
    u.mateApproachFailures++;
    this.log('mateFail','#'+u.id+' が相手 #'+mate.id+' に近づけず探索をやり直す',u);
    u.mateTarget=null;
   }
   u.hp-=home.hazard;
   // Terrain-fit offspring retain energy and can reproduce more successfully.
   const adaptationCost=clamp(1.65-home.fitness*.75,.70,1.5)*(1.08-.08*thermal.comfort);
   u.energy-=reproductiveUpkeep(g)*youth;
    u.energy-=((u.courtPartner?.75:1)*m.upkeep+longevityUpkeep(g))*youth*adaptationCost*(1+body.old*.18)+acquiredSizeMaintenance(u)*youth*adaptationCost+(flight?.10:0)+(ownEgg?g.guard*.16:0)+this.stress*.0035+home.upkeep+(g.wet+g.dry+g.rock)*.055;
   if(!flight&&aquatic&&underwater&&diet.plant>0&&nearest&&distance(u,nearest)<(m.biteReach+14)**2){
    const eaten=this.consumeWaterweed(nearest.x,nearest.y,Math.min(5.5,1.3*m.foodGain*feedingCapacity(u)));
    if(eaten>0){u.energy+=eaten*7.5*diet.plant*home.fitness;
     u.recentFood=(u.recentFood??0)+eaten*4;
     u.forageSuccess++;
     if(u.stage==='juvenile')u.juvenileFood+=eaten*7.5*diet.plant*home.fitness;
     // Eating sustains energy but cannot replenish spent lifespan.
     if((this.tick+u.id)%9===0)this.addVisualEffect('waterweed',u,{fromX:nearest.x,fromY:nearest.y});
     this.log('meal','#'+u.id+' が水草を食べた',u);}
   }
   if(!flight&&!aquatic&&diet.plant>0&&nearest&&distance(u,nearest)<(m.biteReach+13)**2){
    const eaten=this.consumeGrass(nearest.x,nearest.y,Math.min(4.8,1.05*m.foodGain*feedingCapacity(u)));
    if(eaten>0){u.energy+=eaten*10.5*diet.plant*home.fitness;
     u.recentFood=(u.recentFood??0)+eaten*4;
     u.forageSuccess++;
     u.seedBank=Math.min(100,(u.seedBank??0)+eaten*.35);
     if(u.stage==='juvenile')u.juvenileFood+=eaten*10.5*diet.plant*home.fitness;
     // Grass restores energy reserves, not irreversible life HP.
     if((this.tick+u.id)%9===0)this.addVisualEffect('graze',u,{fromX:nearest.x,fromY:nearest.y});
     this.log('meal','#'+u.id+' が草を食べた',u);}
   }
   // A carnivore can also scavenge a corpse: deserts cannot support herbivores.
   if(!flight&&diet.meat>.3&&nearestCorpse&&distance(u,nearestCorpse)<(m.biteReach+14)**2&&u.energy<175){
    const eaten=Math.min(nearestCorpse.mass,2.4*m.foodGain*feedingCapacity(u));
    nearestCorpse.mass-=eaten;
    u.energy+=eaten*5.5*diet.meat;
    u.recentFood=(u.recentFood??0)+eaten*4;
    if(u.stage==='juvenile')u.juvenileFood+=eaten*5.5*diet.meat;
    if(eaten>0){if((this.tick+u.id)%9===0)this.addVisualEffect('scavenge',u,{fromX:nearestCorpse.x,fromY:nearestCorpse.y});this.log('meal','#'+u.id+' が死体を食べた',u);}
   }
   if(!flight&&!defenderTarget&&targetEgg&&!targetEgg.dead&&u.bite===0&&distance(u,targetEgg)<(m.biteReach+4)**2)this.eatEgg(targetEgg,u);
   if(defenderTarget&&!defenderTarget.dead&&u.bite===0&&distance(u,defenderTarget)<(m.biteReach+defenderTarget.g.r+5)**2)
    this.attack(u,defenderTarget,true);
   if(!flight&&!defenderTarget&&mate&&!u.courtPartner&&!mate.courtPartner&&distance(u,mate)<38**2){
     if(this.startCourtship(u,mate)){u.mateTarget=null;mate.mateTarget=null;}
    }
   if(rival&&!flight&&!rival.dead&&distance(u,rival)<(m.biteReach+rival.g.r+3)**2)
     this.attack(u,rival,'rival');
    if(!flight&&diet.meat>0&&prey&&!prey.dead&&
      (this.terrain(prey.x,prey.y)!==1||aquatic)&&
      distance(u,prey)<(m.biteReach+prey.g.r)**2){
     this.attack(u,prey);
    }
   const newTerrain=this.terrain(u.x,u.y);
   if(newTerrain!==u.lastTerrain){u.lastTerrain=newTerrain;this.terrainCrossings++;}
   if(u.stage==='juvenile'){
    const increment=juvenileGrowthIncrement(u,u.juvenileFood,u.habitatLoad,u.crowdStress);
    u.juvenileGrowth=Math.min(1,(u.juvenileGrowth??0)+increment);
    // Tissue growth uses nutrients that cannot also pay for maintenance.
    u.energy-=increment*46;
    if(u.energy<38){
     // Unfed hatchlings remain small and eventually die rather than
     // growing automatically to adult size.
     u.hp-=(38-u.energy)*.012*(1+Math.min(2,(u.habitatLoad??0)*.28));
    }
    if(u.juvenileGrowth>=.999&&u.age>=65&&u.energy>=38){
     u.juvenileGrowth=1;u.stage='adult';
     this.log('mature','#'+u.id+' が成体になった',u);
    }
   }

   // Sustained feeding causes visible individual growth; high body mass raises
   // metabolic demand and slows movement, so giantism has a real ecological cost.
   u.recentFood=Math.max(0,(u.recentFood??0)*.975);
   const exceptional=u.growthScale>=NORMAL_NUTRITION_GROWTH;
   // Beyond ordinary adult size, food must remain abundant over time:
   // even high reserves alone cannot cause growth without active feeding.
   const foodNeeded=exceptional?58+Math.max(0,u.growthScale-NORMAL_NUTRITION_GROWTH)*55:16;
   const energyNeeded=exceptional?205:158;
   if(u.stage==='adult'&&(u.habitatLoad??0)<.45&&u.energy>energyNeeded&&u.recentFood>foodNeeded&&u.growthScale<MAX_NUTRITION_GROWTH){
    const baseRate=.0018+Math.min(.003,u.recentFood*.00014);
    const increment=Math.min(MAX_NUTRITION_GROWTH-u.growthScale,baseRate*(exceptional?.42:1));
    const cost=increment*(135+115*u.growthScale+(exceptional?110*u.growthScale*u.growthScale:0));
    if(u.energy>energyNeeded+cost){
     u.energy-=cost;
     u.growthScale+=increment;
     const enlarged=organismMorphology(u);
     const maxHp=Math.max(25,Math.round(enlarged.bodyMass*.48+25));
     if(maxHp>u.maxHp)u.maxHp=maxHp; // Larger body is not a free HP refill.
    }
   }
   // Starved organisms gradually lose their acquired oversized body mass.
   if((u.growthScale??1)>1.03&&u.energy<85)
    u.growthScale=Math.max(1,u.growthScale-(85-u.energy)*.000045);
   // Limit stored reserves so immobile giants cannot live on old stockpiles.
   if((u.growthScale??1)>1.05)u.energy=Math.min(u.energy,energyStorageLimit(u));
   // Zero food no longer kills instantaneously: the accelerated life drain
   // gives a short but real chance to feed before starvation completes.
   if(u.energy<0)u.energy=0;
   if(u.hp<=0)this.die(u,u.energy===0?'飢餓':thermal.excess>0?'気温による衰弱':u.infection>0?'感染症':'寿命・衰弱');
  }
  this.resolveUnitOverlap();
  this.updateCourtships();
  this.units=this.units.filter(u=>!u.dead);this.eggs=this.eggs.filter(e=>!e.dead);
   // Unhatched eggs can repopulate the world: extinction requires both to vanish.
   if(this.runStartTick!==null&&this.runEndedTick===null&&this.units.length===0&&this.eggs.length===0)this.runEndedTick=this.tick;
  for(const trail of this.eggTrails)trail.age++;
  this.eggTrails=this.eggTrails.filter(t=>t.age<t.life);
  if(this.tick%20===0)this.snapshot();
  if(this.tick%160===0&&this.units.length===0)this.log('info','全個体が絶滅。生命を移入できます');
  stepCache=null;
 }
 resolveUnitOverlap(){
  const units=this.units.filter(u=>!u.dead);
  if(units.length<2)return;
  const cellSize=48,softness=.88,iterations=3;
  const geometry=new Map(),byId=new Map();
  let maxAxis=0;
  for(const u of units){
   const axes=bodyCollisionAxes(u);
   geometry.set(u.id,{...axes,max:axes.rx,mass:Math.max(1,axes.rx*axes.ry)});
   byId.set(u.id,u);maxAxis=Math.max(maxAxis,axes.rx);
  }
  // Only physically neighboring organisms are tested. Grid is refreshed after
  // each correction pass so displaced individuals cannot miss new neighbors.
  const canStand=(u,x,y)=>terrainFitness(u.g,this.terrain(x,y)).passable&&
    !(u.g.aquatic===1&&this.terrain(u.x,u.y)===1&&this.terrain(x,y)!==1);
  const move=(u,dx,dy)=>{
   const x=clamp(u.x+dx,7,W-7),y=clamp(u.y+dy,7,H-7);
   if(canStand(u,x,y)){u.x=x;u.y=y;return;}
   // Sliding along a shore is preferable to pushing an amphibious boundary.
   if(canStand(u,x,u.y))u.x=x;
   if(canStand(u,u.x,y))u.y=y;
  };
  for(let iteration=0;iteration<iterations;iteration++){
   const grid=new Map();
   const bucket=(x,y)=>`${x},${y}`;
   for(const u of units){
    const key=bucket(Math.floor(u.x/cellSize),Math.floor(u.y/cellSize));
    if(!grid.has(key))grid.set(key,[]);
    grid.get(key).push(u);
   }
   let moved=false;
   for(const u of units){
    const cx=Math.floor(u.x/cellSize),cy=Math.floor(u.y/cellSize);
    const g=geometry.get(u.id);
    const range=Math.ceil((g.max+maxAxis)/cellSize);
    for(let dy=-range;dy<=range;dy++)for(let dx=-range;dx<=range;dx++){
     for(const v of grid.get(bucket(cx+dx,cy+dy))??[]){
      if(v.id<=u.id)continue;
      const h=geometry.get(v.id);
      const vx=v.x-u.x,vy=v.y-u.y,d2=vx*vx+vy*vy;
      if(d2>(g.max+h.max)**2)continue;
      const d=Math.sqrt(d2);
      // Identical coordinates must still separate deterministically.
      const angle=d>1e-7?Math.atan2(vy,vx):((u.id*31+v.id*17)%360)*Math.PI/180;
      const nx=Math.cos(angle),ny=Math.sin(angle);
      const target=softness*(ellipseExtent(u,g,nx,ny)+ellipseExtent(v,h,-nx,-ny));
      if(d>=target)continue;
      const push=Math.min(18,(target-d)*.75);
      const total=g.mass+h.mass;
      const ux=u.x,uy=u.y,vx0=v.x,vy0=v.y;
      move(u,-nx*push*h.mass/total,-ny*push*h.mass/total);
      move(v,nx*push*g.mass/total,ny*push*g.mass/total);
      if(u.x!==ux||u.y!==uy||v.x!==vx0||v.y!==vy0)moved=true;
     }
    }
   }
   if(!moved)break;
  }
 }
 // A player-managed soil intervention raises local primary production.
 // There is no population-number gating; the added biomass must still grow,
 // be eaten, and compete for space just like naturally occurring resources.
 fertilize(x,y,radius=3){
  const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL);
  let treated=0;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(dx*dx+dy*dy>radius*radius)continue;
   const xx=cx+dx,yy=cy+dy;if(xx<0||xx>=NX||yy<0||yy>=NY)continue;
   const id=yy*NX+xx,t=this.tiles[id];
   if(t===3)continue;
   this.soil[id]=Math.min(100,this.soil[id]+65);
   if(t===2&&this.grass[id]===0&&this.water[id]<=0){
    this.tiles[id]=0;this.grass[id]=8;
   }
   if(t===1&&this.water[id]>0&&this.waterweed[id]<=.001)this.waterweed[id]=5;
   treated++;
  }
  // Painting may run many times during a drag; avoid flooding the event log.
  return treated;
 }
 paint(x,y,type,radius){
  const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL);
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(dx*dx+dy*dy>radius*radius)continue;
   const xx=cx+dx,yy=cy+dy;if(xx<0||xx>=NX||yy<0||yy>=NY)continue;
   const i=yy*NX+xx;
   if(type===1&&this.units.some(u=>!u.dead&&u.g.aquatic!==1&&this.cell(u.x,u.y)===i))continue;
   this.tiles[i]=type;
   this.grass[i]=type===0?100:0;
   this.water[i]=type===1?100:0;
   this.waterweed[i]=type===1?70:0;
   this.waterbed[i]=type===1?1:0;
  }
 }

 adaptFounderToTerrain(g,t){
  const adapted={...g};
  adapted.aquatic=t===1?1:0;
  // On plant-free arid and rocky terrain, carnivorous/scavenging founders are favored.
  if(t===2||t===3){adapted.diet=Math.max(.82,adapted.diet);adapted.jaw=Math.max(1.2,adapted.jaw);}
  if(t===1)adapted.wet=Math.max(.83,adapted.wet);
  if(t===2)adapted.dry=Math.max(.86,adapted.dry);
  if(t===3)adapted.rock=Math.max(.86,adapted.rock);
  // Grassland founders are terrestrial, and require nearby access to water.
  adapted.alleles=Object.fromEntries(Object.entries(g.alleles??{}).map(([key,pair])=>[key,[...pair]]));
  for(const key of ['aquatic','wet','dry','rock','diet','jaw'])if(adapted[key]!==g[key])adapted.alleles[key]=[adapted[key],adapted[key]];
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
    const dryFounder=this.terrain(x,y)===2||this.terrain(x,y)===3;
    if(k===0&&(!dryFounder&&g.diet>.28||morphology(g).bodyMass>100||g.eyes<2||!thermalFitness(g,this.temperatureAt(x,y)).reproduction))continue;
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
    let variant=g;
    if(i>0){
     // Founder individuals of one species need not be genetic clones.
     // Keep their functional species, but allow different hidden alleles.
     for(let attempt=0;attempt<8;attempt++){
      const trial=this.adaptFounderToTerrain(this.mutate(g),placedTerrain);
      if(this.category(trial)===key){variant=trial;break;}
     }
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
   if(total>0&&this.runStartTick===null){this.runStartTick=this.tick;this.founderSpeciesCount=this.species.size;}
  this.log('info',founders.length+'種類・'+total+'体の生命を移入');
  return {types:founders.length,individuals:total};
 }
 epidemic(){let n=0;for(const u of this.units)if(this.rand()<.55){this.die(u,'疫病');n++;}this.units=this.units.filter(u=>!u.dead);this.log('info','疫病で'+n+'体が死亡');}
 drought(){
  this.growth=7;this.stress=85;
  for(let i=0;i<this.tiles.length;i++){
   if(this.tiles[i]===1)this.consumeWater((i%NX+.5)*CELL,(Math.floor(i/NX)+.5)*CELL,35);
   if(this.tiles[i]===0)this.consumeGrass((i%NX+.5)*CELL,(Math.floor(i/NX)+.5)*CELL,18);
  }
  this.log('info','干ばつ：水と草が減少した');
 }
 replenishWater(amount){
  let restored=0;
  for(let i=0;i<this.tiles.length;i++){
   if(this.tiles[i]!==1)continue;
   const previous=this.water[i];
   this.water[i]=Math.min(100,Math.max(POND_RESERVE,previous)+amount);
   if(this.water[i]>previous)restored++;
  }
  return restored;
 }
 rain(){
  this.growth=90;this.stress=8;
  this.weather='rain';this.weatherStrength=Math.max(.7,this.rainfall/100);this.weatherUntil=this.tick+150;
  const restored=this.replenishWater(55);
  this.log('info','降雨：'+restored+' マスの恒久水場に水を補給した');
 }
 get runScore(){
   const started=this.runStartTick!==null;
   const duration=started?Math.max(0,(this.runEndedTick??this.tick)-this.runStartTick):0;
   const discoveries=started?Math.max(0,this.species.size-this.founderSpeciesCount):0;
   return {started,ended:this.runEndedTick!==null,duration,discoveries,survivalScore:duration,discoveryScore:discoveries*300,total:duration+discoveries*300};
  }
  get livingSpecies(){return [...this.species.values()].filter(s=>s.current>0).length;}
 get recentSpecies(){return this.discoveries.filter(t=>this.tick-t<300).length;}
}
export const WORLD={width:W,height:H,cell:CELL,columns:NX,rows:NY};
