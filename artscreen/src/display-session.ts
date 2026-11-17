/** Foreground-only keep-awake session. No TV settings or system files are changed. */
interface Bridge {
 onservicecallback: ((message:string)=>void)|null;
 call(uri:string,parameters:string):void;
 cancel?():void;
}
type WebOSWindow = Window & {
 PalmServiceBridge?: new()=>Bridge;
 PalmSystem?: unknown;
};
const CLIENT='org.artscreen.gallery';
const POWER='luna://com.webos.service.tvpower/power/';
export function startDisplaySession(host=window as WebOSWindow,doc=document):()=>void {
 const native=!!host.PalmServiceBridge||!!host.PalmSystem||/Web0S|webOS/i.test(host.navigator.userAgent);
 if(!native)return ()=>{};
 let disposed=false,suspended=false,subscription:Bridge|undefined;
 const pending=new Map<Bridge,number>();
 // webOS only suppresses its normal idle saver during full-viewport video playback.
 // Keep the video opaque and untransformed; the artwork is a separate layer above it.
 const video=doc.createElement('video');
 video.className='display-session';video.src='./keep-awake.mp4';
 video.muted=true;video.loop=true;video.autoplay=true;video.playsInline=true;
 video.setAttribute('aria-hidden','true');video.setAttribute('tabindex','-1');
 doc.body.appendChild(video);
 const cancel=(bridge:Bridge)=>{bridge.onservicecallback=null;try{bridge.cancel?.();}catch{/* Already disconnected. */}};
 const foreground=()=>!disposed&&!suspended&&!doc.hidden;
 const respond=(timestamp:unknown)=>{
  const Constructor=host.PalmServiceBridge;
  if(!Constructor||!foreground())return;
  const bridge=new Constructor();
  const finish=()=>{host.clearTimeout(pending.get(bridge));pending.delete(bridge);cancel(bridge);};
  pending.set(bridge,host.setTimeout(finish,5000));
  bridge.onservicecallback=finish;
  try{bridge.call(POWER+'responseScreenSaverRequest',JSON.stringify({clientName:CLIENT,ack:false,timestamp}));}catch{finish();}
 };
 const play=()=>{if(foreground())void video.play().catch(()=>{console.warn('ArtScreen: keep-awake video could not start');});};
 const stop=()=>{
  if(subscription){cancel(subscription);subscription=undefined;}
  for(const [bridge,timer] of pending){host.clearTimeout(timer);cancel(bridge);}pending.clear();
  video.pause();
 };
 const start=()=>{
  if(!foreground())return;
  play();
  if(subscription||!host.PalmServiceBridge)return;
  const bridge=new host.PalmServiceBridge();subscription=bridge;
  bridge.onservicecallback=message=>{
   if(!foreground())return;
   try{
    const result=JSON.parse(message);
    if(result.returnValue===false){console.warn('ArtScreen: screensaver request refused; using video fallback');cancel(bridge);if(subscription===bridge)subscription=undefined;return;}
    if(result.timestamp!==undefined)respond(result.timestamp);
   }catch{/* Ignore malformed service messages. */}
  };
  try{bridge.call(POWER+'registerScreenSaverRequest',JSON.stringify({clientName:CLIENT,subscribe:true}));}catch{cancel(bridge);subscription=undefined;}
 };
 const visibility=()=>{if(doc.hidden)stop();else start();};
 const retry=()=>{if(video.paused)play();};
 const onPageHide=()=>{suspended=true;stop();};
 const onPageShow=()=>{suspended=false;start();};
 doc.addEventListener('visibilitychange',visibility);
 host.addEventListener('pagehide',onPageHide);host.addEventListener('pageshow',onPageShow);
 host.addEventListener('keydown',retry);host.addEventListener('pointerdown',retry);
 start();
 return ()=>{
  disposed=true;stop();
  doc.removeEventListener('visibilitychange',visibility);
  host.removeEventListener('pagehide',onPageHide);host.removeEventListener('pageshow',onPageShow);
  host.removeEventListener('keydown',retry);host.removeEventListener('pointerdown',retry);
  video.removeAttribute('src');video.load();video.remove();
 };
}
