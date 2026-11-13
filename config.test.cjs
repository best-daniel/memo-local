const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');const {makeConfig}=require('./build.cjs');
test('build exposes only three public settings, never other environment variables',()=>{
 const result=makeConfig({GOOGLE_CLIENT_ID:'123.apps.googleusercontent.com',GOOGLE_PICKER_API_KEY:'AIza-test',GOOGLE_PROJECT_NUMBER:'123',GOOGLE_CLIENT_SECRET:'private',VERCEL_TOKEN:'private'});
 assert.deepEqual(result,{clientId:'123.apps.googleusercontent.com',apiKey:'AIza-test',appId:'123'});assert(!JSON.stringify(result).includes('private'));
});
test('missing configuration supports local-only mode and incomplete setup fails clearly',()=>{
 assert.deepEqual(makeConfig({}),{clientId:'',apiKey:'',appId:''});assert.throws(()=>makeConfig({GOOGLE_CLIENT_ID:'only-one'}),/incomplete/);
});
test('unconfigured user sees connection only, no scripts/network loaded on init or attempted connect',async()=>{
 const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,events:{},addEventListener(type,fn){this.events[type]=fn;}});return elements.get(id);};
 const ctx={document:{getElementById:el},localStorage:{getItem(){throw Error('unexpected settings lookup');}},MemoDriveClient:{createClient:()=>({})},MEMOAPP_GOOGLE_CONFIG:{}};
 vm.runInNewContext(fs.readFileSync(require.resolve('./drive.js'),'utf8'),ctx);
 assert.equal(el('drive-controls').hidden,true);assert.equal(el('drive-connect').disabled,false);
 await el('drive-connect').events.click();assert.match(el('drive-status').textContent,/준비되지/);
 const html=fs.readFileSync(require.resolve('./index.html'),'utf8');assert(!html.includes('id="drive-client-id"'));assert(html.indexOf('drive-config.js')<html.indexOf('src="drive.js"'));
});
