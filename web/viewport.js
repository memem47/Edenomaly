// Pure coordinate transforms for the fixed 800x460 world.
// View state affects only rendering and pointer positions; no simulation state.
export const MIN_ZOOM=1;
export const MAX_ZOOM=6;
export const ZOOM_STEP=1.5;
export const clampZoom=zoom=>Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,zoom));
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const fitView=(view,width,height)=>{
 const zoom=clampZoom(view.zoom);
 return {zoom,
  x:clamp(view.x,0,width-width/zoom),
  y:clamp(view.y,0,height-height/zoom)};
};
export const screenToWorld=(view,sx,sy,width,height)=>{
 const v=fitView(view,width,height);
 return {x:clamp(v.x+sx/v.zoom,0,width-.1),
  y:clamp(v.y+sy/v.zoom,0,height-.1)};
};
export const worldToScreen=(view,x,y,width,height)=>{
 const v=fitView(view,width,height);
 return {x:(x-v.x)*v.zoom,y:(y-v.y)*v.zoom};
};
// Keep the point beneath the pointer stationary while zooming in/out.
export const zoomAround=(view,zoom,sx,sy,width,height)=>{
 const old=fitView(view,width,height),next=clampZoom(zoom);
 const wx=old.x+sx/old.zoom,wy=old.y+sy/old.zoom;
 return fitView({zoom:next,x:wx-sx/next,y:wy-sy/next},width,height);
};
export const panBy=(view,dx,dy,width,height)=>{
 const v=fitView(view,width,height);
 return fitView({...v,x:v.x-dx/v.zoom,y:v.y-dy/v.zoom},width,height);
};
