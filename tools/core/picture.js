/* ---------- picture: a picture in, one palette colour per cell out ----------
   Choose, paste or drop a picture; crop it; leave its background empty; adjust it; then match every cell to the palette
   with dithering and clean-up. This is the pipeline FIG and BIG share, made general. */
const SRC_MAX=600;                       /* a loaded picture is shrunk so its longer side is at most this many pixels */
const ALL_COLOURS=APP.palette.length;    /* the top of the Max colours slider, shown as "All" */
const BAYER_SPREAD=64;                   /* ordered-dither strength at 100% */
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const box01=c=>{if(!c||![c.x,c.y,c.w,c.h].every(Number.isFinite)||c.w<=0||c.h<=0)return{x:0,y:0,w:1,h:1};
  const w=clamp(c.w,0.001,1),h=clamp(c.h,0.001,1);return{x:clamp(c.x,0,1-w),y:clamp(c.y,0,1-h),w,h}};
addSettings({img:{crop:{x:0,y:0,w:1,h:1},free:{x:0,y:0,w:1,h:1},sampling:'average',metric:'cie76',dither:'none',ditherAmt:100,rare:0,maxColors:ALL_COLOURS,off:[],
    bg:false,bgTol:40,bgCol:null,bgPt:null,adjB:0,adjC:0,adjS:0,adjH:0,adjW:0,specks:0,smooth:0,outline:'none'}},
  {'img.sampling':['average','nearest','dominant','median'],'img.metric':['rgb','cie76','de2000','oklab'],'img.dither':['none','fs','atk','ordered'],'img.outline':['none','in','out']},
  {'img.ditherAmt':[10,100],'img.rare':[0,40],'img.maxColors':[2,ALL_COLOURS],'img.bgTol':[0,160],'img.adjB':[-100,100],'img.adjC':[-100,100],
   'img.adjS':[-100,100],'img.adjH':[-180,180],'img.adjW':[-100,100],'img.specks':[0,8],'img.smooth':[0,3]},
  (o,s)=>{const I=s.img&&typeof s.img==='object'?s.img:{};
    o.img.bgCol=typeof I.bgCol==='string'&&/^#[0-9A-F]{6}$/i.test(I.bgCol)?I.bgCol.toUpperCase():null;
    o.img.bgPt=I.bgPt&&Number.isFinite(I.bgPt.x)&&Number.isFinite(I.bgPt.y)?{x:clamp(I.bgPt.x,0,1),y:clamp(I.bgPt.y,0,1)}:null;
    o.img.crop=box01(o.img.crop);o.img.free=box01(o.img.free);
    o.img.off=[...new Set(o.img.off.filter(n=>typeof n==='string'&&PAL_BY.has(n)))];if(o.img.off.length>ALL_COLOURS-2)o.img.off=[]});
CREDITS.push('Oklab is by Björn Ottosson, published in the public domain. CIEDE2000 follows Sharma, Wu and Dalal (2005).');

let srcImg=null,imgCv=null,srcUrl='',outlined=0,picking=false,loadSeq=0;

/* ---------- colour helpers shared with FIG and BIG ---------- */
/* Oklab (Björn Ottosson, 2020; published in the public domain): a perceptual colour space. Input is sRGB, 0 to 255. */
function toOklab(r,g,b){
  const f=c=>{c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4)};
  const R=f(r),G=f(g),B=f(b);
  const l=Math.cbrt(0.4122214708*R+0.5363325363*G+0.0514459929*B),m=Math.cbrt(0.2119034982*R+0.6806995451*G+0.1073969566*B),s=Math.cbrt(0.0883024619*R+0.2817188376*G+0.6299787005*B);
  return[0.2104542553*l+0.7936177850*m-0.0040720468*s,1.9779984951*l-2.4285922050*m+0.4505937099*s,0.0259040371*l+0.7827717662*m-0.8086757660*s];
}
/* Picture adjustments on the sampled colours (three numbers per cell in `rgb`), for every cell where ok(k) is true.
   br, ct, sat and warm run from -100 to 100 and hue from -180 to 180 degrees; 0 changes nothing. */
function adjustRgb(rgb,n,ok,a){
  const C=a.ct*1.5,f=(259*(C+255))/(255*(259-C)),sat=1+a.sat/100,w=a.warm*0.4,h=a.hue*Math.PI/180,ch=Math.cos(h),sh=Math.sin(h),turn=a.sat!==0||a.hue!==0;
  const cl=v=>v<0?0:v>255?255:v;
  for(let k=0;k<n;k++){
    if(!ok(k))continue;
    let r=f*(rgb[k*3]+w-128)+128+a.br,g=f*(rgb[k*3+1]-128)+128+a.br,b=f*(rgb[k*3+2]-w-128)+128+a.br;
    if(turn){   /* YIQ: Y is brightness; the colour part (I, Q) is scaled for saturation and rotated for hue */
      const y=0.299*r+0.587*g+0.114*b,i=(0.596*r-0.274*g-0.322*b)*sat,q=(0.211*r-0.523*g+0.312*b)*sat,i2=i*ch-q*sh,q2=i*sh+q*ch;
      r=y+0.956*i2+0.621*q2;g=y-0.272*i2-0.647*q2;b=y-1.106*i2+1.703*q2;
    }
    rgb[k*3]=cl(r);rgb[k*3+1]=cl(g);rgb[k*3+2]=cl(b);
  }
}
/* One cell's colour from the pixels of its area (columns x0 to x1, rows y0 to y1 of an RGBA picture `sw` pixels wide).
   'dominant' = the most common colour, counted in coarse steps of 16 per channel; 'median' = the pixel of middle brightness.
   See-through pixels do not vote. Returns [r, g, b, average alpha]. */
