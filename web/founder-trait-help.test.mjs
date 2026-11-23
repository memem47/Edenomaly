import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FOUNDER_FIELDS} from './founder-designer.js';
import {FOUNDER_TRAIT_HELP,FOUNDER_ADVANCED_TRAITS,founderTraitHelp} from './founder-trait-help.js';

test('every editable founder gene has a meaningful tooltip',()=>{
 const keys=FOUNDER_FIELDS.map(([key])=>key);
 assert.equal(Object.keys(FOUNDER_TRAIT_HELP).length,keys.length);
 for(const key of keys){
  assert.ok(FOUNDER_TRAIT_HELP[key]?.length>=18,'missing tooltip: '+key);
  assert.equal(founderTraitHelp(key),FOUNDER_TRAIT_HELP[key]);
 }
});

test('advanced genes remain editable and are only visually collapsed (DNA v2)',async()=>{
 const keys=new Set(FOUNDER_FIELDS.map(([key])=>key));
 assert.equal(keys.size,22);assert.equal(FOUNDER_ADVANCED_TRAITS.size,0);
 const ui=await readFile(new URL('./founder-screens.js',import.meta.url),'utf8');
 assert.match(ui,/founderTraitHelp\(key\)/);
 assert.match(ui,/id="toggleGeneEditor"/);
 assert.match(ui,/生存戦略/);
 assert.ok(!ui.includes('全37遺伝子を表示'));
});
