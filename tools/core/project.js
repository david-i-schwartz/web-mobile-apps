/* ---------- project files: the picture, every setting, the edits and the progress in one file, so the work reopens exactly ---------- */
const PROJ_MAX=30e6;
HOOK.load.push(()=>{const nm=store.get(KEY+'name');if(typeof nm==='string')$('projName').value=nm.slice(0,60)});
$('projName').addEventListener('change',()=>store.set(KEY+'name',$('projName').value.trim().slice(0,60)));
function makeProject(){
  const o={app:SPEC.code,version:VERSION,core:SPEC.core,saved:new Date().toISOString(),name:$('projName').value.trim().slice(0,60)||SPEC.code+' project',settings:st};
  if(HAS.edit)o.edits=E;
  if(HAS.picture)o.image=srcUrl||null;
  if(HAS.progress&&shown())o.progress={W:pattern.W,H:pattern.H,keys:[...prog]};
  if(APP.projectOut)o.data=APP.projectOut();
  return JSON.stringify(o);
}
$('projSave').addEventListener('click',()=>saveFile(fileBase()+SPEC.ext,new Blob([makeProject()],{type:'application/json'}),$('projMsg')));
$('projIn').addEventListener('change',e=>{
  const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
  if(f.size>PROJ_MAX){txt('projMsg','That file is too big to be a '+SPEC.code+' project.');return}
  const rd=new FileReader();rd.onload=()=>openProject(String(rd.result));rd.onerror=()=>txt('projMsg','That file could not be read.');rd.readAsText(f);
});
function openProject(text){
  let o;try{o=JSON.parse(text)}catch(e){txt('projMsg','That file isn’t a '+SPEC.code+' project.');return}
  if(!o||typeof o!=='object'||![SPEC.code,...(SPEC.oldCodes||[])].includes(o.app)){txt('projMsg','That file isn’t a '+SPEC.code+' project.');return}
  st=tidy(o.settings);saveSettings();
  if(HAS.edit){E=tidyEdits(o.edits);undoStack=[];redoStack=[];saveEdits()}
  if(HAS.progress){const P=o.progress;pendingProg=P&&Number.isInteger(P.W)&&Number.isInteger(P.H)&&Array.isArray(P.keys)?{W:P.W,H:P.H,keys:P.keys.filter(k=>typeof k==='string'&&/^\d{1,4},\d{1,4}$/.test(k)).slice(0,200000)}:null;progKey=''}
  if(APP.projectIn)APP.projectIn(o.data);
  const name=typeof o.name==='string'?o.name.slice(0,60):'';$('projName').value=name;store.set(KEY+'name',name);
  txt('projMsg','Opened “'+(name||'the project')+'”.');say('Project opened.');
  if(HAS.picture){
    if(typeof o.image==='string'&&/^data:image\/(png|jpeg|webp|gif);base64,/.test(o.image)){loadImage(o.image,false);return}
    srcImg=null;imgCv=null;srcUrl='';store.del(KEY+'img');
  }
  rebuild();
}