function cellPick(data,sw,x0,x1,y0,y1,mode){
  let sa=0,m=0;const px=[];
  for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){const i=(yy*sw+xx)*4;sa+=data[i+3];m++;if(data[i+3]>=128)px.push(i)}
  const a=m?sa/m:0;if(!px.length)return[0,0,0,a];
  if(mode==='median'){
    const lum=i=>0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];
    px.sort((p,q)=>lum(p)-lum(q)||p-q);const i=px[(px.length-1)>>1];return[data[i],data[i+1],data[i+2],a];
  }
  const bins=new Map();let best=null;
  for(const i of px){
    const key=(data[i]>>4)<<8|(data[i+1]>>4)<<4|data[i+2]>>4;let t=bins.get(key);if(!t){t=[0,0,0,0];bins.set(key,t)}
    t[0]++;t[1]+=data[i];t[2]+=data[i+1];t[3]+=data[i+2];if(!best||t[0]>best[0])best=t;
  }
  return[best[1]/best[0],best[2]/best[0],best[3]/best[0],a];
}
/* The clean-up steps work on `pick`: one palette number per cell, -1 for an empty cell. `near(k)` lists cell k's neighbours.
   Smooth: a cell takes the colour that more than half of its neighbourhood (itself included) shares. Empty cells do not vote and stay empty. */
function smoothPick(pick,n,near,passes){
  for(let p=0;p<passes;p++){
    const was=Int16Array.from(pick);let changed=0;
    for(let k=0;k<n;k++){
      if(was[k]<0)continue;
      const cnt=new Map([[was[k],1]]);let tot=1,bi=was[k],bc=1;
      for(const j of near(k)){const c=was[j];if(c<0)continue;tot++;const v=(cnt.get(c)||0)+1;cnt.set(c,v);if(v>bc){bc=v;bi=c}}
      if(bi!==was[k]&&bc*2>tot){pick[k]=bi;changed++}
    }
    if(!changed)break;
  }
}
/* Remove specks: a connected patch of one colour with `max` cells or fewer is given to the colour that touches it most.
   A patch that touches no other cell (an island among empty cells) is left alone. */
function mergeSpecks(pick,n,near,max){
  for(let round=0;round<4;round++){
    const seen=new Uint8Array(n);let changed=0;
    for(let s=0;s<n;s++){
      if(seen[s]||pick[s]<0)continue;
      const col=pick[s],patch=[s];seen[s]=1;
      for(let h=0;h<patch.length;h++)for(const j of near(patch[h]))if(!seen[j]&&pick[j]===col){seen[j]=1;patch.push(j)}
      if(patch.length>max)continue;
      const around=new Map();let bi=-1,bc=0;
      for(const k of patch)for(const j of near(k)){const c=pick[j];if(c<0||c===col)continue;const v=(around.get(c)||0)+1;around.set(c,v);if(v>bc){bc=v;bi=c}}
      if(bi<0)continue;
      for(const k of patch)pick[k]=bi;changed++;
    }
    if(!changed)break;
  }
}
/* Outline: a one-cell line of palette colour `oc` where cells meet empty ones. 'in' recolours the edge cells; 'out' fills the
   empty cells beside them. Returns how many cells it changed. */
