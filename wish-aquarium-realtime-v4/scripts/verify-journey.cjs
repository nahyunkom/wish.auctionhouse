const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const model=require('../catalog-model.js')(require('../creature-catalog.json'));
const entries=model.entries,elements=new Map(),stored=new Map();
function element(key){
 if(!elements.has(key))elements.set(key,{
  innerHTML:'',textContent:'',value:'',disabled:false,dataset:{},style:{setProperty(){}},
  classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},focus(){},
  querySelector(selector){return element(key+' '+selector)},querySelectorAll(){return []},
  pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()},load(){},
  before(){},after(){},appendChild(){},insertAdjacentHTML(){},setPointerCapture(){},getBoundingClientRect(){return {left:0,top:0,width:100,height:100}}
 });
 return elements.get(key);
}
const app=element('#app');
const context={WishCatalog:model,console,Event:class{},AbortController,
 document:{querySelector:element,createElement:tag=>element('create:'+tag),body:element('body'),documentElement:element('html'),head:element('head'),elementFromPoint(){return null;}},
 window:{WISH_AQUARIUM_CONFIG:{},matchMedia:()=>({matches:false,addEventListener(){}}),scrollTo(){},setTimeout:()=>1,clearTimeout(){},crypto:{randomUUID:()=> 'journey-test-id'}},
 localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
 navigator:{},URL,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},performance:{now:()=>0},
 fetch:async()=>({ok:true,json:async()=>({total:0,retentionHours:6,directions:Array.from({length:7},()=>({count:0}))})})
};
vm.createContext(context);
for(const file of ['data.js','catalog-ui.js','app.js','journey.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=code=>vm.runInContext(code,context);
assert.ok(element('#start').innerHTML.includes('소망경매장 입장하기'));
element('#start').onclick();assert.ok(app.innerHTML.includes('내 생물 보관함'));
element('#new-wish').onclick();assert.ok(app.innerHTML.includes('data-choice="0"'));
run('answers[0]=0;');element('#next').onclick();assert.ok(app.innerHTML.includes('wish-moment'));
element('#wish-moment').oninput({target:{value:'<img src=x onerror=alert(1)>'}});
element('#moment-next').onclick();assert.equal(run('step'),1);
run('answers[1]=0;');element('#next').onclick();assert.equal(run('step'),2);
run('answers[2]=0;');element('#next').onclick();assert.ok(app.innerHTML.includes('seed-hold'));
element('#seed-hold').onkeydown({code:'Enter',preventDefault(){}});element('#seed-next').onclick();assert.equal(run('step'),3);
run('answers[3]=0;');element('#next').onclick();assert.equal(run('step'),4);
run('answers[4]=0;');element('#next').onclick();assert.equal(run('step'),5);
run('answers[5]=0;');element('#next').onclick();assert.ok(app.innerHTML.includes('data-wish-index='));
run('selectedCatalogId='+JSON.stringify(entries[0].id)+'; selectedWishType='+JSON.stringify(entries[0].wishType)+'; discover();');
assert.ok(app.innerHTML.includes(entries[0].imageUrl));assert.ok(!app.innerHTML.includes('data-result-tank'));
element('#encounter-next').onclick();assert.ok(app.innerHTML.includes('wish-rhythm'));
element('#wish-rhythm').oninput({target:{value:'4'}});element('#rhythm-next').onclick();assert.ok(app.innerHTML.includes('data-care='));
element('#care-next').onclick();assert.ok(app.innerHTML.includes('wish-letter'));
element('#wish-letter').oninput({target:{value:'<script>bad()</script>'}});element('#letter-next').onclick();
assert.ok(app.innerHTML.includes(entries[0].id));assert.equal((app.innerHTML.match(/<video\b/g)||[]).length,1);
assert.ok(element('#app .record').innerHTML.includes('&lt;script&gt;'));
assert.ok(element('#app .record').innerHTML.includes('&lt;img'));
assert.ok(element('#app .record').innerHTML.includes('잠들기 전'));
assert.equal(stored.size,0,'Private notes and answers must not be stored automatically.');
element('#keep-local').onclick();
const saved=JSON.parse(stored.get('wish-auction-collection-v1'));
assert.deepEqual(Object.keys(saved[0]).sort(),['at','id']);assert.equal(saved[0].id,entries[0].id);
run('realtime.released=true;currentResult.clientReleaseId="keep-id";showResult();');
assert.equal(run('realtime.released'),true);assert.equal(run('currentResult.clientReleaseId'),'keep-id','Returning from reports cannot create a new release id.');
run('window.WishJourney.showFieldGuide(6);');assert.ok(app.innerHTML.includes('아직 준비 중'));
run('window.WishJourney.showCollection();');assert.ok(app.innerHTML.includes(entries[0].imageUrl));
element('#clear-collection').onclick();assert.equal(stored.size,0);
run('home();');assert.equal(run('currentResult'),null);assert.equal(run('selectedCatalogId'),null);
run('selectedCatalogId='+JSON.stringify(entries[0].id)+';showResult();');assert.ok(!element('#app .record').innerHTML.includes('&lt;script&gt;'),'New visitors must not see previous private notes.');
run('selectedCatalogId="missing";showResult();');assert.ok(app.innerHTML.includes('data-wish-index='),'Unknown results never fabricate an image.');
assert.equal(run('currentResult'),null);
run('selectedCatalogId='+JSON.stringify(entries[0].id)+';showResult();');
context.delayedAck=null;
run('realtime.connected=true;realtime.socket={timeout(){return {emit(name,payload,ack){delayedAck=ack;}}}};releaseCreature();home();');
context.delayedAck(null,{ok:true});assert.equal(run('realtime.released'),false,'Late release replies cannot affect the next visitor.');
// Check the real aggregate handler with controlled actual release state.
const source=fs.readFileSync(path.join(root,'server.js'),'utf8');
const start=source.indexOf("app.get('/api/aquarium-summary'"),end=source.indexOf("app.get(['/', '/index.html']",start);
let handler,summary,header;
const serverContext={app:{get(_path,fn){handler=fn}},cleanExpiredCreatures(){},
 creatures:[{situationIndex:0,wayIndex:2},{situationIndex:0,wayIndex:1},{situationIndex:3,wayIndex:2}],
 creatureTtlMs:21600000,situationLabels:['a','b','c','d','e','f','g'],wayLabels:['a','b','c','d','e','f','g']};
vm.runInNewContext(source.slice(start,end),serverContext);
handler({}, {setHeader(k,v){header=[k,v]},json(value){summary=value}});
assert.equal(summary.total,3);assert.equal(summary.directions[0].count,2);assert.equal(summary.directions[6].count,0);assert.equal(summary.methods[2].count,2);
assert.equal(summary.directions.reduce((n,d)=>n+d.count,0),summary.total);assert.equal(summary.retentionHours,6);
assert.deepEqual(header,['Cache-Control','no-store']);assert.ok(!JSON.stringify(summary).includes('moment'));
(async()=>{
 await run('window.WishJourney.showOceanReport();');
 assert.ok(element('#ocean-report-content').innerHTML.includes('아직 이 바다에 도착한 소망이 없어요'));
 context.fetch=async()=>{throw Error('offline')};
 await run('window.WishJourney.showOceanReport();');
 assert.ok(element('#ocean-report-content').innerHTML.includes('다시 불러오기'));
 assert.ok(!element('#ocean-report-content').innerHTML.includes('report-numbers'),'Offline reports must not invent counts.');
 console.log('PASS: extended visitor journey, private text escaping, session reset, opt-in ID-only collection, release-id continuity, no fabricated results, real-release aggregates, and empty/offline reports. DOM harness, not device/browser QA.');
})().catch(error=>{console.error(error);process.exitCode=1;});
