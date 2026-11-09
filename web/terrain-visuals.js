// Optional visual-only overlay. Classic renderer remains unchanged.
// Terrain detail is deterministic, does not consume ecology RNG, and avoids
// expensive per-cell gradients or offscreen canvases.
const TAU=Math.PI*2;
const hash=(x,y,k=0)=>{
 let n=Math.imul(x+31,374761393)^Math.imul(y+97,668265263)^Math.imul(k+17,2246822519);
 n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;
};
const circle=(ctx,x,y,r)=>{ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();};
const polygon=(ctx,coords)=>{
 ctx.beginPath();ctx.moveTo(coords[0],coords[1]);
 for(let i=2;i<coords.length;i+=2)ctx.lineTo(coords[i],coords[i+1]);
 ctx.closePath();ctx.fill();
};
export function drawEnhancedTerrain(ctx,s,season){
 const {cell,columns,rows}= {cell:20,columns:40,rows:23};
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
  const i=y*columns+x,t=s.tiles[i],lev=s.terrainLevels?.[i]??3;
  const px=x*cell,py=y*cell;
  const h=hash(x,y,1),h2=hash(x,y,2);
  if(t===0){
   const cover=Math.min(1,(s.grass[i]??0)/100);
   // Soft patches break up rigid tile boundaries.
   ctx.fillStyle=season==='autumn'?'rgba(117,83,34,.17)':
    season==='winter'?'rgba(216,241,233,.16)':'rgba(17,92,54,.13)';
   ctx.beginPath();ctx.ellipse(px+3+h*15,py+4+h2*12,5+lev,3+lev*.45,h*2,0,TAU);ctx.fill();
   if(cover>.12){
    const leaves=lev<3?2:lev===3?3:2;
    ctx.strokeStyle=season==='winter'?'rgba(95,130,118,.55)':
     season==='autumn'?'rgba(141,84,32,.56)':'rgba(11,112,52,.62)';
    ctx.lineWidth=.7;ctx.beginPath();
    for(let k=0;k<leaves;k++){
     const cx=px+3+hash(x,y,k+5)*14,cy=py+5+hash(x,y,k+9)*12;
     ctx.moveTo(cx,cy+3);ctx.lineTo(cx-1.5,cy-1.5);ctx.moveTo(cx,cy+1);
     ctx.lineTo(cx+2,cy-2);
    }ctx.stroke();
   }
   if(lev>=4&&cover>.15){
    // Canopy silhouettes, highlights and shadows remain behind creatures.
    const count=lev===5?2:1;
    for(let k=0;k<count;k++){
     const cx=px+5+hash(x,y,k+13)*10,cy=py+5+hash(x,y,k+21)*10;
     ctx.fillStyle='rgba(10,34,35,.21)';ctx.beginPath();
     ctx.ellipse(cx+2,cy+3,6,3,0,0,TAU);ctx.fill();
     ctx.fillStyle=season==='autumn'?'rgba(125,73,30,.8)':
      season==='winter'?'rgba(59,100,92,.75)':'rgba(15,85,44,.83)';
     circle(ctx,cx,cy,lev===5?5.5:4.1);
     ctx.fillStyle=season==='autumn'?'rgba(241,178,76,.58)':
      season==='winter'?'rgba(214,236,225,.63)':'rgba(123,203,113,.48)';
     circle(ctx,cx-1.5,cy-1.4,lev===5?2.3:1.8);
    }
   }else if(lev<=2&&cover<.3){
    ctx.fillStyle='rgba(132,103,48,.32)';
    circle(ctx,px+5+h*10,py+7+h2*8,1.3);
   }
  }else if(t===1){
   // Smooth oceanic color change, diagonal ripples, soft shorelines.
   ctx.fillStyle=lev<=2?'rgba(127,244,225,.23)':
    lev>=4?'rgba(5,43,112,.28)':'rgba(20,138,176,.12)';
   ctx.fillRect(px+1,py+1,cell-2,cell-2);
   const edgeLeft=x===0||s.tiles[i-1]!==1;
   const edgeRight=x===columns-1||s.tiles[i+1]!==1;
   const edgeTop=y===0||s.tiles[i-columns]!==1;
   const edgeBottom=y===rows-1||s.tiles[i+columns]!==1;
   ctx.strokeStyle='rgba(185,248,230,.56)';ctx.lineWidth=1.5;ctx.beginPath();
   if(edgeLeft){ctx.moveTo(px+1,py);ctx.lineTo(px+1,py+cell);}
   if(edgeRight){ctx.moveTo(px+cell-1,py);ctx.lineTo(px+cell-1,py+cell);}
   if(edgeTop){ctx.moveTo(px,py+1);ctx.lineTo(px+cell,py+1);}
   if(edgeBottom){ctx.moveTo(px,py+cell-1);ctx.lineTo(px+cell,py+cell-1);}
   ctx.stroke();
   const shift=(s.visualTick??s.tick)*.025;
   const wx=px+3+(h*5),wy=py+6+(h2*10);
   ctx.strokeStyle='rgba(224,254,255,.42)';ctx.lineWidth=.8;
   ctx.beginPath();ctx.moveTo(wx+Math.sin(shift+x)*1.2,wy);
   ctx.quadraticCurveTo(wx+4,wy-1.2,wx+8,wy);ctx.stroke();
   if(lev<=2&&hash(x,y,7)>.62){
    ctx.fillStyle='rgba(221,247,172,.48)';
    circle(ctx,px+5+h*10,py+11,1.5);
   }
  }else if(t===2){
   const dry=lev/5;
   ctx.fillStyle='rgba(137,90,35,.17)';
   ctx.beginPath();ctx.ellipse(px+5+h*11,py+4+h2*12,5+dry*4,2.5,1.2,0,TAU);ctx.fill();
   if(lev>=3){
    ctx.strokeStyle='rgba(131,76,37,.35)';ctx.lineWidth=.75;
    ctx.beginPath();ctx.moveTo(px+4,py+11);ctx.lineTo(px+7,py+8);
    ctx.lineTo(px+11,py+10);ctx.lineTo(px+14,py+7);ctx.stroke();
   }
   if(lev<=2){
    ctx.fillStyle='rgba(126,153,65,.38)';
    circle(ctx,px+7+h*7,py+11,1.9);
   }
   if(lev>=5){
    ctx.strokeStyle='rgba(255,238,163,.48)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(px+2,py+15);ctx.quadraticCurveTo(px+9,py+11,px+18,py+15);ctx.stroke();
   }
  }else{
   // Faceted elevations with a directional sunlit face and darker escarpment.
   const peak=lev>=4?2:0;
   const cx=px+9+h*3,cy=py+8+h2*3;
   ctx.fillStyle='rgba(21,29,58,.18)';
   polygon(ctx,[px+3,py+15,px+12,py+16,px+19,py+19,px+7,py+19]);
   ctx.fillStyle=lev>=5?'rgba(244,250,255,.80)':lev===4?
    'rgba(201,209,232,.78)':'rgba(200,198,224,.45)';
   polygon(ctx,[cx-6,cy+6,cx+1,cy-5-peak,cx+8,cy+5,cx+3,cy+8]);
   ctx.fillStyle='rgba(62,70,107,.32)';
   polygon(ctx,[cx+1,cy-5-peak,cx+8,cy+5,cx+3,cy+8,cx+2,cy+2]);
   if(lev>=4){
    ctx.strokeStyle='rgba(247,252,255,.55)';ctx.lineWidth=.7;
    ctx.beginPath();ctx.moveTo(cx-3,cy);ctx.lineTo(cx+1,cy-5-peak);ctx.stroke();
   }
  }
 }
}
