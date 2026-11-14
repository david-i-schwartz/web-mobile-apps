/* HTML App Generator: turns an app spec into one self-contained HTML file built on the core that FIG and BIG share.
   Runs in a browser (the generator page) and in Node (cli.js). No outside code.
   generate(spec, files, regions) -> {html, spec, notes}   files: the core files by name (core/*.js, core/core.css, html/*.html)
   readApp(html) -> {spec, regions} | {error}              reads an app this generator made, so it can be upgraded
   brief(spec) -> text                                     the build brief to hand to Claude or another AI with the app */
(function(root){
'use strict';
const GEN_VERSION='1.1',CORE_VERSION='1.1';
const MODULES=['base','home','board','picture','edit','progress','project','export'];
const FEATURES=['board','picture','edit','progress','project','export'];
const NEEDS_BOARD=['picture','edit','progress','export'];
const SHAPES=['bead','circle','square','rounded','stud'];
const MARK={
  css:['/* ==== APP CSS START ==== */','/* ==== APP CSS END ==== */'],
  stage:['<!-- ==== APP STAGE START ==== -->','<!-- ==== APP STAGE END ==== -->'],
  panels:['<!-- ==== APP PANELS START ==== -->','<!-- ==== APP PANELS END ==== -->'],
  code:['/* ==== APP CODE START ==== */','/* ==== APP CODE END ==== */']};

/* ---------- small helpers ---------- */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const str=(v,max,d='')=>{const s=typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):'';return s||d};
const int=(v,a,b,d)=>{const n=Math.round(Number(v));return Number.isFinite(n)?clamp(n,a,b):d};
const isHex=h=>typeof h==='string'&&/^#[0-9a-f]{6}$/i.test(h.trim());
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30);
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const today=()=>{const d=new Date();return d.getDate()+' '+MONTHS[d.getMonth()]+' '+d.getFullYear()};
const rgbOf=h=>{const n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]};
const hexOf=c=>'#'+c.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('').toUpperCase();
const lum=h=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};const[r,g,b]=rgbOf(h);return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)};
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};
/* text on an accent-coloured button: white, or a very dark shade of the accent, whichever reads better */
const inkFor=h=>{const dark=hexOf(rgbOf(h).map(v=>v*0.16));return contrast(h,'#FFFFFF')>=contrast(h,dark)?'#FFFFFF':dark};
const lighten=(h,t)=>hexOf(rgbOf(h).map(v=>v+(255-v)*t));

