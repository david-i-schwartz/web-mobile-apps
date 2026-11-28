
/* ---------- home screen: helps people put the app on a phone's Home Screen ----------
   Works out where the page is running (iPhone or iPad, Android, a computer, inside another app's browser, already on the
   Home Screen, opened as a file, or inside another page) and shows the taps that apply, with pictures of the buttons.
   On a phone it shows once as a card at the bottom until it's dismissed; the steps also go in `mount` if given.
   Self-contained, so it can also be added to apps the generator didn't make (FIG, BIG): homeHint({code, name, url, key, mount, version}).
   A site with a launcher (DIS) sets window.HOME_HUB = {name, short, url, how, flag} in each app's web folder. Then, on an iPhone or
   iPad, the card offers the launcher instead of this one app, and an app opened from inside the launcher gets a Back button and a
   button that fetches the newest version (a Home Screen app has no address bar to reload from). */
function homeHint(cfg){
  const d=document,ua=navigator.userAgent||'',code=String(cfg.code||'this app'),name=String(cfg.name||code);
  const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ipad=/iPad/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1),ios=ipad||/iPhone|iPod/.test(ua),android=/Android/.test(ua);
  let standalone=navigator.standalone===true;try{standalone=standalone||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches}catch(x){}
  let framed=false;try{framed=window.self!==window.top}catch(x){framed=true}
  const web=/^https?:$/.test(location.protocol);
  const inApp=/GSA\/|FBAN|FBAV|FB_IAB|Instagram|Line\/|LinkedInApp|Twitter|Snapchat|Pinterest|; wv\)/.test(ua)||(ios&&!/Safari\//.test(ua));
  const iosOther=/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  /* From iOS 26 Safari stops raising the iOS number in its name, so go by its own Version/ number to guess the layout */
  const sv=/Version\/(\d+)/.exec(ua),safari=sv?+sv[1]:0;
  const where=standalone?'installed':!web?'file':framed?'framed':ios?(inApp?'ios-app':'ios'):android?(inApp?'android-app':'android'):'computer';
  const url=cfg.url||(web&&!framed?location.href.split('#')[0]:'');
  const pre=cfg.key||code.toLowerCase()+':',key=pre+'homeHint',freshKey=pre+'fresh';
  /* the launcher, if the site has one (checked, since it comes from the page) */
  let hub=cfg.hub||(typeof window!=='undefined'?window.HOME_HUB:null);
  hub=hub&&typeof hub==='object'&&typeof hub.url==='string'&&hub.short?{name:String(hub.name||hub.short),short:String(hub.short),url:hub.url,how:String(hub.how||hub.url),flag:String(hub.flag||'')}:null;
  let inHub=false;if(hub&&standalone&&hub.flag)try{inHub=sessionStorage.getItem(hub.flag)==='1'}catch(x){}
  /* pictures of the buttons to tap (drawn here, not taken from any system) */
  const svg=p=>`<span class="hh-i" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg></span>`;
  const I={share:svg('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 11H6v9h12v-9h-1"/>'),dots:svg('<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>'),
    plus:svg('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>'),kebab:svg('<circle cx="12" cy="5.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="18.5" r="1.3" fill="currentColor"/>'),
    compass:svg('<circle cx="12" cy="12" r="8.5"/><path d="M15 9l-2 4-4 2 2-4z" fill="currentColor"/>')};
  let prompt=null;
  /* where Share is, from Apple's iPhone and iPad User Guides (iOS 18, 26 and 27): in the bar, behind the three dots, or in the Page Menu */
  function shareStep(){
    if(iosOther)return`Tap ${I.share} <b>Share</b> (in the address bar or the ${I.dots} menu).`;
    if(ipad)return`Tap ${I.share} <b>Share</b> (top right), then <b>View More</b> if you see it.`;
    const bar=` A Share button ${I.share} in the bar at the bottom? Tap that instead.`;
    if(safari>=27)return`Tap the small button at the <b>left end of the address bar</b>, then <b>Share</b>.`+bar;
    if(safari===26)return`Tap ${I.dots} to the right of the address bar, then <b>Share</b>.`+bar;
    if(safari)return`Tap ${I.share} <b>Share</b>.`;
    return`Tap ${I.share} <b>Share</b>. No Share button? Tap ${I.dots} or the button at the left end of the address bar, then <b>Share</b>.`;
  }
  function steps(){
    if(where==='ios')return{lead:'It opens like an app, with its own icon.',list:[shareStep(),
      `Scroll down and tap ${I.plus} <b>Add to Home Screen</b>. Not there? Tap <b>Edit Actions</b> at the bottom of the list and add it.`,
      'If you see <b>Open as Web App</b>, leave it on.','Tap <b>Add</b>.'],note:'Best done before you start: the Home Screen app keeps its own copy of your work.'};
    if(where==='ios-app')return{lead:'This page is open inside another app, which can’t add it to your Home Screen.',list:[
      `Tap ${I.dots} or ${I.compass} and choose <b>Open in Safari</b>. (Or copy the link and paste it into Safari.)`,
      `In Safari, find ${I.share} <b>Share</b>, then tap ${I.plus} <b>Add to Home Screen</b>.`],copy:true};
    if(where==='android')return{lead:'It opens like an app, with its own icon.',list:prompt?[`Tap <b>Install ${e(code)}</b> below.`]:[
      `Tap ${I.kebab} (top right).`,'Tap <b>Add to Home screen</b> or <b>Install app</b>.','Tap <b>Install</b> or <b>Add</b>.']};
    if(where==='android-app')return{lead:'This page is open inside another app, which can’t add it to your Home screen.',list:[
      `Tap ${I.kebab} and choose <b>Open in Chrome</b> (or your browser).`,`Then tap ${I.kebab} again and <b>Add to Home screen</b>.`],copy:true};
    if(where==='installed')return{lead:inHub?`You opened ${e(code)} from ${e(hub.short)}. Use <b>‹ ${e(hub.short)}</b> at the top to go back.`:`${e(code)} is on your Home Screen. Open it from there any time.`,list:[]};
    if(where==='file')return{lead:`You opened ${e(code)} as a file. It works here, but a phone can’t run a file like this.`+
      (url?` On a phone or tablet, open <a href="${e(url)}" target="_blank" rel="noopener">${e(url)}</a> instead and follow the steps it shows.`:' To use it on a phone, it needs a web address.'),list:[],copy:!!url};
    return{lead:url?`On a phone or tablet, open <a href="${e(url)}" target="_blank" rel="noopener">${e(url)}</a>, and it shows the taps that put ${e(code)} on the Home Screen. On a computer, bookmark it.`:
      `To put ${e(code)} on a phone, open its web address there.`,list:[],copy:!!url};
  }
  /* on an iPhone or iPad with a launcher, the card offers the launcher: one install for every app */
  const hubCard=!!hub&&(where==='ios'||where==='ios-app');
  function cardHtml(){
    return`<div class="hh-t"><span>Get All of ${e(hub.name)}</span><button type="button" class="hh-x" aria-label="Close">×</button></div>`+
      `<p class="hh-lead">Put ${e(hub.short)} on your Home Screen: every app and game behind one icon.</p>`+
      (where==='ios-app'?`<p class="hh-note"><b>This page is open inside another app.</b> Tap ${I.dots} or ${I.compass} and choose <b>Open in Safari</b> first.</p>`:'<p class="hh-note">No Share button? Open this page in Safari first.</p>')+
      `<div class="hh-btns"><a class="hh-b hh-go" href="${e(hub.how)}">Show Me How</a><button type="button" class="hh-b" data-hh="done">Already Did It</button><button type="button" class="hh-b" data-hh="later">Not Now</button><span class="hh-msg" aria-live="polite"></span></div>`;
  }
  function html(withTitle){
    if(withTitle&&hubCard)return cardHtml();
    const s=steps();
    return(withTitle?`<div class="hh-t"><span>Put ${e(code)} on your Home Screen</span><button type="button" class="hh-x" aria-label="Close">×</button></div>`:'')+
      `<p class="hh-lead">${s.lead}</p>`+(s.list.length?`<ol class="hh-steps">${s.list.map(l=>`<li>${l}</li>`).join('')}</ol>`:'')+(s.note?`<p class="hh-note">${s.note}</p>`:'')+
      (!withTitle&&hub&&!inHub?`<p class="hh-note">Want every app behind one icon? Put <a href="${e(hub.url)}">${e(hub.name)}</a> on your Home Screen instead. <a href="${e(hub.how)}">Show me how</a>.</p>`:'')+
      `<div class="hh-btns">${prompt?`<button type="button" class="hh-b hh-go" data-hh="install">Install ${e(code)}</button>`:''}${s.copy&&url?'<button type="button" class="hh-b" data-hh="copy">Copy link</button>':''}${withTitle?'<button type="button" class="hh-b" data-hh="later">Not now</button>':''}`+
      (!withTitle&&web&&!framed?'<button type="button" class="hh-b" data-hh="fresh">Get the Newest Version</button>':'')+`<span class="hh-msg" aria-live="polite"></span></div>`;
  }
  if(!d.getElementById('hh-style')){const st=d.createElement('style');st.id='hh-style';st.textContent=
`#hh{position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:9999;max-width:520px;margin:0 auto;background:var(--panel,#fff);color:var(--ink,#1b1f24);border:1px solid var(--edge,#c3c9d2);border-radius:16px;box-shadow:0 10px 32px rgba(0,0,0,.28);padding:12px 14px 10px;font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
#hh .hh-t{display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:700;font-size:16px}
.hh-lead{margin:4px 0}.hh-steps{margin:6px 0;padding-left:1.4em}.hh-steps li{margin:5px 0}
.hh-i{display:inline-flex;vertical-align:-5px;width:24px;height:24px;align-items:center;justify-content:center;border-radius:7px;background:var(--chip,#e9edf2);color:var(--accent,#0E7C7B);margin:0 1px}.hh-i svg{width:18px;height:18px}
.hh-note,.hh-msg{color:var(--muted,#5b6470);font-size:13px;margin:4px 0}.hh-btns{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px}
.hh-b{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:22px;border:1px solid var(--edge,#c3c9d2);background:var(--chip,#e9edf2);color:inherit;font:inherit;font-weight:600;cursor:pointer;text-decoration:none}
.hh-go{background:var(--accent,#0E7C7B);color:var(--accent-ink,#fff);border-color:transparent}
#hh .hh-x{min-width:44px;min-height:44px;border:0;background:transparent;color:inherit;font-size:24px;line-height:1;cursor:pointer}
#hh-bar{position:absolute;left:calc(6px + env(safe-area-inset-left));top:calc(6px + env(safe-area-inset-top));z-index:9998;display:flex;gap:6px;font:600 15px/1 system-ui,-apple-system,"Segoe UI",sans-serif}
#hh-bar a,#hh-bar button{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;padding:0 12px;border-radius:22px;border:1px solid var(--edge,#c3c9d2);background:var(--panel,#fff);color:var(--ink,#1b1f24);font:inherit;text-decoration:none;opacity:.92;box-shadow:0 2px 10px rgba(0,0,0,.18);cursor:pointer}
#hh-bar button{padding:0;font-size:20px}
#hh-toast{position:fixed;left:50%;transform:translateX(-50%);top:calc(58px + env(safe-area-inset-top));z-index:9999;background:var(--ink,#1b1f24);color:var(--panel,#fff);padding:10px 16px;border-radius:12px;font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:90vw}
#hh-bar a:focus-visible,#hh-bar button:focus-visible,.hh-b:focus-visible{outline:3px solid var(--accent,#0E7C7B);outline-offset:2px}
@media (prefers-color-scheme:dark){#hh,#hh-bar a,#hh-bar button{background:var(--panel,#1d2229);color:var(--ink,#e8ebef);border-color:var(--edge,#3a424d)}.hh-i,.hh-b{background:var(--chip,#2a313a)}.hh-go{background:var(--accent,#3FB8B6);color:var(--accent-ink,#0B1F1F)}}`;
    d.head.appendChild(st)}
  const phone=where==='ios'||where==='ios-app'||where==='android'||where==='android-app';
  let later=0,seen='';try{seen=localStorage.getItem(key)||'';later=+seen||0}catch(x){}
  let card=null;
  /* fetch the newest copy: ask the offline helper to check, then reload; after the reload, say which version this is */
  async function fresh(m){
    if(navigator.onLine===false){if(m)m.textContent='You’re offline. Connect to the internet, then try again.';return}
    if(m)m.textContent='Getting the newest version…';
    try{const r=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();if(r)await r.update()}catch(x){}
    try{sessionStorage.setItem(freshKey,'1')}catch(x){}
    location.reload();
  }
  function wire(box){box.addEventListener('click',async ev=>{
    const b=ev.target.closest('[data-hh],.hh-x');if(!b)return;const m=box.querySelector('.hh-msg'),act=b.dataset.hh||'later';
    if(act==='install'&&prompt){prompt.prompt();try{const r=await prompt.userChoice;if(r&&r.outcome==='accepted')hide()}catch(x){}prompt=null;draw()}
    else if(act==='copy'){try{await navigator.clipboard.writeText(url);if(m)m.textContent='Link copied.'}catch(x){if(m)m.textContent=url}}
    else if(act==='fresh')fresh(m);
    else if(act==='done'){try{localStorage.setItem(key,'done')}catch(x){}hide()}
    else if(act==='later'){try{localStorage.setItem(key,String(Date.now()))}catch(x){}hide()}
  })}
  function hide(){if(card){card.remove();card=null}}
  function draw(){
    if(cfg.mount){cfg.mount.innerHTML=html(false);if(!cfg.mount.dataset.hh){cfg.mount.dataset.hh='1';wire(cfg.mount)}}
    if(card)card.innerHTML=html(true);
  }
  if(phone&&seen!=='done'&&Date.now()-later>30*864e5){card=d.createElement('div');card.id='hh';card.setAttribute('role','dialog');card.setAttribute('aria-label',hubCard?'Get all of '+hub.name:'Put '+code+' on your Home Screen');d.body.appendChild(card);wire(card)}
  /* opened from inside the launcher: a way back, and a way to fetch the newest version */
  if(inHub&&!d.getElementById('hh-bar')){
    const bar=d.createElement('nav');bar.id='hh-bar';bar.setAttribute('aria-label',hub.short);
    bar.innerHTML=`<a href="${e(hub.url)}" aria-label="Back to ${e(hub.name)}">‹ ${e(hub.short)}</a><button type="button" aria-label="Get the newest version of ${e(code)}">↻</button>`;
    bar.querySelector('button').addEventListener('click',()=>fresh(null));d.body.appendChild(bar);
    /* a page that scrolls makes room for the buttons above its heading; a full-screen game keeps its layout and they sit over its corner */
    const room=()=>{if(d.documentElement.scrollHeight>innerHeight+8&&!d.body.style.paddingTop)d.body.style.paddingTop='calc(56px + env(safe-area-inset-top))'};
    room();setTimeout(room,600);
  }
  let was=null;try{was=sessionStorage.getItem(freshKey);if(was)sessionStorage.removeItem(freshKey)}catch(x){}
  if(was){const t=d.createElement('div');t.id='hh-toast';t.setAttribute('role','status');d.body.appendChild(t);
    setTimeout(()=>{t.textContent=cfg.version?`${code} is up to date: version ${cfg.version}.`:`${code} is up to date.`},50);setTimeout(()=>t.remove(),5000)}
  window.addEventListener('beforeinstallprompt',ev=>{ev.preventDefault();prompt=ev;draw()});
  window.addEventListener('appinstalled',()=>{hide()});
  draw();
  return where;
}
