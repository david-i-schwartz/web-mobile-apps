/* ---------- home screen: helps people put the app on a phone's Home Screen ----------
   Works out where the page is running (iPhone or iPad, Android, a computer, inside another app's browser, already on the
   Home Screen, opened as a file, or inside another page) and shows the two or three taps that apply, with pictures of the
   buttons. On a phone it shows once as a card at the bottom until it's dismissed; the steps also go in `mount` if given.
   Self-contained, so it can also be added to apps the generator didn't make (FIG, BIG): homeHint({code, name, url, key, mount}). */
function homeHint(cfg){
  const d=document,ua=navigator.userAgent||'',code=String(cfg.code||'this app'),name=String(cfg.name||code);
  const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ipad=/iPad/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1),ios=ipad||/iPhone|iPod/.test(ua),android=/Android/.test(ua);
  let standalone=navigator.standalone===true;try{standalone=standalone||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches}catch(x){}
  let framed=false;try{framed=window.self!==window.top}catch(x){framed=true}
  const web=/^https?:$/.test(location.protocol);
  const inApp=/GSA\/|FBAN|FBAV|FB_IAB|Instagram|Line\/|LinkedInApp|Twitter|Snapchat|Pinterest|; wv\)/.test(ua)||(ios&&!/Safari\//.test(ua));
  const iosOther=/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const where=standalone?'installed':!web?'file':framed?'framed':ios?(inApp?'ios-app':'ios'):android?(inApp?'android-app':'android'):'computer';
  const url=cfg.url||(web&&!framed?location.href.split('#')[0]:'');
  const key=(cfg.key||code.toLowerCase()+':')+'homeHint';
  /* pictures of the buttons to tap (drawn here, not taken from any system) */
  const svg=p=>`<span class="hh-i" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg></span>`;
  const I={share:svg('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 11H6v9h12v-9h-1"/>'),dots:svg('<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>'),
    plus:svg('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>'),kebab:svg('<circle cx="12" cy="5.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="18.5" r="1.3" fill="currentColor"/>'),
    compass:svg('<circle cx="12" cy="12" r="8.5"/><path d="M15 9l-2 4-4 2 2-4z" fill="currentColor"/>')};
  let prompt=null;
  function steps(){
    if(where==='ios')return{lead:'It opens like an app, with its own icon.',list:[
      `Tap ${I.share} <b>Share</b>${iosOther?' (in the address bar or the '+I.dots+' menu)':ipad?' (top right)':''}.`+(iosOther?'':` No Share button? Tap ${I.dots} first.`),
      `Tap ${I.plus} <b>Add to Home Screen</b>.`,'Tap <b>Add</b>.'],note:'Best done before you start: the Home Screen app keeps its own copy of your work.'};
    if(where==='ios-app')return{lead:'This page is open inside another app, which can’t add it to your Home Screen.',list:[
      `Tap ${I.dots} or ${I.compass} and choose <b>Open in Safari</b>. (Or copy the link and paste it into Safari.)`,
      `In Safari, tap ${I.share} <b>Share</b>, then ${I.plus} <b>Add to Home Screen</b>.`],copy:true};
    if(where==='android')return{lead:'It opens like an app, with its own icon.',list:prompt?[`Tap <b>Install ${e(code)}</b> below.`]:[
      `Tap ${I.kebab} (top right).`,'Tap <b>Add to Home screen</b> or <b>Install app</b>.','Tap <b>Install</b> or <b>Add</b>.']};
    if(where==='android-app')return{lead:'This page is open inside another app, which can’t add it to your Home screen.',list:[
      `Tap ${I.kebab} and choose <b>Open in Chrome</b> (or your browser).`,`Then tap ${I.kebab} again and <b>Add to Home screen</b>.`],copy:true};
    if(where==='installed')return{lead:`${e(code)} is on your Home Screen. Open it from there any time.`,list:[]};
    if(where==='file')return{lead:`You opened ${e(code)} as a file. It works here, but a phone can’t run a file like this.`+
      (url?` On a phone or tablet, open <a href="${e(url)}" target="_blank" rel="noopener">${e(url)}</a> instead and follow the steps it shows.`:' To use it on a phone, it needs a web address.'),list:[],copy:!!url};
    return{lead:url?`On a phone or tablet, open <a href="${e(url)}" target="_blank" rel="noopener">${e(url)}</a>, and it shows the two or three taps that put ${e(code)} on the Home Screen. On a computer, bookmark it.`:
      `To put ${e(code)} on a phone, open its web address there.`,list:[],copy:!!url};
  }
  function html(withTitle){
    const s=steps();
    return(withTitle?`<div class="hh-t"><span>Put ${e(code)} on your Home Screen</span><button type="button" class="hh-x" aria-label="Close">×</button></div>`:'')+
      `<p class="hh-lead">${s.lead}</p>`+(s.list.length?`<ol class="hh-steps">${s.list.map(l=>`<li>${l}</li>`).join('')}</ol>`:'')+(s.note?`<p class="hh-note">${s.note}</p>`:'')+
      `<div class="hh-btns">${prompt?`<button type="button" class="hh-b hh-go" data-hh="install">Install ${e(code)}</button>`:''}${s.copy&&url?'<button type="button" class="hh-b" data-hh="copy">Copy link</button>':''}${withTitle?'<button type="button" class="hh-b" data-hh="later">Not now</button>':''}<span class="hh-msg" aria-live="polite"></span></div>`;
  }
  if(!d.getElementById('hh-style')){const st=d.createElement('style');st.id='hh-style';st.textContent=
`#hh{position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:9999;max-width:520px;margin:0 auto;background:var(--panel,#fff);color:var(--ink,#1b1f24);border:1px solid var(--edge,#c3c9d2);border-radius:16px;box-shadow:0 10px 32px rgba(0,0,0,.28);padding:12px 14px 10px;font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
#hh .hh-t{display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:700;font-size:16px}
.hh-lead{margin:4px 0}.hh-steps{margin:6px 0;padding-left:1.4em}.hh-steps li{margin:5px 0}
.hh-i{display:inline-flex;vertical-align:-5px;width:24px;height:24px;align-items:center;justify-content:center;border-radius:7px;background:var(--chip,#e9edf2);color:var(--accent,#0E7C7B);margin:0 1px}.hh-i svg{width:18px;height:18px}
.hh-note,.hh-msg{color:var(--muted,#5b6470);font-size:13px;margin:4px 0}.hh-btns{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px}
.hh-b{min-height:44px;padding:0 16px;border-radius:22px;border:1px solid var(--edge,#c3c9d2);background:var(--chip,#e9edf2);color:inherit;font:inherit;font-weight:600;cursor:pointer}
.hh-go{background:var(--accent,#0E7C7B);color:var(--accent-ink,#fff);border-color:transparent}
#hh .hh-x{min-width:44px;min-height:44px;border:0;background:transparent;color:inherit;font-size:24px;line-height:1;cursor:pointer}
@media (prefers-color-scheme:dark){#hh{background:var(--panel,#1d2229);color:var(--ink,#e8ebef);border-color:var(--edge,#3a424d)}.hh-i,.hh-b{background:var(--chip,#2a313a)}}`;
    d.head.appendChild(st)}
  const phone=where==='ios'||where==='ios-app'||where==='android'||where==='android-app';
  let later=0;try{later=+localStorage.getItem(key)||0}catch(x){}
  let card=null;
  function wire(box){box.addEventListener('click',async ev=>{
    const b=ev.target.closest('[data-hh],.hh-x');if(!b)return;const m=box.querySelector('.hh-msg'),act=b.dataset.hh||'later';
    if(act==='install'&&prompt){prompt.prompt();try{const r=await prompt.userChoice;if(r&&r.outcome==='accepted')hide()}catch(x){}prompt=null;draw()}
    else if(act==='copy'){try{await navigator.clipboard.writeText(url);if(m)m.textContent='Link copied.'}catch(x){if(m)m.textContent=url}}
    else if(act==='later'){try{localStorage.setItem(key,String(Date.now()))}catch(x){}hide()}
  })}
  function hide(){if(card){card.remove();card=null}}
  function draw(){
    if(cfg.mount){cfg.mount.innerHTML=html(false);if(!cfg.mount.dataset.hh){cfg.mount.dataset.hh='1';wire(cfg.mount)}}
    if(card)card.innerHTML=html(true);
  }
  if(phone&&Date.now()-later>30*864e5){card=d.createElement('div');card.id='hh';card.setAttribute('role','dialog');card.setAttribute('aria-label','Put '+code+' on your Home Screen');d.body.appendChild(card);wire(card)}
  window.addEventListener('beforeinstallprompt',ev=>{ev.preventDefault();prompt=ev;draw()});
  window.addEventListener('appinstalled',()=>{hide()});
  draw();
  return where;
}
