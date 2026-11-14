/* ---------- board: the grid of cells on the stage, with sizes, zoom, tapping, the keyboard and the readout ----------
   A pattern is W x H cells, each a palette number (-1 for an empty cell). With boards in the spec the grid is made of
   whole boards (across x down), drawn with a small gap between them, as FIG does with pegboards and BIG with sheets. */
const BOARDS=SPEC.boards||[],GRID=SPEC.grid,SHAPE=SPEC.shape||'circle';
const PAD=0.6,GAP=BOARDS.length?0.5:0;   /* drawing: margin round the grid and gap between boards, in cells */
const B0=BOARDS[0];   /* with boards, the first board, as many across and down as come closest to the spec's starting size */
addSettings({size:{board:B0?B0.id:'',across:B0?Math.max(1,Math.round(GRID.defW/B0.w)):1,down:B0?Math.max(1,Math.round(GRID.defH/B0.h)):1,w:GRID.defW,h:GRID.defH},blank:false},
  BOARDS.length?{'size.board':BOARDS.map(b=>b.id)}:{},
  {'size.across':[1,64],'size.down':[1,64],'size.w':[GRID.minW,GRID.maxW],'size.h':[GRID.minW,GRID.maxW]},
  o=>fitCount(o));
let picAspect=()=>0;     /* the picture part sets this: width / height of the crop, when the height follows it */
let CONVERT=null;        /* the picture part sets this: (dims) => {W, H, c0} */
let emptyWhy=()=>'';     /* text for the empty stage, or '' when the grid shows */
function boardOf(o=st){return BOARDS.length?(BOARDS.find(b=>b.id===o.size.board)||BOARDS[0]):null}
/* keep the whole grid within the spec's largest width and cell count */
function fitCount(o=st){
  const B=boardOf(o);if(!B)return;
  const maxA=Math.max(1,Math.floor(GRID.maxW/B.w)),maxD=Math.max(1,Math.floor(GRID.maxW/B.h));
  o.size.across=clamp(o.size.across,1,maxA);o.size.down=clamp(o.size.down,1,maxD);
  while(o.size.across*B.w*o.size.down*B.h>GRID.maxCells&&(o.size.across>1||o.size.down>1)){if(o.size.across>=o.size.down)o.size.across--;else o.size.down--}
}
function dims(o=st){
  const B=boardOf(o);
  if(B)return{W:B.w*o.size.across,H:B.h*o.size.down,bw:B.w,bh:B.h,across:o.size.across,down:o.size.down,B};
  let W=o.size.w,H=o.size.h;const A=picAspect();
  if(A)H=clamp(Math.round(W/A),1,GRID.maxW);
  while(W*H>GRID.maxCells&&W>GRID.minW){W--;if(A)H=clamp(Math.round(W/A),1,GRID.maxW)}
  return{W,H,bw:W,bh:H,across:1,down:1,B:null};
}

/* ---------- state ---------- */
let conv=null,pattern=null,sel=-1,zoom=1,els=[],alpha=null;
const ALPHA=[];   /* (i) => opacity for cell i (1 = solid); the parts that fade cells add one */

function compose(){
  const d=dims(),n=d.W*d.H,c=new Int16Array(n).fill(-1);
  if(conv&&conv.W===d.W&&conv.H===d.H)c.set(conv.c0);
  const p={W:d.W,H:d.H,c,bw:d.bw,bh:d.bh,across:d.across,down:d.down,B:d.B,base:conv&&conv.W===d.W&&conv.H===d.H?conv.c0:null};
  p.X=x=>PAD+Math.floor(x/d.bw)*(d.bw+GAP)+(x%d.bw)+0.5;
  p.Y=y=>PAD+Math.floor(y/d.bh)*(d.bh+GAP)+(y%d.bh)+0.5;
  p.Wpx=2*PAD+d.W+(d.across-1)*GAP;p.Hpx=2*PAD+d.H+(d.down-1)*GAP;
  for(const f of HOOK.compose)f(p);
  if(APP.onPattern)APP.onPattern(p);
  return p;
}
const shown=()=>!!pattern&&!emptyWhy();
const n2=v=>+v.toFixed(2);

