// Explains exactly why a discovered species differs from its recorded parents.
// The category is the canonical classification used by Ecosystem.category().
import {CORE_KEYS,SKILLS,STRATEGY_FIELDS,INHERITANCE_RULES} from './genome-model.js';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const CATEGORY_LABELS=['生息環境','食性分類','体格','体形','目の配置','行動戦略','繁殖方式','温度適性','色系統','体色','外見特徴'];
const categories=key=>String(key||'').split('-');
const CATEGORY_VALUES=[
 {land:'陸上',aquatic:'水生',dry:'乾燥地',rock:'岩場'},
 {plant:'草食',mixed:'雑食',hunter:'肉食'},
 {tiny:'小型',medium:'中型',large:'大型',giant:'巨大'},
 {round:'丸型',oval:'楕円型',long:'長型'},
 {blind:'目なし',few:'少数',several:'複数',allround:'全周'},
 {general:'一般',guardian:'守護', 'egg-hunter':'卵捕食'},
 {repro0:'雌雄異体',repro1:'雌雄同体',repro2:'単為生殖'},
 {temperate:'温暖',cold:'低温',hot:'高温'},
 {red:'赤系',yellow:'黄系',green:'緑系',blue:'青系',purple:'紫系',white:'白系'}
];
const describeCategory=(value,index)=>{
 if(value===undefined)return '—';
 if(index===9)return '体色コード '+value.replace(/^c_/,'');
 if(index===10)return '特徴コード '+value.replace(/^f_/,'');
 return CATEGORY_VALUES[index]?.[value]??value;
};

const close=(a,b)=>Math.abs(Number(a)-Number(b))<1e-6;
const display=n=>typeof n==='number'&&!Number.isInteger(n)?n.toFixed(2):String(n);
const pairText=(g,key)=>{
 const p=g?.alleles?.[key]??(g?.dna&&key in g.dna?[g.dna[key],g.dna[key]]:null);
 return p?p.map(display).join('/'):'不明';
};
export function discoveryDifferences(child,parents=[],categoryOf){
 const entries=parents.filter(p=>p?.genome);
 const ownCategory=categoryOf(child),parts=categories(ownCategory);
 const parentsCategories=entries.map(p=>categoryOf(p.genome));
 const classification=CATEGORY_LABELS.map((label,i)=>({
  label,index:i,value:parts[i],parentValues:parentsCategories.map(k=>categories(k)[i]),
  changed:parentsCategories.some(k=>categories(k)[i]!==parts[i])
 }));
 const loci=[...CORE_KEYS.map(key=>({key,label:({power:'ちから',agility:'すばやさ',stamina:'たいりょく',intellect:'かしこさ',adaptation:'てきおう',fertility:'はんしょく'})[key],section:'基本能力'})),
  ...SKILLS.map(({key,label})=>({key,label,section:'スキル'})),
  ...STRATEGY_FIELDS.map(({key,label})=>({key,label,section:'生存戦略'}))];
 const genes=loci.map(({key,label,section})=>{
  const value=child?.dna?.[key],values=entries.map(p=>p.genome?.dna?.[key]);
  const pair=pairText(child,key),parentPairs=entries.map(p=>pairText(p.genome,key));
  return {key,label,section,value,values,pair,parentPairs,
   expressedChange:values.some(v=>v!==undefined&&!close(value,v)),
   genotypeChange:parentPairs.some(p=>p!==pair),
   carrier:INHERITANCE_RULES[key]==='recessive'&&
     Array.isArray(child?.alleles?.[key])&&
     child.alleles[key].some(v=>Number(v)>=1)&&child.alleles[key].some(v=>Number(v)<1)};
 });
 return {ownCategory,parentsCategories,classification,genes,classificationChanged:classification.filter(x=>x.changed)};
}
export function discoveryDifferenceHTML(child,parents,categoryOf){
 if(!parents?.length)return '<p class="muted">親のゲノム記録がありません。</p>';
 const d=discoveryDifferences(child,parents,categoryOf),count=parents.length;
 const table=(header,rows)=>'<div class="discovery-table-wrap"><table class="discovery-table"><thead><tr><th>'+header+'</th><th>新種</th>'+
  parents.map((_,i)=>'<th>親'+(i+1)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
 const categoryRow=r=>'<tr><th>'+esc(r.label)+'</th><td><strong>'+esc(describeCategory(r.value,r.index))+'</strong></td>'+
  r.parentValues.map(v=>'<td class="'+(v!==r.value?'discovery-changed':'')+'">'+esc(describeCategory(v,r.index))+(v!==r.value?' ✦':'')+'</td>').join('')+'</tr>';
 const displayGene=(r,i)=>{
  const n=i===-1?r.value:r.values[i],p=i===-1?r.pair:r.parentPairs[i];
  const active=r.section==='スキル'?(Number(n)===1?'習得':'未習得'):display(n);
  return esc(active)+' <small class="discovery-gene-pair">['+esc(p)+']</small>';
 };
 const geneRow=r=>'<tr><th>'+esc(r.label)+(r.carrier?' <small class="discovery-carrier">潜在保因</small>':'')+'</th><td><strong>'+displayGene(r,-1)+'</strong></td>'+
  parents.map((_,i)=>'<td class="'+(r.values[i]!==undefined&&!close(r.value,r.values[i])?'discovery-changed':'')+'">'+displayGene(r,i)+'</td>').join('')+'</tr>';
 const categoriesChanged=d.classificationChanged;
 const changedGenes=d.genes.filter(g=>g.expressedChange);
 const hiddenGenes=d.genes.filter(g=>!g.expressedChange&&g.genotypeChange);
 const reasons=categoriesChanged.length?
  '<p class="discovery-reason">新種判定に使われた分類の違い：<strong>'+categoriesChanged.map(x=>esc(x.label)).join('・')+'</strong></p>'+table('分類項目',categoriesChanged.map(categoryRow)):
  '<p class="discovery-reason">親との分類差はありません。新種登録時の親記録と判定条件を確認してください。</p>';
 const geneInfo='<h3>遺伝子・スキル・生存戦略の変化</h3>'+
  '<p class="muted">発現値と [対立遺伝子2コピー] を表示します。基本ステータスが同じでも、スキルや生存戦略、隠れた遺伝子は異なる場合があります。分類差が新種判定の直接の理由であり、遺伝子差は必ずしも分類変更を意味しません。</p>'+
  (changedGenes.length?table('発現が変わった遺伝子',changedGenes.map(geneRow)):'<p>発現した27遺伝子に親との差はありません。</p>')+
  '<details><summary>発現せずに変化した対立遺伝子（'+hiddenGenes.length+'件）</summary>'+
   (hiddenGenes.length?table('潜在的な変化',hiddenGenes.map(geneRow)):'<p>差はありません。</p>')+'</details>'+
  '<details><summary>全27遺伝子の比較</summary>'+table('遺伝子',d.genes.map(geneRow))+'</details>'+
  '<details><summary>変化のない分類項目</summary>'+table('分類項目',d.classification.filter(x=>!x.changed).map(categoryRow))+'</details>';
 return '<section class="discovery-cause"><h3>なぜ新種になった？</h3>'+reasons+'</section>'+geneInfo;
}
