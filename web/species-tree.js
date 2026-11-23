// An evolutionary *species* tree, not a genealogy of all individual animals.
// Cross-breeding can have two different species parents: the first is the
// tree parent, and other ancestors are shown as dashed secondary edges.
export const TREE_NODE_WIDTH=154;
export const TREE_NODE_HEIGHT=112;
export const TREE_COLUMN_GAP=82;
export const TREE_ROW_GAP=26;
export const TREE_PAD=35;
export function buildSpeciesTree(species){
 const nodes=[...species.entries()].map(([key,sp])=>({
  key,name:sp.name??'種族不明',first:sp.first??0,number:sp.n??0,
  current:sp.current??0,total:sp.total??0,
  genome:sp.genome??null,parentKeys:sp.parentCategories??sp.parents?.map(p=>p.category).filter(Boolean)??[]
 })).sort((a,b)=>a.first-b.first||a.number-b.number||a.key.localeCompare(b.key));
 const byKey=new Map(nodes.map(node=>[node.key,node]));
 for(const node of nodes){
  const unique=[...new Set(node.parentKeys)].filter(key=>key!==node.key&&byKey.has(key)&&
   (byKey.get(key).first<node.first||
    byKey.get(key).first===node.first&&byKey.get(key).number<node.number));
  node.parentKeys=unique;
  node.parentKey=unique[0]??null;
  node.otherParents=unique.slice(1);
  node.children=[];
 }
 for(const node of nodes)if(node.parentKey)byKey.get(node.parentKey).children.push(node);
 const roots=nodes.filter(node=>!node.parentKey);
 let nextRow=0;
 function place(node,depth){
  node.depth=depth;
  for(const child of node.children)place(child,depth+1);
  if(node.children.length)node.row=(node.children[0].row+node.children.at(-1).row)/2;
  else node.row=nextRow++;
 }
 for(const root of roots)place(root,0);
 let minRow=Infinity,maxRow=-Infinity,maxDepth=0;
 for(const node of nodes){minRow=Math.min(minRow,node.row);maxRow=Math.max(maxRow,node.row);maxDepth=Math.max(maxDepth,node.depth);}
 const nodesOut=nodes.map(node=>({...node,
  x:TREE_PAD+node.depth*(TREE_NODE_WIDTH+TREE_COLUMN_GAP),
  y:TREE_PAD+node.row*(TREE_NODE_HEIGHT+TREE_ROW_GAP),
  children:node.children.map(child=>child.key)
 }));
 const placed=new Map(nodesOut.map(node=>[node.key,node]));
 const edges=[];
 for(const node of nodesOut){
  for(const key of node.parentKeys){
   const parent=placed.get(key);if(parent)edges.push({from:parent.key,to:node.key,secondary:key!==node.parentKey});
  }
 }
 return {nodes:nodesOut,edges,
  width:Math.max(600,TREE_PAD*2+(maxDepth+1)*TREE_NODE_WIDTH+maxDepth*TREE_COLUMN_GAP),
  height:Math.max(280,TREE_PAD*2+(nextRow||1)*TREE_NODE_HEIGHT+Math.max(0,nextRow-1)*TREE_ROW_GAP)};
}
export function speciesTreePath(from,to,secondary=false){
 const x1=from.x+TREE_NODE_WIDTH,y1=from.y+TREE_NODE_HEIGHT/2,
  x2=to.x,y2=to.y+TREE_NODE_HEIGHT/2;
 if(secondary){
  const mid=Math.max(x1+14,Math.min(x2-14,(x1+x2)/2));
  return `M ${x1} ${y1} C ${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`;
 }
 const mid=(x1+x2)/2;
 return `M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`;
}