/* ---------- drawing (SVG): one group per cell, in cell order, so els[i] is cell i ---------- */
function cellInner(p,i){
  const x=i%p.W,y=(i-x)/p.W,cx=n2(p.X(x)),cy=n2(p.Y(y)),c=p.c[i];
  if(c<0)return`<circle class="peg" cx="${cx}" cy="${cy}" r=".2"/>`;
  const hex=APP.palette[c].hex;
  if(APP.cellSvg){const s=APP.cellSvg({i,x,y,cx,cy,c,hex});if(s)return s}
  if(SHAPE==='square')return`<rect x="${n2(cx-.5)}" y="${n2(cy-.5)}" width="1.02" height="1.02" fill="${hex}"/>`;
  if(SHAPE==='rounded')return`<rect x="${n2(cx-.46)}" y="${n2(cy-.46)}" width=".92" height=".92" rx=".2" fill="${hex}"/>`;
  if(SHAPE==='stud')return`<rect x="${n2(cx-.5)}" y="${n2(cy-.5)}" width="1.02" height="1.02" fill="${hex}"/><circle class="ov stud" cx="${cx}" cy="${cy}" r=".3"/>`;
  if(SHAPE==='bead')return`<circle cx="${cx}" cy="${cy}" r=".46" fill="${hex}"/><circle class="ov hole" cx="${cx}" cy="${cy}" r=".16"/>`;
  return`<circle cx="${cx}" cy="${cy}" r=".46" fill="${hex}"/>`;
}
const cellMarkup=(p,i)=>`<g class="cell" data-i="${i}">${cellInner(p,i)}</g>`;
function render(){
  const svg=$('board');if(!svg)return;
  const p=pattern;els=[];alpha=null;
  if(!shown()){svg.toggleAttribute('hidden',true);svg.innerHTML='';return}
  svg.toggleAttribute('hidden',false);   /* an <svg> has no hidden property, only the attribute */
  svg.setAttribute('viewBox',`0 0 ${n2(p.Wpx)} ${n2(p.Hpx)}`);
  const h=[];
  for(let by=0;by<p.down;by++)for(let bx=0;bx<p.across;bx++)
    h.push(`<rect class="bd" x="${n2(PAD-.1+bx*(p.bw+GAP))}" y="${n2(PAD-.1+by*(p.bh+GAP))}" width="${n2(p.bw+.2)}" height="${n2(p.bh+.2)}" rx=".3"/>`);
  for(let i=0;i<p.W*p.H;i++)h.push(cellMarkup(p,i));
  h.push('<rect id="selRing" class="ring" width="1" height="1" rx=".22" visibility="hidden"/>');
  svg.innerHTML=h.join('');
  els=Array.from(svg.querySelectorAll('[data-i]'));
}
/* redraw only some cells, for quick feedback while painting */
function patchCells(list){
  const svg=$('board'),t=document.createElementNS(NS,'g');
  for(const i of list){if(!els[i])continue;t.innerHTML=cellMarkup(pattern,i);const g=t.firstChild;svg.replaceChild(g,els[i]);els[i]=g;if(alpha)alpha[i]=1}
}

/* ---------- what each cell looks like right now, and the readout ---------- */
function paintStates(){
  if(!shown()||!els.length)return;
  const p=pattern,n=p.W*p.H;if(!alpha||alpha.length!==n)alpha=new Float32Array(n).fill(1);
  for(let i=0;i<n;i++){let a=1;for(const f of ALPHA){const v=f(i);if(v<a)a=v}if(a!==alpha[i]){alpha[i]=a;els[i].style.opacity=a===1?'':String(a)}}
  const r=$('selRing');
  if(r){if(sel>=0&&sel<n){const x=sel%p.W,y=(sel-x)/p.W;r.setAttribute('x',n2(p.X(x)-.5));r.setAttribute('y',n2(p.Y(y)-.5));r.setAttribute('visibility','visible')}else r.setAttribute('visibility','hidden')}
}
function where(x,y){
  const p=pattern;
  if(p.across>1||p.down>1){const bx=Math.floor(x/p.bw),by=Math.floor(y/p.bh);
    return`Board ${bx+1} across, ${by+1} down: column ${x%p.bw+1}, row ${y%p.bh+1}. Overall column ${x+1}, row ${y+1}.`}
  return`Column ${x+1}, row ${y+1}.`;
}
const STATUS=[];   /* (i) => words added after the colour name, such as ", placed" */
function hud(){
  const dot=$('hudDot');if(!dot)return;
  const One=APP.unit.one[0].toUpperCase()+APP.unit.one.slice(1);
  if(!shown()||sel<0||sel>=pattern.W*pattern.H){dot.className='empty';dot.style.background='';txt('hudName','Tap a '+APP.unit.one);txt('hudWhere','Its colour and place show here.');return}
  const p=pattern,x=sel%p.W,y=(sel-x)/p.W,c=p.c[sel];
  dot.className=c<0?'empty':'';dot.style.background=c<0?'':APP.palette[c].hex;
  let d=APP.describe?APP.describe(x,y,c):null;
  if(!d){const P=c<0?null:APP.palette[c];d={name:P?P.name+(P.code?' ('+P.code+')':''):'Empty '+APP.unit.one,where:where(x,y)}}
  txt('hudName',d.name+(c<0?'':STATUS.map(f=>f(sel)).join('')));txt('hudWhere',d.where);
}
HOOK.refresh.push(paintStates,hud);

