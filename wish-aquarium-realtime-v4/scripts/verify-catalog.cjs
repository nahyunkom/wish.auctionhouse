const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const catalog = require('../creature-catalog.json');
const model = require('../catalog-model.js')(catalog);
assert.equal(catalog.count,438);
assert.equal(new Set(catalog.entries.map(e=>e.folder)).size,438);
const browserContext = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'creature-catalog.js'),'utf8'),browserContext);
assert.equal(JSON.stringify(browserContext.window.WISH_CREATURE_CATALOG),JSON.stringify(catalog));
let reachable=0;
for (const direction of model.directions()) {
  for (const entry of model.methods(direction.name)) {
    assert.equal(model.select(direction.name,entry.methodType).id,entry.id);
    assert.equal(model.get(entry.id),entry);
    assert.equal(entry.folder,entry.wishType+'_'+entry.methodType);
    assert.equal(entry.id,'WC-'+crypto.createHash('sha256').update(entry.folder,'utf8').digest('hex').slice(0,12));
    const image=fs.readFileSync(path.join(root,entry.imageUrl));
    assert.equal(crypto.createHash('sha256').update(image).digest('hex'),entry.imageSha256,entry.folder);
    assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(new URL(entry.videoUrl).protocol,'https:');
    reachable++;
  }
}
assert.equal(reachable,438,'Every imported pair must be reachable through the actual two detail choices.');
assert.equal(model.get('made-up-creature'),null);
assert.equal(model.select('not a wish','not a method'),null);
assert.equal(model.directions(6).length,0,'Do not invent recognition-category assets.');
let source=fs.readFileSync(path.join(root,'server.js'),'utf8');
const start=source.indexOf('function makeCreature(payload) {'),end=source.indexOf('\napp.disable',start);
const context={catalogModel:model,crypto,wayLabels:['신뢰형','탐험형','축적형','회복형','공존형','몰입형','초월형']};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
assert.equal(context.makeCreature({situationIndex:0,wayIndex:0}),null,'Legacy indices cannot create an unlisted result.');
assert.equal(context.makeCreature({catalogId:'fake',imageUrl:'evil.png'}),null);
for(const entry of catalog.entries){const released=context.makeCreature({catalogId:entry.id,imageUrl:'evil.png',videoUrl:'https://evil.example',name:'fake'});assert.equal(released.name,entry.folder);assert.equal(released.imageUrl,entry.imageUrl);assert.equal(released.videoUrl,entry.videoUrl);assert.equal(released.situationIndex,entry.situationIndex);assert.equal(released.wayIndex,entry.wayIndex);}
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
assert.ok(!app.includes('assets/creature-'));
assert.ok(!app.includes('getCreature('));
assert.ok(!app.includes('context.filter = `hue-rotate'));
assert.ok(app.includes('catalogId: currentResult.entry.id'));
assert.ok(!fs.readFileSync(path.join(root,'shared-aquarium.js'),'utf8').includes('hue-rotate'));
const knownImages=new Set(catalog.entries.map(e=>path.basename(e.imageUrl)));
const deployedImages=fs.readdirSync(path.join(root,'assets/catalog'));
assert.equal(deployedImages.length,438);
assert.ok(deployedImages.every(name=>knownImages.has(name)));
const sourceDir=process.argv[2];
if(sourceDir)for(const entry of catalog.entries){const json=JSON.parse(fs.readFileSync(path.join(sourceDir,entry.folder,'video_result.json'),'utf8'));assert.equal(json.video_url,entry.videoUrl);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(sourceDir,entry.folder,entry.sourcePng))).digest('hex'),entry.imageSha256);}
console.log('PASS: all 438 original PNG/video pairs, byte hashes, reachable selections, browser manifest, server identity validation, spoof rejection, and no synthetic or recolored results.');
