const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function element(dataset={}){return {dataset,handlers:{},addEventListener(n,f){this.handlers[n]=f},setAttribute(n,v){this[n]=v}};}
const black=element({waterChoice:'black'}),blue=element({waterChoice:'blue'}),slider=element(),output=element();
let stored=null;
const document={body:element(),querySelectorAll:()=>[black,blue],querySelector:s=>s==='#water-light'?slider:output,createElement:()=>{const c={};c.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:d=>{c.data=d.data}});return c;}};
const window={matchMedia:()=>({matches:false})};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../aquarium-environment.js'),'utf8'),{window,document,localStorage:{getItem:()=>null,setItem:(k,v)=>stored=v},Uint8ClampedArray,WeakMap});
const env=window.AquariumEnvironment,image={width:1,height:2,pixels:new Uint8ClampedArray([100,120,140,255,90,100,120,80]),canvas:{original:true},silhouette:{bounds:{y:0,height:2}}};
const before=image.pixels.slice();assert.equal(env.texture(image),image.canvas);assert.equal(slider.disabled,true);
blue.handlers.click();assert.equal(document.body.dataset.water,'blue');assert.equal(slider.disabled,false);
const lit=env.texture(image);assert.notDeepEqual(lit.data,before);assert.deepEqual(image.pixels,before);assert.equal(lit.data[3],255);assert.equal(lit.data[7],80);assert.equal(env.texture(image),lit,'Reuse cached texture each frame');
slider.handlers.input({target:{value:'0'}});assert.equal(env.texture(image),image.canvas);assert.equal(JSON.parse(stored).light,0);
black.handlers.click();assert.equal(env.composite(),'source-over');assert.equal(env.texture(image),image.canvas);
console.log('PASS: theme switching, zero-light restoration, lighting cache, unchanged source pixels/alpha and persisted choices.');
