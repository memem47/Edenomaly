import {Ecosystem,WORLD,TERRAIN_NAMES,TERRAIN_COLORS,dietProfile} from './simulation.js';
import {drawWorld,drawChart} from './renderer.js';
const $=id=>document.getElementById(id);
const game=new Ecosystem();
const canvas=$('world'),ctx=canvas.getContext('2d'),graph=$('chart').getContext('2d');
let running=true,speed=1,mode='0',filter='all',brush=3,selected=null,painting=false,last=0,acc=0,uiAt=0;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function update(){
 const dietCounts=[0,0,0];for(const u of game.units){const d=dietProfile(u.g).diet;dietCounts[d<.3?0:d>.7?2:1]++;}
 $('dietStats').textContent=`栄養食 ${dietCounts[0]} ／ 雑食 ${dietCounts[1]} ／ 肉食 ${dietCounts[2]}`;
 const data={population:game.units.length,eggCount:game.eggs.length,matingCount:game.matings,juvenileCount:game.units.filter(u=>u.stage==='juvenile').length,livingSpecies:game.livingSpecies,totalSpecies:game.species.size,corpses:game.corpses.length,nutrients:game.food.length,recycled:game.recycled};
 for(const [id,value] of Object.entries(data))$(id).textContent=value.toLocaleString('ja-JP');
 $('stepCount').textContent=game.tick.toLocaleString('ja-JP');$('status').textContent=running?'実行中':'停止中';$('play').textContent=running?'Ⅱ 停止':'▶ 再生';$('play').classList.toggle('active',running);
 $('catalog').innerHTML=[...game.species.values()].sort((a,b)=>b.n-a.n).map(s=>`<div class="species"><span class="dot" style="background:hsl(${s.hue},${s.saturation}%,${s.lightness}%)"></span><span><b>${escapeHTML(s.name)}</b><small>#${s.n} · Step ${s.first} · ${s.current?'現存':'絶滅'}</small></span><span>${s.current}</span><span>${s.total}</span></div>`).join('');
 const eventColors={birth:'#91f7ac',death:'#ff8290',meal:'#f9d36b',pred:'#be82ec',new:'#ffe486',decay:'#e2b96e',egg:'#eddfbd',hatch:'#a0e8bd',eggeaten:'#f5949c',mature:'#a0d9ff',mate:'#f5a5ed',court:'#ff91e8',laid:'#ffe3a1'};
 $('events').innerHTML=game.logs.filter(e=>filter==='all'||e.type===filter).slice(0,60).map(e=>`<div class="log-entry"><span style="color:${eventColors[e.type]||'#9eb0b8'}">●</span> [${e.step}] ${escapeHTML(e.message)}</div>`).join('');
 const people=[0,0,0,0],food=[0,0,0,0],corpses=[0,0,0,0];for(const u of game.units)people[game.terrain(u.x,u.y)]++;for(const f of game.food)food[game.terrain(f.x,f.y)]++;for(const c of game.corpses)corpses[game.terrain(c.x,c.y)]++;
 $('habitats').innerHTML=TERRAIN_NAMES.map((name,i)=>`<div><span><span style="display:inline-block;width:11px;height:11px;background:${TERRAIN_COLORS[i]};margin-right:5px"></span>${name}</span><span>生命 ${people[i]} / 栄養 ${food[i]} / 死体 ${corpses[i]} / 還元 ${game.recycledByTerrain[i]}</span></div>`).join('');
 $('inspector').textContent=selected&&!selected.dead?`#${selected.id} ${game.species.get(selected.category)?.name}｜幅 ${selected.g.r.toFixed(1)}｜長さ比 ${selected.g.elongation.toFixed(2)}｜目 ${selected.g.eyes}｜口 ${selected.g.mouths}｜脚 ${selected.g.legs}｜顎 ${selected.g.jaw.toFixed(2)}｜水適応 ${selected.g.wet.toFixed(2)}｜乾燥適応 ${selected.g.dry.toFixed(2)}｜段階 ${selected.stage==='juvenile'?'幼体':'成体'}｜食性 ${dietProfile(selected.g).label} (${Math.round(dietProfile(selected.g).diet*100)}%肉食寄り)｜外見 ${dietProfile(selected.g).signal>.55?'肉食型':dietProfile(selected.g).signal<.45?'栄養食型':'中間型'}｜擬態 ${Math.abs(dietProfile(selected.g).diet-dietProfile(selected.g).signal)>.38?'あり':'なし'}｜行動 ${selected.fleeing?'逃走中':'通常'}｜一度に産む卵 ${selected.g.brood}｜色彩 ${Math.round(selected.g.saturation)}/${Math.round(selected.g.lightness)}｜模様 ${selected.g.pattern}｜卵殻 ${selected.g.shell.toFixed(2)}｜保護 ${selected.g.guard.toFixed(2)}｜産卵場所 ${selected.g.nesting.toFixed(2)}｜エネルギー ${selected.energy.toFixed(1)}｜繁殖 ${selected.pregnancy?'産卵準備中 '+selected.pregnancy.remaining+'ステップ':selected.courtPartner?'求愛中 #'+selected.courtPartner:'通常'}｜両親 ${selected.parent===null?'始祖':'#'+selected.parent+' / #'+selected.otherParent}｜第${selected.generation}世代`:'観察モードで生命をクリック。';
 $('diagnostic').textContent=`新形態：直近300ステップで ${game.recentSpecies} 種。${game.units.length?'種数の増加だけでは創発的な行動を示しません。':'全個体が絶滅しました。移入で再開できます。'}`;
 drawChart(graph,game.history);
}
function render(){drawWorld(ctx,game,$('effects').checked,selected);}
function reset(){game.reset();selected=null;syncSliders();update();render();}
function syncSliders(){$('growth').value=game.growth;$('growthValue').value=game.growth;$('stress').value=game.stress;$('stressValue').value=game.stress;}
function frame(time){if(!last)last=time;const dt=Math.min(.08,(time-last)/1000);last=time;if(running){acc+=dt*14*speed;let n=Math.min(10,Math.floor(acc));acc-=n;for(let i=0;i<n;i++)game.step();}for(const fx of game.effects)fx.age+=dt*30;game.effects=game.effects.filter(fx=>fx.age<35);render();if(time-uiAt>180){update();uiAt=time;}requestAnimationFrame(frame);}
function coords(e){const b=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(WORLD.width-.1,(e.clientX-b.left)/b.width*WORLD.width)),y:Math.max(0,Math.min(WORLD.height-.1,(e.clientY-b.top)/b.height*WORLD.height))};}
function interact(e){const {x,y}=coords(e);if(['0','1','2','3'].includes(mode))game.paint(x,y,Number(mode),brush);else if(mode==='food'){game.addFood(x,y,65,42,'manual');game.log('info','プレイヤーが餌を散布');}else if(mode==='spawn')game.introduce(x,y);else if(mode==='inspect'){selected=null;let best=500;for(const u of game.units){const d=(u.x-x)**2+(u.y-y)**2;if(d<best){best=d;selected=u;}}}update();render();}
canvas.addEventListener('pointerdown',e=>{painting=true;canvas.setPointerCapture(e.pointerId);interact(e);});canvas.addEventListener('pointermove',e=>{if(painting&&['0','1','2','3'].includes(mode))interact(e);});canvas.addEventListener('pointerup',()=>painting=false);canvas.addEventListener('pointercancel',()=>painting=false);
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));}));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));update();}));
$('play').onclick=()=>{running=!running;update();};$('stepOnce').onclick=()=>{running=false;game.step();update();render();};$('speed').onclick=()=>{speed=speed===1?3:speed===3?8:1;$('speed').textContent='速度 ×'+speed;};$('reset').onclick=()=>{running=true;reset();};
$('brush').oninput=e=>{brush=Number(e.target.value);$('brushValue').value=brush;};$('growth').oninput=e=>{game.growth=Number(e.target.value);$('growthValue').value=game.growth;};$('stress').oninput=e=>{game.stress=Number(e.target.value);$('stressValue').value=game.stress;};
$('drought').onclick=()=>{game.drought();syncSliders();update();};$('rain').onclick=()=>{game.rain();syncSliders();update();};$('epidemic').onclick=()=>{game.epidemic();update();};
reset();requestAnimationFrame(frame);
