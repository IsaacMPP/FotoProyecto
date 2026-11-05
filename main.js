'use strict';
const {app,BrowserWindow,ipcMain,dialog,screen,globalShortcut,protocol,shell}=require('electron');
protocol.registerSchemesAsPrivileged([{scheme:'demiphoto',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
const {spawn,execFile}=require('node:child_process');const {randomUUID}=require('node:crypto');const {Bonjour}=require('bonjour-service');
const dgram=require('node:dgram');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const {Notification}=require('electron');
let main=null,projection=null,folder=path.join(app.getPath('pictures'),'Demi Tether Studio');
let list=[],position=-1,auto=true,displayId=null,observer=null;const sizes=new Map();
let cameraProc=null,camera='Canon no conectada',cameraMode='USB',connected=false,autoConnect=true,wifiIp='',scanBusy=false,lastAlert='',lastWifiScan=0,nextUsbAttempt=0,desiredMode='auto',autoTimer=null,nextWifiAttempt=0,pairGuid=randomUUID(),pairingAttempt=false,assistedWifi=false,assistedReceived=0,wifiCandidates=[];
const preferencesFile=path.join(app.getPath('userData'),'camera-settings.json');
function canonUtilityRunning(){
 return new Promise(resolve=>{
  if(process.platform!=='win32')return resolve(false);
  execFile('tasklist',['/fo','csv','/nh'],{windowsHide:true,timeout:4000,maxBuffer:1024*1024},(err,stdout)=>{
   if(err)return resolve(false);
   resolve(stdout.split(String.fromCharCode(10)).some(line=>{const name=line.trim().split('"')[1]?.toLowerCase()||'';return name.endsWith('.exe')&&['eos utility','eosupnpsv','wftpairing','eulauncher'].some(x=>name.startsWith(x));}));
  });
 });
}
const diagnosticFile=path.join(app.getPath('userData'),'wifi-diagnostico.txt');
function diagnostic(step,details=''){try{fs.mkdirSync(path.dirname(diagnosticFile),{recursive:true});fs.appendFileSync(diagnosticFile,new Date().toISOString()+' | '+step+' | '+String(details).slice(0,700)+'\n');}catch{}}
try{const c=JSON.parse(fs.readFileSync(preferencesFile,'utf8'));wifiIp=String(c.wifiIp||'');autoConnect=c.autoConnect!==false;desiredMode=['auto','usb','wifi'].includes(c.mode)?c.mode:'auto';assistedWifi=c.assistedWifi===true;if(assistedWifi&&typeof c.assistedFolder==='string'&&c.assistedFolder.length<500)folder=c.assistedFolder;if(assistedWifi)autoConnect=false;if(typeof c.pairGuid==='string'&&/^[0-9a-f-]{36}$/i.test(c.pairGuid))pairGuid=c.pairGuid;}catch{}
function savePrefs(){try{fs.mkdirSync(path.dirname(preferencesFile),{recursive:true});fs.writeFileSync(preferencesFile,JSON.stringify({wifiIp,autoConnect,mode:desiredMode,pairGuid,assistedWifi,assistedFolder:assistedWifi?folder:''},null,2));}catch(e){console.error('Preferences',e.message);}}
function inform(message,kind='info'){if(lastAlert===message)return;lastAlert=message;for(const w of [main,projection])if(w&&!w.isDestroyed())w.webContents.send('camera-alert',{message,kind});if(Notification.isSupported()){try{new Notification({title:'Demi Tether Studio',body:message}).show();}catch{}}}
function isPrivateIp(ip){const m=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);if(!m)return false;const a=m.slice(1).map(Number);return a.every(x=>x>=0&&x<=255)&&(a[0]===10||(a[0]===172&&a[1]>=16&&a[1]<=31)||(a[0]===192&&a[1]===168)||(a[0]===169&&a[1]===254));}
async function discoverMdns(waitMs=6500){
 let bonjour=null,browser=null;
 const found=new Map();
 try{
  bonjour=new Bonjour();
  browser=bonjour.find({type:'ptp',protocol:'tcp'},service=>{
   const name=String(service.name||service.host||'Dispositivo PTP/IP').slice(0,100);
   for(const ip of service.addresses||[])
    if(isPrivateIp(ip))found.set(ip,{ip,source:'mDNS _ptp._tcp',name});
  });
  await new Promise(resolve=>setTimeout(resolve,waitMs));
 }catch(e){diagnostic('mDNS error',e.message);}
 finally{try{browser?.stop();}catch{}try{bonjour?.destroy();}catch{}}
 return [...found.values()];
}
async function discoverSsdp(waitMs=6500){
 const found=new Map(),sockets=[];
 const interfaces=Object.values(os.networkInterfaces()).flat().filter(n=>n&&n.family==='IPv4'&&!n.internal);
 try{
  for(const network of interfaces){
   const socket=dgram.createSocket({type:'udp4',reuseAddr:true});sockets.push(socket);
   socket.on('error',e=>diagnostic('SSDP error',e.message));
   socket.on('message',(buffer,peer)=>{
    const message=buffer.toString('utf8');
    if(!/schemas-canon-com:service:ICPO-WFTEOSSystemService|Canon Device Discovery|Canon EOS/i.test(message))return;
    const location=/^location:\s*([^\r\n]+)/im.exec(message)?.[1];
    const usn=/^usn:\s*([^\r\n]+)/im.exec(message)?.[1];
    const name=String(usn||'Canon SSDP').slice(0,100);
    if(isPrivateIp(peer.address))found.set(peer.address,{ip:peer.address,source:'SSDP Canon',name});
    if(location){try{const url=new URL(location);if(isPrivateIp(url.hostname))found.set(url.hostname,{ip:url.hostname,source:'SSDP LOCATION',name});}catch{}}
   });
   await new Promise(resolve=>{
    let settled=false;const finish=()=>{if(!settled){settled=true;resolve();}};
    socket.once('listening',()=>{try{socket.addMembership('239.255.255.250',network.address);}catch(e){diagnostic('SSDP membership',e.message);}finish();});
    socket.once('error',finish);
    try{socket.bind(1900,'0.0.0.0');}catch{finish();}
   });
   const search='M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: urn:schemas-canon-com:service:ICPO-WFTEOSSystemService:1\r\n\r\n';
   try{socket.setMulticastInterface(network.address);socket.send(Buffer.from(search),1900,'239.255.255.250');}catch(e){diagnostic('SSDP search',e.message);}
  }
  await new Promise(resolve=>setTimeout(resolve,waitMs));
 }finally{for(const socket of sockets)try{socket.close();}catch{}}
 return [...found.values()];
}
async function discoverWifi(){
 if(scanBusy)return null;
 scanBusy=true;
 try{
  cameraStatus('Buscando anuncios PTP/IP sin abrir conexiones TCP previas...');
  const [mdns,ssdp]=await Promise.all([discoverMdns(),discoverSsdp()]);
  const merged=new Map();
  for(const item of [...mdns,...ssdp]){
   if(!merged.has(item.ip))merged.set(item.ip,{ip:item.ip,sources:[item.source],name:item.name});
   else merged.get(item.ip).sources.push(item.source);
  }
  wifiCandidates=[...merged.values()].map(x=>({ip:x.ip,source:[...new Set(x.sources)].join(' + '),name:x.name}));
  diagnostic('Dispositivos anunciados',JSON.stringify(wifiCandidates));
  broadcast();
  if(wifiCandidates.length>1){
   cameraStatus('Se detectaron '+wifiCandidates.length+' direcciones diferentes. Selecciona la cámara en la lista y pulsa Conectar a dirección elegida. No se probará una IP arbitraria.');
   diagnostic('Asociación detenida por ambigüedad','Selecciona una IP en la interfaz; no se inició TCP PTP/IP.');
   return null;
  }
  const result=wifiCandidates[0]?.ip||(isPrivateIp(wifiIp)?wifiIp:null);
  diagnostic('Dirección candidata PTP/IP',result||'Sin anuncio ni IP guardada');
  if(!result)cameraStatus('Sin anuncios Canon. Comprueba que Windows y Canon estén en la misma red.');
  return result;
 }finally{scanBusy=false;}
}
function wifiBridgePath(){return app.isPackaged?path.join(process.resourcesPath,'wifi-bridge','DemiWifiBridge.exe'):path.join(__dirname,'wifi-bridge','publish','DemiWifiBridge.exe');}
function connectWifi(ip){if(cameraProc||!isPrivateIp(ip))return view();const exe=wifiBridgePath();if(!fs.existsSync(exe)){cameraStatus('Conector Wi-Fi no incluido');return view();}
 cameraMode='Wi-Fi';wifiIp=ip;savePrefs();cameraStatus((pairingAttempt?'Emparejando Demi con Canon':'Conectando por Wi-Fi')+' a '+ip+'...');
 startBridge(exe,[ip,folder],'Wi-Fi');return view();}
function startBridge(exe,args,mode){let partial='',lastBridgeError='';diagnostic('Conector '+mode+' iniciado',mode==='Wi-Fi'?args[0]:'USB');try{const p=spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],env:mode==='Wi-Fi'?{...process.env,DEMI_CANON_PAIRING_GUID:pairGuid}:process.env});cameraProc=p;cameraMode=mode;
 p.stdout.on('data',chunk=>{partial+=chunk.toString();const lines=partial.split(/\r?\n/);partial=lines.pop();for(const line of lines){try{const e=JSON.parse(line);if(e.type==='status'){diagnostic('Estado '+mode,e.message);cameraStatus(e.message);if(/Canon (?:USB )?conectada por|Canon USB conectada/i.test(e.message)&&!connected){pairingAttempt=false;connected=true;inform('Canon conectada por '+mode,'success');}}if(e.type==='photo'){scan();setTimeout(scan,600);}if(e.type==='error'){lastBridgeError=e.message;diagnostic('Error '+mode,e.message);cameraStatus('Canon: '+e.message);}}catch{}}});
 let errors='';p.stderr.on('data',d=>{const info=d.toString();errors=(errors+info).slice(-1200);if(mode==='Wi-Fi')for(const line of info.split(/\r?\n/)){if(line.trim())diagnostic('Traza PTP/IP',line.trim());}});
 p.on('error',e=>{if(cameraProc===p){cameraProc=null;cameraStatus('Error de conexión: '+e.message);}});
 p.on('exit',code=>{if(cameraProc===p){cameraProc=null;const was=connected;connected=false;cameraStatus(lastBridgeError?'Error '+mode+': '+lastBridgeError:'Cámara desconectada ('+mode+', código '+code+'). '+errors.slice(-130));diagnostic('Fin conector '+mode,'código '+code+'; '+lastBridgeError+' '+errors.slice(-300));if(was)inform('Canon desconectada ('+mode+')','warning');nextUsbAttempt=Date.now()+9000;if(mode==='Wi-Fi'&&!was){pairingAttempt=false;nextWifiAttempt=Date.now()+120000;diagnostic('Pausa tras fallo de emparejamiento','Se suspende autoconexión Wi-Fi por 120 segundos; botón Conectar Wi-Fi permite prueba manual.');}}});
 }catch(e){cameraProc=null;cameraStatus('No se pudo iniciar conector '+mode+': '+e.message);}}
