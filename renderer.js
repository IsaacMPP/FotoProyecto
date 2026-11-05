'use strict';
const $=id=>document.getElementById(id);let prevId='',stamp=0,currentZoom=1,currentPanX=0,currentPanY=0,editingWifi=false;
const preview=$('preview'),stage=$('stage');
function applyTransform(){preview.style.transform='translate('+currentPanX+'%,'+currentPanY+'%) scale('+currentZoom+')';$('zoom-level').textContent=Math.round(currentZoom*100)+'%';$('zoom-range').value=String(Math.round(currentZoom*100));}
function changeZoom(value){window.demi.setZoom(Math.min(6,Math.max(1,value)));}
function changePan(x,y){window.demi.setPan(x,y);}
const update=async s=>{
 const selected=s.photos[s.position];$('folder').textContent=s.folder;$('counter').textContent=s.photos.length+' fotos · '+(s.position+1)+' / '+s.photos.length;$('auto').checked=s.auto;$('camera').textContent=s.camera;
 const candidates=s.wifiCandidates||[];const select=$('wifi-candidates'),selectedIp=select.value;select.replaceChildren(...(candidates.length?candidates.map(x=>{const option=document.createElement('option');option.value=x.ip;option.textContent=x.ip+' · '+x.source+' · '+x.name;return option;}):[Object.assign(document.createElement('option'),{value:'',textContent:'Sin dispositivos descubiertos'})]));if(candidates.some(x=>x.ip===selectedIp))select.value=selectedIp;else{const preferred=candidates.find(x=>x.source.includes('mDNS _ptp._tcp')&&/^ICPO-WFTEOSSystemService/i.test(x.name));if(preferred)select.value=preferred.ip;}$('wifi-choose').disabled=!candidates.length;$('fast-jpeg').checked=s.fastJpegMode!==false;const connected=!!s.cameraConnected;$('camera-live').textContent=connected?'● Conectada':'Sin conectar';$('camera-live').classList.toggle('online',connected);$('connect').disabled=connected;$('connect').textContent=connected?'✓ Cámara conectada':'◉ Conectar cámara';$('disconnect').disabled=!connected;$('wifi-assist-status').textContent=s.assistedWifi?'Esperando fotos de EOS Utility · '+(s.assistedReceived||0)+' fotos nuevas':'Modo asistido inactivo';if(document.activeElement!==$('wifi-ip'))$('wifi-ip').value=s.wifiIp||'';$('auto-connect').checked=s.autoConnect!==false;$('connection-mode').value=s.desiredMode||'auto';$('connection-dot').classList.toggle('on',connected);$('connection-short').textContent=connected?'Canon conectada por '+s.cameraMode:(s.assistedWifi?'Wi-Fi asistido · esperando fotos':'Cámara sin conectar');
 currentZoom=s.zoom||1;currentPanX=s.panX||0;currentPanY=s.panY||0;applyTransform();
 $('file').textContent=selected?.name||'';
 const previous=$('displays').value;$('displays').replaceChildren(...s.displays.map(d=>{const el=document.createElement('option');el.value=String(d.id);el.textContent=d.name+' · '+d.bounds.width+'×'+d.bounds.height;return el;}));if(s.displays.some(d=>String(d.id)===previous))$('displays').value=previous;else if(s.displays[1])$('displays').value=String(s.displays[1].id);
 const id=selected?.id||'';if(id!==prevId){prevId=id;const token=++stamp;preview.style.display=id?'block':'none';$('empty').style.display=id?'none':'flex';if(id){const data=await window.demi.photo(id);if(token===stamp){preview.onerror=()=>{$('empty').style.display='flex';$('empty').querySelector('p').textContent='No se pudo abrir esta imagen. Revisa la vista previa RAW.';preview.style.display='none';};preview.onload=()=>{$('empty').style.display='none';preview.style.display='block';};if(data){preview.style.display='none';preview.src=data;}else{$('empty').style.display='flex';}}}else preview.removeAttribute('src');}
 const box=$('thumbs');box.replaceChildren(...s.photos.slice(-40).map(p=>{const b=document.createElement('button');b.className='thumb'+(p.id===id?' chosen':'');b.textContent=p.name;b.title=p.name;b.onclick=()=>window.demi.navigate(s.photos.findIndex(x=>x.id===p.id)-s.position);return b;}));
};
window.demi.onState(update);window.demi.state().then(update);
$('workspace-fullscreen').onclick=()=>window.demi.mainFullscreen();$('choose').onclick=()=>window.demi.selectFolder();$('open').onclick=()=>window.demi.project($('displays').value);$('close').onclick=()=>window.demi.closeProject();$('prev').onclick=()=>window.demi.navigate(-1);$('next').onclick=()=>window.demi.navigate(1);$('latest').onclick=()=>window.demi.latest();$('auto').onchange=e=>window.demi.toggleAuto(e.target.checked);$('connect').onclick=()=>window.demi.connectCamera();$('disconnect').onclick=()=>window.demi.disconnectCamera();
$('zoom-in').onclick=()=>changeZoom(currentZoom+.25);$('zoom-out').onclick=()=>changeZoom(currentZoom-.25);$('zoom-reset').onclick=()=>changeZoom(1);$('zoom-range').oninput=e=>changeZoom(Number(e.target.value)/100);
stage.addEventListener('wheel',e=>{if(!prevId)return;e.preventDefault();const step=e.ctrlKey?0.06:0.12;changeZoom(currentZoom+(e.deltaY<0?step:-step));},{passive:false});
let dragging=false,originX=0,originY=0,baseX=0,baseY=0;
stage.addEventListener('pointerdown',e=>{if(currentZoom<=1)return;dragging=true;originX=e.clientX;originY=e.clientY;baseX=currentPanX;baseY=currentPanY;stage.setPointerCapture(e.pointerId);stage.classList.add('dragging');});
stage.addEventListener('pointermove',e=>{if(!dragging)return;changePan(baseX+(e.clientX-originX)/stage.clientWidth*100,baseY+(e.clientY-originY)/stage.clientHeight*100);});
stage.addEventListener('pointerup',()=>{dragging=false;stage.classList.remove('dragging');});
stage.addEventListener('pointercancel',()=>{dragging=false;stage.classList.remove('dragging');});

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
