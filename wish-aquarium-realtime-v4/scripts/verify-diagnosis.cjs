// Diagnosis ranking, grouped selection screens, empty directions and the
// exploration trail. DOM harness (same approach as verify-ui-flow.cjs).
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const catalog=require('../creature-catalog.json');
const model=require('../catalog-model.js')(catalog);
const elements=new Map();
function element(key){if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',disabled:false,dataset:{},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},querySelector(selector){return element(key+' '+selector)},querySelectorAll(){return []},focus(){},pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()},remove(){},appendChild(){},load(){},insertAdjacentHTML(){}});return elements.get(key)}
const app=element('#app');
const context={
  WishCatalog:model,console,Event:class Event{},
  document:{querySelector:element,createElement:tag=>element('created:'+tag),body:element('body'),documentElement:element('html'),head:element('head')},
  window:{WISH_AQUARIUM_CONFIG:{},matchMedia:()=>({matches:false,addEventListener(){}}),scrollTo(){},setTimeout:()=>1,clearTimeout(){},crypto:{randomUUID:()=> 'test-release-id'}},
  navigator:{},URL,fetch:()=>{throw new Error('Unexpected network access in diagnosis verification.')},setTimeout:()=>1,clearTimeout(){}
};
vm.createContext(context);
for(const name of ['data.js','catalog-ui.js','wish-interactions.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
const run=code=>vm.runInContext(code,context);

// 1. Ranking keeps the published first-place rule for every possible answer set.
for(let a=0;a<343;a++)for(const axis of [0,1]){
  const picks=[a%7,Math.floor(a/7)%7,Math.floor(a/49)];
  const answers=axis===0?[...picks,0,0,0]:[0,0,0,...picks];
  const ranked=run(`rankAxis(${JSON.stringify(answers)},${axis})`);
  assert.equal(ranked[0].index,run(`scoreAnswers(${JSON.stringify(answers)})`)[axis],`first place ${answers}`);
  assert.equal(ranked.length,7);
  assert.equal(ranked.reduce((sum,row)=>sum+row.score,0),3);
}

// 2. Answer order is a fixed permutation; stored answers stay type indices.
const orders=run('answerOrders');
assert.equal(orders.length,6);
for(const order of orders)assert.deepEqual([...order].sort(),[0,1,2,3,4,5,6]);
assert.ok(orders.some((order,i)=>i>0&&order.join()!==orders[0].join()),'Orders differ between questions.');

// 3. Wish groups: only directions the answers touched, closest first, real assets only.
run('answers=[0,0,1,0,0,0]; showWishDetails();');
let html=app.innerHTML;
for(const d of model.directions(0))assert.ok(html.includes(d.name));
for(const d of model.directions(1))assert.ok(html.includes(d.name));
assert.ok(html.indexOf(model.directions(0)[0].name)<html.indexOf(model.directions(1)[0].name),'Closest direction first.');
assert.ok(!html.includes(model.directions(2)[0].name),'Untouched direction stays behind "다른 방향".');
assert.ok(html.includes('세 질문 중 2번'));

// 4. 인정 소망 (no creatures) is named honestly and never filled with another creature.
assert.equal(model.directions(6).length,0,'Catalog still has no 인정 소망 creatures.');
run('answers=[6,6,0,0,0,0]; showWishDetails();');
html=app.innerHTML;
assert.ok(html.includes('인정 소망')&&html.includes('깨어나는 중'));
assert.ok(html.includes(model.directions(0)[0].name));
assert.ok(!html.includes('가장 가까움'),'An empty top direction is not relabelled as closest.');
run('answers=[6,6,6,0,0,0]; showWishDetails();');
html=app.innerHTML;
for(const d of model.directions())assert.ok(html.includes(d.name),'All real directions offered when every answer is 인정.');

// 5. Method screen: every real method stays selectable; untouched ways sit in "다른 방식".
for(const wishType of [...new Set(catalog.entries.map(e=>e.wishType))]){
  run(`answers=[0,0,0,6,6,2]; selectedWishType=${JSON.stringify(wishType)}; selectedCatalogId=null; showMethodDetails();`);
  html=app.innerHTML;
  for(const entry of catalog.entries.filter(e=>e.wishType===wishType))assert.ok(html.includes(`data-creature-id="${entry.id}"`),entry.folder);
  assert.equal((html.match(/data-creature-id=/g)||[]).length,catalog.entries.filter(e=>e.wishType===wishType).length,'No extra or synthetic methods.');
}

// 6. Result trail explains the path in the visitor's own choices.
const sample=catalog.entries.find(e=>e.situationIndex===0&&e.wayIndex===6);
run(`answers=[0,0,1,6,6,2]; selectedCatalogId=${JSON.stringify(sample.id)}; wishTrace.holdMs=2400; wishTrace.revealStrokes=3; showResult();`);
html=app.innerHTML;
assert.ok(html.includes('이 생물을 만나게 된 길'));
assert.ok(html.includes('세 개의 소망 질문 중 2번'));
assert.ok(html.includes('2.4초 동안 소망을 붙잡았고'));
assert.ok(html.includes(sample.imageUrl));
assert.equal(run('objectParticle("때를 기다리기")'),'를');
assert.equal(run('objectParticle("그냥하기 (신속형)")'),'을');
run('home();');
assert.equal(run('wishTrace.holdMs'),0,'Trace resets on restart.');

console.log('PASS: ranking matches the first-place rule for all 343 answer sets per axis, fixed answer orders, grouped wish/method choices with every real method reachable, 인정 소망 shown as not yet available without substitution, result trail and trace reset.');
