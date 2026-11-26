// Dormancy fast-forward changes only the number of simulation steps per
// wall-clock time. Ecology, lifespan, mutation and deterministic world RNG
// remain unchanged. Zero living individuals must never trigger it.
export function allLivingDormant(units){
 let living=0;
 for(const u of units){
  if(u.dead)continue;
  living++;
  if(!u.dormant)return false;
 }
 return living>0;
}
// A batch can contain several steps, so evaluate again after EACH step. This
// makes the fast-forward stop as soon as one organism wakes or is born awake.
export function dormancySpeedMultiplier(units){
 return allLivingDormant(units)?2:1;
}
