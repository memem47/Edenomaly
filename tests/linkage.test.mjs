// Run: node --experimental-default-type=module --test tests/linkage.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {DNA_KEYS,expressDNA} from '../web/genome-model.js';
import {LINKAGE_GROUPS,linkedGamete,linkedOffspring} from '../web/linkage-model.js';
import {latentGenotype,evolutionSVG} from '../web/evolution-tree.js';

const dna=Object.fromEntries(DNA_KEYS.map(k=>[k,k.startsWith('skill')||k==='albino'?0:k==='aquatic'?0:k==='repro'||k==='biome'?0:5]));
const base=expressDNA({dna});
test('chromosome groups cover 27 loci once',()=>{
 assert.equal(LINKAGE_GROUPS.flat().length,27);
 assert.deepEqual(new Set(LINKAGE_GROUPS.flat()),new Set(DNA_KEYS));
});
test('zero crossovers inherit complete homologues',()=>{
 const parent=expressDNA({dna,alleles:Object.fromEntries(DNA_KEYS.map(k=>[k,[0,1]]))});
 const gamete=linkedGamete(parent,()=>.01,0);
 for(const group of LINKAGE_GROUPS)assert.equal(new Set(group.map(k=>gamete[k])).size,1);
});
test('forced crossing over flips inherited homologue at every locus',()=>{
 const alleles=Object.fromEntries(DNA_KEYS.map(k=>[k,[0,1]]));
 // force a stable 0/1 allelic code for each locus
 const parent={dna,alleles};
 const gamete=linkedGamete(parent,()=>.01,1);
 for(const group of LINKAGE_GROUPS){
  assert.deepEqual(group.map(k=>gamete[k]),group.map((_,i)=>i%2===0?0:1));
 }
});
test('two recessive carriers sometimes yield expressed trait and hidden siblings',()=>{
 const key='skillNesting';
 const parent=expressDNA({dna:{...dna,[key]:0},alleles:{...base.alleles,[key]:[0,1]}});
 let expressed=0,hidden=0;
 let seed=1234;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<500;i++){
  const child=linkedOffspring(parent,parent,random);
  if(child.dna[key]===1)expressed++;
  if(child.alleles[key][0]!==child.alleles[key][1])hidden++;
 }
 assert.ok(expressed>50&&expressed<200, 'recessive phenotype near 25%');
 assert.ok(hidden>150&&hidden<350, 'heterozygous siblings');
});
test('lineage portrait advertises latent recessive trait without expressing it',()=>{
 const genome=expressDNA({dna:{...dna,skillNesting:0},alleles:{...base.alleles,skillNesting:[0,1]}});
 const summary=latentGenotype(genome);
 assert.ok(summary.hidden.some(s=>s.key==='skillNesting'));
 const svg=evolutionSVG({width:250,height:230,edges:[],nodes:[{key:'A',name:'テスト',first:0,current:1,total:1,x:20,y:20,genome}]});
 assert.match(svg,/潜在：巣作り/);
 assert.match(svg,/Chr4/);
});
