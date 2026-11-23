import {FOUNDER_BUDGET,FOUNDER_TRAITS,FOUNDER_FIELDS,formatTrait,editFounderGenome,founderCost,founderTraitCost,canUseFounder,founderLevel,founderValueAtLevel,founderLevelMeaning} from './founder-designer.js';
import {founderTraitHelp,FOUNDER_ADVANCED_TRAITS} from './founder-trait-help.js';
import {morphology,dietProfile,terrainFitness,genomeCode} from './simulation.js';
import {drawFounderAppearance} from './founder-preview.js?v=2026.11.23.1';
import {createDiscoveryToastQueue} from './discovery-toast-queue.js?v=2026.11.23.1';
import {differenceMagnitude,rankDifferences} from './discovery-diff.js?v=2026.11.23.1';
import {FOUNDER_PRESETS,founderPresetGenome,randomFounderGenome} from './founder-presets.js?v=2026.11.23.1';
import {phenotypeBarsHTML,abilityListHTML} from './ability-bars.js?v=2026.11.23.1';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=n=>Number(n).toFixed(1);
const makeDialog=(id,title)=>{
 const dialog=document.createElement('dialog');
 dialog.id=id;dialog.className='genome-dialog';
 dialog.innerHTML='<div class="genome-dialog-head"><h2>'+title+'</h2></div><div class="genome-dialog-body"></div><div class="genome-dialog-foot"></div>';
 document.body.append(dialog);
 return dialog;
};
export function mountFounderScreens({game,getMode,getDiscoveryMode=()=> 'detailed',onIntroduce,onContinue,onReady=()=>{}}){
 const editor=makeDialog('founderEditorDialog','🧬 移入するスライムの能力');
 const discovery=makeDialog('newSpeciesDiscoveryDialog','✨ 新種発見！');
 const editorBody=editor.querySelector('.genome-dialog-body');
 const editorFoot=editor.querySelector('.genome-dialog-foot');
 const discoveryBody=discovery.querySelector('.genome-dialog-body');
 const discoveryFoot=discovery.querySelector('.genome-dialog-foot');
 const quick=document.createElement('aside');
 quick.id='quickSpeciesDiscovery';
 quick.className='discovery-quick-notification';
 quick.setAttribute('role','status');
 quick.setAttribute('aria-live','polite');
 quick.hidden=true;
 document.getElementById('worldMapStage').append(quick);
 const quickQueue=createDiscoveryToastQueue({
  show(item){
   const sp=item.species;
   quick.replaceChildren();
   const card=document.createElement('div');
   card.className='discovery-quick-card';
   const portrait=document.createElement('canvas');
   portrait.width=140;portrait.height=104;
   portrait.setAttribute('aria-hidden','true');
   const name=document.createElement('strong');
   name.textContent=sp.name;
   card.append(portrait,name);
   quick.append(card);
   quick.hidden=false;
   drawFounderAppearance(portrait,sp.genome,0);
  },
  hide(){quick.hidden=true;quick.replaceChildren();}
 });

 // Keep a real default genome rather than reconstructing unrelated sliders.
 let original=null,base=null,changes={},point=null,wasRunning=false,discoveryQueue=[];
 let preparedGenome=null,selectedGenome=null;
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
   ['体格',format(m.bodyMass)],['基本体格',format(g.r)],['長さ比',format(g.elongation)],['目',g.eyes],['口',g.mouths],['顎',format(g.jaw)],['最大HP',Math.max(25,Math.round(m.bodyMass*.48+25))],
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
  const budget=isGame?('使用 '+cost+' pt / 上限 '+FOUNDER_BUDGET+' pt ・残り '+(FOUNDER_BUDGET-cost).toFixed(1)+' pt'+(cost>FOUNDER_BUDGET?'（超過）':'')):'テストモード：自由に調整可能';
  line.textContent=budget;
  // Same deterministic classifier used when this genome is introduced.
  // Changes to a gene immediately update the prospective species name.
  editorBody.querySelector('#founderSpeciesName').textContent=game.name(game.category(g),g);
  const habitat=editorBody.querySelector('#founderHabitatTip');
  if(habitat){
   const advice=g.aquatic===1?'推奨移入地点：池・水辺（水草）':g.rock>.8?'推奨移入地点：岩場・地衣類のある地形':g.dry>.8?'推奨移入地点：乾燥地（植物が少ないため難しめ）':'推奨移入地点：草原・水辺に近い陸地';
   habitat.textContent=advice+(g.diet>.7?' ｜ 肉食型は初期の獲物不足に注意':'');
  }
  line.classList.toggle('over-budget',isGame&&cost>FOUNDER_BUDGET);
  editorBody.querySelector('#founderSummary').innerHTML=summary(g);
  
  for(const item of editorBody.querySelectorAll('[data-point-cost]')){
   const v=founderTraitCost(item.dataset.pointCost,g[item.dataset.pointCost]);
   item.textContent=(v>0?'+':'')+v.toFixed(1)+' pt';
   item.style.color=v<0?'#9fe7cb':v>0?'#ffcf95':'';
  }
  for(const item of editorBody.querySelectorAll('[data-trait-meaning]')){
   const key=item.dataset.traitMeaning,level=founderLevel(key,g[key]);
   item.textContent=founderLevelMeaning(key,level);
  }
  paintPreview();
  const btn=editorFoot.querySelector('#confirmFounder');
  btn.disabled=!canUseFounder(base,g,isGame);
  btn.textContent=point?'この能力で8体を移入':'② この能力で移入地点を選ぶ';
 }
 const showEditor=(site=null,playing=false)=>{
  if(editor.open)return;
  point=site;
  wasRunning=playing;
  const source=selectedGenome??preparedGenome??defaultGenome();
  base=site?game.adaptFounderToTerrain(source,game.terrain(site.x,site.y)):source;
  changes={};
  editorBody.innerHTML='<section class="compact-founder-top"><canvas id="founderAfterCanvas" width="180" height="132" aria-label="調整後のスライム"></canvas><div class="compact-founder-info"><strong>調整後の外見</strong><div class="founder-species-name-line"><small>現在の能力から決まる種族名</small><b id="founderSpeciesName" aria-live="polite"></b></div><small>　能力に応じて体表・口・膜・栄養粒・ひれなどが変化</small> <small id="founderPreviewChanges"></small><p id="founderCost" class="founder-budget"></p><div id="founderSummary"></div></div></section>'+
   '<section class="founder-preset-selection"><strong>① 初期能力を選ぶ</strong><p class="muted">プリセットはおすすめの生存戦略です。選択後もすべての能力を編集できます。</p><div class="founder-preset-grid">'+FOUNDER_PRESETS.map(p=>'<button type="button" data-founder-preset="'+p.id+'"><b>'+escape(p.name)+'</b><small>'+escape(p.description)+'</small></button>').join('')+'<button type="button" id="randomFounderPreset"><b>🎲 ランダム生成</b><small>能力を毎回ランダムに選びます。ゲームモードの遺伝子ポイント上限内で生成します。</small></button></div></section>'+
   '<p class="muted" id="founderHabitatTip"></p><p class="muted">能力名の ⓘ にマウスを乗せると効果の説明を表示します。キーボードではⓘを選んで確認できます。</p><button type="button" id="toggleAdvancedTraits" aria-expanded="false">詳細能力7項目を表示</button><p class="muted">全遺伝子を1〜10の10段階で調整します。適温・産卵数・繁殖方式・生息型は数値の横に実際の意味を表示します。二択・三択の特徴は1/10や1/6/10など有効なレベルに切り替わります。内部では従来の値に変換して計算します。</p><p class="muted">有利な能力はポイント消費、不利な能力はポイント還元。食性など環境次第の戦略は無料。複数地形への高適応には追加費用。体格・目・口・顎は能力から自動決定。</p><div class="compact-founder-fields">'+FOUNDER_TRAITS.map(([section,fields])=>'<fieldset class="founder-fieldset"><legend>'+escape(section)+'</legend><div class="founder-traits">'+
    fields.map(([key,name,min,max,step])=>{
     const level=founderLevel(key,currentGenome()[key]??min);
     return '<div class="founder-trait" title="'+escape(founderTraitHelp(key))+'"'+(FOUNDER_ADVANCED_TRAITS.has(key)?' hidden data-advanced-trait="true"':'')+'><label for="edit-'+key+'">'+escape(name)+' <span class="founder-trait-help" tabindex="0" role="note" aria-label="'+escape(name)+'の説明：'+escape(founderTraitHelp(key))+'" title="'+escape(founderTraitHelp(key))+'">ⓘ</span> <small data-point-cost="'+key+'"></small></label>'+
      '<div class="compact-value"><button type="button" data-adjust="-1" aria-label="'+escape(name)+'を減らす">−</button>'+
      '<input id="edit-'+key+'" type="number" data-trait="'+key+'" min="1" max="10" step="1" value="'+level+'">'+
      '<button type="button" data-adjust="1" aria-label="'+escape(name)+'を増やす">＋</button></div>'+
      '<small class="founder-level-meaning" data-trait-meaning="'+key+'">'+escape(founderLevelMeaning(key,level))+'</small>'+
      '<div class="ability-track" role="meter" aria-label="'+escape(name)+'" aria-valuemin="1" aria-valuemax="10" aria-valuenow="'+level+'"><span class="ability-fill" style="width:'+((level-1)/9*100)+'%"></span></div>'+
      '<div class="ability-scale"><small>1</small><small>10</small></div></div>';
    }).join('')+'</div></fieldset>').join('')+'</div>';
  editorFoot.innerHTML='<button type="button" id="resetFounder">標準に戻す</button><button type="button" id="cancelFounder">閉じる</button><button type="button" id="confirmFounder">移入</button>';
  editorBody.querySelector('#toggleAdvancedTraits').onclick=()=>{
   const button=editorBody.querySelector('#toggleAdvancedTraits');
   const expand=button.getAttribute('aria-expanded')!=='true';
   button.setAttribute('aria-expanded',String(expand));
   button.textContent=expand?'詳細能力7項目を隠す':'詳細能力7項目を表示';
   editorBody.querySelectorAll('[data-advanced-trait]').forEach(row=>{row.hidden=!expand;});
  };
  editorBody.querySelectorAll('[data-trait]').forEach(input=>{
   const row=input.closest('.founder-trait');
   const apply=(normalize=false)=>{
    if(input.value===''||!Number.isFinite(Number(input.value)))return;
    const key=input.dataset.trait;
    const level=Math.max(1,Math.min(10,Math.round(Number(input.value))));
    changes[key]=founderValueAtLevel(key,level);
    if(normalize)input.value=String(founderLevel(key,currentGenome()[key]));
    const bar=row.querySelector('.ability-track');
    bar.setAttribute('aria-valuenow',String(level));
    bar.querySelector('.ability-fill').style.width=((level-1)/9*100)+'%';
    updateEditorSummary();
   };
   input.addEventListener('input',()=>apply());
   input.addEventListener('change',()=>apply(true));
   row.querySelectorAll('[data-adjust]').forEach(btn=>btn.onclick=()=>{
    const key=input.dataset.trait,direction=Number(btn.dataset.adjust);
    const now=founderLevel(key,currentGenome()[key]);
    const next=key==='aquatic'?(direction>0?10:1):
     key==='repro'?(direction>0?now<6?6:10:now>6?6:1):
     Math.max(1,Math.min(10,now+direction));
    input.value=String(next);
    apply(true);
   });
  });
  editorFoot.querySelector('#resetFounder').onclick=()=>{
   changes={};selectedGenome=null;preparedGenome=null;editor.close();showEditor(null,playing);
  };
  editorFoot.querySelector('#cancelFounder').onclick=()=>{selectedGenome=null;editor.close();};
  editorBody.querySelectorAll('[data-founder-preset]').forEach(btn=>btn.onclick=()=>{
   selectedGenome=founderPresetGenome(defaultGenome(),btn.dataset.founderPreset);
   editor.close();showEditor(null,playing);
  });
  editorBody.querySelector('#randomFounderPreset').onclick=()=>{
   selectedGenome=randomFounderGenome(defaultGenome());
   editor.close();showEditor(null,playing);
  };
  editorFoot.querySelector('#confirmFounder').onclick=()=>{
   const g=currentGenome();
   if(!canUseFounder(base,g,getMode()==='game'))return;
   editor.close();selectedGenome=null;
   if(point){onIntroduce(point,g);return;}
   preparedGenome=g;onReady(g);
  };
  updateEditorSummary();
  editor.showModal();
  if(previewFrame===null)previewFrame=requestAnimationFrame(animatePreview);
 };
 editor.addEventListener('cancel',e=>{e.preventDefault();editor.close();});
 function clear(){
  quickQueue.clear();
  changes={};original=null;base=null;point=null;preparedGenome=null;selectedGenome=null;
  if(previewFrame!==null){cancelAnimationFrame(previewFrame);previewFrame=null;}
  if(editor.open)editor.close();
  if(discovery.open)discovery.close();
  discoveryQueue=[];
 }
 function comparisonHTML(g,parents){
  const fields=[...FOUNDER_FIELDS,
   ['r','基本体格',3,15],['elongation','体の長さ比',.65,3],['eyes','目の数',0,6],
   ['mouths','口の数',1,4],['jaw','顎・攻撃力',.2,2.5]];
  const derived=[['bodyMass','体格（質量）'],['eyeRange','視界'],['speed','移動速度'],['upkeep','維持エネルギー'],['biteReach','攻撃範囲'],['maxHp','最大HP']];
  const stats=g=>{const m=morphology(g);return {...g,...m,maxHp:Math.max(25,Math.round(m.bodyMass*.48+25))};};
  const current=stats(g),previous=parents.map(p=>stats(p.genome));
  const geneKeys=new Set(FOUNDER_FIELDS.map(([key])=>key));
  const fmt=(key,v)=>!Number.isFinite(v)?'—':geneKeys.has(key)?
   founderLevel(key,v)+'/10（'+founderLevelMeaning(key,founderLevel(key,v))+'）':
   Number(v.toFixed(3)).toString();
  const rows=[...derived,...fields].map(([key,label,min,max],index)=>{
   const v=current[key],pv=previous.map(p=>p[key]);
   const changed=pv.some(x=>Number.isFinite(x)&&(
    geneKeys.has(key)?founderLevel(key,v)!==founderLevel(key,x):Math.abs(v-x)>=.0005));
   const cells=pv.map(x=>{
    if(!Number.isFinite(x)||!Number.isFinite(v))return '<td>—</td>';
    const d=geneKeys.has(key)?founderLevel(key,v)-founderLevel(key,x):v-x;
    const dir=Math.abs(d)<.0005?'same':d>0?'up':'down';
    const delta=dir==='same'?'±0':(d>0?'+':'')+Number(d.toFixed(3));
    return '<td>'+escape(fmt(key,x))+' <small class="discovery-delta '+dir+'">'+escape(delta)+'</small></td>';
   }).join('');
   return {changed,index,score:geneKeys.has(key)?Math.max(0,...pv.map(x=>Number.isFinite(x)?Math.abs(founderLevel(key,v)-founderLevel(key,x))/9:0)):differenceMagnitude(key,v,pv,min,max),html:'<tr><th scope="row">'+escape(label)+'</th><td><strong>'+escape(fmt(key,v))+'</strong></td>'+cells+'</tr>'};
  });
  const table=rows=>'<div class="discovery-table-wrap"><table class="discovery-table"><thead><tr><th>能力</th><th>新種</th>'+parents.map((p,i)=>'<th>親'+(i+1)+'（新種との差）</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>r.html).join('')+'</tbody></table></div>';
  if(!parents.length)return '<p class="muted">親の情報がないため比較できません。</p>';
  const ranked=rankDifferences(rows);
  return '<h3>親から変化した能力</h3><p class="muted">差分＝新種 − 親。遺伝子は1〜10の段階差で表示し、派生能力は実数値の差で表示。両親のうち差が大きい方を採用し、能力の範囲に対する変化率が大きい順に並べています。増減は有利・不利を意味しません。成体の基礎能力を比較しています。</p>'+
   (ranked.some(r=>r.changed)?table(ranked.filter(r=>r.changed)):'<p>表示精度内では能力値の変化なし。</p>')+
   '<details><summary>変化のない能力も表示</summary>'+table(ranked.filter(r=>!r.changed))+'</details>';
 }
 function showNextDiscovery(){
  if(!discoveryQueue.length){if(discovery.open)discovery.close();return false;}
  const item=discoveryQueue[0],sp=item.species,g=sp.genome;
  const parents=(sp.parents??[]).filter(p=>p?.genome);
  discoveryBody.innerHTML='<p class="muted">Step '+item.step+' に発見。確認するまでシミュレーションを停止しています。</p>'+
   '<div class="discovery-portraits">'+[{name:sp.name,genome:g},...parents].map((p,i)=>'<figure><canvas width="180" height="132" data-discovery-portrait="'+i+'"></canvas><figcaption><strong>'+(i===0?'✨ 新種':'親'+i+' #'+p.id)+'</strong><br>'+escape(p.name)+'</figcaption></figure>').join('')+'</div>'+summary(g)+comparisonHTML(g,parents)+
   '<details><summary>外見の特徴</summary>'+phenotypeBarsHTML(g)+'</details>'+
   '<details><summary>🧬 遺伝子・能力の詳細</summary><div class="founder-discovery-genes">'+
   abilityListHTML(g)+
   '</div></details><p class="muted">遺伝子コード '+escape(genomeCode(g))+'</p>';
  discoveryBody.querySelectorAll('[data-discovery-portrait]').forEach(canvas=>drawFounderAppearance(canvas,[g,...parents.map(p=>p.genome)][Number(canvas.dataset.discoveryPortrait)],0));
  discoveryBody.scrollTop=0;
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
  if(!categories.length)return false;
  if(getDiscoveryMode()==='quick'){
   quickQueue.push(categories);
   return false; // Never stop game time or interrupt the current action.
  }
  for(const item of categories)discoveryQueue.push(item);
  if(!discovery.open)showNextDiscovery();
  return true; // Pause game simulation until all detailed notices are read.
 }
 return {showEditor,announce,clear,
  hasPrepared:()=>!!preparedGenome,
  peekPrepared:()=>preparedGenome,
  consumePrepared:()=>{const g=preparedGenome;preparedGenome=null;return g;},
  isOpen:()=>editor.open||discovery.open};
}
