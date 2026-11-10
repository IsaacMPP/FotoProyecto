'use strict';
const photo=document.getElementById('projection'),waiting=document.getElementById('waiting'),stage=document.getElementById('projection-stage');let displayed='',token=0,zoom=1,panX=0,panY=0;
const transform=()=>{photo.style.transform='translate('+panX+'%,'+panY+'%) scale('+zoom+')';document.getElementById('project-zoom-label').textContent=Math.round(zoom*100)+'%';};
const show=async s=>{zoom=s.zoom||1;panX=s.panX||0;panY=s.panY||0;transform();const id=s.photos[s.position]?.id||'';if(id===displayed)return;displayed=id;const my=++token;if(!id){photo.removeAttribute('src');photo.style.display='none';waiting.style.display='flex';return;}const data=await window.demi.photo(id);if(my!==token)return;photo.onload=()=>{if(my===token){photo.style.display='block';waiting.style.display='none';}};photo.onerror=()=>{if(my===token){photo.style.display='none';waiting.style.display='flex';waiting.querySelector('p').textContent='No se pudo cargar esta imagen. Prueba otra fotografía.';}};if(data){photo.style.display='none';waiting.style.display='flex';photo.src=data;}else{photo.style.display='none';waiting.style.display='flex';}};
window.demi.onState(show);window.demi.state().then(show);
document.getElementById('project-previous').onclick=()=>window.demi.navigate(-1);document.getElementById('project-next').onclick=()=>window.demi.navigate(1);document.getElementById('project-zoom-out').onclick=()=>window.demi.setZoom(zoom-.25);document.getElementById('project-zoom-in').onclick=()=>window.demi.setZoom(zoom+.25);document.getElementById('project-fit').onclick=()=>window.demi.setZoom(1);document.getElementById('project-fullscreen').onclick=()=>window.demi.fullscreen();
const zoomAt=(value,x,y)=>{
 const next=Math.max(1,Math.min(6,value));
 const box=stage.getBoundingClientRect();
 const cx=(x-box.left-box.width/2)/box.width*100,cy=(y-box.top-box.height/2)/box.height*100;
 const ratio=next/zoom;
 window.demi.setViewTransform(next,panX*ratio+cx*(1-ratio),panY*ratio+cy*(1-ratio));
};
stage.addEventListener('wheel',e=>{if(!displayed)return;e.preventDefault();zoomAt(zoom+(e.deltaY<0?0.2:-0.2),e.clientX,e.clientY);},{passive:false});
stage.addEventListener('dblclick',e=>{if(!displayed)return;if(zoom>1)window.demi.setViewTransform(1,0,0);else zoomAt(2,e.clientX,e.clientY);});
let dragging=false,sx=0,sy=0,bx=0,by=0;
stage.addEventListener('pointerdown',e=>{if(zoom<=1||e.button!==0)return;dragging=true;sx=e.clientX;sy=e.clientY;bx=panX;by=panY;stage.setPointerCapture(e.pointerId);});
let nextPan=null,panFrame=0;
stage.addEventListener('pointermove',e=>{
 if(!dragging)return;
 const x=bx+(e.clientX-sx)/stage.clientWidth*100,y=by+(e.clientY-sy)/stage.clientHeight*100;
 nextPan=[x,y];
 if(!panFrame)panFrame=requestAnimationFrame(()=>{panFrame=0;if(nextPan){const p=nextPan;nextPan=null;void window.demi.setPan(...p);}});
});
stage.addEventListener('pointerup',()=>{dragging=false;});
stage.addEventListener('pointercancel',()=>{dragging=false;});
