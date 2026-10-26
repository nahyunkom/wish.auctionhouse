(function(root){
'use strict';
// Real-time participating water volume. No photographic textures or remote assets.
const tinted=new WeakMap();
let canvas,gl,program,uniforms,failed=false,lost=false,frames=0,lastTime=0,quality=.6;
const pointer={x:0,y:0};
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const vertex=`
attribute vec2 position;
varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}
`;
const fragment=`
precision highp float;
varying vec2 uv;
uniform vec2 resolution;
uniform vec2 pointer;
uniform float time;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float surface(vec2 p){
 return .55*noise(p*1.8+vec2(time*.21,time*.09))
       +.28*noise(p*4.2-vec2(time*.17,time*.12))
       +.17*noise(p*9.1+vec2(time*.08,-time*.14));
}
void main(){
 vec2 q=uv;float aspect=resolution.x/resolution.y;
 vec3 origin=vec3(pointer.x*.10,pointer.y*.055,-4.5);
 vec3 ray=normalize(vec3((q.x-.5)*aspect,(q.y-.5)*.94,1.48));
 // Blue water is luminous through scattering, not an opaque dark vignette.
 vec3 extinction=vec3(.24,.077,.038);
 vec3 ambient=vec3(.018,.255,.59);
 vec3 color=vec3(0.);vec3 transmittance=vec3(1.);
 float jitter=hash(gl_FragCoord.xy)*.32;
 for(int i=0;i<28;i++){
  float distance=(float(i)+jitter)*.66;
  vec3 p=origin+ray*distance;
  float depth=max(0.,3.4-p.y);
  // Refracted surface illumination projected down a 3D water volume.
  vec2 entry=vec2(p.x+.13*depth,p.z+.04*depth);
  float wave=surface(entry*.44);
  float caustic=pow(clamp(1.-abs(wave-.51)*7.,0.,1.),3.);
  // Shafts sway with the surface above; their strength flickers as waves pass.
  float beamCenter=-.16+.10*p.z+sin(p.z*.35+time*.22)*.12+sin(time*.47+p.y*.6)*.035;
  float mainBeam=exp(-pow((p.x-beamCenter)/(.28+depth*.055),2.));
  float broadBeam=exp(-pow((p.x-beamCenter)/(.72+depth*.10),2.));
  float sideBeam=exp(-pow((p.x+2.4+.08*p.z)/.36,2.))*.19;
  float visibility=exp(-depth*.13);
  float flicker=.82+.18*sin(time*1.1+p.z*1.7+wave*6.);
  float shafts=(mainBeam*(.64+caustic*.78)+broadBeam*.11+sideBeam)*visibility*flicker;
  vec3 scatter=ambient*(.90+wave*.12)+vec3(.0,.65,.60)*shafts;
  // Sparse suspended water density, low-frequency variation only.
  float density=.095+noise(p.xz*.24+time*.005)*.018;
  vec3 stepTrans=exp(-extinction*density*6.2*.66);
  color+=transmittance*(1.-stepTrans)*scatter;
  transmittance*=stepTrans;
 }
 vec3 distant=vec3(.025,.34,.72);
 color+=transmittance*distant;
 // A broad cyan opening above the central shaft; no hard surface or seabed.
 float opening=exp(-pow((q.x-.47)/.13,2.))*pow(q.y,4.);
 color+=vec3(.0,.30,.20)*opening;
 // Light dancing on the underside of the surface.
 float ripple=surface(vec2(q.x*5.2,q.y*1.4+time*.05));
 float sheet=pow(clamp(1.-abs(ripple-.5)*5.,0.,1.),2.)*smoothstep(.72,1.,q.y);
 color+=vec3(.02,.15,.17)*sheet+vec3(.0,.05,.07)*smoothstep(.8,1.,q.y);
 float columnX=.475+sin(time*.21+q.y*3.)*.009;
 float columnWidth=.025+(1.-q.y)*.058;
 float veil=exp(-pow((q.x-columnX)/columnWidth,2.));
 float filament=.62+.38*surface(vec2(q.x*75.,q.y*.8));
 color+=vec3(.0,.19,.14)*veil*filament*(.45+.55*q.y);
 color*=vec3(1.0,1.19,1.065);
 color+=vec3(.004,.018,.018)*(1.-q.y);
 color*=.97+.025*noise(vec2(q.x*6.,q.y*3.)+time*.009);
 gl_FragColor=vec4(clamp(color,0.,1.),1.);
}
`;
function shader(type,source){
 const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(message);}
 return s;
}
function init(){
 canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
 document.querySelector('#water-volume').appendChild(canvas);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;canvas.style.visibility='hidden';});
 canvas.addEventListener('webglcontextrestored',()=>{lost=false;failed=false;build();canvas.style.visibility='';});
 try{build();}catch(error){failed=true;canvas.style.visibility='hidden';console.warn('Water volume uses Canvas fallback:',error.message);}
 document.querySelector('#aquarium-stage').addEventListener('pointermove',event=>{
  pointer.x=event.clientX/innerWidth-.5;pointer.y=.5-event.clientY/innerHeight;
 },{passive:true});
 document.querySelector('#aquarium-stage').addEventListener('pointerleave',()=>{pointer.x=pointer.y=0;},{passive:true});
}
function build(){
 gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
 if(!gl)throw Error('WebGL unavailable');
 const precision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
 const fs=precision&&precision.precision?fragment:fragment.replace('precision highp float','precision mediump float');
 const vs=shader(gl.VERTEX_SHADER,vertex),ps=shader(gl.FRAGMENT_SHADER,fs);
 program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,ps);gl.linkProgram(program);
 gl.deleteShader(vs);gl.deleteShader(ps);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const location=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
 uniforms={};for(const name of ['resolution','time','pointer'])uniforms[name]=gl.getUniformLocation(program,name);
}
function fallback(ctx,w,h,t){
 const fill=ctx.createLinearGradient(0,0,w,h);fill.addColorStop(0,'#087cd0');fill.addColorStop(.52,'#096ab6');fill.addColorStop(1,'#095aa3');
 ctx.fillStyle=fill;ctx.fillRect(0,0,w,h);
 ctx.save();ctx.globalCompositeOperation='screen';
 for(let n=0;n<7;n++){
  const x=w*(.45+n*.012+Math.sin(t*.07+n)*.008),r=w*(.02+n*.008);
  const g=ctx.createLinearGradient(x-r,0,x+r,h);g.addColorStop(0,'rgba(0,210,225,0)');g.addColorStop(.48,'rgba(0,210,225,.075)');g.addColorStop(1,'rgba(0,210,225,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-r*.45,0);ctx.lineTo(x+r*.45,0);ctx.lineTo(x+r*2.8,h);ctx.lineTo(x-r*1.8,h);ctx.fill();
 }ctx.restore();
}
function background(ctx,w,h,seconds){
 if(!canvas)init();
 const t=motion.matches?0:seconds;
 ctx.clearRect(0,0,w,h);
 if(failed||lost){fallback(ctx,w,h,t);}else{
  // A bounded offscreen resolution keeps ray marching practical on iPad GPUs.
  const scale=Math.min(quality,Math.sqrt(850000/(w*h)));
  const rw=Math.max(1,Math.round(w*scale)),rh=Math.max(1,Math.round(h*scale));
  if(canvas.width!==rw||canvas.height!==rh){canvas.width=rw;canvas.height=rh;gl.viewport(0,0,rw,rh);}
  gl.useProgram(program);gl.uniform2f(uniforms.resolution,rw,rh);gl.uniform1f(uniforms.time,t);gl.uniform2f(uniforms.pointer,pointer.x,pointer.y);
  gl.drawArrays(gl.TRIANGLES,0,6);
  if(seconds>lastTime&&lastTime){const dt=seconds-lastTime;if(++frames>90&&dt>.045&&quality>.38){quality=Math.max(.38,quality-.05);frames=0;}}
  lastTime=seconds;
 }
 // Quiet drifting particulate in layered perspective, never a bubble overlay.
 ctx.save();
 for(let n=0;n<90;n++){
  const z=.25+(n%13)/13,phase=n*2.39996;
  const x=((Math.sin(n*127.1)*43758.5453)%1+1)%1;
  const y=((Math.sin(n*311.7)*17341.731)%1+1)%1;
  const px=((x*w+Math.sin(t*.032+phase)*w*.012+pointer.x*8*z)%w+w)%w;
  const py=((y*h-t*(.6+z*.8))%h+h)%h;
  ctx.fillStyle='rgba(145,223,236,'+(.025+z*.055)+')';
  ctx.beginPath();ctx.arc(px,py,.3+z*.65,0,Math.PI*2);ctx.fill();
 }ctx.restore();
}
function texture(image){
 const previous=tinted.get(image);if(previous)return previous;
 const copy=document.createElement('canvas');copy.width=image.width;copy.height=image.height;
 const ctx=copy.getContext('2d'),data=ctx.createImageData(image.width,image.height);data.data.set(image.pixels);
 for(let p=0;p<data.data.length;p+=4){
  data.data[p]=image.pixels[p]*.54;
  data.data[p+1]=image.pixels[p+1]*.91;
  data.data[p+2]=Math.min(255,image.pixels[p+2]*1.02+12);
 }
 ctx.putImageData(data,0,0);tinted.set(image,copy);return copy;
}
// ---- Foreground: bubbles and near, out-of-focus particles ----
// Drawn on its own canvas above the creatures. No images: every bubble is drawn.
// Bubbles sit at different depths like the creatures: far ones are tiny, faint and
// soft; a rare near one is large and out of focus. They leave in short puffs.
let front=null,frontCtx=null,frontScale=1,lastFront=0,nextPuff=0;
const bubbles=[],motes=[],emitters=[],bubbleSprites=new Map();
let seedValue=7331;
function rand(){seedValue=(seedValue*1664525+1013904223)>>>0;return seedValue/4294967296;}
function ensureFront(w,h){
 if(!front){
  front=document.createElement('canvas');front.setAttribute('aria-hidden','true');front.className='water-foreground';
  Object.assign(front.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
  document.querySelector('#canvas-host').appendChild(front);frontCtx=front.getContext('2d');
  for(let i=0;i<22;i++)motes.push({x:rand(),y:rand(),z:rand(),phase:rand()*6.28});
 }
 frontScale=Math.min(window.devicePixelRatio||1,1.5);
 const cw=Math.round(w*frontScale),ch=Math.round(h*frontScale);
 if(front.width!==cw||front.height!==ch){front.width=cw;front.height=ch;}
}
// A bubble is a thin lit rim with a clear middle, brighter on the side facing the light.
function bubbleSprite(radius,blur){
 const r=Math.max(1,Math.round(radius*2)/2),b=Math.round(blur*2)/2,key=r+'|'+b;
 if(bubbleSprites.has(key))return bubbleSprites.get(key);
 const pad=Math.ceil(b*2.5)+2,size=Math.ceil(r*2+pad*2),c=document.createElement('canvas');c.width=c.height=size;
 const g=c.getContext('2d'),m=size/2;
 if(b>0&&'filter' in g)g.filter='blur('+b+'px)';
 const body=g.createRadialGradient(m,m,0,m,m,r);
 if(r<2){
  // Small bubbles read as soft points of light.
  body.addColorStop(0,'rgba(235,255,255,.85)');body.addColorStop(.55,'rgba(200,245,255,.45)');body.addColorStop(1,'rgba(200,245,255,0)');
 } else {
  body.addColorStop(0,'rgba(170,235,245,.05)');body.addColorStop(.68,'rgba(170,235,245,.09)');
  body.addColorStop(.88,'rgba(220,252,255,.7)');body.addColorStop(1,'rgba(220,252,255,0)');
 }
 g.fillStyle=body;g.beginPath();g.arc(m,m,r,0,Math.PI*2);g.fill();
 if(r>=2){
  // Light from the surface: a soft crescent on top and a faint bounce underneath.
  g.lineCap='round';
  g.strokeStyle='rgba(240,255,255,.55)';g.lineWidth=Math.max(.6,r*.16);
  g.beginPath();g.arc(m,m,r*.74,Math.PI*1.12,Math.PI*1.62);g.stroke();
  g.strokeStyle='rgba(200,245,255,.16)';g.lineWidth=Math.max(.5,r*.1);
  g.beginPath();g.arc(m,m,r*.78,Math.PI*.2,Math.PI*.7);g.stroke();
 }
 bubbleSprites.set(key,c);return c;
}
// depth: 0 = near the glass, 1 = far. Size, blur and brightness follow it.
function spawnBubble(x,y,depth,spread,size){
 if(bubbles.length>140)return;
 const z=Math.min(1,Math.max(0,depth));
 const r=size||((1.1+rand()*rand()*4.2)*(1.45-z*.85));
 bubbles.push({
  x,y,y0:y,z,r,
  speed:(10+r*7)*(1.25-z*.55),       // bigger bubbles rise faster; far ones look slower
  age:0,phase:rand()*6.28,
  zig:(1.5+rand()*3)*(r>3?1.8:1),zigFreq:2+rand()*3,
  drift:spread||0,
  squash:r>3?.08+rand()*.08:0
 });
}
// A release is marked by a soft scatter of bubbles from the creature, never by text.
function burst(x,y){
 if(motion.matches||!Number.isFinite(x)||!Number.isFinite(y))return;
 for(let i=0;i<16;i++)spawnBubble(x+(rand()-.5)*50,y+(rand()-.3)*30,.2+rand()*.5,(rand()-.5)*30);
}
function puff(w,h){
 // Somewhere below the frame a source lets bubbles go for a second or two,
 // at uneven intervals, so they rise as loose, broken chains.
 emitters.push({x:w*(.06+rand()*.88),z:.2+rand()*.7,until:lastFront+.8+rand()*2.2,next:lastFront});
}
function foreground(w,h,seconds){
 if(!document.querySelector('#canvas-host'))return;
 ensureFront(w,h);
 const ctx=frontCtx;ctx.setTransform(frontScale,0,0,frontScale,0,0);ctx.clearRect(0,0,w,h);
 if(motion.matches){lastFront=seconds;return;}
 const dt=lastFront?Math.min(.1,Math.max(0,seconds-lastFront)):0;lastFront=seconds;
 if(!nextPuff)nextPuff=seconds+1+rand()*2;
 if(seconds>=nextPuff){puff(w,h);nextPuff=seconds+1.2+rand()*rand()*6;}
 for(let i=emitters.length-1;i>=0;i--){
  const e=emitters[i];
  if(seconds>e.until){emitters.splice(i,1);continue;}
  if(seconds>=e.next){spawnBubble(e.x+(rand()-.5)*10,h+8,e.z+(rand()-.5)*.08,0);e.next=seconds+.06+rand()*rand()*.45;}
 }
 // Now and then a single tiny bubble appears mid-water, far away.
 if(rand()<dt*.35)spawnBubble(w*rand(),h*(.55+rand()*.45),.75+rand()*.25,0);
 // Rarely, one large bubble drifts up close to the glass, out of focus.
 if(rand()<dt*.018)spawnBubble(w*(.08+rand()*.84),h+40,0,0,7+rand()*5);
 bubbles.sort((a,b)=>a.z-b.z); // looped from the end: far bubbles first, near ones on top
 for(let i=bubbles.length-1;i>=0;i--){
  const b=bubbles[i];
  b.age+=dt;
  const accel=Math.min(1,.35+b.age*.9);   // leaves slowly, then reaches its rising speed
  b.y-=b.speed*accel*dt;
  b.drift*=Math.pow(.35,dt);b.x+=b.drift*dt;
  if(b.y<-30){bubbles.splice(i,1);continue;}
  const risen=Math.min(1,Math.max(0,(b.y0-b.y)/h));
  const x=b.x+Math.sin(b.age*b.zigFreq+b.phase)*b.zig*(.35+risen*.65);
  const blur=b.z>.55?.4+(b.z-.55)*1.3:b.z<.15?(.15-b.z)/.15*3.2:.2;
  const sprite=bubbleSprite(b.r*(1+risen*.15),blur);
  const wob=b.squash?Math.sin(b.age*7+b.phase)*b.squash:0;
  const sx=1+b.squash+wob,sy=1-b.squash-wob*.6;
  const fadeTop=Math.min(1,Math.max(0,b.y/(h*.2))),fadeIn=Math.min(1,b.age*2.5);
  ctx.globalAlpha=(1-b.z*.45)*fadeTop*fadeIn*(b.r>6?.6:1);
  const tilt=Math.sin(b.age*1.3+b.phase)*.25;
  ctx.save();ctx.translate(x,b.y);ctx.rotate(tilt);ctx.scale(sx,sy);
  ctx.drawImage(sprite,-sprite.width/2,-sprite.height/2);ctx.restore();
 }
 // Near particles drifting past the lens: large, soft and slow.
 for(const m of motes){
  m.y-=dt*(.004+m.z*.006);m.x+=Math.sin(seconds*.2+m.phase)*dt*.003;
  if(m.y<-.05){m.y=1.05;m.x=rand();}
  const r=2+m.z*5,px=(m.x%1+1)%1*w,py=m.y*h;
  const g=ctx.createRadialGradient(px,py,0,px,py,r);
  g.addColorStop(0,'rgba(190,240,250,'+(.08+m.z*.09)+')');g.addColorStop(1,'rgba(190,240,250,0)');
  ctx.globalAlpha=1;ctx.fillStyle=g;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=1;
}
root.AquariumEnvironment={background,texture,foreground,burst,composite:()=> 'source-over'};
})(window);

// Original catalog scenery: these are not visitor releases and never enter server statistics.
window.AQUARIUM_RESIDENTS=[
  {
    "id": "resident:WC-b0eb62ef59cc",
    "imageUrl": "assets/catalog/WC-b0eb62ef59cc.png",
    "seed": 113,
    "exhibitionResident": true,
    "depth": 0.03,
    "screenX": -0.015,
    "screenY": 0.12
  },
  {
    "id": "resident:WC-e0d8adf90b05",
    "imageUrl": "assets/catalog/WC-e0d8adf90b05.png",
    "seed": 832,
    "exhibitionResident": true,
    "depth": 0.03,
    "screenX": 1.01,
    "screenY": 0.21
  },
  {
    "id": "resident:WC-d82741de5da6",
    "imageUrl": "assets/catalog/WC-d82741de5da6.png",
    "seed": 1551,
    "exhibitionResident": true,
    "depth": 0.7665348284391803,
    "screenX": 0.2933365106675774,
    "screenY": 0.7355719649293435
  },
  {
    "id": "resident:WC-76a9279338c3",
    "imageUrl": "assets/catalog/WC-76a9279338c3.png",
    "seed": 2270,
    "exhibitionResident": true,
    "depth": 0.6320281807514403,
    "screenX": 0.19263492787373251,
    "screenY": 0.8493489091585151
  },
  {
    "id": "resident:WC-bfef1a5b8fd2",
    "imageUrl": "assets/catalog/WC-bfef1a5b8fd2.png",
    "seed": 2989,
    "exhibitionResident": true,
    "depth": 0.6426565348117492,
    "screenX": 0.40755058415117673,
    "screenY": 0.8747469247499438
  },
  {
    "id": "resident:WC-3b5c8408eaa7",
    "imageUrl": "assets/catalog/WC-3b5c8408eaa7.png",
    "seed": 3708,
    "exhibitionResident": true,
    "depth": 0.6417596007638349,
    "screenX": 0.16358554367325268,
    "screenY": 0.8290783404790789
  },
  {
    "id": "resident:WC-768f22ce3001",
    "imageUrl": "assets/catalog/WC-768f22ce3001.png",
    "seed": 4427,
    "exhibitionResident": true,
    "depth": 0.3707433526239765,
    "screenX": 0.20275469902233453,
    "screenY": 0.8264234881314019
  },
  {
    "id": "resident:WC-3f0b376d2ca1",
    "imageUrl": "assets/catalog/WC-3f0b376d2ca1.png",
    "seed": 5146,
    "exhibitionResident": true,
    "depth": 0.6798634121002396,
    "screenX": 0.11414665662799961,
    "screenY": 0.5893343258347832
  },
  {
    "id": "resident:WC-a8381280741d",
    "imageUrl": "assets/catalog/WC-a8381280741d.png",
    "seed": 5865,
    "exhibitionResident": true,
    "depth": 0.6900035745010246,
    "screenX": 0.4739097997639328,
    "screenY": 0.7690467909058065
  },
  {
    "id": "resident:WC-4a00f71c355c",
    "imageUrl": "assets/catalog/WC-4a00f71c355c.png",
    "seed": 6584,
    "exhibitionResident": true,
    "depth": 0.576714293857949,
    "screenX": 0.34079154002247375,
    "screenY": 0.8153416499781394
  },
  {
    "id": "resident:WC-c0f0b5e519c9",
    "imageUrl": "assets/catalog/WC-c0f0b5e519c9.png",
    "seed": 7303,
    "exhibitionResident": true,
    "depth": 0.8184944071700738,
    "screenX": 0.4154666889645159,
    "screenY": 0.6227756376325324
  },
  {
    "id": "resident:WC-52c07e6c5b68",
    "imageUrl": "assets/catalog/WC-52c07e6c5b68.png",
    "seed": 8022,
    "exhibitionResident": true,
    "depth": 0.5440337366324093,
    "screenX": 0.4089405521121807,
    "screenY": 0.6828753372745484
  },
  {
    "id": "resident:WC-a24e50a2dece",
    "imageUrl": "assets/catalog/WC-a24e50a2dece.png",
    "seed": 8741,
    "exhibitionResident": true,
    "depth": 0.5880990364001264,
    "screenX": 0.02085885969281662,
    "screenY": 0.9227046611915106
  },
  {
    "id": "resident:WC-0a8e5898ed13",
    "imageUrl": "assets/catalog/WC-0a8e5898ed13.png",
    "seed": 9460,
    "exhibitionResident": true,
    "depth": 0.4884149887064996,
    "screenX": 0.30146932097924034,
    "screenY": 0.8280270285207556
  },
  {
    "id": "resident:WC-e08c82e302be",
    "imageUrl": "assets/catalog/WC-e08c82e302be.png",
    "seed": 10179,
    "exhibitionResident": true,
    "depth": 0.8931485247344244,
    "screenX": 0.44809104957443197,
    "screenY": 0.8427171812558512
  },
  {
    "id": "resident:WC-33016b3642cf",
    "imageUrl": "assets/catalog/WC-33016b3642cf.png",
    "seed": 10898,
    "exhibitionResident": true,
    "depth": 0.7433904825252831,
    "screenX": 0.10951286242576315,
    "screenY": 0.897164658564209
  },
  {
    "id": "resident:WC-22dd2c6a9991",
    "imageUrl": "assets/catalog/WC-22dd2c6a9991.png",
    "seed": 11617,
    "exhibitionResident": true,
    "depth": 0.8274000250850804,
    "screenX": 0.36760885040857827,
    "screenY": 0.7249285264324226
  },
  {
    "id": "resident:WC-6977345c93a5",
    "imageUrl": "assets/catalog/WC-6977345c93a5.png",
    "seed": 12336,
    "exhibitionResident": true,
    "depth": 0.8200581211262034,
    "screenX": 0.07431998437503352,
    "screenY": 0.896355555019736
  },
  {
    "id": "resident:WC-2b7291476d6c",
    "imageUrl": "assets/catalog/WC-2b7291476d6c.png",
    "seed": 13055,
    "exhibitionResident": true,
    "depth": 0.3834662171544187,
    "screenX": 0.24883270101281596,
    "screenY": 0.7691670077351375
  },
  {
    "id": "resident:WC-7775e769947e",
    "imageUrl": "assets/catalog/WC-7775e769947e.png",
    "seed": 13774,
    "exhibitionResident": true,
    "depth": 0.6991529861016454,
    "screenX": 0.2621562275198812,
    "screenY": 0.680788707249202
  },
  {
    "id": "resident:WC-b0617c0220d6",
    "imageUrl": "assets/catalog/WC-b0617c0220d6.png",
    "seed": 14493,
    "exhibitionResident": true,
    "depth": 0.8641024307712359,
    "screenX": 0.7822295588048291,
    "screenY": 0.8178566250064772
  },
  {
    "id": "resident:WC-58c40db6b36d",
    "imageUrl": "assets/catalog/WC-58c40db6b36d.png",
    "seed": 15212,
    "exhibitionResident": true,
    "depth": 0.48320197022898354,
    "screenX": 0.8539931290652021,
    "screenY": 0.48778707352473805
  },
  {
    "id": "resident:WC-6b3c0a90c02d",
    "imageUrl": "assets/catalog/WC-6b3c0a90c02d.png",
    "seed": 15931,
    "exhibitionResident": true,
    "depth": 0.7735599567096506,
    "screenX": 0.6398349696901278,
    "screenY": 0.7244042148783981
  },
  {
    "id": "resident:WC-45f4fe833c4e",
    "imageUrl": "assets/catalog/WC-45f4fe833c4e.png",
    "seed": 16650,
    "exhibitionResident": true,
    "depth": 0.44360998242191274,
    "screenX": 0.0799622470367467,
    "screenY": 0.9082201763754314
  },
  {
    "id": "resident:WC-6eb82eb0b20c",
    "imageUrl": "assets/catalog/WC-6eb82eb0b20c.png",
    "seed": 17369,
    "exhibitionResident": true,
    "depth": 0.8524245530918415,
    "screenX": 0.4980347344026086,
    "screenY": 0.6358875696018923
  },
  {
    "id": "resident:WC-a0917ace55ae",
    "imageUrl": "assets/catalog/WC-a0917ace55ae.png",
    "seed": 18088,
    "exhibitionResident": true,
    "depth": 0.4561166862158279,
    "screenX": 0.8086803083187988,
    "screenY": 0.9160841440357732
  },
  {
    "id": "resident:WC-f2a43c9f0ee5",
    "imageUrl": "assets/catalog/WC-f2a43c9f0ee5.png",
    "seed": 18807,
    "exhibitionResident": true,
    "depth": 0.5456005100876428,
    "screenX": 0.7384147691391263,
    "screenY": 0.8383849467680773
  },
  {
    "id": "resident:WC-477cabb93843",
    "imageUrl": "assets/catalog/WC-477cabb93843.png",
    "seed": 19526,
    "exhibitionResident": true,
    "depth": 0.6643880218940104,
    "screenX": 0.08851991223127698,
    "screenY": 0.8729882588793703
  },
  {
    "id": "resident:WC-183ed8462175",
    "imageUrl": "assets/catalog/WC-183ed8462175.png",
    "seed": 20245,
    "exhibitionResident": true,
    "depth": 0.5585859568577871,
    "screenX": 0.4332030597652192,
    "screenY": 0.5282419458517916
  },
  {
    "id": "resident:WC-300440aeeac7",
    "imageUrl": "assets/catalog/WC-300440aeeac7.png",
    "seed": 20964,
    "exhibitionResident": true,
    "depth": 0.5783336100776796,
    "screenX": 0.9852170459271292,
    "screenY": 0.8466650016242745
  },
  {
    "id": "resident:WC-62899b063378",
    "imageUrl": "assets/catalog/WC-62899b063378.png",
    "seed": 21683,
    "exhibitionResident": true,
    "depth": 0.6678829477824911,
    "screenX": 0.9076928155991482,
    "screenY": 0.9242795233842733
  },
  {
    "id": "resident:WC-d5389e7eb813",
    "imageUrl": "assets/catalog/WC-d5389e7eb813.png",
    "seed": 22402,
    "exhibitionResident": true,
    "depth": 0.42187128740231855,
    "screenX": 0.4814994036387361,
    "screenY": 0.8135088289408829
  },
  {
    "id": "resident:WC-cde4c71f54ab",
    "imageUrl": "assets/catalog/WC-cde4c71f54ab.png",
    "seed": 23121,
    "exhibitionResident": true,
    "depth": 0.7053990152803453,
    "screenX": 0.3511956416605244,
    "screenY": 0.8008702204344025
  },
  {
    "id": "resident:WC-666101bd5137",
    "imageUrl": "assets/catalog/WC-666101bd5137.png",
    "seed": 23840,
    "exhibitionResident": true,
    "depth": 0.8787553111793386,
    "screenX": 0.4910256567045508,
    "screenY": 0.8329718003418773
  },
  {
    "id": "resident:WC-00c7c0a836ff",
    "imageUrl": "assets/catalog/WC-00c7c0a836ff.png",
    "seed": 24559,
    "exhibitionResident": true,
    "depth": 0.4943696585469206,
    "screenX": 0.076608488761849,
    "screenY": 0.8285215139209168
  },
  {
    "id": "resident:WC-e543075ac3fb",
    "imageUrl": "assets/catalog/WC-e543075ac3fb.png",
    "seed": 25278,
    "exhibitionResident": true,
    "depth": 0.5015643628607358,
    "screenX": 0.9104137054091552,
    "screenY": 0.9301877732018426
  },
  {
    "id": "resident:WC-0ebb815d5710",
    "imageUrl": "assets/catalog/WC-0ebb815d5710.png",
    "seed": 25997,
    "exhibitionResident": true,
    "depth": 0.7824039617546077,
    "screenX": 0.2937468927484588,
    "screenY": 0.9174162069754448
  },
  {
    "id": "resident:WC-4d045538cb9b",
    "imageUrl": "assets/catalog/WC-4d045538cb9b.png",
    "seed": 26716,
    "exhibitionResident": true,
    "depth": 0.8211562896952092,
    "screenX": 0.34113794618315296,
    "screenY": 0.473196822525095
  }
];
