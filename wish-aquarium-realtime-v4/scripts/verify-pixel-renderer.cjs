const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function fixture(compileWorks=true){
 let uploads=0,deletes=0,draws=0,appended=0;
 const events={},uniforms={};
 const gl=new Proxy({
  createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>compileWorks,deleteShader(){},
  getShaderPrecisionFormat:()=>({precision:23}),createProgram:()=>({}),attachShader(){},linkProgram(){},deleteProgram(){},deleteBuffer(){},deleteShader(){},getProgramParameter:()=>true,
  createBuffer:()=>({}),bindBuffer(){},bufferData(){},getAttribLocation:()=>0,enableVertexAttribArray(){},vertexAttribPointer(){},
  getUniformLocation:(_p,name)=>name,useProgram(){},activeTexture(){},uniform1i(){},enable(){},blendFunc(){},clearColor(){},viewport(){},clear(){},
  uniform1f:(key,v)=>{assert.ok(Number.isFinite(v));uniforms[key]=v;},uniform2f:(key,...v)=>{assert.ok(v.every(Number.isFinite));uniforms[key]=v;},
  uniform4f:(key,...v)=>{assert.ok(v.every(Number.isFinite));uniforms[key]=v;},uniform3f:(key,...v)=>{assert.ok(v.every(Number.isFinite));uniforms[key]=v;},
  createTexture:()=>({}),bindTexture(){},texParameteri(){},pixelStorei(){},
  texImage2D(){uploads++;},deleteTexture(){deletes++;},drawArrays(){draws++;}
 },{get(target,key){return key in target?target[key]:1;}});
 const canvas={style:{},setAttribute(){},getContext:()=>gl,addEventListener:(name,fn)=>events[name]=fn};
 const context={module:{exports:{}},document:{createElement:()=>canvas},console};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../aquarium-sprite.js'),'utf8'),context);
 const renderer=context.module.exports.createRenderer({appendChild(){appended++;}});
 return {renderer,events,uniforms,canvas,counts:()=>({uploads,deletes,draws,appended})};
}
const info={empty:false,bounds:{x:2,y:3,width:20,height:40},center:{x:12,y:23}};
const options={x:100,y:120,width:100,height:200,time:2,phase:.5,alpha:.6,reducedMotion:false};
const f=fixture(),r=f.renderer;assert.ok(r.available);
r.begin(800,600,1.5,'screen');assert.equal(f.canvas.width,1200);assert.equal(f.canvas.style.mixBlendMode,'screen');
const sources=Array.from({length:130},()=>({width:64,height:64}));
assert.equal(r.draw(sources[0],info,options),true);assert.equal(r.draw(sources[0],info,options),true);
assert.equal(f.counts().uploads,1,'Unchanged source reuses the GPU texture.');
assert.equal(r.draw(sources[1],info,options),true);assert.equal(r.draw(sources[2],info,options),false,'Uploads have a per-frame budget; caller must use Canvas fallback.');
assert.equal(f.counts().uploads,2);
r.begin(800,600,1,'source-over');r.draw(sources[2],info,{...options,reducedMotion:true});
assert.equal(f.uniforms.uGain,0);assert.equal(f.canvas.style.mixBlendMode,'normal');
assert.equal(r.draw(sources[0],{empty:true},options),false);
assert.equal(r.draw(sources[0],info,{...options,width:0}),false);
for(let i=3;i<sources.length;i++){r.begin(800,600,1,'source-over');assert.equal(r.draw(sources[i],info,options),true);}
assert.equal(r.textureCount,128);assert.equal(f.counts().deletes,2,'Evicted GPU textures must be released.');
f.events.webglcontextlost({preventDefault(){}});assert.equal(r.available,false);assert.equal(r.draw(sources[0],info,options),false);assert.equal(f.canvas.style.visibility,'hidden');
f.events.webglcontextrestored();assert.equal(r.available,true);assert.equal(r.textureCount,0);r.begin(800,600,1,'source-over');assert.equal(r.draw(sources[0],info,options),true);
const failed=fixture(false);assert.equal(failed.renderer,null);assert.equal(failed.counts().appended,0);
const ordinary=require('../aquarium-sprite.js');assert.equal(ordinary.createRenderer(null),null);
let draws=0;ordinary.draw({drawImage(){draws++;}},sources[0],info,100,200,2,0,true);assert.equal(draws,1,'Reduced-motion Canvas fallback must draw a stable image.');
console.log('PASS: GPU texture reuse, two uploads/frame, bounded 128-texture cache, eviction, CSS-pixel sizing, reduced motion, empty images, context-loss fallback/recovery, and shader-failure fallback.');