function outlinePick(pick,n,near,mode,oc){
  const inside=mode==='in',hit=[];
  for(let k=0;k<n;k++){
    const full=pick[k]>=0;if(full!==inside)continue;
    for(const j of near(k))if((pick[j]>=0)!==full){hit.push(k);break}
  }
  for(const k of hit)pick[k]=oc;
  return hit.length;
}
function hexRgb(h){const n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
function dist(a,b){const rm=(a[0]+b[0])/2,dr=a[0]-b[0],dg=a[1]-b[1],db=a[2]-b[2];return(2+rm/256)*dr*dr+4*dg*dg+(2+(255-rm)/256)*db*db}
function toLab(r,g,b){
  const f=c=>{c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4)};
  const R=f(r),G=f(g),B=f(b),h=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116;
  const X=h((R*0.4124+G*0.3576+B*0.1805)/0.95047),Y=h(R*0.2126+G*0.7152+B*0.0722),Z=h((R*0.0193+G*0.1192+B*0.9505)/1.08883);
  return[116*Y-16,500*(X-Y),200*(Y-Z)];
}
/* nearest palette colour in Lab, then drop the least useful colours until at most maxC remain */
function catalogAssign(P,rgb,solid,empty,n,maxC){
  const NP=P.length,PL=new Float32Array(NP*3);
  P.forEach((p,i)=>{const c=hexRgb(p.hex),l=toLab(c[0],c[1],c[2]);PL[i*3]=l[0];PL[i*3+1]=l[1];PL[i*3+2]=l[2]});
  const idx=[];for(let k=0;k<n;k++)if(solid[k]&&!empty[k])idx.push(k);
  const m=idx.length,BL=new Float32Array(m*3);
  idx.forEach((k,j)=>{const l=toLab(rgb[k*3],rgb[k*3+1],rgb[k*3+2]);BL[j*3]=l[0];BL[j*3+1]=l[1];BL[j*3+2]=l[2]});
  const best=new Int32Array(m),sec=new Int32Array(m),d1=new Float64Array(m),d2=new Float64Array(m);
  let S=[];for(let i=0;i<NP;i++)S.push(i);
  const scan=j=>{const a=BL[j*3],b=BL[j*3+1],c=BL[j*3+2];let bi=-1,si=-1,bd=Infinity,sd=Infinity;
    for(const i of S){const x=a-PL[i*3],y=b-PL[i*3+1],z=c-PL[i*3+2],v=x*x+y*y+z*z;
      if(v<bd){si=bi;sd=bd;bi=i;bd=v}else if(v<sd){si=i;sd=v}}
    best[j]=bi;sec[j]=si;d1[j]=bd;d2[j]=sd};
  for(let j=0;j<m;j++)scan(j);
  S=[...new Set(best)];for(let j=0;j<m;j++)scan(j);
  const cost=new Float64Array(NP);
  while(S.length>Math.max(1,maxC)){
    S.forEach(i=>cost[i]=0);
    for(let j=0;j<m;j++)cost[best[j]]+=sec[j]>=0?d2[j]-d1[j]:1e12;
    let drop=S[0];for(const i of S)if(cost[i]<cost[drop])drop=i;
    S=S.filter(i=>i!==drop);
    for(let j=0;j<m;j++)if(best[j]===drop||sec[j]===drop)scan(j);
  }
  return{idx,best};
}
/* CIEDE2000 colour difference (Sharma, Wu and Dalal 2005) */
function de2000(L1,a1,b1,L2,a2,b2){
  const D=Math.PI/180,P7=6103515625,C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cb=(C1+C2)/2,Cb7=Cb**7;
  const G=0.5*(1-Math.sqrt(Cb7/(Cb7+P7))),a1p=(1+G)*a1,a2p=(1+G)*a2,C1p=Math.hypot(a1p,b1),C2p=Math.hypot(a2p,b2);
  const hue=(b,a)=>{if(a===0&&b===0)return 0;const t=Math.atan2(b,a)/D;return t<0?t+360:t};
  const h1=hue(b1,a1p),h2=hue(b2,a2p),zero=C1p*C2p===0;
  let dh=0;if(!zero){dh=h2-h1;if(dh>180)dh-=360;else if(dh<-180)dh+=360}
  const dL=L2-L1,dC=C2p-C1p,dH=2*Math.sqrt(C1p*C2p)*Math.sin(dh*D/2),Lb=(L1+L2)/2,Cbp=(C1p+C2p)/2;
  let hb=h1+h2;if(!zero)hb=Math.abs(h1-h2)>180?(hb<360?hb+360:hb-360)/2:hb/2;
  const T=1-0.17*Math.cos((hb-30)*D)+0.24*Math.cos(2*hb*D)+0.32*Math.cos((3*hb+6)*D)-0.20*Math.cos((4*hb-63)*D);
  const dT=30*Math.exp(-(((hb-275)/25)**2)),Cbp7=Cbp**7,RC=2*Math.sqrt(Cbp7/(Cbp7+P7));
  const SL=1+0.015*(Lb-50)**2/Math.sqrt(20+(Lb-50)**2),SC=1+0.045*Cbp,SH=1+0.015*Cbp*T,RT=-Math.sin(2*dT*D)*RC;
  return Math.sqrt((dL/SL)**2+(dC/SC)**2+(dH/SH)**2+RT*(dC/SC)*(dH/SH));
}
/* Auto-trim: shave rows and columns off each edge while 99% of their pixels are one flat colour */
function autoTrimBox(){
  const {w,h,data}=srcImg,T=24;
  const px=(x,y)=>{const i=(y*w+x)*4;return[data[i],data[i+1],data[i+2],data[i+3]]};
  const same=(p,q)=>(p[3]<128&&q[3]<128)||(p[3]>=128&&q[3]>=128&&Math.abs(p[0]-q[0])<=T&&Math.abs(p[1]-q[1])<=T&&Math.abs(p[2]-q[2])<=T);
  const flat=pts=>{const n=pts.length,cand=[pts[0],pts[n>>2],pts[n>>1],pts[(3*n)>>2],pts[n-1]];
    let best=0;for(const c of cand){let k=0;for(const p of pts)if(same(p,c))k++;best=Math.max(best,k)}return best>=n*0.99};
  const row=(y,x0,x1)=>{const a=[];for(let x=x0;x<x1;x++)a.push(px(x,y));return a};
  const col=(x,y0,y1)=>{const a=[];for(let y=y0;y<y1;y++)a.push(px(x,y));return a};
  let t=0,b=h,l=0,r=w;const MIN=4;
  let moved=true;
  while(moved){moved=false;
    if(b-t>MIN&&flat(row(t,l,r))){t++;moved=true}
    if(b-t>MIN&&flat(row(b-1,l,r))){b--;moved=true}
    if(r-l>MIN&&flat(col(l,t,b))){l++;moved=true}
    if(r-l>MIN&&flat(col(r-1,t,b))){r--;moved=true}
  }
  return {x:l/w,y:t/h,w:(r-l)/w,h:(b-t)/h,changed:t>0||l>0||b<h||r<w};
}

/* ---------- conversion ---------- */
function usePal(){const off=new Set(st.img.off);return APP.palette.filter(c=>!off.has(c.name))}
function cropPx(){const c=st.img.crop;return{x:c.x*srcImg.w,y:c.y*srcImg.h,w:Math.max(1,c.w*srcImg.w),h:Math.max(1,c.h*srcImg.h)}}
const hasAdj=()=>{const a=st.img;return!!(a.adjB||a.adjC||a.adjS||a.adjH||a.adjW)};
const adjArgs=()=>({br:st.img.adjB,ct:st.img.adjC,sat:st.img.adjS,hue:st.img.adjH,warm:st.img.adjW});
/* the darkest colour in a palette, for the outline */
function darkest(P){let bi=-1,bl=Infinity;P.forEach((p,i)=>{const c=hexRgb(p.hex),L=toLab(c[0],c[1],c[2])[0];if(L<bl){bl=L;bi=i}});return bi}
/* Pick a palette entry for every sample: colour limit, then matching with dithering, then clean-up and the rare-colour merge.
   o.fwd / o.fwdA list [neighbour, weight] pairs for error diffusion and o.xy gives grid coordinates for ordered dithering. */