/* ---------- the spec: every field checked and given a default, so any spec (hand-made, old or from a form) works ---------- */
function tidySpec(s){
  if(!s||typeof s!=='object')s={};
  const notes=[],o={};
  o.code=(typeof s.code==='string'?s.code.toUpperCase().replace(/[^A-Z0-9]/g,''):'').slice(0,6);
  if(o.code.length<2){if(s.code)notes.push('The short name needs 2 to 6 letters or digits, so APP is used.');o.code='APP'}
  o.name=str(s.name,60,'Image Generator');
  o.tagline=str(s.tagline,240,'Turn a picture into a pattern you can build. Everything stays in this browser.');
  o.version=typeof s.version==='string'&&/^\d{1,3}(\.\d{1,3}){0,2}$/.test(s.version.trim())?s.version.trim():'1.0';
  o.date=str(s.date,30,today());
  const U=s.unit&&typeof s.unit==='object'?s.unit:{};
  const one=str(U.one,24,'cell').toLowerCase();o.unit={one,many:str(U.many,24,one+'s').toLowerCase()};
  o.shape=SHAPES.includes(s.shape)?s.shape:'circle';
  o.pitch=clamp(Number(s.pitch)||0,0,200);
  o.accent=isHex(s.accent)?s.accent.trim().toUpperCase():'#0E7C7B';
  o.accentDark=isHex(s.accentDark)?s.accentDark.trim().toUpperCase():'';
  const F=s.features&&typeof s.features==='object'?s.features:{};
  o.features={};for(const f of FEATURES)o.features[f]=F[f]===undefined?true:!!F[f];
  if(!o.features.board)for(const f of NEEDS_BOARD)if(o.features[f]){o.features[f]=false;notes.push(`${f[0].toUpperCase()+f.slice(1)} needs the grid, so it is off.`)}
  const G=s.grid&&typeof s.grid==='object'?s.grid:{};
  const maxW=int(G.maxW,4,400,160),minW=int(G.minW,1,maxW,4);
  o.grid={minW,maxW,defW:int(G.defW,minW,maxW,Math.min(48,maxW)),defH:int(G.defH,minW,maxW,Math.min(48,maxW)),maxCells:int(G.maxCells,100,90000,40000)};
  o.boards=[];const ids=new Set();
  for(const b of Array.isArray(s.boards)?s.boards.slice(0,12):[]){
    if(!b||typeof b!=='object')continue;const w=int(b.w,1,maxW,0),h=int(b.h,1,maxW,0);if(!w||!h)continue;
    let id=slug(b.id||b.name||(w+'x'+h))||'board';while(ids.has(id))id+='-2';ids.add(id);
    o.boards.push({id,name:str(b.name,40,`${w} × ${h}`),w,h});
  }
  o.palette=[];const names=new Set();
  for(const c of Array.isArray(s.palette)?s.palette.slice(0,256):[]){
    if(!c||!isHex(c.hex))continue;let name=str(c.name,40,c.hex.toUpperCase()),k=2;
    while(names.has(name.toLowerCase()))name=str(c.name,36,'Colour')+' '+(k++);names.add(name.toLowerCase());
    const e={name,hex:c.hex.trim().toUpperCase()};const code=str(c.code,16);if(code)e.code=code;o.palette.push(e);
  }
  if(o.palette.length<2){if(Array.isArray(s.palette)&&s.palette.length)notes.push('A palette needs at least two colours, so the basic palette is used.');o.palette=BASIC.map(c=>({...c}))}
  const pal=new Set(o.palette.map(c=>c.name));
  o.sets=[];for(const t of Array.isArray(s.sets)?s.sets.slice(0,12):[]){if(!t||typeof t!=='object')continue;
    const colours=[...new Set((Array.isArray(t.colours)?t.colours:[]).filter(n=>pal.has(n)))];if(colours.length>=2)o.sets.push({name:str(t.name,30,'Set'),colours})}
  o.learn=[];for(const t of Array.isArray(s.learn)?s.learn.slice(0,20):[]){if(!t||typeof t!=='object')continue;
    const links=(Array.isArray(t.links)?t.links:[]).filter(l=>l&&typeof l.url==='string'&&/^https?:\/\/[^\s"<>]+$/i.test(l.url.trim())).slice(0,6)
      .map(l=>{const e={title:str(l.title,80,l.url.trim()),url:l.url.trim()};const src=str(l.source,60);if(src)e.source=src;return e});
    if(links.length)o.learn.push({topic:str(t.topic,40,'Read more'),links})}
  o.changes=(Array.isArray(s.changes)?s.changes:[]).map(c=>str(c,300)).filter(Boolean).slice(0,40);
  if(!o.changes.length)o.changes=['First version, made with HTML App Generator '+GEN_VERSION+'.'];
  o.credits=(Array.isArray(s.credits)?s.credits:[]).map(c=>str(c,300)).filter(Boolean).slice(0,20);
  o.homeUrl=typeof s.homeUrl==='string'&&/^https:\/\/[^\s"<>]+$/i.test(s.homeUrl.trim())?s.homeUrl.trim():'';
  if(s.homeUrl&&!o.homeUrl)notes.push('The web address must start with https://, so it is left out.');
  o.oldCodes=[...new Set((Array.isArray(s.oldCodes)?s.oldCodes:[]).map(c=>String(c).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)).filter(c=>c.length>=2&&c!==o.code))].slice(0,8);
  o.key=o.code.toLowerCase()+':';o.oldKeys=o.oldCodes.map(c=>c.toLowerCase()+':');
  o.ext='.'+o.code.toLowerCase()+'.json';
  o.core=CORE_VERSION;o.generator=GEN_VERSION;
  return{spec:o,notes};
}
/* a starting palette of 16 everyday colours (picked for this generator, not taken from any maker's chart) */
const BASIC=[['White','#FFFFFF'],['Light grey','#C8CCD2'],['Dark grey','#5E636B'],['Black','#15171B'],['Red','#D7262E'],['Orange','#F07D1A'],
  ['Yellow','#F6CF2A'],['Lime','#9BCB3C'],['Green','#2E9A4B'],['Teal','#138C8C'],['Light blue','#6CB8E6'],['Blue','#2457B8'],
  ['Purple','#6E3FA3'],['Pink','#EE8CB4'],['Tan','#D9B98C'],['Brown','#7A4A2A']].map(([name,hex])=>({name,hex}));

/* ---------- templates: {{name}} is escaped text, {{{name}}} is markup, <!--if:flag-->…<!--/if:flag--> keeps or drops a block ---------- */
function tpl(src,vars,flags){
  let s=src,prev;
  do{prev=s;s=s.replace(/<!--if:(!?)(\w+)-->([\s\S]*?)<!--\/if:\1\2-->/g,(m,neg,f,body)=>(!!flags[f])!==!!neg?body:'')}while(s!==prev);
  return s.replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}/g,(m,raw,e)=>raw?(vars[raw]==null?'':String(vars[raw])):esc(vars[e]==null?'':vars[e]));
}
/* panels.html holds several parts, each after <!--part:name--> */
function parts(src){const o={};src.split(/<!--part:(\w+)-->\n?/).forEach((t,i,a)=>{if(i%2)o[t]=a[i+1]});return o}

