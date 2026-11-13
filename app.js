'use strict';
const KEY = 'memoapp.notes.v1';
const BACKUP_KEY = 'memoapp.preImportBackup.v1';
let pendingImport = null;
const $ = (id) => document.getElementById(id);
let notes = [];
let editingId = null;
let storageHealthy = true;
const status = (message) => { $('status').textContent = message; };
function loadNotes() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return [];
    const data = JSON.parse(raw);
    return MemoTransfer.normalize(data);
  } catch {
    storageHealthy = false;
    status('저장된 메모를 읽을 수 없습니다. 기존 데이터를 보호하기 위해 저장을 중단했습니다. 브라우저 저장소 설정을 확인하세요.');
    $('save').disabled = true;
    return [];
  }
}
function persist(next) {
  if (!storageHealthy) return false;
  try { localStorage.setItem(KEY, JSON.stringify(next)); notes = next; return true; }
  catch { status('저장하지 못했습니다. 저장 공간이나 브라우저 설정을 확인하세요. 입력 내용은 유지됩니다.'); return false; }
}
function resetEditor() {
  editingId = null;
  $('memo-form').reset();
  $('editor-heading').textContent = '새 메모';
  $('mode').textContent = 'WRITE';
  $('save').textContent = '메모 저장 ↗';
  $('cancel').hidden = true;
  $('characters').textContent = '0자';
}
function splitContent(content) {
  const newline = content.indexOf('\n');
  return {title:(newline < 0 ? content : content.slice(0, newline)).trim(), body:newline < 0 ? '' : content.slice(newline + 1)};
}
function isDirty() { return Boolean($('body').value); }
function canLeaveEditor() { return !isDirty() || confirm('현재 입력 중인 내용을 버릴까요?'); }
function render() {
  $('count').textContent = notes.length;
  const query = $('search').value.trim().toLocaleLowerCase();
  const field = $('sort').value;
  const filtered = MemoTransfer.sort(notes.filter(n => n.content.toLocaleLowerCase().includes(query)), field);
  $('results').textContent = query ? `${filtered.length}개의 검색 결과` : ($('sort').value === 'createdAt' ? '최근 작성한 메모부터 표시합니다' : '최근 수정한 메모부터 표시합니다');
  $('list').replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('div'); empty.className = 'empty';
    empty.textContent = query ? '검색 결과가 없습니다.' : '아직 메모가 없습니다. 첫 번째 생각을 기록해 보세요.';
    $('list').append(empty);
  }
  for (const note of filtered) {
    const fragment = $('note-template').content.cloneNode(true);
    const display = splitContent(note.content);
    fragment.querySelector('h3').textContent = display.title || '제목 없음';
    if (note.conflictOf) fragment.querySelector('.note-label').textContent = '충돌 사본';
    fragment.querySelector('.note-content').textContent = display.body;
    fragment.querySelector('.note-content').hidden = !display.body;
    const time = fragment.querySelector('time');
    const displayedAt = note[$('sort').value];
    time.dateTime = displayedAt;
    time.textContent = new Intl.DateTimeFormat('ko-KR', {dateStyle:'medium',timeStyle:'short'}).format(new Date(displayedAt));
    fragment.querySelector('.edit').addEventListener('click', () => {
      if (!canLeaveEditor()) return;
      editingId = note.id; $('body').value = note.content;
      $('editor-heading').textContent = '메모 수정'; $('mode').textContent = 'EDIT';
      $('save').textContent = '수정 저장 ↗'; $('cancel').hidden = false;
      $('characters').textContent = `${note.content.length.toLocaleString()}자`;
      $('body').focus();
    });
    fragment.querySelector('.delete').addEventListener('click', () => {
      if (!confirm('이 메모를 삭제할까요? 삭제 후 복구할 수 없습니다.')) return;
      if (!persist(notes.filter(n => n.id !== note.id))) return;
      if (editingId === note.id) resetEditor();
      render(); status('메모를 삭제했습니다.');
    });
    $('list').append(fragment);
  }
}
$('memo-form').addEventListener('submit', event => {
  event.preventDefault();
  const body = $('body').value;
  if (!body.trim()) { status('메모 내용을 입력하세요.'); $('body').focus(); return; }
  const now = new Date().toISOString();
  const previous = notes.find(n => n.id === editingId);
  const note = {id:previous?.id || crypto.randomUUID(), content:body, createdAt:previous?.createdAt || now, updatedAt:now, ...(previous?.conflictOf ? {conflictOf:previous.conflictOf} : {})};
  if (!persist([note, ...notes.filter(n => n.id !== note.id)])) return;
  resetEditor(); render(); status('메모를 저장했습니다.');
});
$('cancel').addEventListener('click', () => { if (canLeaveEditor()) resetEditor(); });
$('body').addEventListener('input', () => { $('characters').textContent = `${$('body').value.length.toLocaleString()}자`; });
$('search').addEventListener('input', render);
$('memo-form').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); $('memo-form').requestSubmit(); } });
function downloadBackup(data, prefix = 'memoapp') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}));
  const link = document.createElement('a');
  link.href = url; link.download = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function backupData() { return {version:1, exportedAt:new Date().toISOString(), notes}; }
