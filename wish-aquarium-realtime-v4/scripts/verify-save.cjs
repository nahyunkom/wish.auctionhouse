const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const functions=source.slice(source.indexOf('async function createResultCardBlob()'),source.indexOf('const reduceMotion'));
async function scenario(shareError,canShare=true){
  const original=Buffer.from('original PNG bytes'),downloads=[],messages=[];
  const button={innerHTML:'Save',disabled:false,classList:{add(){},remove(){}}};
  const context={File,console,fetch:async()=>({ok:true,blob:async()=>new Blob([original],{type:'image/png'})}),
    currentResult:{entry:{imageUrl:'assets/catalog/test.png'},creature:{name:'Test',id:'test'}},
    document:{querySelector:()=>button,createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}},
    URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:test'},revokeObjectURL(){}},window:{setTimeout(){}},
    navigator:{canShare:()=>canShare,share:async()=>{if(shareError)throw Object.assign(new Error('test'),{name:shareError});}},
    announceResultAction:(text,state)=>messages.push({text,state})};
  vm.createContext(context);vm.runInContext(functions,context);
  await vm.runInContext('saveCreatureImage()',context);
  assert.equal(button.disabled,false);assert.equal(button.innerHTML,'Save');
  for(const blob of downloads)assert.deepEqual(Buffer.from(await blob.arrayBuffer()),original);
  return {downloads,messages};
}
(async()=>{
  assert.equal((await scenario(null)).downloads.length,0,'Successful sharing must not duplicate download.');
  const fallback=await scenario('NotAllowedError');assert.equal(fallback.downloads.length,1);assert.equal(fallback.messages.at(-1).state,'success');
  assert.equal((await scenario('AbortError')).downloads.length,0,'User cancellation must not initiate another action.');
  assert.equal((await scenario(null,false)).downloads.length,1,'Unsupported sharing must download original bytes.');
  console.log('PASS: native share success, permission failure fallback, cancellation, and byte-identical PNG download.');
})().catch(error=>{console.error(error);process.exitCode=1;});
