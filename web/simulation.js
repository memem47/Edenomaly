// Edenomaly simulation: browser-only; no DOM or Canvas dependencies.
import {appendSpeciesBirth,birthDerived} from './species-statistics.js';
import {DNA_KEYS,DNA_LIMITS,canonicalDNA,legacyToDNA,expressDNA,expressAllelePair} from './genome-model.js';
import {linkedOffspring} from './linkage-model.js';
const W=800,H=460,CELL=20,NX=40,NY=23;
export const TERRAIN_NAMES=['草地','水辺','乾燥地','岩場'];
export const TERRAIN_COLORS=['#54c74c','#279cfa','#edb85c','#8980bf'];
// Relative nutrient input: grass > wetland > dryland > rock.
export const TERRAIN_FERTILITY=[1,.58,.14,.055];
export const TERRAIN_LEVEL_NAMES=[['裸地','草地','草原','林','森'],['浅瀬','浅い池','池','深い池','深水域'],['乾いた土','砂地','乾燥地','荒野','砂漠'],['礫地','岩場','丘陵','岩山','高山']];
export const TERRAIN_LEVEL_GROWTH=[.55,.8,1,1.2,1.45];
export const WATER_LEVEL_GROWTH=[1.5,1.3,1,.82,.65];
export const terrainLevelFitness=(base,t,level=3,g={})=>{
 const delta=Math.max(-2,Math.min(2,level-3));
 if(!delta)return base;
 if(t===0)return {...base,move:base.move*(delta>0?1-.15*delta:1+.07*-delta),
  sight:base.sight*(delta>0?1-.13*delta:1),upkeep:base.upkeep+(delta>0?.02*delta:0)};
 if(t===1)return {...base,move:base.move*(delta>0?1-.13*delta:1+.045*-delta),
  sight:base.sight*(delta>0?1-.15*delta:1),
  hazard:base.hazard+(delta>0?delta*.12*(1-Math.max(0,Math.min(1,g.wet??0))):0)};
 if(t===3)return {...base,move:base.move*(delta>0?1-.2*delta:1+.05*-delta),
  upkeep:base.upkeep+(delta>0?.1*delta:0),hazard:base.hazard+(delta>0?.06*delta:0)};
 return {...base,move:base.move*(delta>0?1-.06*delta:1+.03*-delta)};
};
const GROWTH=TERRAIN_FERTILITY,DECAY=[.026,.038,.006,.003];
// Species display names: apparent color + ecological code + dominant ornament.
// Categories remain stable. A species gets its permanent name from the genome
// of its first discovered individual. In particular, a rare intermediate hue
// and paired ornaments remain part of its recorded discovery identity.
const SPECIES_HABITAT=['land','aquatic','dry','rock'];
const HABITAT_NAMES=['ク','ミ','ス','イ'];
const DIET_NAMES=['ソ','ザ','ニ'];
const PIGMENT_CLASSES=['red','yellow','green','blue','purple','pink','white'];
const PIGMENT_NAMES=['レッド','イエロー','グリーン','ブルー','パープル','ピンク','ホワイト'];
const PIGMENT_CODES=['ア','キ','ミ','オ','ム','モ','シ'];
const BODY_CLASSES=['tiny','medium','large','giant'];
const SHAPE_CLASSES=['round','oval','long'];
const STRATEGY_CLASSES=['general','guardian','egg-hunter'];
const THERMAL_CLASSES=['temperate','cold','hot'];
const NAME_SYLLABLES=[...'カキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモラリルレロワヤユ'];
export const speciesNameCode=(body,shape,eyes,strategy,repro,thermal)=>{
 const number=(((((body*3+shape)*4+eyes)*3+strategy)*3+repro)*3+thermal);
 const first=Math.floor(number/37),slot=number%37;
 const second=slot>=first?slot+1:slot;
 return NAME_SYLLABLES[first]+NAME_SYLLABLES[second];
};
// Two extra fields encode visible hue and conspicuous ornaments. Optional
// suffixes support inspection of historical nine-part classification keys.
const SPECIES_CATEGORY_PATTERN=/^(land|aquatic|dry|rock)-(plant|mixed|hunter)-(tiny|medium|large|giant)-(round|oval|long)-(blind|few|several|allround)-(general|guardian|egg-hunter)-(repro[012])-(temperate|cold|hot)-(red|yellow|green|blue|purple|pink|white)(?:-(c_[a-z_]+)-(f_[a-z_]+))?$/;
const NAME_COLORS={
 red:'レッド',yellow:'イエロー',green:'グリーン',blue:'ブルー',
 purple:'パープル',pink:'ピンク',white:'ホワイト',
 red_purple:'レッドパープル',
 red_yellow:'レッドイエロー',red_green:'レッドグリーン',
 red_blue:'レッドブルー',red_pink:'レッドピンク',
 yellow_green:'イエローグリーン',yellow_blue:'イエローブルー',
 yellow_purple:'イエローパープル',yellow_pink:'イエローピンク',
 green_blue:'グリーンブルー',green_purple:'グリーンパープル',
 green_pink:'グリーンピンク',blue_purple:'ブルーパープル',
 blue_pink:'ブルーピンク',purple_pink:'パープルピンク'
};
const NAME_FEATURES={
 normal:'',horn:'ホーン',tail:'テール',antenna:'アンテナ',spot:'スポット',
 horn_tail:'ホーンテール',horn_antenna:'ホーンアンテナ',
 horn_spot:'ホーンスポット',tail_antenna:'テールアンテナ',
 tail_spot:'テールスポット',antenna_spot:'アンテナスポット'
};
// Converting from the display label to a token makes category keys safe for
// logging/CSV and ensures exactly the displayed appearance is classified.
const colorToken=label=>Object.keys(NAME_COLORS).find(k=>NAME_COLORS[k]===label);
const featureToken=label=>Object.keys(NAME_FEATURES).find(k=>NAME_FEATURES[k]===label);
export const speciesAppearanceCategory=g=>{
 const color=colorToken(speciesColorName(g));
 const feature=featureToken(speciesFeatureName(g));
 if(!color||!feature)throw new Error('Unsupported visible phenotype');
 return 'c_'+color+'-f_'+feature;
};
const speciesClassificationParts=key=>{
 const match=SPECIES_CATEGORY_PATTERN.exec(key);
 if(!match)throw new Error('Invalid species classification: '+key);
 return {
  habitat:SPECIES_HABITAT.indexOf(match[1]),
  diet:['plant','mixed','hunter'].indexOf(match[2]),
  body:BODY_CLASSES.indexOf(match[3]),
  shape:SHAPE_CLASSES.indexOf(match[4]),
  eyes:['blind','few','several','allround'].indexOf(match[5]),
  strategy:STRATEGY_CLASSES.indexOf(match[6]),
  repro:['repro0','repro1','repro2'].indexOf(match[7]),
  thermal:THERMAL_CLASSES.indexOf(match[8]),
  pigment:PIGMENT_CLASSES.indexOf(match[9]),
  appearanceColor:match[10]?.slice(2)??null,
  appearanceFeature:match[11]?.slice(2)??null
 };

};
// The biological classification gives a stable readable identifier, including
// color class. This avoids two separate categories collapsing to the same name
// if an individual happens to have a blended color at the class boundary.
export const speciesEcologyCode=key=>{
 const p=speciesClassificationParts(key);
 return DIET_NAMES[p.diet]+HABITAT_NAMES[p.habitat]+
  PIGMENT_CODES[p.pigment]+speciesNameCode(p.body,p.shape,p.eyes,p.strategy,p.repro,p.thermal);
};
// Real rendered hue decides the name, not just the coarse color bin. Most
// names use one English loanword. Rare hues within 7 degrees of two neighboring
// colors get a blended prefix, with "レッドパープル" as a special visually
// recognizable purple-red midpoint (where the coarse class is often pink).
const colorAnchors=[
 {h:0,label:'レッド'}, {h:53,label:'イエロー'},
 {h:125,label:'グリーン'}, {h:210,label:'ブルー'},
 {h:285,label:'パープル'}, {h:328,label:'ピンク'}
];
const hueDistance=(a,b)=>Math.abs((a-b+540)%360-180);
export const speciesColorName=(g,fallback='green')=>{
 if(!g)return PIGMENT_NAMES[Math.max(0,PIGMENT_CLASSES.indexOf(fallback))];
 if(g.albino===1)return 'ホワイト';
 const hue=adaptationColor(g).hue;
 // This pair is uncommon, representing purple with a noticeable red cast.
 if(hue>=310&&hue<=322)return 'レッドパープル';
 const ranked=[...colorAnchors].sort((a,b)=>hueDistance(hue,a.h)-hueDistance(hue,b.h));
 const a=ranked[0],b=ranked[1];
 if(Math.abs(hueDistance(hue,a.h)-hueDistance(hue,b.h))<=7){
  const order=colorAnchors.indexOf(a)<colorAnchors.indexOf(b)?[a,b]:[b,a];
  return order.map(c=>c.label).join('');
 }
 return a.label;
};
// Cosmetic form is a phenotype of functional abilities. Legacy ornament
// loci are retained for old genome compatibility but never drive the drawing.
export const functionalOrnaments=g=>{
 const val=(key,fallback=0)=>clamp(Number(g?.[key]??fallback),0,1);
 const jaw=clamp((Number(g?.jaw??1)-.2)/2.3,0,1);
 return {
  horn:clamp((jaw-.48)*1.37+(val('guard')-.52)*.55,0,1),
  tail:clamp((val('wet')-.48)*.89+(g?.aquatic===1?.28:0)+(val('dispersal')-.52)*.44,0,1),
  antenna:clamp((val('predatorSense')-.54)*1.28+Math.max(0,Number(g?.eyes??2)-3)*.10,0,1),
  pattern:clamp((val('deception')-.53)*1.13+(val('resist')-.65)*.31,0,1)
 };
};
// Separate shape expression from mechanical functional ornaments.
// Cosmetic loci now affect the rendered body and names without silently
// changing speed, HP, upkeep, vision, or camouflage rules in old saves.
export const visibleOrnaments=g=>{
 const genes={horn:'hornLength',tail:'tailLength',antenna:'antennaLength',pattern:'pattern'};
 const base=functionalOrnaments(g);
 return Object.fromEntries(Object.entries(base).map(([key,value])=>{
  const locus=Number(g?.[genes[key]]);
  return [key,Number.isFinite(locus)?
   clamp(.45*value+.55*clamp(locus,0,1),0,1):value];
 }));
};

// A single deterministic phenotype model for renderer, editor and naming.
// All 37 editable loci contribute to distinct visible skin pearls. The larger
// appendages combine ecological traits; no RNG or extra hidden wing genes.
export const phenotypeTraits=g=>{
 const normalize=key=>{
  const [lo,hi]=GENETIC_LOCUS_LIMITS[key];
  return clamp((Number(g?.[key]??lo)-lo)/(hi-lo),0,1);
 };
 const v=Object.fromEntries(Object.keys(GENETIC_LOCUS_LIMITS).map(k=>[k,normalize(k)]));
 const ornaments=visibleOrnaments(g);
 const fins=clamp(.52*v.aquatic+.28*v.wet+.20*v.waterGardening,0,1);
 const horns=clamp(.48*ornaments.horn+.28*v.retaliation+.24*v.guard,0,1);
 const tentacles=clamp((.27*v.antennaLength+.25*v.parentFeeding+.25*v.nestChoice+.23*v.predatorSense-.42)*2.4,0,1);
 const wings=clamp((.30*v.dispersal+.27*v.antennaLength+.23*v.sociability+.20*v.wet-.78)*4,0,1);
 return {
  genes:v,ornaments,fins,horns,tentacles,wings,
  shellPlates:clamp(.38*v.resist+.34*v.shell+.28*v.tempTolerance,0,1),
  eggCrown:clamp(.30*v.brood+.28*v.yolkReserve+.22*v.parentFeeding+.20*v.repro,0,1),
  gills:clamp(.45*v.aquatic+.35*v.wet+.20*v.waterGardening,0,1),
  plume:clamp(.38*v.frugality+.33*v.hibernate+.29*v.longevity,0,1),
  behavior:clamp(.35*v.nesting+.33*v.nestChoice+.32*v.caution,0,1)
 };
};
// Ten-level-like bins produce a compact reproducible genetic tag, while
// the existing species category stays coarse for stable ecological counting.
export const phenotypeSignature=g=>{
 if(!g)return '';
 let h=2166136261;
 for(const [key,[lo,hi]] of Object.entries(GENETIC_LOCUS_LIMITS)){
  const n=clamp((Number(g[key]??lo)-lo)/(hi-lo),0,1);
  const bin=Math.round(n*255);
  for(const byte of [bin,key.length]){
   h=Math.imul(h^byte,16777619)>>>0;
  }
 }
 // Katakana-only imprint keeps the established readable naming format.
 const syllables='アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミ';
 let bits=h,code='';
 for(let i=0;i<7;i++){code=syllables[bits&31]+code;bits=Math.floor(bits/32);}
 return code;
};
export const distinctivePhenotypeNames=g=>{
 const p=phenotypeTraits(g),tags=[];
 if(p.wings>.47)tags.push('ツバサ');
 if(p.tentacles>.49)tags.push('ショクシュ');
 if(p.fins>.45)tags.push('ヒレ');
 if(p.horns>.51)tags.push('ツノ');
 if(p.eggCrown>.66)tags.push('タマゴフサ');
 if(p.shellPlates>.72)tags.push('コウラ');
 return tags.slice(0,3);
};

