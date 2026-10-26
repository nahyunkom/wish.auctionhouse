(function(root){
'use strict';
// ---- View: landscape, portrait, or a rotated projector ----
// ?rotate=90 or ?rotate=-90 turns the whole aquarium for a projector mounted on its
// side while the computer still outputs landscape. A portrait display needs nothing.
const view=(()=>{
 let rotation=0;
 try{const r=Number(new URLSearchParams(location.search).get('rotate'));rotation=r===90?90:(r===-90||r===270)?-90:0;}catch(_){}
 const width=()=>rotation?innerHeight:innerWidth;
 const height=()=>rotation?innerWidth:innerHeight;
 function apply(){
  const stage=document.querySelector('#aquarium-stage');if(!stage||!rotation)return;
  Object.assign(stage.style,{inset:'auto',left:'0',top:'0',width:innerHeight+'px',height:innerWidth+'px',transformOrigin:'0 0',
   transform:rotation===90?'translate('+innerWidth+'px,0) rotate(90deg)':'translate(0,'+innerHeight+'px) rotate(-90deg)'});
 }
 // Screen coordinates (pointer events) to aquarium coordinates.
 function toStage(x,y){return rotation===90?{x:y,y:innerWidth-x}:rotation===-90?{x:innerHeight-y,y:x}:{x,y};}
 return {get rotation(){return rotation;},width,height,apply,toStage,portrait:()=>height()>width()*1.05};
})();
root.AquariumView=view;
if(typeof document!=='undefined'&&document.readyState!=='loading')view.apply();
else if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('DOMContentLoaded',view.apply);
if(typeof addEventListener==='function')addEventListener('resize',view.apply);
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
uniform vec3 presence; // x, y in uv (y up), strength
uniform vec4 drops[6];  // ripple rings: x, y in uv, start time, strength
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
 // Two ripple layers drifting in different directions make the light under the
 // surface weave and shimmer; brightest at the top, reaching a third of the way down.
 // Slow, soft light threads: wide gentle lines, low contrast, a long slow breath.
 float ripple=surface(vec2(q.x*4.4+time*.05,q.y*1.3+time*.08));
 float ripple2=surface(vec2(q.x*2.9-time*.035,q.y*1.9-time*.055)+ripple*.45);
 float lineA=pow(clamp(1.-abs(ripple-.5)*3.2,0.,1.),1.7);
 float lineB=pow(clamp(1.-abs(ripple2-.5)*3.6,0.,1.),1.7);
 float reach=smoothstep(.66,1.,q.y);
 float pulse=.9+.1*sin(time*.32+q.x*3.);
 color+=vec3(.025,.19,.21)*lineA*reach*pulse+vec3(.02,.12,.15)*lineB*reach
       +vec3(.0,.06,.08)*smoothstep(.8,1.,q.y);
 // The central column: wider and brighter, its edges rippling like light through
 // a moving surface, with a white core where the bubble curtain rises.
 float columnX=.475+sin(time*.21+q.y*3.)*.009+sin(q.y*9.+time*.55)*.011+sin(q.y*23.-time*.85)*.004;
 float columnWidth=.034+(1.-q.y)*.07;
 float veil=exp(-pow((q.x-columnX)/columnWidth,2.));
 float filament=.62+.38*surface(vec2(q.x*75.,q.y*.8-time*.04));
 color+=vec3(.0,.26,.21)*veil*filament*(.5+.5*q.y);
 color+=vec3(.12,.34,.33)*pow(veil,3.)*filament*(.35+.65*q.y);
 // Fine vertical light streaks drifting through the whole water.
 float streak=pow(surface(vec2(q.x*20.+sin(time*.07)*1.5,q.y*.35+time*.02)),4.);
 color+=vec3(.0,.04,.05)*streak*(.3+.7*q.y);
 // A lit floor below the column, shimmering with caustics, like the sand in a tank.
 float floorBand=smoothstep(.14,.0,q.y);
 float floorLight=exp(-pow((q.x-.475)/.26,2.))*.85+.15;
 float sand=.55+.45*pow(clamp(1.-abs(surface(vec2(q.x*16.+time*.08,q.y*6.-time*.05))-.5)*4.,0.,1.),2.);
 color+=vec3(.05,.30,.32)*floorBand*floorLight*sand;
 // Where a visitor touches the water, the light in it stirs: woven caustics brighten
 // and slowly spread in soft rings, then settle again. No shape follows the hand.
 if(presence.z>.002){
  vec2 d=(q-presence.xy)*vec2(aspect,1.);
  float r=length(d);
  float fall=exp(-r*r/(2.*.2*.2));
  float rings=.65+.35*sin(r*30.-time*1.3);
  vec2 sp=q*vec2(aspect,1.);
  float c1=surface(sp*3.0+vec2(time*.14,-time*.10)+d*1.1);
  float c2=surface(sp*4.6-vec2(time*.12,time*.08)-d*.8);
  float weave=pow(clamp(1.-abs(c1-c2)*2.3,0.,1.),2.);
  float core=pow(clamp(1.-abs(c1-c2)*3.4,0.,1.),2.5);
  color+=(vec3(.06,.46,.48)*weave*rings+vec3(.12,.5,.5)*core*rings*.3+vec3(.02,.14,.16))*fall*presence.z;
 }
 // Each touch sends a ring of light outward through the water, carried by the
 // caustics, widening and fading over about four seconds.
 for(int i=0;i<6;i++){
  vec4 dr=drops[i];
  float age=time-dr.z;
  if(dr.w<=0.||age<0.||age>4.2)continue;
  vec2 d=(q-dr.xy)*vec2(aspect,1.);
  float r=length(d),R=.03+age*.11;
  float band=exp(-pow((r-R)/(.018+age*.012),2.));
  float fade=pow(1.-age/4.2,1.6)*dr.w;
  float lace=.55+.45*surface(q*vec2(aspect,1.)*7.+vec2(time*.2,-time*.15));
  color+=vec3(.07,.42,.45)*band*lace*fade+vec3(.02,.10,.11)*exp(-r*r/(2.*R*R+.002))*fade*.5;
 }
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
  const at=view.toStage(event.clientX,event.clientY);
  pointer.x=at.x/view.width()-.5;pointer.y=.5-at.y/view.height();
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
 uniforms={};for(const name of ['resolution','time','pointer','presence','drops'])uniforms[name]=gl.getUniformLocation(program,name);
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
  gl.uniform3f(uniforms.presence,presence.x/Math.max(1,w),1-presence.y/Math.max(1,h),motion.matches?0:presence.energy);
  for(let i=0;i<6;i++){const d=drops[i];dropData[i*4]=d?d.x/Math.max(1,w):0;dropData[i*4+1]=d?1-d.y/Math.max(1,h):0;dropData[i*4+2]=d?d.t:0;dropData[i*4+3]=d&&!motion.matches?d.s:0;}
  if(uniforms.drops)gl.uniform4fv(uniforms.drops,dropData);
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
// ---- Foreground: bubbles as light ----
// Bubbles are not drawn as objects but as light the water carries upward: they
// are almost invisible in shadow, glow where the surface light reaches them,
// shimmer as they turn, and leave a faint luminous wake that dissolves.
// Additive light on its own canvas above the creatures. No images.
let front=null,frontCtx=null,frontScale=1,lastFront=0,nextBreath=0;
const bubbles=[],motes=[],glows=new Map(),dust=[],curtain=[],births=[];
// A visitor's presence (touch, pointer, later a depth camera) gathers light.
// Everything follows it slowly; nothing jumps to the hand.
const presence={x:0,y:0,tx:0,ty:0,energy:0,target:0,last:-9,seen:false,trail:[],moved:0,sinceDrop:0};
// Light rings sent out by touches (newest replaces oldest).
const drops=[],dropData=new Float32Array(24);
let sceneH=1;
function drop(x,y,s){drops.push({x,y,t:lastFront,s});if(drops.length>6)drops.shift();}
// feel(x, y, strength 0–1, pressed): presence input in aquarium CSS pixels.
function feel(x,y,strength,pressed){
 if(!Number.isFinite(x)||!Number.isFinite(y))return;
 if(!presence.seen){presence.x=x;presence.y=y;presence.seen=true;}
 const step=Math.hypot(x-presence.tx,y-presence.ty);
 presence.moved+=step;presence.sinceDrop+=step;
 const s=Math.min(1,Math.max(0,strength===undefined?1:strength));
 // A ring of light when the hand first meets the water, and now and then as it travels.
 if(pressed||presence.energy<.12&&s>.3||presence.sinceDrop>220){drop(x,y,pressed?1:.7*s);presence.sinceDrop=0;}
 presence.tx=x;presence.ty=y;presence.target=s;presence.last=lastFront;
}
// Light plankton: faint glints spread through the water that drift toward a
// visitor's hand, slowly circle it while it stays, and return when it leaves.
const plankton=[];
let seedValue=7331;
function rand(){seedValue=(seedValue*1664525+1013904223)>>>0;return seedValue/4294967296;}
function ensureFront(w,h){
 if(!front){
  front=document.createElement('canvas');front.setAttribute('aria-hidden','true');front.className='water-foreground';
  Object.assign(front.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
  document.querySelector('#canvas-host').appendChild(front);frontCtx=front.getContext('2d');
  for(let i=0;i<18;i++)motes.push({x:rand(),y:rand(),z:rand(),phase:rand()*6.28});
  for(let i=0;i<90;i++)plankton.push({hx:rand(),hy:.12+rand()*.86,x:0,y:0,pull:0,orbit:30+rand()*130,ang:rand()*6.28,spin:(.15+rand()*.35)*(rand()<.5?-1:1),phase:rand()*6.28,r:.8+rand()*1.4,placed:false});
  const stage=document.querySelector('#aquarium-stage');
  if(stage){
   const onPointer=e=>{const at=view.toStage(e.clientX,e.clientY);feel(at.x,at.y,e.pointerType==='mouse'&&!e.buttons?.6:1,e.type==='pointerdown');};
   stage.addEventListener('pointerdown',onPointer,{passive:true});
   stage.addEventListener('pointermove',onPointer,{passive:true});
  }
 }
 frontScale=Math.min(window.devicePixelRatio||1,1.5);
 const cw=Math.round(w*frontScale),ch=Math.round(h*frontScale);
 if(front.width!==cw||front.height!==ch){front.width=cw;front.height=ch;}
}
// Cached soft glow: a light core fading into the water, no edge.
function glowSprite(radius){
 const key=Math.max(2,Math.round(radius));
 if(glows.has(key))return glows.get(key);
 const size=key*2+2,c=document.createElement('canvas');c.width=c.height=size;
 const g=c.getContext('2d'),m=size/2,grad=g.createRadialGradient(m,m,0,m,m,key);
 grad.addColorStop(0,'rgba(225,252,255,1)');grad.addColorStop(.18,'rgba(160,240,250,.55)');
 grad.addColorStop(.5,'rgba(70,200,225,.16)');grad.addColorStop(1,'rgba(40,170,210,0)');
 g.fillStyle=grad;g.fillRect(0,0,size,size);glows.set(key,c);return c;
}
// How much surface light reaches a point: strongest in the central shaft and near the top.
function lightAt(x,y,w,h,t){
 const cx=.475+Math.sin(t*.21+y/h*3)*.012;
 const shaft=Math.exp(-Math.pow((x/w-cx)/.13,2));
 const wide=Math.exp(-Math.pow((x/w-cx)/.38,2))*.35;
 const near=presence.energy?Math.exp(-(Math.pow(x-presence.x,2)+Math.pow(y-presence.y,2))/(2*Math.pow(150,2)))*presence.energy*1.3:0;
 return Math.min(1,(shaft+wide)*(.45+.55*(1-y/h))+.12+near);
}
// The visitor's presence is felt in the water, not drawn: this only eases its
// position and strength. The water shader and creature shader read it.
function updatePresence(seconds,dt){
 const p=presence;
 if(seconds-p.last>1.6)p.target=0;
 // Rises over about a second, settles over three.
 p.energy+=(p.target-p.energy)*Math.min(1,dt*(p.target>p.energy?1:.33));
 const follow=Math.min(1,dt*1.1);
 p.x+=(p.tx-p.x)*follow;p.y+=(p.ty-p.y)*follow;p.moved=0;
}
// The bubble curtain: a dense, swaying plume of tiny bright bubbles rising up the
// central light column from the floor, as in a large aquarium tank.
function curtainX(y,w,h,t){
 const v=y/h;
 return w*(.475+Math.sin(t*.21+(1-v)*3)*.009+Math.sin((1-v)*9+t*.55)*.011+Math.sin(v*6+t*.5)*.018*(1-v));
}
function drawCurtain(ctx,w,h,seconds,dt){
 const rate=Math.min(260,(w*h)/4500);
 const spawn=rate*dt;
 for(let i=0;i<spawn&&curtain.length<320;i++){
  if(rand()>spawn-i)break;
  const g=(rand()+rand()+rand()-1.5)/1.5;          // roughly gaussian across the column
  curtain.push({off:g,y:h+4+rand()*20,vy:70+rand()*110,r:.5+rand()*rand()*2.1,ph:rand()*6.28,wob:2+rand()*6,age:0});
 }
 for(let i=curtain.length-1;i>=0;i--){
  const b=curtain[i];b.age+=dt;b.y-=b.vy*dt*Math.min(1,.4+b.age*1.2);
  if(b.y<-10){curtain.splice(i,1);continue;}
  const v=b.y/h,width=w*(.03+(v)*.035);       // the plume narrows as it rises into the light
  const x=curtainX(b.y,w,h,seconds)+b.off*width+Math.sin(b.age*7+b.ph)*b.wob*.4;
  const glint=.55+.45*Math.pow(.5+.5*Math.sin(b.age*11+b.ph),3);
  const fade=Math.min(1,b.age*3)*Math.min(1,b.y/(h*.12));
  const core=Math.exp(-b.off*b.off*1.8);
  const g=glowSprite(b.r*(3.2+core*2));
  ctx.globalAlpha=Math.min(1,(.35+.6*core)*glint*fade);
  ctx.drawImage(g,x-g.width/2,b.y-g.height/2);
 }
 ctx.globalAlpha=1;
}
// Birth of a released creature: light particles spiral in from the surrounding
// water, settle on the creature's real outline, flare as it wakes (a ring of light
// and bubbles), then drift upward as glitter. Timings match shared-aquarium.js.
const B_GATHER=2.4,B_WAKE=3.6,B_END=6;
function birth(points,x,y){
 if(motion.matches||!Array.isArray(points)||!Number.isFinite(x)||!Number.isFinite(y))return;
 const parts=points.slice(0,180).map(p=>{
  const a=rand()*6.283,d=220+rand()*380;
  return {tx:p.dx,ty:p.dy,sx:Math.cos(a)*d,sy:Math.sin(a)*d*.8,delay:rand()*.8,turn:(1.6+rand()*1.6)*(rand()<.5?-1:1),r:.7+rand()*1.3,ph:rand()*6.28,up:30+rand()*60,out:(rand()-.5)*50};
 });
 // A few free motes fill the body with soft light.
 for(let i=0;i<40;i++)parts.push({tx:(rand()-.5)*60,ty:(rand()-.5)*40,sx:(rand()-.5)*900,sy:(rand()-.5)*600,delay:rand()*.6,turn:2*(rand()<.5?-1:1),r:1.4+rand()*1.8,ph:rand()*6.28,up:20+rand()*40,out:(rand()-.5)*80,soft:true});
 births.push({x,y,start:lastFront,parts,woke:false});
}
function drawBirths(ctx,w,h,seconds,dt){
 for(let i=births.length-1;i>=0;i--){
  const B=births[i],t=seconds-B.start;
  if(t>B_END){births.splice(i,1);continue;}
  if(!B.woke&&t>=B_WAKE){B.woke=true;drop(B.x,B.y,1);burst(B.x,B.y);}
  // A soft halo of the gathering light around the forming body.
  const gather=Math.min(1,t/B_GATHER),haloA=(t<B_WAKE?gather*.25:.25*Math.max(0,1-(t-B_WAKE)/1.2))+Math.exp(-Math.pow((t-B_WAKE)/.25,2))*.35;
  if(haloA>.01){const g=glowSprite(160+gather*60);ctx.globalAlpha=haloA;ctx.drawImage(g,B.x-g.width/2,B.y-g.height/2);}
  for(const p of B.parts){
   let px,py,a;
   if(t<B_GATHER){
    const u=Math.min(1,Math.max(0,(t-p.delay)/(B_GATHER-p.delay))),e=u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
    const ang=(1-e)*p.turn,ca=Math.cos(ang),sa=Math.sin(ang);
    const rx=p.sx*(1-e),ry=p.sy*(1-e);
    px=B.x+p.tx+rx*ca-ry*sa;py=B.y+p.ty+rx*sa+ry*ca;a=.15+.6*e;
   } else if(t<B_WAKE){
    px=B.x+p.tx+Math.sin(t*6+p.ph)*.8;py=B.y+p.ty+Math.cos(t*5+p.ph)*.8;
    a=.75+.25*Math.sin(t*9+p.ph);
   } else {
    const v=(t-B_WAKE)/(B_END-B_WAKE),f=v*v;
    px=B.x+p.tx+p.out*f+Math.sin(t*3+p.ph)*4*v;py=B.y+p.ty-p.up*v*1.6;
    a=(1-v)*(.8+.2*Math.sin(t*12+p.ph))+Math.exp(-Math.pow((t-B_WAKE)/.2,2));
   }
   const g=glowSprite(p.soft?p.r*7:p.r*(3.5+Math.exp(-Math.pow((t-B_WAKE)/.3,2))*3));
   ctx.globalAlpha=Math.min(1,a*(p.soft?.35:1));ctx.drawImage(g,px-g.width/2,py-g.height/2);
  }
 }
 ctx.globalAlpha=1;
}
// depth z: 0 near the glass, 1 far away.
function spawnBubble(x,y,z,options){
 if(bubbles.length>70)return;
 options=options||{};
 const r=options.r||(.7+rand()*rand()*2.4)*(1.35-z*.75);
 bubbles.push({x,y,y0:y,z,r,age:0,
  speed:(options.speed||1)*(9+r*5)*(1.15-z*.5),
  sway:2+rand()*6,swayFreq:.5+rand()*.9,phase:rand()*6.28,
  spin:1.5+rand()*2.5,drift:options.drift||0,trail:[]});
}
// A release breathes out a slow, rising veil of light around the creature.
function burst(x,y){
 if(motion.matches||!Number.isFinite(x)||!Number.isFinite(y))return;
 for(let i=0;i<14;i++)spawnBubble(x+(rand()-.5)*70,y+(rand()-.5)*40,.15+rand()*.55,{speed:.7+rand()*.5,drift:(rand()-.5)*14});
}
// A breath: a few bubbles let go one after another from one place, slowly.
function breath(w,h){
 const nearLight=rand()<.6;
 const x=nearLight?w*(.475+(rand()-.5)*.36):w*(.05+rand()*.9);
 const z=.2+rand()*.7,n=2+Math.floor(rand()*4),gap=.35+rand()*.5;
 for(let i=0;i<n;i++)spawnBubble(x+(rand()-.5)*8,h+10+i*gap*(9+rand()*6),z+(rand()-.5)*.06);
}
function foreground(w,h,seconds){
 if(!document.querySelector('#canvas-host'))return;
 ensureFront(w,h);sceneH=h;
 const ctx=frontCtx;ctx.setTransform(frontScale,0,0,frontScale,0,0);ctx.clearRect(0,0,w,h);
 if(motion.matches){lastFront=seconds;return;}
 const dt=lastFront?Math.min(.1,Math.max(0,seconds-lastFront)):0;lastFront=seconds;
 if(!nextBreath)nextBreath=seconds+1+rand()*2;
 if(seconds>=nextBreath){breath(w,h);nextBreath=seconds+1.4+rand()*rand()*5;}
 // Rarely a single large bubble passes close to the glass: a slow, soft bokeh.
 if(rand()<dt*.012)spawnBubble(w*(.15+rand()*.7),h+60,0,{r:9+rand()*8,speed:.55});
 ctx.globalCompositeOperation='lighter';
 updatePresence(seconds,dt);
 drawCurtain(ctx,w,h,seconds,dt);
 drawBirths(ctx,w,h,seconds,dt);
 bubbles.sort((a,b)=>a.z-b.z);
 for(let i=bubbles.length-1;i>=0;i--){
  const b=bubbles[i];
  b.age+=dt;
  b.y-=b.speed*Math.min(1,.3+b.age*.6)*dt;
  b.drift*=Math.pow(.4,dt);b.x+=b.drift*dt;

  const risen=Math.min(1,Math.max(0,(b.y0-b.y)/h));
  const x=b.x+Math.sin(b.age*b.swayFreq+b.phase)*b.sway*(.3+risen);
  if(b.y<-40){bubbles.splice(i,1);continue;}
  const light=lightAt(x,b.y,w,h,seconds);
  // A turning bubble catches the light in brief glints.
  const glint=Math.pow(.5+.5*Math.sin(b.age*b.spin+b.phase),6);
  const fade=Math.min(1,b.age*1.2)*Math.min(1,Math.max(0,b.y/(h*.25)));
  const depthFade=1-b.z*.55;
  // Luminous wake: a short thread of light that dissolves behind it.
  b.trail.push(x,b.y);if(b.trail.length>36)b.trail.splice(0,2);
  if(b.r<6&&b.trail.length>4){
   ctx.lineCap='round';ctx.lineWidth=Math.max(.5,b.r*.45);
   for(let k=2;k<b.trail.length;k+=2){
    const a=k/b.trail.length;
    ctx.strokeStyle='rgba(120,225,240,'+(a*a*.16*light*fade*depthFade).toFixed(3)+')';
    ctx.beginPath();ctx.moveTo(b.trail[k-2],b.trail[k-1]);ctx.lineTo(b.trail[k],b.trail[k+1]);ctx.stroke();
   }
  }
  if(b.r>=6){
   // Out-of-focus bokeh: an even disc of light with a slightly brighter edge.
   const g=ctx.createRadialGradient(x,b.y,0,x,b.y,b.r);
   const a=.05+.07*light;
   g.addColorStop(0,'rgba(120,220,235,'+(a*.6*fade).toFixed(3)+')');
   g.addColorStop(.82,'rgba(150,235,245,'+(a*fade).toFixed(3)+')');
   g.addColorStop(1,'rgba(150,235,245,0)');
   ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,b.y,b.r,0,Math.PI*2);ctx.fill();
  } else {
   const intensity=(.18+.82*light)*(.55+.45*glint)*fade*depthFade;
   const halo=glowSprite(b.r*(4+light*4));
   ctx.globalAlpha=intensity*.7;
   ctx.drawImage(halo,x-halo.width/2,b.y-halo.height/2);
   // The bright point where light meets the bubble's upper surface.
   const core=glowSprite(b.r*1.6);
   ctx.globalAlpha=Math.min(1,intensity*1.1);
   ctx.drawImage(core,x-core.width/2-b.r*.25,b.y-core.height/2-b.r*.3);
   ctx.globalAlpha=1;
  }
 }
 // Light plankton gathering to the visitor's hand.
 const P=presence;
 for(const k of plankton){
  if(!k.placed){k.x=k.hx*w;k.y=k.hy*h;k.placed=true;}
  const homeX=k.hx*w+Math.sin(seconds*.07+k.phase)*24,homeY=k.hy*h+Math.cos(seconds*.05+k.phase)*18;
  const reach=P.energy*Math.exp(-(Math.pow(homeX-P.x,2)+Math.pow(homeY-P.y,2))/(2*420*420));
  k.pull+=(reach-k.pull)*Math.min(1,dt*(reach>k.pull?.7:.3));
  k.ang+=k.spin*dt*(1+k.pull);
  const breathe=1+.18*Math.sin(seconds*.8+k.phase);
  const ox=P.x+Math.cos(k.ang)*k.orbit*breathe,oy=P.y+Math.sin(k.ang)*k.orbit*.7*breathe;
  const tx=homeX+(ox-homeX)*k.pull,ty=homeY+(oy-homeY)*k.pull;
  const ease=Math.min(1,dt*1.4);k.x+=(tx-k.x)*ease;k.y+=(ty-k.y)*ease;
  const glint=.6+.4*Math.pow(.5+.5*Math.sin(seconds*2.2+k.phase*3),4);
  const a=(.07+.07*lightAt(k.x,k.y,w,h,seconds)+k.pull*.75)*glint;
  if(a<.02)continue;
  const g=glowSprite(k.r*(5+k.pull*4));
  ctx.globalAlpha=Math.min(1,a);ctx.drawImage(g,k.x-g.width/2,k.y-g.height/2);
 }
 ctx.globalAlpha=1;
 // Suspended particles near the lens, lit only where light passes.
 for(const m of motes){
  m.y-=dt*(.003+m.z*.004);m.x+=Math.sin(seconds*.15+m.phase)*dt*.002;
  if(m.y<-.05){m.y=1.05;m.x=rand();}
  const px=(m.x%1+1)%1*w,py=m.y*h,l=lightAt(px,py,w,h,seconds);
  const halo=glowSprite(3+m.z*7);
  ctx.globalAlpha=(.05+m.z*.08)*(.4+l);
  ctx.drawImage(halo,px-halo.width/2,py-halo.height/2);
 }
 ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
}
// feel(x, y, strength 0–1): presence input in CSS pixels. Touch and pointer use it now;
// a depth-camera bridge can call it with tracked hand positions later.
// How strongly the visitor's light falls on a point (0 – ~1), for lighting creatures.
function presenceLight(x,y){
 if(presence.energy<.01)return 0;
 const d2=Math.pow(x-presence.x,2)+Math.pow(y-presence.y,2);
 return Math.exp(-d2/(2*240*240))*presence.energy;
}
// How strongly any expanding light ring is passing a point right now (0 – ~1).
function ringLight(x,y){
 let v=0;
 for(const d of drops){
  const age=lastFront-d.t;if(age<0||age>4.2)continue;
  const R=sceneH*(.03+age*.11),r=Math.hypot(x-d.x,y-d.y);
  v+=Math.exp(-Math.pow((r-R)/90,2))*(1-age/4.2)*d.s;
 }
 return Math.min(1,v);
}
function presenceState(){return {x:presence.x,y:presence.y,energy:presence.energy};}
root.AquariumEnvironment={background,texture,foreground,burst,birth,feel,presenceLight,ringLight,presenceState,composite:()=> 'source-over'};
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
    "school": true,
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
  },
  {
    "id": "resident:WC-979b35e1c2a7",
    "imageUrl": "assets/catalog/WC-979b35e1c2a7.png",
    "seed": 27435,
    "exhibitionResident": true,
    "school": true,
    "depth": 0.42,
    "screenX": 0.3,
    "screenY": 0.46
  },
  {
    "id": "resident:WC-e5f58f89958c",
    "imageUrl": "assets/catalog/WC-e5f58f89958c.png",
    "seed": 28154,
    "exhibitionResident": true,
    "school": true,
    "depth": 0.58,
    "screenX": 0.72,
    "screenY": 0.62
  }
];
