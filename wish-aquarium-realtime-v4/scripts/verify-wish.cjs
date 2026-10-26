// New wish journey: shared rules, record validation, stats honesty, and real-catalog-only results.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const catalog=require('../creature-catalog.json');
const model=require('../catalog-model.js')(catalog);
const W=require('../wish-core.js')(),R=W.create(model);

// Every wish offered has real creatures; every way offered for it has real creatures.
assert.equal(R.wishTypes.length,24);
for(const w of R.wishTypes){
  assert.ok(W.WISH_LABELS[w],'label '+w);
  const ways=R.waysFor(w);assert.ok(ways.length>0);
  for(const way of ways){
    const list=R.creaturesFor(w,way);
    assert.ok(list.length>0&&list[0].wayIndex===way,'first candidate matches chosen way');
    for(const e of list){assert.equal(e.wishType,w);assert.ok(model.get(e.id));assert.match(e.imageUrl,/^assets\/catalog\/WC-[0-9a-f]{12}\.png$/);}
  }
}
// 인정 소망 has no creatures and is never offered.
assert.ok(!R.wishTypes.some(w=>model.methods(w)[0]?.situationIndex===6));
// Record validation: unknown IDs rejected, fields clamped, text cleaned.
assert.equal(R.cleanRecord({catalogId:'WC-000000000000'}),null);
assert.equal(R.cleanRecord(null),null);
const e=catalog.entries[0];
const r=R.cleanRecord({catalogId:e.id,wishTypes:['가짜 소망',e.wishType,R.wishTypes[3],R.wishTypes[4],R.wishTypes[5]],hours:[5,5,24,-1,'7',3.5],years:99,message:'  a\u0000b\n'+'x'.repeat(300)});
assert.equal(r.wishType,e.wishType);assert.equal(r.wishTypes[0],e.wishType);assert.ok(r.wishTypes.length<=3);
assert.deepEqual(r.hours,[5,7]);assert.equal(r.years,11);assert.ok(r.message.length<=W.MAX_MESSAGE);assert.ok(!/[\u0000-\u001f]/.test(r.message));
// The 'moment' text is never part of a stored record.
assert.ok(!('moment' in R.cleanRecord({catalogId:e.id,moment:'secret'})));

// Server: records only from cleanRecord; stats never fabricate.
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
assert.ok(server.includes('wishRules.cleanRecord(request.body)'));
assert.ok(server.includes("app.post('/api/wish-records'")&&server.includes("app.get('/api/wish-stats'"));
assert.ok(!/Math\.random/.test(server.slice(server.indexOf("app.get('/api/wish-stats'"),server.indexOf("app.get(['/shared-aquarium'"))),'stats must not be randomised');

// Front end: index loads the new journey; results and release use catalog IDs only.
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const f of ['wish-core.js','wish-field.js','wish.js','wish.css','creature-catalog.js','catalog-model.js'])assert.ok(html.includes(f),f);
const app=fs.readFileSync(path.join(root,'wish.js'),'utf8');
assert.ok(app.includes("emit('creature:release', { catalogId: S.entry.id"));
assert.ok(app.includes('C.creaturesFor('),'results come from the real catalog');
assert.ok(!/generate|synthetic|recolor/i.test(app));
assert.equal((app.match(/<video /g)||[]).length,1,'one video on the result card');
assert.ok(app.includes("return r.blob();"),'saving uses the original PNG bytes');
assert.ok(/body: JSON\.stringify\(\{ recordId: S\.recordId, catalogId: S\.entry\.id, wishTypes: S\.wishes, hours: S\.hours, years: S\.years, message: S\.message \}\)/.test(app),'the moment text is not sent');
console.log('PASS: 24 real wishes with real creatures per way, 인정 소망 not offered, record cleaning/clamping, moment text never stored, honest stats, catalog-only results and release, one video, original PNG save.');
