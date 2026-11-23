// Founder-only, read-only calculated phenotype dashboard.
// All values are taken from the actual expressed genome and never edited here.
import {GENOME_DERIVATION_FORMULAS} from './founder-formulas.js';
import {formatTrait} from './founder-designer.js';

export const DERIVED_GROUPS=Object.freeze([
 {name:'生態・環境',keys:['diet','aquatic','idealTemp','tempTolerance','wet','dry','rock','hibernate','resist','frugality','waterGardening']},
 {name:'繁殖・子育て',keys:['repro','brood','shell','guard','nesting','nestChoice','parentFeeding','yolkReserve','juvenileCannibalism']},
 {name:'行動・感覚',keys:['dispersal','sociability','caution','predatorSense','retaliation','deception']},
 {name:'体型・模様',keys:['r','elongation','eyes','mouths','jaw','tailLength','hornLength','antennaLength','pattern','albino','longevity']}
]);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rows=new Map(GENOME_DERIVATION_FORMULAS.map(([key,label,formula])=>[key,{key,label,formula}]));
export const DERIVED_FIELDS=DERIVED_GROUPS.flatMap(group=>group.keys.map(key=>{
 const field=rows.get(key);
 if(!field)throw Error('Unknown derived phenotype field '+key);
 return {...field,group:group.name};
}));
export function formatDerivedValue(key,value){
 if(!Number.isFinite(value))return '—';
 if(key==='idealTemp'||key==='tempTolerance')return value.toFixed(1)+'℃';
 if(['r','elongation','jaw','longevity'].includes(key))return value.toFixed(2);
 if(['eyes','mouths','brood','aquatic','repro','albino'].includes(key))
  return ['aquatic','repro','albino'].includes(key)?formatTrait(key,value):
   Math.round(value).toString()+(key==='brood'?'個':key==='eyes'||key==='mouths'?'個':'');
 return (value*100).toFixed(0)+'%';
}
export function derivedDashboardHTML(){
 return '<section class="founder-derived-panel" aria-label="応用パラメータ一覧">'+
 '<div class="founder-derived-title"><h3>応用パラメータ <small>37項目／自動計算・編集不可</small></h3>'+
 '<p>左の遺伝子を変えると数値が即時に変化します。項目にカーソルを合わせると計算式を表示します。</p></div>'+
 '<div class="founder-derived-groups">'+DERIVED_GROUPS.map(group=>
 '<section class="founder-derived-group"><h4>'+esc(group.name)+'</h4><div class="founder-derived-grid">'+
 group.keys.map(key=>{
  const {label,formula}=rows.get(key);
  return '<div class="founder-derived-item" data-derived-row="'+esc(key)+'" title="'+esc(label+'：'+formula)+'">'+
   '<span>'+esc(label)+'</span><strong data-derived-value="'+esc(key)+'">—</strong>'+
   '<small data-derived-delta="'+esc(key)+'" aria-hidden="true"></small></div>';
 }).join('')+'</div></section>').join('')+'</div></section>';
}
export function refreshDerivedDashboard(root,genome,baseline){
 for(const {key} of DERIVED_FIELDS){
  const node=root.querySelector('[data-derived-value="'+key+'"]');
  if(!node)continue;
  node.textContent=formatDerivedValue(key,genome[key]);
  const row=node.closest('.founder-derived-item');
  const changed=Number.isFinite(genome[key])&&Number.isFinite(baseline?.[key])&&
   Math.abs(genome[key]-baseline[key])>1e-6;
  row?.classList.toggle('derived-changed',changed);
  const delta=root.querySelector('[data-derived-delta="'+key+'"]');
  if(delta){
   const diff=genome[key]-(baseline?.[key]??genome[key]);
   delta.textContent=changed?(diff>0?'▲':'▼'):'';
   delta.className=changed?'derived-direction '+(diff>0?'derived-up':'derived-down'):'';
  }
 }
}