function assign(P,rgb,solid,empty,n,o){
  const pick=new Int16Array(n).fill(-1),live=k=>solid[k]&&!empty[k];
  let S;
  if(st.img.maxColors<ALL_COLOURS){const {best}=catalogAssign(P,rgb,solid,empty,n,st.img.maxColors);S=[...new Set(best)].filter(i=>i>=0)}
  else S=P.map((p,i)=>i);
  if(!S.length)return pick;
  const M=st.img.metric,PR=P.map(p=>hexRgb(p.hex)),PL=PR.map(c=>toLab(c[0],c[1],c[2]));
  /* closest entry; for the Lab formulas the search runs outward in lightness and stops once the lightness gap rules out the rest */
  const finder=set=>{
    if(M==='rgb')return(r,g,b)=>{const px=[r,g,b];let bi=-1,bd=Infinity;for(const i of set){const d=dist(px,PR[i]);if(d<bd){bd=d;bi=i}}return bi};
    if(M==='oklab'){
      const O=new Float64Array(set.length*3);set.forEach((i,p)=>{const v=toOklab(PR[i][0],PR[i][1],PR[i][2]);O[p*3]=v[0];O[p*3+1]=v[1];O[p*3+2]=v[2]});
      return(r,g,b)=>{const v=toOklab(r,g,b);let bp=-1,bd=Infinity;
        for(let p=0;p<set.length;p++){const x=v[0]-O[p*3],y=v[1]-O[p*3+1],z=v[2]-O[p*3+2],d=x*x+y*y+z*z;if(d<bd){bd=d;bp=p}}
        return bp<0?-1:set[bp]};
    }
    const m=set.length,de=M==='de2000',ord=set.map((_,p)=>p).sort((a,b)=>PL[set[a]][0]-PL[set[b]][0]),Ls=ord.map(p=>PL[set[p]][0]);
    const F=new Float64Array(m*3);set.forEach((i,p)=>{F[p*3]=PL[i][0];F[p*3+1]=PL[i][1];F[p*3+2]=PL[i][2]});
    return(r,g,b)=>{
      const l=toLab(r,g,b),L=l[0];let lo=0,hi=m;
      while(lo<hi){const mid=(lo+hi)>>1;if(Ls[mid]<L)lo=mid+1;else hi=mid}
      let up=lo,dn=lo-1,bd=Infinity,bp=-1;
      if(de){let sv=Infinity,sp=-1;for(let p=0;p<m;p++){const x=L-F[p*3],y=l[1]-F[p*3+1],z=l[2]-F[p*3+2],v=x*x+y*y+z*z;if(v<sv){sv=v;sp=p}}
        if(sp>=0){bd=de2000(L,l[1],l[2],F[sp*3],F[sp*3+1],F[sp*3+2]);bp=sp}}
      for(;;){
        const du=up<m?Ls[up]-L:Infinity,dd=dn>=0?L-Ls[dn]:Infinity,gap=Math.min(du,dd);
        if(!(gap<Infinity)||(de?gap/1.75:gap*gap)>bd)break;
        const p=du<=dd?ord[up++]:ord[dn--];
        const d=de?de2000(L,l[1],l[2],F[p*3],F[p*3+1],F[p*3+2]):(L-F[p*3])**2+(l[1]-F[p*3+1])**2+(l[2]-F[p*3+2])**2;
        if(d<bd||(d===bd&&p<bp)){bd=d;bp=p}
      }
      return bp<0?-1:set[bp]};
  };
  const find=finder(S);
  const amt=st.img.ditherAmt/100,DM=st.img.dither,fw=DM==='fs'?o.fwd:DM==='atk'?o.fwdA:null;
  if(fw){
    const w=Float32Array.from(rgb);
    for(let k=0;k<n;k++){if(!live(k))continue;
      const r=clamp(w[k*3],0,255),g=clamp(w[k*3+1],0,255),b=clamp(w[k*3+2],0,255),i=find(r,g,b);pick[k]=i;if(i<0)continue;
      const er=(r-PR[i][0])*amt,eg=(g-PR[i][1])*amt,eb=(b-PR[i][2])*amt;
      for(const [j,f] of fw(k))if(live(j)){w[j*3]+=er*f;w[j*3+1]+=eg*f;w[j*3+2]+=eb*f}}
  }else if(DM==='ordered'){
    const sp=BAYER_SPREAD*amt;
    for(let k=0;k<n;k++){if(!live(k))continue;const [x,y]=o.xy(k),t=((BAYER[(x&3)+((y&3)<<2)]+0.5)/16-0.5)*sp;
      pick[k]=find(clamp(rgb[k*3]+t,0,255),clamp(rgb[k*3+1]+t,0,255),clamp(rgb[k*3+2]+t,0,255))}
  }else for(let k=0;k<n;k++)if(live(k))pick[k]=find(rgb[k*3],rgb[k*3+1],rgb[k*3+2]);
  if(o.post)o.post(pick);
  const R=st.img.rare;
  if(R>0)for(;;){
    const cnt=new Map();for(let k=0;k<n;k++)if(pick[k]>=0)cnt.set(pick[k],(cnt.get(pick[k])||0)+1);
    if(cnt.size<=1)break;
    let lo=-1,lc=Infinity;cnt.forEach((c,i)=>{if(c<lc){lc=c;lo=i}});
    if(lc>=R)break;
    const again=finder([...cnt.keys()].filter(i=>i!==lo));
    for(let k=0;k<n;k++)if(pick[k]===lo)pick[k]=again(rgb[k*3],rgb[k*3+1],rgb[k*3+2]);
  }
  return pick;
}
/* the whole conversion: c0 = palette number per cell (-1 empty), lum = lightness 0 to 1 per cell */
CONVERT=function(d){
  const iw=d.W,ih=d.H,n=iw*ih,out={W:iw,H:ih,c0:new Int16Array(n).fill(-1),lum:new Float32Array(n)};
  outlined=0;
  if(!srcImg)return out;
  const {w:sw,h:sh,data}=srcImg,c=cropPx();
  const rgb=new Float32Array(n*3),solid=new Uint8Array(n),mode=st.img.sampling,near=mode==='nearest';
  for(let y=0;y<ih;y++)for(let x=0;x<iw;x++){
    let r,g,b,a;
    if(near){
      const sx=clamp(Math.floor(c.x+(x+0.5)*c.w/iw),0,sw-1),sy=clamp(Math.floor(c.y+(y+0.5)*c.h/ih),0,sh-1),i=(sy*sw+sx)*4;
      r=data[i];g=data[i+1];b=data[i+2];a=data[i+3];
    }else{
      const x0=clamp(Math.floor(c.x+x*c.w/iw),0,sw-1),x1=clamp(Math.max(x0+1,Math.floor(c.x+(x+1)*c.w/iw)),1,sw);
      const y0=clamp(Math.floor(c.y+y*c.h/ih),0,sh-1),y1=clamp(Math.max(y0+1,Math.floor(c.y+(y+1)*c.h/ih)),1,sh);
      if(mode!=='average')[r,g,b,a]=cellPick(data,sw,x0,x1,y0,y1,mode);
      else{let sr=0,sg=0,sb=0,sa=0,m=0;
        for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){const i=(yy*sw+xx)*4,al=data[i+3];sr+=data[i]*al;sg+=data[i+1]*al;sb+=data[i+2]*al;sa+=al;m++}
        a=m?sa/m:0;r=sa?sr/sa:0;g=sa?sg/sa:0;b=sa?sb/sa:0}
    }
    const k=y*iw+x;rgb[k*3]=r;rgb[k*3+1]=g;rgb[k*3+2]=b;solid[k]=a>=128?1:0;
  }
  /* background: flood from the picture's edges (and a tapped spot) through colours close to the background colour */
  const empty=new Uint8Array(n);
  if(st.img.bg){
    const d2=(k,q)=>{const dr=rgb[k*3]-q[0],dg=rgb[k*3+1]-q[1],db=rgb[k*3+2]-q[2];return dr*dr+dg*dg+db*db};
    const cs=[0,iw-1,(ih-1)*iw,ih*iw-1].filter(k=>solid[k]).map(k=>[rgb[k*3],rgb[k*3+1],rgb[k*3+2]]);
    const pc=st.img.bgCol?hexRgb(st.img.bgCol):null;
    if(pc||cs.length){
      let bg=pc||cs[0],bs=Infinity;
      if(!pc)cs.forEach(q=>{let t=0;cs.forEach(o=>{t+=(q[0]-o[0])**2+(q[1]-o[1])**2+(q[2]-o[2])**2});if(t<bs){bs=t;bg=q}});
      const T=st.img.bgTol*st.img.bgTol,ok=k=>solid[k]&&!empty[k]&&d2(k,bg)<=T,qu=[];
      const push=k=>{if(ok(k)){empty[k]=1;qu.push(k)}};
      for(let x=0;x<iw;x++){push(x);push((ih-1)*iw+x)}
      for(let y=0;y<ih;y++){push(y*iw);push(y*iw+iw-1)}
      if(pc&&st.img.bgPt){const x=Math.floor((st.img.bgPt.x*sw-c.x)/c.w*iw),y=Math.floor((st.img.bgPt.y*sh-c.y)/c.h*ih);if(x>=0&&x<iw&&y>=0&&y<ih)push(y*iw+x)}
      while(qu.length){const k=qu.pop(),x=k%iw,y=(k-x)/iw;if(x>0)push(k-1);if(x<iw-1)push(k+1);if(y>0)push(k-iw);if(y<ih-1)push(k+iw)}
    }
  }
  if(hasAdj())adjustRgb(rgb,n,k=>solid[k]&&!empty[k],adjArgs());
  for(let k=0;k<n;k++)out.lum[k]=toLab(rgb[k*3],rgb[k*3+1],rgb[k*3+2])[0]/100;
  const P=usePal();
  const near4=k=>{const x=k%iw,y=(k-x)/iw,o=[];if(x>0)o.push(k-1);if(x+1<iw)o.push(k+1);if(y>0)o.push(k-iw);if(y+1<ih)o.push(k+iw);return o};
  const near8=k=>{const x=k%iw,y=(k-x)/iw,o=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if((dx||dy)&&X>=0&&X<iw&&Y>=0&&Y<ih)o.push(Y*iw+X)}return o};
  const post=st.img.smooth||st.img.specks?pick=>{if(st.img.smooth)smoothPick(pick,n,near8,st.img.smooth);if(st.img.specks)mergeSpecks(pick,n,near4,st.img.specks)}:null;
  const pick=assign(P,rgb,solid,empty,n,{
    fwd:k=>{const x=k%iw,y=(k-x)/iw,o=[];if(x+1<iw)o.push([k+1,7/16]);
      if(y+1<ih){if(x>0)o.push([k+iw-1,3/16]);o.push([k+iw,5/16]);if(x+1<iw)o.push([k+iw+1,1/16])}return o},
    fwdA:k=>{const x=k%iw,y=(k-x)/iw,o=[],e=1/8;if(x+1<iw)o.push([k+1,e]);if(x+2<iw)o.push([k+2,e]);
      if(y+1<ih){if(x>0)o.push([k+iw-1,e]);o.push([k+iw,e]);if(x+1<iw)o.push([k+iw+1,e])}if(y+2<ih)o.push([k+2*iw,e]);return o},
    xy:k=>[k%iw,Math.floor(k/iw)],post});
  if(st.img.outline!=='none'){const oc=darkest(P);if(oc>=0)outlined=outlinePick(pick,n,near4,st.img.outline,oc)}
  for(let k=0;k<n;k++)out.c0[k]=pick[k]>=0?P[pick[k]].i:-1;
  return out;
};