const STARTER_CODE=code=>`
/* ${code}'s own code. Everything between the APP CODE markers is kept when the generator upgrades the core.
   It runs once, before start-up, so read settings (st) inside functions and hooks, not at the top level.
   Hooks (all optional):
     APP.describe = (x, y, c) => ({name, where})   the readout for a tapped cell (c is a palette number, -1 if empty)
     APP.cellSvg = cell => 'svg markup'            how one cell is drawn; cell.cx, cell.cy is its centre, 1 is one cell wide
     APP.cellPaint = (g, cell, u) => {}            the same for Save picture, on a canvas with u pixels per cell
     APP.lists.push({id, label, ext, make})        more lists under Export; make() returns the text
     APP.onPattern = p => {}                       change the pattern after every rebuild (p.W, p.H, p.c = palette numbers)
     APP.onSync, APP.onRefresh, APP.onStart        keep your controls in step, after each redraw, once at start-up
     APP.projectOut = () => data, APP.projectIn = data => {}   your own data in project files (tidy what you read)
   Your own settings: addSettings({mine:{on:false}}) here, then <input type="checkbox" data-k="mine.on"> in APP PANELS.
   Helpers: $, esc, clamp, plural, units, txt, say, store (keys start with KEY), saveFile, csv, watch, rebuild, sync, refresh. */
`;

