'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const renderer=fs.readFileSync('renderer.js','utf8');
test('gallery reads photos from the same reliable URL as the main preview',()=>{
 assert.match(renderer,/async function loadVisibleThumbnail\(img,id\)/);
 assert.match(renderer,/const url=await window\.demi\.photo\(id\)/);
 assert.doesNotMatch(renderer,/window\.demi\.thumbnail\(/);
});
test('gallery only loads images within or near the visible viewport',()=>{
 assert.match(renderer,/new IntersectionObserver\(/);
 assert.match(renderer,/root:null,rootMargin:'150px'/);
 assert.match(renderer,/thumbObserver\.observe\(img\)/);
});
test('gallery retains individual picture selection',()=>{
 assert.match(renderer,/window\.demi\.navigate\(index-lastPosition\)/);
});
