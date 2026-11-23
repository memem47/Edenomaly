// Tooltips for all canonical inherited DNA fields.
export const FOUNDER_TRAIT_HELP=Object.freeze({
 power:'ちから（1〜10）。攻撃用の顎・防衛行動・角の形などを決める遺伝子です。',
 agility:'すばやさ（1〜10）。移動・分散能力や細長さ、触角・尾などに影響します。代謝負担もあります。',
 stamina:'たいりょく（1〜10）。感染への耐性・温度耐性・燃費・甲殻模様などを決めます。',
 intellect:'かしこさ（1〜10）。警戒・危険識別・擬態・感知器官に影響します。',
 adaptation:'てきおう（1〜10）。生息地の環境に対応する力です。地形の特化先は生存戦略で別途指定します。',
 fertility:'はんしょく（1〜10）。卵数・卵殻・卵への栄養投資・子育て適性・卵状の房などを決めます。',
 skillWaterGardening:'水草栽培スキルを子孫へ遺伝させます。水生で水草の種・植え付け可能な水場が必要です。',
 skillHibernate:'休眠スキルを遺伝させます。気温や餌不足で休眠してエネルギーを節約します。',
 skillParentFeeding:'親の給餌スキル。余剰エネルギーがあれば空腹の子に餌を与えます。',
 skillNestChoice:'産卵地選択スキル。よりよい産卵地点の探索に使われます。',
 skillRetaliation:'反撃スキル。攻撃されたときに反撃できるようになります。',
 skillCannibalism:'幼体共食いスキル。食性や空腹の条件次第で幼体を捕食します。',
 diet:'食性。0は草食、1は肉食寄りです。強さと独立した生存戦略として遺伝します。',
 aquatic:'生息型。0が陸生、1が水生です。生息地を選ぶ遺伝子です。',
 repro:'繁殖方式。0が雌雄異体、1が雌雄同体、2が単為生殖です。',
 biome:'主適応地形。0草地、1水辺、2乾燥地、3岩場に特化します。',
 thermal:'好適気温。0は−5℃、1は40℃付近を好みます。耐えられる温度幅はたいりょくで決まります。',
 social:'群れ志向。0は孤立、1は仲間に集まる傾向が高くなります。',
 albino:'白化形質。1で色素を失った白色の個体になります。自然発生はまれです。'
});
export const FOUNDER_ADVANCED_TRAITS=new Set();
export const founderTraitHelp=key=>FOUNDER_TRAIT_HELP[key]??'遺伝情報。基本ステータス・スキル・戦略として子孫へ継承されます。';
