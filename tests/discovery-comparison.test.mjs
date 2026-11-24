// Run with node --experimental-default-type=module --test tests/discovery-comparison.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {discoveryDifferences,discoveryDifferenceHTML} from '../web/discovery-comparison.js';
import {expressDNA} from '../web/genome-model.js';

const dna={power:6,agility:7,stamina:4,intellect:5,adaptation:7,fertility:6};
const founder=expressDNA({dna});
const category=(g)=>g.speciesKey??'land-plant-medium-round-several-general-repro0-temperate-green-c_green-f_horn';
test('category difference explains a new species even with identical six stats',()=>{
 const parent={...founder,speciesKey:'land-plant-medium-round-several-general-repro0-temperate-green-c_green-f_horn'};
 const child={...founder,speciesKey:'land-plant-medium-round-several-guardian-repro0-temperate-green-c_green-f_horn'};
 const d=discoveryDifferences(child,[{genome:parent}],category);
 assert.equal(d.classificationChanged.length,1);
 assert.equal(d.classificationChanged[0].label,'行動戦略');
 assert.equal(d.genes.filter(g=>g.section==='基本能力'&&g.expressedChange).length,0);
 assert.match(discoveryDifferenceHTML(child,[{genome:parent}],category),/なぜ新種になった/);
});
test('hyphenated egg-hunter remains one category component',()=>{
 const parent={...founder,speciesKey:'land-plant-medium-round-several-general-repro0-temperate-green-c_green-f_horn'};
 const child={...founder,speciesKey:'land-plant-medium-round-several-egg-hunter-repro0-temperate-green-c_green-f_horn'};
 const changes=discoveryDifferences(child,[{genome:parent}],category).classificationChanged;
 assert.deepEqual(changes.map(r=>r.label),['行動戦略']);
});
test('show unexpressed recessive allele alongside unchanged phenotype',()=>{
 const parent=expressDNA({dna:{...dna,skillNesting:0}});
 const child=expressDNA({dna:{...dna,skillNesting:0},alleles:{...parent.alleles,skillNesting:[0,1]}});
 const d=discoveryDifferences(child,[{genome:parent}],category);
 const gene=d.genes.find(r=>r.key==='skillNesting');
 assert.equal(gene.expressedChange,false);
 assert.equal(gene.genotypeChange,true);
 assert.equal(gene.carrier,true);
 assert.match(discoveryDifferenceHTML(child,[{genome:parent}],category),/潜在保因/);
});