/* ---------- the app ---------- */
function generate(specIn,files,regions){
  const {spec,notes}=tidySpec(specIn),F=spec.features,R=regions||{};
  const need=n=>{if(typeof files[n]!=='string')throw new Error('The generator is missing its file '+n+'.');return files[n]};
  const flags={...F,boards:spec.boards.length>0,manyBoards:spec.boards.length>1};
  const One=spec.unit.one[0].toUpperCase()+spec.unit.one.slice(1);
  const vars={one:spec.unit.one,many:spec.unit.many,One,code:spec.code,name:spec.name,minW:spec.grid.minW,maxW:spec.grid.maxW,
    allColours:spec.palette.length,exts:[spec.ext,...spec.oldCodes.map(c=>'.'+c.toLowerCase()+'.json')].join(','),
    boardSeg:spec.boards.length>3?' four':'',
    boardButtons:spec.boards.map(b=>`<button type="button" data-k="size.board" data-v="${esc(b.id)}">${esc(b.name)}</button>`).join(''),
    setButtons:spec.sets.map((t,i)=>`<button type="button" class="btn sm" data-pset="${i}">${esc(t.name)}</button>`).join('')};
  vars.size=tpl(need('html/size.html'),vars,flags);
  const P=parts(need('html/panels.html')),part=n=>tpl(P[n],vars,flags);
  /* the app's own regions: kept as they are (only a closing tag that would end the block early is made safe) */
  const region=(k,text)=>{const[a,b]=MARK[k];let t=typeof text==='string'?text:'';
    t=k==='code'?t.replace(/<\/script/gi,'<\\/script').replace(/<!--/g,'<\\!--'):k==='css'?t.replace(/<\/style/gi,'<\\/style'):t;
    return a+(t.startsWith('\n')?'':'\n')+t+(t.endsWith('\n')?'':'\n')+b};
  const hasRegions=R&&typeof R.code==='string';
  const code=hasRegions?R.code:STARTER_CODE(spec.code);
  const panels=hasRegions?(R.panels||''):(F.board?'':part('starterPanel'));
  const accentDark=spec.accentDark||lighten(spec.accent,0.35);
  const theme=`:root{--accent:${spec.accent};--accent-ink:${inkFor(spec.accent)}}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--accent:${accentDark};--accent-ink:${inkFor(accentDark)}}}
:root[data-theme="dark"]{--accent:${accentDark};--accent-ink:${inkFor(accentDark)}}`;
  const icon=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${spec.accent}"/><text x="32" y="${spec.code.length>3?39:42}" font-family="system-ui,sans-serif" font-size="${spec.code.length>3?18:24}" font-weight="800" text-anchor="middle" fill="${inkFor(spec.accent)}">${esc(spec.code.slice(0,4))}</text></svg>`;
  const js=MODULES.filter(m=>m==='base'||m==='home'||F[m]).map(m=>need('core/'+m+'.js').trim()).join('\n\n');
  const json=JSON.stringify(spec,null,1).replace(/</g,'\\u003c');
  const controls=[
    F.project?'':part('saveWarn'),
    F.picture?tpl(need('html/picture.html'),vars,flags):F.board?part('sizeGroup'):'',
    '    '+region('panels',panels),
    F.progress?part('progress'):'',F.project?part('project'):'',F.export?part('export'):'',part('info')].filter(Boolean).join('');
  const html=`<!DOCTYPE html>
<html lang="en" class="nojs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="${spec.accent}">
<meta name="generator" content="HTML App Generator ${GEN_VERSION}">
<title>${esc(spec.code+': '+spec.name)}</title>
<script>document.documentElement.classList.remove('nojs')/* scripts run, so the app shows instead of the preview note */</script>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">
<script type="application/json" id="app-spec">
${json}
</script>
<style>
/* ==== CORE CSS: made by HTML App Generator ${GEN_VERSION} (core ${CORE_VERSION}). Upgrade it with the generator rather than editing it here. ==== */
${need('core/core.css').trim()}
/* ---- ${spec.code}'s accent colours (from the spec) ---- */
${theme}
${region('css',hasRegions?R.css:'')}
</style>
</head>
<body>
<div class="nojs-note" id="nojsNote"><p><b>This is only a preview, so ${esc(spec.code)} can’t run here.</b></p><p>${spec.homeUrl?`To use it, open this link in Safari or Chrome: <a href="${esc(spec.homeUrl)}">${esc(spec.homeUrl)}</a>`:'To use it, open this file in a web browser on a computer, such as Chrome, Edge, Safari or Firefox.'}</p></div>
<header>
  <h1 id="appTitle">${esc(spec.code+': '+spec.name)}</h1>
  <p id="appTag">${esc(spec.tagline)}</p>
</header>
<main class="wrap${F.board?'':' solo'}">
${F.board?tpl(need('html/stage.html'),{...vars,appStage:'    '+region('stage',hasRegions?R.stage:'')},flags):''}  <div class="controls${F.board?'':' solo'}">
${controls}  </div>
</main>
<p class="foot">${esc(spec.code)} ${esc(spec.version)}, made with HTML App Generator ${GEN_VERSION}. One file, no server: everything stays in this browser.</p>
<div id="sr" class="sr" aria-live="polite"></div>
<script>
/* ${spec.code}: ${spec.name} ${spec.version}. Made with HTML App Generator ${GEN_VERSION} (core ${CORE_VERSION}).
   The core parts below are shared by every app the generator makes; the app's own code is between the APP CODE markers. */
(()=>{
'use strict';
const HAS=${JSON.stringify(F)};
${js}

${region('code',code)}

start();
})();
</script>
</body>
</html>
`;
  return{html,spec,notes};
}

