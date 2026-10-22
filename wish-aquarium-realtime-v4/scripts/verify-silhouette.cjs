const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sprite=require('../aquarium-sprite.js');
function fixture(bg){const a=new Uint8ClampedArray(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const p=(y*64+x)*4;const body=x>=24&&x<40&&y>=8&&y<55;a.set(body?[150,90,210,255]:[bg,bg,bg,255],p);}return a;}
for(const background of [5,245]){
 const data=fixture(background),before=data.slice(),info=sprite.mask(data,64,64);
 assert.equal(info.empty,false);assert.equal(data[3],0,'Background must be transparent.');
 assert.equal(data[(20*64+30)*4+3],255,'Core must stay opaque.');
 for(let i=0;i<data.length;i+=4)assert.deepEqual(data.slice(i,i+3),before.slice(i,i+3),'RGB must never be whitened or recolored.');
 assert.ok(info.bounds.width<64,'Bounds must follow the silhouette rather than the paper.');
 const calls=[],ctx={save(){},restore(){},transform(...args){assert.ok(args.every(Number.isFinite));},drawImage(...args){calls.push(args)}};
 sprite.draw(ctx,{},info,100,240,1,0);assert.equal(calls.length,24);
}
const transparent=fixture(0);for(let i=0;i<64*4;i+=4)transparent[i+3]=0;const before=transparent.slice();sprite.mask(transparent,64,64);assert.deepEqual(transparent,before,'Native transparency is preserved exactly.');
assert.notEqual(sprite.bend(.9,.4,0,0,4),sprite.bend(.9,.4,1,0,4),'Different creature regions deform over time.');
const source=fs.readFileSync(path.resolve(__dirname,'../shared-aquarium.js'),'utf8');
assert.ok(source.includes("globalCompositeOperation = 'source-over'"));
assert.ok(!source.includes("globalCompositeOperation = 'screen'"));
assert.ok(!source.includes('fill(0, 0, 0, 34)'),'Do not accumulate old creature pixels.');
console.log('PASS: opaque backgrounds masked, native alpha and RGB preserved, silhouette bounds and local deformation, no additive whitening.');
