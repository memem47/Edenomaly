// Fast-forward while no living organism is active, provided at least one
// living organism or viable egg survives. Dead eggs/corpses are ignored.
export function allLivingDormant(units,eggs=[]){
 let living=0;
 for(const u of units){
  if(u.dead)continue;
  living++;
  if(!u.dormant)return false;
 }
 return living>0||eggs.some(e=>!e.dead);
}
export function dormancySpeedMultiplier(units,eggs=[]){
 return allLivingDormant(units,eggs)?2:1;
}
