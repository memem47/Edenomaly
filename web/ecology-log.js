// Persistent, version-scoped ecology time-series log.
import {morphology,organismMorphology,adultGrowthCeiling} from './simulation.js';
// Only observations are saved; the full running ecosystem is not saved.
export const ECOLOGY_LOG_KEY='edenomaly:ecology-observations';
export const ECOLOGY_LOG_INTERVAL=50;
export const INDIVIDUAL_DIAG_FIELDS=['run','version','step','id','sex','energy','required','reason','mateId','mateDistance','target','approachSteps','approachFailures','courtPartner','hpPercent',
 'generation','age','stage','species','geneticRadius','geneticMass','growthScale','actualMass','growthLimit','frugality','recentFood','habitatLoad'];
export const ECOLOGY_LOG_FIELDS=[
 'run','version','step','population','adults','juveniles','eggs',
 'livingSpecies','discoveredSpecies','maxGeneration','herbivores','omnivores','carnivores',
 'grass','waterweed','food','corpses','water','soilMean','meanEnergy','meanHpPercent',
 'meanHabitatLoad','infected','births','deaths','deathStarvation',
 'deathPredation','deathInfection','deathOther','matings','courtshipStarts',
 'courtshipFailures','mateApproachStarts','mateApproachStalled','courtFailTemperature','courtFailEnergy','courtFailInfection',
 'courtFailSeparated','courtFailStalled','courtFailConception','courtFailOther','reproReady','reproTemperature',
 'reproInfection','reproImmature','reproEnergy','reproCooldown','reproPregnancy',
 'reproWeak','reproNoPartner','reproPaired','meanPreferredTemp','meanTempTolerance',
 'dormantAdults','dormantEggs','forageSuccess','forageFailure','meanHibernate',
  'frugalAdults','aquaticGardeners','waterPlantings','meanFrugality','meanWaterGardening','landExplorers','meanLandAcclimation','cannibalMeals','learnedCarnivores','acquiredCarnivores','meanCarnivoryExperience',
 'geneticMassMean','geneticMassP50','geneticMassP90','geneticMassGiantCount',
 'adultGeneticMassMean','adultGrowthMean','adultGrowthP50','adultGrowthP90',
 'adultGrowthOver150','adultGrowthOver235','adultGrowthOver300',
 'adultActualMassMean','adultActualMassP90','adultFrugalityMean',
 'adultGrowingCount','adultHighEnergyCount',
 'geneticSmallCount','geneticMediumCount','geneticLargeCount','geneticGiantCount',
 'acquiredSmallCount','acquiredMediumCount','acquiredLargeCount','acquiredGiantCount',
 'temperature','season','growthSetting','rainfallSetting','stressSetting'
];
const finite=v=>Number.isFinite(v)?Math.round(v*100)/100:0;
const percentile=(arr,p)=>{
 if(!arr.length)return 0;
 const values=[...arr].sort((a,b)=>a-b);
 const index=(values.length-1)*p,lo=Math.floor(index),hi=Math.ceil(index);
 return finite(values[lo]+(values[hi]-values[lo])*(index-lo));
};
const massBin=mass=>mass<45?0:mass<105?1:mass<195?2:3;
export function observeEcology(game){
 let grass=0,waterweed=0,water=0,soil=0,juveniles=0,herbivores=0,omnivores=0,
  carnivores=0,energy=0,hp=0,habitatLoad=0,infected=0,maxGeneration=0,idealTotal=0,toleranceTotal=0,dormantAdults=0,forageSuccess=0,forageFailure=0,hibernateTotal=0,frugalAdults=0,aquaticGardeners=0,frugalityTotal=0,gardeningTotal=0,landExplorers=0,landAcclimationTotal=0,learnedCarnivores=0,acquiredCarnivores=0,carnivoryTotal=0;
 const geneticMasses=[],adultGeneticMasses=[],adultGrowths=[],adultActualMasses=[];
 const geneticCounts=[0,0,0,0],actualCounts=[0,0,0,0];
 let adultFrugality=0,adultGrowingCount=0,adultHighEnergyCount=0,adultGrowthOver150=0,adultGrowthOver235=0,adultGrowthOver300=0;
 for(let i=0;i<game.grass.length;i++){
  grass+=game.grass[i];waterweed+=game.waterweed[i];water+=game.water[i];soil+=game.soil[i];
 }
 for(const u of game.units){
  if(u.dead)continue;
  const geneticMass=morphology(u.g).bodyMass;
  geneticMasses.push(geneticMass);geneticCounts[massBin(geneticMass)]++;
  if(u.stage==='adult'){
   const scale=u.growthScale??1;
   adultGeneticMasses.push(geneticMass);
   adultGrowths.push(scale);
   const actualMass=organismMorphology(u).bodyMass;
   adultActualMasses.push(actualMass);actualCounts[massBin(actualMass)]++;
   adultFrugality+=u.g.frugality??0;
   if(scale>1.5)adultGrowthOver150++;
   if(scale>2.35)adultGrowthOver235++;
   if(scale>3)adultGrowthOver300++;
   if(u.energy>158&&u.recentFood>16&&(u.habitatLoad??0)<.45&&scale<adultGrowthCeiling(u.g))adultGrowingCount++;
   if(u.energy>205)adultHighEnergyCount++;
  }
  if(u.stage==='juvenile')juveniles++;
  carnivoryTotal+=u.carnivoryExperience??0;
  if((u.carnivoryExperience??0)>=.25)learnedCarnivores++;
  if(u.g.diet<=.7&&u.g.diet+(1-u.g.diet)*(u.carnivoryExperience??0)>.70)acquiredCarnivores++;
  if(u.g.diet<.3)herbivores++;else if(u.g.diet>.7)carnivores++;else omnivores++;
  idealTotal+=u.g.idealTemp??22;toleranceTotal+=u.g.tempTolerance??9;
  hibernateTotal+=u.g.hibernate??0;dormantAdults+=u.dormant?1:0;
  frugalityTotal+=u.g.frugality??0;gardeningTotal+=u.g.waterGardening??0;
  if(u.g.aquatic===1){landAcclimationTotal+=u.landAcclimation??0;
   if(game.terrain(u.x,u.y)!==1)landExplorers++;}

  if(u.stage==='adult'&&(u.g.frugality??0)>=.55)frugalAdults++;
  if(u.g.aquatic===1&&(u.g.waterGardening??0)>=.4)aquaticGardeners++;
  forageSuccess+=u.forageSuccess??0;forageFailure+=u.forageFailure??0;
  energy+=u.energy;hp+=u.hp/Math.max(1,u.maxHp);
  habitatLoad+=u.habitatLoad??0;
  infected+=u.infection>0?1:0;
  maxGeneration=Math.max(maxGeneration,u.generation);
 }
 const n=game.units.filter(u=>!u.dead).length,totalBirths=[...game.species.values()].reduce((sum,s)=>sum+s.total,0);
 const causes=game.deathCauses??{};
 const starvation=causes['飢餓']??0;
 const predation=(causes['捕食']??0)+(causes['卵の捕食']??0);
 const infection=causes['感染症']??0;
 const deaths=Object.values(causes).reduce((a,b)=>a+b,0);
 const census=game.reproductionCensus();
 const failures=game.courtshipFailures??{};
 const failureTotal=Object.values(failures).reduce((a,b)=>a+b,0);
 return {
  step:game.tick,population:n,adults:n-juveniles,juveniles,eggs:game.eggs.length,
  livingSpecies:game.livingSpecies,discoveredSpecies:game.species.size,
  maxGeneration,herbivores,omnivores,carnivores,
  grass:finite(grass),waterweed:finite(waterweed),food:finite(grass+waterweed),corpses:game.corpses.length,water:finite(water),
  soilMean:finite(soil/game.soil.length),
  meanEnergy:finite(n?energy/n:0),meanHpPercent:finite(n?hp/n*100:0),
  meanHabitatLoad:finite(n?habitatLoad/n:0),infected,
  births:totalBirths,deaths,deathStarvation:starvation,
  deathPredation:predation,deathInfection:infection,
  deathOther:deaths-starvation-predation-infection,
  matings:game.matings,
  courtshipStarts:game.courtshipStarts??0,courtshipFailures:failureTotal,
  mateApproachStarts:game.mateApproachStarts??0,mateApproachStalled:game.mateApproachStalled??0,
  courtFailTemperature:failures.temperature??0,courtFailEnergy:failures.energy??0,
  courtFailInfection:failures.infection??0,courtFailSeparated:failures.separated??0,
  courtFailStalled:failures.stalled??0,courtFailConception:failures.conception??0,
  courtFailOther:failureTotal-(failures.temperature??0)-(failures.energy??0)-
   (failures.infection??0)-(failures.separated??0)-(failures.stalled??0)-(failures.conception??0),
  reproReady:census.ready,reproTemperature:census.temperature,
  reproInfection:census.infection,reproImmature:census.immature,
  reproEnergy:census.energy,reproCooldown:census.cooldown,
  reproPregnancy:census.pregnancy,reproWeak:census.weak,
  reproNoPartner:census.noPartner,reproPaired:census.paired,
  meanPreferredTemp:finite(n?idealTotal/n:0),meanTempTolerance:finite(n?toleranceTotal/n:0),
  dormantAdults,dormantEggs:game.eggs.filter(e=>!e.dead&&e.dormant).length,
  forageSuccess,forageFailure,meanHibernate:finite(n?hibernateTotal/n:0),
  frugalAdults,aquaticGardeners,waterPlantings:game.waterPlantings??0,
  meanFrugality:finite(n?frugalityTotal/n:0),
  meanWaterGardening:finite(n?gardeningTotal/n:0),landExplorers,
  meanLandAcclimation:finite(n?landAcclimationTotal/n:0),
  cannibalMeals:game.cannibalMeals??0,learnedCarnivores,acquiredCarnivores,
  meanCarnivoryExperience:finite(n?carnivoryTotal/n:0),
  geneticMassMean:finite(n?geneticMasses.reduce((a,b)=>a+b,0)/n:0),
  geneticMassP50:percentile(geneticMasses,.5),
  geneticMassP90:percentile(geneticMasses,.9),
  geneticMassGiantCount:geneticCounts[3],
  adultGeneticMassMean:finite(adultGeneticMasses.length?adultGeneticMasses.reduce((a,b)=>a+b,0)/adultGeneticMasses.length:0),
  adultGrowthMean:finite(adultGrowths.length?adultGrowths.reduce((a,b)=>a+b,0)/adultGrowths.length:0),
  adultGrowthP50:percentile(adultGrowths,.5),
  adultGrowthP90:percentile(adultGrowths,.9),
  adultGrowthOver150,adultGrowthOver235,adultGrowthOver300,
  adultActualMassMean:finite(adultActualMasses.length?adultActualMasses.reduce((a,b)=>a+b,0)/adultActualMasses.length:0),
  adultActualMassP90:percentile(adultActualMasses,.9),
  adultFrugalityMean:finite(adultGrowths.length?adultFrugality/adultGrowths.length:0),
  adultGrowingCount,adultHighEnergyCount,
  geneticSmallCount:geneticCounts[0],geneticMediumCount:geneticCounts[1],
  geneticLargeCount:geneticCounts[2],geneticGiantCount:geneticCounts[3],
  acquiredSmallCount:actualCounts[0],acquiredMediumCount:actualCounts[1],
  acquiredLargeCount:actualCounts[2],acquiredGiantCount:actualCounts[3],
  temperature:finite(game.temperature),
  season:game.climateEnabled?game.seasonName():'off',
  growthSetting:game.growth,rainfallSetting:game.rainfall,stressSetting:game.stress
 };
}
export class EcologyLogbook{
 constructor(storage,version){
  if(!version||typeof version!=='string')throw new Error('Log version required');
  this.storage=storage;this.version=version;this.activeId=null;
  this.data={version,runs:[],nextId:1};
  try{
   const previous=JSON.parse(storage?.getItem(ECOLOGY_LOG_KEY)??'null');
   if(previous?.version===version&&Array.isArray(previous.runs)){
    this.data={version,runs:previous.runs,nextId:previous.nextId??1};
   }else this.save(); // Version change overwrites obsolete logs.
  }catch{this.data={version,runs:[],nextId:1};this.save();}
 }
 save(){
  try{if(!this.storage){this.lastSaveOk=false;return false;}this.storage.setItem(ECOLOGY_LOG_KEY,JSON.stringify(this.data));this.lastSaveOk=true;return true;}
  catch{this.lastSaveOk=false;return false;} // Private mode / storage quota may disable persistence.
 }
 start(seed){
  const id=this.data.nextId++;
  this.activeId=id;
  this.data.runs.push({id,seed,startedAt:new Date().toISOString(),samples:[],individuals:[]});
  this.save();
  return id;
 }
 record(observation,force=false){
  const run=this.data.runs.find(r=>r.id===this.activeId);
  if(!run||!observation)return false;
  if(!force&&observation.step%ECOLOGY_LOG_INTERVAL!==0)return false;
  const row={run:run.id,version:this.version,...observation};
  const previous=run.samples.at(-1);
  if(previous?.step===row.step)run.samples[run.samples.length-1]=row;
  else if(!previous||row.step>previous.step)run.samples.push(row);
  else return false;
  this.save();return true;
 }
 recordIndividuals(world,force=false){
  const run=this.data.runs.find(r=>r.id===this.activeId);
  if(!run||!world||!force&&world.tick%ECOLOGY_LOG_INTERVAL!==0)return false;
  run.individuals??=[];
  // Limit browser storage use in dense populations, retaining recent records.
  const population=world.units.filter(u=>!u.dead);
  // Spread deterministic samples across the population rather than over-representing old IDs.
  const sample=population.length<=48?population:Array.from({length:48},(_,i)=>population[Math.floor((i+.5)*population.length/48)]);
  for(const u of sample)run.individuals.push({
   run:run.id,version:this.version,...world.reproductionDiagnostic(u),
   generation:u.generation,age:u.age,stage:u.stage,species:u.category,
   geneticRadius:finite(u.g.r),geneticMass:finite(morphology(u.g).bodyMass),
   growthScale:finite(u.growthScale??1),actualMass:finite(organismMorphology(u).bodyMass),
   growthLimit:finite(adultGrowthCeiling(u.g)),frugality:finite(u.g.frugality??0),
   recentFood:finite(u.recentFood??0),habitatLoad:finite(u.habitatLoad??0)
  });
  if(run.individuals.length>6000)run.individuals.splice(0,run.individuals.length-6000);
  this.save();return true;
 }
 toIndividualCSV(){
  const quoted=value=>{
   const str=String(value??'');
   return /[",\n\r]/.test(str)?'"'+str.replace(/"/g,'""')+'"':str;
  };
  const lines=[INDIVIDUAL_DIAG_FIELDS.join(',')];
  for(const run of this.data.runs)for(const sample of run.individuals??[])
   lines.push(INDIVIDUAL_DIAG_FIELDS.map(field=>quoted(sample[field])).join(','));
  return '\ufeff'+lines.join('\r\n')+'\r\n';
 }
 end(observation){
  if(this.activeId===null)return;
  this.record(observation,true);
  const run=this.data.runs.find(r=>r.id===this.activeId);
  if(run)run.endedAt=new Date().toISOString();
  this.activeId=null;this.save();
 }
 clear(){
  this.activeId=null;this.data={version:this.version,runs:[],nextId:1};
  return this.save();
 }
 get sampleCount(){return this.data.runs.reduce((n,r)=>n+r.samples.length,0);}
 toCSV(){
  const quoted=value=>{
   const text=String(value??'');
   return /[",\n\r]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;
  };
  const lines=[ECOLOGY_LOG_FIELDS.join(',')];
  for(const run of this.data.runs)for(const sample of run.samples)
   lines.push(ECOLOGY_LOG_FIELDS.map(field=>quoted(sample[field])).join(','));
  return '\ufeff'+lines.join('\r\n')+'\r\n';
 }
}