async function automaticConnection(){if(assistedWifi||!autoConnect||cameraProc||scanBusy)return;
 const now=Date.now();
 if(desiredMode!=='wifi'&&now>=nextUsbAttempt){nextUsbAttempt=now+16000;connectCamera(true);if(cameraProc)return;}
 if(desiredMode!=='usb'&&now>=nextWifiAttempt&&now-lastWifiScan>30000){lastWifiScan=now;assistedWifi=false;savePrefs();const ip=await discoverWifi();if(ip&&!cameraProc)connectWifi(ip);}
}

let zoom=1,panX=0,panY=0;
function resetZoom(){zoom=1;panX=0;panY=0;}
function updateZoom(v){zoom=Math.max(1,Math.min(6,Math.round(Number(v)*100)/100||1));if(zoom===1){panX=0;panY=0;}broadcast();return view();}
function updatePan(x,y){if(zoom>1){const max=(zoom-1)*45;panX=Math.max(-max,Math.min(max,Number(x)||0));panY=Math.max(-max,Math.min(max,Number(y)||0));broadcast();}return view();}
function exitProjectFullscreen(){if(!projection||projection.isDestroyed()||!projection.isFullScreen())return;projection.setFullScreen(false);projection.setBounds({width:Math.round(screen.getPrimaryDisplay().workArea.width*.75),height:Math.round(screen.getPrimaryDisplay().workArea.height*.72),x:screen.getPrimaryDisplay().workArea.x+80,y:screen.getPrimaryDisplay().workArea.y+60});broadcast();}
function cameraStatus(message){camera=message;broadcast();}
function bridgePath(){return app.isPackaged?path.join(process.resourcesPath,'camera-bridge','DemiCameraBridge.exe'):path.join(__dirname,'camera-bridge','publish','DemiCameraBridge.exe');}
function disconnectCamera(){const had=connected;const p=cameraProc;cameraProc=null;connected=false;if(p)p.kill();cameraStatus('Canon desconectada');if(had)inform('Canon desconectada','warning');nextUsbAttempt=Date.now()+6000;}
function connectCamera(silent=false){if(cameraProc)return view();const exe=bridgePath();if(!fs.existsSync(exe)){if(!silent)cameraStatus('Falta el conector USB Canon EDSDK');return view();}
 cameraMode='USB';if(!silent)cameraStatus('Buscando Canon por USB...');startBridge(exe,[folder],'USB');return view();}

