/* Web folders: what an app needs to live at a web address and go on a phone's Home Screen.
   webFolder(html, info) -> {files: {name: text}, icons: [{name, size}]}   index.html, manifest.webmanifest, sw.js (+ icons to draw)
   iconPixels(size, code, accent) -> RGBA pixels of a bead-letter icon      (Node turns them into PNG with pngFrom; the page uses a canvas)
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
function iconPixels(size,code,accent){
  const px=new Uint8ClampedArray(size*size*4),bg=rgbOf(accent),ink=rgbOf(inkFor(accent));
  for(let i=0;i<size*size;i++){px[i*4]=bg[0];px[i*4+1]=bg[1];px[i*4+2]=bg[2];px[i*4+3]=255}
  const chars=String(code).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4).split('').filter(c=>FONT[c]);
  if(!chars.length)return px;
  const cols=chars.length*6-1,cell=Math.min(size*0.74/cols,size*0.56/7),ox=(size-cols*cell)/2,oy=(size-7*cell)/2,R=0.47*cell,H=0.15*cell;
  const dot=(cx,cy)=>{   /* a bead: a disc with a hole, with soft edges */
    for(let y=Math.max(0,Math.floor(cy-R-1));y<=Math.min(size-1,Math.ceil(cy+R+1));y++)for(let x=Math.max(0,Math.floor(cx-R-1));x<=Math.min(size-1,Math.ceil(cx+R+1));x++){
      const d=Math.hypot(x+0.5-cx,y+0.5-cy),a=Math.max(0,Math.min(1,R+0.5-d))-Math.max(0,Math.min(1,H+0.5-d));if(a<=0)continue;
      const k=(y*size+x)*4;for(let c=0;c<3;c++)px[k+c]=Math.round(px[k+c]*(1-a)+ink[c]*a)}
  };
  chars.forEach((ch,i)=>{const f=FONT[ch];for(let r=0;r<7;r++)for(let c=0;c<5;c++)if(f[r*5+c]==='1')dot(ox+(i*6+c+0.5)*cell,oy+(r+0.5)*cell)});
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
  const sw=`<script>if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(function(){});</script>\n`;
  let page=html;
  page=page.includes('</head>')?page.replace('</head>',head+'</head>'):head+page;
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

/* ---------- the front page that lists the apps ---------- */
function siteIndex(site,apps,files){
  const css=files['core/core.css'];
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
  return`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="${esc(site.accent)}">
<title>${esc(site.title)}</title>
<link rel="icon" href="${esc(apps[0]?apps[0].folder+'/icon-192.png':'')}">
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
.how{max-width:760px;margin:18px auto 0;padding:0 16px}
header,.foot{max-width:760px}
</style>
</head>
<body>
<header>
  <h1>${esc(site.title)}</h1>
  <p>${esc(site.tagline)}</p>
</header>
<main>
${listing}
  <section class="how group">
    <h2>Put an App on Your Phone or Tablet</h2>
    <ol class="sub">
      <li>Tap an app above to open it.</li>
      <li>A card at the bottom shows the two or three taps for your phone. On an iPhone or iPad: <b>Share</b>, then <b>Add to Home Screen</b>, then <b>Add</b>.</li>
      <li>Open it from your Home Screen from then on. It works without a connection once it has opened once.</li>
    </ol>
    <p class="sub">Everything runs in your browser. Pictures and work you make stay on your device.</p>
  </section>
</main>
<p class="foot">${esc(site.foot||'')}</p>
</body>
</html>
`;
}

const api={iconPixels,pngFrom,zip,crc32,webFolder,siteIndex,groupApps,infoOf,inkFor,HOME_JS_NAME};
root.AppWeb=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
