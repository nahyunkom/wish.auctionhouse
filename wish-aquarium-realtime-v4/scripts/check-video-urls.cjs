const fs=require('node:fs'), path=require('node:path');
const catalog=require('../creature-catalog.json');
let next=0, done=0;
const results=[];
async function worker(){
  while(next<catalog.entries.length){
    const entry=catalog.entries[next++];
    try{
      const response=await fetch(entry.videoUrl,{method:'HEAD',signal:AbortSignal.timeout(20000)});
      results.push({id:entry.id,folder:entry.folder,status:response.status,type:response.headers.get('content-type'),bytes:response.headers.get('content-length')});
    }catch(error){results.push({id:entry.id,folder:entry.folder,error:error.cause?.code||error.message});}
    done++;if(done%50===0)console.log('Checked '+done+'/'+catalog.count+' video URLs');
  }
}
Promise.all(Array.from({length:8},worker)).then(()=>{
  const failed=results.filter(r=>r.status!==200 || !r.type?.startsWith('video/'));
  const report={checkedAt:new Date().toISOString(),total:results.length,ok:results.length-failed.length,failed,results};
  fs.writeFileSync(path.resolve(__dirname,'../VIDEO-URL-AUDIT.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({total:report.total,ok:report.ok,failed}));
  if(failed.length)process.exitCode=1;
});
