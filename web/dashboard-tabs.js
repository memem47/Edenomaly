// A single active information tab keeps observation central and removes nested scrollbars.
// All original DOM nodes (and their event handlers) are moved, not cloned.
export const DASHBOARD_TABS=Object.freeze([
 {id:'operations',label:'🛠 操作'},
 {id:'catalog',label:'🧬 図鑑'},
 {id:'ecology',label:'🌿 生態'},
 {id:'history',label:'📜 ログ'},
 {id:'stats',label:'📈 成績'}
]);
export function mountDashboardTabs(doc=document){
 const main=doc.querySelector('.shell>main');
 if(!main)return null;
 const source=Array.from(main.querySelectorAll(':scope > .stack > section.panel'));
 // Two existing stacks: operations / habitats / events, and
 // catalog / reproduction / seasonal / long log / nutrition chart.
 const groups={
  operations:[doc.querySelector('.shell>.game-controls'),source[0]],
  catalog:[source[3]],
  ecology:[source[1],source[4],source[5],source[7]],
  history:[doc.getElementById('gameEventPanel'),source[2],source[6]],
  stats:[doc.querySelector('.shell>.score-strip')]
 };
 // Individual abilities are secondary to the world view: available on demand.
 const inspector=doc.getElementById('inspector');
 if(inspector){
  const details=doc.createElement('details');details.id='selectedAbilityDetails';
  details.className='selected-ability-details';
  details.innerHTML='<summary>🧬 選択中のスライムの能力バーを開く</summary><div id="selectedAbilityBars"></div>';
  inspector.after(details);
 }
 const metrics=doc.querySelector('.shell>.metrics');
 const extra=doc.createElement('section');
 extra.className='panel dashboard-extra-metrics';
 extra.innerHTML='<h2>すべての指標</h2>';
 const grid=doc.createElement('div');grid.className='dashboard-metrics-grid';
 for(const item of Array.from(metrics.children)){
  const strong=item.querySelector('strong');
  if(!strong)continue;
  if(['population','livingSpecies','totalSpecies','eggCount','juvenileCount'].includes(strong.id))continue;
  grid.append(item);
 }
 extra.append(grid);groups.stats.push(extra);
 const tabs=doc.createElement('nav');tabs.className='dashboard-tabs';tabs.setAttribute('role','tablist');
 tabs.setAttribute('aria-label','情報画面を切り替え');
 const content=doc.createElement('div');content.className='dashboard-content';
 main.replaceChildren(tabs,content);
 const panels=new Map(),buttons=new Map();
 for(const entry of DASHBOARD_TABS){
  const button=doc.createElement('button');button.type='button';button.textContent=entry.label;
  button.id='dash-tab-'+entry.id;button.setAttribute('role','tab');
  button.setAttribute('aria-controls','dash-panel-'+entry.id);
  button.setAttribute('aria-selected','false');button.tabIndex=-1;
  const panel=doc.createElement('div');panel.id='dash-panel-'+entry.id;
  panel.className='dashboard-tab-panel';panel.setAttribute('role','tabpanel');
  panel.setAttribute('aria-labelledby',button.id);
  panel.hidden=true;
  for(const section of groups[entry.id]??[])if(section)panel.append(section);
  button.onclick=()=>activate(entry.id);
  tabs.append(button);content.append(panel);panels.set(entry.id,panel);buttons.set(entry.id,button);
 }
 function activate(id){
  if(!panels.has(id))return;
  for(const [name,panel]of panels){
   const active=name===id;panel.hidden=!active;
   const btn=buttons.get(name);btn.classList.toggle('active',active);
   btn.setAttribute('aria-selected',String(active));btn.tabIndex=active?0:-1;
  }
  content.scrollTop=0;
 }
 tabs.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const current=DASHBOARD_TABS.findIndex(tab=>buttons.get(tab.id)===doc.activeElement);
  if(current<0)return;
  event.preventDefault();
  const n=event.key==='Home'?0:event.key==='End'?DASHBOARD_TABS.length-1:
   (current+(event.key==='ArrowRight'?1:-1)+DASHBOARD_TABS.length)%DASHBOARD_TABS.length;
  const next=DASHBOARD_TABS[n].id;activate(next);buttons.get(next).focus();
 });
 activate('operations');
 return {activate,panels};
}
