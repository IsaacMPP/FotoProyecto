'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('demi',{
 state:()=>ipcRenderer.invoke('state'),
 selectFolder:()=>ipcRenderer.invoke('select-folder'),
 project:(id)=>ipcRenderer.invoke('project',id),
 closeProject:()=>ipcRenderer.invoke('close-project'),
 navigate:(step)=>ipcRenderer.invoke('navigate',step),
 latest:()=>ipcRenderer.invoke('latest'),
 toggleAuto:(enabled)=>ipcRenderer.invoke('toggle-auto',enabled),
 photo:(id)=>ipcRenderer.invoke('photo',id),
 onState:(cb)=>{const fn=(_e,s)=>cb(s);ipcRenderer.on('state-changed',fn);return()=>ipcRenderer.removeListener('state-changed',fn)}
});
