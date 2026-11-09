import {zipFiles} from './zip-log.js?v=2026.11.07.4';
import {Ecosystem,WORLD,TERRAIN_NAMES,TERRAIN_COLORS,dietProfile,terrainFitness,TERRAIN_FERTILITY,TERRAIN_LEVEL_NAMES,vitality,morphology,adaptationColor,eggPredationDrive,protectiveDrive,thermalFitness,lifeDrain,longevityUpkeep,genomeCode} from './simulation.js?v=2026.11.10.1';
import {GameSession,parseMeta,settleMeta} from './game-mode.js?v=2026.11.08.11';
import {fitView,screenToWorld,zoomAround,panBy,MAX_ZOOM,ZOOM_STEP} from './viewport.js?v=2026.11.08.12';
import {drawWorld,drawChart} from './renderer.js?v=2026.11.10.1';
import {EcologyLogbook,observeEcology} from './ecology-log.js?v=2026.11.08.13';
import {SpeciesLogbook} from './species-statistics.js';
import {performancePolicy,simulationBatch,BROWSER_BACKGROUND_INTERVAL} from './performance-policy.js?v=video-friendly-1';
const $=id=>document.getElementById(id);
// Release label is bundled with the running source; comparison uses a
// separately published manifest from the repository's main branch.
const BUILD_VERSION='2026.11.10.1';
const VERSION_SOURCE='https://raw.githubusercontent.com/memem47/Edenomaly/main/web/version.json';
$('buildVersion').textContent=BUILD_VERSION;
async function checkLatestVersion(){
 const status=$('versionStatus'),button=$('checkVersion');
 status.textContent='確認中…';button.disabled=true;
 try{
  const response=await fetch(VERSION_SOURCE+'?t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const latest=await response.json();
  if(typeof latest.version!=='string'||!/^[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]+$/.test(latest.version))throw new Error('invalid manifest');
  const current=BUILD_VERSION.split('.').map(Number),remote=latest.version.split('.').map(Number);
  const comparison=remote.findIndex((n,i)=>n!==current[i]);
  const needsUpdate=comparison>=0&&remote[comparison]>current[comparison];
  const ahead=comparison>=0&&remote[comparison]<current[comparison];
  status.textContent=needsUpdate?'更新あり：'+latest.version:ahead?'開発版（公開版 '+latest.version+'）':'最新版です';
  $('latestVersionLink').href='https://github.com/memem47/Edenomaly';
 }catch{
  status.textContent='確認不可（ネットワークを確認）';
 }finally{button.disabled=false;}
}
$('checkVersion').addEventListener('click',checkLatestVersion);
checkLatestVersion();
const game=new Ecosystem();
const session=new GameSession(game);
let playMode='lab';
const META_KEY='edenomaly-game-rewards-v1';
const LOG_VERSION=new URL(import.meta.url).searchParams.get('v')||'development';
let localLogStorage=null;
try{localLogStorage=window.localStorage;}catch{}
const ecologyLog=new EcologyLogbook(localLogStorage,LOG_VERSION);
const speciesLog=new SpeciesLogbook(localLogStorage,LOG_VERSION);
let meta=parseMeta(localLogStorage?.getItem(META_KEY));let rewardRecorded=false;
const GRAPHICS_KEY='edenomaly-graphics-mode-v1';
const savedGraphics=(()=>{try{return localLogStorage?.getItem(GRAPHICS_KEY);}catch{return null;}})();
let graphicsMode=['classic','enhanced','jelly'].includes(savedGraphics)?savedGraphics:'jelly';
$('graphicsMode').value=graphicsMode;
$('graphicsMode').addEventListener('change',e=>{
 graphicsMode=['classic','enhanced','jelly'].includes(e.target.value)?e.target.value:'jelly';
 try{localLogStorage?.setItem(GRAPHICS_KEY,graphicsMode);}catch{}
 render();
});
function observeGame(){
 if(playMode!=='game')return;
 session.observe();
 if(session.finished){
  running=false;
  if(!rewardRecorded){
   meta=settleMeta(meta,session);
   try{localLogStorage?.setItem(META_KEY,JSON.stringify(meta));}catch{}
   rewardRecorded=true;
  }
 }
}
let lastReproductionSample=null;
const recordStep=()=>{lastReproductionSample=observeEcology(game);const ok=ecologyLog.record(lastReproductionSample);ecologyLog.recordIndividuals(game);speciesLog.record(game);return ok;};
const eventVisibility={grassMeal:false};
const canvas=$('world'),ctx=canvas.getContext('2d'),graph=$('chart').getContext('2d'),longGraph=$('ecologyLongChart').getContext('2d');
let running=false,speed=1,mode='spawn',brush=3,terrainLevel=3,selected=null,selectedSpecies=null,catalogMarkup='',painting=false,last=0,acc=0,uiAt=0,paintAt=0,rafId=null,backgroundTimer=null,logRunOptions='',selectedLogRun=null;
let view={zoom:1,x:0,y:0},panEnabled=false,panGesture=null;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GENE_LABELS={idealTemp:'好みの温度',tempTolerance:'温度耐性',hibernate:'休眠傾向',r:'体の大きさ',elongation:'体の長さ比',eyes:'目の数',mouths:'口の能力',jaw:'顎の能力',wet:'水への適応',dry:'乾燥への適応',rock:'岩場への適応',aquatic:'水生／陸生',shell:'卵殻',guard:'卵の保護',nesting:'産卵場所',brood:'産卵数',diet:'食性',deception:'擬態',resist:'感染抵抗力',longevity:'長寿特性',albino:'白色変異',dispersal:'分散傾向',sociability:'集合傾向',caution:'警戒心',predatorSense:'捕食者識別',retaliation:'反撃性',frugality:'省エネ特性',waterGardening:'水草栽培傾向',tailLength:'しっぽの長さ',hornLength:'角の長さ',antennaLength:'触角の長さ',pattern:'体表模様の強さ'};
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
 return `<div class="species-abilities" aria-label="計算済みの能力"><span title="適温と生存に関わる温度耐性">適温 ${fmt(g.idealTemp??22)}℃ ±${fmt(g.tempTolerance??9)}℃</span><span title="休眠能力は遺伝。高いと悪条件で休眠し、活動と繁殖を止めるが栄養を節約する">休眠 ${fmt(g.hibernate??0)}</span><span title="混雑時に仲間から離れようとする遺伝的傾向">分散 ${fmt(g.dispersal??.45)}</span><span title="十分な栄養があるとき同種の仲間に近づく遺伝的傾向">集合 ${fmt(g.sociability??.45)}</span><span title="草地での基準移動速度">速 ${fmt(m.speed*.58)}</span><span title="草地での視界距離">視 ${Math.round(m.eyeRange)}</span><span title="最大HP（健康な成体）">HP ${hp}</span><span title="長寿遺伝子。高いほどHPの自然減少が遅いが代謝コストが高い">長寿 ×${fmt(g.longevity??1)}</span><span title="1ステップあたりの基礎代謝（長寿のコストを含む）">代謝 ${fmt(m.upkeep+longevityUpkeep(g))}</span><span title="食性">${escapeHTML(diet.label)}</span><span title="遺伝した食性・顎・保護能力による生態的戦略">${strategy}</span><span title="生息型">${habitat}</span><span title="乾燥地／岩場／水辺の適応度">適応 乾${fmt(terrainFitness(g,2).fitness)} 岩${fmt(terrainFitness(g,3).fitness)} 水${fmt(terrainFitness(g,1).fitness)}</span></div>`;
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
 return `<div class="genome-heading"><strong>${escapeHTML(species.name)} の遺伝子</strong><button type="button" data-close-genome="true">閉じる</button></div><p class="muted">${escapeHTML(origin)}。種名は体色2文字・食性1文字・生息環境1文字・形態/目/繁殖/行動/温度を表す識別音2文字の計6文字です。詳しい特徴は遺伝子で確認できます。分類が同じなら初期化後も同名です。詳細遺伝子コードは遺伝形質を16段階に丸めたものです。同じ種でも個体ごとに異なる場合があります。</p><p class="muted"><strong>遺伝子コード：<code>${genomeCode(genome)}</code></strong></p><div class="genome-grid">${fields}</div>`;
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
 const reproduction=lastReproductionSample;
 const reproductionProblems=reproduction?
  [ ['気温',reproduction.reproTemperature],['感染',reproduction.reproInfection],
    ['未成熟',reproduction.reproImmature],['栄養不足',reproduction.reproEnergy],
    ['休止中',reproduction.reproCooldown],['妊娠中',reproduction.reproPregnancy],
    ['生命力',reproduction.reproWeak],['相手不在',reproduction.reproNoPartner]]
   .filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).slice(0,4)
   .map(([name,count])=>name+' '+count+'体').join(' / '):'未記録';
 $('reproductionReport').textContent=reproduction?
  `Step ${reproduction.step}時点：繁殖可能 ${reproduction.reproReady}体、相手不在 ${reproduction.reproNoPartner}体。主な繁殖阻害：${reproductionProblems||'なし'}。求愛開始累計 ${reproduction.courtshipStarts}回、中断 ${reproduction.courtshipFailures}回（距離 ${reproduction.courtFailSeparated} / 気温 ${reproduction.courtFailTemperature} / 感染 ${reproduction.courtFailInfection} / エネルギー ${reproduction.courtFailEnergy}）。`:
  '生命の移入後、50ステップごとに繁殖阻害原因を集計します。';
 // Live status uses the same reproduction gates as the simulation.
 const active=game.units.filter(u=>!u.dead);
 const diagnosis=(selected&&!selected.dead?[selected,...active.filter(u=>u!==selected)]:active)
  .slice(0,12).map(u=>game.reproductionDiagnostic(u));
 const cause={ready:'繁殖可能',energy:'栄養不足',temperature:'気温',infection:'感染',
  dormant:'休眠',immature:'未成熟',cooldown:'休止中',pregnancy:'妊娠',weak:'衰弱'};
 const action={mate:'相手へ接近',food:'餌探索',disperse:'分散',retaliate:'反撃',shore:'陸上進出',social:'集合',
  escape:'逃走',guard:'卵保護',wander:'巡回',idle:'未行動',other:'その他'};
 $('individualReproduction').innerHTML=diagnosis.length?
  '<div class="repro-row repro-head"><span>個体・状態</span><span>栄養 / 必要量</span><span>相手距離</span><span>行動</span></div>'+
  diagnosis.map(d=>'<div class="repro-row'+(selected?.id===d.id?' repro-selected':'')+'"><span>#'+d.id+' '+(cause[d.reason]||d.reason)+'</span>'+
   '<span class="'+(d.energy<d.required?'repro-low':'')+'">'+d.energy.toFixed(0)+' / '+d.required.toFixed(0)+'</span>'+
   '<span>'+(d.mateId===null?'相手なし':'#'+d.mateId+' '+d.mateDistance.toFixed(0)+'px')+'</span>'+
   '<span>'+(action[d.target]||d.target)+(d.approachSteps?' '+d.approachSteps+'step':'')+
   (d.approachFailures?' 失敗'+d.approachFailures:'')+'</span></div>').join(''):
  '<p class="muted">現存個体なし。個体別CSVには過去の記録が残ります。</p>';
 const dormancy=game.units.filter(u=>u.dormant&&!u.dead).length;
 const restingEggs=game.eggs.filter(e=>e.dormant&&!e.dead).length;
 $('seasonalStrategies').textContent=`休眠 ${dormancy}体 ・ 休眠卵 ${restingEggs}個。寒暖の適温から外れたとき、休眠遺伝子の強い個体は蓄えを消費して活動を止めます。卵も殻・休眠遺伝子で孵化を遅らせる場合があります。`;
 const data={maxGeneration:game.units.length?Math.max(...game.units.map(u=>u.generation)):0,offspringCount:descendants.length,averageFitness:averageFitness.toFixed(2),population:game.units.length,eggCount:game.eggs.length,matingCount:game.matings,juvenileCount:game.units.filter(u=>u.stage==='juvenile').length,livingSpecies:game.livingSpecies,totalSpecies:game.species.size,corpses:game.corpses.length,nutrients:Math.round(game.grass.reduce((a,b)=>a+b,0)),waterRemaining:Math.round(game.water.reduce((a,b)=>a+b,0)),waterweedRemaining:Math.round(game.waterweed.reduce((a,b)=>a+b,0)),recycled:game.recycled,migrationCount:game.migrations};
 for(const [id,value] of Object.entries(data))$(id).textContent=typeof value==='number'?value.toLocaleString('ja-JP'):value;
 const score=game.runScore;
 $('playModeLab').classList.toggle('active',playMode==='lab');
 $('playModeGame').classList.toggle('active',playMode==='game');
 $('playModeStatus').textContent=playMode==='game'?(session.finished?'絶滅・プレイ終了':session.active?'観察・介入中':'最初の生命を移入'):'自由な環境実験';
 $('interventionPoints').textContent=playMode==='game'?session.points.toLocaleString('ja-JP'):'—';
 $('rewardBank').textContent=meta.bank.toLocaleString('ja-JP');
 $('bestGameScore').textContent=meta.best.toLocaleString('ja-JP');
 $('runReward').textContent=playMode==='game'&&session.finished?'今回 +'+session.reward+'pt':'1000スコアごとに報酬1pt（将来の初期遺伝子強化用）';
 const impact=session.lastImpact;
  const impactText=impact?'直近の介入後100ステップ：周辺食料 '+(impact.deltaFood>=0?'+':'')+impact.deltaFood.toFixed(0)+
   ' / 個体数 '+(impact.deltaPopulation>=0?'+':'')+impact.deltaPopulation+' / 新規誕生 '+impact.births+
   '（相関であり介入による効果とは限りません）':
   session.pendingImpact?'介入後100ステップの結果を計測中':'';
  $('interventionHelp').textContent=playMode==='game'?
   '生存・新種発見・世代交代・多様性維持でポイント獲得。草地・乾燥地・池への種まき、雨、土壌改良で支援。'+impactText:
   'テストモードでは従来どおり自由に操作できます。';
 for(const button of document.querySelectorAll('[data-mode]')){
  const kind=button.dataset.mode;
  button.disabled=playMode==='game'&&(session.finished||!['spawn','inspect','food','fertilize'].includes(kind)||(kind==='spawn'&&session.active)||(kind==='food'&&(!session.active||session.points<5))||(kind==='fertilize'&&(!session.active||session.points<10)));
  if(kind==='food')button.textContent=playMode==='game'?'🌱 草・水草の種（5pt）':'草を補充';
  if(kind==='fertilize')button.textContent=playMode==='game'?'🌿 土壌改良（10pt）':'🌱 土壌改良';
 }
 $('rain').textContent=playMode==='game'?'🌧 降雨（8pt）':'降雨';
 $('rain').disabled=playMode==='game'&&(!session.active||session.finished||session.points<8);
 for(const id of ['drought','epidemic','growth','stress','rainfall','climateEnabled','temperature','brush'])$(id).disabled=playMode==='game';
 $('founderTypes').disabled=playMode==='game';
 if(playMode==='game'){$('founderTypes').value=1;$('founderPreview').textContent='1種類・8体';}
 $('stepOnce').disabled=playMode==='game';
 $('startHint').textContent=playMode==='game'?'ゲームモード：1種類を移入して開始。再移入・直接編集は禁止。絶滅後は初期化して再挑戦。':'テストモード：生命を自由に移入し、生態系を実験できます。';

 $('gameScore').textContent=score.total.toLocaleString('ja-JP');
 $('survivalScore').textContent=score.duration.toLocaleString('ja-JP');
 $('discoveryScore').textContent=score.discoveries.toLocaleString('ja-JP')+'種 / 新種 +'+score.discoveryScore.toLocaleString('ja-JP')+
   '点 ／ 多様性維持 +'+score.balanceScore.toLocaleString('ja-JP')+'点';
 $('runScoreStatus').textContent=!score.started?'移入待ち':score.ended?'絶滅・スコア確定':'生存中・計測中';
 $('seasonStatus').textContent=game.climateEnabled?({spring:'🌸 春',summer:'☀️ 夏',autumn:'🍂 秋',winter:'❄️ 冬'}[game.seasonName()]):'季節変動 OFF';
 $('temperatureStatus').textContent='🌡 '+game.temperature.toFixed(1)+'℃';
 $('weatherStatus').textContent=game.climateEnabled&&game.seasonName()==='winter'&&game.weather==='rain'?'❄ 雪':({sunny:'☀ 晴れ',cloudy:'☁ 曇り',rain:'🌧 雨'}[game.weather]||'☀ 晴れ');
 $('stepCount').textContent=game.tick.toLocaleString('ja-JP');$('status').textContent=game.introducedCount===0?'移入待ち':running?'実行中':'停止中';$('play').textContent=running?'Ⅱ 停止':'▶ 再生';$('play').classList.toggle('active',running);
 const liveBySpecies=new Map();for(const u of game.units)if(!u.dead&&!liveBySpecies.has(u.category))liveBySpecies.set(u.category,u);
 const catalogRows=catalogSpecies(liveBySpecies);
 $('catalogCount').textContent=($('showExtinct').checked?'表示':'現存')+' '+catalogRows.length+'種';
 const nextCatalog=catalogRows.map(([key,sp])=>`<button type="button" class="species species-entry${selectedSpecies===key?' selected':''}" data-category="${escapeHTML(key)}" aria-expanded="${selectedSpecies===key}"><span class="dot" style="background:${speciesColor(sp)}"></span><div class="species-info"><b>${escapeHTML(sp.name)}</b><small>#${sp.n} · Step ${sp.first} · ${sp.current?'現存':'絶滅'}</small>${speciesAbilityText(speciesRepresentative(key,sp,liveBySpecies))}</div><span>${sp.current}</span><span>${sp.total}</span></button>${selectedSpecies===key?`<div class="genome-panel species-expanded">${speciesGenomeHTML(key)}</div>`:''}`).join('');
 if(nextCatalog!==catalogMarkup){$('catalog').innerHTML=nextCatalog;catalogMarkup=nextCatalog;}
 const eventColors={rest:'#b9dbf4',wake:'#ead49b',birth:'#91f7ac',death:'#ff8290',meal:'#f9d36b',pred:'#be82ec',new:'#ffe486',decay:'#e2b96e',egg:'#eddfbd',hatch:'#a0e8bd',eggeaten:'#f5949c',mature:'#a0d9ff',attack:'#ffb7a1',defend:'#75f0e7',ill:'#ed8bab',migration:'#b4e0ff',settle:'#88debc',mate:'#f5a5ed',court:'#ff91e8',courtFail:'#ff879b',courtReject:'#f6b5a1',laid:'#ffe3a1'};
 $('events').innerHTML=game.logs.filter(e=>{
  if(!eventVisibility.grassMeal&&e.type==='meal'&&e.message.includes('草を食べた')&&!e.message.includes('水草を食べた'))return false;
  return eventVisibility[e.type]!==false;
 }).slice(0,60).map(e=>`<div class="log-entry"><span style="color:${eventColors[e.type]||'#9eb0b8'}">●</span> [${e.step}] ${escapeHTML(e.message)}</div>`).join('');
 const people=[0,0,0,0],food=[0,0,0,0],corpses=[0,0,0,0],fitness=[0,0,0,0];for(const u of game.units){const t=game.terrain(u.x,u.y);people[t]++;fitness[t]+=terrainFitness(u.g,t).fitness;}for(let i=0;i<game.tiles.length;i++){food[game.tiles[i]]+=(game.grass[i]||0)+(game.waterweed[i]||0);}for(const c of game.corpses)corpses[game.terrain(c.x,c.y)]++;
 $('habitats').innerHTML=TERRAIN_NAMES.map((name,i)=>`<div><span><span style="display:inline-block;width:11px;height:11px;background:${TERRAIN_COLORS[i]};margin-right:5px"></span>${name}</span><span>植物生産性 ${Math.round(TERRAIN_FERTILITY[i]*100)}% / 生命 ${people[i]} / 適応度平均 ${people[i]?(fitness[i]/people[i]).toFixed(2):'—'} / 資源 ${Math.round(food[i])} / 死体 ${corpses[i]}</span></div>`).join('');
 $('inspector').textContent=selected&&!selected.dead?`#${selected.id} ${game.species.get(selected.category)?.name}｜性別 ${selected.sex==='H'?'⚥ 雌雄同体':selected.sex==='F'?'♀ メス':'♂ オス'}｜繁殖方式 ${selected.g.repro===1?'雌雄同体':selected.g.repro===2?'単為生殖可能':'雌雄異体'}｜適温 ${selected.g.idealTemp.toFixed(1)}℃｜耐性 ±${selected.g.tempTolerance.toFixed(1)}℃｜現在気温 ${game.temperatureAt(selected.x,selected.y).toFixed(1)}℃｜温度適合 ${Math.round(thermalFitness(selected.g,game.temperatureAt(selected.x,selected.y)).comfort*100)}%｜体格 ×${(selected.growthScale??1).toFixed(2)}｜幅 ${(selected.g.r*(selected.growthScale??1)).toFixed(1)}｜長さ比 ${selected.g.elongation.toFixed(2)}｜目 ${selected.g.eyes}｜口 ${selected.g.mouths}｜顎 ${selected.g.jaw.toFixed(2)}｜水適応 ${selected.g.wet.toFixed(2)}｜乾燥適応 ${selected.g.dry.toFixed(2)}｜段階 ${selected.dormant?'休眠中':selected.stage==='juvenile'?'幼体':'成体'}${selected.stage==='juvenile'?`｜幼体成長 ${Math.round((selected.juvenileGrowth??0)*100)}%`:''}｜現在地 ${TERRAIN_NAMES[game.terrain(selected.x,selected.y)]}（適応度 ${terrainFitness(selected.g,game.terrain(selected.x,selected.y)).fitness.toFixed(2)}）｜水辺 ${selected.g.wet.toFixed(2)}・乾燥地 ${selected.g.dry.toFixed(2)}・岩場 ${selected.g.rock.toFixed(2)}｜移住 ${selected.migrations}｜水中視界 ${Math.round(terrainFitness(selected.g,1).sight*100)}%｜生息型 ${selected.g.aquatic===1?'水生':'陸生'}｜水分 ${Math.round(selected.hydration)}｜離水 ${selected.stranded}｜水没 ${selected.submerged}｜水進入 ${terrainFitness(selected.g,1).passable?'可能':'不可'}｜乾燥危険 ${terrainFitness(selected.g,2).hazard.toFixed(2)}｜休眠傾向 ${(selected.g.hibernate??0).toFixed(2)}｜感染 ${selected.infection>0?'あり':'なし'}｜同系統の近隣 ${selected.localCrowd??0}｜食性 ${dietProfile(selected.g).label} (${Math.round(dietProfile(selected.g).diet*100)}%肉食寄り)｜外見 ${dietProfile(selected.g).signal>.55?'肉食型':dietProfile(selected.g).signal<.45?'栄養食型':'中間型'}｜擬態 ${Math.abs(dietProfile(selected.g).diet-dietProfile(selected.g).signal)>.38?'あり':'なし'}｜警戒心 ${(selected.g.caution??.45).toFixed(2)}｜捕食者識別 ${(selected.g.predatorSense??.45).toFixed(2)}｜反撃性 ${(selected.g.retaliation??.35).toFixed(2)}｜省エネ特性 ${(selected.g.frugality??0).toFixed(2)}｜水草栽培 ${(selected.g.waterGardening??0).toFixed(2)}｜水草の繁殖体 ${(selected.waterSeedBank??0).toFixed(1)}｜陸上順化 ${(selected.landAcclimation??0).toFixed(2)}｜肉食順化 ${(selected.carnivoryExperience??0).toFixed(2)}｜現在の肉食能力 ${(selected.g.diet+(1-selected.g.diet)*(selected.carnivoryExperience??0)).toFixed(2)}｜行動 ${selected.behaviorTarget==='retaliate'?'反撃中':selected.fleeing?'逃走中':'通常'}｜一度に産む卵 ${selected.g.brood}｜体色 ${selected.g.albino===1?'白色変異':'地形適応に連動'}｜卵殻 ${selected.g.shell.toFixed(2)}｜保護 ${selected.g.guard.toFixed(2)}｜産卵場所 ${selected.g.nesting.toFixed(2)}｜生命力 ${Math.round(selected.hp)}/${selected.maxHp}｜長寿特性 ×${(selected.g.longevity??1).toFixed(2)}｜自然HP減少 ${lifeDrain(selected,{temperature:game.temperatureAt(selected.x,selected.y),terrain:game.terrain(selected.x,selected.y)}).toFixed(3)}/step｜老化 ${Math.round(vitality(selected).old*100)}%｜活力 ${Math.round(vitality(selected).vigor*100)}%｜エネルギー ${selected.energy.toFixed(1)}｜繁殖 ${selected.pregnancy?'産卵準備中 '+selected.pregnancy.remaining+'ステップ':selected.courtPartner?'求愛中 #'+selected.courtPartner:'通常'}｜両親 ${selected.parent===null?'始祖':'#'+selected.parent+' / #'+selected.otherParent}｜第${selected.generation}世代`:'観察モードで生命をクリック。';
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
function render(){
  view=fitView(view,WORLD.width,WORLD.height);
  ctx.save();ctx.setTransform(view.zoom,0,0,view.zoom,-view.x*view.zoom,-view.y*view.zoom);
  try{drawWorld(ctx,game,$('effects').checked,selected,{graphicsMode});}finally{ctx.restore();}
 }
