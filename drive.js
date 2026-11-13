/* Optional browser-only Google Drive integration. OAuth tokens stay in memory. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const FOLDERS='memoapp.drive.folders.v1';
  const SCOPE='https://www.googleapis.com/auth/drive.file';
  let token='',expires=0,account=null,folder=null,busy=false,client=null,libraries=null,activeConfig=null;
  const message = text => { $('drive-status').textContent=text; };
  function read(key) {try{return JSON.parse(localStorage.getItem(key)||'{}');}catch{return {};}}
  function config() {return globalThis.MEMOAPP_GOOGLE_CONFIG || {};}
  function validConfig(c) {return /^[\w.-]+\.apps\.googleusercontent\.com$/.test(c.clientId)&&/^[\w-]+$/.test(c.apiKey)&&/^\d+$/.test(c.appId);}
  function accessToken() {return Date.now()<expires?token:'';}
  const api=MemoDriveClient.createClient({getToken:accessToken});
  function update() {
    for(const id of ['drive-connect','drive-folder','drive-backup','drive-import','drive-disconnect'])$(id).disabled=busy;
    for(const id of ['drive-folder','drive-backup','drive-import','drive-disconnect'])$(id).disabled=busy||!account;
    $('drive-controls').hidden=!account;
    $('drive-folder-name').hidden=!account;
    $('drive-connect').textContent=account?'Google 계정 변경 / 재연결':'Google Drive 연결';
    $('drive-backup').disabled=busy||!account||!folder;
    $('drive-folder-name').textContent=folder ? `저장 폴더: ${folder.name}` : '저장 폴더를 선택하세요.';
  }
  async function run(fn) {if(busy)return;busy=true;update();try{await fn();}catch(e){message(e.message||'Drive 작업에 실패했습니다. 다시 시도하세요.');}finally{busy=false;update();}}
  function loadScript(src) {return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=resolve;s.onerror=()=>{s.remove();reject(new Error('Google 라이브러리를 불러오지 못했습니다. 네트워크나 차단 확장 기능을 확인하세요.'));};document.head.append(s);});}
  function loadLibraries() {
    if(!libraries) libraries=Promise.all([
      globalThis.google?.accounts?.oauth2?Promise.resolve():loadScript('https://accounts.google.com/gsi/client'),
      globalThis.gapi?Promise.resolve():loadScript('https://apis.google.com/js/api.js')
    ]).then(()=>new Promise((resolve,reject)=>gapi.load('picker',{callback:resolve,onerror:()=>reject(new Error('Google Picker 로딩 실패')),timeout:15000,ontimeout:()=>reject(new Error('Google Picker 로딩 시간 초과'))}))).catch(e=>{libraries=null;throw e;});
    return libraries;
  }
  function requireConnection() {if(!accessToken())throw new Error('연결이 만료되었습니다. Google Drive 연결을 다시 누르세요.');}
  function pick(type) {
    requireConnection();const c=activeConfig;
    return new Promise(resolve=>{
      const view=new google.picker.DocsView(type==='folder'?google.picker.ViewId.FOLDERS:google.picker.ViewId.DOCS).setMode(google.picker.DocsViewMode.LIST);
      if(type==='folder')view.setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes('application/vnd.google-apps.folder');
      else {view.setMimeTypes('application/json');if(folder)view.setParent(folder.id);}
      const picker=new google.picker.PickerBuilder().setAppId(c.appId).setDeveloperKey(c.apiKey).setOAuthToken(accessToken()).setOrigin(location.origin).addView(view).setTitle(type==='folder'?'메모 백업 폴더 선택':'메모 JSON 백업 선택').setCallback(data=>{
        if(data.action===google.picker.Action.PICKED){picker.setVisible(false);resolve(data.docs[0]);}
        else if(data.action===google.picker.Action.CANCEL)resolve(null);
      }).build();picker.setVisible(true);
    });
  }
  $('drive-connect').addEventListener('click',()=>run(async()=>{
    const c=config();if(!validConfig(c))throw new Error('Google Drive 연결이 아직 준비되지 않았습니다. 브라우저 메모와 JSON 가져오기·내보내기는 계속 사용할 수 있습니다.');
    token='';account=null;folder=null;activeConfig={...c};
    update();
    await loadLibraries();
    await new Promise((resolve,reject)=>{
      client=google.accounts.oauth2.initTokenClient({client_id:c.clientId,scope:SCOPE,callback:r=>{
        if(r.error){reject(new Error('Google 권한 승인이 취소되었거나 실패했습니다.'));return;}
        if(!google.accounts.oauth2.hasGrantedAllScopes(r,SCOPE)){reject(new Error('Drive 파일 권한이 필요합니다.'));return;}
        token=r.access_token;expires=Date.now()+Math.max(0,Number(r.expires_in)-60)*1000;resolve();
      },error_callback:()=>reject(new Error('로그인 창이 닫혔거나 차단되었습니다. 팝업을 허용하고 다시 연결하세요.'))});
      client.requestAccessToken({prompt:'select_account'});
    });
    const result=await api.account();
    if(!result.user?.permissionId)throw new Error('Google 계정 정보를 확인하지 못했습니다. 다시 연결하세요.');
    account=result.user;
    const folders=read(FOLDERS);folder=folders[c.clientId+':'+account.permissionId]||null;
    message(`${account.emailAddress||account.displayName}: 연결됨. 토큰 만료 시 다시 연결하세요.`);
  }));
  $('drive-folder').addEventListener('click',()=>run(async()=>{
    const selected=await pick('folder');if(!selected)return;
    const info=await api.metadata(selected.id);
    if(info.trashed||info.mimeType!=='application/vnd.google-apps.folder'||!info.capabilities?.canAddChildren)throw new Error('파일을 저장할 수 있는 폴더를 선택하세요.');
    const folders=read(FOLDERS);folder={id:info.id,name:info.name};folders[activeConfig.clientId+':'+account.permissionId]=folder;
    localStorage.setItem(FOLDERS,JSON.stringify(folders));message('폴더를 기억했습니다. 이 계정의 다음 연결에도 사용합니다.');
  }));
  $('drive-backup').addEventListener('click',()=>run(async()=>{
    requireConnection();const data=MemoAppTransfer.exportData();const file=await api.upload(folder.id,data);
    message(`Drive 저장 완료: ${file.name}`);
  }));
  $('drive-import').addEventListener('click',()=>run(async()=>{
    MemoAppTransfer.assertImportable();const selected=await pick('file');if(!selected)return;
    const file=await api.download(selected.id);MemoAppTransfer.preview(file.text,file.name);
    message('가져오기 미리보기를 확인한 뒤 백업 후 병합을 누르세요.');
  }));
  $('drive-disconnect').addEventListener('click',()=>{
    const previous=token;token='';expires=0;account=null;folder=null;update();
    if(previous&&globalThis.google?.accounts?.oauth2)google.accounts.oauth2.revoke(previous,()=>{});
    message('Drive 연결을 해제했습니다. 로컬 메모와 Drive 백업 파일은 유지됩니다.');
  });
  update();
})();
