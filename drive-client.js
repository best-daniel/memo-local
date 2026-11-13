(function(root){
  'use strict';
  const LIMIT = 10 * 1024 * 1024;
  function createClient({getToken, fetcher = fetch}) {
    async function request(path, options={}) {
      const token = getToken();
      if (!token) throw new Error('Google Drive 연결이 만료되었습니다. 다시 연결하세요.');
      const response = await fetcher('https://www.googleapis.com/' + path, {...options, headers:{...options.headers, Authorization:`Bearer ${token}`}, signal:AbortSignal.timeout(60000)});
      if (!response.ok) {
        if(response.status === 401) throw new Error('Google Drive 인증이 만료되었습니다. 다시 연결하세요.');
        if(response.status === 403) throw new Error('Drive 접근 권한이 없습니다. 폴더나 파일을 다시 선택하고 API 설정을 확인하세요.');
        if(response.status === 404) throw new Error('폴더나 파일을 찾을 수 없습니다. 다시 선택하세요.');
        if(response.status === 429) throw new Error('요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.');
        throw new Error(`Drive 요청 실패 (${response.status}). 다시 시도하세요.`);
      }
      return response;
    }
    const metadata = async id => (await request(`drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,trashed,capabilities(canAddChildren),size`)).json();
    async function upload(folderId, data) {
      const folder = await metadata(folderId);
      if(folder.trashed || folder.mimeType !== 'application/vnd.google-apps.folder' || !folder.capabilities?.canAddChildren) throw new Error('저장 가능한 폴더를 다시 선택하세요.');
      const json = JSON.stringify(data,null,2);
      if(new Blob([json]).size > LIMIT) throw new Error('백업은 10MB 이하여야 합니다.');
      const name = `memoapp-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
      const body = new FormData();
      body.append('metadata',new Blob([JSON.stringify({name,mimeType:'application/json',parents:[folderId]})],{type:'application/json'}));
      body.append('file',new Blob([json],{type:'application/json'}));
      return (await request('upload/drive/v3/files?uploadType=multipart&fields=id,name',{method:'POST',body})).json();
    }
    async function download(id) {
      const info = await metadata(id);
      if(info.trashed || info.mimeType !== 'application/json') throw new Error('JSON 백업 파일을 선택하세요.');
      if(Number(info.size) > LIMIT) throw new Error('10MB 이하의 JSON 파일을 선택하세요.');
      const response = await request(`drive/v3/files/${encodeURIComponent(id)}?alt=media`);
      const reader = response.body.getReader(); const chunks=[];let length=0;
      try {
        for (;;) {const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>LIMIT){await reader.cancel();throw new Error('10MB 이하의 JSON 파일을 선택하세요.');}chunks.push(value);}
      } finally {reader.releaseLock();}
      return {name:info.name,text:await new Blob(chunks).text()};
    }
    return {metadata,upload,download,account:async()=> (await request('drive/v3/about?fields=user(displayName,emailAddress,permissionId)')).json()};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={createClient,LIMIT};else root.MemoDriveClient={createClient,LIMIT};
})(globalThis);
