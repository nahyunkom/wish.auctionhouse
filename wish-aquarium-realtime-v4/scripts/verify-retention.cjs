const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const {createReleaseStore}=require('../release-store');
const root=path.resolve(__dirname,'..');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'wish-retention-'));
const filename=path.join(directory,'releases.json');
const entry=require('../creature-catalog.json').entries[0];
const sample=i=>({id:'test-'+i,catalogId:entry.id,releasedAt:Date.now()-9*86400000,seed:i});
let server;
async function launch(){
 server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'3037',HOST:'127.0.0.1',AQUARIUM_DATA_DIR:directory},stdio:['ignore','pipe','pipe']});
 let errors='';server.stderr.on('data',d=>errors+=d);
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Server startup timeout: '+errors)),10000);server.stdout.on('data',d=>{if(String(d).includes('listening')){clearTimeout(timeout);resolve();}});server.once('exit',code=>{clearTimeout(timeout);reject(Error('Server exited '+code+': '+errors));});});
}
async function stop(){const child=server;server=null;await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
function connect(payload){return new Promise((resolve,reject)=>{
 const ws=new WebSocket('ws://127.0.0.1:3037/socket.io/?EIO=4&transport=websocket');
 let state,broadcast=false;
 const timer=setTimeout(()=>{ws.close();reject(Error('Socket timeout'));},8000);
 ws.onerror=()=>{clearTimeout(timer);reject(Error('Socket connection failed'));};
 ws.onmessage=e=>{const text=String(e.data);
  if(text==='2')ws.send('3');
  else if(text.startsWith('0'))ws.send('40');
  else if(text.startsWith('42')){const [name,data]=JSON.parse(text.slice(2));if(name==='creature:released')broadcast=true;if(name==='aquarium:state'){state=data;if(payload)ws.send('420'+JSON.stringify(['creature:release',payload]));else {clearTimeout(timer);ws.close();resolve({state});}}}
  else if(text.startsWith('430')){clearTimeout(timer);ws.close();resolve({state,ack:JSON.parse(text.slice(3))[0],broadcast});}
 };
});}
(async()=>{
 let store=createReleaseStore(filename);
 for(let i=0;i<130;i++)store.add(sample(i),'client-'+i);
 store=createReleaseStore(filename);assert.equal(store.all().length,130);assert.equal(store.all()[0].id,'test-0');
 assert.equal(store.add(sample(999),'client-0').id,'test-0');assert.equal(store.all().length,130);
 fs.mkdirSync(filename+'.tmp');assert.throws(()=>store.add(sample(131),'client-131'));assert.equal(store.all().length,130);fs.rmdirSync(filename+'.tmp');
 await launch();
 const initial=await connect();assert.equal(initial.state.creatures.length,130,'old records and >120 releases survive restart');
 const payload={catalogId:entry.id,clientReleaseId:'restart-retry'};
 const first=await connect(payload);assert.equal(first.ack.ok,true);assert.equal(first.broadcast,true);
 await stop();await launch();
 const retry=await connect(payload);assert.equal(retry.ack.duplicate,true);assert.equal(retry.ack.creature.id,first.ack.creature.id);assert.equal(retry.state.creatures.length,131);
 const summary=await (await fetch('http://127.0.0.1:3037/api/aquarium-summary')).json();assert.equal(summary.retentionHours,null);assert.equal(summary.total,131);
 fs.mkdirSync(filename+'.tmp');const failure=await connect({catalogId:entry.id,clientReleaseId:'failed-write'});assert.equal(failure.ack.ok,false);assert.equal(failure.broadcast,false);fs.rmdirSync(filename+'.tmp');
 assert.equal((await connect()).state.creatures.length,131);
 await stop();
 const corrupt=path.join(directory,'corrupt.json');fs.writeFileSync(corrupt,'broken');assert.throws(()=>createReleaseStore(corrupt));assert.equal(fs.readFileSync(corrupt,'utf8'),'broken');
 console.log('PASS: 9-day-old releases, 130+ records, process restart, persistent deduplication, summaries, failed-write rejection, corrupt-file preservation.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await stop();assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'wish-retention-'));fs.rmSync(directory,{recursive:true,force:true});});
