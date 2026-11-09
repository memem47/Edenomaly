// Species-wide, exact distribution summaries. Birth traits retain every
// individual's numeric value (even after extinction); active physiology is
// measured from currently living individuals at export/snapshot time.
// Never consume ecology RNG. No imported simulation module (avoids cycles).
export const SPECIES_METRIC_LABELS={
 idealTemp:'好みの温度',tempTolerance:'温度耐性',hibernate:'休眠傾向',
 longevity:'寿命特性',r:'遺伝的半径',elongation:'体の縦横比',
 eyes:'目の数',mouths:'口能力',jaw:'顎',wet:'水適応',dry:'乾燥適応',rock:'岩適応',
 shell:'卵殻',guard:'保護',nesting:'巣づくり',brood:'産卵数',
 diet:'肉食傾向',deception:'擬態',resist:'感染耐性',aquatic:'水生遺伝子',
 albino:'白色変異',repro:'繁殖方式',dispersal:'分散',sociability:'集合',
 caution:'警戒',predatorSense:'捕食者感知',retaliation:'反撃',
 frugality:'省エネ',waterGardening:'水草栽培',
 tailLength:'しっぽ',hornLength:'角',antennaLength:'触角',pattern:'模様',
 geneticMass:'遺伝的体重',geneticWidth:'遺伝的幅',geneticLength:'遺伝的全長',
 baseSpeed:'基礎速度',eyeRange:'視野距離',turnRate:'回転速度',
 biteReach:'攻撃到達距離',edibleRatio:'捕食可能体格比',
 upkeep:'基礎代謝',foodGain:'摂食効率',maxHp:'生来の最大HP',
 energy:'エネルギー',hpPercent:'HP残量(%)',hydration:'水分',
 age:'年齢',generation:'世代',growthScale:'後天的成長倍率',
 actualMass:'実際の体重',infection:'感染度',recentFood:'直近の摂食',
 landAcclimation:'陸上順化',carnivoryExperience:'後天的肉食順化'
};
export const SPECIES_CSV_FIELDS=['run','version','step','species','category',
 'firstSeen','current','total','scope','metric','label','samples','min','median','max'];
