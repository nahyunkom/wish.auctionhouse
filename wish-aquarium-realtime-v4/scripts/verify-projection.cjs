const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../aquarium-environment.js'),'utf8');
const viewSource=source.slice(0,source.indexOf('// Real-time participating water'))+'})(window);';
function load(search,w=1920,h=1080){
 const stage={style:{}},document={readyState:'complete',documentElement:{dataset:{}},querySelector:()=>stage};
 const ctx={window:{devicePixelRatio:2},document,location:{search},URLSearchParams,innerWidth:w,innerHeight:h,addEventListener(){}};
 vm.runInNewContext(viewSource,ctx);return {view:ctx.window.AquariumView,stage,ctx};
}
for(const [w,h] of [[1920,1080],[3840,2160],[1080,1920],[1365,768]]){
 const {view,stage,ctx}=load('?shape=capsule&rotate=90',w,h);
 assert.equal(view.rotation,0);assert(view.width()>view.height());
 assert(Math.abs(view.width()/view.height()-300/104)<.01);
 assert.equal(ctx.document.documentElement.dataset.projection,'capsule');
 const p=view.toStage(parseInt(stage.style.left)+view.width()/2,parseInt(stage.style.top)+view.height()/2);
 assert.equal(p.x,view.width()/2);assert.equal(p.y,view.height()/2);
 ctx.innerWidth=1280;ctx.innerHeight=720;view.apply();assert(view.width()<=1280);
 assert.equal(view.density(),2);
}
assert.equal(load('?rotate=90').view.width(),1080);
assert.equal(load('?rotate=90').view.height(),1920);
assert.equal(load('').view.width(),1920);
assert(Math.abs(load('?shape=capsule&capsuleRatio=2').view.width()/load('?shape=capsule&capsuleRatio=2').view.height()-2)<.002,'Aspect ratio rounds only to native whole pixels');
for(const invalid of ['NaN','0','-4','100'])assert.equal(load('?shape=capsule&capsuleRatio='+invalid).view.height(),load('?shape=capsule').view.height());
console.log('PASS: capsule geometry, rotation precedence, pointer mapping, resize, density, ratio validation and legacy view.');
