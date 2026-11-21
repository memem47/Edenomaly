// Rank parent-child differences by relative magnitude so different units
// (eyes, temperature, HP, speed) can share a meaningful ordering.
export function differenceMagnitude(key,value,parentValues,min,max){
 if(!Number.isFinite(value))return 0;
 const differences=parentValues.filter(Number.isFinite).map(v=>Math.abs(value-v));
 if(!differences.length)return 0;
 const width=Number.isFinite(min)&&Number.isFinite(max)&&max>min
  ?max-min:Math.max(1,Math.abs(value),...parentValues.filter(Number.isFinite).map(Math.abs));
 return Math.max(...differences)/width;
}
export function rankDifferences(rows){
 return [...rows].sort((a,b)=>b.score-a.score||a.index-b.index);
}
