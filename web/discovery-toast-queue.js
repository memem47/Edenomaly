// Sequential, real-time 5-second new-species notifications.
// Completely independent of the simulation step clock and RNG.
export function createDiscoveryToastQueue({
 show,hide,schedule=setTimeout,cancel=clearTimeout,duration=5000
}){
 const queue=[];
 let active=null,timer=null;
 function next(){
  timer=null;
  if(active!==null){hide(active);active=null;}
  if(queue.length===0)return;
  active=queue.shift();
  show(active);
  timer=schedule(next,duration);
 }
 return {
  push(items){
   queue.push(...items);
   if(active===null&&queue.length)next();
  },
  clear(){
   if(timer!==null){cancel(timer);timer=null;}
   queue.length=0;
   if(active!==null){hide(active);active=null;}
  },
  get pending(){return queue.length;},
  get current(){return active;}
 };
}