const ORNAMENT_NAMES=[
 ['hornLength','ホーン'],['tailLength','テール'],
 ['antennaLength','アンテナ'],['pattern','スポット']
];
// Only visible, substantial ornaments affect the name. Genes of the same
// strength are grouped, with horn before tail for "ホーンテール".
export const speciesFeatureName=g=>{
 if(!g)return '';
 const ornaments=visibleOrnaments(g);
 const values=ORNAMENT_NAMES.map(([key,label])=>({key,label,value:ornaments[{hornLength:'horn',tailLength:'tail',antennaLength:'antenna',pattern:'pattern'}[key]]}))
  .sort((a,b)=>b.value-a.value||ORNAMENT_NAMES.findIndex(t=>t[0]===a.key)-ORNAMENT_NAMES.findIndex(t=>t[0]===b.key));
 const best=values[0];
 if(best.value<.12)return '';
 const comparable=values.filter(v=>v.value>=.12&&best.value-v.value<=.065).slice(0,2);
 return comparable.sort((a,b)=>ORNAMENT_NAMES.findIndex(t=>t[0]===a.key)-ORNAMENT_NAMES.findIndex(t=>t[0]===b.key))
  .map(v=>v.label).join('');
};
// A full display name is intentionally not limited to six characters.
export const speciesNameFromCategory=(key,genome=null)=>{
 const parts=speciesClassificationParts(key);
 const color=parts.appearanceColor===null?
  speciesColorName(genome,PIGMENT_CLASSES[parts.pigment]):NAME_COLORS[parts.appearanceColor];
 const feature=parts.appearanceFeature===null?
  speciesFeatureName(genome):NAME_FEATURES[parts.appearanceFeature];
 if(!color||feature===undefined)throw new Error('Unsupported species appearance category: '+key);
 // Names keep the categorical ecological core while distinguishing the
 // actual founder genome and its distinctive appendages.
 const distinctive=genome?distinctivePhenotypeNames(genome).join(''):'';
 const genomeTag=genome?phenotypeSignature(genome):'';
 return [color,speciesEcologyCode(key)+distinctive+genomeTag,feature].filter(Boolean).join('・');
};
// Pigment is a derived phenotype, not an additional independent gene.
export const pigmentClass=g=>{
 if(g.albino===1)return 'white';
 const hue=adaptationColor(g).hue;
 if(hue<15||hue>=345)return 'red';
 if(hue<75)return 'yellow';
 if(hue<165)return 'green';
 if(hue<250)return 'blue';
 if(hue<315)return 'purple';
 return 'pink';
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
// Deep forest buffers both winter frost and summer heat; high rock gives
// summer shade in crevices. These are microclimates, not biome conversions.
export const microclimateTemperature=(ambient,terrain,level=3,season='spring')=>{
 const depth=clamp((level-2)/3,0,1);
 if(terrain===0){
  const buffering=season==='winter'?4.5:season==='summer'?-3.5:0;
  return localTemperature(ambient,terrain)+buffering*depth;
 }
 if(terrain===3&&season==='summer')return localTemperature(ambient,terrain)-2*depth;
 if(terrain===1&&season==='winter')return localTemperature(ambient,terrain)-1.5*depth;
 return localTemperature(ambient,terrain);
};
export const thermalFitness=(g,temp)=>{
 const ideal=clamp(g.idealTemp??22,-5,40),tolerance=clamp(g.tempTolerance??9,3,18);
 const adaptability=clamp(((g.dna?.adaptation??1)-1)/9,0,1);
 // Adaptability absorbs some unexpected conditions without changing
 // genetically preferred temperature or stamina-based thermal tolerance.
 const effectiveTolerance=tolerance+adaptability*4;
 const delta=Math.abs(temp-ideal),comfort=clamp(1-delta/effectiveTolerance,0,1),
  excess=Math.max(0,delta-effectiveTolerance);
 return {ideal,tolerance,comfort,excess,activity:clamp(1.09-.033*delta,.33,1.09),
  upkeep:.035*delta+.095*excess+Math.max(0,tolerance-7)*.045,
  // Broad-tolerance genes reduce the severity of extreme-weather injury.
  // They already incur metabolic upkeep, so this is not a free immunity.
  damage:excess>0?Math.min(2.5,excess*.038*
   (1-.42*clamp((tolerance-8)/10,0,1))):0,
  reproduction:excess<tolerance*.16};
};
// Environmental acclimation is learned, reversible, and never inherited.
export const landAcclimationGain=(u,onLand)=>onLand?
 Math.min(.72,(u.landAcclimation??0)+.0032):
 Math.max(0,(u.landAcclimation??0)-.0016);
// Habitat-specific water economy: arid/rock specialists lose water slowly
// and can replenish a modest amount from rain, without generating free food.
// Seasonal growth remains relative to the user's plant-growth sliders.
export const seasonalPlantGrowth=(season,temperature,terrain,soilWater=50,forestLevel=3)=>{
 const moisture=clamp(soilWater/100,0,1);
 if(season==='winter')return (terrain===1?.13:.045)+(terrain===0?clamp((forestLevel-2)/3,0,1)*.10:0);
 if(season==='spring')return terrain===1?1.5:1.8;
 if(season==='autumn')return terrain===1?.95:.72;
 if(season==='summer'){
  if(terrain===1)return 1.25;
  const heat=clamp((temperature-24)/13,0,1);
  return clamp(1.12-heat*(.33+.64*(1-moisture)),.12,1.15);
 }
 return 1;
};
export const terrestrialHydrationDelta=(g,terrain,weather,level=3,vegetation=0,soilMoisture=0)=>{
 // Dew and plant moisture are local renewable inputs, never a direct HP
 // refill. Dry grass, bare ground and rocks provide almost none.
 const plants=clamp(vegetation/100,0,1),moist=clamp(soilMoisture/100,0,1);
 const leafCover=terrain===0?clamp((level-1)/4,0,1):0;
 const dew=terrain===0?(0.035+0.095*leafCover)*plants*(0.35+0.65*moist):0;
 const adapted=terrain===2?clamp(g.dry??0,0,1):
  terrain===3?clamp(g.rock??0,0,1):0;
 const loss=.24*(1-(terrain===3?.73:.66)*adapted);
 const collected=weather==='rain'?((terrain===2||terrain===3)?(.24+.13*adapted):.08):0;
 return collected+dew-loss;
};
export const experiencedTerrainFitness=(u,t)=>{
 const base=terrainFitness(u.g,t);
 if(u.g.aquatic!==1||t===1)return base;
 const learned=clamp(u.landAcclimation??0,0,.72);
 return {...base,fitness:base.fitness*(.64+.43*learned),
  move:base.move*(.36+.7*learned),
  upkeep:base.upkeep+.33*(1-learned)};
};
export const terrainFitness=(g,t)=>{
 // Traits are inherited; acquired acclimatization is deliberately not simulated.
 const tolerance=[1, g.wet, g.dry, g.rock??.2][t];
 const adaptability=clamp(((g.dna?.adaptation??1)-1)/9,0,1);
 const mismatch=t===0?0:1-clamp(tolerance,0,1);
 const fitness=t===0?1:clamp(.28+.95*tolerance+.28*adaptability*mismatch,.28,1.23);
 const aquatic=g.aquatic===1;
 const passable=t!==1||aquatic;
 const sight=t===1?(aquatic?clamp(.92+g.wet*.34,.92,1.26):.18):t===2?clamp(.52+g.dry*.56,.52,1.08):t===3?clamp(.67+(g.rock??.2)*.43,.67,1.10):1;
 const rawHazard=t===1?(aquatic?0:.7):
   t===2?clamp((.50-g.dry)*1.3,0,.65):
   t===3?clamp((.45-(g.rock??.2))*.28,0,.15):0;
 const hazard=rawHazard*(1-.42*adaptability*mismatch);
 return {fitness,passable,sight,hazard,move:(t===1?(aquatic?.50+g.wet*.26:.035):t===2?.17+g.dry*.42:t===3?.19+(g.rock??.2)*.39:.58),
   upkeep:t===0?0:(1-tolerance)*[0,.38,.51,.52][t]*(1-.35*adaptability)+tolerance*.045};
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
// Acquired carnivory is reversible and never changes inherited diet.
export const carnivoryExperience=u=>clamp(u.carnivoryExperience??0,0,1);
export const effectiveMeatAffinity=u=>{
 const native=dietProfile(u.g).meat;
 return clamp(Math.max(native+(1-native)*carnivoryExperience(u),
  famineCannibalism(u)?.09:0),0,1);
};
export const famineCannibalism=u=>u.energy<46&&u.stage==='adult'&&
 u.g.jaw>=.55&&u.g.mouths>=1&&
 (dietProfile(u.g).meat>.18||carnivoryExperience(u)>.12||u.energy<24);
// Mixed-feeding species retain useful plant digestion when animal protein is
// scarce. The small bonus peaks for 50/50 omnivores and is zero at endpoints.
export const effectivePlantAffinity=u=>{
 const d=dietProfile(u.g).diet;
 return clamp((1-d)*(1+.10*4*d*(1-d))*
  (1-.65*carnivoryExperience(u)),0,1);
};
export const learnCarnivory=(u,consumed)=>{
 if(consumed<=0)return 0;
 const old=carnivoryExperience(u);
 u.carnivoryExperience=clamp(old+Math.min(.035,consumed*.0025),0,.85);
 return u.carnivoryExperience-old;
};
// Most slimes have half-size bodies, while exceptionally rare large-genome
// slimes retain the historical extreme diameter. The tail is not truncated.
export const bodySizeMultiplier=g=>{
 const r=clamp(g.sizeBaseRadius??g.r,3,15);
 const t=clamp((r-10)/5,0,1);
 return 1.7*(.5+.5*t*t);
};
export const pursuitEscapeSpeedFactor=(g,active,energy=100)=>{
 if(!active)return 1;
 const agility=clamp(((g.dna?.agility??5)-1)/9,0,1);
 const sprint=g.dna?.skillSprint===1&&energy>52;
 return (1+.48*agility)*(sprint?1.27:1);
};
export const morphology=g=>{
 const width=g.r*bodySizeMultiplier(g),length=width*g.elongation;
 const bodyMass=width*width*g.elongation;
 const metabolicMass=g.r*g.r*g.elongation;
 const ornaments=functionalOrnaments(g);
 const eyeRange=20+Math.min(g.eyes,3)*14+Math.max(0,g.eyes-3)*7+
  24*ornaments.antenna;
 // Physical shrinking must not make locomotion faster by reducing the mass
 // denominator. Small limbs also cover less ground per simulation step.
 const speed=3.45/(.65+metabolicMass*.017)*(.55+.45*bodySizeMultiplier(g)/1.7)
  *(1-Math.max(0,g.eyes-3)*.055)
  *(1-.07*ornaments.horn-.035*ornaments.antenna)
  *(.80+.40*clamp(g.dispersal??.5,0,1)); // agility increases actual movement speed
 const turnRate=clamp(.29/(.75+g.elongation*.21),.12,.29);
 const mouths=g.mouths;
 const biteReach=width*(.7+.15*mouths)+g.jaw*1.6+1.2*ornaments.horn;
 const edibleRatio=clamp(.60+.055*mouths+.06*g.jaw,.62,.88);
 const predatory=dietProfile(g).meat>.14&&g.jaw>=.55&&mouths>=1;
 const upkeep=.09+metabolicMass*.008+Math.max(0,metabolicMass-110)**1.2*.002+g.eyes*.045+Math.max(0,g.eyes-3)**2*.06+mouths*.03+g.jaw*.02+Math.abs(g.deception-.5)*.035+(g.resist??.4)*.04+ornaments.tail*.13+ornaments.horn*.18+ornaments.antenna*.12+ornaments.pattern*.075+clamp(g.dispersal??.5,0,1)*.06; // speed has metabolic cost
 const foodGain=1+Math.min(.42,(mouths-1)*.13);
 return {width,length,bodyMass,eyeRange,speed,turnRate,biteReach,edibleRatio,predatory,upkeep,foodGain};
};
// Nutrition-derived growth changes physical performance without changing inherited genes.
// A youngster recognizes parents/lineage by identity, not by a misleading
// appearance. Real carnivorous predators remain dangerous even if related.
// A starving organism can risk eating under a distant *apparent* threat,
// but must still escape an actual carnivorous predator or a nearby threat.
export const suppressFearSignal=(u,v,rawDistanceSq,foodWithinReach)=>{
 const actualCarnivore=dietProfile(v.g).meat>.35&&organismMorphology(v).predatory;
 if(actualCarnivore)return false;
 const family=u.stage==='juvenile'&&(u.parent===v.id||u.otherParent===v.id||
  u.lineage===v.lineage);
 if(family)return true;
 if(u.energy<38&&foodWithinReach&&rawDistanceSq>48**2)return true;
 return false;
};
export const organismMorphology=u=>{
 if(stepCache){const cached=stepCache.morph.get(u);if(cached&&cached.scale===(u.growthScale??1))return cached.value;}
 const value=morphology({...u.g,r:u.g.r*(u.growthScale??1),sizeBaseRadius:u.g.r});
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
 // Cubic upkeep previously exceeded maximum possible feeding calories.
 return 1.3*(scale*scale-1);
};
export const feedingCapacity=u=>{
 const scale=Math.max(1,u.growthScale??1);
 return Math.min(3.8,1+1.15*(scale-1));
};
export const energyStorageLimit=u=>210+30*Math.max(0,(u.growthScale??1)-1);
// Efficiency helps only with maintenance, not movement, climate hazards or
// extra energy production. Smaller bodies sacrifice defense and adult growth.
export const metabolicFrugality=g=>clamp(g.frugality??0,0,1);
export const frugalityMaintenanceFactor=g=>1-.48*metabolicFrugality(g);
export const adultGrowthCeiling=g=>MAX_NUTRITION_GROWTH*(1-.62*metabolicFrugality(g));

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
 let density=0,occupied=0; // Body size costs energy separately; crowding measures neighbors.
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
 return {density,habitatLoad:Math.max(0,occupied/112.5-.30)};
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
 let occupied=0; // An isolated giant is not an overcrowded habitat by itself.
 for(const v of neighbors){
  if(v===u||v.dead)continue;
  const d=Math.hypot(v.x-u.x,v.y-u.y);
  if(d>=radius)continue;
  const b=bodyCollisionAxes(v);
  occupied+=b.rx*b.ry*(1-d/radius);
 }
 return Math.max(0,(occupied/112.5-.30));
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
 const scale=lifeStageScale(u)*(u.growthScale??1);
 const ry=Math.max(.85,u.g.r*bodySizeMultiplier(u.g)*scale*1.06);
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
// Age tracks development, never a countdown to death.
// HP depletion is driven by injury, disease, starvation or dehydration.
export const lifeDrain=u=>{
 const energy=Math.max(0,u.energy??100);
 return energy>=65?0:.08+(65-energy)*.025;
};
// Retain the historical genome field for compatibility without aging upkeep.
// Legacy longevity is expressed visually as an inner-body pulse. Aging
// depletion remains disabled: never reintroduce a hidden starvation penalty.
export const longevityUpkeep=()=>0;
export const vitality=u=>{
 const max=u.maxHp??Math.max(25,Math.round(organismMorphology(u).bodyMass*.48+25));
 const health=clamp((u.hp??max)/Math.max(1,max),0,1);
 return {max,health,old:0,vigor:clamp(.40+.60*health,.12,1)};
};
export const rearPosition=(u,offset=0)=>({
 x:clamp(u.x-Math.cos(u.angle)*(u.g.r*u.g.elongation+5+offset),6,W-6),
 y:clamp(u.y-Math.sin(u.angle)*(u.g.r*u.g.elongation+5+offset),6,H-6)
});
// These founders are deterministically derived from existing traits after
// base allele initialization. Keeping the group centralized prevents dead
// branches, duplicate random draws and silent genetic initialization drift.
// Historical field ordering for reading legacy hashes; NOT active DNA.
const LEGACY_GENE_KEYS=['tailLength','hornLength','antennaLength','pattern','repro','idealTemp','tempTolerance','hibernate','longevity','r','elongation','eyes','mouths','jaw','wet','dry','shell','guard','nesting','brood','diet','deception','rock','resist','aquatic','albino','dispersal','sociability','caution','predatorSense','retaliation','frugality','waterGardening','nestChoice','parentFeeding','yolkReserve','juvenileCannibalism'];
// Natural ponds always retain a viable reservoir. Drought reduces excess
// water depth, but only deliberate terrain painting may remove a water tile.
export const POND_RESERVE=35;
// Functional body plan for player-designed lineages. Derived traits are
// recalculated after environmental adaptation, mutation and recombination.
export function deriveFunctionalBody(g){
 if(g.genomeModel===2)return expressDNA(g);
 const n=k=>clamp(g[k]??.5,0,1);
 const diet=n('diet'),sense=n('predatorSense'),guard=n('guard');
 const values={
  r:3+12*Math.pow(.45*diet+.30*n('yolkReserve')+.25*guard,2.7),
  elongation:.85+2.15*Math.pow(.55*n('dispersal')+.30*n('wet')+.15*n('aquatic'),2.4),
  eyes:Math.round(6*(.70*sense+.30*n('caution'))),
  mouths:1+Math.round(3*(.65*diet+.35*n('parentFeeding'))),
  jaw:.2+2.3*(.65*diet+.35*n('retaliation'))
 };
 const out={...g,functionalBody:true,alleles:{...g.alleles}};
 for(const [key,value] of Object.entries(values)){
   if(g.bodyOverrides?.includes(key)&&Number.isFinite(g[key]))continue;
   out[key]=Number(value.toFixed(4));out.alleles[key]=[out[key],out[key]];
 }
 return out;
}
export const genomeCode=g=>(g?.genomeModel===2?DNA_KEYS:LEGACY_GENE_KEYS).map(key=>{
 const [lo,hi]=(g?.genomeModel===2?DNA_LIMITS:LIMITS)[key];
 const v=Number(g?.genomeModel===2?g.dna[key]:g[key]);
 const step=Number.isFinite(v)?Math.round(clamp((v-lo)/(hi-lo),0,1)*15):0;
 return step.toString(16).toUpperCase();
}).join('').match(/.{1,4}/g).join('-');

// The old 37 ranges now describe computed phenotype values only.
export const GENETIC_LOCUS_LIMITS={tailLength:[0,1],hornLength:[0,1],antennaLength:[0,1],pattern:[0,1],repro:[0,2],idealTemp:[-5,40],tempTolerance:[3,18],hibernate:[0,1],longevity:[.6,2],r:[3,15],elongation:[.65,3],eyes:[0,6],mouths:[1,4],jaw:[.2,2.5],wet:[0,1],dry:[0,1],rock:[0,1],shell:[0,1],guard:[0,1],nesting:[0,1],brood:[1,8],diet:[0,1],deception:[0,1],resist:[0,1],aquatic:[0,1],albino:[0,1],dispersal:[0,1],sociability:[0,1],caution:[0,1],predatorSense:[0,1],retaliation:[0,1],frugality:[0,1],waterGardening:[0,1],nestChoice:[0,1],parentFeeding:[0,1],yolkReserve:[0,1],juvenileCannibalism:[0,1]};
const LIMITS=GENETIC_LOCUS_LIMITS;
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
// One decision per predator encounter rather than repeated frame-by-frame
// lotteries. Visible feeding signals retain their camouflage mechanics.
export const threatFlightProbability=(u,v)=>{
 const display=dietProfile(v.g).signal;
 if(display<.48)return 0;
 const caution=clamp(u.g.caution??.45,0,1);
 const sense=clamp(u.g.predatorSense??.45,0,1);
 const signal=clamp((display-.48)/.52,0,1);
 const carnivore=clamp((dietProfile(v.g).meat-.35)/.65,0,1);
 return clamp(caution*(.08+.67*sense*signal+.23*carnivore),0,.98);
};
export const retaliationProbability=(prey,attacker)=>{
 const resolve=clamp(prey.g.retaliation??.35,0,1);
 const ratio=organismMorphology(prey).bodyMass/Math.max(1,organismMorphology(attacker).bodyMass);
 return clamp(resolve*clamp(ratio,.25,1.5)*vitality(prey).vigor,0,.95);
};
// Shelter changes detection, not invulnerability.
// Visible spots/stripes blend into the habitat only when pigment reflects
// local adaptation. On unsuitable terrain the pattern costs energy without
// providing stealth; predators retain the ability to detect approaching prey.
export const camouflageFactor=(g,terrain)=>{
 const pattern=functionalOrnaments(g).pattern;
 const affinity=terrain===1?clamp(g.wet??0,0,1):terrain===2?clamp(g.dry??0,0,1):
  terrain===3?clamp(g.rock??0,0,1):clamp(1-Math.max(g.wet??0,g.dry??0,g.rock??0)*.5,0,1);
 return 1-.34*pattern*affinity;
};
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
 terrainLevel(x,y){return this.terrainLevels?.[this.cell(x,y)]??3;}
 gene(){
  // Only canonical DNA is sampled. The 37 ecology/morphology values are
  // expressed deterministically and are NOT separately inherited.
  const roll=(lo,hi)=>Math.round(this.range(lo,hi));
  const coldHot=this.rand();
  const thermal=coldHot<.075?this.range(.05,.36):
   coldHot<.15?this.range(.79,.96):this.range(.45,.73);
  const aquatic=this.rand()<.21?1:0,biome=aquatic?1:
   this.rand()<.15?2:this.rand()<.12?3:0;
  const dna={
   power:roll(2,7),agility:this.rand()<.04?roll(8,10):roll(3,7),stamina:roll(3,8),
   intellect:this.rand()<.045?roll(8,10):roll(2,7),adaptation:roll(3,8),fertility:roll(3,7),
   diet:this.rand()<.85?this.range(0,.32):this.range(.38,.93),
   aquatic,repro:(()=>{const r=this.rand();return r<.004?1:r<.006?2:0;})(),
   biome,thermal,social:this.range(.25,.8),albino:this.rand()<.0015?1:0,
   skillWaterGardening:this.rand()<.045?1:0,
   skillHibernate:this.rand()<.09?1:0,
   skillParentFeeding:this.rand()<.065?1:0,
   skillNestChoice:this.rand()<.07?1:0,
   skillRetaliation:this.rand()<.10?1:0,
   skillCannibalism:this.rand()<.018?1:0,
   skillSprint:this.rand()<.045?1:0,
   skillAmbush:this.rand()<.028?1:0,
   skillRegenerate:this.rand()<.038?1:0,
   skillPredation:this.rand()<.05?1:0,
   skillNesting:this.rand()<.045?1:0,
   skillCooperate:this.rand()<.055?1:0,
   skillAbsorb:this.rand()<.045?1:0,
   skillSplit:this.rand()<.018?1:0
  };
  // Rare physically large founder is a correlated stat/strategy package,
  // not a hidden independently inherited radius gene.
  if(this.rand()<.006){dna.power=10;dna.fertility=9;dna.diet=Math.max(.79,dna.diet);}
  // Two alleles per canonical locus. Derived morphology is recomputed from
  // the expressed DNA, so neither random shape nor old cached DNA survives.
  const alleles=Object.fromEntries(DNA_KEYS.map(key=>[key,[dna[key],dna[key]]]));
  return expressDNA({dna,alleles});
 }
 mutate(g){
  if(g.genomeModel!==2)return this.mutateLegacy(g);
  const dna=canonicalDNA(g),alleles={};
  for(const key of DNA_KEYS)alleles[key]=[...(g.alleles?.[key]??[dna[key],dna[key]])];
  const count=1+(this.rand()<.22?1:0)+(this.rand()<.06?1:0);
  for(let n=0;n<count;n++){
   const key=DNA_KEYS[Math.floor(this.rand()*DNA_KEYS.length)];
   const index=this.rand()<.5?0:1;
   const [lo,hi]=DNA_LIMITS[key];
   let value=alleles[key][index];
   if(key.startsWith('skill')){if(this.rand()<.16)value=1-value;else continue;}
   else if(['aquatic','albino'].includes(key)){if(this.rand()<.06)value=1-value;else continue;}
   else if(['repro','biome'].includes(key)){if(this.rand()<.15)value=Math.floor(this.range(lo,hi+1));else continue;}
   else if(['power','agility','stamina','intellect','adaptation','fertility'].includes(key))value+=this.rand()<.5?-1:1;
   else value+=this.range(-.17,.17);
   alleles[key][index]=clamp(value,lo,hi);
  }
  const next={};
  for(const key of DNA_KEYS){
   const pair=alleles[key];
   next[key]=this.expressGeneticPair(key,pair);
  }
  return expressDNA({dna:next,alleles});
 }
 expressGeneticPair(key,pair){
  return expressAllelePair(key,pair);
 }
 recombine(a,b){
  if(a.genomeModel!==2||b.genomeModel!==2)return this.recombineLegacy(a,b);
  // Each parent forms one gamete per chromosome, with occasional crossovers.
  // The first allele in each child pair is maternal, the second paternal.
  const {dna,alleles}=linkedOffspring(a,b,()=>this.rand());
  const child=expressDNA({dna,alleles});
  return this.rand()<.32?this.mutate(child):child;
 }
 // Compatibility for experiments explicitly supplying a pre-migration genome.
 mutateLegacy(g){
  const dna=legacyToDNA(g),next=this.mutate(expressDNA({dna}));
  return next;
 }
 recombineLegacy(a,b){
  return this.recombine(expressDNA({dna:legacyToDNA(a)}),expressDNA({dna:legacyToDNA(b)}));
 }
 category(g){
  // A species represents a recognizable ecological/morphological strategy.
  // Coarsely categorized pigment is included because players can see color.
  // Visible color/ornament bins are included; minor changes inside a bin do not make a new species.
  const m=morphology(g),d=dietProfile(g).diet;
  const diet=d<.32?'plant':d>.70?'hunter':'mixed';
  const body=m.bodyMass<45?'tiny':m.bodyMass<105?'medium':m.bodyMass<195?'large':'giant';
  const eyes=g.eyes===0?'blind':g.eyes<=2?'few':g.eyes<=4?'several':'allround';
  const shape=g.elongation<1.38?'round':g.elongation<2.25?'oval':'long';
  const strategy=protectiveDrive(g)>.52?'guardian':eggPredationDrive(g)>.62?'egg-hunter':'general';
  // Habitat is a functional trait, not just a difference in appearance.
  const habitat=g.aquatic===1?'aquatic':g.dry>=.70&&g.dry>g.rock+.10?'dry':g.rock>=.70&&g.rock>g.dry+.10?'rock':'land';
  const thermal=g.idealTemp<12?'cold':g.idealTemp>31?'hot':'temperate';
   return [habitat,diet,body,shape,eyes,strategy,'repro'+reproductiveMode(g),thermal,pigmentClass(g),speciesAppearanceCategory(g)].join('-');
 }
 name(category,genome=null){return speciesNameFromCategory(category,genome??this.species.get(category)?.genome??null);}
 addVisualEffect(type,point,extra={}){
  // Visual effects must never change simulation RNG or ecology. Avoid flooding
  // the renderer with dozens of repeated feeding and drinking events per step.
  if(this.headless||!point||this.effects.length>=140)return false;
  this.effects.push({type,x:point.x,y:point.y,age:0,...extra});
  return true;
 }
 log(type,message,point){
  if(this.headless){
   this.headlessEventCounts??={};
   this.headlessEventCounts[type]=(this.headlessEventCounts[type]??0)+1;
   return;
  }
  this.logs.unshift({type,message,step:this.tick});
  if(this.logs.length>4000)this.logs.pop();
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

 // Store the actual parental genome at conception, rather than relying on
 // a species average or finding a potentially deceased parent after hatching.
 parentSnapshot(u){
  if(!u?.g)return null;
  return {id:u.id,category:u.category??this.category(u.g),name:this.name(u.category??this.category(u.g),u.g),
   genome:{...u.g,alleles:Object.fromEntries(Object.entries(u.g.alleles??{}).map(([k,p])=>[k,[...p]]))}};
 }
 spawn(x,y,g,parent=null){
  // Safety guard only: far above the intended ecological carrying capacity.
  if(this.units.length>=2000)return null;
  const mode=reproductiveMode(g);
   const sex=mode===1?'H':mode===2?'F':(this.rand()<.5?'F':'M');
   const u={sex,id:this.nextId++,x:clamp(x,10,W-10),y:clamp(y,10,H-10),angle:this.range(0,Math.PI*2),g,energy:parent?58:this.range(64,86),age:0,generation:parent?parent.generation+1:0,parent:parent?.id??null,otherParent:parent?.otherParent??null,dead:false,bite:0,stage:parent?'juvenile':'adult',hp:Math.max(25,Math.round(morphology(g).bodyMass*.48+25)),maxHp:Math.max(25,Math.round(morphology(g).bodyMass*.48+25)),woundFlash:0,attackFlash:0,defendFlash:0,mateCooldown:0,courtPartner:null,pregnancy:null,lineage:parent?.lineage??null,infection:0,hydration:100,seedBank:0,growthScale:1,juvenileGrowth:parent?0:1,juvenileFood:0,recentFood:0,dormant:false,forageSuccess:0,forageFailure:0,stranded:0,submerged:0,lastTerrain:this.terrain(x,y),migrations:0,refugeTarget:null,socialTarget:null,mateTarget:null,rejectedBy:null,mateApproachFailures:0,behaviorTarget:'idle',waterSeedBank:0,lastWaterPlant:-100,landAcclimation:0,carnivoryExperience:0,landExcursion:false,shoreTarget:null,threatDecisions:new Map(),attackResponse:null,retaliationCooldown:0,isolatedSteps:0,lastEmergencySplit:-100000,bornTick:this.tick,hpLoss:{natural:0,temperature:0,terrain:0,starvation:0,juvenile:0,infection:0,combat:0}};
  u.category=this.category(g);u.lineage??=u.id;this.units.push(u);
  if(!this.species.has(u.category)){
   const n=this.species.size+1;this.species.set(u.category,{n,name:this.name(u.category,g),current:0,total:0,diet:dietProfile(g).label,first:this.tick,parents:(parent?.parents??[this.parentSnapshot(parent)]).filter(Boolean),parentCategories:[...new Set((parent?.parents??[this.parentSnapshot(parent)]).filter(Boolean).map(p=>p.category??(p.genome?this.category(p.genome):null)).filter(c=>c&&c!==u.category))],genome:{...g,alleles:Object.fromEntries(Object.entries(g.alleles??{}).map(([key,pair])=>[key,[...pair]]))}});this.discoveries.push(this.tick);this.log('new','新しい形態：'+this.name(u.category,g),u);
  }
  const s=this.species.get(u.category);s.current++;s.total++;
  s.firstGeneration??=u.generation;
  s.maxGeneration=Math.max(s.maxGeneration??u.generation,u.generation);
  s.peakCurrent=Math.max(s.peakCurrent??0,s.current);
  s.establishedByGeneration=(s.maxGeneration-s.firstGeneration>=2);
  s.establishedByPopulation=(s.peakCurrent>=12);
  appendSpeciesBirth(this.speciesSamples,u.category,g,birthDerived(g,morphology(g)));
  this.log('birth','#'+u.id+' '+(u.stage==='juvenile'?'孵化':'移入')+'（'+s.name+' / 第'+u.generation+'世代）',u);
  return u;
 }
 // Rescue demands abundant food and an isolated surviving lineage.
 // Skill: share reserves with a starving member of the same lineage.
 // Equal or lower-value transfers cannot create energy from nothing.
 shareFoodWithAlly(u,near){
  if(u.g.dna?.skillCooperate!==1||u.stage!=='adult'||u.energy<128||
     (this.tick+u.id)%24!==0)return false;
  const ally=near.filter(v=>v!==u&&!v.dead&&v.lineage===u.lineage&&
   v.energy<65&&distance(u,v)<36**2).sort((a,b)=>a.energy-b.energy)[0];
  if(!ally)return false;
  const supplied=Math.min(9,65-ally.energy,(u.energy-110)*.70);
  if(supplied<=0)return false;
  u.energy-=supplied*1.20;
  ally.energy+=supplied;
  if(ally.stage==='juvenile')ally.juvenileFood=(ally.juvenileFood??0)+supplied*.3;
  this.log('feed','#'+u.id+' が仲間 #'+ally.id+' に栄養を分配',ally);
  return true;
 }
 // Unlike the last-survivor emergency split, skill division can act in a
 // healthy colony, but only rarely with surplus resources and low crowding.
 canSkillSplit(u,near=[]){
  if(u?.g?.dna?.skillSplit!==1||u.dead||u.stage!=='adult'||u.dormant||
    u.pregnancy||u.courtPartner||u.infection>0||u.age<120||
    u.energy<165||u.hydration<72||u.hp<u.maxHp*.8||
    this.tick-(u.lastSkillSplit??-100000)<640||this.units.length>=1600)return false;
  if(near.filter(v=>!v.dead&&v!==u&&distance(u,v)<65**2).length>=6)return false;
  return thermalFitness(u.g,this.temperatureAt(u.x,u.y)).reproduction;
 }
 skillSplit(u){
  if(!this.canSkillSplit(u))return null;
  const genome=this.rand()<.035?this.mutate(u.g):u.g;
  const child=this.spawn(clamp(u.x+this.range(-13,13),10,W-10),
   clamp(u.y+this.range(-13,13),10,H-10),genome,u);
  if(!child)return null;
  child.energy=40;child.hydration=75;
  child.hp=child.maxHp*.8;
  u.energy-=110;u.hydration-=14;u.hp*=.83;
  u.lastSkillSplit=this.tick;u.mateCooldown=Math.max(u.mateCooldown,180);
  child.lastSkillSplit=this.tick;
  this.log('split','#'+u.id+' が分裂スキルで #'+child.id+' を生み出した',u);
  this.addVisualEffect('birth',u);
  return child;
 }
 canEmergencySplit(u){
  if(!u||u.dead||u.stage!=='adult'||u.dormant||u.pregnancy||u.courtPartner||
     (u.infection??0)>0||u.energy<145||u.hydration<70||
     u.hp<u.maxHp*.65||u.age<110||(u.isolatedSteps??0)<180||
     this.tick-(u.lastEmergencySplit??-100000)<480||
     thermalFitness(u.g,this.temperatureAt(u.x,u.y)).excess>1||
     this.units.length>=2000)return false;
  if(this.units.some(v=>v!==u&&!v.dead&&v.lineage===u.lineage))return false;
  if(this.eggs.some(e=>!e.dead&&e.lineage===u.lineage))return false;
  return true;
 }
 emergencySplit(u){
  if(!this.canEmergencySplit(u))return null;
  const genome=this.rand()<.035?this.mutate(u.g):u.g;
  const child=this.spawn(clamp(u.x+this.range(-10,10),10,W-10),
   clamp(u.y+this.range(-10,10),10,H-10),genome,u);
  if(!child)return null;
  if(reproductiveMode(genome)===0)child.sex=u.sex==='F'?'M':'F';
  child.energy=42;
  child.hydration=Math.max(50,u.hydration-10);
  child.hp=child.maxHp*.90;
  u.energy-=105;
  u.hydration=Math.max(0,u.hydration-12);
  u.hp*=.86;
  u.age=Math.floor(u.age*.62);
  u.mateCooldown=Math.max(u.mateCooldown,110);
  u.lastEmergencySplit=this.tick;
  u.isolatedSteps=0;
  child.lastEmergencySplit=this.tick;
  this.log('split','#'+u.id+' が孤立状態から分裂して #'+child.id+' が誕生（親は若返った）',u);
  this.addVisualEffect('birth',u);
  return child;
 }
 vitalDeathCause(u){
  if(u.lastHpLossSource==='combat')return '捕食・攻撃';
  if(u.lastHpLossSource==='infection'||u.infection>0)return '感染症';
  if(u.lastHpLossSource==='dehydration'||u.hydration<=12)return '脱水・水分不足';
  return '飢餓・栄養不足';
 }
 updateVitalHealth(u){
  u.energy=Math.max(0,u.energy);
  u.hydration=Math.max(0,u.hydration);
  this.applyHpLoss(u,'starvation',lifeDrain(u));
  if(u.hydration<40)this.applyHpLoss(u,'dehydration',.04+(40-u.hydration)*.045);
  if((u.lastHpDamageTick??-1)!==this.tick&&u.energy>=90&&
     u.hydration>=45&&u.infection<=0&&u.hp>0&&u.hp<u.maxHp){
   const regeneration=u.g.dna?.skillRegenerate===1?1:0;
   const recovery=Math.min(u.maxHp-u.hp,(.09+Math.min(.25,(u.energy-90)*.003))*(regeneration?2.25:1),
    Math.max(0,(u.energy-75)/(regeneration?3:2)));
   u.hp+=recovery;
   u.energy-=recovery*2;
   u.hpRecovered=(u.hpRecovered??0)+recovery;
  }
 }
 applyHpLoss(u,source,amount){
  if(!(amount>0))return;
  u.hpLoss??={};
  u.hpLoss[source]=(u.hpLoss[source]??0)+amount;
  u.hp-=amount;
  u.lastHpDamageTick=this.tick;
  u.lastHpLossSource=source;
 }
 nearbyFoodEstimate(u,radius=75){
  // Diagnostics only: edible biomass in nearby passable cells.
  // This is an upper bound, not a navigable-route guarantee.
  const cx=Math.floor(u.x/CELL),cy=Math.floor(u.y/CELL),reach=Math.ceil(radius/CELL);
  const plant=dietProfile(u.g).plant;
  if(plant<=0)return 0;
  let total=0;
  for(let yy=Math.max(0,cy-reach);yy<=Math.min(NY-1,cy+reach);yy++)
   for(let xx=Math.max(0,cx-reach);xx<=Math.min(NX-1,cx+reach);xx++){
    const px=(xx+.5)*CELL,py=(yy+.5)*CELL;
    if((px-u.x)**2+(py-u.y)**2>radius*radius)continue;
    const i=yy*NX+xx,t=this.tiles[i];
    if(!terrainFitness(u.g,t).passable)continue;
    const biomass=t===1?(u.g.aquatic===1?this.waterweed[i]:0):this.grass[i];
    total+=Math.max(0,biomass)*plant;
   }
  return Math.round(total*10)/10;
 }
 die(u,cause,consumed=0){
  if(u.dead)return;
  u.dead=true;u.courtPartner=null;this.species.get(u.category).current--;
  this.deathCauses[cause]=(this.deathCauses[cause]??0)+1;
  this.deathRecords??=[];
  const losses=u.hpLoss??{};
  const dominant=Object.entries(losses).sort((a,b)=>b[1]-a[1])[0];
  const detail={step:this.tick,id:u.id,parent:u.parent,lineage:u.lineage,
   generation:u.generation,stage:u.stage,age:u.age,stepsAlive:this.tick-(u.bornTick??this.tick),
   cause,energy:+u.energy.toFixed(2),hydration:+u.hydration.toFixed(2),
   hp:+u.hp.toFixed(2),maxHp:u.maxHp,terrain:TERRAIN_NAMES[this.terrain(u.x,u.y)],
   foodSuccess:u.forageSuccess,foodFailure:u.forageFailure,
    nearbyEdibleFood:this.nearbyFoodEstimate(u),
   diagnosticCause:(u.infection>0||u.lastHpLossSource==='infection')?'感染':
    (u.hydration<25||u.lastHpLossSource==='dehydration')?'脱水':
    (u.forageFailure>Math.max(5,u.forageSuccess*2))?'採食失敗・食料探索':
    ((u.habitatLoad??0)>.65)?'局所過密':
    (u.energy<60)?'摂取エネルギー不足':'複合的な衰弱',
   totalHpRecovered:+(u.hpRecovered??0).toFixed(2),dominantHpLoss:dominant?.[0]??'不明',...Object.fromEntries(Object.entries(losses).map(([k,v])=>['hpLoss_'+k,+v.toFixed(2)]))};
  this.deathRecords.push(detail);
  if(this.deathRecords.length>10000)this.deathRecords.shift();
  const mass=Math.max(8,organismMorphology(u).bodyMass*1.2+Math.max(0,u.energy)*.4-consumed);
  this.corpses.push({x:u.x,y:u.y,angle:u.angle,g:{...u.g},growthScale:u.growthScale??1,stage:u.stage,deathAge:u.age,mass,initialMass:mass,reserve:0,age:0,cause,seedBank:u.seedBank??0,seedPlanted:false});
  this.log('death','#'+u.id+' 死亡：'+cause+
   ' [段階 '+u.stage+', 生存 '+detail.stepsAlive+'step, 栄養 '+detail.energy+
   ', HP '+detail.hp+'/'+detail.maxHp+', 水分 '+detail.hydration+
   ', 摂食成功 '+detail.foodSuccess+', 摂食失敗 '+detail.foodFailure+
   ', 主HP損失 '+detail.dominantHpLoss+']',u);
  if(this.species.get(u.category).current===0)this.log('info',this.species.get(u.category).name+' が絶滅');
 }
 nurseryFoodAt(x,y,g){
  const i=this.cell(x,y),aquatic=g.aquatic===1;
  if(aquatic)return this.tiles[i]===1&&this.water[i]>=12?
   clamp((this.waterweed[i]??0)/85,0,1):0;
  if(this.tiles[i]===1)return 0;
  return clamp((this.grass[i]??0)/(this.tiles[i]===0?65:this.tiles[i]===3?23:90),0,1);
 }
 chooseNest(u){
  const skill=clamp(u.g.nestChoice??u.g.nesting??0,0,1);
  const radius=20+skill*90;
  let best={x:u.x,y:u.y},bestScore=-Infinity;
  const candidates=[{x:u.x,y:u.y}];
  for(let k=0;k<12;k++)candidates.push({
   x:clamp(u.x+this.range(-radius,radius),10,W-10),
   y:clamp(u.y+this.range(-radius,radius),10,H-10)});
  for(const site of candidates){
   const t=this.terrain(site.x,site.y);
   if(!terrainFitness(u.g,t).passable||
      (u.g.aquatic===1&&t!==1)||(u.g.aquatic!==1&&t===1))continue;
   const food=this.nurseryFoodAt(site.x,site.y,u.g);
   let threat=0,crowd=0;
   for(const v of this.units){
    if(v===u||v.dead||distance(site,v)>75**2)continue;
    if(organismMorphology(v).predatory&&v.lineage!==u.lineage)threat++;
    if(distance(site,v)<40**2)crowd++;
   }
   const d=Math.sqrt(distance(u,site));
   const thermal=thermalFitness(u.g,this.temperatureAt(site.x,site.y));
   const score=food*(.4+skill*3)+terrainFitness(u.g,t).fitness*.5+
    (t===0?.18:0)-thermal.excess*.18-threat*(.42+skill*.7)-
    crowd*skill*.10-d*(.022-skill*.014);
   if(score>bestScore){bestScore=score;best={x:site.x,y:site.y};}
  }
  return best;
 }
 feedOffspring(parent,near){
  const trait=clamp(parent.g.parentFeeding??0,0,1);
  if(parent.stage!=='adult'||parent.dead||parent.energy<105||
     trait<.35||this.tick%12!==parent.id%12)return null;
  const offspring=near.filter(v=>v!==parent&&!v.dead&&v.stage==='juvenile'&&
   (v.parent===parent.id||v.otherParent===parent.id)&&v.energy<78&&
   distance(parent,v)<(16+trait*29)**2);
  if(!offspring.length)return null;
  offspring.sort((a,b)=>a.energy-b.energy);
  const child=offspring[0];
  const transfer=Math.min(5+trait*9,78-child.energy,(parent.energy-85)*.68);
  if(transfer<=0)return null;
  const cost=transfer/(.66+.17*trait);
  parent.energy-=cost;child.energy+=transfer;
  child.juvenileFood=(child.juvenileFood??0)+transfer*.45;
  parent.parentalCalories=(parent.parentalCalories??0)+cost;
  child.receivedParentFood=(child.receivedParentFood??0)+transfer;
  this.log('feed','#'+parent.id+' が幼体 #'+child.id+' に '+transfer.toFixed(1)+' 栄養を分け与えた',child);
  return child;
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
  const compatible=v=>v&&v!==u&&
   !(u.rejectedBy?.id===v.id&&u.rejectedBy.until>this.tick)&&this.canMate(u,v)&&
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
  // Readiness is necessary but does not guarantee consent to courtship.
  // Energy reserve, crowding and hereditary sociability affect willingness.
  const required=68+Math.max(0,organismMorphology(b).bodyMass-100)*.22+
   (b.crowdStress??0)*3.1+(b.habitatLoad??0)*4.2;
  const willingness=required+12+(1-clamp(b.g.sociability??.45,0,1))*20+
   Math.max(0,b.crowdStress??0)*3;
  if(b.energy<willingness){
   a.rejectedBy={id:b.id,until:this.tick+90};
   a.mateTarget=null;
   this.log('courtReject','#'+b.id+' が #'+a.id+' の求愛を拒絶（繁殖余力不足）',b);
   return false;
  }
  a.rejectedBy=null;
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
  const pregnancy={genomes,parents:[this.parentSnapshot(parent),this.parentSnapshot(partner)],parent:parent.id,otherParent:partner.id,lineage:this.rand()<.5?parent.lineage:partner.lineage,generation:Math.max(parent.generation,partner.generation)+1,remaining:25,total:25};
  pregnancy.nestGoal=this.chooseNest(parent);
  if((parent.g.nestChoice??0)>.5&&distance(parent,pregnancy.nestGoal)>20**2)
   this.log('nest','#'+parent.id+' が子のための産卵場所を探し始めた',parent);
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
  const pregnancy={genomes,parents:[this.parentSnapshot(parent)],parent:parent.id,otherParent:null,lineage:parent.lineage,generation:parent.generation+1,remaining:32,total:32};
  pregnancy.nestGoal=this.chooseNest(parent);
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
  const invest=clamp(parent.g.yolkReserve??0,0,1);
  const yolkPerEgg=Math.min(16*invest,Math.max(0,(parent.energy-35)/Math.max(1,count)));
  parent.energy-=yolkPerEgg*count;
  if(count===0)return null;
  const laid=[];
  for(let i=0;i<count;i++){
   const g=p.genomes[i],traits=eggTraits(g);
   const rear=rearPosition(parent,3+i*.65);
   const egg={id:this.nextId++,x:clamp(rear.x+Math.cos(parent.angle+Math.PI/2)*this.range(-3,3),6,W-6),y:clamp(rear.y+Math.sin(parent.angle+Math.PI/2)*this.range(-6,6),6,H-6),g,parents:p.parents??[this.parentSnapshot(parent)],parent:p.parent,otherParent:p.otherParent,generation:p.generation,lineage:p.lineage,age:0,hatchAt:traits.incubation,energy:traits.eggEnergy+yolkPerEgg*.84,dead:false,bornTick:this.tick,birthX:parent.x-Math.cos(parent.angle)*(parent.g.r*parent.g.elongation+2),birthY:parent.y-Math.sin(parent.angle)*(parent.g.r*parent.g.elongation+2)};
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
   if(parent.g.dna?.skillNesting===1&&parent.energy>=42){
    egg.nestProtection=true;
    egg.energy+=2.5;
    parent.energy-=4;
   }
   laid.push(egg);this.eggs.push(egg);
  }
  parent.pregnancy=null;
  this.log('egg','#'+parent.id+' が '+laid.length+' 個の卵を産んだ（'+(p.otherParent===null?'単為生殖':'相手 #'+p.otherParent)+'、卵黄投資 '+(yolkPerEgg*count).toFixed(1)+'）',parent);
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
  if(this.supportZones.some(z=>z.kind==='nursery'&&z.until>this.tick&&(z.x-egg.x)**2+(z.y-egg.y)**2<=55**2)&&this.rand()<.75)return false;
  if(egg.nestProtection&&this.rand()<.42)return false;
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
  if(hunter===prey||hunter.dead||prey.dead||hunter.bite>0||(!defensive&&effectiveMeatAffinity(hunter)<=0)||(defensive===true&&protectiveDrive(hunter.g)<=.34))return false;
  const mm=organismMorphology(hunter),v=vitality(hunter),def=vitality(prey);
  const predatoryAttack=!defensive&&effectiveMeatAffinity(hunter)>0;
  const power=clamp(((hunter.g.dna?.power??5)-1)/9,0,1);
  const surprise=predatoryAttack&&hunter.g.dna?.skillAmbush===1&&
   (prey.attackResponse?.id!==hunter.id)&&(prey.bite??0)===0?1.28:1;
  const predation=predatoryAttack&&hunter.g.dna?.skillPredation===1?1.16:1;
  const damage=Math.max(2,(4+hunter.g.jaw*7+mm.bodyMass*.065+
   3.2*clamp(hunter.g.hornLength??0,0,1))*(defensive==='rival'?.42:defensive==='retaliation'?.72:defensive?.65+protectiveDrive(hunter.g)*.65:effectiveMeatAffinity(hunter))*
   v.vigor*(predatoryAttack?(.80+.65*power)*surprise*predation:1));
  const vulnerable=(1+.8*metabolicFrugality(prey.g))*
   (1-.16*clamp(prey.g.hornLength??0,0,1));
  const actualDamage=damage*vulnerable;
  this.applyHpLoss(prey,'combat',actualDamage);
  prey.hp=Math.max(0,prey.hp);
  if(defensive){hunter.energy-=defensive==='rival'?4:2.5;if(defensive!=='retaliation')prey.bite=Math.max(prey.bite,14);}
  // Retaliation choice is made on impact, and has a limited validity window.
  // Cooldown prevents unbounded retaliation loops.
  const retaliate=(prey.retaliationCooldown??0)<=this.tick&&
   this.rand()<retaliationProbability(prey,hunter);
  prey.attackResponse={id:hunter.id,retaliate,until:this.tick+45};
  prey.woundFlash=14;
  hunter.bite=22;
  hunter.attackFlash=16;
  if(defensive===true||defensive==='retaliation')hunter.defendFlash=16;
  this.addVisualEffect(defensive==='rival'?'rivalStrike':'strike',prey,{fromX:hunter.x,fromY:hunter.y});
  this.log(defensive==='rival'?'rival':defensive?'defend':'attack','#'+hunter.id+(defensive==='rival'?' が同性の #':defensive==='retaliation'?' が反撃して #':defensive?' が卵を守って #':' が #')+prey.id+' に '+Math.round(actualDamage)+' ダメージ',prey);
  if(prey.hp<=0){
   // A large prey supplies an exceptional meal, but the eaten tissue is
   // removed from the corpse so nutrients are never counted twice.
   const meat=defensive===true||defensive==='retaliation'?0:effectiveMeatAffinity(hunter)*(defensive==='rival'?.65:1);
   const tissue=Math.max(4,organismMorphology(prey).bodyMass*.23);
   const gained=(Math.max(5,prey.energy*.35)+tissue)*meat*
    (hunter.g.dna?.skillPredation===1?1.12:1);
   hunter.energy+=gained;
   if(meat>0){
    const old=carnivoryExperience(hunter);learnCarnivory(hunter,tissue);
    if(prey.category===hunter.category||prey.lineage===hunter.lineage){this.cannibalMeals=(this.cannibalMeals??0)+1;
     this.log('cannibal','#'+hunter.id+' が同種 #'+prey.id+' を共食いした',hunter);}
    if(old<.25&&carnivoryExperience(hunter)>=.25)
     this.log('carnivoreLearn','#'+hunter.id+' が肉の摂取に順化し始めた',hunter);
   }
   if(hunter.stage==='juvenile')hunter.juvenileFood=(hunter.juvenileFood??0)+gained;
   hunter.recentFood=(hunter.recentFood??0)+tissue*meat*1.3;
   this.die(prey,defensive==='rival'?'同性間の争い':defensive==='retaliation'?'反撃':defensive?'防衛':'捕食',tissue*meat);
   this.addVisualEffect('consume',prey);
   if(meat>0)this.log('pred','#'+hunter.id+' が #'+prey.id+' を捕食',prey);
  }
  return true;
 }
 // Aquatic gardeners carry viable propagules to depleted reachable beds.
 // The propagules originate from eaten waterweed, and planting costs energy.
 plantWaterweed(u){
  if(u.g.aquatic!==1||this.terrain(u.x,u.y)!==1||
     (u.g.waterGardening??0)<.4||(u.waterSeedBank??0)<1||
     u.energy<52||this.tick-(u.lastWaterPlant??-100)<45)return false;
  const home=this.cell(u.x,u.y),regions=this.waterRegions(),region=regions[home];
  if(!region)return false;
  const cx=home%NX,cy=Math.floor(home/NX);
  let best=-1,biomass=Infinity;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   const x=cx+dx,y=cy+dy;
   if(x<0||y<0||x>=NX||y>=NY||dx*dx+dy*dy>4)continue;
   const i=y*NX+x;
   if(this.tiles[i]!==1||this.water[i]<POND_RESERVE||
      regions[i]!==region||this.waterweed[i]>8)continue;
   if(this.waterweed[i]<biomass){best=i;biomass=this.waterweed[i];}
  }
  if(best<0)return false;
  const seed=Math.min(1.5,u.waterSeedBank);
  u.waterSeedBank-=seed;u.energy-=3.5;
  this.waterweed[best]=Math.min(100,this.waterweed[best]+seed*2.5);
  u.lastWaterPlant=this.tick;
  this.waterPlantings=(this.waterPlantings??0)+1;
  this.log('waterPlant','#'+u.id+' が水草の繁殖体を運び定着させた',u);
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
 // Water-bound organisms cannot cross land to weeds in another pond.
 // Connected regions are built once per tick, not once per individual.
 waterRegions(){
  if(this._waterRegionTick===this.tick&&this._waterRegions)return this._waterRegions;
  const regions=new Uint16Array(this.tiles.length),queue=new Int32Array(this.tiles.length);
  let region=0;
  for(let i=0;i<this.tiles.length;i++){
   if(this.tiles[i]!==1||regions[i])continue;
   region++;
   let head=0,tail=1;queue[0]=i;regions[i]=region;
   while(head<tail){
    const cell=queue[head++],x=cell%NX,y=Math.floor(cell/NX);
    const neighbors=[x>0?cell-1:-1,x<NX-1?cell+1:-1,
     y>0?cell-NX:-1,y<NY-1?cell+NX:-1];
    for(const next of neighbors)if(next>=0&&this.tiles[next]===1&&!regions[next]){
     regions[next]=region;queue[tail++]=next;
    }
   }
  }
  this._waterRegions=regions;this._waterRegionTick=this.tick;
  return regions;
 }
 nearestWaterweed(x,y,radius,hungry=false){
  let best=null,score=radius*radius;
  const home=this.cell(x,y);
  const region=this.tiles[home]===1?this.waterRegions()[home]:0;
  const regions=region?this._waterRegions:null;
  const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL),reach=Math.ceil(radius/CELL)+1;
  for(let yy=Math.max(0,cy-reach);yy<=Math.min(NY-1,cy+reach);yy++)
   for(let xx=Math.max(0,cx-reach);xx<=Math.min(NX-1,cx+reach);xx++){
    const i=yy*NX+xx;
    if(this.tiles[i]!==1||this.water[i]<=0||this.waterweed[i]<=(hungry?1.2:.2)||
     region&&regions[i]!==region)continue;
    // Approach the reachable edge of a food tile instead of its centre.
    // This reduces needless movement before taking the first bite.
    const px=clamp(x,xx*CELL+2,(xx+1)*CELL-2);
    const py=clamp(y,yy*CELL+2,(yy+1)*CELL-2);
    const d=(px-x)**2+(py-y)**2;
    const weighted=hungry?d/(.45+Math.min(4,this.waterweed[i])/4):d;
     if(weighted<score){best={x:px,y:py};score=weighted;}
   }
  return best;
 }
 consumeGrass(x,y,amount){
  const i=this.cell(x,y);
  if(this.tiles[i]!==0&&this.tiles[i]!==2&&this.tiles[i]!==3)return 0;
  const taken=Math.min(this.grass[i],amount);
  this.grass[i]-=taken;
  if(taken>0)this.grazingPressure[i]+=taken/6;
   if(taken>0)this.soil[i]=Math.max(0,this.soil[i]-taken*.12);
  // An exhausted pasture becomes bare ground until grass spreads in again.
  if(this.grass[i]<=.001){this.grass[i]=0;if(this.tiles[i]===0)this.tiles[i]=2;}
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
 // Find nutritious land directly bordering the current connected pond.
 nearestEdibleShore(x,y,radius=105){
  const home=this.cell(x,y);
  if(this.tiles[home]!==1)return null;
  const regions=this.waterRegions(),region=regions[home];
  if(!region)return null;
  let best=null,score=radius*radius;
  for(let i=0;i<this.tiles.length;i++){
   if(this.tiles[i]!==0||this.grass[i]<5)continue;
   const gx=i%NX,gy=Math.floor(i/NX);
   const neighbors=[gx>0?i-1:-1,gx<NX-1?i+1:-1,
    gy>0?i-NX:-1,gy<NY-1?i+NX:-1];
   if(!neighbors.some(j=>j>=0&&regions[j]===region))continue;
   const px=(gx+.5)*CELL,py=(gy+.5)*CELL;
   const d=(px-x)**2+(py-y)**2;
   if(d<score){score=d;best={x:px,y:py};}
  }
  return best;
 }
 nearestGrass(x,y,radius,g,hungry=false){
  let best=null,score=radius*radius;
  const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL),reach=Math.ceil(radius/CELL)+1;
  for(let yy=Math.max(0,cy-reach);yy<=Math.min(NY-1,cy+reach);yy++)
   for(let xx=Math.max(0,cx-reach);xx<=Math.min(NX-1,cx+reach);xx++){
    const id=yy*NX+xx;if((this.tiles[id]!==0&&this.tiles[id]!==2&&this.tiles[id]!==3)||this.grass[id]<=(hungry?1.0:.2))continue;
    if(!terrainFitness(g,this.tiles[id]).passable)continue;
    const a=clamp(x,xx*CELL+2,(xx+1)*CELL-2);
    const b=clamp(y,yy*CELL+2,(yy+1)*CELL-2);
    const d=(a-x)**2+(b-y)**2;
    const weighted=hungry?d/(.4+Math.min(5,this.grass[id])/5):d;
     if(weighted<score){score=weighted;best={x:a,y:b};}
   }
  return best;
 }
 setupTerrain(){
  this.tiles=new Uint8Array(NX*NY);
  // Preserve the established map, including its seeded shoreline irregularity.
  const hubs=[{x:10,y:9,t:1,r:6},{x:33,y:18,t:1,r:5},{x:30,y:5,t:2,r:9},{x:7,y:20,t:2,r:5},{x:21,y:17,t:3,r:4},{x:38,y:9,t:3,r:4}];
  for(let y=0;y<NY;y++)for(let x=0;x<NX;x++){
   let t=0;for(const h of hubs)if(Math.hypot(x-h.x,y-h.y)+this.range(-1.4,1.4)<h.r)t=h.t;this.tiles[y*NX+x]=t;
  }
  // Every connected biome gets a 1-5 relief gradient. Multi-source BFS
  // starts at shoreline/biome borders; deep interior cells become level 5.
  // No additional random draws are used: reproducible seeded ecology remains.
  const count=this.tiles.length,dist=new Int16Array(count),seen=new Uint8Array(count);
  const queue=new Int32Array(count),visited=[];
  this.terrainLevels=new Uint8Array(count);
  const neighbors=i=>{
   const x=i%NX,y=Math.floor(i/NX),result=[];
   if(x>0)result.push(i-1);
   if(x<NX-1)result.push(i+1);
   if(y>0)result.push(i-NX);
   if(y<NY-1)result.push(i+NX);
   return result;
  };
  for(let origin=0;origin<count;origin++){
   if(seen[origin])continue;
   const biome=this.tiles[origin];let head=0,tail=1,maxDepth=1;
   queue[0]=origin;seen[origin]=1;visited.length=0;
   // Flood-fill the connected component before computing its border.
   while(head<tail){
    const i=queue[head++];visited.push(i);
    for(const j of neighbors(i))if(!seen[j]&&this.tiles[j]===biome){
     seen[j]=1;queue[tail++]=j;
    }
   }
   const frontier=new Int32Array(visited.length);head=0;tail=0;
   for(const i of visited){
    const boundary=neighbors(i).some(j=>this.tiles[j]!==biome);
    // The map edge itself is not a biome edge; outer grass may be forest.
    if(boundary){dist[i]=1;frontier[tail++]=i;}
    else dist[i]=0;
   }
   if(!tail){for(const i of visited)this.terrainLevels[i]=3;continue;}
   while(head<tail){
    const i=frontier[head++];
    for(const j of neighbors(i))if(this.tiles[j]===biome&&dist[j]===0){
     dist[j]=dist[i]+1;maxDepth=Math.max(maxDepth,dist[j]);
     frontier[tail++]=j;
    }
   }
   for(const i of visited){
    // The core is 5 even for small islands. Intermediate rings are
    // distributed along the available depth, never randomly scattered.
    const rel=(dist[i]-1)/Math.max(1,maxDepth-1);
    this.terrainLevels[i]=maxDepth===1?1:Math.min(5,1+Math.round(rel*4));
   }
  }
 }
 reset(){
  this.rng=this.initialSeed||971253;this.units=[];this.eggs=[];this.food=[];this.corpses=[];this.species=new Map();this.speciesSamples=new Map();this.logs=[];this.effects=[];this.history=[];this.discoveries=[];this.tick=0;this.nextId=1;this.recycled=0;this.introducedCount=0;this.runStartTick=null;this.runEndedTick=null;this.founderSpeciesCount=0;this.ecosystemBalance=0;this.deathCauses={};this.deathRecords=[];this.infectionCases=0;this.infectionRecoveries=0;this.infectionIntroductions=0;this.supportZones=[];this.courtshipFailures={};this.courtshipStarts=0;this.mateApproachStarts=0;this.mateApproachStalled=0;this.matings=0;this.migrations=0;this.terrainCrossings=0;this.courtships=[];this.eggTrails=[];this.recycledByTerrain=[0,0,0,0];this.growth=70;this.waterweedGrowth=140;this.stress=15;this.rainfall=25;this.weather='sunny';this.weatherUntil=240;this.weatherStrength=0;this.baseTemperature=22;this.temperature=22;this.temperatureHistory=[];this.climateEnabled=true;this.seasonLength=600;
  this._waterRegionTick=null;this._waterRegions=null;
  this.setupTerrain();
  this.grass=new Float32Array(this.tiles.length);
  this.water=new Float32Array(this.tiles.length);
  this.waterbed=new Uint8Array(this.tiles.length);
  this.soil=new Float32Array(this.tiles.length);
  this.soilWater=new Float32Array(this.tiles.length);
   this.grazingPressure=new Float32Array(this.tiles.length);
  this.waterweed=new Float32Array(this.tiles.length);
  this.seedRainCount=0;this.waterweedSeedCount=0;this.corpseSproutCount=0;this.waterPlantings=0;this.cannibalMeals=0;
  for(let i=0;i<this.tiles.length;i++){
   const level=this.terrainLevels[i];
   this.soilWater[i]=this.tiles[i]===0?52:this.tiles[i]===2?19:this.tiles[i]===1?95:5;
   if(this.tiles[i]===0)this.grass[i]=Math.min(100,[26,44,65,77,87][level-1]+this.rand()*13);
   if(this.tiles[i]===2)this.grass[i]=[5,4,3,2,1][level-1]+this.rand()*2;
   // Preserve the seeded RNG sequence when converting rocky food to bare refuge.
   if(this.tiles[i]===3)this.grass[i]=10+this.rand()*10; // edible slow-growing mountain lichen
   if(this.tiles[i]===1){
    this.water[i]=Math.min(100,[45,57,74,87,96][level-1]+this.rand()*5);
    this.waterbed[i]=1;
    // Mid-depth zones are productive, while the deepest water has less light.
    this.waterweed[i]=Math.min(100,[32,49,65,53,39][level-1]+this.rand()*9);
   }
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
 temperatureAt(x,y){const cell=this.cell(x,y);return microclimateTemperature(this.temperature,this.tiles[cell],this.terrainLevels?.[cell]??3,this.climateEnabled?this.seasonName():'spring');}
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
    if(u.g.aquatic===1&&this.terrain(u.x,u.y)===1&&nextTerrain!==1&&
      !u.landExcursion)return null;
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
  const plantSeason=this.climateEnabled?this.seasonName():'none';
  if(this.climateEnabled&&this.tick>1&&this.tick%this.seasonLength===0){
   const phase={spring:'春の芽吹きが始まる',summer:'夏の成長期。乾燥に注意',autumn:'秋。草の成長が鈍り始める',winter:'冬。植物は休眠し地上部が減る'};
   this.log('info','植物：'+phase[plantSeason]);
  }
  // Regrowth is suppressed by local biomass demand instead of a population threshold.
  if(this.tick%6===0){
   // Track actual plant harvests in consumeGrass/consumeWaterweed.
  }
  // Map resources are finite. Grass regrows only from living adjacent patches,
  // so complete overgrazing cannot recover without intervention.
  if(this.tick%6===0){
   // Rain replenishes root-zone moisture, while sunlight evaporates it.
   for(let i=0;i<this.soilWater.length;i++){
    const biome=this.tiles[i];
    if(biome===1){this.soilWater[i]=Math.max(70,this.soilWater[i]);continue;}
    const rain=this.weather==='rain'?(.8+this.rainfall*.025)*(biome===0?1:biome===2?.72:.35):0;
    const evaporation=clamp(.14+Math.max(0,this.temperature-22)*.025,0,.85)*(biome===0?.78:biome===2?1.2:.65);
    this.soilWater[i]=clamp(this.soilWater[i]+rain-evaporation,0,100);
   }
   const next=this.grass.slice();
   for(let i=0;i<this.tiles.length;i++){
    if(this.tiles[i]===0&&this.grass[i]>0){
     const localGrazing=this.grazingPressure[i];
       const levelScale=TERRAIN_LEVEL_GROWTH[(this.terrainLevels?.[i]??3)-1]??1;
      const productivity=clamp(.28+this.soil[i]/120,.28,1.12);
      const seasonGrowth=seasonalPlantGrowth(plantSeason,
        this.temperatureAt((i%NX+.5)*CELL,(Math.floor(i/NX)+.5)*CELL),
        0,this.soilWater[i],this.terrainLevels?.[i]??3);
       const regen=(1.8+this.soil[i]*.05)*this.growth/70*levelScale*productivity*seasonGrowth/(1+localGrazing*.52);
      next[i]=Math.min(100,this.grass[i]+regen);
      // Winter kills foliage but leaves living roots; autumn slowly thins leaves.
      if(plantSeason==='winter')next[i]=Math.max(Math.min(this.grass[i],4),next[i]-(this.grass[i]-4)*.018);
      else if(plantSeason==='autumn')next[i]=Math.max(Math.min(this.grass[i],4),next[i]-(this.grass[i]-4)*.004);
      if(localGrazing>2.5){
       next[i]=Math.max(0,next[i]-Math.min(4.5,(localGrazing-2.5)*.23));
       this.soil[i]=Math.max(0,this.soil[i]-.075*Math.min(10,localGrazing));
       if(next[i]<.2){next[i]=0;this.tiles[i]=2;}
      }
    }
    // Sparse edible dryland plants recover slowly; rocks never grow food.
    if(this.tiles[i]===2&&this.grass[i]>0){
     const wetness=clamp((this.soilWater[i]??0)/70,0,1);
     next[i]=Math.min(9,
      this.grass[i]+.10*(.25+wetness)*
      this.growth/70*seasonalPlantGrowth(plantSeason,this.temperature,2,this.soilWater[i])/(1+this.grazingPressure[i]));
    }
    if(this.tiles[i]===3){
     // Rock lichen is a persistent but slowly recovering local food source.
     // High rock adaptation improves collection, not infinite food.
     const seasonScale=plantSeason==='winter'?.45:plantSeason==='spring'?1.3:1;
     const moisture=.35+.65*clamp((this.soilWater[i]??0)/60,0,1);
     next[i]=Math.min(24,this.grass[i]+.85*seasonScale*moisture*this.growth/70/(1+this.grazingPressure[i]*.3));
    }
    if(this.grass[i]<=0&&this.tiles[i]!==1&&this.tiles[i]!==3){
     const x=i%NX,y=Math.floor(i/NX);
     const neighbors=[x>0?i-1:-1,x<NX-1?i+1:-1,y>0?i-NX:-1,y<NY-1?i+NX:-1];
     // A completely bare world contains no propagules.
     // Fertilized patches spread faster, but never create plants without seeds.
     const fertile=clamp(this.soil[i]/55,0,1.5);
     const seedSeason=plantSeason==='winter'?.015:plantSeason==='spring'?1.65:plantSeason==='autumn'?.60:1;
     if(neighbors.some(j=>j>=0&&this.grass[j]>18)&&this.rand()<(.08+.20*fertile)*this.growth/70*seedSeason){
      next[i]=4;this.tiles[i]=0;
     }
    }
    // Waterweed is a separate, edible plant resource: water itself is not food.
    if(this.tiles[i]===1&&this.water[i]>0&&this.waterweed[i]>0){
     const plant=seasonalPlantGrowth(plantSeason,
      this.temperatureAt((i%NX+.5)*CELL,(Math.floor(i/NX)+.5)*CELL),1,100);
     const regen=(.55+this.soil[i]*.024)*this.waterweedGrowth/70*
      (WATER_LEVEL_GROWTH[(this.terrainLevels?.[i]??3)-1]??1)*plant/(1+this.grazingPressure[i]*.4);
     this.waterweed[i]=Math.min(100,this.waterweed[i]+regen);
     // Rooted aquatic plants endure winter; above-water food availability falls.
     if(plantSeason==='winter')this.waterweed[i]=Math.max(
      Math.min(this.waterweed[i],3),this.waterweed[i]-(this.waterweed[i]-3)*.007);
    }
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
    if(this.rand()<(.10+this.soil[id]*.005)*humidity*this.growth/70*(plantSeason==='winter'?.01:plantSeason==='spring'?1.8:plantSeason==='autumn'?.65:1)){
     this.tiles[id]=0;this.grass[id]=5+this.rand()*5;
     this.seedRainCount++;
    }
   }
  }
  // Aquatic plants spread locally, but an extinct pond can also recover via
  // rare windborne / waterfowl-carried seeds. No spontaneous growth on dry land.
  // Germination needs actual water; wetter ponds and rain favor seed arrival.
  if(this.tick%12===0&&this.waterweedGrowth>0){
   const next=this.waterweed.slice();
   for(let i=0;i<this.tiles.length;i++)if(this.tiles[i]===1&&this.water[i]>=12&&this.waterweed[i]<=.001){
    const x=i%NX,y=Math.floor(i/NX);
    const adjacent=[x>0?i-1:-1,x<NX-1?i+1:-1,y>0?i-NX:-1,y<NY-1?i+NX:-1];
    if(adjacent.some(j=>j>=0&&this.tiles[j]===1&&this.waterweed[j]>15)&&this.rand()<.08*this.waterweedGrowth/70*(plantSeason==='winter'?.08:plantSeason==='spring'?1.5:1)){
     next[i]=3;
    }else{
     const rain=this.weather==='rain'?1.7:1;
     const depth=clamp(this.water[i]/65,.25,1);
     if(this.rand()<.006*rain*depth*this.waterweedGrowth/70*(plantSeason==='winter'?.05:plantSeason==='spring'?1.7:1)){
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
    if(this.tiles[id]!==3&&this.grass[id]>0)this.grass[id]=Math.min(100,this.grass[id]+loss*.12);
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
   const eggRest=(eggClimate.excess>2||eggClimate.comfort<.72)&&
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
     const child=this.spawn(hatchSite.x,hatchSite.y,egg.g,{id:egg.parent,otherParent:egg.otherParent,generation:egg.generation-1,lineage:egg.lineage,parents:egg.parents});
    if(child){child.energy=egg.energy+52;child.stage='juvenile';this.log('hatch','卵 #'+egg.id+' から #'+child.id+' が孵化（初期栄養 '+child.energy.toFixed(1)+'）',egg);}
   }
  }
  this.eggs=this.eggs.filter(e=>!e.dead);
  const batch=this.units.slice();
  const lineageCounts=new Map();
  for(const v of batch)if(!v.dead)lineageCounts.set(v.lineage,(lineageCounts.get(v.lineage)??0)+1);
  const unitGrid=new SpatialLookup(batch),eggGrid=new SpatialLookup(this.eggs),corpseGrid=new SpatialLookup(this.corpses);
  const byId=new Map(batch.map(u=>[u.id,u]));
  const firstEggByParent=new Map();
  for(const egg of this.eggs)if(!egg.dead&&!firstEggByParent.has(egg.parent))firstEggByParent.set(egg.parent,egg);
  for(const u of batch){
   if(u.dead)continue;u.age++;u.juvenileFood=0;
   u.isolatedSteps=(lineageCounts.get(u.lineage)??0)>1?0:(u.isolatedSteps??0)+1;
   if(this.supportZones.some(z=>z.kind==='oasis'&&z.until>this.tick&&(z.x-u.x)**2+(z.y-u.y)**2<=65**2))u.hydration=Math.min(100,u.hydration+.36);if(u.bite>0)u.bite--;if(u.woundFlash>0)u.woundFlash--;if(u.attackFlash>0)u.attackFlash--;if(u.defendFlash>0)u.defendFlash--;if(u.mateCooldown>0)u.mateCooldown--;
   if(u.pregnancy){u.pregnancy.remaining--;if(u.pregnancy.remaining<=0)this.layEgg(u);}
   const g=u.g,t=this.terrain(u.x,u.y),m=organismMorphology(u),diet=dietProfile(g),
    home=terrainLevelFitness(experiencedTerrainFitness(u,t),t,this.terrainLevels?.[this.cell(u.x,u.y)]??3,g);
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
    // Dormancy conserves food, without any intrinsic aging damage.
    u.energy-=.04+organismMorphology(u).bodyMass*.0009;
    u.hydration=Math.max(0,u.hydration-.028);
    this.updateVitalHealth(u);
    if(u.hp<=0)this.die(u,this.vitalDeathCause(u));
    continue;
   }
   if(u.dormant){u.dormant=false;this.log('wake','#'+u.id+' が休眠から目覚めた',u);}
   // Maintaining dormancy-capable physiology carries a year-round cost.
   // Weather changes energy needs and behavior, not a hidden death clock.
   u.energy-=thermal.upkeep+(g.hibernate??0)*.075;
   u.carnivoryExperience=Math.max(0,(u.carnivoryExperience??0)-.00011);
   u.energy-=carnivoryExperience(u)*.045;
   const near=unitGrid.query(u.x,u.y,Math.max(145,sight*1.6),false);
   const aquatic=g.aquatic===1,underwater=t===1&&this.water[this.cell(u.x,u.y)]>0;
   if(aquatic){
    const before=u.landAcclimation??0;
    u.landAcclimation=landAcclimationGain(u,!underwater);
    if(before<.3&&u.landAcclimation>=.3)
     this.log('acclimate','#'+u.id+' が陸上生活に順化し始めた',u);
   }
   if(aquatic){
    u.stranded=underwater?0:u.stranded+1;
    u.hydration=underwater?Math.min(100,u.hydration+1.6):
      u.hydration-(.85-.53*clamp(u.landAcclimation??0,0,.72));
    if(underwater){const consumed=this.consumeWater(u.x,u.y,.095);if(consumed>0&&(this.tick+u.id)%24===0)this.addVisualEffect('drink',u);}
   }else{
    u.submerged=underwater?u.submerged+1:0;
    const drinking=this.nearWater(u.x,u.y,1);
    u.hydration=drinking?Math.min(100,u.hydration+.9):
      Math.min(100,u.hydration+terrestrialHydrationDelta(g,t,this.weather,this.terrainLevels?.[this.cell(u.x,u.y)]??3,this.grass[this.cell(u.x,u.y)],this.soilWater[this.cell(u.x,u.y)]));
    if(drinking){const consumed=this.drinkNearby(u.x,u.y,.12);if(consumed>0&&(this.tick+u.id)%24===0)this.addVisualEffect('drink',u);}
   }
   // Lack of usable water leads to HP loss, not instant death.
   if(aquatic&&u.stranded>95+330*(u.landAcclimation??0))
    this.applyHpLoss(u,'dehydration',.8+Math.min(1.5,(u.stranded-95)*.006));
   if(!aquatic&&u.submerged>24)this.applyHpLoss(u,'dehydration',1.3);
   if(u.hp<=0){this.die(u,this.vitalDeathCause(u));continue;}
   let nearest=null,df=sight*sight;
   const onLand=aquatic&&!underwater;
   const urgentHunger=u.energy<90;
    const waterFood=aquatic?this.nearestWaterweed(u.x,u.y,Math.min(145,Math.max(65,sight*(urgentHunger?2.3:1.7))),urgentHunger):null;
   if(aquatic&&underwater&&!waterFood&&u.energy<116&&!u.pregnancy){
    if(!u.shoreTarget||this.tick>u.shoreTarget.until){
     const site=this.nearestEdibleShore(u.x,u.y,105);
     if(site){u.shoreTarget={...site,until:this.tick+150};u.landExcursion=true;
      this.log('shore','#'+u.id+' が水草不足で陸上の餌を探し始めた',u);}
    }
   }
   if(aquatic&&underwater&&waterFood&&u.landExcursion){
    u.landExcursion=false;u.shoreTarget=null;
   }
   if(onLand)u.landExcursion=true;
   if(diet.plant>0){
    // Search farther only while hungry; no new food is generated.
    const forageRadius=urgentHunger?Math.min(185,Math.max(85,sight*2.25)):sight;
    nearest=aquatic&&!onLand?waterFood||this.nearestWaterweed(u.x,u.y,forageRadius,urgentHunger):
     this.nearestGrass(u.x,u.y,forageRadius,g,urgentHunger);
    if(nearest)df=distance(u,nearest);
    if(u.energy<80&&!nearest)u.forageFailure++;
   }
   let nearestCorpse=null,corpseDist=sight*sight;
   if(effectiveMeatAffinity(u)>.15||famineCannibalism(u)||g.dna?.skillAbsorb===1)for(const corpse of corpseGrid.query(u.x,u.y,sight)){
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
   if((m.predatory||famineCannibalism(u)||carnivoryExperience(u)>.25||
    u.stage==='juvenile'&&(g.juvenileCannibalism??0)>.68&&u.energy<57)&&u.bite===0)for(const v of near){
    if(v===u||v.dead||v.id===u.courtPartner)continue;
     // Newborn relatives are not food, even when mutations alter their category.
     const siblingJuveniles=u.stage==='juvenile'&&u.age<65&&
      v.stage==='juvenile'&&v.lineage===u.lineage;
     const desperateCannibal=siblingJuveniles&&u.age>=12&&u.energy<57&&
      (g.juvenileCannibalism??0)>.68&&diet.meat>.24&&
      organismMorphology(v).bodyMass<organismMorphology(u).bodyMass*1.08;
     if(siblingJuveniles&&!desperateCannibal)continue;
      const preyTerrain=this.terrain(v.x,v.y);
      if(preyTerrain===1&&!aquatic)continue;
      const preyMass=organismMorphology(v).bodyMass;
     // Under famine, capable predators risk attacking similarly sized
     // conspecifics; successful attacks yield calories, not free biomass.
     const hungry=u.energy<65&&effectiveMeatAffinity(u)>.18;
     const cannibal=desperateCannibal||(hungry||famineCannibalism(u))&&v.category===u.category;
     if(v.category===u.category&&!cannibal)continue;
     if(preyMass>m.bodyMass*(cannibal?1.15:m.edibleRatio))continue;
    const d=distance(u,v)/Math.max(.1,coverFactor(preyTerrain,aquatic)*
       camouflageFactor(v.g,preyTerrain))**2;
     if(d<pd){pd=d;prey=v;}
   }
   // Prey usually respond to apparent feeding signals, but juveniles know
   // their family and starving animals can feed despite distant bluffs.
   const foodWithinReach=!!(nearest&&distance(u,nearest)<
    (m.biteReach+(aquatic?14:13))**2&&diet.plant>0);
   let danger=null,dangerD=sight*sight*1.6;
   if(!u.threatDecisions)u.threatDecisions=new Map();
   for(const v of near){
    if(v===u||v.dead)continue;
    // A compatible and actively approaching suitor does not trigger flight
    // just because its silhouette suggests predation. Other threats remain.
    const inviting=v.courtPartner===u.id||
     (v.mateTarget?.id===u.id&&v.mateTarget.until>this.tick&&
      !(v.rejectedBy?.id===u.id&&v.rejectedBy.until>this.tick)&&
      this.canMate(u,v));
    if(inviting)continue;
    const visible=dietProfile(v.g).signal;
    if(visible<.48||organismMorphology(v).bodyMass<m.bodyMass*.55)continue;
    const directDistance=distance(u,v);
    if(suppressFearSignal(u,v,directDistance,foodWithinReach))continue;
    const d=directDistance/Math.max(.1,coverFactor(t,aquatic)*camouflageFactor(v.g,t))**2;
    if(d>=dangerD)continue;
    // Store the response until the encounter ends. Ignore a signal for the
    // whole encounter when the inherited risk roll says "stand ground".
    let decision=u.threatDecisions.get(v.id);
    if(!decision){
     decision={flee:this.rand()<threatFlightProbability(u,v)};
     u.threatDecisions.set(v.id,decision);
    }
    if(decision.flee){danger=v;dangerD=d;}
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
   // Forget individual encounters only after the threat has left, so
   // multiple visible individuals cannot cause per-frame rerolls.
   for(const id of u.threatDecisions.keys())
    if(!near.some(v=>v.id===id&&!v.dead&&
      distance(u,v)<sight*sight*1.6))u.threatDecisions.delete(id);
   const attacker=u.attackResponse?.until>this.tick?
    byId.get(u.attackResponse.id):null;
   const threatAttacker=attacker&&!attacker.dead?attacker:null;
   const counterAttack=!!threatAttacker&&u.attackResponse.retaliate;
   if(threatAttacker&&!counterAttack)danger=threatAttacker;
   // A defended nest still matters, but direct attack takes priority.
   const flight=!!threatAttacker&&!counterAttack||
    !counterAttack&&!defenderTarget&&!!danger;
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
   // Environmental spillover occurs only after establishment; contact spreads it.
   let relatives=0,infectious=0;
   for(const v of near)if(v!==u&&!v.dead&&v.lineage===u.lineage&&distance(u,v)<38**2){
    relatives++;if(v.infection>0)infectious++;
   }
   const crowd=Math.max(0,relatives-2)+congestion*.65;
   if(u.infection>0){
    u.infection--;
    this.applyHpLoss(u,'infection',(.13+crowd*.035)*(1-(g.resist??.4)*.7));
    if(u.infection===0&&u.hp>0){
     this.infectionRecoveries++;
     u.infectionProtectionUntil=Math.max(u.infectionProtectionUntil??0,this.tick+180);
    }
   }else if(this.tick>=(u.infectionProtectionUntil??0)){
    const established=this.tick>=240&&this.units.length>=14;
    const contactRisk=infectious>0?Math.min(.045,infectious*.006*(1+Math.min(3,crowd)*.1)):0;
    const introductionRisk=established&&relatives>=5?.00012:0;
    const resistance=1-(g.resist??.4)*.9;
    const roll=this.rand();
    if(roll<(contactRisk+introductionRisk)*resistance){
     u.infection=Math.max(25,60+Math.floor(this.rand()*45)-Math.round((g.resist??.4)*30));
     this.infectionCases++;
     if(roll>=contactRisk*resistance)this.infectionIntroductions++;
     this.log('ill','#'+u.id+(roll<contactRisk*resistance?' が接触感染':' に環境由来の感染が発生'),u);
    }
   }
   // Crowded colonies consume more energy and stop producing offspring as easily.
   u.energy-=Math.min(.85,Math.max(0,rivals-3)*.075)+congestion*.11;
   if(u.stage==='juvenile')u.energy-=clamp(g.juvenileCannibalism??0,0,1)*.085;
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
   const seekRefuge=!u.courtPartner&&!u.mateTarget&&!u.pregnancy&&!flight&&u.energy>55&&
    (thermal.excess>2||crowdEscape&&(!partnerNearby||pressure>retreatThreshold*1.6));
   if(seekRefuge&&(this.tick+u.id)%14===0){
    let best=null,bestScore=-Infinity;
    for(let i=0;i<12;i++){
     const x=clamp(u.x+this.range(-90,90),8,W-8),y=clamp(u.y+this.range(-90,90),8,H-8);
     const terrain=this.terrain(x,y);
     let competitors=0;
     for(const v of unitGrid.query(x,y,48,false))if(v!==u&&!v.dead&&dietProfile(v.g).plant>.25)competitors++;
     const habitat=terrainFitness(g,terrain);
     if(!habitat.passable)continue;
     const fit=habitat.fitness;
     const thermalBenefit=thermalFitness(g,this.temperatureAt(x,y));
      const score=fit*.85+GROWTH[terrain]*.6+thermalBenefit.comfort*(thermal.excess>2?1.6:.30)-thermalBenefit.excess*(thermal.excess>2?.5:.06)-competitors*.37+
       (terrain===1&&aquatic?.9:0)+this.range(-.12,.12);
     if(score>bestScore){bestScore=score;best={x,y,terrain};}
    }
    if(best&&bestScore>home.fitness*.85+GROWTH[t]*.6+thermal.comfort*(thermal.excess>2?1.6:.30)-thermal.excess*(thermal.excess>2?.5:.06)-pressure*.26){
     u.refugeTarget={x:best.x,y:best.y,until:this.tick+110,climate:thermal.excess>2};
     this.log('migration','#'+u.id+' が'+(thermal.excess>2?'暑さ寒さ':'競争')+'を避けて'+TERRAIN_NAMES[best.terrain]+'へ移動を開始',u);
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
    // Rescue is rare and expensive; never override a viable natural mate.
    if((this.tick+u.id)%24===0&&this.canEmergencySplit(u))this.emergencySplit(u);
    // The optional division skill works beyond emergency rescue, with
    // high resource cost and local density restrictions.
    if((this.tick+u.id)%80===0&&this.canSkillSplit(u,near))this.skillSplit(u);
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
   if(u.refugeTarget&&!flight&&!u.courtPartner&&!mate&&(u.energy>=85||u.refugeTarget.climate&&u.energy>=55))target=u.refugeTarget;
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
   const criticalWater=u.hydration<24||aquatic&&!underwater&&
     (u.stranded>85+220*(u.landAcclimation??0)||u.hydration<38);
   if((aquatic&&!underwater&&criticalWater||!aquatic&&u.hydration<45&&!this.nearWater(u.x,u.y,1))&&(!nearFood||criticalWater)){
    const water=this.nearestWater(u.x,u.y);if(water)target=water;
   }
   // Nursery navigation costs energy. Food, dehydration and danger win.
   if(u.pregnancy?.nestGoal&&!flight&&!criticalWater&&!counterAttack&&
      u.energy>65&&(!nearest||u.energy>95)){
    if(distance(u,u.pregnancy.nestGoal)>14**2){
     target=u.pregnancy.nestGoal;
     u.energy-=.035+.10*clamp(g.nestChoice??0,0,1);
    }
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
   if(breedingPriority&&!u.pregnancy&&!u.landExcursion){target=mate;u.refugeTarget=null;u.socialTarget=null;}
   // Urgent hunger outranks optional migration, mating, guarding and social attraction.
    if(u.energy<85&&!flight&&nearest&&!criticalWater){
     target=nearest;u.refugeTarget=null;u.socialTarget=null;
    }
    // A blocked food/refuge target may be abandoned, but a compatible mate
   // should not be discarded by an unrelated avoidance marker.
   if(target&&!breedingPriority&&u.avoidTarget&&u.avoidTarget.until>this.tick&&
      distance(target,u.avoidTarget)<20*20&&!flight&&!(u.energy<85&&target===nearest))target=null;
   // Immediate escape overrides food, reproduction and egg guarding.
   if(aquatic&&underwater&&u.landExcursion&&u.shoreTarget&&!flight&&!criticalWater)
    target=u.shoreTarget;
   if(counterAttack)target=threatAttacker;
   if(flight)target=null;
   const desired=flight?Math.atan2(u.y-danger.y,u.x-danger.x)
      :target?Math.atan2(target.y-u.y,target.x-u.x):u.angle+this.range(-.5,.5);
   const terrainMove=home.move;
   const courtingMate=u.courtPartner?byId.get(u.courtPartner):null;
   const actionSpeed=flight||(!flight&&prey&&!prey.dead&&effectiveMeatAffinity(u)>.14)?1:0;
   const agility=clamp(((g.dna?.agility??5)-1)/9,0,1);
   const sprint=g.dna?.skillSprint===1&&actionSpeed&&u.energy>52?1:0;
   const speed=m.speed*body.vigor*thermal.activity*(u.stage==='juvenile'?.8:1)*terrainMove
    *(aquatic&&underwater?1+.23*clamp(g.tailLength??0,0,1):
      1-.09*clamp(g.tailLength??0,0,1))
     *(flight?1.24:courtingMate&&distance(u,courtingMate)<22**2?.20:1)
     *pursuitEscapeSpeedFactor(g,actionSpeed,u.energy)
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
   u.behaviorTarget=flight?'escape':counterAttack?'retaliate':
    aquatic&&underwater&&u.landExcursion&&u.shoreTarget?'shore':breedingPriority?'mate':
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
   // Chase/escape mobility requires real energy.
   if(sprint)u.energy-=.26+.12*agility;
   else if(actionSpeed)u.energy-=.075*agility;
   // Terrain hazards change energy economy instead of directly draining HP.
   u.energy-=home.hazard*.7;
   // Terrain-fit offspring retain energy and can reproduce more successfully.
   const adaptationCost=clamp(1.65-home.fitness*.75,.70,1.5)*(1.08-.08*thermal.comfort);
   u.energy-=reproductiveUpkeep(g)*youth;
    u.energy-=((u.courtPartner?.75:1)*m.upkeep+longevityUpkeep(g))*youth*adaptationCost*frugalityMaintenanceFactor(g)+acquiredSizeMaintenance(u)*youth*adaptationCost+(flight?.10:0)+(ownEgg?g.guard*.16:0)+this.stress*.0035+home.upkeep+(g.wet+g.dry+g.rock)*.055;
   // Efficient physiology is a low-energy, slow-growing niche, not a
   // universal upgrade: sacrificing defense and reproduction speed.
   if(metabolicFrugality(g)>.5)u.energy-=.035*metabolicFrugality(g);
   if(!flight&&aquatic&&underwater&&diet.plant>0&&nearest&&distance(u,nearest)<(m.biteReach+14)**2){
    const gardening=clamp(g.waterGardening??0,0,1);
    const patch=this.cell(nearest.x,nearest.y);
    const maximum=Math.min(5.5,1.3*m.foodGain*feedingCapacity(u));
    // A well-fed gardener leaves a viable source plant. Hungry individuals
    // may graze through the reserve rather than starving for conservation.
    const reserve=gardening>.45&&u.energy>78?
     Math.max(0,Math.min(maximum,this.waterweed[patch]-4*gardening)):maximum;
    const eaten=this.consumeWaterweed(nearest.x,nearest.y,reserve);
    if(eaten>0){
     if(gardening>.4)u.waterSeedBank=Math.min(8,(u.waterSeedBank??0)+eaten*.12*gardening);
     u.energy+=eaten*7.5*effectivePlantAffinity(u)*home.fitness;
     u.recentFood=(u.recentFood??0)+eaten*4;
     u.forageSuccess++;
     if(u.stage==='juvenile')u.juvenileFood+=eaten*7.5*effectivePlantAffinity(u)*home.fitness;
     // Eating sustains energy but cannot replenish spent lifespan.
     if((this.tick+u.id)%9===0)this.addVisualEffect('waterweed',u,{fromX:nearest.x,fromY:nearest.y});
     this.log('meal','#'+u.id+' が水草を食べた',u);}
   }
   if(aquatic&&underwater&&!flight)this.plantWaterweed(u);
   // Existing wet adaptation also has a functional land/water interface.
   // A terrestrial wetland specialist can browse shallow aquatic vegetation
   // from the *shore* without entering inaccessible water or creating food.
   // No new gene is necessary: the inherited wet locus already encodes this.
   if(!flight&&!aquatic&&t===0&&(g.wet??0)>.42&&diet.plant>.2&&u.energy<150){
    const coastWeed=this.nearestWaterweed(u.x,u.y,22);
    if(coastWeed&&distance(u,coastWeed)<18*18){
     const eaten=this.consumeWaterweed(coastWeed.x,coastWeed.y,
      Math.min(1.15,m.foodGain*(g.wet-.35)*1.35));
     if(eaten>0){
      const calories=eaten*5.7*effectivePlantAffinity(u)*clamp(g.wet,0,1);
      u.energy+=calories;
      u.recentFood=(u.recentFood??0)+eaten*4;
      if(u.stage==='juvenile')u.juvenileFood+=calories;
      u.forageSuccess++;
      if((this.tick+u.id)%9===0)this.addVisualEffect('waterweed',u,{fromX:coastWeed.x,fromY:coastWeed.y});
      this.log('meal','#'+u.id+' が岸辺から水草を採食した',u);
     }
    }
   }
   if(!flight&&(!aquatic||onLand)&&diet.plant>0&&nearest&&distance(u,nearest)<(m.biteReach+13)**2){
    const forageTerrain=this.terrain(nearest.x,nearest.y);
    const forageLimit=forageTerrain===0?4.8:forageTerrain===2?1.3:forageTerrain===3?1.8:1.2;
    const eaten=this.consumeGrass(nearest.x,nearest.y,
     Math.min(forageLimit,1.05*m.foodGain*feedingCapacity(u)));
    if(eaten>0){
     const foodYield=forageTerrain===0?10.5:forageTerrain===3?8.5:4.8;
     u.energy+=eaten*foodYield*effectivePlantAffinity(u)*home.fitness*(forageTerrain===3?.75+.65*(g.rock??0):1);
     u.recentFood=(u.recentFood??0)+eaten*4;
     u.forageSuccess++;
     u.seedBank=Math.min(100,(u.seedBank??0)+eaten*.35);
     if(u.stage==='juvenile')u.juvenileFood+=eaten*foodYield*effectivePlantAffinity(u)*home.fitness*(forageTerrain===3?.75+.65*(g.rock??0):1);
     // Plant calories fund metabolism, growth and slow HP recovery.
     if((this.tick+u.id)%9===0)this.addVisualEffect('graze',u,{fromX:nearest.x,fromY:nearest.y});
     this.log('meal','#'+u.id+' が草を食べた',u);}
   }
   this.feedOffspring(u,near);
   if(g.dna?.skillCooperate===1)this.shareFoodWithAlly(u,near);
    // A carnivore can also scavenge a corpse: deserts cannot support herbivores.
   if(!flight&&(effectiveMeatAffinity(u)>.15||famineCannibalism(u)||g.dna?.skillAbsorb===1)&&nearestCorpse&&distance(u,nearestCorpse)<(m.biteReach+14)**2&&u.energy<175){
    const eaten=Math.min(nearestCorpse.mass,2.4*m.foodGain*feedingCapacity(u));
    nearestCorpse.mass-=eaten;
    const absorption=g.dna?.skillAbsorb===1?.42:0;
    const recovered=eaten*5.8*Math.max(effectiveMeatAffinity(u),absorption);
    u.energy+=recovered;
    if(eaten>0&&effectiveMeatAffinity(u)>.15){
     const previous=carnivoryExperience(u);learnCarnivory(u,eaten);
     if(previous<.25&&carnivoryExperience(u)>=.25)
      this.log('carnivoreLearn','#'+u.id+' が肉食に順化し始めた',u);
    }
    u.recentFood=(u.recentFood??0)+eaten*4;
    if(u.stage==='juvenile')u.juvenileFood+=recovered;
    if(eaten>0){if((this.tick+u.id)%9===0)this.addVisualEffect('scavenge',u,{fromX:nearestCorpse.x,fromY:nearestCorpse.y});this.log('meal','#'+u.id+' が死体を食べた',u);}
   }
   if(!flight&&!defenderTarget&&targetEgg&&!targetEgg.dead&&u.bite===0&&distance(u,targetEgg)<(m.biteReach+4)**2)this.eatEgg(targetEgg,u);
   if(defenderTarget&&!defenderTarget.dead&&u.bite===0&&distance(u,defenderTarget)<(m.biteReach+defenderTarget.g.r+5)**2)
    this.attack(u,defenderTarget,true);
   if(!flight&&!defenderTarget&&mate&&!u.courtPartner&&!mate.courtPartner&&distance(u,mate)<38**2){
     if(this.startCourtship(u,mate)){u.mateTarget=null;mate.mateTarget=null;}
    }
   if(counterAttack&&!flight&&u.bite===0&&
     distance(u,threatAttacker)<(m.biteReach+threatAttacker.g.r+4)**2){
    u.retaliationCooldown=this.tick+65;
    if(this.attack(u,threatAttacker,'retaliation'))u.attackResponse=null;
   }
   if(rival&&!flight&&!rival.dead&&distance(u,rival)<(m.biteReach+rival.g.r+3)**2)
     this.attack(u,rival,'rival');
    if(!flight&&effectiveMeatAffinity(u)>0&&prey&&!prey.dead&&
      (this.terrain(prey.x,prey.y)!==1||aquatic)&&
      distance(u,prey)<(m.biteReach+prey.g.r)**2){
     this.attack(u,prey);
    }
   const newTerrain=this.terrain(u.x,u.y);
   if(newTerrain!==u.lastTerrain){u.lastTerrain=newTerrain;this.terrainCrossings++;}
   if(u.stage==='juvenile'){
    const adaptability=clamp(((g.dna?.adaptation??1)-1)/9,0,1);
    const mismatch=Math.max(0,1-home.fitness);
    const increment=juvenileGrowthIncrement(u,u.juvenileFood,u.habitatLoad,u.crowdStress)*
     (1+.55*adaptability*mismatch);
    u.juvenileGrowth=Math.min(1,(u.juvenileGrowth??0)+increment);
    // Tissue growth uses nutrients that cannot also pay for maintenance.
    u.energy-=increment*38;
    // Poorly fed hatchlings stop growing; common starvation damage applies.
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
   if(u.stage==='adult'&&(u.habitatLoad??0)<.45&&u.energy>energyNeeded&&u.recentFood>foodNeeded&&u.growthScale<adultGrowthCeiling(g)){
    const baseRate=.0018+Math.min(.003,u.recentFood*.00014);
    const increment=Math.min(adultGrowthCeiling(g)-u.growthScale,baseRate*(exceptional?.42:1)*(1-.66*metabolicFrugality(g)));
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
   if(u.growthScale>adultGrowthCeiling(g))
    u.growthScale=Math.max(adultGrowthCeiling(g),u.growthScale-.01);
   if((u.growthScale??1)>1.03&&u.energy<85){
    // Tissue catabolism limits the energy burden of exceptional size.
    // It does not grant energy/HP: starvation and natural selection remain.
    const hunger=clamp((85-u.energy)/85,0,1);
    const maintenance=acquiredSizeMaintenance(u);
    const shrink=.002+.008*hunger+Math.min(.007,maintenance*.00018);
    u.growthScale=Math.max(1,u.growthScale-shrink);
   }
   // Reconcile hit points with actual body mass, including shrinkage.
   u.maxHp=Math.max(25,Math.round(organismMorphology(u).bodyMass*.48+25));
   u.hp=Math.min(u.hp,u.maxHp);
   // Limit stored reserves so immobile giants cannot live on old stockpiles.
   if((u.growthScale??1)>1.05)u.energy=Math.min(u.energy,energyStorageLimit(u));
   this.updateVitalHealth(u);
   if(u.hp<=0)this.die(u,this.vitalDeathCause(u));
  }
  this.supportZones=this.supportZones.filter(z=>z.until>this.tick);
  this.resolveUnitOverlap();
  this.updateCourtships();
  this.units=this.units.filter(u=>!u.dead);this.eggs=this.eggs.filter(e=>!e.dead);
   // Unhatched eggs can repopulate the world: extinction requires both to vanish.
   if(this.runStartTick!==null&&this.runEndedTick===null&&this.units.length===0&&this.eggs.length===0)this.runEndedTick=this.tick;
  for(const trail of this.eggTrails)trail.age++;
  this.eggTrails=this.eggTrails.filter(t=>t.age<t.life);
  // Diversity must persist through environmental cycles to earn a bonus.
  // This is a score only; no cap or survival subsidy is introduced.
  if(this.runStartTick!==null&&this.runEndedTick===null&&this.tick%20===0&&
    this.units.length>=8&&this.units.length<=200&&
    this.eggs.length<=this.units.length*3&&this.livingSpecies>=2)
   this.ecosystemBalance+=10;
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
 // Game-mode landscape sculpting: exactly one 20px tile per purchase.
 // Unlike lab paint(), no free bulk biomass, random state or arbitrary brush.
 reshapeTerrainCell(x,y,target){
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=W||y>=H||
     !Number.isInteger(target)||target<0||target>3)return false;
  const i=this.cell(x,y),from=this.tiles[i];
  if(from===target)return false;
  // Never overwrite occupied habitat, eggs or corpses; preserve existing lives.
  if(this.units.some(u=>!u.dead&&this.cell(u.x,u.y)===i)||
     this.eggs.some(e=>!e.dead&&this.cell(e.x,e.y)===i))return false;
  // Ponds must connect to existing ponds: a channel or shoreline, not
  // cheap isolated infinite water sources.
  if(target===1){
   const cx=i%NX,cy=Math.floor(i/NX);
   const neighbors=[cx>0?i-1:-1,cx<NX-1?i+1:-1,cy>0?i-NX:-1,cy<NY-1?i+NX:-1];
   if(!neighbors.some(j=>j>=0&&this.tiles[j]===1))return false;
  }
  this.tiles[i]=target;
  this.terrainLevels[i]=3;
  this.grass[i]=target===0?28:target===2?3:target===3?12:0;
  this.waterbed[i]=target===1?1:0;
  this.water[i]=target===1?60:0;
  this.waterweed[i]=target===1?30:0;
  this.soilWater[i]=target===0?48:target===1?90:target===2?20:8;
  // Fertile soil is not conjured at full strength by changing the terrain.
  this.soil[i]=Math.min(this.soil[i],target===0?55:target===1?30:target===2?20:10);
  this.grazingPressure[i]=0;
  this._waterRegionTick=null;
  this._waterRegions=null;
  return true;
 }
 paint(x,y,type,radius,level=3){
  this._waterRegionTick=null; // terrain paint can join/split a pond within a paused tick
  const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL);
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(dx*dx+dy*dy>radius*radius)continue;
   const xx=cx+dx,yy=cy+dy;if(xx<0||xx>=NX||yy<0||yy>=NY)continue;
   const i=yy*NX+xx;
   if(type===1&&this.units.some(u=>!u.dead&&u.g.aquatic!==1&&this.cell(u.x,u.y)===i))continue;
   this.tiles[i]=type;
   this.terrainLevels[i]=Math.max(1,Math.min(5,Math.round(level)));
   this.grass[i]=type===0?100:0;
   this.water[i]=type===1?100:0;
   this.waterweed[i]=type===1?70:0;
   this.waterbed[i]=type===1?1:0;
  }
 }

 adaptFounderToTerrain(g,t){
  if(g.genomeModel===2){
   const dna={...canonicalDNA(g),aquatic:t===1?1:0,biome:t};
   if(t===2||t===3)dna.diet=clamp(dna.diet,.43,.65);
   return expressDNA({dna,alleles:{
    ...g.alleles,aquatic:[dna.aquatic,dna.aquatic],biome:[t,t],
    ...(dna.diet!==g.diet?{diet:[dna.diet,dna.diet]}:{})
   }});
  }
  return this.adaptFounderToTerrain(expressDNA({dna:legacyToDNA(g)}),t);
 }
 founderSite(x,y,terrain){
  for(let attempt=0;attempt<24;attempt++){
   const px=clamp(x+this.range(-12,12),10,W-10);
   const py=clamp(y+this.range(-12,12),10,H-10);
   if(this.terrain(px,py)===terrain)return {x:px,y:py};
  }
  return {x:clamp(x,10,W-10),y:clamp(y,10,H-10)};
 }
 introduce(x,y,typeCount=1,customFounder=null){
  // Exactly N morphological founder types, 8 independent individuals per type.
  // The founding population is intentionally clustered, enabling sexual reproduction.
  const count=clamp(Math.trunc(Number(typeCount)||1),1,6);
  const founders=[];const used=new Set();
  for(let k=0;k<count;k++){
   let g,key;
   for(let attempt=0;attempt<60;attempt++){
    // A user-edited founder is authoritative; it must be exactly the previewed
    // genome, not a new RNG roll behind the player's back.
    if(k===0&&customFounder){
     g={...customFounder,alleles:Object.fromEntries(Object.entries(customFounder.alleles??{}).map(([name,pair])=>[name,[...pair]]))};
     key=this.category(g);
     break;
    }
    g=this.gene();
    // Initial viable feeding matters before the biome conversion.
    const dryFounder=this.terrain(x,y)===2||this.terrain(x,y)===3;
    if(k===0&&(!dryFounder&&g.diet>.28||morphology(g).bodyMass>100||g.eyes<2||!thermalFitness(g,this.temperatureAt(x,y)).reproduction))continue;
    // Select unique categories *after* terrain adaptation; otherwise six
    // original types can collapse to one biome-derived category.
    const clickedTerrain=this.terrain(x,y);
    g=this.adaptFounderToTerrain(g,clickedTerrain);
    key=this.category(g);
    if(!used.has(key))break;
   }
   if(used.has(key))continue;
   const placedTerrain=this.terrain(x,y);
   used.add(key);
   const foundingLineage='founder-'+this.nextId;
   let spawned=0;
   for(let i=0;i<8;i++){
    // Small variation, but no change to the adaptation category of the founder.
    let variant=g;
    if(i>1){
     // Keep the initial female/male pair genetically compatible;
     // subsequent founders still have inherited diversity.
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
    // Prevent an unwinnable founder cohort with no compatible sexes.
    if(reproductiveMode(variant)===0)u.sex=i%2===0?'F':'M';
    u.age=i<2?62:Math.floor(this.range(48,64));
    u.energy=i<2?145:this.range(115,145);
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
   const establishedSpecies=started?[...this.species.values()].filter(sp=>sp.establishedByGeneration&&sp.establishedByPopulation).length:0;
   const sustained=started?[...this.species.values()].filter(sp=>sp.establishedByGeneration).length:0;
   const expanded=started?[...this.species.values()].filter(sp=>sp.establishedByPopulation).length:0;
   const balanceScore=started?(this.ecosystemBalance??0):0;
   // Reward lineages that survive across generations rather than only creating
   // many short-lived species. Dead species cannot earn the stability bonus.
   const stableLiving=started?[...this.species.values()].filter(sp=>
    sp.current>0&&sp.establishedByGeneration).length:0;
   const discoveryScore=discoveries*120;
   const establishmentScore=establishedSpecies*650;
   const stabilityScore=stableLiving*220;
   return {started,ended:this.runEndedTick!==null,duration,discoveries,establishedSpecies,sustained,expanded,stableLiving,
    survivalScore:duration,discoveryScore,establishmentScore,stabilityScore,balanceScore,
    total:duration+discoveryScore+establishmentScore+stabilityScore+balanceScore};
  }
  get livingSpecies(){return [...this.species.values()].filter(s=>s.current>0).length;}
 get recentSpecies(){return this.discoveries.filter(t=>this.tick-t<300).length;}
}
export const WORLD={width:W,height:H,cell:CELL,columns:NX,rows:NY};
