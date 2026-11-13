/* Pure JSON validation and merge rules, shared by browser and Node tests. */
(function (root) {
  'use strict';
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) && (() => {
    const [y,m,d] = value.slice(0,10).split('-').map(Number);
    const [hour,minute,second] = value.slice(11,19).split(':').map(Number);
    return hour < 24 && minute < 60 && second < 60 && m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y,m,0)).getUTCDate();
  })();
  function normalize(items) {
    if (!Array.isArray(items) || items.length > 50000) throw new Error('메모 목록이 올바르지 않습니다.');
    const ids = new Set();
    return items.map((n, index) => {
      if (!n || typeof n.id !== 'string' || !n.id.trim() || n.id.length > 300 || ids.has(n.id) ||
          !(typeof n.content === 'string' || (typeof n.title === 'string' && typeof n.body === 'string')) ||
          !validDate(n.createdAt) || !validDate(n.updatedAt) || Date.parse(n.updatedAt) < Date.parse(n.createdAt) ||
          (n.conflictOf !== undefined && (typeof n.conflictOf !== 'string' || !n.conflictOf.trim() || n.conflictOf.length > 300))) {
        throw new Error(`${index + 1}번째 메모의 ID·내용·날짜가 올바르지 않거나 ID가 중복되었습니다.`);
      }
      const content = typeof n.content === 'string' ? n.content : n.title + '\n' + n.body;
      if (!content.trim() || content.length > 100000) throw new Error(`${index + 1}번째 메모의 내용이 비어 있거나 너무 큽니다.`);
      ids.add(n.id);
      return {id:n.id, content, createdAt:n.createdAt, updatedAt:n.updatedAt, ...(n.conflictOf ? {conflictOf:n.conflictOf} : {})};
    });
  }
  function parse(text) {
    let data;
    try { data = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('올바른 JSON 파일이 아닙니다.'); }
    if (!data || data.version !== 1 || !validDate(data.exportedAt)) throw new Error('지원하지 않는 파일 형식입니다. version: 1, exportedAt, notes가 필요합니다.');
    return normalize(data.notes);
  }
  function sort(items, field = 'createdAt') {
    return [...items].sort((a,b) => Date.parse(b[field]) - Date.parse(a[field]) || a.id.localeCompare(b.id));
  }
  function merge(local, incoming, newId = () => crypto.randomUUID()) {
    const map = new Map(local.map(n => [n.id, {...n}]));
    const counts = {added:0, updated:0, duplicate:0, kept:0, conflict:0};
    for (const n of incoming) {
      const old = map.get(n.id);
      if (!old) { map.set(n.id, {...n}); counts.added++; continue; }
      if (old.content === n.content) {
        // Same content is a duplicate; retain the newest metadata so later merges stay monotonic.
        if (Date.parse(n.updatedAt) > Date.parse(old.updatedAt)) map.set(n.id, {...n});
        counts.duplicate++; continue;
      }
      const delta = Date.parse(n.updatedAt) - Date.parse(old.updatedAt);
      if (delta > 0) { map.set(n.id, {...n}); counts.updated++; }
      else if (delta < 0) counts.kept++;
      else {
        const existing = [...map.values()].some(copy => copy.conflictOf === n.id && copy.content === n.content && Date.parse(copy.updatedAt) === Date.parse(n.updatedAt));
        if (existing) { counts.duplicate++; continue; }
        let id = newId();
        if (map.has(id) || incoming.some(item => item.id === id)) throw new Error('충돌 사본 ID 생성에 실패했습니다. 다시 시도하세요.');
        map.set(id, {...n, id, conflictOf:n.id}); counts.conflict++;
      }
    }
    return {notes:sort([...map.values()]), counts};
  }
  const api = {parse, normalize, merge, sort};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MemoTransfer = api;
})(globalThis);
