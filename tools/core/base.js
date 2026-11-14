/* ---------- base: helpers, storage, settings, controls and files. Every app has this part. ---------- */
const NS='http://www.w3.org/2000/svg';
const $=id=>document.getElementById(id);
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const plural=(n,one,many)=>n.toLocaleString()+' '+(n===1?one:(many||one+'s'));
const txt=(id,t)=>{const e=$(id);if(e&&e.textContent!==t)e.textContent=t};
const signed=v=>v>0?'+'+v:v<0?'−'+(-v):'0';
const hashStr=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}return(h>>>0).toString(36)};

/* The app spec: name, version, colours, sizes and words, written by the generator. The page reads it at start-up. */
const SPEC=JSON.parse($('app-spec').textContent);
const VERSION=SPEC.version,KEY=SPEC.key;

/* ---------- storage: localStorage when it works, memory when it doesn't ---------- */
const mem={},unsaved=new Set();
const store={
  get(k){if(unsaved.has(k))return mem[k];try{const v=localStorage.getItem(k);if(v!=null)return JSON.parse(v)}catch(e){}return k in mem?mem[k]:null},
  set(k,v){mem[k]=v;let ok=true;try{localStorage.setItem(k,JSON.stringify(v))}catch(e){ok=false}
    ok?unsaved.delete(k):unsaved.add(k);const m=$('saveMsg');if(m)m.hidden=!unsaved.size;return ok},
  del(k){delete mem[k];unsaved.delete(k);try{localStorage.removeItem(k)}catch(e){}}
};
/* An app that was renamed moves what this browser saved under its old names (SPEC.oldKeys). */
try{for(const ok of SPEC.oldKeys||[]){const old=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(ok))old.push(k)}
  for(const k of old){const n=KEY+k.slice(ok.length);if(localStorage.getItem(n)==null)localStorage.setItem(n,localStorage.getItem(k));localStorage.removeItem(k)}}}catch(e){}

/* ---------- hooks: the app's own code (APP CODE) can set any of these ---------- */
const APP={
  unit:{one:SPEC.unit.one,many:SPEC.unit.many},
  palette:SPEC.palette.map((c,i)=>({name:c.name,hex:c.hex.toUpperCase(),code:c.code||'',i})),
  describe:null,     /* (x, y, colourIndex) => {name, where}: what the readout says about a tapped cell */
  cellSvg:null,      /* (cell) => SVG markup for one cell; cell has i, x, y, cx, cy, c, hex */
  cellPaint:null,    /* (g, cell, u) => draws one cell on a canvas for Save picture; u is pixels per cell */
  lists:[],          /* more lists under Export: {id, label, ext, make: () => text} */
  onPattern:null,    /* (pattern) => after every rebuild */
  onSync:null,       /* () => keep the app's own controls in step with the settings */
  onRefresh:null,    /* () => after every redraw of the cell states */
  projectOut:null,   /* () => extra data to keep in project files */
  projectIn:null,    /* (data) => read that data back (tidy it first: files can be old or hand-made) */
  onStart:null       /* () => once, when the page has loaded */
};
const PAL_BY=new Map(APP.palette.map(c=>[c.name,c]));
const units=n=>plural(n,APP.unit.one,APP.unit.many);   /* "3 beads", "1 bead" */
const HOOK={load:[],start:[],sync:[],refresh:[],compose:[],after:[],resize:[]};

