import {parseSpeciesCSV} from './species-statistics.js';
const $=id=>document.getElementById(id);
let rows=[],selected='',run='',species=[];
const fmt=n=>Number.isFinite(n)?new Intl.NumberFormat('ja-JP',{maximumFractionDigits:3}).format(n):'—';
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
const clear=el=>{el.replaceChildren();return el;};
const lookup=(r)=>r.category+' | '+r.species;
const key=r=>String(r.run);
function getRows(){return rows.filter(r=>key(r)===run);}
function filteredSpecies(){
 const q=$('search').value.trim().toLowerCase();
 return species.filter(s=>!q||(s.name+' '+s.category).toLowerCase().includes(q));
}
function formatRow(row,scaleMin,scaleMax){
 const el=node('div','row');
 const title=node('div','name',row.label||row.metric);
 title.title=row.metric;el.append(title);
 const bar=node('div','bar');
 const span=Math.max(1e-9,scaleMax-scaleMin);
 const p=n=>Math.max(0,Math.min(100,(n-scaleMin)/span*100));
 const range=node('div','range');range.style.left=p(row.min)+'%';range.style.width=Math.max(.4,p(row.max)-p(row.min))+'%';
 const median=node('div','median');median.style.left=p(row.median)+'%';
 bar.append(range,median);el.append(bar);
 const nums=node('div','number',fmt(row.min)+' / '+fmt(row.median)+' / '+fmt(row.max));
 nums.title='最小 / 中央値 / 最大（'+row.samples+'体）';el.append(nums);
 return el;
}
function summary(){
 const sample=getRows(),byKey=new Map();
 for(const r of sample)if(!byKey.has(r.category))byKey.set(r.category,{name:r.species,category:r.category,current:r.current,total:r.total,firstSeen:r.firstSeen});
 species=[...byKey.values()].sort((a,b)=>b.current-a.current||b.total-a.total||a.name.localeCompare(b.name,'ja'));
 const holder=clear($('totals'));
 for(const t of [species.length+' 種',species.reduce((n,s)=>n+s.current,0)+' 現存個体',
  species.reduce((n,s)=>n+s.total,0)+' 累計出生'])holder.append(node('span','chip',t));
 drawSpecies();drawDetails();drawComparison();
}
function drawSpecies(){
 const div=clear($('species'));let result=filteredSpecies();
 for(const sp of result){
  const b=node('button',sp.category===selected?'selected':'');
  b.type='button';b.append(node('strong','',sp.name),node('small','',sp.current+' 生存 / '+sp.total+' 累計'));
  b.title=sp.category;b.onclick=()=>{selected=sp.category;drawSpecies();drawDetails();};
  div.append(b);
 }
 if(!result.length)div.append(node('p','sub','該当する種族がありません。'));
}
const zeroToOneMetrics=new Set([
 'hibernate','wet','dry','rock','shell','guard','nesting','diet','deception',
 'resist','aquatic','albino','dispersal','sociability','caution','predatorSense',
 'retaliation','frugality','waterGardening','tailLength','hornLength',
 'antennaLength','pattern','edibleRatio','hpPercent'
]);
function metricDomain(scope,metric){
 if(zeroToOneMetrics.has(metric))return metric==='hpPercent'?[0,100]:[0,1];
 const comparable=getRows().filter(r=>r.scope===scope&&r.metric===metric);
 const min=Math.min(...comparable.map(r=>r.min));
 const max=Math.max(...comparable.map(r=>r.max));
 return [Math.min(0,min),Math.max(1e-9,max)];
}
function drawDetails(){
 const sp=species.find(s=>s.category===selected)||species[0];
 const info=$('selectedInfo'),target=clear($('details'));
 if(!sp){info.textContent='CSVを読み込んでください。';return;}
 selected=sp.category;
 info.textContent=sp.name+' ｜ '+sp.current+'体現存 / 累計'+sp.total+'体 ｜ 分類: '+sp.category;
 const scope=$('scope').value,q=$('metricSearch').value.trim().toLowerCase();
 const selectedRows=getRows().filter(r=>r.category===selected&&r.scope===scope&&
  (!q||String(r.label+' '+r.metric).toLowerCase().includes(q)));
 if(!selectedRows.length){target.append(node('p','sub',scope==='living'?'現存個体がいない、または該当する項目がありません。':'該当する項目がありません。'));return;}
 for(const r of selectedRows){
  const [min,max]=metricDomain(scope,r.metric);
  target.append(formatRow(r,min,max));
 }
}
function drawComparison(){
 const target=clear($('comparison'));
 const scope=$('compareScope').value,field=$('metric').value;
 const match=getRows().filter(r=>r.scope===scope&&r.metric===field);
 if(!match.length){target.append(node('p','sub','比較できる項目がありません。'));return;}
 const order=$('sort').value;
 match.sort((a,b)=>order==='name'?a.species.localeCompare(b.species,'ja'):
  b[order]-a[order]||a.species.localeCompare(b.species,'ja'));
 let min=Infinity,max=-Infinity;for(const r of match){min=Math.min(min,r.min);max=Math.max(max,r.max);}
 for(const r of match.slice(0,20)){
  const row={...r,label:r.species};
  target.append(formatRow(row,min,max));
 }
}
function populateMetrics(){
 const scope=$('compareScope').value,prev=$('metric').value;
 const options=new Map();
 for(const row of getRows())if(row.scope===scope&&!options.has(row.metric))
  options.set(row.metric,row.label||row.metric);
 const sel=clear($('metric'));
 for(const [id,label] of options){const opt=node('option','',label);opt.value=id;sel.append(opt);}
 if(options.has(prev))sel.value=prev;
 else if(options.has('geneticMass'))sel.value='geneticMass';
}
function loadRows(parsed,sourceLabel){
 if(!parsed.length)throw new Error('有効なデータがありません');
 if(parsed.some(r=>!r.category||!r.species||!r.metric||!Number.isFinite(r.median)||
  !Number.isFinite(r.min)||!Number.isFinite(r.max)))throw new Error('行の数値または名前が不正です');
 rows=parsed;
 const runs=[...new Set(rows.map(r=>key(r)))];
 const box=clear($('run'));
 for(const value of runs){const item=node('option','','試行 #'+value);item.value=value;box.append(item);}
 box.disabled=false;$('search').disabled=false;$('metric').disabled=false;
 run=runs.at(-1);box.value=run;selected='';
 $('status').textContent=sourceLabel+' ｜ '+rows.length.toLocaleString()+'項目';
 populateMetrics();summary();
}
const embedded=new URLSearchParams(window.location.search).has('embedded');
if(embedded){
 document.documentElement.classList.add('embedded');
 $('uploadPanel').hidden=true;
 $('standaloneIntro').hidden=true;
 window.addEventListener('message',event=>{
  if(event.source!==window.parent||event.origin!==window.location.origin)return;
  if(event.data?.type!=='edenomaly:species-report')return;
  try{
   loadRows(event.data.rows,'ゲーム内の最新スナップショット / Step '+event.data.step);
   $('snapshotStatus').textContent='Step '+event.data.step+' ｜ 生まれた全種族（絶滅種を含む）';
  }catch(error){$('status').textContent='集計エラー: '+error.message;}
 });
 window.parent.postMessage({type:'edenomaly:species-report-ready'},window.location.origin);
}
$('file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>50*1024*1024)throw new Error('50MB以上のCSVは読み込めません。');
  const parsed=parseSpeciesCSV(await file.text());
  loadRows(parsed,file.name+' を読み込みました');
 }catch(err){rows=[];species=[];clear($('species'));clear($('details'));clear($('comparison'));
  $('status').textContent='読み込みエラー: '+err.message;}
});
$('run').addEventListener('change',e=>{run=e.target.value;selected='';populateMetrics();summary();});
$('search').addEventListener('input',drawSpecies);
$('scope').addEventListener('change',drawDetails);
$('metricSearch').addEventListener('input',drawDetails);
$('compareScope').addEventListener('change',()=>{populateMetrics();drawComparison();});
$('metric').addEventListener('change',drawComparison);
$('sort').addEventListener('change',drawComparison);
