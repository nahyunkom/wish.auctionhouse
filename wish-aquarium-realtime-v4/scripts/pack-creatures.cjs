const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),catalog=require('../creature-catalog.json');
const target=path.join(root,'asset-packs');fs.mkdirSync(target,{recursive:true});
const limit=16*1024*1024;
const index={version:1,catalogVersion:catalog.version,format:'Original PNG bytes split into fixed-size packs. No re-encoding.',packs:[],files:[]};
let part=0,offset=0,buffer=Buffer.alloc(limit);
function flush(){if(!offset)return;const name=`part-${String(part).padStart(3,'0')}.bin`,bytes=buffer.subarray(0,offset);fs.writeFileSync(path.join(target,name),bytes);index.packs.push({name,size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});part++;offset=0;}
for(const entry of catalog.entries){const bytes=fs.readFileSync(path.join(root,entry.imageUrl)),file={path:entry.imageUrl,size:bytes.length,sha256:entry.imageSha256,segments:[]};let consumed=0;while(consumed<bytes.length){const length=Math.min(limit-offset,bytes.length-consumed);bytes.copy(buffer,offset,consumed,consumed+length);file.segments.push({part,offset,length});offset+=length;consumed+=length;if(offset===limit)flush();}index.files.push(file);}
flush();fs.writeFileSync(path.join(target,'index.json'),JSON.stringify(index,null,2)+'\n');
console.log(JSON.stringify({packs:index.packs.length,files:index.files.length,bytes:index.packs.reduce((n,p)=>n+p.size,0)}));