/* ---------- crop: with boards the box keeps their shape; without, it is free and the height follows it ---------- */
const lockA=()=>BOARDS.length?(()=>{const d=dims();return d.W/d.H})():0;
picAspect=()=>!BOARDS.length&&srcImg?(st.img.crop.w*srcImg.w)/(st.img.crop.h*srcImg.h):0;
/* the biggest box of the locked shape inside box b (fractions of the picture), centred in it */
function fitBox(b){if(!lockA())return box01(b);const sw=srcImg.w,sh=srcImg.h,A=lockA();let w=b.w*sw,h=b.h*sh;if(w/h>A)w=h*A;else h=w/A;
  return{x:b.x+(b.w-w/sw)/2,y:b.y+(b.h-h/sh)/2,w:w/sw,h:h/sh}}
/* after the boards change shape: keep the crop's centre and how far it is zoomed in, relative to the biggest box that fits */
function maxWH(A){const f=st.img.free;let w=f.w*srcImg.w,h=f.h*srcImg.h;if(w/h>A)w=h*A;else h=w/A;return[w,h]}
function reAspect(){
  if(!srcImg||!lockA())return;const sw=srcImg.w,sh=srcImg.h,c=st.img.crop,oldA=c.w*sw/(c.h*sh),A=lockA();
  const z=clamp(c.w*sw/maxWH(oldA)[0],0.05,1);let[w,h]=maxWH(A);w*=z;h*=z;
  const cx=(c.x+c.w/2)*sw,cy=(c.y+c.h/2)*sh;
  st.img.crop={x:clamp(cx-w/2,0,sw-w)/sw,y:clamp(cy-h/2,0,sh-h)/sh,w:w/sw,h:h/sh};
}
watch(/^size\.(board|across|down)$/,()=>{reAspect();rebuild()});
function drawCrop(){
  const cv=$('cropCv');if(!cv||!srcImg||!imgCv||$('imgSteps').hidden)return;
  const wrap=$('cropWrap'),avail=Math.max(120,wrap.clientWidth-16),s=Math.min(avail/srcImg.w,320/srcImg.h);
  const W=Math.max(1,Math.round(srcImg.w*s)),H=Math.max(1,Math.round(srcImg.h*s)),dpr=window.devicePixelRatio||1;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
  cv.style.width=W+'px';cv.style.height=H+'px';
  const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
  g.imageSmoothingEnabled=s<1;g.drawImage(imgCv,0,0,W,H);
  const c=st.img.crop,x=c.x*W,y=c.y*H,w=c.w*W,h=c.h*H,d=dims();
  g.fillStyle='rgba(0,0,0,.58)';g.fillRect(0,0,W,y);g.fillRect(0,y+h,W,H-y-h);g.fillRect(0,y,x,h);g.fillRect(x+w,y,W-x-w,h);
  const acc=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#0E7C7B';
  g.strokeStyle='rgba(255,255,255,.75)';g.lineWidth=1;g.setLineDash([4,4]);g.beginPath();
  for(let i=1;i<d.across;i++){const X=x+w*i/d.across;g.moveTo(X,y);g.lineTo(X,y+h)}
  for(let i=1;i<d.down;i++){const Y=y+h*i/d.down;g.moveTo(x,Y);g.lineTo(x+w,Y)}
  g.stroke();g.setLineDash([]);
  g.strokeStyle=acc;g.lineWidth=2;g.strokeRect(x,y,w,h);
  g.fillStyle=acc;g.strokeStyle='#fff';g.lineWidth=1.5;
  [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([X,Y])=>{g.beginPath();g.rect(X-6,Y-6,12,12);g.fill();g.stroke()});
}
HOOK.after.push(drawCrop);HOOK.resize.push(drawCrop);
let cdrag=null;
function cropPt(e){const r=$('cropCv').getBoundingClientRect();return{px:clamp((e.clientX-r.left)/r.width,0,1),py:clamp((e.clientY-r.top)/r.height,0,1),r}}
function colourAt(px,py){
  const {w,h,data}=srcImg,cx=clamp(Math.floor(px*w),0,w-1),cy=clamp(Math.floor(py*h),0,h-1);let r=0,g=0,b=0,m=0;
  for(let y=Math.max(0,cy-1);y<=Math.min(h-1,cy+1);y++)for(let x=Math.max(0,cx-1);x<=Math.min(w-1,cx+1);x++){const i=(y*w+x)*4;if(data[i+3]>=128){r+=data[i];g+=data[i+1];b+=data[i+2];m++}}
  return m?'#'+[r,g,b].map(v=>Math.round(v/m).toString(16).padStart(2,'0')).join('').toUpperCase():null;
}
$('cropCv').addEventListener('pointerdown',e=>{
  if(!srcImg)return;
  if(picking){e.preventDefault();const q=cropPt(e),col=colourAt(q.px,q.py);
    if(!col){txt('bgMsg','That spot is see-through. Tap a solid colour.');return}
    st.img.bgCol=col;st.img.bgPt={x:q.px,y:q.py};st.img.bg=true;picking=false;rebuild();return}
  const {px,py,r}=cropPt(e),c=st.img.crop;
  const cs=[[c.x,c.y,c.x+c.w,c.y+c.h],[c.x+c.w,c.y,c.x,c.y+c.h],[c.x,c.y+c.h,c.x+c.w,c.y],[c.x+c.w,c.y+c.h,c.x,c.y]];
  let best=null,bd=26;
  cs.forEach(([cx,cy,ax,ay])=>{const d=Math.hypot((px-cx)*r.width,(py-cy)*r.height);if(d<bd){bd=d;best={mode:'corner',ax,ay}}});
  if(!best&&px>=c.x&&px<=c.x+c.w&&py>=c.y&&py<=c.y+c.h)best={mode:'move',ox:px-c.x,oy:py-c.y};
  if(!best)return;cdrag=best;$('cropCv').setPointerCapture(e.pointerId);e.preventDefault();
});
$('cropCv').addEventListener('pointermove',e=>{
  if(!cdrag)return;const {px,py}=cropPt(e),c=st.img.crop,sw=srcImg.w,sh=srcImg.h;
  if(cdrag.mode==='move')st.img.crop={x:clamp(px-cdrag.ox,0,1-c.w),y:clamp(py-cdrag.oy,0,1-c.h),w:c.w,h:c.h};
  else{const {ax,ay}=cdrag,sx=px>=ax?1:-1,sy=py>=ay?1:-1,MIN=4,A=lockA();
    const dx=Math.abs(px-ax)*sw,dy=Math.abs(py-ay)*sh,maxW=(sx>0?1-ax:ax)*sw,maxH=(sy>0?1-ay:ay)*sh;
    let w,h;
    if(A){w=Math.max(dx,dy*A,MIN);h=w/A;if(w>maxW){w=maxW;h=w/A}if(h>maxH){h=maxH;w=h*A}}
    else{w=clamp(dx,MIN,maxW);h=clamp(dy,MIN,maxH)}
    st.img.crop={x:sx>0?ax:ax-w/sw,y:sy>0?ay:ay-h/sh,w:w/sw,h:h/sh};if(!A)st.img.free=clone(st.img.crop)}
  drawCrop();
});
const endDrag=()=>{if(!cdrag)return;cdrag=null;txt('cropMsg','');rebuild()};
$('cropCv').addEventListener('pointerup',endDrag);
$('cropCv').addEventListener('pointercancel',endDrag);
$('autoTrim').addEventListener('click',()=>{
  if(!srcImg)return;const b=autoTrimBox();
  if(!b.changed){txt('cropMsg','No flat edges found. Drag the corners instead.');return}
  st.img.free={x:b.x,y:b.y,w:b.w,h:b.h};st.img.crop=fitBox(st.img.free);txt('cropMsg','Trimmed.');rebuild();
});
$('cropReset').addEventListener('click',()=>{if(!srcImg)return;st.img.free={x:0,y:0,w:1,h:1};st.img.crop=fitBox(st.img.free);txt('cropMsg','');rebuild()});

