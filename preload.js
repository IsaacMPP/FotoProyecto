'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('demi',{
 state:()=>ipcRenderer.invoke('state'),
 mainFullscreen:()=>ipcRenderer.invoke('main-fullscreen'),
 connectCamera:()=>ipcRenderer.invoke('camera-connect'),
 disconnectCamera:()=>ipcRenderer.invoke('camera-disconnect'),
 selectFolder:()=>ipcRenderer.invoke('select-folder'),
 project:(id)=>ipcRenderer.invoke('project',id),
 closeProject:()=>ipcRenderer.invoke('close-project'),
 navigate:(step)=>ipcRenderer.invoke('navigate',step),
 latest:()=>ipcRenderer.invoke('latest'),
 toggleAuto:(enabled)=>ipcRenderer.invoke('toggle-auto',enabled),
 photo:(id)=>ipcRenderer.invoke('photo',id),
 setZoom:(value)=>ipcRenderer.invoke('zoom-set',value),
 setPan:(x,y)=>ipcRenderer.invoke('pan-set',x,y),
 fullscreen:()=>ipcRenderer.invoke('project-fullscreen'),
 onState:(cb)=>{const fn=(_e,s)=>cb(s);ipcRenderer.on('state-changed',fn);return()=>ipcRenderer.removeListener('state-changed',fn)}
});
