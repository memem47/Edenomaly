// Reproducible multi-seed balance check. Writes a versioned Markdown report.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {runHeadless} from './headless-runner.mjs';
import {runGameLocation} from './location-experiment.mjs';
import {Ecosystem} from './simulation.js';
const VERSION=JSON.parse(await readFile(new URL('./version.json',import.meta.url),'utf8')).version;
const scenario=[
 {id:'natural',label:'自然状態',growth:70,rainfall:25,stress:15},
 {id:'rich',label:'食料・降雨増加',growth:95,rainfall:75,stress:7},
 {id:'poor',label:'資源不足',growth:40,rainfall:10,stress:40}
];
const seeds=[72,73,74,75];
const trials=[];
const num=(v)=>Number(v.toFixed(1));
const mean=(a,k)=>a.length?num(a.reduce((n,x)=>n+x[k],0)/a.length):0;
for(const c of scenario)for(const seed of seeds){
 const result=runHeadless({seed,steps:2000,interval:100,founders:1,
  growth:c.growth,rainfall:c.rainfall,stress:c.stress,version:VERSION});
 const last=result.rows.at(-1),rows=result.rows;
 const names=[...result.world.species.values()].map(s=>({name:s.name,total:s.total})).sort((a,b)=>b.total-a.total);
 trials.push({scenario:c.id,seed,steps:result.summary.simulatedSteps,peak:result.summary.peakPopulation,
 final:result.summary.finalPopulation,eggs:result.summary.finalEggs,extinct:result.summary.stoppedByExtinction?1:0,
 species:last.livingSpecies,discovered:last.discoveredSpecies,gen:last.maxGeneration,
 starvation:last.deathStarvation,births:last.births,matings:last.matings,
 geneticMass:last.adultGeneticMassMean,growthScale:last.adultGrowthMean,largeGrowth:last.adultGrowthOver235,
 actualMass:last.adultActualMassMean,highEnergy:last.adultHighEnergyCount,
 p90Radius:last.p90Radius,
 meanPopulation:mean(rows,'population'),meanGrass:mean(rows,'grass'),
 peakGrowth:Math.max(...rows.map(x=>x.adultGrowthMean)),
 names:names.slice(0,4)});
 console.log('TRIAL '+JSON.stringify(trials.at(-1)));
}
const sites=[
 {id:'open_grass',terrain:0,center:[120,90],constraint:'no_water'},
 {id:'shore_grass',terrain:0,center:[220,220],constraint:'near_water'},
 {id:'deep_pond',terrain:1,center:[200,200],constraint:'interior'},
 {id:'pond_edge',terrain:1,center:[220,200],constraint:'edge'},
 {id:'dry_core',terrain:2,center:[610,110],constraint:'interior'},
 {id:'rock_core',terrain:3,center:[435,345],constraint:'interior'}];
