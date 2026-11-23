// Species evolution graph. Pure topology + SVG rendering; no simulation RNG.
// A species node represents the FIRST recorded member of that phenotype.
// Parent links can be two-parent hybrids, so this is a directed acyclic graph
// with a tree-like arrangement rather than a strict one-parent genealogy.
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const NODE_WIDTH=172, NODE_HEIGHT=134, X_GAP=42, Y_GAP=72;
export function evolutionGraph(world){
 const nodes=[...world.species.entries()].map(([key,sp])=>({
  key,name:sp.name,first:sp.first??0,n:sp.n??0,current:sp.current??0,
  total:sp.total??0,genome:sp.genome,parentKeys:[],depth:0
 })).sort((a,b)=>a.first-b.first||a.n-b.n);
 const byKey=new Map(nodes.map(n=>[n.key,n]));
 const edges=[];
 for(const node of nodes){
  const sp=world.species.get(node.key);
  const linked=new Set();
  for(const parent of sp.parents??[]){
   if(!parent?.genome)continue;
   const parentKey=world.category(parent.genome);
   if(parentKey===node.key||!byKey.has(parentKey)||linked.has(parentKey))continue;
   const source=byKey.get(parentKey);
   // Discard invalid temporal or cyclic parent references.
   if(source.first>node.first||(source.first===node.first&&source.n>=node.n))continue;
   linked.add(parentKey);node.parentKeys.push(parentKey);
   edges.push({from:parentKey,to:node.key});
  }
 }
 for(const node of nodes){
  node.depth=node.parentKeys.length?1+Math.max(...node.parentKeys.map(k=>byKey.get(k).depth)):0;
 }
 const levels=new Map();
 for(const node of nodes){
  const list=levels.get(node.depth)??[];
  list.push(node);levels.set(node.depth,list);
 }
 const columns=[...levels.entries()].sort((a,b)=>a[0]-b[0]);
 const count=Math.max(1,...columns.map(([,list])=>list.length));
 const height=count*(NODE_HEIGHT+Y_GAP)+34;
 const width=Math.max(1,columns.length)*(NODE_WIDTH+X_GAP)+38;
 for(const [depth,list] of columns){
  // Place nodes by discovery sequence within depth, using stable IDs.
  list.forEach((node,i)=>{
   node.x=20+depth*(NODE_WIDTH+X_GAP);
   node.y=17+(height-list.length*(NODE_HEIGHT+Y_GAP)+Y_GAP)/2+i*(NODE_HEIGHT+Y_GAP);
  });
 }
 return {nodes,edges,width,height,roots:nodes.filter(n=>n.parentKeys.length===0).length};
}
export function evolutionSVG(graph,portrait=()=>'',scale=1){
 const width=graph.width,height=graph.height;
 const links=graph.edges.map(({from,to})=>{
  const a=graph.nodes.find(n=>n.key===from),b=graph.nodes.find(n=>n.key===to);
  if(!a||!b)return '';
  const x1=a.x+NODE_WIDTH,y1=a.y+NODE_HEIGHT*.46,x2=b.x,y2=b.y+NODE_HEIGHT*.46;
  return '<path d="M'+x1+' '+y1+' C'+(x1+36)+' '+y1+' '+(x2-36)+' '+y2+' '+x2+' '+y2+
   '" fill="none" stroke="#78adc0" stroke-width="2.1" stroke-opacity=".8"/>';
 }).join('');
 const cards=graph.nodes.map(node=>{
  const img=portrait(node);
  const label=node.name.length>19?node.name.slice(0,18)+'…':node.name;
  const detail='発見 '+node.first+' / 現在 '+node.current+' / 累計 '+node.total;
  return '<g class="evolution-node" data-evolution-key="'+esc(node.key)+'" transform="translate('+node.x+' '+node.y+')">'+
   '<title>'+esc(node.name)+' / '+esc(detail)+'</title>'+
   '<rect width="'+NODE_WIDTH+'" height="'+NODE_HEIGHT+'" rx="12" fill="#1b3c4b" stroke="'+(node.current?'#7bd9bb':'#6d8790')+'" stroke-width="1.4"/>'+
   (img?'<image x="28" y="4" width="116" height="83" preserveAspectRatio="xMidYMid meet" href="'+esc(img)+'"/>':
    '<circle cx="86" cy="44" r="26" fill="#5bb5ac" opacity=".7"/>')+
   '<text x="86" y="103" fill="#f1f8ef" font-size="11.5" font-weight="600" text-anchor="middle">'+esc(label)+'</text>'+
   '<text x="86" y="120" fill="#b8d0d7" font-size="9" text-anchor="middle">'+esc(detail)+'</text>'+
   '</g>';
 }).join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+Math.round(width*scale)+'" height="'+Math.round(height*scale)+'" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="スライムの進化家系図"><rect width="100%" height="100%" fill="#112934"/>'+links+cards+'</svg>';
}
