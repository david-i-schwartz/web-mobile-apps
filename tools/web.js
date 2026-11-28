/* Web folders: what an app needs to live at a web address and go on a phone's Home Screen.
   webFolder(html, info) -> {files: {name: text}, icons: [{name, size}]}   index.html, manifest.webmanifest, sw.js (+ icons to draw)
   iconPixels(size, code, accent) -> RGBA pixels of a bead-letter icon      (Node turns them into PNG with pngFrom; the page uses a canvas)
   siteIconPixels(size, accent) -> RGBA pixels of the front page's icon: a 3 x 3 grid of beads (SITE_ICONS lists the files)
   siteIndex(site, apps) -> the front page listing the apps (grouped under headings when site.sections is set)
   groupApps(sections, apps) -> [{name, id, blurb, apps}] for those headings
   zip(files) -> a .zip (stored, not compressed) of [{name, data: Uint8Array}]
   Works for apps the generator made and for apps it didn't (FIG, BIG): those get the Home Screen helper added. */
(function(root){
'use strict';
const G=root.AppGen||(typeof require!=='undefined'?require('./generate.js'):null);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rgbOf=h=>{const n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]};
const lum=h=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};const[r,g,b]=rgbOf(h);return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)};
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};
const inkFor=h=>{const d='#'+rgbOf(h).map(v=>Math.round(v*0.16).toString(16).padStart(2,'0')).join('');return contrast(h,'#FFFFFF')>=contrast(h,d)?'#FFFFFF':d};
const hash=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}return(h>>>0).toString(36)};

/* ---------- icons: the app's short name in beads, on its accent colour. A 5 x 7 letter shape drawn for this kit ---------- */
const FONT={A:'01110100011000111111100011000110001',B:'11110100011000111110100011000111110',C:'01110100011000010000100001000101110',D:'11110100011000110001100011000111110',
  E:'11111100001000011110100001000011111',F:'11111100001000011110100001000010000',G:'01110100011000010111100011000101111',H:'10001100011000111111100011000110001',
  I:'01110001000010000100001000010001110',J:'00111000100001000010000101001001100',K:'10001100101010011000101001001010001',L:'10000100001000010000100001000011111',
  M:'10001110111010110101100011000110001',N:'10001100011100110101100111000110001',O:'01110100011000110001100011000101110',P:'11110100011000111110100001000010000',
  Q:'01110100011000110001101011001001101',R:'11110100011000111110101001001010001',S:'01111100001000001110000010000111110',T:'11111001000010000100001000010000100',
  U:'10001100011000110001100011000101110',V:'10001100011000110001100010101000100',W:'10001100011000110101101011010101010',X:'10001100010101000100010101000110001',
  Y:'10001100010101000100001000010000100',Z:'11111000010001000100010001000011111','0':'01110100011001110101110011000101110','1':'00100011000010000100001000010001110',
  '2':'01110100010000100010001000100011111','3':'11111000100010000010000011000101110','4':'00010001100101010010111110001000010','5':'11111100001111000001000011000101110',
  '6':'00110010001000011110100011000101110','7':'11111000010001000100010000100001000','8':'01110100011000101110100011000101110','9':'01110100011000101111000010001001100'};
function iconBase(size,accent){
  const px=new Uint8ClampedArray(size*size*4),bg=rgbOf(accent);
  for(let i=0;i<size*size;i++){px[i*4]=bg[0];px[i*4+1]=bg[1];px[i*4+2]=bg[2];px[i*4+3]=255}
  return px;
}
function bead(px,size,ink,cx,cy,R,H){   /* a bead: a disc with a hole, with soft edges */
  for(let y=Math.max(0,Math.floor(cy-R-1));y<=Math.min(size-1,Math.ceil(cy+R+1));y++)for(let x=Math.max(0,Math.floor(cx-R-1));x<=Math.min(size-1,Math.ceil(cx+R+1));x++){
    const d=Math.hypot(x+0.5-cx,y+0.5-cy),a=Math.max(0,Math.min(1,R+0.5-d))-Math.max(0,Math.min(1,H+0.5-d));if(a<=0)continue;
    const k=(y*size+x)*4;for(let c=0;c<3;c++)px[k+c]=Math.round(px[k+c]*(1-a)+ink[c]*a)}
}
function iconPixels(size,code,accent){
  const px=iconBase(size,accent),ink=rgbOf(inkFor(accent));
  const chars=String(code).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4).split('').filter(c=>FONT[c]);
  if(!chars.length)return px;
  const cols=chars.length*6-1,cell=Math.min(size*0.74/cols,size*0.56/7),ox=(size-cols*cell)/2,oy=(size-7*cell)/2,R=0.47*cell,H=0.15*cell;
  chars.forEach((ch,i)=>{const f=FONT[ch];for(let r=0;r<7;r++)for(let c=0;c<5;c++)if(f[r*5+c]==='1')bead(px,size,ink,ox+(i*6+c+0.5)*cell,oy+(r+0.5)*cell,R,H)});
  return px;
}
/* the front page's own icon, so it doesn't borrow an app's: nine beads in a 3 x 3 grid (the usual "apps" sign) on the
   site's accent colour. It stays inside the middle 80% circle, so Android can crop it to any shape. */
