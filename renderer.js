'use strict';
const $=id=>document.getElementById(id);
let prevId='',stamp=0,currentZoom=1,currentPanX=0,currentPanY=0,photoFingerprint='',galleryFingerprint='',dragging=false;
const preview=$('preview'),stage=$('stage');
const thumbCache=new Map();
let pendingTransform=null,transformFrame=0;
function applyTransform(){
 preview.style.transform='translate('+currentPanX+'%,'+currentPanY+'%) scale('+currentZoom+')';
 $('zoom-level').textContent=Math.round(currentZoom*100)+'%';
 $('zoom-range').value=String(Math.round(currentZoom*100));
 stage.classList.toggle('zoomed',currentZoom>1);
}
function requestTransform(z,x,y){
 const next=Math.max(1,Math.min(6,z));
 const bound=(next-1)*45;
 currentZoom=next;
 currentPanX=next===1?0:Math.max(-bound,Math.min(bound,x));
 currentPanY=next===1?0:Math.max(-bound,Math.min(bound,y));
 applyTransform();
 pendingTransform=[currentZoom,currentPanX,currentPanY];
 if(!transformFrame)transformFrame=requestAnimationFrame(()=>{
  transformFrame=0;
  const values=pendingTransform;pendingTransform=null;
  if(values)void window.demi.setViewTransform(...values);
 });
}
function changeZoom(value,clientX,clientY){
 const next=Math.max(1,Math.min(6,value));
 const rect=stage.getBoundingClientRect();
 const cx=Number.isFinite(clientX)?(clientX-rect.left-rect.width/2)/rect.width*100:0;
 const cy=Number.isFinite(clientY)?(clientY-rect.top-rect.height/2)/rect.height*100:0;
 const ratio=next/currentZoom;
 requestTransform(next,currentPanX*ratio+cx*(1-ratio),currentPanY*ratio+cy*(1-ratio));
}
function changePan(x,y){requestTransform(currentZoom,x,y);}
const recentTime=ms=>{try{return new Date(ms).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}catch{return '';}};
async function photoUrl(p){
 if(thumbCache.has(p.id))return thumbCache.get(p.id);
 const url=await window.demi.photo(p.id);
 if(url)thumbCache.set(p.id,url);
 return url;
}
function refreshGallery(photos,selectedId){
 const fingerprint=photos.slice(-40).map(p=>p.id+'|'+p.mtime).join('|');
 if(fingerprint!==galleryFingerprint){
  galleryFingerprint=fingerprint;
  const box=$('thumbs');box.replaceChildren();
  for(const p of photos.slice(-40).reverse()){
   const b=document.createElement('button');b.type='button';b.className='thumb';b.dataset.id=p.id;
   b.title=p.name;b.setAttribute('aria-label','Ver '+p.name);
   const img=document.createElement('img');img.className='thumb-image';img.alt='';img.loading='lazy';img.decoding='async';
   const meta=document.createElement('span');meta.className='thumb-meta';
   const title=document.createElement('span');title.className='thumb-title';title.textContent=p.name;
   const when=document.createElement('span');when.className='thumb-time';when.textContent=recentTime(p.mtime);
   meta.append(title,when);b.append(img,meta);
   b.onclick=()=>{const index=lastPhotos.findIndex(x=>x.id===p.id);if(index>=0)void window.demi.navigate(index-lastPosition);};
   box.append(b);
   void photoUrl(p).then(url=>{if(url&&img.isConnected)img.src=url;});
  }
 }
 for(const b of $('thumbs').querySelectorAll('.thumb'))b.classList.toggle('chosen',b.dataset.id===selectedId);
 $('gallery-count').textContent=String(photos.length);
}
let lastPhotos=[],lastPosition=-1;
const update=async s=>{
 const selected=s.photos[s.position];lastPhotos=s.photos;lastPosition=s.position;
 $('folder').textContent=s.folder;
 $('counter').textContent=s.photos.length+' fotos · '+(s.position+1)+' / '+s.photos.length;
 $('auto').checked=s.auto;$('camera').textContent=s.camera;
 const candidates=s.wifiCandidates||[],select=$('wifi-candidates'),selectedIp=select.value;
 const candidateKey=candidates.map(x=>x.ip+'|'+x.name).join('|');
 if(select.dataset.key!==candidateKey){
  select.dataset.key=candidateKey;
  select.replaceChildren(...(candidates.length?candidates.map(x=>{const option=document.createElement('option');option.value=x.ip;option.textContent=x.ip+' · '+x.source+' · '+x.name;return option;}):[Object.assign(document.createElement('option'),{value:'',textContent:'Sin dispositivos descubiertos'})]));
  if(candidates.some(x=>x.ip===selectedIp))select.value=selectedIp;
  else{const preferred=candidates.find(x=>x.source.includes('mDNS _ptp._tcp')&&/^ICPO-WFTEOSSystemService/i.test(x.name));if(preferred)select.value=preferred.ip;}
 }
 $('wifi-choose').disabled=!candidates.length;
 $('fast-jpeg').checked=s.fastJpegMode!==false;
 const connected=!!s.cameraConnected;
 $('camera-live').textContent=connected?'● Conectada':'Sin conectar';
 $('camera-live').classList.toggle('online',connected);
 $('connect').disabled=connected;
 $('connect').textContent=connected?'✓ Cámara conectada':'◉ Conectar cámara';
 $('disconnect').disabled=!connected;
 $('wifi-assist-status').textContent=s.assistedWifi?'Esperando fotos de EOS Utility · '+(s.assistedReceived||0)+' fotos nuevas':'Modo asistido inactivo';
 if(document.activeElement!==$('wifi-ip'))$('wifi-ip').value=s.wifiIp||'';
 $('auto-connect').checked=s.autoConnect!==false;
 $('connection-mode').value=s.desiredMode||'auto';
 $('connection-dot').classList.toggle('on',connected);
 $('connection-short').textContent=connected?'Canon conectada por '+s.cameraMode:(s.assistedWifi?'Wi-Fi asistido · esperando fotos':'Cámara sin conectar');
 currentZoom=s.zoom||1;currentPanX=s.panX||0;currentPanY=s.panY||0;applyTransform();
 $('file').textContent=selected?.name||'';
 $('viewer-current').textContent=selected?.name||'Esperando fotografía…';
 const displaySelect=$('displays'),previous=displaySelect.value;
 const displayKey=s.displays.map(d=>d.id+'|'+d.bounds.width+'x'+d.bounds.height).join('|');
 if(displaySelect.dataset.key!==displayKey){
  displaySelect.dataset.key=displayKey;
  displaySelect.replaceChildren(...s.displays.map(d=>{const el=document.createElement('option');el.value=String(d.id);el.textContent=d.name+' · '+d.bounds.width+'×'+d.bounds.height;return el;}));
  if(s.displays.some(d=>String(d.id)===previous))displaySelect.value=previous;
  else if(s.displays[1])displaySelect.value=String(s.displays[1].id);
 }
 const id=selected?.id||'';
 const identity=id+'|'+(selected?.mtime||'');
 if(identity!==photoFingerprint){
  photoFingerprint=identity;prevId=id;const token=++stamp;
  if(!id){preview.style.display='none';preview.removeAttribute('src');$('empty').style.display='flex';}
  else{
   const data=await photoUrl(selected);
   if(token===stamp&&data){
    const candidate=new Image();
    candidate.decoding='async';
    candidate.onload=()=>{
     if(token!==stamp)return;
     preview.src=data;
     preview.style.display='block';
     $('empty').style.display='none';
    };
    candidate.onerror=()=>{
     if(token!==stamp)return;
     $('empty').style.display='flex';
     $('empty').querySelector('p').textContent='No se pudo abrir esta imagen. Revisa su archivo JPEG.';
     preview.style.display='none';
    };
    candidate.src=data;
   }
  }
 }
 refreshGallery(s.photos,id);
};
window.demi.onState(update);window.demi.state().then(update);
$('workspace-fullscreen').onclick=()=>window.demi.mainFullscreen();$('choose').onclick=()=>window.demi.selectFolder();$('open').onclick=()=>window.demi.project($('displays').value);$('close').onclick=()=>window.demi.closeProject();$('prev').onclick=()=>window.demi.navigate(-1);$('next').onclick=()=>window.demi.navigate(1);$('latest').onclick=()=>window.demi.latest();$('auto').onchange=e=>window.demi.toggleAuto(e.target.checked);$('connect').onclick=()=>window.demi.connectCamera();$('disconnect').onclick=()=>window.demi.disconnectCamera();
$('zoom-in').onclick=()=>changeZoom(currentZoom+.25);
$('zoom-out').onclick=()=>changeZoom(currentZoom-.25);
$('zoom-reset').onclick=()=>requestTransform(1,0,0);
$('zoom-actual').onclick=()=>{
 const w=preview.naturalWidth,h=preview.naturalHeight,r=stage.getBoundingClientRect();
 if(!w||!h)return changeZoom(1);
 const fit=Math.min(r.width/w,r.height/h);
 changeZoom(Math.min(6,1/fit));
};
$('zoom-range').oninput=e=>changeZoom(Number(e.target.value)/100);
stage.addEventListener('wheel',e=>{
 if(!prevId)return;
 e.preventDefault();
 const step=e.ctrlKey?.10:.20;
 changeZoom(currentZoom+(e.deltaY<0?step:-step),e.clientX,e.clientY);
},{passive:false});
stage.addEventListener('dblclick',e=>{
 if(!prevId)return;
 if(currentZoom>1)requestTransform(1,0,0);
 else changeZoom(2,e.clientX,e.clientY);
});
let originX=0,originY=0,baseX=0,baseY=0;
stage.addEventListener('pointerdown',e=>{
 if(currentZoom<=1||e.button!==0)return;
 dragging=true;originX=e.clientX;originY=e.clientY;baseX=currentPanX;baseY=currentPanY;
 stage.setPointerCapture(e.pointerId);stage.classList.add('dragging');
});
stage.addEventListener('pointermove',e=>{
 if(!dragging)return;
 changePan(baseX+(e.clientX-originX)/stage.clientWidth*100,baseY+(e.clientY-originY)/stage.clientHeight*100);
});
function endDrag(){dragging=false;stage.classList.remove('dragging');}
stage.addEventListener('pointerup',endDrag);stage.addEventListener('pointercancel',endDrag);
const toast=$('camera-toast');let toastTimer=null;
window.demi.onCameraAlert(event=>{toast.textContent=event.message;toast.className='camera-toast visible '+(event.kind||'info');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),6000);});
$('connection-mode').onchange=e=>window.demi.configureCamera({mode:e.target.value});
$('auto-connect').onchange=e=>window.demi.configureCamera({autoConnect:e.target.checked});
$('wifi-ip').onchange=e=>window.demi.configureCamera({wifiIp:e.target.value.trim()});
$('wifi-search').onclick=()=>window.demi.searchWifi();
$('wifi-connect').onclick=async()=>{const ip=$('wifi-ip').value.trim();const result=await window.demi.connectWifi(ip);if(result?.error){toast.textContent=result.error;toast.className='camera-toast visible warning';}};

$('wifi-diagnostic').onclick=()=>window.demi.openWifiDiagnostic();

$('wifi-assist').onclick=()=>window.demi.assistedWifi();
$('wifi-assist-off').onclick=()=>window.demi.disableAssistedWifi();

$('wifi-pair').onclick=async()=>{const button=$('wifi-pair');button.disabled=true;try{const result=await window.demi.pairNewCamera();if(result?.error){toast.textContent=result.error;toast.className='camera-toast visible warning';}}finally{button.disabled=false;}};

$('wifi-choose').onclick=async()=>{const ip=$('wifi-candidates').value;if(!ip)return;const result=await window.demi.connectDiscoveredWifi(ip);if(result?.error){toast.textContent=result.error;toast.className='camera-toast visible warning';}};

$('fast-jpeg').onchange=async e=>{const result=await window.demi.setFastJpeg(e.target.checked);if(result?.requiresReconnect){toast.textContent='Modo guardado. Desconecta y vuelve a conectar la Canon para aplicarlo.';toast.className='camera-toast visible';}};