const supported=/\.(jpe?g|png|webp)$/i;
function view(){return {folder,photos:list.map(p=>({id:p.file,name:path.basename(p.file)})),position,auto,displayId,displays:screen.getAllDisplays().map((d,i)=>({id:d.id,name:d.label||'Pantalla '+(i+1),bounds:d.bounds})),camera,cameraConnected:connected,cameraMode,assistedWifi,assistedReceived,wifiIp,wifiCandidates,autoConnect,desiredMode,zoom,panX,panY,projectFullscreen:!!projection&&!projection.isDestroyed()&&projection.isFullScreen()};}
function broadcast(){for(const w of [main,projection])if(w&&!w.isDestroyed())w.webContents.send('state-changed',view());}
function scan(){try{fs.mkdirSync(folder,{recursive:true});const oldNewest=list.at(-1)?.file;const selected=list[position]?.file;const next=[];const found=new Set();for(const e of fs.readdirSync(folder,{withFileTypes:true})){if(!e.isFile()||!supported.test(e.name))continue;const f=path.join(folder,e.name);found.add(f);let st;try{st=fs.statSync(f);}catch{continue;}const prev=sizes.get(f);sizes.set(f,{size:st.size,mtime:st.mtimeMs});if(st.size>0&&prev&&prev.size===st.size&&prev.mtime===st.mtimeMs&&Date.now()-st.mtimeMs>350)next.push({file:f,mtime:st.mtimeMs});}for(const key of sizes.keys())if(!found.has(key))sizes.delete(key);next.sort((a,b)=>a.mtime-b.mtime||a.file.localeCompare(b.file));list=next;if(!list.length){position=-1;resetZoom();}else if(auto&&list.at(-1)?.file!==oldNewest){position=list.length-1;resetZoom();if(assistedWifi){assistedReceived++;if(assistedReceived===1)inform('Primera foto recibida desde la carpeta de EOS Utility','success');}}else if(selected){const idx=list.findIndex(x=>x.file===selected);position=idx>=0?idx:list.length-1;}else position=Math.max(0,Math.min(position,list.length-1));broadcast();}catch(err){console.error('Folder scan:',err.message);}}
function move(step){if(list.length){const old=position;position=Math.max(0,Math.min(list.length-1,position+step));if(old!==position)resetZoom();}broadcast();}
function key(event,input){if(input.type!=='keyDown')return;if(input.key==='F11'&&main&&!main.isDestroyed()){event.preventDefault();main.setFullScreen(!main.isFullScreen());return;}if(input.key==='Escape'&&main&&!main.isDestroyed()&&main.isFullScreen()){event.preventDefault();main.setFullScreen(false);return;}if(['Left','ArrowLeft','PageUp'].includes(input.key)){event.preventDefault();move(-1);}else if(['Right','ArrowRight','PageDown'].includes(input.key)){event.preventDefault();move(1);}else if(input.key==='Home'){event.preventDefault();position=list.length-1;resetZoom();broadcast();}}
function openProject(id){const d=screen.getAllDisplays().find(x=>String(x.id)===String(id))||screen.getPrimaryDisplay();if(projection&&!projection.isDestroyed())projection.close();displayId=d.id;projection=new BrowserWindow({x:d.bounds.x,y:d.bounds.y,width:d.bounds.width,height:d.bounds.height,fullscreen:true,autoHideMenuBar:true,backgroundColor:'#000000',webPreferences:{preload:path.join(__dirname,'preload.js'),sandbox:true,contextIsolation:true,nodeIntegration:false}});projection.loadFile('projector.html');projection.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='Escape'){event.preventDefault();exitProjectFullscreen();return;}key(event,input);});projection.webContents.on('did-finish-load',broadcast);projection.on('closed',()=>{projection=null;displayId=null;broadcast();});broadcast();}
app.whenReady().then(()=>{savePrefs();if(assistedWifi){camera='Wi-Fi asistido: esperando fotografías de EOS Utility en '+folder;cameraMode='Wi-Fi asistido';}protocol.handle('demiphoto',async request=>{try{const u=new URL(request.url);const file=Buffer.from(u.pathname.slice(1),'base64url').toString('utf8');if(!list.some(p=>p.file===file))return new Response('No disponible',{status:404});const content=await fs.promises.readFile(file);const ext=path.extname(file).toLowerCase();const mime=ext==='.png'?'image/png':ext==='.webp'?'image/webp':'image/jpeg';return new Response(content,{headers:{'Content-Type':mime,'Cache-Control':'no-store'}});}catch(e){return new Response('Error leyendo fotografia',{status:500});}});fs.mkdirSync(folder,{recursive:true});main=new BrowserWindow({width:1150,height:760,minWidth:760,minHeight:520,backgroundColor:'#111821',webPreferences:{preload:path.join(__dirname,'preload.js'),sandbox:true,contextIsolation:true,nodeIntegration:false}});main.loadFile('index.html');main.webContents.on('before-input-event',key);main.webContents.on('did-finish-load',broadcast);main.on('closed',()=>{main=null;if(projection&&!projection.isDestroyed())projection.close();});ipcMain.handle('state',()=>view());ipcMain.handle('camera-assist-wifi',async()=>{const selection=await dialog.showOpenDialog(main,{title:'Elegir carpeta de recepción de EOS Utility',properties:['openDirectory','createDirectory'],defaultPath:folder});if(selection.canceled||!selection.filePaths[0])return view();autoConnect=false;assistedWifi=true;assistedReceived=0;disconnectCamera();folder=selection.filePaths[0];sizes.clear();list=[];position=-1;cameraMode='Wi-Fi asistido';cameraStatus('Wi-Fi asistido: esperando fotografías de EOS Utility en '+folder);savePrefs();scan();return view();});ipcMain.handle('camera-assist-off',()=>{assistedWifi=false;cameraStatus('Modo Wi-Fi asistido desactivado');savePrefs();broadcast();return view();});ipcMain.handle('camera-open-diagnostic',async()=>{if(!fs.existsSync(diagnosticFile))diagnostic('El diagnóstico está listo','Inicia una búsqueda Wi-Fi para registrar eventos.');return await shell.openPath(diagnosticFile);});ipcMain.handle('main-fullscreen',()=>{if(main&&!main.isDestroyed()){main.setFullScreen(!main.isFullScreen());}return view();});ipcMain.handle('zoom-set',(_e,value)=>updateZoom(value));ipcMain.handle('pan-set',(_e,x,y)=>updatePan(x,y));ipcMain.handle('project-fullscreen',()=>{if(projection&&!projection.isDestroyed()){projection.setFullScreen(true);projection.focus();broadcast();}return view();});ipcMain.handle('camera-connect',()=>{assistedWifi=false;savePrefs();return connectCamera();});ipcMain.handle('camera-pair-new',async()=>{
  if(await canonUtilityRunning()){const msg='Cierra EOS Utility y su servicio de asociación por Wi-Fi desde la bandeja del sistema antes de emparejar Demi. Ambos no pueden controlar la misma cámara.';cameraStatus(msg);diagnostic('Asociación nativa bloqueada',msg);return {error:msg};}
  // New camera registration must use Demi's own stable name and GUID.
  // It cannot inherit Canon EOS Utility's previously registered pairing.
  autoConnect=false;assistedWifi=false;desiredMode='wifi';
  if(cameraProc)disconnectCamera();
  pairGuid=randomUUID();pairingAttempt=true;nextWifiAttempt=0;lastWifiScan=Date.now();
  savePrefs();
  diagnostic('Inicio asociación nativa','Nuevo GUID exclusivo de Demi (el identificador no se registra en el log). EOS Utility debe estar cerrado y la cámara en Registrar dispositivo para conexión.');
  cameraStatus('Emparejamiento nuevo: configura Registrar dispositivo para conexión en la Canon; buscando anuncio de red...');
  broadcast();
  const ip=await discoverWifi();
  if(ip&&!cameraProc)connectWifi(ip);
  else{pairingAttempt=false;if(wifiCandidates.length<=1)cameraStatus('No se detectó anuncio Canon. Confirma nueva conexión de PC y que EOS Utility esté cerrado.');}
  return view();
});ipcMain.handle('camera-wifi-selected',(_e,ip)=>{
 const candidate=wifiCandidates.find(x=>x.ip===ip);
 if(!candidate)return {error:'La dirección no está entre los dispositivos descubiertos. Vuelve a buscar.'};
 if(cameraProc)return {error:'Hay otra conexión en curso; desconecta primero.'};
 diagnostic('Dirección seleccionada por usuario',candidate.ip+' desde '+candidate.source);
 nextWifiAttempt=0;
 return connectWifi(candidate.ip);
});ipcMain.handle('camera-wifi-connect',(_e,ip)=>{if(cameraProc)disconnectCamera();assistedWifi=false;savePrefs();if(!isPrivateIp(String(ip)))return {error:'Introduce una IP privada válida de la cámara'};nextWifiAttempt=0;return connectWifi(String(ip));});ipcMain.handle('camera-config',(_e,config)=>{if(typeof config.autoConnect==='boolean'){autoConnect=config.autoConnect;if(autoConnect)assistedWifi=false;}if(['auto','usb','wifi'].includes(config.mode)&&desiredMode!==config.mode){desiredMode=config.mode;if(cameraProc&&((desiredMode==='wifi'&&cameraMode==='USB')||(desiredMode==='usb'&&cameraMode==='Wi-Fi')))disconnectCamera();nextUsbAttempt=0;lastWifiScan=0;nextWifiAttempt=0;setTimeout(automaticConnection,500);}if(typeof config.wifiIp==='string'&&config.wifiIp.length<32)wifiIp=config.wifiIp.trim();savePrefs();broadcast();if(autoConnect)setTimeout(automaticConnection,650);return view();});ipcMain.handle('camera-search',async()=>{const ip=await discoverWifi();if(ip&&!cameraProc){nextWifiAttempt=0;connectWifi(ip);}else if(!ip&&wifiCandidates.length===0)cameraStatus('No se recibió anuncio Canon por SSDP ni mDNS; confirma la red o introduce la dirección manual.');return view();});ipcMain.handle('camera-disconnect',()=>{assistedWifi=false;autoConnect=false;savePrefs();disconnectCamera();broadcast();return view();});ipcMain.handle('select-folder',async()=>{const r=await dialog.showOpenDialog(main,{properties:['openDirectory','createDirectory'],defaultPath:folder});if(!r.canceled&&r.filePaths[0]){folder=r.filePaths[0];sizes.clear();list=[];position=-1;scan();}return view();});ipcMain.handle('project',(_e,id)=>{openProject(id);return view();});ipcMain.handle('close-project',()=>{if(projection&&!projection.isDestroyed())projection.close();return view();});ipcMain.handle('navigate',(_e,step)=>{move(step);return view();});ipcMain.handle('latest',()=>{position=list.length-1;resetZoom();broadcast();return view();});ipcMain.handle('toggle-auto',(_e,enabled)=>{auto=Boolean(enabled);if(auto){position=list.length-1;resetZoom();}broadcast();return view();});ipcMain.handle('photo',(_e,id)=>{const item=list.find(x=>x.file===id);if(!item)return null;return 'demiphoto://asset/'+Buffer.from(item.file).toString('base64url');});globalShortcut.register('Alt+Left',()=>move(-1));globalShortcut.register('Alt+Right',()=>move(1));globalShortcut.register('Alt+Home',()=>{position=list.length-1;resetZoom();broadcast();});observer=setInterval(scan,850);scan();autoTimer=setInterval(automaticConnection,12000);setTimeout(automaticConnection,1800);screen.on('display-added',broadcast);screen.on('display-removed',broadcast);});
app.on('before-quit',()=>{if(cameraProc)cameraProc.kill();if(observer)clearInterval(observer);if(autoTimer)clearInterval(autoTimer);globalShortcut.unregisterAll();});app.on('window-all-closed',()=>app.quit());