/* ---------- size controls ---------- */
const mm=SPEC.pitch||0,cmOf=n=>(n*mm/10).toFixed(1).replace(/\.0$/,''),inOf=n=>(n*mm/25.4).toFixed(1).replace(/\.0$/,'');
function syncSize(){
  const d=dims(),B=d.B,many=APP.unit.many;
  if(B){
    txt('acrossOut',String(st.size.across));txt('downOut',String(st.size.down));
    const step=(k,dd)=>document.querySelector(`[data-step="${k}"][data-d="${dd}"]`);
    const up=(a,dn)=>{const t=clone(st);t.size[a?'across':'down']++;fitCount(t);return a?t.size.across>st.size.across:t.size.down>st.size.down};
    if(step('size.across',1)){step('size.across',1).disabled=!up(true);step('size.down',1).disabled=!up(false);
      step('size.across',-1).disabled=st.size.across<=1;step('size.down',-1).disabled=st.size.down<=1}
  }else{
    put('sizeW',st.size.w);put('sizeH',st.size.h);
    const hr=$('sizeHRow');if(hr)hr.hidden=!!picAspect();
  }
  const n=d.across*d.down;
  txt('sizeInfo',`${d.W} × ${d.H} ${many}`+(B?` on ${plural(n,'board')} (${B.name}, ${d.across} across × ${d.down} down)`:'')+
    (mm?`, ${cmOf(d.W)} × ${cmOf(d.H)} cm (${inOf(d.W)} × ${inOf(d.H)} in)`:'')+'.'+(!B&&picAspect()?' The height follows the crop.':''));
}
HOOK.sync.push(syncSize);
document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{
  const k=b.dataset.step;setIn(st,k,getIn(st,k)+(+b.dataset.d));fitCount();changed(k)}));
slider('sizeW',v=>String(v),v=>{st.size.w=v;changed('size.w')});
slider('sizeH',v=>String(v),v=>{st.size.h=v;changed('size.h')});

/* ---------- rebuild: remake the conversion (reconvert) and the pattern, then draw ---------- */
rebuild=function(reconvert=true){
  const d=dims();
  if(reconvert||!conv||conv.W!==d.W||conv.H!==d.H)conv=CONVERT?CONVERT(d):null;
  const old=pattern;pattern=compose();
  if(sel>=pattern.W*pattern.H)sel=-1;
  if(!old||old.Wpx!==pattern.Wpx||old.Hpx!==pattern.Hpx)zoom=1;
  render();
  for(const f of HOOK.after)f('rebuild');
  const e=$('empty'),why=emptyWhy();if(e)e.hidden=!why;txt('emptyMsg',why);
  if(shown()){zoom=Math.max(zoom,fitZoom());size()}
  saveSettings();sync();refresh();
};
/* redraw after an edit, without reconverting the picture */
function redraw(){pattern=compose();render();for(const f of HOOK.after)f('edit');if(shown())size();sync();refresh()}
watch(/^tap$/,()=>{saveSettings();sync();refresh()});