function reset(){
 ecologyLog.end(ecologyLog.activeId===null?null:observeEcology(game));
 speciesLog.end(game);
 game.reset();session.reset();rewardRecorded=false;lastReproductionSample=null;selected=null;selectedSpecies=null;running=false;mode='spawn';document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));syncSliders();update();render();}
function updateTerrainLevelLabel(){
 $('terrainLevelName').textContent=TERRAIN_LEVEL_NAMES[Number(mode)]?.[terrainLevel-1]??'レベル '+terrainLevel;
}
function syncSliders(){$('waterweedGrowth').value=game.waterweedGrowth;$('waterweedGrowthValue').value=game.waterweedGrowth;$('growth').value=game.growth;$('growthValue').value=game.growth;$('stress').value=game.stress;$('stressValue').value=game.stress;$('rainfall').value=game.rainfall;$('rainfallValue').value=game.rainfall;$('temperature').value=game.baseTemperature;$('temperatureValue').value=game.baseTemperature+'℃';$('climateEnabled').checked=game.climateEnabled;}
// The foreground animation is display-rate limited. Simulation ticks have
// their own budget, so the renderer cannot monopolize the video decoder/GPU.
function stepSimulation(){
 if(playMode==='game'&&session.finished)return;
 game.step();observeGame();
 if(game.tick%50===0)recordStep();
}
function frame(time){
 rafId=null;
 if(document.hidden)return;
 const dt=last?Math.max(0,Math.min(100,time-last)):0;
 last=time;
 game.visualTick=(game.visualTick??0)+dt*.03;
 const policy=performancePolicy(game.units.length,$('lowImpactMode').checked);
 if(running){
  const batch=simulationBatch(acc,dt,policy,speed);
  acc=batch.carry;
  for(let i=0;i<batch.steps;i++)stepSimulation();
 }
 if(time-paintAt>=policy.paintInterval){
  const displayElapsed=paintAt?Math.min(100,time-paintAt):dt;
  for(const fx of game.effects)fx.age+=displayElapsed*.03;
  game.effects=game.effects.filter(fx=>fx.age<35);
  render();
  paintAt=time;
 }
 if(time-uiAt>=policy.uiInterval){update();uiAt=time;}
 rafId=requestAnimationFrame(frame);
}
// requestAnimationFrame is usually suspended in an inactive tab or while
// another tab is fullscreen. Use a low-frequency timer instead, without
// graphics work or an expensive backlog catch-up when visibility returns.
function backgroundStep(){
 backgroundTimer=null;
 if(!document.hidden)return;
 if(running)stepSimulation();
 backgroundTimer=setTimeout(backgroundStep,BROWSER_BACKGROUND_INTERVAL);
}
function syncVisibility(){
 if(document.hidden){
  if(rafId!==null){cancelAnimationFrame(rafId);rafId=null;}
  if(backgroundTimer!==null)clearTimeout(backgroundTimer);
  backgroundTimer=setTimeout(backgroundStep,BROWSER_BACKGROUND_INTERVAL);
 }else{
  if(backgroundTimer!==null){clearTimeout(backgroundTimer);backgroundTimer=null;}
  last=0;acc=0;paintAt=0;uiAt=0;
  if(rafId===null)rafId=requestAnimationFrame(frame);
 }
}
document.addEventListener('visibilitychange',syncVisibility);
function screenCoords(e){const b=canvas.getBoundingClientRect();return {x:(e.clientX-b.left)/b.width*canvas.width,y:(e.clientY-b.top)/b.height*canvas.height};}
function coords(e){const p=screenCoords(e);return screenToWorld(view,p.x,p.y,WORLD.width,WORLD.height);}
function updateZoomUI(){
 $('zoomStatus').textContent='表示 '+view.zoom.toFixed(view.zoom===1?0:1)+'倍';
 $('zoomOut').disabled=view.zoom<=1;
 $('zoomIn').disabled=view.zoom>=MAX_ZOOM;
 $('panView').classList.toggle('active',panEnabled);
 $('panView').setAttribute('aria-pressed',String(panEnabled));
 canvas.classList.toggle('panning',panEnabled);
}
function changeZoom(next,sx=canvas.width/2,sy=canvas.height/2){
 view=zoomAround(view,next,sx,sy,WORLD.width,WORLD.height);
 updateZoomUI();render();
}
$('zoomIn').onclick=()=>changeZoom(view.zoom*ZOOM_STEP);
$('zoomOut').onclick=()=>changeZoom(view.zoom/ZOOM_STEP);
$('zoomReset').onclick=()=>changeZoom(1);
$('panView').onclick=()=>{panEnabled=!panEnabled;updateZoomUI();};
canvas.addEventListener('wheel',e=>{
 e.preventDefault();const p=screenCoords(e);
 changeZoom(view.zoom*(e.deltaY<0?ZOOM_STEP:1/ZOOM_STEP),p.x,p.y);
},{passive:false});
updateZoomUI();
function interact(e){
 const {x,y}=coords(e);
 if(playMode==='game'){
  if(mode==='spawn'){
   if(!session.active&&!session.finished&&session.start(x,y)){
    if(ecologyLog.activeId===null)ecologyLog.start(game.initialSeed);
     if(speciesLog.activeId===null)speciesLog.start(game.initialSeed);
    lastReproductionSample=observeEcology(game);ecologyLog.record(lastReproductionSample,true);ecologyLog.recordIndividuals(game,true);speciesLog.record(game,true);
    running=true;mode='inspect';
    document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
   }
  }else if(mode==='food')session.intervene('seed',x,y);
  else if(mode==='fertilize')session.intervene('fertilize',x,y);
  else if(mode==='inspect'){selected=null;let best=500;for(const u of game.units){const d=(u.x-x)**2+(u.y-y)**2;if(d<best){best=d;selected=u;}}}
 }else{
  if(['0','1','2','3'].includes(mode))game.paint(x,y,Number(mode),brush,terrainLevel);
  else if(mode==='food'){game.paint(x,y,0,brush);game.log('info','プレイヤーが草を補充');}
  else if(mode==='fertilize')game.fertilize(x,y,brush);
  else if(mode==='spawn'){
   const n=Math.max(1,Math.min(6,Math.trunc(Number($('founderTypes').value)||1)));$('founderTypes').value=n;
   const result=game.introduce(x,y,n);
   if(result.individuals>0){
    if(ecologyLog.activeId===null)ecologyLog.start(game.initialSeed);
    if(speciesLog.activeId===null)speciesLog.start(game.initialSeed);
    lastReproductionSample=observeEcology(game);ecologyLog.record(lastReproductionSample,true);ecologyLog.recordIndividuals(game,true);speciesLog.record(game,true);running=true;
   }
  }else if(mode==='inspect'){selected=null;let best=500;for(const u of game.units){const d=(u.x-x)**2+(u.y-y)**2;if(d<best){best=d;selected=u;}}}
 }
 update();render();
}
canvas.addEventListener('pointerdown',e=>{
  // Pan mode and the middle mouse button move the camera, not the terrain.
  if(panEnabled||e.button===1){
   e.preventDefault();const p=screenCoords(e);
   panGesture={pointerId:e.pointerId,x:p.x,y:p.y};
   canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');return;
  }
  if(e.button!==0&&e.pointerType==='mouse')return;
  painting=true;canvas.setPointerCapture(e.pointerId);interact(e);
 });
 canvas.addEventListener('pointermove',e=>{
  if(panGesture&&e.pointerId===panGesture.pointerId){
   const p=screenCoords(e);
   view=panBy(view,p.x-panGesture.x,p.y-panGesture.y,WORLD.width,WORLD.height);
   panGesture.x=p.x;panGesture.y=p.y;render();return;
  }
  if(playMode==='lab'&&painting&&['0','1','2','3','fertilize'].includes(mode))interact(e);
 });
 function endPointer(e){if(panGesture?.pointerId===e.pointerId){panGesture=null;canvas.classList.remove('dragging');}painting=false;}
 canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
 canvas.addEventListener('lostpointercapture',endPointer);
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{if(b.disabled)return;mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));updateTerrainLevelLabel();}));
updateTerrainLevelLabel();
document.querySelectorAll('[data-event-type]').forEach(input=>{
 const type=input.dataset.eventType;
 input.checked=eventVisibility[type]!==false;
 input.addEventListener('change',()=>{eventVisibility[type]=input.checked;update();});
});
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
$('play').onclick=()=>{if(playMode==='game'&&session.finished)return;if(game.introducedCount===0){mode='spawn';document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));return;}running=!running;update();};$('stepOnce').onclick=()=>{if(game.introducedCount===0)return;running=false;game.step();observeGame();if(game.tick%50===0)recordStep();update();render();};$('speed').onclick=()=>{speed=speed===1?3:speed===3?8:1;$('speed').textContent='速度 ×'+speed;};$('reset').onclick=()=>reset();
$('ecologyRun').onchange=e=>{selectedLogRun=Number(e.target.value);update();};
$('downloadAllLogs').onclick=()=>{
 // Include the current step even if the 50-step sampling boundary is not due.
 // This creates one diagnostic snapshot, without changing the ecosystem.
 if(ecologyLog.activeId!==null){
  const sample=observeEcology(game);
  ecologyLog.record(sample,true);
  ecologyLog.recordIndividuals(game,true);
  speciesLog.record(game,true);
 }
 const archive=zipFiles([
  ['edenomaly-ecology-'+LOG_VERSION+'.csv',ecologyLog.toCSV()],
  ['edenomaly-individual-reproduction-'+LOG_VERSION+'.csv',ecologyLog.toIndividualCSV()],
  ['edenomaly-species-statistics-'+LOG_VERSION+'.csv',speciesLog.toCSV()]
 ]);
 const url=URL.createObjectURL(archive),link=document.createElement('a');
 link.href=url;link.download='edenomaly-all-logs-'+LOG_VERSION+'.zip';
 document.body.appendChild(link);link.click();link.remove();
 URL.revokeObjectURL(url);
};
$('clearEcologyLog').onclick=()=>{
 if(!window.confirm('このバージョンの生態系推移ログをすべて削除しますか？'))return;
 ecologyLog.clear();speciesLog.clear();selectedLogRun=null;logRunOptions='';
 if(game.introducedCount>0){ecologyLog.start(game.initialSeed);speciesLog.start(game.initialSeed);lastReproductionSample=observeEcology(game);ecologyLog.record(lastReproductionSample,true);ecologyLog.recordIndividuals(game,true);speciesLog.record(game,true);}
 update();
};
$('founderTypes').oninput=e=>{const n=Math.max(1,Math.min(6,Math.trunc(Number(e.target.value)||1)));$('founderPreview').textContent=n+'種類・'+(n*8)+'体';};
$('terrainLevel').oninput=e=>{terrainLevel=Number(e.target.value);$('terrainLevelValue').value=terrainLevel;updateTerrainLevelLabel();};
$('waterweedGrowth').oninput=e=>{game.waterweedGrowth=Number(e.target.value);$('waterweedGrowthValue').value=game.waterweedGrowth;};
$('brush').oninput=e=>{brush=Number(e.target.value);$('brushValue').value=brush;};$('growth').oninput=e=>{game.growth=Number(e.target.value);$('growthValue').value=game.growth;};$('stress').oninput=e=>{game.stress=Number(e.target.value);$('stressValue').value=game.stress;};$('rainfall').oninput=e=>{game.rainfall=Number(e.target.value);$('rainfallValue').value=game.rainfall;};$('climateEnabled').onchange=e=>{game.climateEnabled=e.target.checked;game.updateTemperature();update();};$('temperature').oninput=e=>{game.baseTemperature=Number(e.target.value);game.updateTemperature();$('temperatureValue').value=game.baseTemperature+'℃';update();};
$('drought').onclick=()=>{if(playMode==='game')return;game.drought();syncSliders();update();};
$('rain').onclick=()=>{if(playMode==='game')session.intervene('rain');else{game.rain();syncSliders();}update();};
$('epidemic').onclick=()=>{if(playMode==='game')return;game.epidemic();update();};
for(const [id,kind] of [['playModeLab','lab'],['playModeGame','game']])$(id).onclick=()=>{
 if(kind===playMode)return;
 playMode=kind;reset();
};
reset();syncVisibility();