function siteIconPixels(size,accent){
  const px=iconBase(size,accent),ink=rgbOf(inkFor(accent)),step=0.2*size,R=0.075*size,H=0.024*size;
  for(let r=-1;r<=1;r++)for(let c=-1;c<=1;c++)bead(px,size,ink,size/2+c*step,size/2+r*step,R,H);
  return px;
}
/* ---------- PNG and ZIP, small and dependency-free (PNG compression comes from Node's zlib, passed in) ---------- */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0};
function pngFrom(px,size,deflate){
  const raw=new Uint8Array(size*(size*4+1));for(let y=0;y<size;y++){raw[y*(size*4+1)]=0;raw.set(px.subarray(y*size*4,(y+1)*size*4),y*(size*4+1)+1)}
  const chunk=(type,data)=>{const b=new Uint8Array(12+data.length),v=new DataView(b.buffer);v.setUint32(0,data.length);for(let i=0;i<4;i++)b[4+i]=type.charCodeAt(i);
    b.set(data,8);v.setUint32(8+data.length,crc32(b.subarray(4,8+data.length)));return b};
  const ih=new Uint8Array(13),iv=new DataView(ih.buffer);iv.setUint32(0,size);iv.setUint32(4,size);ih[8]=8;ih[9]=6;
  const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',new Uint8Array(deflate(raw))),chunk('IEND',new Uint8Array(0))];
  const out=new Uint8Array(parts.reduce((a,p)=>a+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out;
}
const utf8=s=>new TextEncoder().encode(s);
function zip(files){
  const d=new Date(),time=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),date=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  const local=[],central=[];let off=0;
  for(const f of files){
    const name=utf8(f.name),data=typeof f.data==='string'?utf8(f.data):f.data,crc=crc32(data);
    const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(8,0,true);v.setUint16(10,time,true);v.setUint16(12,date,true);
    v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);h.set(name,30);
    const c=new Uint8Array(46+name.length),w=new DataView(c.buffer);
    w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x0800,true);w.setUint16(12,time,true);w.setUint16(14,date,true);
    w.setUint32(16,crc,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(42,off,true);c.set(name,46);
    local.push(h,data);central.push(c);off+=h.length+data.length;
  }
  const size=central.reduce((a,c)=>a+c.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,off,true);
  const all=[...local,...central,end],out=new Uint8Array(all.reduce((a,p)=>a+p.length,0));let o=0;for(const p of all){out.set(p,o);o+=p.length}return out;
}

