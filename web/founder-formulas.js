// Exact, reviewable gene / basic-stat mapping for the initial founder editor.
// This is intentionally not imported into in-game displays.
import {BASIC_STAT_GROUPS,BASIC_STAT_BOUNDS} from './basic-stat-score.js';
import {FOUNDER_FIELDS} from './founder-designer.js';

export const FOUNDER_DERIVED_FORMULAS=Object.freeze([
 ['基本体格 r','3 + 12 × (0.45×diet + 0.30×yolkReserve + 0.25×guard)^2.7','手動で体格を指定した場合は自動式より優先'],
 ['体の長さ elongation','0.85 + 2.15 × (0.55×dispersal + 0.30×wet + 0.15×aquatic)^2.4','手動で指定した場合は自動式より優先'],
 ['目 eyes','round(6 × (0.70×predatorSense + 0.30×caution))','手動で指定した場合は自動式より優先'],
 ['口 mouths','1 + round(3 × (0.65×diet + 0.35×parentFeeding))','手動で指定した場合は自動式より優先'],
 ['顎 jaw','0.2 + 2.3 × (0.65×diet + 0.35×retaliation)','手動で指定した場合は自動式より優先'],
 ['遺伝的な幅 width','r × bodySizeMultiplier(g)','成長前の形状'],
 ['遺伝的な全長 length','width × elongation','成長前の形状'],
 ['体重 bodyMass','width² × elongation','基礎形状'],
 ['最大HP','max(25, round(bodyMass × 0.48 + 25))','成体の最大HP'],
 ['視野 eyeRange','20 + min(eyes,3)×14 + max(eyes−3,0)×7 + 24×antennaFunctional','antennaFunctional は機能上の触角表現'],
 ['移動速度 speed','[3.45/(0.65 + r²×elongation×0.017)] × [0.55+0.45×bodySizeMultiplier/1.7] × [1−max(eyes−3,0)×0.055] × [1−0.07×hornFunctional−0.035×antennaFunctional] × [0.80+0.40×dispersal]','地形・成長段階でさらに変化'],
 ['旋回 turnRate','clamp(0.29/(0.75+elongation×0.21),0.12,0.29)','体型によって変化'],
 ['攻撃範囲 biteReach','width × (0.70+0.15×mouths) + jaw×1.6 + 1.2×hornFunctional','機能上の角の表現を使用'],
 ['捕食可能体格比 edibleRatio','clamp(0.60+mouths×0.055+jaw×0.06,0.62,0.88)','上限あり'],
 ['摂食効率 foodGain','1+min(0.42,(mouths−1)×0.13)','口の数で変化'],
 ['基礎代謝 upkeep','0.09 + r²×elongation×0.008 + max(r²×elongation−110,0)^1.2×0.002 + eyes×0.045 + max(eyes−3,0)²×0.06 + mouths×0.03 + jaw×0.02 + |deception−0.5|×0.035 + resist×0.04 + tailFunctional×0.13 + hornFunctional×0.18 + antennaFunctional×0.12 + patternFunctional×0.075 + dispersal×0.06','体格・装飾の機能要素・すばやさに負担']
]);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mapping=new Map(BASIC_STAT_GROUPS.flatMap(stat=>stat.genes.map(gene=>[gene,stat])));
export const formulaMappingRows=()=>FOUNDER_FIELDS.map(([key,label,lo,hi,step])=>{
 const stat=mapping.get(key);
 return {key,label,stat:stat?.name??'独立設定',min:lo,max:hi,step,
  formula:stat?`B=${stat.name}; Δ=目標B−現在B; L' = clamp(L+Δ,1,10); 値'=round_step(${lo}+(L'−1)×(${hi}−${lo})/9,${step})`:
   '基本ステータス6値だけからは決定不可。独立遺伝子・戦略として個別設定（形態5項目は未固定時のみ自動算出）'};
});
export function founderFormulaHTML(){
 const formula=BASIC_STAT_GROUPS.map(stat=>
  '<tr><th>'+esc(stat.icon+' '+stat.name)+'</th><td><code>B = clamp(round(('+stat.genes.map(key=>'L('+key+')').join(' + ')+')/'+stat.genes.length+'),1,10)</code></td><td>'+esc(stat.genes.join(', '))+'</td></tr>').join('');
 const genes=formulaMappingRows().map(row=>'<tr><th>'+esc(row.label)+' <small>('+esc(row.key)+')</small></th><td>'+esc(row.stat)+'</td><td><code>'+esc(row.formula)+'</code></td></tr>').join('');
 const physical=FOUNDER_DERIVED_FORMULAS.map(([name,formula,detail])=>
  '<tr><th>'+esc(name)+'</th><td><code>'+esc(formula)+'</code></td><td>'+esc(detail)+'</td></tr>').join('');
 return '<details id="founderFormulaReference" class="founder-formula-reference"><summary>📐 全37遺伝子と基本ステータスの変換式・派生能力一覧</summary>'+
 '<p>現在の実装では、6つの基本値は37遺伝子の集約値であり、すべての遺伝子を基本値だけから一意に復元することはできません。基本値を編集すると対応する遺伝子のレベルを相対的に上下させます。食性・水生／陸生・繁殖方式などは独立設定です。</p>'+
 '<p>記号：L(x)=遺伝子xの1〜10段階、B=その基本ステータス、round=四捨五入、round_step(x,s)=s単位に丸める、clamp=上下限で制限。レベルは L(x)=clamp(round((x−最小)/(最大−最小)×9)+1,1,10)。</p>'+
 '<h4>① 基本ステータスの算出式</h4><div class="founder-formula-scroll"><table><thead><tr><th>基本ステータス</th><th>算出式</th><th>関連遺伝子</th></tr></thead><tbody>'+formula+'</tbody></table></div>'+
 '<h4>② 全37遺伝子の調整・変換規則</h4><div class="founder-formula-scroll"><table><thead><tr><th>応用パラメータ</th><th>関連</th><th>変換式・独立設定</th></tr></thead><tbody>'+genes+'</tbody></table></div>'+
 '<h4>③ 体格・戦闘などの派生能力計算</h4><div class="founder-formula-scroll"><table><thead><tr><th>派生能力</th><th>計算式</th><th>補足</th></tr></thead><tbody>'+physical+'</tbody></table></div>'+
 '<p>スキルの発動はこれらの値に加えて地形・相手・空腹などの条件を持ちます。実際の計算は simulation.js のゲームロジックが優先です。</p></details>';
}