/* ---------- settings: defaults, allowed choices and number limits, gathered from each part and from the app ---------- */
const DEF={tap:'inspect',ui:{}},CHOICES={tap:['inspect']},LIMITS={},TIDY=[];
function addSettings(def,choices,limits,tidyFn){
  (function deep(d,s){for(const k in s){if(s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])){if(!d[k]||typeof d[k]!=='object')d[k]={};deep(d[k],s[k])}else d[k]=s[k]}})(DEF,def||{});
  for(const k in choices||{})CHOICES[k]=[...new Set([...(CHOICES[k]||[]),...choices[k]])];
  Object.assign(LIMITS,limits||{});if(tidyFn)TIDY.push(tidyFn);
}
const getIn=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
const setIn=(o,p,v)=>{const ks=p.split('.'),l=ks.pop();ks.reduce((a,k)=>a[k],o)[l]=v};
function merge(d,s){
  if(d===null)return null;   /* null defaults are read back by that part's own tidy step */
  if(Array.isArray(d))return Array.isArray(s)?s.slice(0,500):d.slice();
  if(typeof d==='object'){const o={};for(const k in d)o[k]=merge(d[k],s&&typeof s==='object'&&!Array.isArray(s)?s[k]:undefined);return o}
  return typeof s===typeof d&&(typeof s!=='number'||Number.isFinite(s))?s:d;
}
/* tidy: anything read from storage or a file becomes valid settings */
function tidy(s){
  if(!s||typeof s!=='object')s={};
  const o=merge(DEF,s);
  for(const p in CHOICES)if(!CHOICES[p].includes(getIn(o,p)))setIn(o,p,getIn(DEF,p));
  for(const p in LIMITS){const[a,b,f]=LIMITS[p],v=Number(getIn(o,p)),d=getIn(DEF,p);setIn(o,p,clamp(Number.isFinite(v)?(f?v:Math.round(v)):d,a,b))}
  const ui={};if(s.ui&&typeof s.ui==='object')for(const k in s.ui)if(/^\w{1,30}$/.test(k))ui[k]=!!s.ui[k];o.ui=ui;
  for(const f of TIDY)f(o,s);
  return o;
}
let st=null;
const saveSettings=()=>store.set(KEY+'settings',st);

/* one-off messages for screen readers */
function say(t){const e=$('sr');if(!e)return;e.textContent='';setTimeout(()=>{e.textContent=t},60)}

/* ---------- controls ----------
   .seg buttons with data-k (a setting path) and data-v (its value), checkboxes with data-k, and sliders set up with slider().
   watch(test, fn) says what happens after a setting changes; anything unclaimed rebuilds. */