/* ---------- what an app is called and how it looks, from its spec or from its page ---------- */
function infoOf(html,given){
  const r=G.readApp(html),g=given||{};
  if(!r.error){const s=r.spec;return{generated:true,spec:s,code:g.code||s.code,name:g.name||s.name,tagline:g.tagline||s.tagline,accent:g.accent||s.accent,url:g.url||s.homeUrl||''}}
  const t=(html.match(/<title>([^<]*)<\/title>/)||[])[1]||'';const m=t.match(/^\s*([A-Z0-9]{2,6}):\s*(.+)$/);
  const ac=(html.match(/--accent:\s*(#[0-9a-fA-F]{6})/)||[])[1]||'#0E7C7B';
  const tag=((html.match(/<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/)||[])[1]||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
  return{generated:false,code:g.code||(m?m[1]:'APP'),name:g.name||(m?m[2].trim():t.trim()||'App'),tagline:g.tagline||tag,accent:(g.accent||ac).toUpperCase(),url:g.url||''};
}

/* ---------- one app's web folder ---------- */
const HOME_JS_NAME='core/home.js';
function webFolder(html,given,files){
  const info=infoOf(html,given),ink=inkFor(info.accent);
  const head=`<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-title" content="${esc(info.code)}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
`;
  /* apps the generator didn't make get the Home Screen helper; script text is made safe for a <script> block */
  const mark='hh-'+'helper';   /* written in two parts so this file, embedded in the generator page, never looks like a page that has it */
  const helper=info.generated||html.includes(`id="${mark}"`)?'':`<script id="${mark}">/* Home Screen helper from HTML App Generator ${G.GEN_VERSION} */
(function(){${files[HOME_JS_NAME].replace(/<\/script/gi,'<\\/script').replace(/<!--/g,'<\\!--')}
homeHint({code:${JSON.stringify(info.code)},name:${JSON.stringify(info.name)},url:${JSON.stringify(info.url)},key:${JSON.stringify(info.code.toLowerCase()+':')}});})();
</script>
`;
  /* a site with a launcher (DIS) tells each app where it is, so the Home Screen helper can offer it and lead back to it */
  const hub=given&&given.hub?`<script>window.HOME_HUB=${JSON.stringify(given.hub).replace(/</g,'\\u003c')};</script>\n`:'';
  const sw=`<script>if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(function(){});</script>\n`;
  let page=html;
  page=page.includes('</head>')?page.replace('</head>',head+hub+'</head>'):head+hub+page;
  const at=page.lastIndexOf('</body>');page=at<0?page+helper+sw:page.slice(0,at)+helper+sw+page.slice(at);
  const manifest={name:`${info.code}: ${info.name}`,short_name:info.code,description:info.tagline||undefined,start_url:'./',scope:'./',display:'standalone',
    background_color:'#F3F5F8',theme_color:info.accent,icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png'},
    {src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]};
  const cache=info.code.toLowerCase()+'-'+hash(page);
  const swText=`/* ${info.code}'s offline helper: keeps a copy so the Home Screen app opens without a connection, and fetches new versions when online. */
const CACHE='${cache}',FILES=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k.startsWith('${info.code.toLowerCase()}-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
});
`;
  return{info,ink,files:{'index.html':page,'manifest.webmanifest':JSON.stringify(manifest,null,2),'sw.js':swText},
    icons:[{name:'icon-192.png',size:192},{name:'icon-512.png',size:512},{name:'apple-touch-icon.png',size:180}]};
}

/* ---------- sections: site.json can list "sections" ([{name, blurb}] or names) and give each app a "section" (a name, or a
   list of names to show it in more than one). Returns [{name, id, blurb, apps}] in the sections' order, empty sections left
   out, and apps with no known section last under "More Apps". With no sections listed it returns [] (one plain list). ---------- */
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'section';
function groupApps(sections,apps){
  const named=(sections||[]).map(s=>typeof s==='string'?{name:s}:s).filter(s=>s&&String(s.name||'').trim());
  if(!named.length)return[];
  const secsOf=a=>[].concat(a.section||[]).map(s=>String(s).trim()).filter(Boolean),known=new Set(named.map(s=>String(s.name).trim()));
  const groups=named.map(s=>{const name=String(s.name).trim();return{name,id:slug(name),blurb:s.blurb||'',apps:apps.filter(a=>secsOf(a).includes(name))}});
  const rest=apps.filter(a=>!secsOf(a).some(n=>known.has(n)));
  if(rest.length)groups.push({name:'More Apps',id:'more-apps',blurb:'',apps:rest});
  return groups.filter(g=>g.apps.length);
}

/* ---------- DIS: the front page as a launcher (site.json "app": {name, short, version, date, changes}) ----------
   Added to the Home Screen once, it opens every app inside it. Everything here stays on the device: settings are kept
   under dis: keys, and a saves file is made and read in the browser. */
function device(app,apps){
  const opts=apps.map(a=>`<option value="${esc(a.folder)}">${esc(a.code)}: ${esc(a.name)}</option>`).join('');
  return`  <section class="dis" aria-label="On this device">
    <details class="group" id="dis-device" data-ui="device">
      <summary><h2>Your Saves and Settings</h2></summary>
      <p class="sub">These stay on this device. A Home Screen icon keeps its own saves and settings, apart from Safari’s, so do this in the place you play.</p>
      <h3><label for="disStart">Start Straight In</label></h3>
      <p class="sub">Open one app as soon as ${esc(app.short)} starts from the Home Screen, for example on a child’s phone. Its ‹ ${esc(app.short)} button, at the top left, still brings you here.</p>
      <div class="row"><select id="disStart"><option value="">No, show the list of apps</option>${opts}</select></div>
      <p class="msg sub" id="disStartMsg" role="status"></p>
      <h3>Back Up My Saves</h3>
      <p class="sub">Puts every app’s saved games and settings on this device into one file. Restore it in ${esc(app.short)} on the Home Screen, or on another phone, to carry on there. Torah Tutor lessons aren’t included: keep their lesson files.</p>
      <div class="row"><button type="button" class="btn primary" id="disBackup">Back Up My Saves</button></div>
      <p class="msg sub" id="disBackupMsg" role="status"></p>
      <h3>Restore</h3>
      <div class="row"><label class="btn pick">Choose a Saves File<input type="file" id="disFile" accept=".json,application/json"></label></div>
      <div class="row" id="disConfirm" hidden><button type="button" class="btn primary" id="disRestore">Restore</button><button type="button" class="btn" id="disCancel">Cancel</button></div>
      <p class="msg sub" id="disRestoreMsg" role="status"></p>
    </details>
    <details class="group" id="dis-about" data-ui="about">
      <summary><h2>About This Version</h2></summary>
      <p><b>${esc(app.short)} ${esc(app.version||'')}</b>${app.date?', '+esc(app.date):''}. ${esc(app.changes||'')}</p>
      <p class="sub">${esc(app.short)} is ${esc(app.name)}, made by Dave Schwartz with Claude.</p>
    </details>
  </section>`;
}
const LAUNCHER_JS=String.raw`
  var ua=navigator.userAgent||'',iosD=/iPad|iPhone|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
  var standalone=navigator.standalone===true;try{standalone=standalone||matchMedia('(display-mode: standalone)').matches}catch(x){}
  var get=function(k){try{return localStorage.getItem(k)}catch(x){return null}},put=function(k,v){try{localStorage.setItem(k,v);return true}catch(x){return false}};
  if(standalone)try{sessionStorage.setItem('dis:in','1')}catch(x){}
  var folders=[].map.call(document.querySelectorAll('.app'),function(a){return a.getAttribute('href').replace(/\/$/,'')});
  /* Start Straight In: only when opened from the Home Screen, once per launch, and never when ?stay is in the address */
  var start=get('dis:start');
  if(standalone&&start&&folders.indexOf(start)>=0&&!/[?&]stay\b/.test(location.search)){
    var once=null;try{once=sessionStorage.getItem('dis:started')}catch(x){}
    if(!once){try{sessionStorage.setItem('dis:started','1')}catch(x){}location.replace(start+'/');return}
  }
  var $=function(id){return document.getElementById(id)};
  var sel=$('disStart');if(sel){if(folders.indexOf(start)>=0)sel.value=start;
    sel.addEventListener('change',function(){var ok=sel.value?put('dis:start',sel.value):(function(){try{localStorage.removeItem('dis:start');return true}catch(x){return false}})();
      $('disStartMsg').textContent=!ok?'This browser isn’t keeping settings, so this won’t be remembered.':sel.value?'Saved. Next time DIS starts from the Home Screen, it opens '+sel.options[sel.selectedIndex].text+'.':'Saved. DIS will open on the list of apps.';
      try{sessionStorage.setItem('dis:started','1')}catch(x){}})}
  /* Back Up My Saves: every localStorage key on this site, in one file */
  var stamp=function(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  var bk=$('disBackup');if(bk)bk.addEventListener('click',function(){
    var m=$('disBackupMsg'),saves={},n=0;
    try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);saves[k]=localStorage.getItem(k);n++}}catch(x){m.textContent='This browser isn’t letting DIS read saves, so there’s nothing to back up.';return}
    var name='dis-saves-'+stamp()+'.json',blob=new Blob([JSON.stringify({kind:'dis-saves',version:1,made:new Date().toISOString(),saves:saves},null,1)],{type:'application/json'});
    var done=function(){m.textContent='Saved '+n+' item'+(n===1?'':'s')+' as '+name+'.'+(iosD?' It’s in Files, in Downloads, unless you chose somewhere else.':'')};
    var file=null;try{file=new File([blob],name,{type:'application/json'})}catch(x){}
    if(iosD&&file&&navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:name}).then(function(){m.textContent='Saved '+n+' item'+(n===1?'':'s')+' in '+name+'. Choose Save to Files if you haven’t.'},function(e){if(e&&e.name==='AbortError')m.textContent='Not saved.';else download()});return}
    download();
    function download(){var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);done()}
  });
  /* Restore: read the file here, check it, and ask before writing */
  var pending=null,f=$('disFile');if(f)f.addEventListener('change',function(){
    var m=$('disRestoreMsg'),file=f.files&&f.files[0];pending=null;$('disConfirm').hidden=true;if(!file)return;
    file.text().then(function(t){
      var o=null;try{o=JSON.parse(t)}catch(x){}
      var s=o&&o.kind==='dis-saves'&&o.saves&&typeof o.saves==='object'&&!Array.isArray(o.saves)?o.saves:null,clean={},n=0;
      if(s)for(var k in s)if(Object.prototype.hasOwnProperty.call(s,k)&&typeof s[k]==='string'&&k.length<=200){clean[k]=s[k];n++}
      if(!n){m.textContent='That isn’t a DIS saves file, or it’s empty. Nothing was changed.';f.value='';return}
      pending=clean;var when=new Date(o.made);
      m.textContent='This file has '+n+' saved item'+(n===1?'':'s')+(isNaN(when)?'':', made '+when.toLocaleDateString())+'. Restoring replaces saves with the same names on this device.';
      $('disConfirm').hidden=false;$('disRestore').focus();
    },function(){m.textContent='Couldn’t read that file. Nothing was changed.'});
  });
  var rs=$('disRestore');if(rs)rs.addEventListener('click',function(){
    if(!pending)return;var ok=0,bad=0;for(var k in pending){if(put(k,pending[k]))ok++;else bad++}
    pending=null;$('disConfirm').hidden=true;f.value='';
    $('disRestoreMsg').textContent='Restored '+ok+' item'+(ok===1?'':'s')+'.'+(bad?' '+bad+' didn’t fit: this browser is out of room.':'')+' Open an app to carry on.';
  });
  var cn=$('disCancel');if(cn)cn.addEventListener('click',function(){pending=null;$('disConfirm').hidden=true;f.value='';$('disRestoreMsg').textContent='Nothing was changed.'});
  /* Android: Chrome's own install prompt, as a button */
  var prompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();prompt=e;$('installRow').hidden=standalone});
  var ib=$('installBtn');if(ib)ib.addEventListener('click',function(){if(!prompt)return;prompt.prompt();prompt.userChoice.then(function(){$('installRow').hidden=true;prompt=null},function(){})});
  window.addEventListener('appinstalled',function(){$('installRow').hidden=true});
  /* the folding sections stay as you left them */
  var ui={};try{ui=JSON.parse(get('dis:ui')||'{}')||{}}catch(x){ui={}}if(typeof ui!=='object'||Array.isArray(ui))ui={};
  [].forEach.call(document.querySelectorAll('.dis details[data-ui]'),function(el){var k=el.getAttribute('data-ui');if(typeof ui[k]==='boolean')el.open=ui[k];
    el.addEventListener('toggle',function(){ui[k]=el.open;put('dis:ui',JSON.stringify(ui))})});
`;
/* DIS's manifest: one icon for the whole site, opening the front page, with every app folder inside its scope */
function siteManifest(site){
  const app=site.app;
  return{name:app.name,short_name:app.short,start_url:'./',scope:'./',display:'standalone',background_color:'#EEF1F5',theme_color:site.accent||'#3D4FB5',
    icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png'},{src:'apple-touch-icon.png',sizes:'180x180',type:'image/png'}]};
}
/* the Show Me How page, at install/: it links DIS's manifest and icon so that adding it adds DIS */
function installPage(html,site){
  const app=site.app,mark='SITE HEAD:';
  if(!html.includes(mark))throw new Error('html/install.html has lost its SITE HEAD comment');
  const head=`\n<link rel="manifest" href="../manifest.webmanifest">\n<meta name="apple-mobile-web-app-title" content="${esc(app.short)}">\n<meta name="mobile-web-app-capable" content="yes">\n<link rel="icon" href="../icon-192.png" sizes="192x192">\n<link rel="apple-touch-icon" href="../apple-touch-icon.png">`;
  const end=html.indexOf('-->',html.indexOf(mark))+3;
  return(html.slice(0,end)+head+html.slice(end)).replace("var SITE={home:'../',backup:false};","var SITE={home:'../',backup:true};");
}

/* ---------- the front page that lists the apps ---------- */
function siteIndex(site,apps,files){
  const css=files['core/core.css'],app=site.app&&site.app.name&&site.app.short?site.app:null;
  const cardsOf=list=>list.map(a=>`      <a class="app" href="${esc(a.folder)}/">
        <img src="${esc(a.folder)}/icon-192.png" alt="" width="64" height="64">
        <span><b>${esc(a.code)}: ${esc(a.name)}</b><span class="sub">${esc(a.tagline||'')}</span></span>
      </a>`).join('\n');
  const groups=groupApps(site.sections,apps);
  const listing=!groups.length?`  <nav class="list" aria-label="Apps">
${cardsOf(apps)}
  </nav>`:`  <nav class="jump" aria-label="Sections">
${groups.map(g=>`    <a href="#${esc(g.id)}">${esc(g.name)} <span class="n">${g.apps.length}<span class="sr"> ${g.apps.length===1?'app':'apps'}</span></span></a>`).join('\n')}
  </nav>
${groups.map(g=>`  <section class="sec" id="${esc(g.id)}" aria-labelledby="h-${esc(g.id)}">
    <h2 id="h-${esc(g.id)}">${esc(g.name)}</h2>${g.blurb?`\n    <p class="sub">${esc(g.blurb)}</p>`:''}
    <div class="list">
${cardsOf(g.apps)}
    </div>
  </section>`).join('\n')}`;
  /* the Instructions button: one place for how to open an app and put it on a Home Screen, with the visitor's device
     opened first. The steps and button pictures match what core/home.js shows inside each app. */
  const ic=p=>`<span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg></span>`;
  const I={share:ic('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 11H6v9h12v-9h-1"/>'),dots:ic('<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>'),
    plus:ic('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>'),kebab:ic('<circle cx="12" cy="5.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="18.5" r="1.3" fill="currentColor"/>'),
    compass:ic('<circle cx="12" cy="12" r="8.5"/><path d="M15 9l-2 4-4 2 2-4z" fill="currentColor"/>'),tabs:ic('<rect x="8" y="4" width="12" height="12" rx="2.5"/><path d="M4.5 8.5v9A2.5 2.5 0 0 0 7 20h9"/>'),info:ic('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor"/>')};
  const help=`  <details class="howto" id="instructions">
    <summary>${I.info}Instructions</summary>
    <div class="howto-body group">
      <p>Tap an app to open it. To keep them all on your phone or tablet, add this page to your Home Screen once: ${app?`it gets one icon, ${esc(app.short)}, and every app opens from it.`:'every app then opens from its icon.'}</p>
      <details class="dev" data-dev="ios">
        <summary>iPhone or iPad</summary>
        <ol>
          <li>Open this page in <b>Safari</b> or <b>Chrome</b>. If it opened inside Gmail, Facebook, Instagram or another app, tap that app’s menu (${I.dots} three dots or ${I.compass} a compass) and choose <b>Open in Safari</b>. It may say Open in Browser.</li>
          <li>Find ${I.share} <b>Share</b>, a square with an arrow pointing up.
            <ul>
              <li>In the bar at the bottom? Tap it.</li>
              <li>${I.dots} Three dots to the right of the address bar instead? Tap them, then tap <b>Share</b>.</li>
              <li>${I.tabs} A Tabs button there instead? Tap the small button at the left end of the address bar, then tap <b>Share</b>.</li>
              <li>On an iPad, Share is at the top right. Tap it, then tap <b>View More</b>.</li>
              <li>Using Chrome? Share is at the right end of Chrome’s address bar.</li>
            </ul>
          </li>
          <li>Scroll down the list and tap ${I.plus} <b>Add to Home Screen</b>. Not there? Scroll to the bottom, tap <b>Edit Actions</b> and add it.</li>
          <li>If you see <b>Open as Web App</b>, make sure it is switched on.</li>
          <li>Tap <b>Add</b>.</li>
        </ol>
        <p class="sub"><a class="show" href="install/">Not sure which screen you have? Show me how, with pictures</a></p>
        <p class="sub">Best done before you start: on an iPhone or iPad, the Home Screen app keeps its own copy of your work, separate from Safari’s.</p>
      </details>
      <details class="dev" data-dev="android">
        <summary>Android</summary>
        <ol>
          <li>Open this page in <b>Chrome</b>. If the link opened inside another app, tap ${I.kebab} and choose <b>Open in Chrome</b> first.</li>
          <li>Tap ${I.kebab} (top right).</li>
          <li>Tap <b>Add to Home screen</b> or <b>Install app</b>.</li>
          <li>Tap <b>Install</b> or <b>Add</b>.</li>
        </ol>
        <p class="sub">If you see an <b>Install</b> button near the top of this page, tapping it does the same.</p>
      </details>
      <details class="dev" data-dev="computer">
        <summary>Computer</summary>
        <ol>
          <li>Bookmark this page.</li>
          <li>In Chrome or Edge you can also install it as an app, from the browser’s menu.</li>
        </ol>
      </details>
      <p class="sub">Just want one app? Open it and do the same taps there: it gets its own icon, with its own saves. On a phone, each app also shows the steps the first time it opens. Everything runs on your device: pictures and work you make are never uploaded. When an app is updated, you get the new version the next time you open it online.</p>
    </div>
  </details>`;
  return`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="${esc(site.accent)}">
<title>${esc(app?app.name:site.title)}</title>${app?`
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-title" content="${esc(app.short)}">
<meta name="mobile-web-app-capable" content="yes">`:''}
<link rel="icon" href="icon-192.png" sizes="192x192">
<link rel="icon" href="icon-512.png" sizes="512x512">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>
${css.trim()}
:root{--accent:${site.accent};--accent-ink:${inkFor(site.accent)}}
.list{display:grid;gap:12px;max-width:760px;margin:0 auto;padding:0 16px}
.app{display:grid;grid-template-columns:64px minmax(0,1fr);gap:14px;align-items:center;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--panel);color:var(--ink);text-decoration:none;min-height:44px}
.app img{border-radius:14px}.app b{display:block;font-size:17px;margin-bottom:2px}
.app:hover,.app:focus-visible{border-color:var(--accent)}
.app:focus-visible,.jump a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.jump{display:flex;flex-wrap:wrap;gap:8px;max-width:760px;margin:6px auto 4px;padding:0 16px}
.jump a{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border:1px solid var(--line);border-radius:999px;background:var(--chip);color:var(--ink);text-decoration:none;font-size:15px}
.jump a:hover{border-color:var(--accent)}
.jump .n{display:inline-block;min-width:22px;padding:0 6px;border-radius:999px;background:var(--panel);color:var(--muted);font-size:13px;line-height:22px;text-align:center}
.sec{max-width:760px;margin:22px auto 0;padding:0}
.sec>h2,.sec>.sub{padding:0 16px}.sec>.sub{margin:-4px 0 10px}
.sec>h2{margin-bottom:6px}
.ic{display:inline-flex;vertical-align:-5px;width:22px;height:22px;margin:0 2px}.ic svg{width:100%;height:100%}
.howto{max-width:760px;margin:10px auto 4px;padding:0 16px}
.howto>summary{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 18px 0 12px;border-radius:999px;background:var(--accent);color:var(--accent-ink);font-weight:650;cursor:pointer;list-style:none}
.howto>summary::-webkit-details-marker,.dev>summary::-webkit-details-marker{display:none}
.howto>summary::after{content:"";width:8px;height:8px;margin-left:6px;border:solid currentColor;border-width:0 2px 2px 0;transform:rotate(45deg) translate(-2px,-2px)}
.howto[open]>summary::after{transform:rotate(-135deg) translate(-2px,-2px)}
.howto-body{margin-top:10px}.howto-body>p:first-child{margin-top:0}.howto[open]{margin-bottom:14px}
.dev{border:1px solid var(--line);border-radius:12px;margin:8px 0;background:var(--bg)}
.dev>summary{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;font-weight:650;cursor:pointer;list-style:none}
.dev>summary::before{content:"";width:7px;height:7px;border:solid currentColor;border-width:0 2px 2px 0;transform:rotate(-45deg);margin-right:4px;flex:none}
.dev[open]>summary::before{transform:rotate(45deg)}
.dev .this{font-weight:400;font-size:13px;color:var(--muted);margin-left:auto}
.dev ol{margin:0;padding:0 14px 4px 36px}.dev li{margin:6px 0}.dev>.sub{padding:0 14px 12px}
.dev li ul{margin:4px 0 0;padding-left:18px}.dev .show{display:inline-flex;align-items:center;min-height:44px;font-weight:650;color:var(--ink)}.dev>.sub:has(.show){padding-bottom:0}
.howto summary:focus-visible,.more a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.dis{max-width:760px;margin:22px auto 0;padding:0 16px}.dis>details{margin:0 0 12px}
.dis summary{display:flex;align-items:center;gap:8px;min-height:44px;cursor:pointer;list-style:none}.dis summary::-webkit-details-marker{display:none}
.dis summary h2{margin:0;flex:1}.dis summary::after{content:"";flex:none;width:9px;height:9px;margin-right:6px;border:solid currentColor;border-width:0 2px 2px 0;transform:rotate(45deg)}
.dis details[open]>summary::after{transform:rotate(-135deg)}.dis details>*{box-sizing:border-box}
.dis h3{margin:16px 0 4px}.dis select{min-height:44px;max-width:100%;font:inherit;padding:6px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--ink)}
.dis .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.dis .btn{display:inline-flex;align-items:center}
.dis .pick input{font-size:16px}.dis .msg{min-height:1.5em;margin:4px 0}.inst{max-width:760px;margin:6px auto;padding:0 16px}
.more{max-width:760px;margin:22px auto 0;padding:0 16px}.more a{display:inline-flex;align-items:center;min-height:44px;color:var(--ink)}
header,.foot{max-width:760px}
</style>
</head>
<body>
<header>
  <h1>${esc(app?app.name:site.title)}</h1>
  <p>${esc(site.tagline)}</p>
</header>
<main>
${help}${app?`
  <p class="inst" id="installRow" hidden><button type="button" class="btn primary" id="installBtn">Install ${esc(app.short)}</button></p>`:''}
${listing}
${app?device(app,apps):''}
  <p class="more"><a href="#instructions">How to put an app on your phone or tablet</a></p>
</main>
<p class="foot">${esc(site.foot||'')}</p>
<script>
(function(){${app?LAUNCHER_JS:''}
  /* open the steps for this device, and open Instructions when a link goes to it */
  var u=navigator.userAgent,ios=/iPad|iPhone|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1);
  var d=document.querySelector('.dev[data-dev="'+(ios?'ios':/Android/.test(u)?'android':'computer')+'"]');
  if(d){d.open=true;d.querySelector('summary').insertAdjacentHTML('beforeend','<span class="this">This device</span>')}
  var h=document.getElementById('instructions');
  function show(){if(location.hash==='#instructions')h.open=true}
  window.addEventListener('hashchange',show);show();
  document.querySelectorAll('a[href="#instructions"]').forEach(function(a){a.addEventListener('click',function(){h.open=true})});
})();
</script>
</body>
</html>
`;
}

const SITE_ICONS=[{name:'icon-192.png',size:192},{name:'icon-512.png',size:512},{name:'apple-touch-icon.png',size:180}];
const api={iconPixels,siteIconPixels,SITE_ICONS,siteManifest,installPage,pngFrom,zip,crc32,webFolder,siteIndex,groupApps,infoOf,inkFor,HOME_JS_NAME};
root.AppWeb=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
