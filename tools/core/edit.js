/* ---------- editing: paint, erase, fill and pick, with undo ----------
   Edits are kept by cell ("x,y"), on top of the picture, so they stay put when the picture is made again. */
addSettings({ed:{tool:'paint',paint:null}},{'ed.tool':['paint','erase','fill','pick'],tap:['edit']},{},
  (o,s)=>{const p=s.ed&&s.ed.paint;o.ed.paint=typeof p==='string'&&PAL_BY.has(p)?p:null});
const newEdits=()=>({col:{}});
function tidyEdits(o){
  const E=newEdits();if(!o||typeof o!=='object'||!o.col||typeof o.col!=='object')return E;
  let n=0;for(const k in o.col){if(n++>200000)break;const v=o.col[k];if(/^\d{1,4},\d{1,4}$/.test(k)&&(v===''||(typeof v==='string'&&PAL_BY.has(v))))E.col[k]=v}
  return E;
}
let E=newEdits(),undoStack=[],redoStack=[];
HOOK.load.push(()=>{E=tidyEdits(store.get(KEY+'edits'))});
const saveEdits=()=>store.set(KEY+'edits',E);
const editCount=()=>Object.keys(E.col).length;
const keyXY=(x,y)=>x+','+y;
HOOK.compose.push(p=>{for(const k in E.col){const j=k.indexOf(','),x=+k.slice(0,j),y=+k.slice(j+1);if(x<p.W&&y<p.H){const v=E.col[k];p.c[y*p.W+x]=v===''?-1:PAL_BY.get(v).i}}});
/* with the picture part, the stage stays empty until there is a picture, a blank start or an edit */
const _why=emptyWhy;emptyWhy=()=>editCount()?'':_why();

