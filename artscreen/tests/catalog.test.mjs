import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
test('catalogue covers requested artists with complete public-domain 4K sources',()=>{
 const works=read('../src/art.json');
 for(const name of ['Босх','Шишкин','Айвазовский','Брейгель','Левитан','Куинджи'])assert.ok(works.some(w=>w.artist===name),name);
 assert.equal(new Set(works.map(w=>w.id)).size,works.length);
 for(const work of works){assert.ok(work.width>=3840&&work.height>=2160);assert.ok(['Public domain','CC0'].includes(work.license));assert.equal(new URL(work.url).protocol,'https:');assert.equal(new URL(work.source).hostname,'commons.wikimedia.org');assert.doesNotMatch(work.source,/[-_]x\d+[-_]y\d+|detail|fragment/i);}
});
test('package metadata and project version agree',()=>{
 assert.equal(read('../package.json').version,read('../public/appinfo.json').version);
 assert.equal(read('../public/appinfo.json').resolution,'1920x1080');
});
