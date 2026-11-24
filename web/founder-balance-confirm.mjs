// Out-of-sample game-mode confirmation with distinct seeds.
import {trial,aggregate} from './founder-balance-experiment.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const sites={
 grass:{id:'grass',terrain:0,center:[220,220],constraint:'near_water'},
 water:{id:'water',terrain:1,center:[200,200],constraint:'interior'},
 desert:{id:'desert',terrain:2,center:[610,110],constraint:'interior'},
 rock:{id:'rock',terrain:3,center:[435,345],constraint:'interior'}
};
const cases=[
 {id:'grass_default',site:'grass',preset:'grass'},
 {id:'grass_frugal1',site:'grass',preset:'grass',changes:{frugality:1}},
 {id:'grass_resist1',site:'grass',preset:'grass',changes:{resist:1}},
 {id:'grass_brood1',site:'grass',preset:'grass',changes:{brood:1}},
 {id:'grass_brood8',site:'grass',preset:'grass',changes:{brood:8}},
 {id:'grass_hermaphrodite',site:'grass',preset:'grass',changes:{repro:1}},
 {id:'grass_parthenogenesis',site:'grass',preset:'grass',changes:{repro:2}},
 {id:'grass_predator',site:'grass',preset:'grass',changes:{diet:1}},
 {id:'water_default',site:'water',preset:'water'},
 {id:'water_no_gardening',site:'water',preset:'water',changes:{waterGardening:0}},
 {id:'desert_default',site:'desert',preset:'desert'},
 {id:'rock_default',site:'rock',preset:'rock'},
 {id:'rock_max_rock',site:'rock',preset:'rock',changes:{rock:1}},
 {id:'rock_seeds',site:'rock',preset:'rock',policy:'seed'}
];
const all=[];
for(const c of cases){
 const rows=[];
 for(let seed=300;seed<308;seed++){
  const row=trial({...c,seed,site:sites[c.site],steps:1100,variant:c.id,policy:c.policy??'none'});
  rows.push(row);all.push(row);
 }
 console.log('CONFIRM_RESULT '+JSON.stringify({case:c.id,...aggregate(rows)}));
}
await mkdir('results/founder-confirm',{recursive:true});
await writeFile('results/founder-confirm/results.json',JSON.stringify(all,null,2));
console.log('CONFIRM_TOTAL '+JSON.stringify({runs:all.length,seeds:'300-307'}));
