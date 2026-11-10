'use strict';
// Group alternate JPEG representations of the SAME Canon shot for display only.
// Never delete, rename or alter files. Keep a real file path as the selected ID.
const path=require('node:path');
function identity(file){
 const filename=path.basename(file);
 let stem=path.parse(filename).name;
 let generated=false,preview=false;
 // Canon USB historical RAW embedded preview: Canon_<capture epoch>_<camera name>.
 let match=/^(Canon|Original)_(\d{9,11})_(.+)$/i.exec(stem);
 if(match){
  generated=true;preview=match[1].toLowerCase()==='canon';
  stem=match[3];
 } else {
  // Wi-Fi bridge prefixes the camera filename with transfer timestamp.
  match=/^(\d{8})_(\d{9})_(.*)$/i.exec(stem);
  if(match&&match[3]){generated=true;stem=match[3];}
 }
 return {key:stem.toLowerCase(),generated,preview};
}
function choosePreferred(a,b){
 const A=identity(a.file),B=identity(b.file);
 // Original JPEG is preferable to small RAW thumbnails.
 if(A.preview!==B.preview)return A.preview?b:a;
 // Prefer the original unprefixed Canon JPEG over any generated preview.
 if(A.generated!==B.generated)return A.generated?b:a;
 // Stable choice, independent of readdir ordering.
 return a.file.localeCompare(b.file)<=0?a:b;
}
function groupCanonPhotos(photos){
 // Only merge alternate camera-derived names when their capture times are close.
 // A repeated IMG_0001 weeks later must remain a separate photograph.
 const result=[],groups=new Map();
 for(const photo of photos){
  const id=identity(photo.file);
  let found=-1;
  const matches=groups.get(id.key)||[];
  for(const i of matches){
   const prev=result[i],pid=identity(prev.file);
   const close=Math.abs(prev.mtime-photo.mtime)<=30_000;
   if(close&&(id.generated||pid.generated)){found=i;break;}
  }
  if(found<0){
   const index=result.push(photo)-1;
   groups.set(id.key,[...matches,index]);
  }else result[found]=choosePreferred(result[found],photo);
 }
 return result.sort((a,b)=>a.mtime-b.mtime||a.file.localeCompare(b.file));
}
module.exports={groupCanonPhotos,identity};
