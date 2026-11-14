/* Language routing needs no external service and never changes note data. */
(function(root) {
  'use strict';
  const supported = ['en','ko','de'];
  function detect(preferred) {
    for (const value of preferred || []) {
      if (typeof value !== 'string') continue;
      const language = value.toLowerCase().split(/[-_]/)[0];
      if (supported.includes(language)) return language;
    }
    return 'en';
  }
  function select(pathname, saved, preferred) {
    const explicit = pathname.match(/^\/(en|ko|de)(?:\/|$)/)?.[1];
    if (explicit) return explicit;
    if (supported.includes(saved)) return saved;
    return detect(preferred);
  }
  const api = {detect,select};
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  let saved;
  try { saved = JSON.parse(localStorage.getItem('memoapp.settings.v1') || 'null')?.language; } catch {}
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
  api.current = select(location.pathname, saved, preferred);
  root.MemoLanguage = api;
  if (location.pathname === '/' || location.pathname === '/index.html') {
    location.replace('/' + api.current + '/' + location.search + location.hash);
  }
})(globalThis);
