// Stable beginner strategies; trait combinations are independent of the random
// genome used for hidden legacy loci and remain fully editable.
import {FOUNDER_FIELDS,FOUNDER_BUDGET,editFounderGenome,founderCost} from './founder-designer.js';

const BALANCED=Object.freeze({
 diet:.2,aquatic:0,wet:.5,dry:.5,rock:.5,idealTemp:23,tempTolerance:10,
 hibernate:.5,resist:.5,frugality:.5,waterGardening:.5,repro:0,brood:3,
 shell:.5,guard:.5,nesting:.5,nestChoice:.5,parentFeeding:.5,
 yolkReserve:.5,juvenileCannibalism:.25,dispersal:.5,sociability:.5,
 caution:.5,predatorSense:.5,retaliation:.5,deception:.5
});
export const FOUNDER_PRESETS=Object.freeze([
 {id:'grass',name:'🌿 草原の草食型',description:'草が多い陸地向け。省エネと感染抵抗を重視し、攻撃は控えめ。草地の近くで始める入門型。',
  values:{diet:0,aquatic:0,wet:.35,dry:.55,rock:.25,frugality:.75,resist:.65,brood:4,guard:.55,juvenileCannibalism:0}},
 {id:'water',name:'💧 水辺の水草型',description:'池の中で水草を食べる水生型。水辺適応と水草栽培を伸ばす代わりに乾燥への備えを削る。水中に配置する。',
  values:{diet:.05,aquatic:1,wet:.9,dry:.1,rock:.15,waterGardening:.85,frugality:.65,dispersal:.65,brood:4}},
 {id:'desert',name:'🏜 乾燥地の節約型',description:'水の少ない乾燥地に特化。乾燥耐性・省エネ・休眠を上げ、水辺・岩場適応を犠牲にする。食料が少ないため難しめ。',
  values:{diet:.4,aquatic:0,wet:.15,dry:.95,rock:.25,frugality:.9,hibernate:.85,resist:.6,brood:2}},
 {id:'rock',name:'🪨 岩場の警戒型',description:'岩場の隠れ場所を使う雑食系。岩場適応・警戒・反撃を強化し、ほかの環境への適応を抑える戦略。',
  values:{diet:.45,aquatic:0,wet:.2,dry:.2,rock:.95,caution:.8,predatorSense:.75,retaliation:.75,guard:.6,brood:3}}
]);
export function founderPresetGenome(base,id){
 const preset=FOUNDER_PRESETS.find(p=>p.id===id);
 if(!preset)return null;
 return editFounderGenome(base,{...BALANCED,...preset.values});
}
export function randomFounderGenome(base,random=Math.random){
 // Randomize a coherent ecological strategy, not every independent trait.
 // Independent 0..1 draws generated mostly unviable initial organisms.
 // The biome specialization remains clear; 7 other characteristics vary.
 const preset=FOUNDER_PRESETS[Math.min(FOUNDER_PRESETS.length-1,
  Math.floor(random()*FOUNDER_PRESETS.length))];
 const initial=founderPresetGenome(base,preset.id);
 const changes={};
 const eligible=FOUNDER_FIELDS.filter(([key])=>!['aquatic','diet','dry','wet','rock','idealTemp','repro'].includes(key));
 for(let i=0;i<7;i++){
  const [key,,lo,hi,step]=eligible[Math.floor(random()*eligible.length)];
  const strength=(random()-.5)*(.30*(hi-lo));
  changes[key]=Math.min(hi,Math.max(lo,Math.round((initial[key]+strength)/step)*step));
 }
 let result=editFounderGenome(initial,changes);
 if(founderCost(base,result)>FOUNDER_BUDGET)result=initial;
 return result;
}
