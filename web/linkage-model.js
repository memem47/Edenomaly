// Linked diploid inheritance. Each allele index is a homologous chromosome copy.
// Crossovers are shared between loci on a chromosome, not rolled independently.
import {DNA_KEYS,DNA_LIMITS,expressAllelePair} from './genome-model.js';
export const LINKAGE_GROUPS=Object.freeze([
 Object.freeze(['power','stamina','skillRetaliation','skillPredation','skillAmbush','diet']),
 Object.freeze(['agility','intellect','skillSprint','skillCooperate','skillNestChoice','skillCultivate','social']),
 Object.freeze(['adaptation','skillHibernate','skillRegenerate','aquatic','biome','thermal']),
 Object.freeze(['fertility','skillParentFeeding','skillNesting','skillSplit','repro']),
 Object.freeze(['skillWaterGardening','skillPondBuilder','skillDig','skillCannibalism','skillAbsorb','albino'])
]);
if(LINKAGE_GROUPS.flat().length!==DNA_KEYS.length||
 new Set(LINKAGE_GROUPS.flat()).size!==DNA_KEYS.length||
 DNA_KEYS.some(key=>!LINKAGE_GROUPS.flat().includes(key)))throw Error('Linkage groups must cover each DNA locus exactly once');
// Each adjacent pair has an ~8% chance of crossing over at meiosis.
// A single choice of homologue persists until a crossover occurs.
export function linkedGamete(genome,random=Math.random,crossoverRate=.08){
 const gamete={};
 for(const chromosome of LINKAGE_GROUPS){
  let homologue=random()<.5?0:1;
  for(let i=0;i<chromosome.length;i++){
   if(i&&random()<crossoverRate)homologue=1-homologue;
   const key=chromosome[i],pair=genome.alleles?.[key]??[genome.dna[key],genome.dna[key]];
   gamete[key]=pair[homologue];
  }
 }
 return gamete;
}
export function linkedOffspring(mother,father,random=Math.random,crossoverRate=.08){
 const maternal=linkedGamete(mother,random,crossoverRate);
 const paternal=linkedGamete(father,random,crossoverRate);
 const alleles={},dna={};
 for(const key of DNA_KEYS){
  const [lo,hi]=DNA_LIMITS[key];
  const clamp=v=>Math.max(lo,Math.min(hi,Number(v)));
  const pair=[clamp(maternal[key]),clamp(paternal[key])];
  alleles[key]=pair;
  dna[key]=expressAllelePair(key,pair);
 }
 return {dna,alleles};
}