const numeric=(v)=>typeof v==='number'&&Number.isFinite(v);
const round=v=>Math.round((v+Number.EPSILON)*1000)/1000;
export const medianOf=values=>{
 if(!values.length)return null;
 const data=[...values].sort((a,b)=>a-b),i=Math.floor(data.length/2);
 return data.length%2?data[i]:(data[i-1]+data[i])/2;
};
export function appendSpeciesBirth(store,key,g,derived={}){
 let entry=store.get(key);
 if(!entry){entry=new Map();store.set(key,entry);}
 // Birth quantiles are unchanged until the next birth in this species.
 entry.birthSummaryCache=null;
 for(const [metric,value] of Object.entries({...g,...derived})){
  if(!numeric(value)||metric==='alleles'||metric==='sizeBaseRadius')continue;
  let values=entry.get(metric);
  if(!values){values=[];entry.set(metric,values);}
  values.push(value);
 }
}
export const birthDerived=(g,morph)=>({
 geneticMass:morph.bodyMass,geneticWidth:morph.width,geneticLength:morph.length,
 baseSpeed:morph.speed,eyeRange:morph.eyeRange,turnRate:morph.turnRate,
 biteReach:morph.biteReach,edibleRatio:morph.edibleRatio,
 upkeep:morph.upkeep,foodGain:morph.foodGain,
 maxHp:Math.max(25,Math.round(morph.bodyMass*.48+25))
});
const livingValues=u=>({
 energy:u.energy,hpPercent:u.maxHp?100*u.hp/u.maxHp:0,
 hydration:u.hydration,age:u.age,generation:u.generation,
 growthScale:u.growthScale??1,actualMass:null,
 infection:u.infection??0,recentFood:u.recentFood??0,
 landAcclimation:u.landAcclimation??0,
 carnivoryExperience:u.carnivoryExperience??0
});
const distribution=(values)=>{
 if(!values?.length)return null;
 let min=Infinity,max=-Infinity;
 for(const v of values){if(v<min)min=v;if(v>max)max=v;}
 return {samples:values.length,min:round(min),
  median:round(medianOf(values)),max:round(max)};
};
export function speciesReport(world,{run=1,version='development'}={}){
 const active=new Map();
 for(const u of world.units)if(!u.dead){
  let entry=active.get(u.category);
  if(!entry){entry=new Map();active.set(u.category,entry);}
  for(const [field,value] of Object.entries(livingValues(u))){
   if(!numeric(value))continue;
   let values=entry.get(field);
   if(!values){values=[];entry.set(field,values);}values.push(value);
  }
  // Actual mass uses acquired growth, unlike geneticMass at birth.
  const radius=u.g.sizeBaseRadius??u.g.r;
  const t=Math.max(0,Math.min(1,(radius-10)/5));
  const mult=1.7*(.5+.5*t*t);
  const mass=(u.g.r*mult)**2*u.g.elongation*(u.growthScale??1)**2;
  if(numeric(mass)){
   if(!entry.has('actualMass'))entry.set('actualMass',[]);
   entry.get('actualMass').push(mass);
  }
 }
 const rows=[];
 for(const [key,species] of world.species){
  const groups=[['birth',world.speciesSamples?.get(key)],['living',active.get(key)]];
  for(const [scope,metrics] of groups){
   if(!metrics)continue;
   // Reuse exact birth quantiles across UI updates and 50-step snapshots.
   // The cache is invalidated only when a new organism of this species is born.
   const summaries=scope==='birth'?
    (metrics.birthSummaryCache??=(Array.from(metrics,([metric,values])=>[metric,distribution(values)]))):
    Array.from(metrics,([metric,values])=>[metric,distribution(values)]);
   for(const [metric,dist] of summaries){
    if(!dist)continue;
    rows.push({run,version,step:world.tick,species:species.name,category:key,
     firstSeen:species.first,current:species.current,total:species.total,
     scope,metric,label:SPECIES_METRIC_LABELS[metric]??metric,...dist});
   }
  }
 }
 return rows;
}
export const csvCell=value=>{
 const s=String(value??'');
 return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
};
export function speciesCSV(rows){
 return '\ufeff'+[SPECIES_CSV_FIELDS.join(','),...rows.map(row=>
  SPECIES_CSV_FIELDS.map(field=>csvCell(row[field])).join(','))].join('\r\n')+'\r\n';
}
// RFC4180-style CSV parser; quoted fields, BOM, embedded commas and newlines.
export function parseSpeciesCSV(text){
 let field='',record=[],records=[],inQuote=false;
 const str=String(text).replace(/^\ufeff/,'');
 for(let i=0;i<str.length;i++){
  const c=str[i];
  if(inQuote){
   if(c==='"'&&str[i+1]==='"'){field+='"';i++;}
   else if(c==='"')inQuote=false;
   else field+=c;
  }else if(c==='"')inQuote=true;
  else if(c===','){record.push(field);field='';}
  else if(c==='\n'||c==='\r'){
   if(c==='\r'&&str[i+1]==='\n')i++;
   record.push(field);field='';
   if(record.some(v=>v!==''))records.push(record);
   record=[];
  }else field+=c;
 }
 if(inQuote)throw new Error('引用符が閉じていません');
 record.push(field);if(record.some(v=>v!==''))records.push(record);
 if(!records.length)return [];
 const headers=records.shift();
 for(const required of ['species','category','scope','metric','min','median','max'])
  if(!headers.includes(required))throw new Error('列が不足しています: '+required);
 return records.map(values=>{
  const row=Object.fromEntries(headers.map((name,i)=>[name,values[i]??'']));
  for(const k of ['run','step','firstSeen','current','total','samples','min','median','max'])
   if(row[k]!==undefined)row[k]=Number(row[k]);
  return row;
 });
}
export class SpeciesLogbook{
 constructor(storage,version){
  this.storage=storage;this.version=version;this.activeId=null;
  this.data={version,nextId:1,runs:[]};
  try{
   const saved=JSON.parse(storage?.getItem('edenomaly:species-statistics')??'null');
   if(saved?.version===version&&Array.isArray(saved.runs))this.data=saved;
   else this.save();
  }catch{this.save();}
 }
 save(){
  try{if(!this.storage)return this.lastSaveOk=false;
   this.storage.setItem('edenomaly:species-statistics',JSON.stringify(this.data));
   return this.lastSaveOk=true;
  }catch{return this.lastSaveOk=false;}
 }
 start(seed){const id=this.data.nextId++;this.activeId=id;
  this.data.runs.push({id,seed,rows:[],startedAt:new Date().toISOString()});
  this.save();return id;
 }
 record(world,force=false){
  if(this.activeId===null||!world)return false;
  if(!force&&world.tick%50!==0)return false;
  const run=this.data.runs.find(r=>r.id===this.activeId);
  if(!run)return false;
  run.rows=speciesReport(world,{run:run.id,version:this.version});
  return this.save();
 }
 end(world){if(this.activeId===null)return;
  if(world)this.record(world,true);
  const run=this.data.runs.find(r=>r.id===this.activeId);
  if(run)run.endedAt=new Date().toISOString();
  this.activeId=null;this.save();
 }
 clear(){this.activeId=null;this.data={version:this.version,nextId:1,runs:[]};return this.save();}
 toCSV(){return speciesCSV(this.data.runs.flatMap(run=>run.rows??[]));}
}
