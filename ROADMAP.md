# Edenomaly — 開発ロードマップ

## 目指す体験
An observable, evolving artificial ecosystem. The player edits terrain and resources, discovers organisms and documents surprising events. Rules stay simple, outcomes should be emergent rather than scripted.

## 開発原則
- Morphology affects survival; genes are inherited and mutated.
- Terrain controls natural food generation and decomposition rates.
- Dead organisms become corpses, which decay into nutrients.
- Birth, death, feeding, predation and discoveries are visible and recorded.
- Species are **provisional morphology bins**, not biological species.
- Reproducible runs with fixed seeds; simulation logic stays separate from rendering.
- Don't artificially guarantee endless novel events; measure novelty and stagnation.

## リリース計画
| Stage | Scope | Acceptance criteria | Status |
|---|---|---|---|
| v0.1 | Standalone HTML/CSS/JS | Run in a browser with no external dependencies | [x] |
| v0.2 | Ecosystem and interaction | Organisms feed, reproduce, hunt, die and mutate | [x] |
| v0.3 | Terrain | Four tile types, editable with paint tool | [x] |
| v0.4 | Nutrient cycling | Corpses persist and decompose into edible particles | [x] |
| v0.5 | Species and event observability | Species list (newest first), alive/ever born counts, birth/death/feeding/predation/decomposition log | [x] |
| v0.6 | Reproducibility and monitoring | Explicit seed, batch simulation, charts, diversity, stagnation measures | [ ] |
| v0.7 | Shape-driven body mechanics | Physical morphology matters for movement, contact and feeding | [ ] |
| v0.8 | Ecological dynamics | Nutrient budgets, niches, stability and collapse diagnostics | [ ] |
| v0.9 | Discovery play | Persistent catalog, lineage, world save/load and shareable discoveries | [ ] |
| v1.0 | Public release | usability tests, itch.io browser release, public demo | [ ] |

## 生活環と卵防御（追加実験）
- [x] 卵 → 幼体 → 成体：産卵・孵化・成長を別イベントとして扱う
- [x] 卵は移動・反撃できず、他の生物に食べられる
- [x] 卵殻・孵化時間、親の見守り傾向、産卵地点の選択が遺伝・変異する
- [ ] 生態系実験：捕食圧ごとに卵防御形質が増減するかを定量評価する
- [x] 交配可能な2個体の探索、交配、遺伝子組換え、双方の親IDの保存
- [x] 交配回数・イベント表示と交配後のクールダウン
- [x] 求愛中のペア連結表示、24ステップの求愛、45ステップの産卵準備期間、産卵地点への軌跡を可視化
- [x] 卵数の遺伝形質（1〜8）と、卵ごとの独立な遺伝子組換え・エネルギー負担
- [x] 求愛/産卵の画面上の数値・文字を廃止し、光の輪・模様・卵のまとまりで表現
- [x] 色相、彩度、明度、模様を遺伝形質として導入
- [x] 初期集団を小さな群れに配置、環境栄養を調整、両親による自分の卵の捕食を防止
- [ ] 長期実行で交配成立数、孵化数、絶滅率、種多様性を計測しパラメータを調整
- [ ] 性差・配偶者選好・遺伝的隔離・遺伝子水平伝播は未実装

※ 現在の繁殖は**2個体交配による有性生殖モデル**。各形質を両親から独立に継承し、低確率で突然変異する。性別はまだ設けない。捕食で得るのはエネルギーであり、獲物の遺伝子は取り込まない。
※ 図鑑の「新種」は形態の区分が新しいことを意味し、生殖隔離による種分化の証明ではない。
※ 卵殻は食べる際の時間的コストを増やすが、卵は食べられる。卵の保護戦略は進化を保証しない。

