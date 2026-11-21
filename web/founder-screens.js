import {FOUNDER_BUDGET,FOUNDER_TRAITS,FOUNDER_FIELDS,formatTrait,editFounderGenome,founderCost,canUseFounder} from './founder-designer.js';
import {morphology,dietProfile,terrainFitness,genomeCode} from './simulation.js';
import {drawFounderAppearance} from './founder-preview.js?v=2026.11.21.3';
import {phenotypeBarsHTML,abilityListHTML} from './ability-bars.js?v=2026.11.21.3';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=n=>Number(n).toFixed(1);
const makeDialog=(id,title)=>{
 const dialog=document.createElement('dialog');
 dialog.id=id;dialog.className='genome-dialog';
 dialog.innerHTML='<div class="genome-dialog-head"><h2>'+title+'</h2></div><div class="genome-dialog-body"></div><div class="genome-dialog-foot"></div>';
 document.body.append(dialog);
 return dialog;
};
export function mountFounderScreens({game,getMode,onIntroduce,onContinue}){
 const editor=makeDialog('founderEditorDialog','🧬 移入するスライムの能力');
 const discovery=makeDialog('newSpeciesDiscoveryDialog','✨ 新種発見！');
 const editorBody=editor.querySelector('.genome-dialog-body');
 const editorFoot=editor.querySelector('.genome-dialog-foot');
 const discoveryBody=discovery.querySelector('.genome-dialog-body');
 const discoveryFoot=discovery.querySelector('.genome-dialog-foot');
 // Keep a real default genome rather than reconstructing unrelated sliders.
 let original=null,base=null,changes={},point=null,wasRunning=false,discoveryQueue=[];
 let previewFrame=null,previewTick=0;
 const defaultGenome=()=>{
  if(original)return original;
  for(let i=0;i<70;i++){
   const g=game.gene();
   if(g.eyes>=2&&g.diet<=.28&&morphology(g).bodyMass<=100){original=g;break;}
  }
  original??=game.gene();
  return original;
 };
 const currentGenome=()=>editFounderGenome(base??defaultGenome(),changes);
 const summary=(g)=>{const m=morphology(g),diet=dietProfile(g);
  return '<div class="founder-summary">'+[
   ['食性',diet.label],['生息型',g.aquatic?'水生':'陸生'],
   ['体格',format(m.bodyMass)],['最大HP',Math.max(25,Math.round(m.bodyMass*.48+25))],
   ['移動速度',format(m.speed)],['視界',Math.round(m.eyeRange)],
   ['適温',format(g.idealTemp)+'℃'],['耐性','±'+format(g.tempTolerance)+'℃'],
   ['繁殖方式',formatTrait('repro',g.repro)],['卵の数',String(g.brood)],
   ['乾燥適応',format(terrainFitness(g,2).fitness)],['岩場適応',format(terrainFitness(g,3).fitness)]
  ].map(([name,value])=>'<span><small>'+escape(name)+'</small><b>'+escape(value)+'</b></span>').join('')+'</div>';
 };
 const paintPreview=()=>{
  const edited=editorBody.querySelector('#founderAfterCanvas');
  if(!edited||!base)return;
  const g=currentGenome();
  drawFounderAppearance(edited,g,previewTick);
  const changed=FOUNDER_FIELDS.filter(([key])=>(g[key]??0)!==(base[key]??0)).length;
  editorBody.querySelector('#founderPreviewChanges').textContent=
   changed?'変更した能力 '+changed+'項目':'標準の見た目（変更なし）';
 };
 const animatePreview=()=>{
  if(!editor.open||!editor.isConnected){previewFrame=null;return;}
  if(!document.hidden){previewTick++;paintPreview();}
  previewFrame=requestAnimationFrame(animatePreview);
 };
 function updateEditorSummary(){
  const g=currentGenome(),cost=founderCost(base,g),isGame=getMode()==='game';
  const line=editorBody.querySelector('#founderCost');
  const budget=isGame?('遺伝子ポイント '+cost+'/'+FOUNDER_BUDGET+(cost>FOUNDER_BUDGET?'（超過）':'')):'テストモード：自由に調整可能';
  line.textContent=budget;
  line.classList.toggle('over-budget',isGame&&cost>FOUNDER_BUDGET);
  editorBody.querySelector('#founderSummary').innerHTML=summary(g);
  
  paintPreview();
  const btn=editorFoot.querySelector('#confirmFounder');
  btn.disabled=!canUseFounder(base,g,isGame);
  btn.textContent=point?'この能力で8体を移入':'この能力を保存して配置先を選ぶ';
 }
 const showEditor=(site=null,playing=false)=>{
  if(editor.open)return;
  point=site;
  wasRunning=playing;
  const source=defaultGenome();
  base=site?game.adaptFounderToTerrain(source,game.terrain(site.x,site.y)):source;
  editorBody.innerHTML='<section class="compact-founder-top"><canvas id="founderAfterCanvas" width="180" height="132" aria-label="調整後のスライム"></canvas><div class="compact-founder-info"><strong>調整後の外見</strong><small>　能力に応じて体表・口・膜・栄養粒・ひれなどが変化</small> <small id="founderPreviewChanges"></small><p id="founderCost" class="founder-budget"></p><div id="founderSummary"></div></div></section>'+
   '<div class="compact-founder-fields">'+FOUNDER_TRAITS.map(([section,fields])=>'<fieldset class="founder-fieldset"><legend>'+escape(section)+'</legend><div class="founder-traits">'+
    fields.map(([key,name,min,max,step])=>{
     const v=currentGenome()[key]??min;
     return '<div class="founder-trait"><label for="edit-'+key+'">'+escape(name)+'</label>'+
      '<div class="compact-value"><button type="button" data-adjust="-1" aria-label="'+escape(name)+'を減らす">−</button>'+
      '<input id="edit-'+key+'" type="number" data-trait="'+key+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+v.toFixed(2)+'">'+
      '<button type="button" data-adjust="1" aria-label="'+escape(name)+'を増やす">＋</button></div>'+
      '<div class="ability-track" role="meter" aria-label="'+escape(name)+'" aria-valuemin="'+min+'" aria-valuemax="'+max+'" aria-valuenow="'+v+'"><span class="ability-fill" style="width:'+Math.max(0,Math.min(100,(v-min)/(max-min)*100))+'%"></span></div>'+
      '<div class="ability-scale"><small>'+min+'</small><small>'+max+'</small></div></div>';
    }).join('')+'</div></fieldset>').join('')+'</div>';
  editorFoot.innerHTML='<button type="button" id="resetFounder">標準に戻す</button><button type="button" id="cancelFounder">閉じる</button><button type="button" id="confirmFounder">移入</button>';
  editorBody.querySelectorAll('[data-trait]').forEach(input=>{
   const row=input.closest('.founder-trait');
   const apply=(normalize=false)=>{
    if(input.value===''||!Number.isFinite(Number(input.value)))return;
    const key=input.dataset.trait,min=Number(input.min),max=Number(input.max),step=Number(input.step);
    changes[key]=Math.max(min,Math.min(max,Math.round(Number(input.value)/step)*step));
    const value=currentGenome()[key];
    if(normalize)input.value=Number(value.toFixed(2));
    const bar=row.querySelector('.ability-track');
    bar.setAttribute('aria-valuenow',String(value));
    bar.querySelector('.ability-fill').style.width=((value-min)/(max-min)*100)+'%';
    updateEditorSummary();
   };
   input.addEventListener('input',()=>apply());
   input.addEventListener('change',()=>apply(true));
   row.querySelectorAll('[data-adjust]').forEach(btn=>btn.onclick=()=>{
    input.value=String((currentGenome()[input.dataset.trait]??Number(input.min))+Number(btn.dataset.adjust)*Number(input.step));
    apply(true);
   });
  });
  editorFoot.querySelector('#resetFounder').onclick=()=>{
   changes={};editor.close();showEditor(site,playing);
  };
  editorFoot.querySelector('#cancelFounder').onclick=()=>editor.close();
  editorFoot.querySelector('#confirmFounder').onclick=()=>{
   const g=currentGenome();
   if(!canUseFounder(base,g,getMode()==='game'))return;
   editor.close();
   if(point)onIntroduce(point,g);
  };
  updateEditorSummary();
  editor.showModal();
  if(previewFrame===null)previewFrame=requestAnimationFrame(animatePreview);
 };
 editor.addEventListener('cancel',e=>{e.preventDefault();editor.close();});
 function clear(){
  changes={};original=null;base=null;point=null;
  if(previewFrame!==null){cancelAnimationFrame(previewFrame);previewFrame=null;}
  if(editor.open)editor.close();
  if(discovery.open)discovery.close();
  discoveryQueue=[];
 }
 function showNextDiscovery(){
  if(!discoveryQueue.length){if(discovery.open)discovery.close();return false;}
  const item=discoveryQueue[0],sp=item.species,g=sp.genome;
  discoveryBody.innerHTML='<p class="muted">Step '+item.step+' に発見。確認するまでシミュレーションを停止しています。</p>'+
   '<h3>'+escape(sp.name)+'</h3>'+summary(g)+phenotypeBarsHTML(g)+
   '<details open><summary>🧬 遺伝子・能力の詳細</summary><div class="founder-discovery-genes">'+
   abilityListHTML(g)+
   '</div></details><p class="muted">遺伝子コード '+escape(genomeCode(g))+'</p>';
  discoveryFoot.innerHTML='<button type="button" id="keepPaused">停止したまま閉じる</button>'+
   '<button type="button" id="continueAfterDiscovery">'+(discoveryQueue.length>1?'次の新種を見る':'確認して再開')+'</button>';
  discoveryFoot.querySelector('#keepPaused').onclick=()=>{
   discoveryQueue=[];discovery.close();onContinue(false);
  };
  discoveryFoot.querySelector('#continueAfterDiscovery').onclick=()=>{
   discoveryQueue.shift();
   if(discoveryQueue.length)showNextDiscovery();
   else{discovery.close();onContinue(true);}
  };
  if(!discovery.open)discovery.showModal();
  return true;
 }
 discovery.addEventListener('cancel',e=>{e.preventDefault();discoveryFoot.querySelector('#keepPaused').click();});
 function announce(categories){
  for(const item of categories)discoveryQueue.push(item);
  if(categories.length&&!discovery.open)showNextDiscovery();
 }
 return {showEditor,announce,clear,isOpen:()=>editor.open||discovery.open};
}
