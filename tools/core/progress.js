/* ---------- progress: mark cells placed while you build, with a colour legend ----------
   Progress is kept per pattern, so going back to an earlier version of a pattern brings its ticks back. */
addSettings({fade:true,iso:null},{tap:['mark']},{},(o,s)=>{o.iso=Number.isInteger(s.iso)&&s.iso>=0&&s.iso<APP.palette.length?s.iso:null});
let prog=new Set(),progKey='',pendingProg=null;
const saveProg=()=>{if(progKey)prog.size?store.set(progKey,[...prog]):store.del(progKey)};
function loadProg(carry){
  if(!shown()){prog=new Set();progKey='';return}
  const p=pattern,key=KEY+'prog:'+p.W+'x'+p.H+':'+hashStr(Array.from(p.c).join(','));
  if(key===progKey)return;
  const had=prog;progKey=key;const v=store.get(key);
  prog=new Set(Array.isArray(v)?v.filter(k=>typeof k==='string'):[]);
  if(pendingProg){if(pendingProg.W===p.W&&pendingProg.H===p.H){prog=new Set(pendingProg.keys);saveProg()}pendingProg=null}
  else if(carry&&!Array.isArray(v)&&had.size){   /* the pattern changed by an edit: keep the ticks on cells that still have a colour */
    for(const k of had){const[x,y]=k.split(',').map(Number);if(x<p.W&&y<p.H&&p.c[y*p.W+x]>=0)prog.add(k)}saveProg()}
}
HOOK.after.push(why=>loadProg(why==='edit'));
const kOf=i=>{const x=i%pattern.W;return x+','+(i-x)/pattern.W};
function toggle(i,force){if(pattern.c[i]<0)return;const k=kOf(i),on=force===undefined?!prog.has(k):force;on?prog.add(k):prog.delete(k)}
TAP.mark=i=>{toggle(i);saveProg()};
STATUS.push(i=>prog.has(kOf(i))?', placed':', not placed yet');
ALPHA.push(i=>{const c=pattern.c[i];if(st.iso!=null&&c!==st.iso)return 0.14;return st.fade&&c>=0&&prog.has(kOf(i))?0.3:1});
function markWhere(pred,val){const p=pattern;for(let i=0;i<p.W*p.H;i++)if(p.c[i]>=0&&pred(i))toggle(i,val);saveProg();refresh()}
$('legend').addEventListener('click',e=>{const b=e.target.closest('.crow');if(!b)return;const c=+b.dataset.c;st.iso=st.iso===c?null:c;saveSettings();refresh()});
$('isoMark').addEventListener('click',()=>markWhere(i=>pattern.c[i]===st.iso,true));
$('isoClear').addEventListener('click',()=>markWhere(i=>pattern.c[i]===st.iso,false));
twoTap('resetProg','Tap again to clear all progress',()=>{prog.clear();saveProg();refresh();say('Progress cleared.')});
watch(/^fade$/,()=>{saveSettings();refresh()});
function progress(){
  const has=shown();$('progGroup').hidden=!has;if(!has)return;
  const p=pattern,cnt=new Map();let tot=0,done=0;
  for(let i=0;i<p.W*p.H;i++){const c=p.c[i];if(c<0)continue;tot++;const r=cnt.get(c)||[0,0];r[0]++;if(prog.has(kOf(i))){r[1]++;done++}cnt.set(c,r)}
  $('barFill').style.width=tot?(100*done/tot)+'%':'0';
  txt('pct',`${done.toLocaleString()} of ${units(tot)} placed`+(tot?` (${Math.round(100*done/tot)}%)`:''));
  if(st.iso!=null&&!cnt.has(st.iso))st.iso=null;
  const rows=[...cnt.keys()].sort((a,b)=>cnt.get(b)[0]-cnt.get(a)[0]||a-b);
  fillBox('legend',rows.map(c=>{const P=APP.palette[c],[n,d]=cnt.get(c);
    return`<button type="button" class="crow${d===n?' done':''}" data-c="${c}" aria-pressed="${st.iso===c}"><span class="dot" style="background:${P.hex}"></span><span class="nm">${esc(P.name)}</span><span class="ct">${d}/${n}</span></button>`}).join(''));
  $('isoBtns').hidden=st.iso==null;
  if(st.iso!=null)txt('isoName',APP.palette[st.iso].name);
}
HOOK.refresh.push(progress);