const WATCH=[];
function watch(test,fn){WATCH.push([test,fn])}
function changed(k){for(const[t,f]of WATCH)if(typeof t==='function'?t(k):t.test(k)){f(k);return}rebuild()}
function asValue(k,v){const d=getIn(DEF,k);return typeof d==='number'?Number(v):typeof d==='boolean'?v==='true':v}
document.querySelectorAll('.seg button[data-k]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.k;setIn(st,k,asValue(k,b.dataset.v));changed(k)}));
document.querySelectorAll('input[type=checkbox][data-k]').forEach(c=>c.addEventListener('change',()=>{setIn(st,c.dataset.k,c.checked);changed(c.dataset.k)}));
const OUT={},FMT={};
function readout(id,v){const t=(FMT[id]||String)(v),o=$(OUT[id]||id+'Out');if(o&&o.textContent!==t)o.textContent=t;const e=$(id);if(e)e.setAttribute('aria-valuetext',t)}
function put(id,v){const e=$(id);if(!e)return;e.value=v;readout(id,v)}
/* fmt: value to text; commit: once when the drag ends; live: on every step of the drag */
function slider(id,fmt,commit,live){FMT[id]=fmt;const e=$(id);if(!e)return;e.addEventListener('input',()=>{if(live)live(+e.value);readout(id,+e.value)});e.addEventListener('change',()=>commit(+e.value))}
/* a slider tied straight to a setting */
function bindSlider(id,key,fmt){slider(id,fmt||String,v=>{setIn(st,key,v);changed(key)});HOOK.sync.push(()=>put(id,getIn(st,key)))}
function fillBox(id,html){const b=$(id);if(b&&b.dataset.h!==html){b.innerHTML=html;b.dataset.h=html}}
/* a button that needs a second tap within 3 seconds, for things that can't be undone */
function twoTap(id,again,fn){const b=$(id);if(!b)return;const label=b.textContent;let armed=0;
  b.addEventListener('click',()=>{if(!armed){b.textContent=again;armed=setTimeout(()=>{armed=0;b.textContent=label},3000);return}
    clearTimeout(armed);armed=0;b.textContent=label;fn()})}

/* the three steps every change goes through: rebuild (remake what's shown), sync (controls), refresh (cell states) */
let rebuild=()=>{saveSettings();sync();refresh()};
function sync(){
  document.querySelectorAll('.seg button[data-k]').forEach(b=>b.setAttribute('aria-pressed',String(String(getIn(st,b.dataset.k))===b.dataset.v)));
  document.querySelectorAll('input[type=checkbox][data-k]').forEach(c=>{c.checked=!!getIn(st,c.dataset.k)});
  for(const f of HOOK.sync)f();
  if(APP.onSync)APP.onSync();
}
function refresh(){for(const f of HOOK.refresh)f();if(APP.onRefresh)APP.onRefresh()}

/* ---------- files ---------- */
/* hand a file to the person: through the host's save box where there is one, otherwise as an ordinary download. True if it went. */
async function saveFile(name,blob,msg){
  let dl=null;
  try{if(window.claude&&typeof window.claude.use==='function')dl=await window.claude.use('downloads')}catch(e){}
  if(dl){
    try{await dl.save({filename:name,data:blob});msg.textContent='Saved '+name+'.';return true}
    catch(e){msg.textContent=e&&e.code==='declined'?'Save cancelled.':'Saving isn’t available here. Open the page in your browser instead.';return false}
  }
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);msg.textContent='Downloaded '+name+'.';return true;
}
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
const fileBase=()=>{const n=$('projName');return slug(n&&n.value.trim()||'')||slug(SPEC.code+' '+SPEC.unit.one+'s')||'app'};
/* a CSV cell: quoted when needed, and never read as a formula by a spreadsheet */
const csv=v=>{let s=String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return/[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};

/* ---------- the parts of the page written from the spec: header, Learn the ideas, About, Credits ---------- */
function specText(){
  document.title=SPEC.code+': '+SPEC.name;txt('appTitle',SPEC.code+': '+SPEC.name);txt('appTag',SPEC.tagline);
  const L=$('learnList');if(L)L.innerHTML=(SPEC.learn||[]).map(t=>`<li><b>${esc(t.topic)}</b>: `+t.links.map(l=>
    `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.title)}</a>`+(l.source?` (${esc(l.source)})`:'')).join(', ')+'.</li>').join('');
  const lg=$('learn');if(lg)lg.hidden=!(SPEC.learn||[]).length;
  txt('aboutWhen',SPEC.version+' · '+SPEC.date);
  const A=$('aboutList');if(A)A.innerHTML=(SPEC.changes||[]).map(c=>`<li>${esc(c)}</li>`).join('');
  const C=$('creditList');if(C)C.innerHTML=(SPEC.credits||[]).concat(CREDITS).map(c=>`<li>${esc(c)}</li>`).join('');
}
const CREDITS=[];   /* each part adds the credits it needs */

/* ---------- start-up ---------- */
function start(){
  st=tidy(store.get(KEY+'settings'));
  for(const f of HOOK.load)f();
  specText();
  document.querySelectorAll('.q').forEach(b=>b.addEventListener('click',()=>{const t=$(b.getAttribute('aria-controls'));if(!t)return;const open=t.hidden;t.hidden=!open;b.setAttribute('aria-expanded',String(open))}));
  document.querySelectorAll('details[data-ui]').forEach(d=>{const k=d.dataset.ui;d.open=k in st.ui?st.ui[k]:d.hasAttribute('open');
    d.addEventListener('toggle',()=>{if(st.ui[k]!==d.open){st.ui[k]=d.open;saveSettings()}})});
  for(const f of HOOK.start)f();
  if(APP.onStart)APP.onStart();
  rebuild();
  homeHint({code:SPEC.code,name:SPEC.name,url:SPEC.homeUrl||'',key:KEY,mount:$('homeHow')});
}