const note=t=>{txt('editMsg',t);if(t)say(t)};
function setE(k,val,ch){const before=E.col[k];if(before===val)return;ch.push([k,before,val]);if(val===undefined)delete E.col[k];else E.col[k]=val}
/* the edit for one cell, given the tool: undefined means "as the picture has it" */
function applyTool(i,ch){
  const p=pattern,x=i%p.W,y=(i-x)/p.W,k=keyXY(x,y),t=st.ed.tool,base=p.base?p.base[i]:-1;
  if(t==='paint'){const P=st.ed.paint;if(!P)return;setE(k,base===PAL_BY.get(P).i?undefined:P,ch)}
  else if(t==='erase')setE(k,base<0?undefined:'',ch);
  const v=E.col[k];p.c[i]=v===undefined?base:v===''?-1:PAL_BY.get(v).i;
}
function describe(t,ch){
  const n=ch.length;
  return t==='paint'?`Painted ${units(n)} ${st.ed.paint}`:t==='erase'?`Erased ${units(n)}`:t==='fill'?`Filled ${units(n)} with ${st.ed.paint}`:`Changed ${units(n)}`;
}
function pushUndo(what,ch){undoStack.push({what,ch});if(undoStack.length>100)undoStack.shift();redoStack=[]}
function afterEdit(){saveEdits();redraw()}
function needs(){if((st.ed.tool==='paint'||st.ed.tool==='fill')&&!st.ed.paint){note('Pick a paint colour first: tap a swatch, or use Pick on the grid.');return false}return true}
/* one tap: fill and pick act once; the other tools change one cell */
function strokeAt(i){
  if(!pattern||i<0)return;sel=i;const t=st.ed.tool,p=pattern;
  if(t==='pick'){if(p.c[i]<0){note('That '+APP.unit.one+' is empty. Tap a coloured one to pick its colour.');refresh();return}
    st.ed.paint=APP.palette[p.c[i]].name;st.ed.tool='paint';saveSettings();note('Picked '+st.ed.paint+'. Paint is ready.');sync();refresh();return}
  if(!needs())return;
  const ch=[];
  if(t==='fill'){
    const target=p.c[i],ci=PAL_BY.get(st.ed.paint).i;
    if(target===ci){note('That is already '+st.ed.paint+'.');refresh();return}
    const seen=new Uint8Array(p.W*p.H),q=[i];seen[i]=1;
    while(q.length){const j=q.pop(),x=j%p.W,y=(j-x)/p.W,base=p.base?p.base[j]:-1;setE(keyXY(x,y),base===ci?undefined:st.ed.paint,ch);
      for(const n of[x>0?j-1:-1,x<p.W-1?j+1:-1,y>0?j-p.W:-1,y<p.H-1?j+p.W:-1])if(n>=0&&!seen[n]&&p.c[n]===target){seen[n]=1;q.push(n)}}
  }else applyTool(i,ch);
  if(!ch.length){note(t==='erase'?'That '+APP.unit.one+' is already empty.':'Nothing to change there.');refresh();return}
  pushUndo(describe(t,ch),ch);note(describe(t,ch)+'.');afterEdit();
}
TAP.edit=i=>strokeAt(i);
let stroke=null,strokeRaf=0,dirty=[];
function line(a,b){   /* the cells on a straight line between two cells, so a fast drag leaves no gaps */
  const W=pattern.W,x0=a%W,y0=(a-x0)/W,x1=b%W,y1=(b-x1)/W,n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0)),o=[];
  for(let s=1;s<=n;s++)o.push(Math.round(y0+(y1-y0)*s/n)*W+Math.round(x0+(x1-x0)*s/n));return o;
}
$('board').addEventListener('pointerdown',e=>{
  if(st.tap!=='edit'||!shown())return;
  const i=cellAt(e);if(i<0)return;e.preventDefault();
  const t=st.ed.tool;if(t==='pick'||t==='fill'){strokeAt(i);return}
  if(!needs())return;
  stroke={ch:[],last:i,t};$('board').setPointerCapture(e.pointerId);sel=i;applyTool(i,stroke.ch);patchCells([i]);refresh();
});
$('board').addEventListener('pointermove',e=>{
  if(!stroke)return;const i=cellAt(e);if(i<0||i===stroke.last)return;
  for(const j of line(stroke.last,i)){applyTool(j,stroke.ch);dirty.push(j)}stroke.last=i;sel=i;
  if(!strokeRaf)strokeRaf=requestAnimationFrame(()=>{strokeRaf=0;patchCells(dirty);dirty=[];refresh()});
});
function endStroke(){
  if(!stroke)return;const s=stroke;stroke=null;
  if(s.ch.length){pushUndo(describe(s.t,s.ch),s.ch);note(describe(s.t,s.ch)+'.')}
  else note(s.t==='erase'?'That '+APP.unit.one+' is already empty.':'Nothing to change there.');
  afterEdit();
}
$('board').addEventListener('pointerup',endStroke);
$('board').addEventListener('pointercancel',endStroke);
function replay(d,dir){for(const[k,before,after]of(dir?d.ch:[...d.ch].reverse())){const v=dir?after:before;if(v===undefined)delete E.col[k];else E.col[k]=v}}
$('undo').addEventListener('click',()=>{const d=undoStack.pop();if(!d)return;replay(d,0);redoStack.push(d);note('Undid: '+d.what+'.');afterEdit()});
$('redo').addEventListener('click',()=>{const d=redoStack.pop();if(!d)return;replay(d,1);undoStack.push(d);note('Redid: '+d.what+'.');afterEdit()});
$('clearEdits').addEventListener('click',()=>{
  const ch=[];for(const k in E.col)ch.push([k,E.col[k],undefined]);
  if(!ch.length){note('There are no edits to clear.');return}
  replay({ch},1);pushUndo('cleared '+plural(ch.length,'edit'),ch);note('Cleared '+plural(ch.length,'edit')+'. Undo brings them back.');afterEdit();
});
$('paintSw').addEventListener('click',e=>{const b=e.target.closest('[data-pc]');if(!b)return;st.ed.paint=APP.palette[+b.dataset.pc].name;if(st.ed.tool!=='fill')st.ed.tool='paint';saveSettings();sync()});
watch(/^ed\./,()=>{note('');saveSettings();sync();refresh()});
HOOK.sync.push(()=>{
  const ed=st.tap==='edit'&&shown();$('editBar').hidden=!ed;$('board').classList.toggle('editing',ed);$('board').classList.toggle('lock',ed);
  if(!ed)return;
  const t=st.ed.tool;$('brushColour').hidden=!(t==='paint'||t==='fill');
  const pc=st.ed.paint?PAL_BY.get(st.ed.paint):null;$('paintDot').style.background=pc?pc.hex:'transparent';txt('paintName',pc?pc.name:'Pick a colour');
  fillBox('paintSw',APP.palette.map((c,i)=>`<button type="button" class="swb" data-pc="${i}" style="background:${c.hex}" title="${esc(c.name)}" aria-label="Paint ${esc(c.name)}" aria-pressed="${st.ed.paint===c.name}"></button>`).join(''));
  $('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;$('clearEdits').disabled=!editCount();
});
