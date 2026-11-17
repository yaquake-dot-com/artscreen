import {render} from 'preact';
import {useEffect,useRef,useState} from 'preact/hooks';
import works from './art.json';
import {image} from './cache';
import {startDisplaySession} from './display-session';
import './style.css';
const INTERVAL=300000, FADE=1600;
type Slide={url:string; title:string; x:number; y:number};
function App(){
 useEffect(()=>startDisplaySession(),[]);
 const [slides,setSlides]=useState<(Slide|null)[]>([null,null]);
 const [active,setActive]=useState(0),[message,setMessage]=useState('Загрузка картин…');
 const navigate=useRef<(direction:number)=>void>(()=>{});
 useEffect(()=>{
  let stopped=false,busy=false,slot=0,position=-1,timer=0,cleanup=0,shift=0;
  const urls:(string|null)[]=[null,null];
  const order=works.map((_,i)=>i);
  for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  const schedule=(delay=INTERVAL)=>{clearTimeout(timer);timer=window.setTimeout(()=>void advance(1),delay);};
  const advance=async(direction:number)=>{
   if(stopped||busy||document.hidden)return;busy=true;clearTimeout(timer);
   let success=false;
   for(let attempts=0;attempts<order.length&&!stopped;attempts++){
    position=(position+direction+order.length)%order.length;
    const work=works[order[position]];let url='';
    try{
     url=URL.createObjectURL(await image(work.url));
     await new Promise<void>((resolve,reject)=>{const img=new Image();const t=setTimeout(()=>reject(Error('Decode timeout')),15000);img.onload=()=>{clearTimeout(t);resolve();};img.onerror=()=>{clearTimeout(t);reject(Error('Decode failed'));};img.src=url;});
     if(stopped){URL.revokeObjectURL(url);break;}
     const next=1-slot;if(urls[next])URL.revokeObjectURL(urls[next]!);urls[next]=url;
     setSlides(previous=>{const result=[...previous];result[next]={url,title:work.title,x:Math.random()*24-12,y:Math.random()*24-12};return result;});
     await new Promise(resolve=>setTimeout(resolve,50));if(stopped)break;
     slot=next;setActive(slot);setMessage('');success=true;
     cleanup=window.setTimeout(()=>{const old=1-slot;if(urls[old])URL.revokeObjectURL(urls[old]!);urls[old]=null;setSlides(previous=>previous.map((s,i)=>i===old?null:s));busy=false;if(!stopped&&!document.hidden){const upcoming=works[order[(position+1)%order.length]];void image(upcoming.url).catch(()=>{});}},FADE+100);
     break;
    }catch{if(url)URL.revokeObjectURL(url);}
   }
   if(!success){busy=false;if(!stopped)setMessage('Нет доступных картин. Повторная попытка через минуту.');}
   if(!stopped)schedule(success?INTERVAL:60000);
  };
  navigate.current=direction=>void advance(direction);
  const key=(e:KeyboardEvent)=>{if(e.repeat)return;if(['ArrowRight','ArrowLeft','Enter'].includes(e.key)){e.preventDefault();navigate.current(e.key==='ArrowLeft'?-1:1);}if(e.key==='GoBack'||e.keyCode===461)window.close();};
  const visibility=()=>{if(document.hidden)clearTimeout(timer);else schedule();};
  window.addEventListener('keydown',key);document.addEventListener('visibilitychange',visibility);
  shift=window.setInterval(()=>{if(!document.hidden)setSlides(previous=>previous.map(s=>s?{...s,x:Math.random()*24-12,y:Math.random()*24-12}:s));},60000);
  void advance(1);
  return()=>{stopped=true;clearTimeout(timer);clearTimeout(cleanup);clearInterval(shift);urls.forEach(url=>{if(url)URL.revokeObjectURL(url);});window.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 return <main onClick={()=>navigate.current(1)}>{slides.map((slide,i)=>slide&&<img key={i} class={`painting ${active===i?'visible':''}`} src={slide.url} alt={slide.title} style={{transform:`translate(${slide.x}px,${slide.y}px)`}}/>)}{message&&<div class="message" role="status">{message}</div>}</main>;
}
render(<App/>,document.getElementById('app')!);
