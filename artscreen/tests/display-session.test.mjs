import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const source=ts.transpileModule(readFileSync(new URL('../src/display-session.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText;
const {startDisplaySession}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(native=true){
 const calls=[],bridges=[];let timer=0;const timers=new Map();
 const video={paused:true,plays:0,pauses:0,removed:false,setAttribute(){},removeAttribute(){},load(){},remove(){this.removed=true;},play(){this.paused=false;this.plays++;return Promise.resolve();},pause(){this.paused=true;this.pauses++;}};
 class MockBridge{constructor(){this.cancelled=false;bridges.push(this);}call(uri,params){calls.push({bridge:this,uri,params:JSON.parse(params)});}cancel(){this.cancelled=true;}}
 const host=Object.assign(new EventTarget(),{navigator:{userAgent:'test'},setTimeout(fn){const id=++timer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}});
 if(native)host.PalmServiceBridge=MockBridge;
 const doc=Object.assign(new EventTarget(),{hidden:false,createElement(tag){assert.equal(tag,'video');return video;},body:{appendChild(){}}});
 return {host,doc,video,calls,bridges,timers};
}
test('only vetoes saver requests while foreground and releases everything on exit',()=>{
 const f=fixture();const close=startDisplaySession(f.host,f.doc);
 assert.match(f.calls[0].uri,/registerScreenSaverRequest$/);assert.equal(f.video.plays,1);
 f.bridges[0].onservicecallback(JSON.stringify({returnValue:true}));assert.equal(f.calls.length,1);
 f.bridges[0].onservicecallback(JSON.stringify({timestamp:0}));
 assert.deepEqual(f.calls[1].params,{clientName:'org.artscreen.gallery',ack:false,timestamp:0});
 f.bridges[1].onservicecallback('{}');assert.equal(f.timers.size,0);
 const late=f.bridges[0].onservicecallback;
 f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));
 assert.equal(f.bridges[0].cancelled,true);assert.equal(f.video.paused,true);
 late(JSON.stringify({timestamp:123}));assert.equal(f.calls.length,2);
 f.doc.hidden=false;f.doc.dispatchEvent(new Event('visibilitychange'));
 assert.match(f.calls[2].uri,/registerScreenSaverRequest$/);assert.equal(f.video.plays,2);
 close();assert.equal(f.video.removed,true);assert.ok(f.bridges.every(b=>b.cancelled));
 const count=f.calls.length;f.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(f.calls.length,count);
});
test('unavailable private API leaves the local video fallback playing',()=>{
 const f=fixture();const close=startDisplaySession(f.host,f.doc);
 const warn=console.warn;console.warn=()=>{};
 try{f.bridges[0].onservicecallback(JSON.stringify({returnValue:false,errorText:'Denied'}));}finally{console.warn=warn;}
 assert.equal(f.video.paused,false);assert.equal(f.bridges[0].cancelled,true);close();
});
test('pagehide pauses until pageshow and clears unfinished response calls',()=>{
 const f=fixture();const close=startDisplaySession(f.host,f.doc);
 f.bridges[0].onservicecallback('{"timestamp":"request-1"}');assert.equal(f.timers.size,1);
 f.host.dispatchEvent(new Event('pagehide'));assert.equal(f.timers.size,0);assert.equal(f.video.paused,true);
 f.host.dispatchEvent(new Event('keydown'));assert.equal(f.video.paused,true);
 f.host.dispatchEvent(new Event('pageshow'));assert.equal(f.video.paused,false);close();
});
test('ordinary browsers do not get a keep-awake video or subscription',()=>{
 const f=fixture(false);const close=startDisplaySession(f.host,f.doc);
 assert.equal(f.video.plays,0);assert.equal(f.calls.length,0);close();
});
