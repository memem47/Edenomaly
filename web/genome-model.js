// Canonical DNA: six core stats, inherited skills and seven survival strategies.
// The 37 former ecology/appearance fields are *derived phenotype caches*,
// never independent inherited loci for v2 organisms.
export const CORE_KEYS=Object.freeze(['power','agility','stamina','intellect','adaptation','fertility']);
export const SKILLS=Object.freeze([
 {key:'skillWaterGardening',label:'水草栽培',effect:'waterGardening'},
 {key:'skillHibernate',label:'休眠',effect:'hibernate'},
 {key:'skillParentFeeding',label:'親の給餌',effect:'parentFeeding'},
 {key:'skillNestChoice',label:'産卵地選択',effect:'nestChoice'},
 {key:'skillRetaliation',label:'反撃',effect:'retaliation'},
 {key:'skillCannibalism',label:'幼体共食い',effect:'juvenileCannibalism'},
 {key:'skillSprint',label:'瞬発ダッシュ',effect:'sprint'},
 {key:'skillAmbush',label:'奇襲',effect:'ambush'},
 {key:'skillRegenerate',label:'自己再生',effect:'regeneration'}
]);
export const STRATEGY_FIELDS=Object.freeze([
 {key:'diet',label:'食性',min:0,max:1},
 {key:'aquatic',label:'生息型',min:0,max:1},
 {key:'repro',label:'繁殖方式',min:0,max:2},
 {key:'biome',label:'主適応地形',min:0,max:3},
 {key:'thermal',label:'好適気温',min:0,max:1},
 {key:'social',label:'群れ志向',min:0,max:1},
 {key:'albino',label:'白化',min:0,max:1}
]);
export const DNA_LIMITS=Object.freeze({
 ...Object.fromEntries(CORE_KEYS.map(k=>[k,[1,10]])),
 ...Object.fromEntries(SKILLS.map(s=>[s.key,[0,1]])),
 ...Object.fromEntries(STRATEGY_FIELDS.map(s=>[s.key,[s.min,s.max]]))
});
export const DNA_KEYS=Object.freeze(Object.keys(DNA_LIMITS));
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const step=(n,a,b)=>clamp(Number(n),a,b);
export function normalizeDNA(source={}){
 const dna={};
 for(const key of DNA_KEYS){
  const [lo,hi]=DNA_LIMITS[key];
  const raw=Number(source[key]);
  const d=CORE_KEYS.includes(key)?5:SKILLS.some(s=>s.key===key)?0:
   ({diet:.2,aquatic:0,repro:0,biome:0,thermal:.56,social:.5,albino:0}[key]??lo);
  const n=step(Number.isFinite(raw)?raw:d,lo,hi);
  dna[key]=CORE_KEYS.includes(key)||SKILLS.some(s=>s.key===key)||['aquatic','repro','biome','albino'].includes(key)?Math.round(n):n;
 }
 return dna;
}
export function legacyToDNA(g={}){
 const clamp10=n=>clamp(Math.round(n),1,10);
 const n=(k,def=.5)=>Number(g[k]??def);
 const dna={
  power:clamp10(1+9*(.5*n('retaliation')+.5*n('guard'))),
  agility:clamp10(1+9*n('dispersal')),
  stamina:clamp10(1+9*(n('resist')+n('frugality')+clamp((n('tempTolerance',10)-3)/15))/3),
  intellect:clamp10(1+9*(n('predatorSense')+n('caution')+n('nestChoice'))/3),
  adaptation:clamp10(1+9*(n('wet')+n('dry')+n('rock')+n('hibernate'))/4),
  fertility:clamp10(1+9*(clamp((n('brood',3)-1)/7)+n('shell')+n('parentFeeding')+n('yolkReserve'))/4),
  skillWaterGardening:n('waterGardening')>.47?1:0,
  skillHibernate:n('hibernate')>.54?1:0,
  skillParentFeeding:n('parentFeeding')>.53?1:0,
  skillNestChoice:n('nestChoice')>.52?1:0,
  skillRetaliation:n('retaliation')>.58?1:0,
  skillCannibalism:n('juvenileCannibalism')>.67?1:0,
  skillSprint:0,skillAmbush:0,skillRegenerate:0,
  diet:n('diet',.2),aquatic:Math.round(n('aquatic',0)),repro:Math.round(n('repro',0)),
  biome:n('aquatic',0)>=1?1:n('dry')>.72?2:n('rock')>.72?3:0,
  thermal:clamp((n('idealTemp',22)+5)/45),
  social:n('sociability'),albino:Math.round(n('albino',0))
 };
 return normalizeDNA(dna);
}
// The only source of inherited variation is dna + its two copies in alleles.
// Derived values remain on the returned object for existing simulation code.
export function expressDNA(source){
 const dna=normalizeDNA(source.dna??source);
 const q=k=>(dna[k]-1)/9,cl=k=>clamp(dna[k]);
 const s=k=>dna[k]===1;
 const power=q('power'),agility=q('agility'),stamina=q('stamina'),
  intellect=q('intellect'),adaptation=q('adaptation'),fertility=q('fertility');
 const biome=dna.biome;
 // Terrain specialization is a strategy, not a generic adaptation bonus.
 const wet=clamp(.22+(biome===1?.70:0));
 const dry=clamp(.22+(biome===2?.72:0));
 const rock=clamp(.22+(biome===3?.72:0));
 const guard=clamp((.10+.79*power)*(1-.65*dna.diet));
 const retaliation=s('skillRetaliation')?clamp(.35+.60*power):0;
 const nestChoice=s('skillNestChoice')?clamp(.20+.75*intellect):0;
 const parentFeeding=s('skillParentFeeding')?clamp(.20+.74*fertility):0;
 const brood=Math.max(1,Math.min(8,Math.round(1+7*fertility)));
 const g={
  ...source,...dna,dna,genomeModel:2,functionalBody:true,bodyOverrides:[],
  diet:dna.diet,aquatic:dna.aquatic,repro:dna.repro,albino:dna.albino,
  wet,dry,rock,idealTemp:-5+45*dna.thermal,
  tempTolerance:3+15*stamina,hibernate:s('skillHibernate')?clamp(.28+.72*adaptation):0,
  resist:clamp(.09+.87*stamina),frugality:clamp(.12+.82*stamina),
  longevity:.6+1.2*fertility+.2*(s('skillRegenerate')?1:0),
  waterGardening:s('skillWaterGardening')?clamp(.35+.65*adaptation):0,
  shell:clamp(.08+.84*fertility),guard,
  nesting:clamp(.14+.57*fertility+.20*intellect),
  nestChoice,parentFeeding,
  yolkReserve:clamp(.08+.79*fertility),brood,
  juvenileCannibalism:s('skillCannibalism')?clamp(.30+.60*dna.diet):0,
  dispersal:clamp(.09+.86*agility),sociability:clamp(dna.social),
  caution:clamp(.12+.78*intellect),predatorSense:clamp(.12+.79*intellect),
  retaliation,deception:clamp(.12+.42*intellect+.20*(1-power)),
  tailLength:clamp(.13+.56*wet+.18*agility+.12*(s('skillSprint')?1:0)), 
  hornLength:clamp(.08+.56*power+.27*retaliation+.12*(s('skillAmbush')?1:0)),
  antennaLength:clamp(.07+.67*intellect+.20*agility+.10*(s('skillRegenerate')?1:0)),
  pattern:clamp(.08+.79*adaptation),
  r:3+12*Math.pow(.27*dna.diet+.24*fertility+.24*power+.25*stamina,2.7),
  elongation:.85+2.15*Math.pow(.42*agility+.24*stamina+.19*wet+.15*dna.aquatic,2.4),
  eyes:Math.round(6*(.70*intellect+.30*agility)),
  mouths:1+Math.round(3*(.47*dna.diet+.29*stamina+.24*fertility)),
  jaw:.2+2.3*(.63*dna.diet+.37*power)
 };
 const alleles={};
 for(const key of DNA_KEYS){
  const pair=source.alleles?.[key];
  alleles[key]=Array.isArray(pair)&&pair.length===2?[...pair]:[dna[key],dna[key]];
 }
 g.alleles=alleles;
 return g;
}
export const canonicalDNA=g=>normalizeDNA(g.dna??legacyToDNA(g));