/* ---------- reading an app back, to upgrade it ---------- */
function between(html,[a,b]){const i=html.indexOf(a);if(i<0)return null;const j=html.indexOf(b,i+a.length);if(j<0)return null;
  let t=html.slice(i+a.length,j);if(t.startsWith('\n'))t=t.slice(1);if(t.endsWith('\n'))t=t.slice(0,-1);return t}
function readApp(html){
  if(typeof html!=='string')return{error:'That file could not be read.'};
  const m=html.match(/<script type="application\/json" id="app-spec">([\s\S]*?)<\/script>/);
  if(!m)return{error:'That file wasn’t made by HTML App Generator, so there is no spec in it to read.'};
  let spec;try{spec=JSON.parse(m[1])}catch(e){return{error:'The spec in that file is damaged, so it can’t be read.'}}
  const regions={};for(const k in MARK){const t=between(html,MARK[k]);regions[k]=t==null?'':k==='code'?t.replace(/<\\\/script/gi,'</script').replace(/<\\!--/g,'<!--'):k==='css'?t.replace(/<\\\/style/gi,'</style'):t}
  if(between(html,MARK.code)==null)return{error:'That file has a spec but no APP CODE markers, so its own code can’t be found.'};
  return{spec,regions,core:spec.core||'?'};
}

/* ---------- the house rules, shared by both briefs (and by HOUSE-RULES.md in the kit) ---------- */
const RULES=spec=>[
  'One file, no server, no network calls, no outside code, fonts or pictures. It must run by itself in any modern browser, with no AI or account needed.',
  'Don\u2019t use other apps\u2019 code, assets or colour lists unless they are explicitly offered free, and credit them.',
  `Everything stays in the browser. Use store.get and store.set with keys starting with KEY ("${spec.key}"). Storage is best effort, and the app already warns when the browser isn\u2019t keeping work.`,
  'Save files with saveFile(name, blob, messageElement): it uses the host\u2019s download prompt where there is one (as inside Claude) and an ordinary download everywhere else.',
  'Phone first: works at 380 px wide, touch targets at least 44 px, nothing that needs hover. Light and dark mode both work.',
  'Plain words in the interface. Every control has a label. Changes are announced with say(). The keyboard works on the grid.',
  `Project files (${spec.ext}) keep opening after changes: new fields get defaults, and everything read from a file or from storage is tidied.`,
  'Each version updates the app-spec block: version, date, a line in "changes", any credits, and "learn" links for new ideas.',
  'Phones and tablets open the app from its web address (the spec\u2019s homeUrl), not from a file. Keep the Home Screen helper (homeHint) and the preview note working.',
  'Test before publishing: phone and desktop sizes, light and dark mode, no console errors. An independent review by a different AI is welcome.'];

