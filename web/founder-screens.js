import {FOUNDER_BUDGET,FOUNDER_TRAITS,FOUNDER_FIELDS,formatTrait,editFounderGenome,founderCost,canUseFounder} from './founder-designer.js';
import {morphology,dietProfile,terrainFitness,genomeCode} from './simulation.js';
import {drawFounderAppearance} from './founder-preview.js?v=2026.11.21.1';
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
  const initial=editorBody.querySelector('#founderBeforeCanvas');
  const edited=editorBody.querySelector('#founderAfterCanvas');
  if(!initial||!edited||!base)return;
  drawFounderAppearance(initial,base,previewTick);
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
  editorBody.innerHTML='<p class="muted">'+(site?'選択地点に合わせたデフォルト能力です。調整して確定してください。':'デフォルト能力を表示しています。変更してからフィールドをクリックして配置できます。')+
   ' ゲームモードでは遺伝子ポイントを消費します。テストモードでは自由に編集できます。'+
   ' 選択地点の地形に合わない能力では、移入直後に衰弱する場合があります。'+
   (getMode()==='lab'?' 複数種類を移入する場合、調整するのは最初の1種類です。':'')+'</p>'+
   '<p id="founderCost" class="founder-budget"></p>'+
   '<section class="founder-preview-section" aria-label="外見のリアルタイム比較">'+
   '<div class="founder-preview-heading"><strong>✨ スライムの見た目</strong><span id="founderPreviewChanges" aria-live="polite"></span></div>'+
   '<div class="founder-preview-pair">'+
   '<figure><canvas id="founderBeforeCanvas" width="320" height="220" aria-label="調整前のスライム"></canvas><figcaption>調整前</figcaption></figure>'+
   '<figure><canvas id="founderAfterCanvas" width="320" height="220" aria-label="調整後のスライム"></canvas><figcaption>調整後（リアルタイム）</figcaption></figure>'+
   '</div><p class="muted">体格・縦横比・目の数と配置・角・触角・尾・模様・色を実際の描画処理で反映します。動きはイメージです。生態特性の変更は必ずしも外見を変えません。</p></section>'+
   '<div id="founderSummary"></div>'+
   FOUNDER_TRAITS.map(([section,fields])=>'<fieldset class="founder-fieldset"><legend>'+escape(section)+'</legend><div class="founder-traits">'+
    fields.map(([key,name,min,max,step])=>{
     const current=currentGenome()[key];
     return '<label class="founder-trait"><span>'+escape(name)+' <output data-trait-value="'+key+'">'+escape(formatTrait(key,current))+'</output></span>'+
      '<input type="range" data-trait="'+key+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+current+'"></label>';
    }).join('')+'</div></fieldset>').join('');
  editorFoot.innerHTML='<button type="button" id="resetFounder">標準に戻す</button><button type="button" id="cancelFounder">閉じる</button><button type="button" id="confirmFounder">移入</button>';
  editorBody.querySelectorAll('[data-trait]').forEach(input=>{
   input.addEventListener('input',()=>{
    changes[input.dataset.trait]=Number(input.value);
    editorBody.querySelector('[data-trait-value="'+input.dataset.trait+'"]').textContent=formatTrait(input.dataset.trait,Number(input.value));
    updateEditorSummary();
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
   '<h3>'+escape(sp.name)+'</h3>'+summary(g)+
   '<details open><summary>🧬 遺伝子・能力の詳細</summary><div class="founder-discovery-genes">'+
   FOUNDER_FIELDS.map(([key,label])=>'<div><span>'+escape(label)+'</span><strong>'+escape(formatTrait(key,g[key]??0))+'</strong></div>').join('')+
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
