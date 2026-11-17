export const LIMIT = 100_000_000;
type Entry = {url:string; blob:Blob; used:number};
export function victims(entries: {url:string; size:number; used:number}[], incoming:number, limit=LIMIT): string[] {
 let total=entries.reduce((n,e)=>n+e.size,0); const removed:string[]=[];
 for(const e of [...entries].sort((a,b)=>a.used-b.used)) {if(total+incoming<=limit)break; total-=e.size; removed.push(e.url);}
 return removed;
}
const request = <T,>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const done=(tx:IDBTransaction)=>new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error);});
let database:Promise<IDBDatabase>|undefined;
function open(){return database ||= new Promise((resolve,reject)=>{const r=indexedDB.open('artscreen',1);r.onupgradeneeded=()=>r.result.createObjectStore('images',{keyPath:'url'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function image(url:string):Promise<Blob>{
 let db:IDBDatabase|undefined;
 try {db=await open();const tx=db.transaction('images','readwrite');const end=done(tx);const store=tx.objectStore('images');const entry=await request(store.get(url)) as Entry|undefined;if(entry){store.put({...entry,used:Date.now()});await end;return entry.blob;}await end;}catch{db=undefined;}
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
 let blob:Blob;
 try {const response=await fetch(url,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error(`HTTP ${response.status}`);blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('Invalid image');}finally{clearTimeout(timeout);}
 if(db && blob.size<=LIMIT)try{const tx=db.transaction('images','readwrite');const end=done(tx);const store=tx.objectStore('images');const entries=await request(store.getAll()) as Entry[];for(const key of victims(entries.map(e=>({url:e.url,size:e.blob.size,used:e.used})),blob.size))store.delete(key);store.put({url,blob,used:Date.now()});await end;}catch{/* Storage unavailable: continue in memory. */}
 return blob;
}
