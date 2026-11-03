import {Ecosystem,WORLD,TERRAIN_NAMES,TERRAIN_COLORS,dietProfile,terrainFitness,TERRAIN_FERTILITY,vitality,morphology,adaptationColor,eggPredationDrive,protectiveDrive,thermalFitness,lifeDrain,longevityUpkeep,genomeCode} from './simulation.js?v=seasons-1';
import {drawWorld,drawChart} from './renderer.js?v=seasons-1';
import {EcologyLogbook,observeEcology} from './ecology-log.js?v=ecology-logs-1';
const $=id=>document.getElementById(id);
const game=new Ecosystem();
const LOG_VERSION=new URL(import.meta.url).searchParams.get('v')||'development';
let localLogStorage=null;
try{localLogStorage=window.localStorage;}catch{}
const ecologyLog=new EcologyLogbook(localLogStorage,LOG_VERSION);
const recordStep=()=>ecologyLog.record(observeEcology(game));
const canvas=$('world'),ctx=canvas.getContext('2d'),graph=$('chart').getContext('2d'),longGraph=$('ecologyLongChart').getContext('2d');
let running=false,speed=1,mode='spawn',filter='all',brush=3,selected=null,selectedSpecies=null,catalogMarkup='',painting=false,last=0,acc=0,uiAt=0,logRunOptions='',selectedLogRun=null;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GENE_LABELS={r:'体の大きさ',elongation:'体の長さ比',eyes:'目の数',mouths:'口の能力',jaw:'顎の能力',wet:'水への適応',dry:'乾燥への適応',rock:'岩場への適応',aquatic:'水生／陸生',shell:'卵殻',guard:'卵の保護',nesting:'産卵場所',brood:'産卵数',diet:'食性',deception:'擬態',resist:'感染抵抗力',longevity:'長寿特性',albino:'白色変異'};
function genomeValue(key,value){return key==='aquatic'?(value===1?'水生':'陸生'):typeof value==='number'?(Number.isInteger(value)?String(value):value.toFixed(3)):String(value);}
function speciesColor(sp){
 const g=sp.genome;
 if(!g)return '#70c6ad';
 const c=adaptationColor(g);
 return `hsl(${c.hue},${c.saturation}%,${c.lightness}%)`;
}
function speciesRepresentative(key,species,liveBySpecies){
 return liveBySpecies.get(key)?.g||species.genome;
}
function speciesAbilityText(g){
 if(!g)return '能力情報なし';
 const m=morphology(g),diet=dietProfile(g),hp=Math.max(25,Math.round(m.bodyMass*.48+25));
 const fmt=v=>v.toFixed(2);
 const habitat=g.aquatic===1?'水生':'陸生';
 const strategy=protectiveDrive(g)>.52?'卵の守護種':eggPredationDrive(g)>.62?'卵を狙う危険種':'一般型';
 return `<div class="species-abilities" aria-label="計算済みの能力"><span title="草地での基準移動速度">速 ${fmt(m.speed*.58)}</span><span title="草地での視界距離">視 ${Math.round(m.eyeRange)}</span><span title="最大HP（健康な成体）">HP ${hp}</span><span title="長寿遺伝子。高いほどHPの自然減少が遅いが代謝コストが高い">長寿 ×${fmt(g.longevity??1)}</span><span title="1ステップあたりの基礎代謝（長寿のコストを含む）">代謝 ${fmt(m.upkeep+longevityUpkeep(g))}</span><span title="食性">${escapeHTML(diet.label)}</span><span title="遺伝した食性・顎・保護能力による生態的戦略">${strategy}</span><span title="生息型">${habitat}</span><span title="乾燥地／岩場／水辺の適応度">適応 乾${fmt(terrainFitness(g,2).fitness)} 岩${fmt(terrainFitness(g,3).fitness)} 水${fmt(terrainFitness(g,1).fitness)}</span></div>`;
}
function catalogSpecies(liveBySpecies){
 const phenotype=e=>speciesRepresentative(e[0],e[1],liveBySpecies);
 const entries=[...game.species.entries()].filter(([,s])=>$('showExtinct').checked||s.current>0);
 const comparators={
  current:(a,b)=>b[1].current-a[1].current||b[1].total-a[1].total||a[1].n-b[1].n,
  total:(a,b)=>b[1].total-a[1].total||b[1].current-a[1].current||a[1].n-b[1].n,
  newest:(a,b)=>b[1].first-a[1].first||b[1].n-a[1].n,
  oldest:(a,b)=>a[1].first-b[1].first||a[1].n-b[1].n,
  name:(a,b)=>a[1].name.localeCompare(b[1].name,'ja')||a[1].n-b[1].n,
  speed:(a,b)=>morphology(phenotype(b)).speed-morphology(phenotype(a)).speed||a[1].n-b[1].n,
  sight:(a,b)=>morphology(phenotype(b)).eyeRange-morphology(phenotype(a)).eyeRange||a[1].n-b[1].n,
  hp:(a,b)=>morphology(phenotype(b)).bodyMass-morphology(phenotype(a)).bodyMass||a[1].n-b[1].n,
  upkeep:(a,b)=>morphology(phenotype(a)).upkeep-morphology(phenotype(b)).upkeep||a[1].n-b[1].n
 };
 return entries.sort(comparators[$('speciesSort').value]||comparators.current);
}
function speciesGenomeHTML(key){
 const species=game.species.get(key);
 if(!species)return '';
 const representative=game.units.find(u=>u.category===key&&!u.dead);
 const genome=representative?.g||species.genome;
 if(!genome)return '<p class="muted">この種の遺伝子記録はありません。</p>';
 const origin=representative?'現存する代表個体 #'+representative.id:'発見時に保存した遺伝子';
 const fields=Object.entries(GENE_LABELS).filter(([gene])=>genome[gene]!==undefined).map(([gene,label])=>{const pair=genome.alleles?.[gene];return `<div class="gene"><span>${escapeHTML(label)} <small>${gene}</small>${pair?`<small class="allele-pair">遺伝子型 ${pair.map(v=>escapeHTML(genomeValue(gene,v))).join(' / ')}</small>`:''}</span><b>${escapeHTML(genomeValue(gene,genome[gene]))}</b></div>`;}).join('');
 return `<div class="genome-heading"><strong>${escapeHTML(species.name)} の遺伝子</strong><button type="button" data-close-genome="true">閉じる</button></div><p class="muted">${escapeHTML(origin)}。種名は8つの分類特徴から固定生成されるため、初期化しても同じ分類なら同名です。詳細遺伝子コードは21項目の数値を16段階に丸めたものです。同じ種でも個体ごとに異なる場合があります。</p><p class="muted"><strong>遺伝子コード：<code>${genomeCode(genome)}</code></strong></p><div class="genome-grid">${fields}</div>`;
}
function update(){
 const dietCounts=[0,0,0];for(const u of game.units){const d=dietProfile(u.g).diet;dietCounts[d<.3?0:d>.7?2:1]++;}
 $('dietStats').textContent=`栄養食 ${dietCounts[0]} ／ 雑食 ${dietCounts[1]} ／ 肉食 ${dietCounts[2]}`;
 $('startHint').textContent=game.introducedCount===0?'移入する生命の種類数を選び、フィールドをクリックして生態系を開始してください。':'生命を移入しました。追加の移入も可能です。';
 const infected=game.units.filter(u=>u.infection>0).length;
 $('diseaseInfo').textContent='感染個体 '+infected+'体';
 const averageFitness=game.units.length?game.units.reduce((total,u)=>total+terrainFitness(u.g,game.terrain(u.x,u.y)).fitness,0)/game.units.length:0;
 const descendants=game.units.filter(u=>u.generation>0);
 const averageCrowding=game.units.length?game.units.reduce((sum,u)=>sum+(u.habitatLoad??0),0)/game.units.length:0;
 const data={maxGeneration:game.units.length?Math.max(...game.units.map(u=>u.generation)):0,offspringCount:descendants.length,averageFitness:averageFitness.toFixed(2),population:game.units.length,eggCount:game.eggs.length,matingCount:game.matings,juvenileCount:game.units.filter(u=>u.stage==='juvenile').length,livingSpecies:game.livingSpecies,totalSpecies:game.species.size,corpses:game.corpses.length,nutrients:Math.round(game.grass.reduce((a,b)=>a+b,0)),waterRemaining:Math.round(game.water.reduce((a,b)=>a+b,0)),waterweedRemaining:Math.round(game.waterweed.reduce((a,b)=>a+b,0)),recycled:game.recycled,migrationCount:game.migrations};
 for(const [id,value] of Object.entries(data))$(id).textContent=typeof value==='number'?value.toLocaleString('ja-JP'):value;
 $('seasonStatus').textContent=game.climateEnabled?({spring:'🌸 春',summer:'☀️ 夏',autumn:'🍂 秋',winter:'❄️ 冬'}[game.seasonName()]):'季節変動 OFF';
 $('temperatureStatus').textContent='🌡 '+game.temperature.toFixed(1)+'℃';
 $('weatherStatus').textContent=game.climateEnabled&&game.seasonName()==='winter'&&game.weather==='rain'?'❄ 雪':({sunny:'☀ 晴れ',cloudy:'☁ 曇り',rain:'🌧 雨'}[game.weather]||'☀ 晴れ');
 $('stepCount').textContent=game.tick.toLocaleString('ja-JP');$('status').textContent=game.introducedCount===0?'移入待ち':running?'実行中':'停止中';$('play').textContent=running?'Ⅱ 停止':'▶ 再生';$('play').classList.toggle('active',running);
 const liveBySpecies=new Map();for(const u of game.units)if(!u.dead&&!liveBySpecies.has(u.category))liveBySpecies.set(u.category,u);
 const catalogRows=catalogSpecies(liveBySpecies);
 $('catalogCount').textContent=($('showExtinct').checked?'表示':'現存')+' '+catalogRows.length+'種';
 const nextCatalog=catalogRows.map(([key,sp])=>`<button type="button" class="species species-entry${selectedSpecies===key?' selected':''}" data-category="${escapeHTML(key)}" aria-expanded="${selectedSpecies===key}"><span class="dot" style="background:${speciesColor(sp)}"></span><div class="species-info"><b>${escapeHTML(sp.name)}</b><small>#${sp.n} · Step ${sp.first} · ${sp.current?'現存':'絶滅'}</small>${speciesAbilityText(speciesRepresentative(key,sp,liveBySpecies))}</div><span>${sp.current}</span><span>${sp.total}</span></button>${selectedSpecies===key?`<div class="genome-panel species-expanded">${speciesGenomeHTML(key)}</div>`:''}`).join('');
 if(nextCatalog!==catalogMarkup){$('catalog').innerHTML=nextCatalog;catalogMarkup=nextCatalog;}
 const eventColors={birth:'#91f7ac',death:'#ff8290',meal:'#f9d36b',pred:'#be82ec',new:'#ffe486',decay:'#e2b96e',egg:'#eddfbd',hatch:'#a0e8bd',eggeaten:'#f5949c',mature:'#a0d9ff',attack:'#ffb7a1',defend:'#75f0e7',ill:'#ed8bab',migration:'#b4e0ff',settle:'#88debc',mate:'#f5a5ed',court:'#ff91e8',laid:'#ffe3a1'};
 $('events').innerHTML=game.logs.filter(e=>filter==='all'||e.type===filter).slice(0,60).map(e=>`<div class="log-entry"><span style="color:${eventColors[e.type]||'#9eb0b8'}">●</span> [${e.step}] ${escapeHTML(e.message)}</div>`).join('');
 const people=[0,0,0,0],food=[0,0,0,0],corpses=[0,0,0,0],fitness=[0,0,0,0];for(const u of game.units){const t=game.terrain(u.x,u.y);people[t]++;fitness[t]+=terrainFitness(u.g,t).fitness;}for(let i=0;i<game.tiles.length;i++){food[game.tiles[i]]+=(game.grass[i]||0)+(game.waterweed[i]||0);}for(const c of game.corpses)corpses[game.terrain(c.x,c.y)]++;
 $('habitats').innerHTML=TERRAIN_NAMES.map((name,i)=>`<div><span><span style="display:inline-block;width:11px;height:11px;background:${TERRAIN_COLORS[i]};margin-right:5px"></span>${name}</span><span>植物生産性 ${Math.round(TERRAIN_FERTILITY[i]*100)}% / 生命 ${people[i]} / 適応度平均 ${people[i]?(fitness[i]/people[i]).toFixed(2):'—'} / 資源 ${Math.round(food[i])} / 死体 ${corpses[i]}</span></div>`).join('');
 $('inspector').textContent=selected&&!selected.dead?`#${selected.id} ${game.species.get(selected.category)?.name}｜性別 ${selected.sex==='H'?'⚥ 雌雄同体':selected.sex==='F'?'♀ メス':'♂ オス'}｜繁殖方式 ${selected.g.repro===1?'雌雄同体':selected.g.repro===2?'単為生殖可能':'雌雄異体'}｜適温 ${selected.g.idealTemp.toFixed(1)}℃｜耐性 ±${selected.g.tempTolerance.toFixed(1)}℃｜現在気温 ${game.temperatureAt(selected.x,selected.y).toFixed(1)}℃｜温度適合 ${Math.round(thermalFitness(selected.g,game.temperatureAt(selected.x,selected.y)).comfort*100)}%｜体格 ×${(selected.growthScale??1).toFixed(2)}｜幅 ${(selected.g.r*(selected.growthScale??1)).toFixed(1)}｜長さ比 ${selected.g.elongation.toFixed(2)}｜目 ${selected.g.eyes}｜口 ${selected.g.mouths}｜顎 ${selected.g.jaw.toFixed(2)}｜水適応 ${selected.g.wet.toFixed(2)}｜乾燥適応 ${selected.g.dry.toFixed(2)}｜段階 ${selected.stage==='juvenile'?'幼体':'成体'}${selected.stage==='juvenile'?`｜幼体成長 ${Math.round((selected.juvenileGrowth??0)*100)}%`:''}｜現在地 ${TERRAIN_NAMES[game.terrain(selected.x,selected.y)]}（適応度 ${terrainFitness(selected.g,game.terrain(selected.x,selected.y)).fitness.toFixed(2)}）｜水辺 ${selected.g.wet.toFixed(2)}・乾燥地 ${selected.g.dry.toFixed(2)}・岩場 ${selected.g.rock.toFixed(2)}｜移住 ${selected.migrations}｜水中視界 ${Math.round(terrainFitness(selected.g,1).sight*100)}%｜生息型 ${selected.g.aquatic===1?'水生':'陸生'}｜水分 ${Math.round(selected.hydration)}｜離水 ${selected.stranded}｜水没 ${selected.submerged}｜水進入 ${terrainFitness(selected.g,1).passable?'可能':'不可'}｜乾燥危険 ${terrainFitness(selected.g,2).hazard.toFixed(2)}｜感染 ${selected.infection>0?'あり':'なし'}｜同系統の近隣 ${selected.localCrowd??0}｜食性 ${dietProfile(selected.g).label} (${Math.round(dietProfile(selected.g).diet*100)}%肉食寄り)｜外見 ${dietProfile(selected.g).signal>.55?'肉食型':dietProfile(selected.g).signal<.45?'栄養食型':'中間型'}｜擬態 ${Math.abs(dietProfile(selected.g).diet-dietProfile(selected.g).signal)>.38?'あり':'なし'}｜行動 ${selected.fleeing?'逃走中':'通常'}｜一度に産む卵 ${selected.g.brood}｜体色 ${selected.g.albino===1?'白色変異':'地形適応に連動'}｜卵殻 ${selected.g.shell.toFixed(2)}｜保護 ${selected.g.guard.toFixed(2)}｜産卵場所 ${selected.g.nesting.toFixed(2)}｜生命力 ${Math.round(selected.hp)}/${selected.maxHp}｜長寿特性 ×${(selected.g.longevity??1).toFixed(2)}｜自然HP減少 ${lifeDrain(selected,{temperature:game.temperatureAt(selected.x,selected.y),terrain:game.terrain(selected.x,selected.y)}).toFixed(3)}/step｜老化 ${Math.round(vitality(selected).old*100)}%｜活力 ${Math.round(vitality(selected).vigor*100)}%｜エネルギー ${selected.energy.toFixed(1)}｜繁殖 ${selected.pregnancy?'産卵準備中 '+selected.pregnancy.remaining+'ステップ':selected.courtPartner?'求愛中 #'+selected.courtPartner:'通常'}｜両親 ${selected.parent===null?'始祖':'#'+selected.parent+' / #'+selected.otherParent}｜第${selected.generation}世代`:'観察モードで生命をクリック。';
 $('diagnostic').textContent=`生存 ${game.units.length}体・卵 ${game.eggs.length}個。局所的な空間負荷平均 ${averageCrowding.toFixed(2)}。新形態：直近300ステップで ${game.recentSpecies} 種。第1世代以降の割合 ${game.units.length?Math.round(descendants.length/game.units.length*100):0}%。環境適応度平均 ${averageFitness.toFixed(2)}。${game.units.length?'生き残る遺伝子と多様な子孫の変化を観察できます。':game.introducedCount===0?'生命の移入待ちです。':'全個体が絶滅しました。移入で再開できます。'}`;
 const status=ecologyLog.lastSaveOk===false?'保存できません（ブラウザの保存設定・空き容量を確認）':'このブラウザに自動保存';
 $('ecologyLogStatus').textContent=`記録バージョン ${LOG_VERSION} ｜ ${ecologyLog.data.runs.length}試行 ｜ ${ecologyLog.sampleCount.toLocaleString('ja-JP')}行 ｜ 50ステップごと ｜ ${status}`;
 const runOptions=ecologyLog.data.runs.map(run=>`<option value="${run.id}">試行 #${run.id}（Seed ${run.seed}）</option>`).join('');
 if(runOptions!==logRunOptions){
  logRunOptions=runOptions;$('ecologyRun').innerHTML=runOptions;
 }
 if(selectedLogRun===null||!ecologyLog.data.runs.some(run=>run.id===selectedLogRun))
  selectedLogRun=ecologyLog.data.runs.at(-1)?.id??null;
 $('ecologyRun').value=selectedLogRun??'';
 const displayed=ecologyLog.data.runs.find(run=>run.id===selectedLogRun);
 drawChart(longGraph,displayed?.samples??[]);
 $('ecologyLogSummary').textContent=displayed?.samples?.length?
  `Step ${displayed.samples[0].step}～${displayed.samples.at(-1).step} ｜ 生存個体 最小 ${Math.min(...displayed.samples.map(row=>row.population))}・最大 ${Math.max(...displayed.samples.map(row=>row.population))}・最終 ${displayed.samples.at(-1).population}`:
  '生命を移入すると記録が始まります。';
 drawChart(graph,game.history);
}
function render(){drawWorld(ctx,game,$('effects').checked,selected);}
function reset(){
 ecologyLog.end(ecologyLog.activeId===null?null:observeEcology(game));
 game.reset();selected=null;selectedSpecies=null;running=false;mode='spawn';document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));syncSliders();update();render();}
