/* ---------- export: a picture of the pattern, and lists to copy or save ---------- */
function paintPNG(){
  const p=pattern,U=Math.max(8,Math.floor(2400/Math.max(p.Wpx,p.Hpx))),cv=document.createElement('canvas');
  cv.width=Math.ceil(p.Wpx*U);cv.height=Math.ceil(p.Hpx*U);const g=cv.getContext('2d');
  g.fillStyle='#FFFFFF';g.fillRect(0,0,cv.width,cv.height);
  for(let by=0;by<p.down;by++)for(let bx=0;bx<p.across;bx++){g.fillStyle='#DCE1E8';g.fillRect((PAD-.1+bx*(p.bw+GAP))*U,(PAD-.1+by*(p.bh+GAP))*U,(p.bw+.2)*U,(p.bh+.2)*U)}
  for(let i=0;i<p.W*p.H;i++){const x=i%p.W,y=(i-x)/p.W,X=p.X(x)*U,Y=p.Y(y)*U,c=p.c[i];
    const dot=(r,f)=>{g.beginPath();g.arc(X,Y,r*U,0,Math.PI*2);g.fillStyle=f;g.fill()};
    if(c<0){dot(0.2,'#B4BBC6');continue}
    const hex=APP.palette[c].hex;
    if(APP.cellPaint&&APP.cellPaint(g,{i,x,y,cx:X,cy:Y,c,hex},U)!==false)continue;
    if(SHAPE==='square'||SHAPE==='stud'){g.fillStyle=hex;g.fillRect(X-U/2,Y-U/2,U+0.5,U+0.5)}
    else if(SHAPE==='rounded'){g.fillStyle=hex;g.beginPath();if(g.roundRect)g.roundRect(X-.46*U,Y-.46*U,.92*U,.92*U,.2*U);else g.rect(X-.46*U,Y-.46*U,.92*U,.92*U);g.fill()}
    else dot(0.46,hex);
    if(SHAPE==='stud'){g.beginPath();g.arc(X,Y,0.3*U,0,Math.PI*2);g.fillStyle='rgba(255,255,255,.16)';g.fill();g.strokeStyle='rgba(0,0,0,.3)';g.lineWidth=0.06*U;g.stroke()}
    if(SHAPE==='bead')dot(0.16,'#DCE1E8');
  }
  return cv;
}
$('pngSave').addEventListener('click',()=>{
  if(!shown())return;
  paintPNG().toBlob(b=>{if(b)saveFile(fileBase()+'.png',b,$('pngMsg'));else txt('pngMsg','The picture could not be made here.')},'image/png');
});
const placedOf=i=>HAS.progress&&prog.has(kOf(i))?'yes':'no';
const LISTS=[
  {id:'colours',label:'Colour counts (CSV)',ext:'.csv',make(){
    const p=pattern,cnt=new Map();for(let i=0;i<p.W*p.H;i++){const c=p.c[i];if(c<0)continue;const r=cnt.get(c)||[0,0];r[0]++;if(placedOf(i)==='yes')r[1]++;cnt.set(c,r)}
    return'colour,code,hex,count,placed\n'+[...cnt.keys()].sort((a,b)=>cnt.get(b)[0]-cnt.get(a)[0]||a-b).map(c=>{const P=APP.palette[c];return[csv(P.name),csv(P.code),P.hex,cnt.get(c)[0],cnt.get(c)[1]].join(',')}).join('\n')}},
  {id:'cells',label:'Every '+APP.unit.one+' (CSV)',ext:'.csv',make(){
    const p=pattern,many=p.across>1||p.down>1,out=[(many?'board_across,board_down,column,row,':'')+'overall_column,overall_row,colour,code,placed'];
    for(let i=0;i<p.W*p.H;i++){const c=p.c[i];if(c<0)continue;const x=i%p.W,y=(i-x)/p.W,P=APP.palette[c];
      out.push((many?[Math.floor(x/p.bw)+1,Math.floor(y/p.bh)+1,x%p.bw+1,y%p.bh+1,'']:[]).join(',')+[x+1,y+1,csv(P.name),csv(P.code),placedOf(i)].join(','))}
    return out.join('\n')}}];
const allLists=()=>LISTS.concat(APP.lists||[]);
HOOK.start.push(()=>{$('expKind').innerHTML=allLists().map(l=>`<option value="${esc(l.id)}">${esc(l.label)}</option>`).join('')});
function exportText(){if(!shown())return'';const l=allLists().find(l=>l.id===$('expKind').value)||allLists()[0];return l?l.make():''}
$('expDetails').addEventListener('toggle',()=>{if($('expDetails').open)$('expText').value=exportText()});
$('expKind').addEventListener('change',()=>{$('expText').value=exportText()});
HOOK.after.push(()=>{if($('expDetails').open)$('expText').value=exportText()});
$('copyBtn').addEventListener('click',async()=>{const t=$('expText');t.value=exportText();
  try{await navigator.clipboard.writeText(t.value);txt('copyMsg','Copied.')}catch(e){t.select();txt('copyMsg','The list is selected: copy it with Ctrl+C or ⌘C.')}});
$('listSave').addEventListener('click',()=>{const l=allLists().find(l=>l.id===$('expKind').value);if(!l||!shown())return;
  saveFile(fileBase()+'-'+l.id+(l.ext||'.txt'),new Blob([l.make()],{type:'text/plain'}),$('copyMsg'))});
HOOK.sync.push(()=>{const ok=shown();$('pngSave').disabled=!ok;$('listSave').disabled=!ok;$('copyBtn').disabled=!ok});