## 食性・捕食者回避・擬態（実装）
- [x] 遺伝子 `diet`（0〜1）で栄養食／雑食／肉食の効率を連続的に定義。両端では片方の食物を利用できない。
- [x] 実際の食性と独立した `deception` 遺伝子で、外見上の危険信号を変化させる。
- [x] 獲物は見た目の危険信号と体格から逃走を判断する。逃走には移動・エネルギーのコストがある。
- [x] 外見に葉状触角（栄養食型）、棘・牙状模様（肉食型）、中間形を表示。
- [x] 図鑑・観察パネルで真の食性と見かけの食性、逃走状態を確認できる。
- [ ] 多世代の実験で食性構成・擬態頻度・捕食成功率を測定する。
- **注意:** 擬態は遺伝的に可能な表現であり、選択圧により実際に広がることまでは検証していない。
- **注意:** 現行の栄養粒子は「植物性・環境由来の資源」を簡略化したもので、独立した植物個体ではない。

## 地形の資源格差と生息地への進化的適応
- [x] 地形ごとの栄養発生比率：草地100%、水辺58%、乾燥地14%、岩場5.5%（基準は草地）
- [x] 遺伝する `wet` / `dry` / `rock` 適応度を、地形別の移動速度、代謝コスト、栄養取得効率へ反映
- [x] 同じ食性の競合個体と体格差から局所競争圧を計算する
- [x] 混雑時に複数の候補地点の栄養・競争・地形適応度を比較し、低競争地へ移住を試みる
- [x] 移住の開始・完了をイベント記録し、地形別個体数・平均適応度を表示する
- [ ] 数千世代の複数乱数シード試験で、痩せた土地への定着と遺伝的適応の増加を定量検証
- [ ] 地形別の栄養消費量と子孫数、移住後の世代間変化を計測する
- **注意:** 生涯中に獲得した耐性は遺伝しない。交配による遺伝子組換え・突然変異と、生存・繁殖の選択圧で集団が変わる。
- **注意:** 競争で追われた個体が必ず新たな適応を達成するとは限らない。移住も生存も保証しない。

## 産卵・戦闘・負傷と老化の可視化
- [x] 産卵した卵は親の進行方向と逆側（尾側）から現れ、数ステップかけて産卵地点へ広がる
- [x] 捕食を即死処理からHP制の複数攻撃へ変更、攻撃間隔と形態に応じた威力を設定
- [x] 攻撃時の斬撃・衝撃波、捕食成功時の粒子・リングのエフェクト
- [x] 負傷で移動・攻撃・交配能力が下がる。採食時にわずかに回復可能
- [x] 老化で移動・攻撃能力が下がり、色がくすむ・体格がやや縮むなど外見が変化
- [x] 観察パネルでHP、老化率、活力を表示
- [ ] 交戦時間・負傷生存率・老化による世代交代の定量評価
- 注意：戦闘は簡易的な接触判定で、精密な物理衝突や反撃・装甲・部位別損傷は未実装。

## コミット前の確認
1. Run in browser and test terrain painting and restart.
2. Observe births, deaths, meals and predation on canvas and in log.
3. Check species counters: alive <= ever born; extinct species remain listed.
4. Compare nutrient regeneration in grass/water vs dry/rock.
5. Kill organisms and verify corpses decompose into particles without spawning unlimited food.
6. Run longer, record whether new species appear and whether populations collapse.

## 既知の制約
- Approximate nutrient/energy conservation; external food regenerates indefinitely.
- No realistic soft-body physics or spatial indexing yet.
- Species classification is a fixed phenotype discretization; not speciation.
- Event list is bounded; no persistence; no backend.
- Not verified for large-scale or very long-running simulations.

## リポジトリとライセンス
- Repository visibility: **Public**.
- No open-source license is granted initially (no LICENSE file); retain copyright.
- Public source does not mean freely reusable source. Revisit license before accepting outside contributions.
- Do not commit secrets or copyrighted third-party assets.

## 公開方法
To publish the browser demo later: copy `web/` to `docs/` and configure Settings > Pages > Deploy from a branch > main /docs, or use a GitHub Actions deployment for `web/`. For first preview, run a local HTTP server and visit localhost.

## 将来の収益化
Keep game design/code licensing separate from distribution policy. Start with playable free demos on GitHub Pages and itch.io; validate retention and discovery-sharing before paid release.
