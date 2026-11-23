import {buildSpeciesTree,speciesTreePath,TREE_NODE_HEIGHT,TREE_NODE_WIDTH} from './species-tree.js';
import {drawFounderAppearance} from './founder-preview.js';
const esc=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function createImage(genome,w=100,h=65){
 const canvas=document.createElement('canvas');canvas.width=w*2;canvas.height=h*2;
 if(genome)drawFounderAppearance(canvas,genome);
 return canvas;
}
function renderTreeToCanvas(tree){
 // Scale export down only if browser canvas exceeds practical dimensions.
 const scale=Math.min(1,Math.sqrt(12000000/(tree.width*tree.height)),8000/tree.width,8000/tree.height);
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(tree.width*scale));
 canvas.height=Math.max(1,Math.round(tree.height*scale));
 const ctx=canvas.getContext('2d');
 ctx.scale(scale,scale);ctx.fillStyle='#102a36';ctx.fillRect(0,0,tree.width,tree.height);
 const byKey=new Map(tree.nodes.map(n=>[n.key,n]));
 for(const edge of tree.edges){
  const a=byKey.get(edge.from),b=byKey.get(edge.to);
  const x1=a.x+TREE_NODE_WIDTH,y1=a.y+TREE_NODE_HEIGHT/2,x2=b.x,y2=b.y+TREE_NODE_HEIGHT/2;
  ctx.strokeStyle=edge.secondary?'#9ea8ba':'#7ec8b9';ctx.lineWidth=edge.secondary?1.5:2;
  ctx.setLineDash(edge.secondary?[5,5]:[]);
  ctx.beginPath();ctx.moveTo(x1,y1);
  if(edge.secondary)ctx.bezierCurveTo((x1+x2)/2,y1,(x1+x2)/2,y2,x2,y2);
  else{const mid=(x1+x2)/2;ctx.lineTo(mid,y1);ctx.lineTo(mid,y2);ctx.lineTo(x2,y2);}
  ctx.stroke();
 }ctx.setLineDash([]);
 for(const node of tree.nodes){
  ctx.fillStyle=node.current>0?'#244b55':'#273844';ctx.strokeStyle=node.current>0?'#6dcab2':'#667d89';ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(node.x,node.y,TREE_NODE_WIDTH,TREE_NODE_HEIGHT,8);ctx.fill();ctx.stroke();
  const art=createImage(node.genome,104,62);
  ctx.drawImage(art,node.x+25,node.y+5,104,62);
  ctx.fillStyle='#f0f8fa';ctx.font='11px sans-serif';ctx.textAlign='center';
  const name=[...node.name],row=[];let line='',lines=[];
  for(const char of name){if(ctx.measureText(line+char).width>136){lines.push(line);line=char;}else line+=char;}
  if(line)lines.push(line);for(const [i,str] of lines.slice(0,2).entries())ctx.fillText(str,node.x+TREE_NODE_WIDTH/2,node.y+79+i*12);
  ctx.font='9px sans-serif';ctx.fillStyle='#a8cad0';ctx.fillText('#'+node.number+' · Step '+node.first,node.x+TREE_NODE_WIDTH/2,node.y+107);
 }
 return canvas;
}
export function mountSpeciesTree({game,dialog,viewport,summary,onSpeciesClick}){
 let tree=null;
 const render=()=>{
  tree=buildSpeciesTree(game.species);
  summary.textContent='発見 '+tree.nodes.length+'種 / 親子関係 '+tree.edges.length+'本。実線は主な祖先、破線は別種の親です。画像をクリックすると図鑑に移動できます。';
  if(!tree.nodes.length){viewport.innerHTML='<p class="muted">生命を移入すると、進化の枝分かれがここに表示されます。</p>';return;}
  const byKey=new Map(tree.nodes.map(n=>[n.key,n]));
  const paths=tree.edges.map(edge=>'<path d="'+speciesTreePath(byKey.get(edge.from),byKey.get(edge.to),edge.secondary)+'" fill="none" stroke="'+(edge.secondary?'#b0a7ce':'#78d1b1')+'" stroke-width="'+(edge.secondary?'1.5':'2')+'"'+(edge.secondary?' stroke-dasharray="5 5"':'')+'/>').join('');
  viewport.innerHTML='<div class="tree-stage" style="width:'+tree.width+'px;height:'+tree.height+'px">'+
   '<svg viewBox="0 0 '+tree.width+' '+tree.height+'" width="'+tree.width+'" height="'+tree.height+'" aria-hidden="true">'+paths+'</svg>'+
   tree.nodes.map(node=>'<button class="tree-species-node '+(node.current>0?'tree-alive':'tree-extinct')+'" data-tree-category="'+esc(node.key)+'" type="button" style="left:'+node.x+'px;top:'+node.y+'px" title="'+esc(node.name)+' · Step '+node.first+'">'+
    '<canvas width="208" height="130" data-tree-portrait="'+esc(node.key)+'" aria-hidden="true"></canvas>'+
    '<span class="tree-species-name">'+esc(node.name)+'</span>'+
    '<small>#'+node.number+' · Step '+node.first+' · '+(node.current?'現存 '+node.current+'体':'絶滅')+'</small></button>').join('')+'</div>';
  for(const canvas of viewport.querySelectorAll('[data-tree-portrait]')){
   const genome=byKey.get(canvas.dataset.treePortrait)?.genome;
   if(genome)drawFounderAppearance(canvas,genome);
  }
 };
 const open=()=>{render();dialog.showModal();};
 const close=()=>dialog.close();
 viewport.addEventListener('click',ev=>{
  const node=ev.target.closest('[data-tree-category]');
  if(node){close();onSpeciesClick?.(node.dataset.treeCategory);}
 });
 const download=()=>{
  if(!tree)return;
  const image=renderTreeToCanvas(tree);
  image.toBlob(blob=>{
   if(!blob)return;
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=url;a.download='edenomaly-species-tree-step-'+game.tick+'.png';a.click();
   setTimeout(()=>URL.revokeObjectURL(url),60000);
  },'image/png');
 };
 dialog.addEventListener('click',ev=>{if(ev.target===dialog)close();});
 return {open,close,download,render};
}
