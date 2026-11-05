// Render-budget policy is independent of game simulation and can be tested
// without a browser. Background processing is intentionally slow and does not
// try to make up hours of throttled browser time in one burst.
export const performancePolicy=(population,lowPower=true)=>{
 const dense=population>250,veryDense=population>500;
 if(!lowPower)return {paintInterval:1000/(veryDense?24:30),uiInterval:600,
  stepsPerSecond:14,maxSteps:veryDense?1:dense?2:3};
 return {paintInterval:1000/(veryDense?8:dense?12:20),uiInterval:1000,
  stepsPerSecond:veryDense?5:dense?8:14,maxSteps:veryDense?1:dense?1:2};
};
export const BROWSER_BACKGROUND_INTERVAL=1000;
// Browser background timers may be throttled much more aggressively than
// this interval; it is a best-effort request, not a guaranteed real-time rate.
export const simulationBatch=(carry,elapsedMs,policy,speed=1)=>{
 const elapsed=Math.max(0,Math.min(100,elapsedMs));
 const pending=Math.min(policy.maxSteps+1,
  Math.max(0,carry)+elapsed*policy.stepsPerSecond*Math.max(1,speed)/1000);
 const steps=Math.min(policy.maxSteps,Math.floor(pending));
 return {steps,carry:pending-steps};
};
