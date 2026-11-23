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

test('advanced genes remain editable and are only visually collapsed',async()=>{
 const keys=new Set(FOUNDER_FIELDS.map(([key])=>key));
 for(const key of FOUNDER_ADVANCED_TRAITS)assert.ok(keys.has(key),key);
 assert.equal(FOUNDER_ADVANCED_TRAITS.size,7);
 const ui=await readFile(new URL('./founder-screens.js',import.meta.url),'utf8');
 const css=await readFile(new URL('./style.css',import.meta.url),'utf8');
 assert.match(ui,/founderTraitHelp\(key\)/);
 assert.match(ui,/title="/);
 assert.match(ui,/id="toggleAdvancedTraits"/);
 assert.match(ui,/row\.hidden=!expand/);
 assert.match(css,/\.founder-trait\[hidden\]\{display:none!important\}/);
});