/* ---------- picture controls ---------- */
slider('maxC',v=>v>=ALL_COLOURS?'All':String(v),v=>{st.img.maxColors=v;rebuild()});
slider('dAmt',v=>v+'%',v=>{st.img.ditherAmt=v;rebuild()});
slider('rare',v=>v?'<'+v:'Off',v=>{st.img.rare=v;rebuild()});
slider('bgTol',String,()=>rebuild(),v=>{st.img.bgTol=v});
slider('specks',v=>v?String(v):'Off',v=>{st.img.specks=v;rebuild()});
slider('smooth',v=>v?v+'×':'Off',v=>{st.img.smooth=v;rebuild()});
const ADJ=[['adjB','brightness',''],['adjC','contrast',''],['adjS','saturation',''],['adjH','hue','°'],['adjW','warmth','']];
ADJ.forEach(([id,,unit])=>slider(id,v=>signed(v)+unit,v=>{st.img[id]=v;rebuild()}));
$('adjReset').addEventListener('click',()=>{ADJ.forEach(([id])=>{st.img[id]=0});rebuild()});
$('bgPick').addEventListener('click',()=>{picking=!picking;sync();if(picking)$('cropWrap').scrollIntoView({block:'center',behavior:'smooth'})});
$('bgAuto').addEventListener('click',()=>{st.img.bgCol=null;st.img.bgPt=null;picking=false;rebuild()});
$('palSw').addEventListener('click',e=>{
  const b=e.target.closest('[data-pc]');if(!b)return;const c=APP.palette[+b.dataset.pc],off=new Set(st.img.off);
  if(off.has(c.name))off.delete(c.name);else{if(ALL_COLOURS-off.size<=2){txt('colMsg','Keep at least two colours.');return}off.add(c.name)}
  st.img.off=[...off];rebuild();
});
document.querySelectorAll('[data-pset]').forEach(b=>b.addEventListener('click',()=>{
  const S=(SPEC.sets||[])[+b.dataset.pset],keep=S?new Set(S.colours):null;
  st.img.off=keep?APP.palette.filter(c=>!keep.has(c.name)).map(c=>c.name):[];rebuild()}));
