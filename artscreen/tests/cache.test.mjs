import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import 'fake-indexeddb/auto';
const code=ts.transpileModule(readFileSync(new URL('../src/cache.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText;
const {victims,image,LIMIT}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('evicts least recently used images until the incoming image fits',()=>{
 assert.deepEqual(victims([{url:'new',size:50,used:3},{url:'old',size:40,used:1},{url:'middle',size:10,used:2}],45,100),['old','middle']);
 assert.deepEqual(victims([{url:'a',size:50,used:1}],50,100),[]);
 assert.equal(LIMIT,100000000);
});
test('persists blobs and serves a cached image without network',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response(new Blob(['painting'],{type:'image/jpeg'}));};
 assert.equal(await (await image('https://test/art.jpg')).text(),'painting');
 globalThis.fetch=async()=>{throw Error('offline');};
 assert.equal(await (await image('https://test/art.jpg')).text(),'painting');assert.equal(calls,1);
});
test('does not store invalid responses',async()=>{
 globalThis.fetch=async()=>new Response('not an image');
 await assert.rejects(image('https://test/invalid.jpg'),/Invalid image/);
});
