'use strict';
const fs=require('node:fs');const path=require('node:path');
function makeConfig(env) {
  const c={clientId:(env.GOOGLE_CLIENT_ID||'').trim(),apiKey:(env.GOOGLE_PICKER_API_KEY||'').trim(),appId:(env.GOOGLE_PROJECT_NUMBER||'').trim()};
  if(!Object.values(c).some(Boolean))return c;
  if(!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(c.clientId)||!/^AIza[\w-]+$/.test(c.apiKey)||!/^\d+$/.test(c.appId))throw new Error('Google Drive public configuration is incomplete or invalid. Check GOOGLE_CLIENT_ID, GOOGLE_PICKER_API_KEY, GOOGLE_PROJECT_NUMBER.');
  return c;
}
if(require.main===module){
  const config=makeConfig(process.env),out=path.join(__dirname,'dist');
  fs.mkdirSync(out,{recursive:true});
  // Explicit allowlist: no env files, tests, docs, or server credentials in deployment output.
  for(const file of ['index.html','style.css','app.js','transfer.js','drive.js','drive-client.js'])fs.copyFileSync(path.join(__dirname,file),path.join(out,file));
  fs.writeFileSync(path.join(out,'drive-config.js'),'window.MEMOAPP_GOOGLE_CONFIG = Object.freeze('+JSON.stringify(config)+');\n');
  console.log(config.clientId?'Static build ready; Google Drive configured.':'Static build ready; Google Drive not configured (local memo features available).');
}
module.exports={makeConfig};