/* ---------- the build brief: what to tell an AI (Claude, ChatGPT, Gemini, Qwen or any other) when it adds the app's own features ---------- */
function brief(specIn){
  const {spec}=tidySpec(specIn),F=spec.features,on=FEATURES.filter(f=>F[f]);
  return`I'm building ${spec.code}: ${spec.name} (version ${spec.version}), a single-file HTML app made with HTML App Generator ${GEN_VERSION} (core ${CORE_VERSION}). The file is attached. You may be any AI assistant: nothing here depends on a particular one. It is a sister app of FIG (Fusebead Image Generator) and BIG (Brick Image Generator) and shares their core.

What I want next:
[Describe the feature or change here.]

How the file is laid out:
- The app spec (name, version, colours, sizes, words for a cell, learn links, changes, credits) is the JSON block with id "app-spec" at the top. The page reads it at start-up.
- The core parts it uses: ${on.join(', ')||'base only'}. They are shared by every app the generator makes. Don't edit them in this file. If a core change is needed, write it up separately so it can go into the generator for all the apps.
- The app's own work goes only between the markers: APP CSS (styles), APP STAGE (under the grid), APP PANELS (panels in the side column) and APP CODE (script). The generator keeps these when it upgrades the core.
- The hooks and helpers are listed in the comment at the top of APP CODE.

House rules (the same ones FIG and BIG follow):
${RULES(spec).map(r=>'- '+r).join('\n')}

Before handing the file back, test it on a phone-sized and a desktop-sized window with no errors in the console, and say what you tested.`;
}

/* ---------- the test brief: for an independent reviewer, ideally a different AI from the one that built the app ---------- */
function testBrief(specIn){
  const {spec}=tidySpec(specIn),F=spec.features,u=spec.unit;
  const checks=['Opens with no errors in the console, on a phone-sized (390 px) and a desktop-sized window, in light and dark mode.',
    'Makes no network requests and loads nothing from outside: search the file for fetch, XMLHttpRequest, WebSocket, <script src, <link href, @import and url(http. Only the Learn the ideas links may point to the web.',
    'Every control has a label or aria-label; messages that change are in aria-live areas; focus outlines show; touch targets are at least 44 px.',
    'Text from files, storage or the spec is escaped before it goes into the page (esc), and CSV lists guard against spreadsheet formulas (csv).',
    `The core parts match HTML App Generator core ${CORE_VERSION}: the app's own work should only be in the APP CSS, APP STAGE, APP PANELS and APP CODE sections. Flag any edit to the core.`];
  if(F.board)checks.push(`The grid: zoom in, out and Fit; tapping a ${u.one} in Inspect shows its colour and place; the arrow keys move the selection.`+(spec.boards.length?' Adding and removing boards across and down changes the size and the readout.':' The width slider changes the size.'));
  if(F.picture)checks.push('Picture to grid: choose a photo, a pixel-art picture with transparent pixels, and a file that isn\u2019t a picture (a clear message, no crash). Try every step: crop and auto-trim, background (and picking its colour), adjustments, leaving colours out and Max colours, each Match by and Sample by choice, each dithering choice, clean-up. Paste a picture too.');
  if(F.edit)checks.push(`Editing: paint a line by dragging, fill, erase, pick; undo and redo; clear all edits and undo that. Edits stay after changing a picture setting.`);
  if(F.progress)checks.push(`Progress: Mark placed ticks a ${u.one} and the count goes up; tapping a colour in the legend shows only that colour; Mark all placed and Clear; Reset progress needs a second tap.`);
  if(F.project)checks.push(`Project files: save one (${spec.ext}), reload the page, open it: everything comes back. Also open a damaged file, an empty file and a file from another app: each gives a clear message and nothing breaks.`);
  if(F.export)checks.push('Export: Save picture gives a PNG; each list shows, copies and saves.');
  checks.push('The work is still there after reloading the page; if storage is blocked (private window), the app says it isn\u2019t keeping work.');
  checks.push(`On a phone, from the web address${spec.homeUrl?' ('+spec.homeUrl+')':''}: a card shows the taps that put the app on the Home Screen (Share, Add to Home Screen, Add on iPhone and iPad), "Not now" hides it, and On your phone keeps the steps. With scripts turned off (as in a phone\u2019s file preview), only a note with the web address shows.`);
  return`Please test ${spec.code}: ${spec.name} (version ${spec.version}), a single-file HTML app (attached), made with HTML App Generator ${GEN_VERSION}.
Another AI may have built or changed it. You are the independent tester: check it against the rules and the checklist below rather than trusting it, and don't change the file. Report what you find.

If you can run code or a browser, open the file and try it. If you can't, read the code, and mark the checks you could only judge by reading.

About the app: a ${u.one} is one cell of the grid; parts included: ${FEATURES.filter(f=>F[f]).join(', ')||'base only'}; ${spec.palette.length} colours${spec.boards.length?'; boards: '+spec.boards.map(b=>b.name).join(', '):''}.

House rules it must follow:
${RULES(spec).map(r=>'- '+r).join('\n')}

Checks:
${checks.map((c,i)=>(i+1)+'. '+c).join('\n')}

Report in this form:
1. Verdict: ready to publish, or fix first.
2. A table with one row per check: number, pass / fail / couldn't test, and a short note.
3. Problems, most serious first: what goes wrong, how to make it happen, where in the file (the section and a short quote of the code), and a suggested fix.
Be specific and brief. Don't list things that work unless the table needs them.`;
}

