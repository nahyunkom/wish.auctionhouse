const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'asset-packs');
const index=JSON.parse(fs.readFileSync(path.join(dir,'index.json'),'utf8'));
const catalog=require('../creature-catalog.json');
if(index.files.length!==catalog.count)throw new Error('Asset pack count mismatch.');
const expected=new Map(catalog.entries.map(entry=>[entry.imageUrl,entry.imageSha256]));
let cachedPart=-1,cachedBytes=null;
for(const file of index.files){
 if(!/^assets\/catalog\/WC-[a-f0-9]{12}\.png$/.test(file.path)||expected.get(file.path)!==file.sha256)throw new Error('Unexpected asset path or identity.');
 const dest=path.join(root,file.path);fs.mkdirSync(path.dirname(dest),{recursive:true});
 const out=fs.openSync(dest,'w');let written=0;const hash=crypto.createHash('sha256');
 try{for(const segment of file.segments){if(segment.part!==cachedPart){const pack=index.packs[segment.part];if(!pack||!/^part-\d{3}\.bin$/.test(pack.name))throw new Error('Unexpected pack.');cachedBytes=fs.readFileSync(path.join(dir,pack.name));if(cachedBytes.length!==pack.size||crypto.createHash('sha256').update(cachedBytes).digest('hex')!==pack.sha256)throw new Error('Damaged asset pack: '+pack.name);cachedPart=segment.part;}const bytes=cachedBytes.subarray(segment.offset,segment.offset+segment.length);if(bytes.length!==segment.length)throw new Error('Truncated asset segment.');fs.writeSync(out,bytes);hash.update(bytes);written+=bytes.length;}}finally{fs.closeSync(out);}
 if(written!==file.size||hash.digest('hex')!==file.sha256)throw new Error('PNG integrity failed: '+file.path);
}
console.log('Restored and verified '+index.files.length+' byte-identical original creature PNGs.');
