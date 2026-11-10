'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {groupCanonPhotos,identity}=require('./photo-grouping');
const p=(name,mtime=1_700_000_000_000)=>({file:'C:\\Fotos\\'+name,mtime});
test('Canon RAW preview and native JPEG of one capture appear once',()=>{
 const result=groupCanonPhotos([p('Canon_1700000000_IMG_4826.jpg'),p('IMG_4826.JPG')]);
 assert.equal(result.length,1);
 assert.equal(result[0].file,p('IMG_4826.JPG').file);
});
test('Wi-Fi duplicate JPEG representations of the same shot are grouped',()=>{
 const result=groupCanonPhotos([p('20261110_025728711_IMG_4826.jpg'),p('20261110_025734111_IMG_4826.JPG',1_700_000_005_000)]);
 assert.equal(result.length,1);
});
test('different Canon camera image numbers remain separate',()=>{
 const result=groupCanonPhotos([p('Canon_1700000000_IMG_4826.jpg'),p('IMG_4827.JPG')]);
 assert.equal(result.length,2);
});
test('unrelated photos with identical original name are not merged across days',()=>{
 const result=groupCanonPhotos([p('Canon_1700000000_IMG_4826.jpg'),p('IMG_4826.JPG',1_700_100_000_000)]);
 assert.equal(result.length,2);
});
test('independent, unprefixed files remain separate',()=>{
 assert.equal(groupCanonPhotos([p('portrait.jpg'),p('portrait_edit.jpg')]).length,2);
});
test('does not mutate or delete original image records',()=>{
 const photos=[p('Canon_1700000000_IMG_4826.jpg'),p('IMG_4826.JPG')];
 groupCanonPhotos(photos);
 assert.equal(photos.length,2);
});
test('identifies camera generated representation',()=>{
 assert.deepEqual(identity('C:\\Fotos\\Canon_1700000000_IMG_4826.jpg'),{key:'img_4826',generated:true,preview:true});
});
