const {test}=require('node:test'),assert=require('node:assert/strict');
const {detect,select}=require('./language.js');
test('browser preference order and fallback',()=>{assert.equal(detect(['fr-FR','ko-KR','en-US']),'ko');assert.equal(detect(['de-DE','ko']),'de');assert.equal(detect(['en-US','de']),'en');assert.equal(detect(['fr']), 'en');assert.equal(detect([]),'en');});
test('explicit URL wins, then saved choice, then browser',()=>{assert.equal(select('/de/','ko',['en']),'de');assert.equal(select('/','ko',['de']),'ko');assert.equal(select('/',undefined,['de-DE']),'de');assert.equal(select('/','bad',['ko-KR']),'ko');});
