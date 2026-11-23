import {FOUNDER_BUDGET,FOUNDER_TRAITS,FOUNDER_FIELDS,formatTrait,editFounderGenome,founderCost,founderTraitCost,canUseFounder,founderLevel,founderValueAtLevel,founderLevelMeaning} from './founder-designer.js';
import {founderTraitHelp} from './founder-trait-help.js';
import {BASIC_STATS,basicStatLevel,editBasicStat,founderSkills,trainFounderSkill,skillTrainingGenes} from './basic-stats.js';
import {founderFormulaHTML} from './founder-formulas.js';
import {derivedDashboardHTML,refreshDerivedDashboard} from './founder-derived-dashboard.js';
import {morphology,dietProfile,terrainFitness,genomeCode} from './simulation.js';
import {drawFounderAppearance} from './founder-preview.js?v=2026.11.23.8';
import {createDiscoveryToastQueue} from './discovery-toast-queue.js?v=2026.11.23.8';
import {FOUNDER_PRESETS,founderPresetGenome,randomFounderGenome} from './founder-presets.js?v=2026.11.23.8';
import {phenotypeBarsHTML,abilityListHTML} from './ability-bars.js?v=2026.11.23.8';
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
 const summary=g=>'<div class="founder-summary">'+BASIC_STATS.map(stat=>
  '<span title="'+escape(stat.help)+'"><small>'+stat.icon+' '+escape(stat.name)+'</small>'+
  '<b>'+basicStatLevel(g,stat.key)+'/10</b></span>').join('')+'</div>';
 const paintPreview=()=>{
  const edited=editorBody.querySelector('#founderAfterCanvas');
  if(!edited||!base)return;
  const g=currentGenome();
  drawFounderAppearance(edited,g,previewTick);
  const changed=FOUNDER_FIELDS.filter(([key])=>(g.dna[key]??0)!==(base.dna[key]??0)).length;
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
  for(const input of editorBody.querySelectorAll('[data-basic-stat]')){
   const level=basicStatLevel(g,input.dataset.basicStat);
   if(document.activeElement!==input)input.value=String(level);
   const meter=input.closest('.basic-stat-card')?.querySelector('.ability-track');
   if(meter){meter.setAttribute('aria-valuenow',String(level));meter.querySelector('.ability-fill').style.width=((level-1)/9*100)+'%';}
  }
  const skillPanel=editorBody.querySelector('#founderSkills');
  if(skillPanel)skillPanel.innerHTML=founderSkills(g).map(skill=>
   '<div class="founder-skill" title="'+escape(skill.detail)+'">'+
    '<span>'+escape(skill.name)+'</span>'+
    '<button type="button" class="'+(skill.ready?'skill-ready':'skill-locked')+'" data-train-skill="'+escape(skill.name)+'" aria-pressed="'+skill.ready+'" aria-label="'+escape(skill.name)+'を'+(skill.ready?'外す':'習得する')+'">'+(skill.ready?'✓ 保有':'＋ 習得')+'</button>'+
   '</div>').join('');
  if(skillPanel)skillPanel.querySelectorAll('[data-train-skill]').forEach(button=>button.onclick=()=>{
   const name=button.dataset.trainSkill;
   for(const key of skillTrainingGenes(name))changes[key]=currentGenome().dna[key]===1?0:1;
   updateEditorSummary();
  });
  
  for(const item of editorBody.querySelectorAll('[data-point-cost]')){
   const v=founderTraitCost(item.dataset.pointCost,g[item.dataset.pointCost]);
   item.textContent=(v>0?'+':'')+v.toFixed(1)+' pt';
   item.style.color=v<0?'#9fe7cb':v>0?'#ffcf95':'';
  }
  for(const item of editorBody.querySelectorAll('[data-trait-meaning]')){
   const key=item.dataset.traitMeaning,level=founderLevel(key,g[key]);
   item.textContent=founderLevelMeaning(key,level);
  }
  // A functional gene can recalculate body shape: keep every visible
  // control synchronized with the genome actually being previewed.
  for(const input of editorBody.querySelectorAll('[data-trait]')){
   const key=input.dataset.trait,level=founderLevel(key,g[key]);
   if(document.activeElement!==input)input.value=String(level);
   const bar=input.closest('.founder-trait')?.querySelector('.ability-track');
   if(bar){
    bar.setAttribute('aria-valuenow',String(level));
    bar.querySelector('.ability-fill').style.width=((level-1)/9*100)+'%';
   }
  }
  refreshDerivedDashboard(editorBody,g,base);
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
  // Keep every editable locus and every derived value visible together:
  // left = six core stats, six inherited skills, seven strategies
  // right = all 37 read-only expressed values, updated live.
  const strategyInputs=FOUNDER_TRAITS.find(([section])=>section==='生存戦略')[1];
  editorBody.innerHTML=
   '<div class="founder-compact-header"><div class="compact-founder-top">'+
    '<canvas id="founderAfterCanvas" width="180" height="132" aria-label="調整後のスライム"></canvas>'+
    '<div class="compact-founder-info"><div class="founder-species-name-line"><b id="founderSpeciesName" aria-live="polite"></b></div>'+
    '<small id="founderPreviewChanges"></small><p id="founderCost" class="founder-budget"></p>'+
    '<p class="founder-habitat-compact" id="founderHabitatTip"></p>'+
    '<div id="founderSummary" hidden></div></div></div>'+
   '<div class="founder-preset-selection"><strong>初期設定</strong><div class="founder-preset-grid">'+
    FOUNDER_PRESETS.map(p=>'<button type="button" data-founder-preset="'+p.id+'" title="'+escape(p.description)+'">'+escape(p.name)+'</button>').join('')+
    '<button type="button" id="randomFounderPreset" title="ランダムな遺伝子で始める">🎲 ランダム</button></div></div></div>'+
   '<div class="founder-two-columns">'+
    '<section class="founder-genome-column" aria-label="遺伝子編集">'+
     '<section class="founder-basic-section"><h3>基本ステータス <small>遺伝する／1〜10</small></h3>'+
      '<div class="basic-stat-grid">'+BASIC_STATS.map(stat=>
       '<div class="basic-stat-card" title="'+escape(stat.help)+'">'+
        '<div class="basic-stat-head"><strong>'+stat.icon+' '+escape(stat.name)+'</strong>'+
         '<span class="founder-trait-help" tabindex="0" title="'+escape(stat.help)+'">ⓘ</span></div>'+
        '<div class="compact-value"><button type="button" data-basic-adjust="-1" aria-label="'+escape(stat.name)+'を減らす">−</button>'+
         '<input type="number" min="1" max="10" step="1" data-basic-stat="'+stat.key+'" aria-label="'+escape(stat.name)+'" value="'+basicStatLevel(currentGenome(),stat.key)+'">'+
         '<button type="button" data-basic-adjust="1" aria-label="'+escape(stat.name)+'を増やす">＋</button></div>'+
        '<div class="ability-track" role="meter" aria-label="'+escape(stat.name)+'" aria-valuemin="1" aria-valuemax="10" aria-valuenow="'+basicStatLevel(currentGenome(),stat.key)+'">'+
        '<span class="ability-fill" style="width:'+((basicStatLevel(currentGenome(),stat.key)-1)/9*100)+'%"></span></div></div>'
      ).join('')+'</div></section>'+
     '<section class="founder-skills-section"><h3>スキル <small>遺伝する／保有・未習得</small></h3>'+
      '<div id="founderSkills" class="founder-skills-grid"></div></section>'+
     '<section class="founder-strategy-section"><h3>生存戦略 <small>遺伝する／7項目</small></h3>'+
      '<div id="founderGeneEditor" class="founder-strategy-grid">'+strategyInputs.map(([key,name])=>{
       const level=founderLevel(key,currentGenome()[key]);
       return '<div class="founder-trait" title="'+escape(founderTraitHelp(key))+'">'+
        '<label for="edit-'+key+'">'+escape(name)+' <span class="founder-trait-help" tabindex="0" title="'+escape(founderTraitHelp(key))+'">ⓘ</span>'+
        '<small data-point-cost="'+key+'" hidden></small></label>'+
        '<div class="compact-value"><button type="button" data-adjust="-1" aria-label="'+escape(name)+'を減らす">−</button>'+
        '<input id="edit-'+key+'" type="number" data-trait="'+key+'" min="1" max="10" step="1" value="'+level+'">'+
        '<button type="button" data-adjust="1" aria-label="'+escape(name)+'を増やす">＋</button></div>'+
        '<small class="founder-level-meaning" data-trait-meaning="'+key+'">'+escape(founderLevelMeaning(key,level))+'</small>'+
        '<div class="ability-track" role="meter" aria-label="'+escape(name)+'" aria-valuemin="1" aria-valuemax="10" aria-valuenow="'+level+'">'+
        '<span class="ability-fill" style="width:'+((level-1)/9*100)+'%"></span></div></div>';
      }).join('')+'</div></section>'+
    '</section>'+
    '<div class="founder-phenotype-column">'+derivedDashboardHTML()+'</div>'+
   '</div>'+
   '<div class="founder-reference-footer"><button type="button" id="toggleGeneEditor" aria-expanded="false" aria-controls="founderFormulaReference">📐 変換式の詳細</button>'+
    founderFormulaHTML()+'</div>';
  editorFoot.innerHTML='<button type="button" id="resetFounder">標準に戻す</button><button type="button" id="cancelFounder">閉じる</button><button type="button" id="confirmFounder">移入</button>';
  editorBody.querySelector('#toggleGeneEditor').onclick=()=>{
   const reference=editorBody.querySelector('#founderFormulaReference');
   reference.open=!reference.open;
   editorBody.querySelector('#toggleGeneEditor').setAttribute('aria-expanded',String(reference.open));
  };
  editorBody.querySelectorAll('[data-basic-stat]').forEach(input=>{
   const apply=()=>{
    if(input.value===''||!Number.isFinite(Number(input.value)))return;
    const desired=Math.max(1,Math.min(10,Math.round(Number(input.value))));
    const edited=editBasicStat(currentGenome(),input.dataset.basicStat,desired);
    changes[input.dataset.basicStat]=edited.dna[input.dataset.basicStat];
    updateEditorSummary();
   };
   input.addEventListener('change',apply);
   input.addEventListener('input',apply);
   input.closest('.basic-stat-card').querySelectorAll('[data-basic-adjust]').forEach(button=>{
    button.onclick=()=>{
     const now=basicStatLevel(currentGenome(),input.dataset.basicStat);
     input.value=String(Math.max(1,Math.min(10,now+Number(button.dataset.basicAdjust))));
     apply();
    };
   });
  });
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
    const next=['aquatic','albino'].includes(key)?(direction>0?10:1):
     key==='repro'?(direction>0?now<6?6:10:now>6?6:1):
     key==='biome'?(direction>0?now<4?4:now<7?7:10:now>7?7:now>4?4:1):
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
  if(!parents.length)return '<p class="muted">親の情報がないため比較できません。</p>';
  const rows=BASIC_STATS.map(stat=>{
   const value=basicStatLevel(g,stat.key),pv=parents.map(p=>basicStatLevel(p.genome,stat.key));
   const changed=pv.some(x=>x!==value);
   const score=Math.max(...pv.map(x=>Math.abs(value-x)));
   const cells=pv.map(x=>{
    const diff=value-x,dir=diff>0?'up':diff<0?'down':'same';
    return '<td>'+x+'/10 <small class="discovery-delta '+dir+'">'+
     (diff>0?'+':'')+diff+'</small></td>';
   }).join('');
   return {changed,score,html:'<tr><th>'+stat.icon+' '+escape(stat.name)+'</th><td><strong>'+
    value+'/10</strong></td>'+cells+'</tr>'};
  });
  const table=items=>'<div class="discovery-table-wrap"><table class="discovery-table"><thead><tr><th>基本ステータス</th><th>新種</th>'+
   parents.map((p,i)=>'<th>親'+(i+1)+'（新種との差）</th>').join('')+'</tr></thead><tbody>'+
   items.map(r=>r.html).join('')+'</tbody></table></div>';
  const sorted=[...rows].sort((a,b)=>b.score-a.score);
  return '<h3>親から変化した基本ステータス</h3><p class="muted">6つの基本ステータスのみを比較。差分は新種−親です。詳細な遺伝子と変換式は移入画面で確認できます。</p>'+
   (sorted.some(r=>r.changed)?table(sorted.filter(r=>r.changed)):'<p>基本ステータスに変化なし。</p>')+
   '<details><summary>変化のない基本ステータス</summary>'+table(sorted.filter(r=>!r.changed))+'</details>';
 }
 function showNextDiscovery(){
  if(!discoveryQueue.length){if(discovery.open)discovery.close();return false;}
  const item=discoveryQueue[0],sp=item.species,g=sp.genome;
  const parents=(sp.parents??[]).filter(p=>p?.genome);
  discoveryBody.innerHTML='<p class="muted">Step '+item.step+' に発見。確認するまでシミュレーションを停止しています。</p>'+
   '<div class="discovery-portraits">'+[{name:sp.name,genome:g},...parents].map((p,i)=>'<figure><canvas width="180" height="132" data-discovery-portrait="'+i+'"></canvas><figcaption><strong>'+(i===0?'✨ 新種':'親'+i+' #'+p.id)+'</strong><br>'+escape(p.name)+'</figcaption></figure>').join('')+'</div>'+
   summary(g)+comparisonHTML(g,parents);
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
