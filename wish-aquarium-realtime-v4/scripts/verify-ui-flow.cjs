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
  navigator:{},URL,fetch:()=>{throw new Error('Unexpected network access in UI verification.')},setTimeout:()=>1,clearTimeout(){}
};
vm.createContext(context);
for(const name of ['data.js','catalog-ui.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
assert.ok(app.innerHTML.includes('수족관 들어가기'));
vm.runInContext('answers=[0,0,0,0,0,0]; showWishDetails();',context);
for(const direction of model.directions(0))assert.ok(app.innerHTML.includes(direction.name));
assert.ok(!app.innerHTML.includes('data-wish-index="24"'));
vm.runInContext('showWishDetails(true);',context);
for(const direction of model.directions())assert.ok(app.innerHTML.includes(direction.name));
for(const entry of catalog.entries){
  vm.runInContext(`selectedWishType=${JSON.stringify(entry.wishType)};selectedCatalogId=${JSON.stringify(entry.id)};showMethodDetails();`,context);
  assert.ok(app.innerHTML.includes(`data-creature-id="${entry.id}"`),entry.folder);
  vm.runInContext('showResult();',context);
  assert.ok(app.innerHTML.includes(entry.imageUrl),entry.folder+' PNG');
  assert.ok(app.innerHTML.includes(entry.id),entry.folder+' ID');
  assert.ok(app.innerHTML.includes(entry.wishType),entry.folder+' wish type');
  assert.ok(app.innerHTML.includes(entry.methodType),entry.folder+' method type');
  assert.ok(!app.innerHTML.includes('assets/creature-'));
  assert.equal((app.innerHTML.match(/<video\b/g)||[]).length,1,'Load only the selected result video.');
  vm.runInContext('releaseCreature();',context); // Offline: must not create a fake success.
  assert.equal(vm.runInContext('realtime.released',context),false);
}
vm.runInContext('home();',context);
assert.equal(vm.runInContext('selectedCatalogId',context),null);
assert.equal(vm.runInContext('currentResult',context),null);
vm.runInContext('selectedCatalogId="unlisted"; showResult();',context);
assert.ok(app.innerHTML.includes('data-wish-index='),'Invalid results return to a valid choice, never a synthetic creature.');
console.log('PASS: home, subtype screens, all 438 rendered result identities, one video per result, invalid-result handling, offline release and restart reset. DOM harness; real-browser playback still requires verification.');