/* ---------- zoom and scrolling ---------- */
const vp=$('vp');
const maxH=()=>Math.max(240,window.innerHeight*0.7);
function fitZoom(){if(!pattern)return 1;const h=vp.clientWidth*pattern.Hpx/pattern.Wpx;return Math.min(1,maxH()/h)}
const ppu=()=>vp.clientWidth*zoom/pattern.Wpx;
function size(){if(!pattern)return;const w=vp.clientWidth*zoom,svg=$('board');svg.style.width=w+'px';svg.style.height=(w*pattern.Hpx/pattern.Wpx)+'px'}
function setZoom(z,cx,cy){
  if(!shown())return;const old=ppu();
  if(cx===undefined){cx=(vp.scrollLeft+vp.clientWidth/2)/old;cy=(vp.scrollTop+vp.clientHeight/2)/old}
  zoom=Math.max(fitZoom(),Math.min(12,z));size();
  const q=ppu();vp.scrollLeft=cx*q-vp.clientWidth/2;vp.scrollTop=cy*q-vp.clientHeight/2;
}
function ensureVisible(i){
  const p=pattern,x=i%p.W,y=(i-x)/p.W,q=ppu(),X=p.X(x)*q,Y=p.Y(y)*q,m=40;
  if(X<vp.scrollLeft+m)vp.scrollLeft=X-m*2;else if(X>vp.scrollLeft+vp.clientWidth-m)vp.scrollLeft=X-vp.clientWidth+m*2;
  if(Y<vp.scrollTop+m)vp.scrollTop=Y-m*2;else if(Y>vp.scrollTop+vp.clientHeight-m)vp.scrollTop=Y-vp.clientHeight+m*2;
}
$('zin').addEventListener('click',()=>setZoom(zoom*1.5));
$('zout').addEventListener('click',()=>setZoom(zoom/1.5));
$('zfit').addEventListener('click',()=>{if(pattern)setZoom(0,pattern.Wpx/2,pattern.Hpx/2)});
vp.addEventListener('wheel',e=>{if(!e.ctrlKey||!shown())return;e.preventDefault();const r=$('board').getBoundingClientRect(),q=ppu();
  setZoom(zoom*(e.deltaY<0?1.15:1/1.15),(e.clientX-r.left)/q,(e.clientY-r.top)/q)},{passive:false});
let rzT;window.addEventListener('resize',()=>{clearTimeout(rzT);rzT=setTimeout(()=>{if(shown()){zoom=Math.max(zoom,fitZoom());size()}for(const f of HOOK.resize)f()},120)});

/* ---------- tapping and the keyboard ---------- */
/* the cell under a pointer, from its position (so small and empty cells are as easy to hit as big ones) */
function cellAt(e){
  const p=pattern,r=$('board').getBoundingClientRect(),q=r.width/p.Wpx,x=(e.clientX-r.left)/q,y=(e.clientY-r.top)/q;
  const bx=Math.floor((x-PAD)/(p.bw+GAP)),by=Math.floor((y-PAD)/(p.bh+GAP)),lx=Math.floor(x-PAD-bx*(p.bw+GAP)),ly=Math.floor(y-PAD-by*(p.bh+GAP));
  if(bx<0||by<0||bx>=p.across||by>=p.down||lx<0||ly<0||lx>=p.bw||ly>=p.bh)return-1;
  return(by*p.bh+ly)*p.W+bx*p.bw+lx;
}
const TAP={};   /* what a tap does in each tap mode other than Inspect: TAP[mode] = (i) => {} */
function select(i){sel=i;refresh()}
$('board').addEventListener('click',e=>{
  if(!shown()||st.tap==='edit')return;const i=cellAt(e);if(i<0)return;
  sel=i;if(TAP[st.tap])TAP[st.tap](i);refresh();
});
vp.addEventListener('keydown',e=>{
  if(!shown())return;
  const d={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key],p=pattern;
  if(d){e.preventDefault();
    if(sel<0){const i=p.c.findIndex(c=>c>=0);select(i<0?0:i)}
    else{const x=clamp(sel%p.W+d[0],0,p.W-1),y=clamp(Math.floor(sel/p.W)+d[1],0,p.H-1);select(y*p.W+x)}
    ensureVisible(sel);
  }else if((e.key===' '||e.key==='Enter')&&sel>=0&&TAP[st.tap]){e.preventDefault();TAP[st.tap](sel,true);refresh()}
});
HOOK.sync.push(()=>{const w=$('tapWrap');if(w)w.hidden=CHOICES.tap.length<2||!shown();
  const z=document.querySelector('.zoom');if(z)z.hidden=!shown()});