$('resetPic').addEventListener('click',()=>{
  const keep={crop:st.img.crop,free:st.img.free};st.img=clone(DEF.img);st.img.crop=keep.crop;st.img.free=keep.free;
  rebuild();picSay('Picture settings reset. Your crop and edits are kept.');
});
$('dropPic').addEventListener('click',()=>{srcImg=null;imgCv=null;srcUrl='';store.del(KEY+'img');picking=false;rebuild();picSay('Picture removed.')});
const blankBtn=$('startBlank');if(blankBtn)blankBtn.addEventListener('click',()=>{st.blank=true;rebuild()});

/* ---------- keeping the picture controls in step ---------- */
HOOK.sync.push(()=>{
  const has=!!srcImg;
  $('imgSteps').hidden=!has;$('picBtns').hidden=!has;$('picStart').hidden=has;
  /* one picture button at a time: while the grid shows its own Choose image button, the panel only points to it */
  const em=$('empty'),onGrid=!!em&&!em.hidden;$('picStartBtns').hidden=onGrid;
  txt('picStartMsg',onGrid?'Choose or paste a picture on the grid to begin.':'Choose a picture to start. You can also paste one, or drop a file on the grid area.');
  const cr=$('cmpRow');if(cr)cr.hidden=!has||!shown();put('cmp',cmp);
  $('bgOn').checked=st.img.bg;put('bgTol',st.img.bgTol);
  $('bgPick').setAttribute('aria-pressed',String(picking));txt('bgPick',picking?'Cancel picking':'Pick background colour');
  $('cropCv').classList.toggle('picking',picking);
  const bd=$('bgDot');bd.hidden=!st.img.bgCol;bd.style.background=st.img.bgCol||'';$('bgAuto').hidden=!st.img.bgCol;
  txt('bgMsg',picking?'Now tap the background in the crop picture above.':st.img.bgCol&&st.img.bg?'Emptying the colour you picked. If a rim of it stays, raise the tolerance.':st.img.bgCol?'Tick Leave background empty to use the colour you picked.':'');
  ADJ.forEach(([id])=>put(id,st.img[id]));
  const on=ADJ.filter(([id])=>st.img[id]).map(([id,name,unit])=>name+' '+signed(st.img[id])+unit);
  txt('adjSum',on.length?'('+on.join(', ')+')':'(off)');$('adjReset').disabled=!on.length;
  const I=st.img,cl=[];put('specks',I.specks);put('smooth',I.smooth);
  if(I.specks)cl.push('specks '+I.specks);if(I.smooth)cl.push('smooth '+I.smooth+'×');if(I.outline!=='none')cl.push('outline '+(I.outline==='in'?'inside':'outside'));
  txt('cleanSum',cl.length?'('+cl.join(', ')+')':'(off)');
  txt('cleanInfo',I.outline!=='none'&&has?(outlined?`The outline uses ${usePal()[darkest(usePal())].name} on ${units(outlined)}.`:'Nothing to outline: no cell inside the picture is empty. Turn on Leave background empty first.'):'');
  const off=new Set(st.img.off),used=new Set();if(pattern)for(const c of pattern.c)if(c>=0)used.add(c);
  fillBox('palSw',APP.palette.map((c,i)=>`<button type="button" class="swb lsw" data-pc="${i}" style="background:${c.hex}" title="${esc(c.name)}" aria-label="${esc(c.name)}" aria-pressed="${!off.has(c.name)}"></button>`).join(''));
  put('maxC',st.img.maxColors);
  txt('colMsg',`Choosing from ${ALL_COLOURS-off.size} of ${ALL_COLOURS} colours`+(used.size&&has?`; this picture uses ${used.size}.`:'.'));
  $('dAmtRow').hidden=st.img.dither==='none';put('dAmt',st.img.ditherAmt);put('rare',st.img.rare);
});
emptyWhy=()=>srcImg||st.blank?'':'Choose a picture to turn it into '+APP.unit.many+'.';

