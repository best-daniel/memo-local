const {test} = require('node:test');
const assert = require('node:assert/strict');
const {parse, merge, sort} = require('./transfer.js');
const note = (id, content, date='2026-11-10T10:00:00.000Z') => ({id,content,createdAt:'2026-11-01T10:00:00.000Z',updatedAt:date});
const file = notes => JSON.stringify({version:1,exportedAt:'2026-11-12T10:00:00.000Z',notes});
test('adds without deleting local notes, latest wins, no input mutation', () => {
 const a=[note('keep','B'),note('update','old'),note('newer','new','2026-11-12T10:00:00.000Z')];
 const b=[note('add','A'),note('update','new','2026-11-11T10:00:00.000Z'),note('newer','old')];
 const before=JSON.stringify([a,b]); const plan=merge(a,b);
 assert.equal(plan.notes.length,4);assert.equal(plan.notes.find(n=>n.id==='update').content,'new');assert.equal(plan.notes.find(n=>n.id==='newer').content,'new');assert.equal(JSON.stringify([a,b]),before);
 assert.deepEqual(plan.counts,{added:1,updated:1,duplicate:0,kept:1,conflict:0});
});
test('equal timestamp conflicts preserve both and reimport is idempotent', () => {
 const a=[note('id','B')],b=[note('id','A')];const p=merge(a,b,()=> 'copy');
 assert.equal(p.notes.length,2);assert.equal(p.counts.conflict,1);assert.equal(p.notes.find(n=>n.id==='copy').conflictOf,'id');
 assert.equal(merge(p.notes,b).notes.length,2);assert.equal(parse(file(p.notes)).find(n=>n.id==='copy').conflictOf,'id');
});
test('duplicate content retains newer metadata; empty file deletes nothing', () => {
 const a=note('id','same'),b=note('id','same','2026-11-11T10:00:00.000Z');const p=merge([a],[b]);
 assert.equal(p.counts.duplicate,1);assert.equal(p.notes[0].updatedAt,b.updatedAt);assert.deepEqual(merge([a],[]).notes,[a]);
});
test('preserves raw leading newline and legacy empty title',()=>{
 const n=note('id','\n본문\n');assert.equal(parse('\uFEFF'+file([n]))[0].content,n.content);
 const old={...n,title:'',body:'본문'};delete old.content;assert.equal(parse(file([old]))[0].content,'\n본문');
});
test('rejects malformed JSON, duplicate IDs, impossible dates, empty content, future version',()=>{
 assert.throws(()=>parse('{'));
 for(const items of [[note('id','x'),note('id','y')],[note('id','x','2026-02-30T10:00:00Z')],[note('id','x','2026-11-10T24:00:00Z')],[note('id','  ')]])assert.throws(()=>parse(file(items)));
 assert.throws(()=>parse(JSON.stringify({version:2,notes:[]})));
});
test('sorts by chronological instant across offsets, supports creation and modification',()=>{
 const a={...note('a','A','2026-11-12T10:00:00Z'),createdAt:'2026-11-10T10:00:00+09:00'};
 const b={...note('b','B'),createdAt:'2026-11-10T02:00:00Z'};
 assert.deepEqual(sort([a,b]).map(n=>n.id),['b','a']);assert.deepEqual(sort([a,b],'updatedAt').map(n=>n.id),['a','b']);
});