/* ---------- plain-text forms of the list fields, for the generator page ---------- */
const lines=t=>String(t||'').split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
const text={
  palette:{read:t=>lines(t).map(l=>{const p=l.split(',').map(x=>x.trim());return{name:p[0],hex:(p[1]||'').toUpperCase(),code:p[2]||''}}),
    write:a=>a.map(c=>[c.name,c.hex].concat(c.code?[c.code]:[]).join(', ')).join('\n')},
  boards:{read:t=>lines(t).map(l=>{const m=l.match(/^(.*?)[,:]?\s*(\d+)\s*[x×*]\s*(\d+)\s*$/i);return m?{name:m[1].trim()||`${m[2]} × ${m[3]}`,w:+m[2],h:+m[3]}:null}).filter(Boolean),
    write:a=>a.map(b=>`${b.name}, ${b.w} × ${b.h}`).join('\n')},
  sets:{read:t=>lines(t).map(l=>{const i=l.indexOf(':');return i<0?null:{name:l.slice(0,i).trim(),colours:l.slice(i+1).split(',').map(x=>x.trim()).filter(Boolean)}}).filter(Boolean),
    write:a=>a.map(s=>s.name+': '+s.colours.join(', ')).join('\n')},
  learn:{read:t=>{const by=new Map();for(const l of lines(t)){const p=l.split('|').map(x=>x.trim());if(p.length<3)continue;
      if(!by.has(p[0]))by.set(p[0],[]);by.get(p[0]).push({title:p[1],url:p[2],source:p[3]||''})}return[...by].map(([topic,links])=>({topic,links}))},
    write:a=>a.flatMap(t=>t.links.map(l=>[t.topic,l.title,l.url].concat(l.source?[l.source]:[]).join(' | '))).join('\n')},
  list:{read:t=>lines(t),write:a=>a.join('\n')}};

const api={GEN_VERSION,CORE_VERSION,MODULES,FEATURES,SHAPES,BASIC,MARK,tidySpec,generate,readApp,brief,testBrief,RULES,text,
  coreFiles:['core/base.js','core/home.js','core/board.js','core/picture.js','core/edit.js','core/progress.js','core/project.js','core/export.js','core/core.css','html/stage.html','html/size.html','html/picture.html','html/panels.html']};
root.AppGen=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