function clearImport() { pendingImport = null; $('import-preview').hidden = true; $('import-file').value = ''; }
$('sort').addEventListener('change', render);
$('export').addEventListener('click', () => {
  if (!storageHealthy) { status('저장소를 읽을 수 없어 내보내기를 중단했습니다.'); return; }
  downloadBackup(backupData()); status('메모 백업 다운로드를 요청했습니다.');
});
$('import').addEventListener('click', () => {
  if (!storageHealthy) { status('저장소를 읽을 수 없어 가져오기를 중단했습니다.'); return; }
  if (isDirty()) { status('입력 중인 메모를 저장하거나 취소한 뒤 가져오세요.'); return; }
  $('import-file').click();
});
function assertImportable() {
  if (!storageHealthy || isDirty()) throw new Error('입력 중인 메모를 저장하거나 취소하세요.');
}
function previewImport(text, name) {
  clearImport();
  assertImportable();
  if (new Blob([text]).size > 10 * 1024 * 1024) throw new Error('10MB 이하의 JSON 파일을 선택하세요.');
  const incoming = MemoTransfer.parse(text);
  const snapshot = localStorage.getItem(KEY);
  const current = snapshot === null ? [] : MemoTransfer.normalize(JSON.parse(snapshot));
  const plan = MemoTransfer.merge(current, incoming);
  pendingImport = {plan, snapshot};
  const c = plan.counts;
  $('import-summary').textContent = `${name}: 추가 ${c.added} · 갱신 ${c.updated} · 중복 ${c.duplicate} · 기존 최신 유지 ${c.kept} · 충돌 사본 ${c.conflict}개`;
  $('import-preview').hidden = false;
  $('import-confirm').focus();
}
window.MemoAppTransfer = {
  assertImportable,
  preview:previewImport,
  exportData() {
    if (!storageHealthy) throw new Error('저장소를 읽을 수 없습니다.');
    if (isDirty()) throw new Error('입력 중인 메모를 먼저 저장하세요.');
    const raw = localStorage.getItem(KEY);
    return {version:1, exportedAt:new Date().toISOString(), notes:raw === null ? [] : MemoTransfer.normalize(JSON.parse(raw))};
  }
};
$('import-file').addEventListener('change', async () => {
  const file = $('import-file').files[0];
  clearImport();
  if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('10MB 이하의 JSON 파일을 선택하세요.');
    previewImport(await file.text(), file.name);
  } catch (error) { status(error.message || '파일을 읽을 수 없습니다.'); }
});
$('import-cancel').addEventListener('click', clearImport);
$('import-confirm').addEventListener('click', () => {
  if (!pendingImport || !storageHealthy) return;
  if (isDirty()) { status('입력 중인 메모를 저장하거나 취소한 뒤 다시 가져오세요.'); return; }
  try {
    if (localStorage.getItem(KEY) !== pendingImport.snapshot) {
      clearImport(); notes = loadNotes(); render(); status('다른 변경이 있어 병합을 중단했습니다. 파일을 다시 선택하세요.'); return;
    }
    // Keep a durable local recovery copy as well as requesting a download.
    const backup = {version:1, exportedAt:new Date().toISOString(), notes:pendingImport.snapshot === null ? [] : MemoTransfer.normalize(JSON.parse(pendingImport.snapshot))};
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    downloadBackup(backup, 'memoapp-before-import');
    if (!persist(pendingImport.plan.notes)) return;
    clearImport(); $('sort').value = 'createdAt'; render();
    status('병합했습니다. 원래 작성일 최신순으로 정렬했습니다. 병합 전 백업 다운로드도 확인하세요.');
  } catch { status('백업 또는 병합을 완료하지 못했습니다. 기존 메모는 유지됩니다. 저장 공간과 다운로드 설정을 확인하세요.'); }
});
window.addEventListener('beforeunload', event => { if (isDirty()) { event.preventDefault(); event.returnValue = ''; } });
// Another tab may have changed the collection. Reload before accepting further writes.
window.addEventListener('storage', event => {
  if (event.key !== KEY && event.key !== null) return;
  clearImport();
  storageHealthy = true; $('save').disabled = false;
  notes = loadNotes();
  if (editingId && !notes.some(n => n.id === editingId)) {
    editingId = null;
    $('editor-heading').textContent = '새 메모'; $('mode').textContent = 'WRITE';
    $('save').textContent = '메모 저장 ↗'; $('cancel').hidden = true;
  }
  render();
  if (storageHealthy) status('다른 탭의 변경을 반영했습니다. 입력 중인 내용은 유지됩니다.');
});
notes = loadNotes(); render();

