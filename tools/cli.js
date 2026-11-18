#!/usr/bin/env node
/* HTML App Generator from the command line, for Claude or any other AI (or a person) working on a computer.
     node cli.js new spec.json app.html             make an app from a spec
     node cli.js upgrade old-app.html app.html      remake an app on this core, keeping its spec and APP regions
     node cli.js upgrade old-app.html app.html spec.json   the same, with a new spec
     node cli.js spec app.html                      print the spec inside an app
     node cli.js brief spec.json|app.html           print the build brief to hand to an AI
     node cli.js test-brief spec.json|app.html      print the test brief for an independent reviewer (a different AI)
     node cli.js web app.html folder [--code FIG --name "..." --accent #0E7C7B --url https://...]
                                                    make a web folder for hosting: index.html, Home Screen icons, offline helper
     node cli.js site site.json folder              make a whole site: a front page plus a web folder for each app in site.json
                                                    (with "sections" in site.json and a "section" on each app, the front page groups them) */
const fs=require('fs'),path=require('path'),zlib=require('zlib'),G=require('./generate.js'),W=require('./web.js');
const here=__dirname,files={};
for(const f of G.coreFiles)files[f]=fs.readFileSync(path.join(here,f),'utf8');
const [cmd,a,b,c]=process.argv.slice(2);
const read=f=>fs.readFileSync(f,'utf8');
const specFrom=f=>f.endsWith('.html')?(()=>{const r=G.readApp(read(f));if(r.error)fail(r.error);return r.spec})():JSON.parse(read(f));
function fail(m){console.error(m);process.exit(1)}
function write(out,r){fs.writeFileSync(out,r.html);for(const n of r.notes)console.error('Note: '+n);
  console.log(`Made ${out}: ${r.spec.code}: ${r.spec.name} ${r.spec.version} (core ${G.CORE_VERSION}), ${(r.html.length/1024).toFixed(0)} KB.`)}
function flags(args){const o={};for(let i=0;i<args.length;i+=2){const k=(args[i]||'').replace(/^--/,'');if(k)o[k]=args[i+1]}return o}
/* one app's web folder on disk; icons are drawn as PNG */
function writeWeb(html,out,given){
  const r=W.webFolder(html,given,files);fs.mkdirSync(out,{recursive:true});
  for(const n in r.files)fs.writeFileSync(path.join(out,n),r.files[n]);
  for(const ic of r.icons)fs.writeFileSync(path.join(out,ic.name),W.pngFrom(W.iconPixels(ic.size,r.info.code,r.info.accent),ic.size,b=>zlib.deflateSync(b,{level:9})));
  return r;
}
/* a site: each app in its own folder (named after its short name), and a front page. Apps the generator made get the
   site's address for them written into their spec first, so a phone's file preview can point people to the real app. */
function site(cfg,dir,out){
  const base=(cfg.base||'').replace(/\/?$/,'/'),apps=[];fs.mkdirSync(out,{recursive:true});
  for(const a of cfg.apps){
    let html=read(path.resolve(dir,a.file));const folder=(a.folder||'').trim()||null;
    const r0=G.readApp(html),code=(a.code||(r0.error?W.infoOf(html,a).code:r0.spec.code)).toLowerCase(),f=folder||code,url=base?base+f+'/':'';
    if(!/^[a-z0-9][a-z0-9-]{0,40}$/.test(f)||['src','tools','tests','node_modules'].includes(f))fail(`"${f}" can't be a folder name: use lowercase letters, digits and hyphens, and not src, tools or tests.`);
    if(apps.some(x=>x.folder===f))fail(`Two apps want the folder "${f}". Give one a different "folder" in site.json.`);
    if(!r0.error&&url){const s={...r0.spec,homeUrl:url};html=G.generate(s,files,r0.regions).html}
    const r=writeWeb(html,path.join(out,f),{...a,url});apps.push({...r.info,folder:f,section:a.section});
    if(a.keep)fs.writeFileSync(path.join(out,f,a.keep),html);
    console.log(`  ${f}/  ${r.info.code}: ${r.info.name}${r.info.generated?'':' (Home Screen helper added)'}`);
  }
  const groups=W.groupApps(cfg.sections,apps);
  for(const g of groups)if(g.id==='more-apps')console.error(`Note: ${g.apps.map(x=>x.folder).join(', ')} ${g.apps.length===1?'has':'have'} no "section" from the "sections" list in site.json, so ${g.apps.length===1?'it goes':'they go'} under More Apps.`);
  fs.writeFileSync(path.join(out,'index.html'),W.siteIndex({title:cfg.title||'Apps',tagline:cfg.tagline||'',accent:cfg.accent||'#3D4FB5',foot:cfg.foot||'',sections:cfg.sections},apps,files));
  fs.writeFileSync(path.join(out,'.nojekyll'),'');
  /* the README's app list follows site.json: a line "__APPS__" becomes one line per app, under a heading per section if there are sections */
  const line=x=>`- [\`${x.folder}/\`](${base?base+x.folder+'/':x.folder+'/'}): ${x.code}, ${x.name}`;
  const list=groups.length?groups.map(g=>`### ${g.name}\n\n${g.apps.map(line).join('\n')}`).join('\n\n'):apps.map(line).join('\n');
  if(cfg.readme)fs.writeFileSync(path.join(out,'README.md'),cfg.readme.map(l=>l==='__APPS__'?list:l).join('\n')+'\n');
  console.log(`Made the site in ${out}: a front page and ${apps.length} apps.`);
}
if(cmd==='new'&&a&&b)write(b,G.generate(specFrom(a),files));
else if(cmd==='upgrade'&&a&&b){const r=G.readApp(read(a));if(r.error)fail(r.error);write(b,G.generate(c?specFrom(c):r.spec,files,r.regions))}
else if(cmd==='spec'&&a){const r=G.readApp(read(a));if(r.error)fail(r.error);console.log(JSON.stringify(r.spec,null,2))}
else if(cmd==='brief'&&a)console.log(G.brief(specFrom(a)));
else if(cmd==='test-brief'&&a)console.log(G.testBrief(specFrom(a)));
else if(cmd==='web'&&a&&b){const r=writeWeb(read(a),b,flags(process.argv.slice(5)));console.log(`Made the web folder ${b} for ${r.info.code}.`)}
else if(cmd==='site'&&a&&b)site(JSON.parse(read(a)),path.dirname(path.resolve(a)),b);
else fail('Usage:\n  node cli.js new spec.json app.html\n  node cli.js upgrade old-app.html app.html [spec.json]\n  node cli.js spec app.html\n  node cli.js brief spec.json|app.html\n  node cli.js test-brief spec.json|app.html\n  node cli.js web app.html folder [--code X --name N --accent #hex --url https://...]\n  node cli.js site site.json folder');
