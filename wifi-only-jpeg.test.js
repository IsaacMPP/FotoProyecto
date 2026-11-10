'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const bridge=fs.readFileSync('wifi-bridge/Program.cs','utf8');
const main=fs.readFileSync('main.js','utf8');
const ui=fs.readFileSync('index.html','utf8');
test('Wi-Fi launcher forces jpeg-fast even with old saved preference',()=>{
 assert.match(main,/startBridge\(exe,\[ip,folder,'jpeg-fast'\],'Wi-Fi'\)/);
 assert.doesNotMatch(main,/startBridge\(exe,\[ip,folder,fastJpegMode\?/);
});
test('Wi-Fi ignores CR2 and CR3 payloads but still acknowledges handles',()=>{
 assert.match(bridge,/if\(ext=="\.CR2"\|\|ext=="\.CR3"\)/);
 assert.match(bridge,/rawComplete=await camera\.TransferCompleteAsync\(handle,cts\.Token\)/);
 assert.match(bridge,/if\(ext!="\.JPG" && ext!="\.JPEG"\)/);
 assert.match(bridge,/unknownComplete=await camera\.TransferCompleteAsync\(handle,cts\.Token\)/);
 assert.doesNotMatch(bridge,/ExtractRawJpeg\(file,/);
});
test('Wi-Fi JPEG-only is shown as fixed and USB remains unchanged',()=>{
 assert.match(ui,/Wi-Fi: recibir solo JPG \(siempre activo\)/);
 assert.match(ui,/USB conserva su transferencia actual/);
});
test('JPG delivery streams from disk instead of buffering each photo',()=>{
 assert.match(main,/Readable\.toWeb\(fs\.createReadStream\(/);
 assert.doesNotMatch(main,/const content=await fs\.promises\.readFile\(file\)/);
});