/* ---------- loading a picture ---------- */
/* picture messages go to the Picture section and, while no picture is loaded, under the big Choose image button */
function picSay(m){txt('imgMsg',m);const e=$('empty');txt('emptyNote',e&&!e.hidden?m:'');say(m)}
function loadImage(url,fresh,seq=++loadSeq){
  const im=new Image();
  im.onload=()=>{
    if(seq!==loadSeq)return;
    let w=im.naturalWidth,h=im.naturalHeight;const s=Math.min(1,SRC_MAX/Math.max(w,h));
    w=Math.max(1,Math.round(w*s));h=Math.max(1,Math.round(h*s));
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;
    const cx=cv.getContext('2d');cx.imageSmoothingEnabled=s<1;cx.drawImage(im,0,0,w,h);
    let data;try{data=cx.getImageData(0,0,w,h).data}catch(e){picSay('That image could not be read here. Try saving it as a PNG or JPEG first.');return}
    srcImg={w,h,data};imgCv=cv;picking=false;
    try{srcUrl=cv.toDataURL('image/png');store.set(KEY+'img',srcUrl)}catch(e){srcUrl=url}
    if(fresh){
      st.img.bgCol=null;st.img.bgPt=null;st.img.free={x:0,y:0,w:1,h:1};st.img.crop=fitBox(st.img.free);
      st.img.sampling=im.naturalWidth<=GRID.maxW&&im.naturalHeight<=GRID.maxW?'nearest':'average';
      txt('cropMsg','');picSay(`${im.naturalWidth} × ${im.naturalHeight} px loaded.`);
    }
    else if(lockA()){const c=st.img.crop,A=c.w*w/(c.h*h);if(Math.abs(A/lockA()-1)>0.01)reAspect()}   /* a crop saved for other boards takes their shape */
    rebuild();
  };
  im.onerror=()=>picSay('That file could not be read as an image. Photos in HEIC format often can’t be: save it as a JPEG or PNG and try again.');
  im.src=url;
}
function takeFile(f){
  if(!f)return;if(f.type&&!/^image\//.test(f.type)){picSay('That isn’t an image file.');return}
  picSay('Loading the picture…');
  const rd=new FileReader(),seq=++loadSeq;rd.onload=()=>{if(seq===loadSeq)loadImage(rd.result,true,seq)};rd.onerror=()=>picSay('That file could not be read.');rd.readAsDataURL(f);
}
document.querySelectorAll('.fileIn').forEach(i=>i.addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];takeFile(f);e.target.value=''}));
/* Pasting works in viewers that block file pickers. A pasted picture arrives as a file on the paste event,
   or (from some phone keyboards) as an <img> dropped into a paste box. */
document.addEventListener('paste',e=>{const items=e.clipboardData&&e.clipboardData.items;if(!items)return;
  for(const it of items){if(it.kind==='file'&&it.type.startsWith('image/')){e.preventDefault();takeFile(it.getAsFile());return}}
  if(e.target.closest&&e.target.closest('.pasteBox')){e.preventDefault();picSay('That was text, not a picture. Copy the picture itself, then paste.')}});
document.querySelectorAll('.pasteBox').forEach(b=>{
  b.addEventListener('input',()=>{const im=b.querySelector('img'),src=im&&im.getAttribute('src');b.textContent='';
    if(src&&/^(data:image\/|blob:)/.test(src)){picSay('Loading the picture…');loadImage(src,true)}
    else if(src)picSay('That picture could not be taken from here. Save it, then paste or choose the file.')});
  b.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)&&e.key.length===1)e.preventDefault()});
  b.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f)takeFile(f)});
});
vp.addEventListener('dragover',e=>e.preventDefault());
vp.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];takeFile(f)});
/* ---------- Compare (as in FIG and BIG): the picture laid over the grid, board by board, revealed from the left. It only changes the view. ---------- */
let cmp=0;
function cmpDraw(){
  const svg=$('board');if(!svg)return;let g=$('cmpG');
  if(!(pattern&&shown()&&srcUrl&&cmp>0)){if(g){g.remove();const d=$('cmpDefs');if(d)d.remove()}return}
  const p=pattern;
  if(!g){
    const cf=st.img.crop,n5=v=>(+v).toFixed(5),mk=(n,a,par)=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);par.appendChild(e);return e};
    const cp=mk('clipPath',{id:'cmpClip'},mk('defs',{id:'cmpDefs'},svg));mk('rect',{id:'cmpRect',x:0,y:0,width:0,height:n2(p.Hpx)},cp);
    g=mk('g',{id:'cmpG',class:'cmp','clip-path':'url(#cmpClip)'},svg);
    for(let by=0;by<p.down;by++)for(let bx=0;bx<p.across;bx++){
      const part=mk('svg',{x:n2(PAD+bx*(p.bw+GAP)),y:n2(PAD+by*(p.bh+GAP)),width:p.bw,height:p.bh,
        viewBox:[cf.x+bx*p.bw/p.W*cf.w,cf.y+by*p.bh/p.H*cf.h,p.bw/p.W*cf.w,p.bh/p.H*cf.h].map(n5).join(' '),preserveAspectRatio:'none'},g);
      const im=mk('image',{href:srcUrl,x:0,y:0,width:1,height:1,preserveAspectRatio:'none'},part);if(st.img.sampling==='nearest')im.style.imageRendering='pixelated'}
    const r=$('selRing');if(r)svg.appendChild(r);   /* the selection ring stays on top */
  }
  $('cmpRect').setAttribute('width',n2(p.Wpx*cmp/100));
}
HOOK.after.push(()=>{const g=$('cmpG');if(g){g.remove();const d=$('cmpDefs');if(d)d.remove()}cmpDraw()});
slider('cmp',v=>v?v+'%':'Off',v=>{cmp=v;cmpDraw()},v=>{cmp=v;cmpDraw()});
HOOK.start.push(()=>{const s=store.get(KEY+'img');if(typeof s==='string'&&s.startsWith('data:image/png;base64,'))loadImage(s,false)});
