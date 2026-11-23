// Founder-only reference for the canonical inherited model.
// Six core stats + nine binary skills + seven strategies = 22 inherited loci.
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
 ['wet','水辺適応','clamp(0.22 + (biome=水辺 ? 0.70 : 0))'],
 ['dry','乾燥適応','clamp(0.22 + (biome=乾燥 ? 0.72 : 0))'],
 ['rock','岩場適応','clamp(0.22 + (biome=岩場 ? 0.72 : 0))'],
 ['guard','防衛','clamp((0.10 + 0.79×powerN) × (1−0.65×diet))'],
 ['retaliation','反撃','反撃スキル ? clamp(0.35 + 0.60×powerN) : 0'],
 ['resist','感染抵抗','clamp(0.09 + 0.87×staminaN)'],
 ['frugality','省エネ','clamp(0.12 + 0.82×staminaN)'],
 ['longevity','体内光沢','0.6 + 1.2×fertilityN + 0.2×自己再生スキル + 0.11×吸収スキル'],
 ['hibernate','休眠傾向','休眠スキル ? clamp(0.28 + 0.72×adaptationN) : 0'],
 ['waterGardening','水草栽培','水草栽培スキル ? clamp(0.35 + 0.65×adaptationN) : 0'],
 ['shell','卵殻','clamp(0.08 + 0.84×fertilityN)'],
 ['nesting','巣づくり','clamp(0.14 + 0.57×fertilityN + 0.20×intellectN) × (巣作りスキル ? 1 : 0.45)'],
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
 ['tailLength','しっぽ','clamp(0.13 + 0.56×wet + 0.18×agilityN + 0.12×瞬発ダッシュスキル + 0.09×分裂スキル)'],
 ['hornLength','角','clamp(0.08 + 0.56×powerN + 0.27×retaliation + 0.12×奇襲スキル + 0.08×捕食スキル)'],
 ['antennaLength','触角','clamp(0.07 + 0.67×intellectN + 0.20×agilityN + 0.10×自己再生スキル + 0.06×協力スキル)'],
 ['pattern','模様','clamp(0.08 + 0.79×adaptationN)'],
 ['r','体格','3 + 12×(0.27×diet + 0.24×fertilityN + 0.24×powerN + 0.25×staminaN)^2.7'],
 ['elongation','体の長さ','0.85 + 2.15×(0.42×agilityN + 0.24×staminaN + 0.19×wet + 0.15×aquatic)^2.4'],
 ['eyes','目の数','round(6×(0.70×intellectN + 0.30×agilityN))'],
 ['mouths','口の数','1 + round(3×(0.47×diet + 0.29×staminaN + 0.24×fertilityN))'],
 ['jaw','顎','0.20 + 2.30×(0.63×diet + 0.37×powerN)']
]);
export const FOUNDER_DERIVED_FORMULAS=Object.freeze([
 ['体重 bodyMass','[r×bodySizeMultiplier(g)]²×elongation','基本体型'],
 ['最大HP','max(25, round(bodyMass×0.48+25))','体格に応じた上限'],
 ['肉食時の攻撃力','基礎攻撃力 × (0.80 + 0.65×powerN) × (奇襲初撃なら1.28) × (捕食なら1.16)','食性とちからが関係'],
 ['仲間への給餌','協力スキル保有 ＆ 親以外の同系統が空腹 ＆ 近距離ならエネルギーを分け与える（消費1.20倍）','密集している群れは条件不成立'],
 ['吸収','吸収スキル保有なら肉食でなくても死体から栄養を得る（肉食親和性との大きい方を適用）','死体の質量は減少'],
 ['分裂','分裂スキル保有 ＆ エネルギー165以上 ＆ 健康・余裕スペース ＆ 冷却640step超','親エネルギー110とHP17%を消費'],
 ['不適地での耐性・成長','地形適性は固定、適応力によりペナルティ軽減。幼体成長倍率1+0.55×adaptationN×不適応度','主適応地形は生存戦略'],
 ['移動速度','基本速度 × (追跡・逃走中 ? 1 + 0.48×agilityN : 1) × (瞬発ダッシュなら1.27倍)','体格・地形で変化'],
 ['視野','20 + min(eyes,3)×14 + max(eyes−3,0)×7 + 24×機能触角','機能と形態の合成'],
 ['基礎代謝','0.09 + 体重×0.008 + 大型負担 + 目・口・顎・飾り・分散の負担','全式は simulation.js の morphology 参照']
]);
export const formulaMappingRows=()=>GENOME_DERIVATION_FORMULAS.map(([key,label,formula])=>({key,label,formula}));
export function founderFormulaHTML(){
 const table=(head,rows)=>'<div class="founder-formula-scroll"><table><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
 rows.map(row=>'<tr>'+row.map((cell,i)=>'<'+(i?'td':'th')+'>'+esc(cell)+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('')+'</tbody></table></div>';
 return '<details id="founderFormulaReference" class="founder-formula-reference"><summary>📐 27遺伝子から37応用パラメータへの変換式</summary>'+
 '<p>遺伝子 = 基本ステータス6項目＋保有スキル14項目＋生存戦略7項目。応用パラメータ37項目は独立して遺伝しません。水／乾燥／岩場の得意分野は生存戦略で決まり、てきおうは不得意な場所での負担を軽減します。各基本値 x の正規化 xN=(x−1)/9。clamp は0〜1に制限。値は子孫の遺伝子から毎回再計算します。</p>'+
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
