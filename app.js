const tr = (...args) => MemoI18n.t(...args);
const KEY = 'memoapp.notes.v1';
const BACKUP_KEY = 'memoapp.preImportBackup.v1';
let pendingImport = null;
const PAGE_SIZE_KEY = 'memoapp.pageSize.v1';
const PAGE_SIZES = [5, 10, 15, 50];
const LAYOUT_KEY = 'memoapp.layout.v1';
const LAYOUTS = ['list', 'table', 'sticky'];
let layout = 'list';
try { const saved = localStorage.getItem(LAYOUT_KEY); if (LAYOUTS.includes(saved)) layout = saved; } catch {}
let currentPage = 1;
let pageSize = 5;
try { const saved = Number(localStorage.getItem(PAGE_SIZE_KEY)); if (PAGE_SIZES.includes(saved)) pageSize = saved; } catch {}
let language = 'en';
const SETTINGS_KEY = 'memoapp.settings.v1';
try {
  const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
  if (settings && ['en','ko','de'].includes(settings.language)) language = settings.language;
  if (settings && LAYOUTS.includes(settings.layout) && PAGE_SIZES.includes(settings.pageSize)) { layout = settings.layout; pageSize = settings.pageSize; }
} catch {}
const urlLanguage = location.pathname.match(/^\/(en|ko|de)(?:\/|$)/)?.[1];
language = urlLanguage || (location.pathname === '/' ? 'en' : language);
MemoI18n.apply(language);
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
    status(tr("저장된 메모를 읽을 수 없습니다. 기존 데이터를 보호하기 위해 저장을 중단했습니다. 브라우저 저장소 설정을 확인하세요."));
    $('save').disabled = true;
    return [];
  }
}
function persist(next) {
  if (!storageHealthy) return false;
  try { localStorage.setItem(KEY, JSON.stringify(next)); notes = next; return true; }
  catch { status(tr("저장하지 못했습니다. 저장 공간이나 브라우저 설정을 확인하세요. 입력 내용은 유지됩니다.")); return false; }
}
function resetEditor() {
  editingId = null;
  $('memo-form').reset();
  $('editor-heading').textContent = tr("새 메모");
  $('mode').textContent = tr('WRITE');
  $('save').textContent = tr("메모 저장 ↗");
  $('cancel').hidden = true;
  $('characters').textContent = tr("0자");
}
function splitContent(content) {
  const newline = content.indexOf('\n');
  return {title:(newline < 0 ? content : content.slice(0, newline)).trim(), body:newline < 0 ? '' : content.slice(newline + 1)};
}
function isDirty() { return Boolean($('body').value); }
function canLeaveEditor() { return !isDirty() || confirm(tr("현재 입력 중인 내용을 버릴까요?")); }
function render() {
  $('count').textContent = notes.length;
  const query = $('search').value.trim().toLocaleLowerCase();
  const field = $('sort').value;
  const filtered = MemoTransfer.sort(notes.filter(n => n.content.toLocaleLowerCase().includes(query)), field);
  $('results').textContent = query ? tr('countResults', {n:filtered.length}) : ($('sort').value === 'createdAt' ? tr("최근 작성한 메모부터 표시합니다") : tr("최근 수정한 메모부터 표시합니다"));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  currentPage = Math.min(Math.max(1, currentPage), pages);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  $('page-range').textContent = tr('range', {label:query?tr('검색 결과'):tr('전체'),total:filtered.length,start:filtered.length?start+1:0,end:start+visible.length});
  $('page-prev').disabled = currentPage === 1;
  $('page-next').disabled = currentPage === pages;
  $('page-numbers').replaceChildren();
  const pageNumbers = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, pages])].filter(n => n >= 1 && n <= pages).sort((a,b) => a-b);
  let lastPageNumber = 0;
  for (const number of pageNumbers) {
    if (lastPageNumber && number - lastPageNumber > 1) { const gap = document.createElement('span'); gap.textContent = '…'; $('page-numbers').append(gap); }
    const button = document.createElement('button'); button.type = 'button'; button.textContent = number;
    button.setAttribute('aria-label', tr('pageLabel', {n:number}));
    if (number === currentPage) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => { currentPage = number; render(); });
    $('page-numbers').append(button); lastPageNumber = number;
  }
  $('list').className = layout === 'sticky' ? 'sticky-grid' : '';
  $('list').hidden = layout === 'table' && filtered.length > 0;
  $('table-wrap').hidden = layout !== 'table' || !filtered.length;
  $('table-date-heading').textContent = field === 'createdAt' ? tr("작성일") : tr("수정일");
  $('table-body').replaceChildren();
  $('list').replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('div'); empty.className = 'empty';
    empty.textContent = query ? tr("검색 결과가 없습니다.") : tr("아직 메모가 없습니다. 첫 번째 생각을 기록해 보세요.");
    $('list').append(empty);
  }
  for (const note of visible) {
    const fragment = $(layout === 'table' ? 'table-template' : 'note-template').content.cloneNode(true);
    const display = splitContent(note.content);
    fragment.querySelector('h3').textContent = display.title || tr("제목 없음");
    if (note.conflictOf) fragment.querySelector('.note-label').textContent = tr("충돌 사본");
    fragment.querySelector('.note-content').textContent = display.body;
    fragment.querySelector('.note-content').hidden = !display.body;
    const time = fragment.querySelector('time');
    const displayedAt = note[$('sort').value];
    time.dateTime = displayedAt;
    time.textContent = new Intl.DateTimeFormat(MemoI18n.locale, {dateStyle:'medium',timeStyle:'short'}).format(new Date(displayedAt));
    fragment.querySelector('.view').addEventListener('click', () => {
      $('dialog-title').textContent = display.title || tr("제목 없음");
      $('dialog-content').textContent = display.body;
      $('memo-dialog').showModal();
    });
    fragment.querySelector('.edit').addEventListener('click', () => {
      if (!canLeaveEditor()) return;
      editingId = note.id; $('body').value = note.content;
      $('editor-heading').textContent = tr("메모 수정"); $('mode').textContent = tr('EDIT');
      $('save').textContent = tr("수정 저장 ↗"); $('cancel').hidden = false;
      $('characters').textContent = tr('countChars', {n:note.content.length.toLocaleString(MemoI18n.locale)});
      $('body').focus();
    });
    fragment.querySelector('.delete').addEventListener('click', () => {
      if (!confirm(tr("이 메모를 삭제할까요? 삭제 후 복구할 수 없습니다."))) return;
      if (!persist(notes.filter(n => n.id !== note.id))) return;
      if (editingId === note.id) resetEditor();
      render(); status(tr("메모를 삭제했습니다."));
    });
    $(layout === 'table' ? 'table-body' : 'list').append(fragment);
  }
}
$('memo-form').addEventListener('submit', event => {
  event.preventDefault();
  const body = $('body').value;
  if (!body.trim()) { status(tr("메모 내용을 입력하세요.")); $('body').focus(); return; }
  const now = new Date().toISOString();
  const previous = notes.find(n => n.id === editingId);
  const note = {id:previous?.id || crypto.randomUUID(), content:body, createdAt:previous?.createdAt || now, updatedAt:now, ...(previous?.conflictOf ? {conflictOf:previous.conflictOf} : {})};
  if (!persist([note, ...notes.filter(n => n.id !== note.id)])) return;
  if (!previous) { currentPage = 1; $('search').value = ''; }
  resetEditor(); render(); status(tr("메모를 저장했습니다."));
});
$('cancel').addEventListener('click', () => { if (canLeaveEditor()) resetEditor(); });
$('body').addEventListener('input', () => { $('characters').textContent = tr('countChars', {n:$('body').value.length.toLocaleString(MemoI18n.locale)}); });
$('search').addEventListener('input', () => { currentPage = 1; render(); });
$('settings-open').addEventListener('click', () => {
  $('settings-language').value = language;
  $('settings-layout').value = layout;
  $('page-size').value = String(pageSize);
  $('settings-status').textContent = '';
  $('settings-dialog').showModal();
});
$('settings-cancel').addEventListener('click', () => $('settings-dialog').close());
$('settings-form').addEventListener('submit', event => {
  event.preventDefault();
  const nextLanguage = $('settings-language').value;
  const nextLayout = $('settings-layout').value;
  const nextSize = Number($('page-size').value);
  if (!['en','ko','de'].includes(nextLanguage) || !LAYOUTS.includes(nextLayout) || !PAGE_SIZES.includes(nextSize)) {
    $('settings-status').textContent = tr("보기 방법과 표시 개수를 확인하세요."); return;
  }
  if (nextLanguage !== language && isDirty()) { $('settings-status').textContent = tr('saveBeforeLanguage'); return; }
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({layout:nextLayout, pageSize:nextSize, language:nextLanguage})); }
  catch { $('settings-status').textContent = tr("설정을 저장하지 못했습니다. 브라우저 저장소 설정을 확인하세요."); return; }
  if (nextLanguage !== language) { location.assign('/' + nextLanguage + '/'); return; }
  language = nextLanguage; MemoI18n.apply(language);
  $('characters').textContent = tr('countChars', {n:$('body').value.length.toLocaleString(MemoI18n.locale)});
  $('editor-heading').textContent = tr(editingId ? '메모 수정' : '새 메모');
  $('save').textContent = tr(editingId ? '수정 저장 ↗' : '메모 저장 ↗');
  $('mode').textContent = tr(editingId ? 'EDIT' : 'WRITE');
  clearImport(); $('memo-dialog').close();
  layout = nextLayout; pageSize = nextSize; currentPage = 1;
  $('settings-dialog').close(); render(); status(tr("설정을 저장했습니다. 다음 접속에도 적용됩니다."));
});
$('page-prev').addEventListener('click', () => { currentPage--; render(); });
$('page-next').addEventListener('click', () => { currentPage++; render(); });
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
$('sort').addEventListener('change', () => { currentPage = 1; render(); });
$('export').addEventListener('click', () => {
  if (!storageHealthy) { status(tr("저장소를 읽을 수 없어 내보내기를 중단했습니다.")); return; }
  downloadBackup(backupData()); status(tr("메모 백업 다운로드를 요청했습니다."));
});
$('import').addEventListener('click', () => {
  if (!storageHealthy) { status(tr("저장소를 읽을 수 없어 가져오기를 중단했습니다.")); return; }
  if (isDirty()) { status(tr("입력 중인 메모를 저장하거나 취소한 뒤 가져오세요.")); return; }
  $('import-file').click();
});
$('import-file').addEventListener('change', async () => {
  const file = $('import-file').files[0];
  clearImport();
  if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error(tr("10MB 이하의 JSON 파일을 선택하세요."));
    const incoming = MemoTransfer.parse(await file.text());
    if (!storageHealthy || isDirty()) throw new Error(tr("현재 입력 또는 저장소 상태가 바뀌었습니다. 메모를 저장한 뒤 다시 가져오세요."));
    const snapshot = localStorage.getItem(KEY);
    const current = snapshot === null ? [] : MemoTransfer.normalize(JSON.parse(snapshot));
    const plan = MemoTransfer.merge(current, incoming);
    pendingImport = {plan, snapshot};
    const c = plan.counts;
    $('import-summary').textContent = tr('mergeSummary', {name:file.name,...c});
    $('import-preview').hidden = false;
    $('import-confirm').focus();
  } catch (error) { status(error.message || tr("파일을 읽을 수 없습니다.")); }
});
$('import-cancel').addEventListener('click', clearImport);
$('import-confirm').addEventListener('click', () => {
  if (!pendingImport || !storageHealthy) return;
  if (isDirty()) { status('입력 중인 메모를 저장하거나 취소한 뒤 다시 가져오세요.'); return; }
  try {
    if (localStorage.getItem(KEY) !== pendingImport.snapshot) {
      clearImport(); notes = loadNotes(); render(); status(tr("다른 변경이 있어 병합을 중단했습니다. 파일을 다시 선택하세요.")); return;
    }
    // Keep a durable local recovery copy as well as requesting a download.
    const backup = {version:1, exportedAt:new Date().toISOString(), notes:pendingImport.snapshot === null ? [] : MemoTransfer.normalize(JSON.parse(pendingImport.snapshot))};
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    downloadBackup(backup, 'memoapp-before-import');
    if (!persist(pendingImport.plan.notes)) return;
    clearImport(); currentPage = 1; $('sort').value = 'createdAt'; render();
    status(tr("병합했습니다. 원래 작성일 최신순으로 정렬했습니다. 병합 전 백업 다운로드도 확인하세요."));
  } catch { status(tr("백업 또는 병합을 완료하지 못했습니다. 기존 메모는 유지됩니다. 저장 공간과 다운로드 설정을 확인하세요.")); }
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
    $('editor-heading').textContent = tr("새 메모"); $('mode').textContent = tr('WRITE');
    $('save').textContent = tr("메모 저장 ↗"); $('cancel').hidden = true;
  }
  render();
  if (storageHealthy) status(tr("다른 탭의 변경을 반영했습니다. 입력 중인 내용은 유지됩니다."));
});
notes = loadNotes(); render();







document.addEventListener('click', event => {
  const link = event.target.closest('a[hreflang]');
  if (link && isDirty()) { event.preventDefault(); status(tr('saveBeforeLanguage')); }
});