function syncSliders(){$('growth').value=game.growth;$('growthValue').value=game.growth;$('stress').value=game.stress;$('stressValue').value=game.stress;$('rainfall').value=game.rainfall;$('rainfallValue').value=game.rainfall;$('temperature').value=game.baseTemperature;$('temperatureValue').value=game.baseTemperature+'℃';$('climateEnabled').checked=game.climateEnabled;}
function frame(time){if(!last)last=time;const dt=Math.min(.08,(time-last)/1000);last=time;game.visualTick=(game.visualTick??0)+dt*30;if(running){
  // Do not process a backlog of 10 expensive simulation ticks in one frame.
  // Dense worlds remain interactive rather than freezing on catch-up work.
  const dense=game.units.length>250;
  acc=Math.min(dense?2:10,acc+dt*14*speed);
  const n=Math.min(dense?1:10,Math.floor(acc));
  acc-=n;
  for(let i=0;i<n;i++){game.step();if(game.tick%50===0)recordStep();}
 }for(const fx of game.effects)fx.age+=dt*30;game.effects=game.effects.filter(fx=>fx.age<35);render();if(time-uiAt>180){update();uiAt=time;}requestAnimationFrame(frame);}
function coords(e){const b=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(WORLD.width-.1,(e.clientX-b.left)/b.width*WORLD.width)),y:Math.max(0,Math.min(WORLD.height-.1,(e.clientY-b.top)/b.height*WORLD.height))};}
function interact(e){const {x,y}=coords(e);if(['0','1','2','3'].includes(mode))game.paint(x,y,Number(mode),brush);else if(mode==='food'){game.paint(x,y,0,brush);game.log('info','プレイヤーが草を補充');}else if(mode==='fertilize'){game.fertilize(x,y,brush);}else if(mode==='spawn'){const n=Math.max(1,Math.min(6,Math.trunc(Number($('founderTypes').value)||1)));$('founderTypes').value=n;const result=game.introduce(x,y,n);if(result.individuals>0){if(ecologyLog.activeId===null)ecologyLog.start(game.initialSeed);ecologyLog.record(observeEcology(game),true);running=true;}}else if(mode==='inspect'){selected=null;let best=500;for(const u of game.units){const d=(u.x-x)**2+(u.y-y)**2;if(d<best){best=d;selected=u;}}}update();render();}
canvas.addEventListener('pointerdown',e=>{painting=true;canvas.setPointerCapture(e.pointerId);interact(e);});canvas.addEventListener('pointermove',e=>{if(painting&&['0','1','2','3','fertilize'].includes(mode))interact(e);});canvas.addEventListener('pointerup',()=>painting=false);canvas.addEventListener('pointercancel',()=>painting=false);
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));}));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));update();}));
$('speciesSort').onchange=update;
$('showExtinct').onchange=update;
$('catalog').addEventListener('click',e=>{
 if(e.target.closest('[data-close-genome]')){selectedSpecies=null;update();return;}
 const b=e.target.closest('[data-category]');if(!b)return;
 selectedSpecies=selectedSpecies===b.dataset.category?null:b.dataset.category;
 update();
 const details=$('catalog').querySelector('.species-expanded');
 if(details)details.scrollIntoView({block:'nearest'});
});
$('play').onclick=()=>{if(game.introducedCount===0){mode='spawn';document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));return;}running=!running;update();};$('stepOnce').onclick=()=>{if(game.introducedCount===0)return;running=false;game.step();if(game.tick%50===0)recordStep();update();render();};$('speed').onclick=()=>{speed=speed===1?3:speed===3?8:1;$('speed').textContent='速度 ×'+speed;};$('reset').onclick=()=>reset();
$('ecologyRun').onchange=e=>{selectedLogRun=Number(e.target.value);update();};
$('downloadEcologyLog').onclick=()=>{
 const csv=ecologyLog.toCSV(),blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='edenomaly-ecology-'+LOG_VERSION+'.csv';
 document.body.appendChild(link);link.click();link.remove();
 URL.revokeObjectURL(url);
};
$('clearEcologyLog').onclick=()=>{
 if(!window.confirm('このバージョンの生態系推移ログをすべて削除しますか？'))return;
 ecologyLog.clear();selectedLogRun=null;logRunOptions='';
 if(game.introducedCount>0){ecologyLog.start(game.initialSeed);ecologyLog.record(observeEcology(game),true);}
 update();
};
$('founderTypes').oninput=e=>{const n=Math.max(1,Math.min(6,Math.trunc(Number(e.target.value)||1)));$('founderPreview').textContent=n+'種類・'+(n*8)+'体';};
$('brush').oninput=e=>{brush=Number(e.target.value);$('brushValue').value=brush;};$('growth').oninput=e=>{game.growth=Number(e.target.value);$('growthValue').value=game.growth;};$('stress').oninput=e=>{game.stress=Number(e.target.value);$('stressValue').value=game.stress;};$('rainfall').oninput=e=>{game.rainfall=Number(e.target.value);$('rainfallValue').value=game.rainfall;};$('climateEnabled').onchange=e=>{game.climateEnabled=e.target.checked;game.updateTemperature();update();};$('temperature').oninput=e=>{game.baseTemperature=Number(e.target.value);game.updateTemperature();$('temperatureValue').value=game.baseTemperature+'℃';update();};
$('drought').onclick=()=>{game.drought();syncSliders();update();};$('rain').onclick=()=>{game.rain();syncSliders();update();};$('epidemic').onclick=()=>{game.epidemic();update();};
reset();requestAnimationFrame(frame);
