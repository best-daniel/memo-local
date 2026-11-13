const {test}=require('node:test');const assert=require('node:assert/strict');
const {createClient,LIMIT}=require('./drive-client.js');
test('uploads a dated JSON backup into selected folder without overwriting',async()=>{
 const calls=[];const api=createClient({getToken:()=> 'test',fetcher:async(url,options)=>{calls.push({url,options});return Response.json(calls.length===1?{mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}}:{id:'created',name:'backup.json'});}});
 await api.upload('folder/one',{version:1,notes:[]});
 assert.match(calls[0].url,/folder%2Fone/);assert.equal(calls[1].options.method,'POST');assert.equal(calls[1].options.headers.Authorization,'Bearer test');
 const meta=JSON.parse(await calls[1].options.body.get('metadata').text());assert.deepEqual(meta.parents,['folder/one']);assert.match(meta.name,/^memoapp-.*\.json$/);assert.deepEqual(JSON.parse(await calls[1].options.body.get('file').text()),{version:1,notes:[]});
});
test('rejects expired tokens before any network call',async()=>{const api=createClient({getToken:()=>'',fetcher:()=>{throw Error('should not call');}});await assert.rejects(()=>api.metadata('id'),/만료/);});
test('maps permission error and rejects read-only folder before upload',async()=>{
 const denied=createClient({getToken:()=> 't',fetcher:async()=>new Response('',{status:403})});await assert.rejects(()=>denied.metadata('id'),/권한/);
 let count=0;const api=createClient({getToken:()=> 't',fetcher:async()=>{count++;return Response.json({mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:false}});}});await assert.rejects(()=>api.upload('id',{}),/폴더/);assert.equal(count,1);
});
test('downloads JSON unchanged and rejects oversized remote file',async()=>{
 const raw='{"notes": ["\\n본문"]}';let count=0;
 const api=createClient({getToken:()=> 't',fetcher:async()=>++count===1?Response.json({name:'a.json',mimeType:'application/json',size:'20'}):new Response(raw)});
 assert.deepEqual(await api.download('id'),{name:'a.json',text:raw});
 const large=createClient({getToken:()=> 't',fetcher:async()=>Response.json({mimeType:'application/json',size:String(LIMIT+1)})});await assert.rejects(()=>large.download('id'),/10MB/);
});
