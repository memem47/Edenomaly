import {FOUNDER_FIELDS,founderLevel,founderLevelMeaning} from './founder-designer.js';
import {visibleOrnaments,phenotypeTraits} from './simulation.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const abilityPosition=(value,min,max)=>Number.isFinite(value)&&max>min?
 Math.min(100,Math.max(0,(value-min)/(max-min)*100)):0;
export const APPEARANCE_DRIVERS=Object.freeze([
 ['horn','角','顎の強さ＋卵の防御'],
 ['tail','尾','水辺への適応＋分散能力'],
 ['antenna','触角','捕食者識別能力＋目の数'],
 ['pattern','体の模様','擬態能力＋感染抵抗力'],
 ['fins','ひれ','水辺・水生・水草栽培'],
 ['horns','角','防衛・反撃'],
 ['tentacles','触手','子育て・感知・産卵地選択'],
 ['wings','翼（希少・飛行不可）','分散・触角・集団性・水辺適応'],
 ['shellPlates','甲殻','抵抗力・卵殻・温度耐性'],
 ['eggCrown','卵の房','産卵数・卵栄養・給餌・繁殖方式']
]);
export function abilityBarHTML(key,label,value,min,max,{editable=false}={}){
 const number=Number(value);
 const gene=FOUNDER_FIELDS.some(([k])=>k===key);
 const level=gene?founderLevel(key,number):
  Math.max(1,Math.min(10,Math.round(abilityPosition(number,min,max)*.09)+1));
 const meaning=gene?founderLevelMeaning(key,level):'';
 return '<div class="ability-bar" data-ability="'+esc(key)+'">'+
  '<div class="ability-bar-heading"><span>'+esc(label)+'</span><strong>'+
   level+'/10'+(meaning?' <small>('+esc(meaning)+')</small>':'')+'</strong></div>'+
  '<div class="ability-track" role="meter" aria-label="'+esc(label)+'" aria-valuemin="1" aria-valuemax="10" aria-valuenow="'+level+'">'+
   '<span class="ability-fill" style="width:'+((level-1)/9*100).toFixed(2)+'%"></span></div>'+
  '<div class="ability-scale"><small>1</small><small>10</small></div>'+
 '</div>';
}
export function abilityListHTML(g){
 return '<div class="ability-grid">'+FOUNDER_FIELDS.filter(([key])=>Number.isFinite(g[key]))
  .map(([key,label,min,max])=>abilityBarHTML(key,label,g[key],min,max)).join('')+'</div>';
}
export function phenotypeBarsHTML(g){
 const traits={...visibleOrnaments(g),...phenotypeTraits(g)};
 return '<div class="appearance-derivation"><strong>能力から決まる外見</strong><p>ひれ・角・甲殻・卵房・触手・希少な翼が遺伝子から決まります。全37遺伝子は固有の体表の粒模様にも反映されます。</p>'+
  APPEARANCE_DRIVERS.map(([key,label,reason])=>
   abilityBarHTML('phenotype-'+key,label+' — '+reason,traits[key],0,1)).join('')+'</div>';
}
