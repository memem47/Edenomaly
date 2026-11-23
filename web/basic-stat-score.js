// Canonical, simulation-independent definitions for six player-facing stats.
// A stat is derived from existing DNA, never an extra hereditary gene.
// Exports are deliberately dependency-free for exact species birth statistics.
export const BASIC_STAT_GROUPS=Object.freeze([
 {key:'power',name:'ちから',icon:'💪',help:'反撃と防衛。強い防衛には維持コストもあります。',genes:['retaliation','guard']},
 {key:'agility',name:'すばやさ',icon:'💨',help:'分散と移動速度。速さを上げるほど代謝コストも増えます。',genes:['dispersal']},
 {key:'stamina',name:'たいりょく',icon:'❤️',help:'感染抵抗、燃費、温度耐性。HPには体格の影響もあります。',genes:['resist','frugality','tempTolerance']},
 {key:'intellect',name:'かしこさ',icon:'🧠',help:'危険識別、警戒、産卵場所の判断。',genes:['predatorSense','caution','nestChoice']},
 {key:'adaptation',name:'てきおう',icon:'🌦️',help:'水辺、乾燥地、岩場、休眠への備え。万能化にはポイントが必要です。',genes:['wet','dry','rock','hibernate']},
 {key:'fertility',name:'はんしょく',icon:'🥚',help:'産卵数、卵殻、給餌、卵の栄養。多産は親に負担がかかります。',genes:['brood','shell','parentFeeding','yolkReserve']}
]);
export const BASIC_STAT_BOUNDS=Object.freeze({
 tempTolerance:[3,18],brood:[1,8]
});
const clamp=n=>Math.max(1,Math.min(10,Math.round(n)));
export const geneLevel=(g,key)=>{
 const [lo,hi]=BASIC_STAT_BOUNDS[key]??[0,1],value=Number(g?.[key]);
 return clamp(Number.isFinite(value)?Math.round((value-lo)/(hi-lo)*9)+1:1);
};
export const basicStatScore=(g,key)=>{
 const stat=BASIC_STAT_GROUPS.find(s=>s.key===key);
 return stat?clamp(stat.genes.reduce((sum,gene)=>sum+geneLevel(g,gene),0)/stat.genes.length):null;
};
export const basicStatValues=g=>Object.fromEntries(
 BASIC_STAT_GROUPS.map(s=>['stat_'+s.key,basicStatScore(g,s.key)]));
