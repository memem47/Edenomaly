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
