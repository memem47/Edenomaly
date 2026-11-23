// Founder-only reference for the canonical inherited model.
// Six core stats + six binary skills + seven independent strategies = 19 loci.
// The old 37 ecology and morphology properties are derived, never inherited.
import {CORE_KEYS,SKILLS,STRATEGY_FIELDS,DNA_KEYS} from './genome-model.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const GENOME_DERIVATION_FORMULAS=Object.freeze([
 ['diet','食性','diet = strategy.diet'],
 ['aquatic','水生','aquatic = strategy.aquatic'],
 ['repro','繁殖方式','repro = strategy.repro'],
 ['albino','白化','albino = strategy.albino'],
 ['idealTemp','好適温度','−5 + 45×thermal'],
 ['tempTolerance','温度耐性','3 + 15×staminaN'],
 ['wet','水辺適応','clamp(0.18 + 0.50×adaptationN + (biome=水辺 ? 0.53 : 0))'],
 ['dry','乾燥適応','clamp(0.16 + 0.55×adaptationN + (biome=乾燥 ? 0.57 : 0))'],
 ['rock','岩場適応','clamp(0.16 + 0.53×adaptationN + (biome=岩場 ? 0.57 : 0))'],
 ['guard','防衛','clamp((0.10 + 0.79×powerN) × (1−0.65×diet))'],
 ['retaliation','反撃','反撃スキル ? clamp(0.35 + 0.60×powerN) : 0'],
 ['resist','感染抵抗','clamp(0.09 + 0.87×staminaN)'],
 ['frugality','省エネ','clamp(0.12 + 0.82×staminaN)'],
 ['longevity','体内光沢','0.6 + 1.4×staminaN'],
 ['hibernate','休眠傾向','休眠スキル ? clamp(0.28 + 0.72×adaptationN) : 0'],
 ['waterGardening','水草栽培','水草栽培スキル ? clamp(0.35 + 0.65×adaptationN) : 0'],
 ['shell','卵殻','clamp(0.08 + 0.84×fertilityN)'],
 ['nesting','巣づくり','clamp(0.14 + 0.57×fertilityN + 0.20×intellectN)'],
 ['nestChoice','産卵地選択','産卵地選択スキル ? clamp(0.20 + 0.75×intellectN) : 0'],
 ['parentFeeding','親の給餌','親の給餌スキル ? clamp(0.20 + 0.74×fertilityN) : 0'],
 ['yolkReserve','卵黄栄養','clamp(0.08 + 0.79×fertilityN)'],
 ['brood','産卵数','round(1 + 7×fertilityN) [1..8]'],
 ['juvenileCannibalism','幼体共食い','共食いスキル ? clamp(0.30 + 0.60×diet) : 0'],
 ['dispersal','分散','clamp(0.09 + 0.86×agilityN)'],
 ['sociability','集合','social'],
 ['caution','警戒','clamp(0.12 + 0.78×intellectN)'],
 ['predatorSense','捕食者感知','clamp(0.12 + 0.79×intellectN)'],
 ['deception','擬態','clamp(0.12 + 0.42×intellectN + 0.20×(1−powerN))'],
 ['tailLength','しっぽ','clamp(0.13 + 0.56×wet + 0.18×agilityN)'],
 ['hornLength','角','clamp(0.08 + 0.56×powerN + 0.27×retaliation)'],
 ['antennaLength','触角','clamp(0.07 + 0.67×intellectN + 0.20×agilityN)'],
 ['pattern','模様','clamp(0.10 + 0.39×intellectN + 0.28×staminaN)'],
 ['r','体格','3 + 12×(0.38×diet + 0.32×fertilityN + 0.30×powerN)^2.7'],
 ['elongation','体の長さ','0.85 + 2.15×(0.60×agilityN + 0.25×wet + 0.15×aquatic)^2.4'],
 ['eyes','目の数','round(6×(0.70×intellectN + 0.30×agilityN))'],
 ['mouths','口の数','1 + round(3×(0.64×diet + 0.36×fertilityN))'],
 ['jaw','顎','0.20 + 2.30×(0.63×diet + 0.37×powerN)']
]);
export const FOUNDER_DERIVED_FORMULAS=Object.freeze([
 ['体重 bodyMass','[r×bodySizeMultiplier(g)]²×elongation','基本体型'],
 ['最大HP','max(25, round(bodyMass×0.48+25))','体格に応じた上限'],
 ['移動速度','3.45/(0.65+r²×elongation×0.017) × 体格係数 × 眼数係数 × 飾り負荷 × (0.80+0.40×dispersal)','体格・地形で変化'],
 ['視野','20 + min(eyes,3)×14 + max(eyes−3,0)×7 + 24×機能触角','機能と形態の合成'],
 ['基礎代謝','0.09 + 体重×0.008 + 大型負担 + 目・口・顎・飾り・分散の負担','全式は simulation.js の morphology 参照']
]);
export const formulaMappingRows=()=>GENOME_DERIVATION_FORMULAS.map(([key,label,formula])=>({key,label,formula}));
export function founderFormulaHTML(){
 const table=(head,rows)=>'<div class="founder-formula-scroll"><table><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
 rows.map(row=>'<tr>'+row.map((cell,i)=>'<'+(i?'td':'th')+'>'+esc(cell)+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('')+'</tbody></table></div>';
 return '<details id="founderFormulaReference" class="founder-formula-reference"><summary>📐 19遺伝子から37応用パラメータへの変換式</summary>'+
 '<p>遺伝子 = 基本ステータス6項目＋保有スキル6項目＋生存戦略7項目。応用パラメータ37項目は独立して遺伝しません。各基本値 x の正規化 xN=(x−1)/9。clamp は0〜1に制限。値は子孫の遺伝子から毎回再計算します。</p>'+
 '<h4>① 遺伝子本体（19項目）</h4>'+
 table(['種類','遺伝子'],[
  ['基本ステータス（各1〜10）',CORE_KEYS.join('、')],
  ['スキル（各0/1）',SKILLS.map(s=>s.key).join('、')],
  ['戦略',STRATEGY_FIELDS.map(s=>s.key).join('、')]
 ])+
 '<h4>② 全37応用パラメータの算出式</h4>'+table(['応用値','変換式'],GENOME_DERIVATION_FORMULAS.map(([,label,formula])=>[label,formula]))+
 '<h4>③ 物理量・行動の計算</h4>'+table(['派生量','式','備考'],FOUNDER_DERIVED_FORMULAS)+
 '<p>スキルはDNAとして継承されますが、発動には空腹・地形・相手などの追加条件が必要です。細かな端数や例外処理は genome-model.js / simulation.js が正です。</p></details>';
}