const locations=[];
for(const policy of ['none','resource'])for(const seed of [72,73,74])for(const site of sites){
 const {summary}=runGameLocation({seed,site,steps:1200,interval:200,policy});
 locations.push(summary);
 console.log('LOCATION '+JSON.stringify({seed,site:site.id,policy,extinct:summary.extinct,final:summary.finalPopulation,score:summary.score}));
}
const averages=scenario.map(c=>{
 const arr=trials.filter(t=>t.scenario===c.id);
 return {label:c.label,count:arr.length,extinctions:arr.filter(t=>t.extinct).length,
  peak:mean(arr,'peak'),final:mean(arr,'final'),species:mean(arr,'species'),
  gen:mean(arr,'gen'),starvation:mean(arr,'starvation'),scale:mean(arr,'growthScale'),
  geneticMass:mean(arr,'geneticMass'),actualMass:mean(arr,'actualMass'),
  big:mean(arr,'largeGrowth'),highEnergy:mean(arr,'highEnergy'),
  matings:mean(arr,'matings')};
});
const locationsAgg=sites.flatMap(site=>['none','resource'].map(policy=>{
 const arr=locations.filter(x=>x.site===site.id&&x.policy===policy);
 return {site:site.id,policy,n:arr.length,extinct:arr.filter(x=>x.extinct).length,
  pop:mean(arr,'finalPopulation'),peak:mean(arr,'peak'),
  score:mean(arr,'score'),generation:mean(arr,'maxGeneration'),starvation:mean(arr,'deathStarvation')};
}));
const table=(headers,rows)=>'| '+headers.join(' | ')+' |\n| '+headers.map(()=>'---').join(' | ')+' |\n'+rows.map(row=>'| '+row.join(' | ')+' |').join('\n');
const verdicts=[];
const natural=averages[0],rich=averages[1],poor=averages[2];
if(natural.extinctions)verdicts.push('自然条件でも絶滅試行がある（初期集団の定着不安定）');
if(poor.extinctions>natural.extinctions)verdicts.push('資源制約で絶滅リスクが上昇');
if(rich.peak>natural.peak*1.5)verdicts.push('資源条件次第で過剰な個体数増加が起こる');
if(rich.scale>natural.scale+.2)verdicts.push('栄養による後天的巨大化が強くなる');
if(natural.scale>1.4)verdicts.push('自然条件でも後天的な巨大化が進む');
if(averages.some(x=>x.starvation>0))verdicts.push('餓死が生態系バランスを左右する');
const dry=locationsAgg.filter(x=>x.site==='dry_core'&&x.policy==='none');
const grass=locationsAgg.filter(x=>x.site==='open_grass'&&x.policy==='none');
if(dry[0]&&grass[0]&&dry[0].pop<grass[0].pop*.5)verdicts.push('乾燥地での初期定着が草地より厳しい');
const pond=locationsAgg.filter(x=>x.site==='deep_pond'&&x.policy==='none');
if(pond[0]&&pond[0].extinct>=2)verdicts.push('水中移入後の定着に課題');
const uniqueNames=new Set(trials.flatMap(t=>t.names.map(n=>n.name)));
const problems=verdicts.length?verdicts:['この試行範囲では上記の自動判定閾値に該当しない。長期試行が必要'];
const md=[
 '# Edenomaly 現状課題の実測レポート',
 '',
 '- Version: '+VERSION,
 '- 試験方法: 描画なしの実際のEcosystem.step()/GameSession、固定seedで再現可能',
 '- 自然・資源豊富・資源不足 各4seed×2,000step（計12試行）',
 '- 初期移入地点6種類×介入なし/資源介入あり×3seed×1,200step（計36試行）',
 '- **制約**: 数千stepの短中期試験。長期の定着や10万step規模の淘汰は未検証。',
 '',
 '## 環境条件比較',
 '',
 table(['条件','絶滅/4','最大個体数平均','最終個体数平均','現存種数平均','世代平均','成体成長倍率','遺伝的体格','後天込み体格','成長2.35倍超','餓死累計平均'],averages.map(x=>[
 x.label,x.extinctions+'/4',x.peak,x.final,x.species,x.gen,x.scale,x.geneticMass,x.actualMass,x.big,x.starvation])),
 '',
 '## 位置別ゲームモード',
 '',
 table(['地点','介入','絶滅/3','最終個体数平均','最大個体数平均','スコア平均','到達世代平均'],locationsAgg.map(x=>[
 x.site,x.policy==='none'?'なし':'資源',x.extinct+'/3',x.pop,x.peak,x.score,x.generation])),
 '',
 '## 自動検出した課題候補',
 '',
 ...problems.map(x=>'- '+x),
 '',
 '## 実際に多かった名前（各試行上位4種の例）',
 '',
 ...trials.filter(t=>t.scenario==='natural').map(t=>'- Seed '+t.seed+': '+t.names.map(n=>n.name+' ('+n.total+'個体累計)').join('、')),
 '',
 '## 個別試行（自然・豊富・不足）',
 '',
 table(['条件','seed','steps','peak','final','eggs','discovered','gen','growth','geneticMass','actualMass','starvations'],trials.map(x=>[
 x.scenario,x.seed,x.steps,x.peak,x.final,x.eggs,x.discovered,x.gen,x.growthScale,x.geneticMass,x.actualMass,x.starvation])),
 '',
 '## 分析上の注意',
 '',
 '- 種名の先頭8文字は短い生態コードのため、語感はなお単調になり得る。',
 '- 成体成長倍率が上がっても、遺伝的体格と同一視しない。',
 '- 絶滅とは成体・卵ともにゼロとなり早期終了した場合（ゲームモードは終了判定による）。',
 '- 報告値は試行ごとの単純平均。異なるシードの統計的有意差は主張しない。',
 '',
].join('\n');
await mkdir('reports',{recursive:true});
await writeFile('reports/current-issues-trial.md',md,'utf8');
await writeFile('reports/current-issues-trial.json',JSON.stringify({version:VERSION,trials,averages,locations,locationsAgg,problems,uniqueNames:uniqueNames.size},null,2)+'\n','utf8');
console.log('Wrote reports/current-issues-trial.md');
