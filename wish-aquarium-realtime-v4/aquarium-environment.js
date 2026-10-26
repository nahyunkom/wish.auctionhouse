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
// ---- Foreground: bubbles as light ----
// Bubbles are not drawn as objects but as light the water carries upward: they
// are almost invisible in shadow, glow where the surface light reaches them,
// shimmer as they turn, and leave a faint luminous wake that dissolves.
// Additive light on its own canvas above the creatures. No images.
let front=null,frontCtx=null,frontScale=1,lastFront=0,nextBreath=0;
const bubbles=[],motes=[],glows=new Map(),dust=[];
// A visitor's presence (touch, pointer, later a depth camera) gathers light.
// Everything follows it slowly; nothing jumps to the hand.
const presence={x:0,y:0,tx:0,ty:0,energy:0,target:0,last:-9,seen:false,trail:[],moved:0};
function feel(x,y,strength){
 if(!Number.isFinite(x)||!Number.isFinite(y))return;
 if(!presence.seen){presence.x=x;presence.y=y;presence.seen=true;}
 presence.moved+=Math.hypot(x-presence.tx,y-presence.ty);
 presence.tx=x;presence.ty=y;presence.target=Math.min(1,Math.max(0,strength===undefined?1:strength));presence.last=lastFront;
}
let seedValue=7331;
function rand(){seedValue=(seedValue*1664525+1013904223)>>>0;return seedValue/4294967296;}
function ensureFront(w,h){
 if(!front){
  front=document.createElement('canvas');front.setAttribute('aria-hidden','true');front.className='water-foreground';
  Object.assign(front.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
  document.querySelector('#canvas-host').appendChild(front);frontCtx=front.getContext('2d');
  for(let i=0;i<18;i++)motes.push({x:rand(),y:rand(),z:rand(),phase:rand()*6.28});
  const stage=document.querySelector('#aquarium-stage');
  if(stage){
   const onPointer=e=>feel(e.clientX,e.clientY,e.pointerType==='mouse'&&!e.buttons?.55:1);
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
 const near=presence.energy?Math.exp(-(Math.pow(x-presence.x,2)+Math.pow(y-presence.y,2))/(2*Math.pow(150,2)))*presence.energy*.9:0;
 return Math.min(1,(shaft+wide)*(.45+.55*(1-y/h))+.12+near);
}
// The visitor's light: a beam bending down from the surface to the hand, a soft
// gathering glow, a slowly dissolving wake, and light dust that rises from it.
function drawPresence(ctx,w,h,seconds,dt){
 const p=presence;
 if(seconds-p.last>1.4)p.target=0;
 p.energy+=(p.target-p.energy)*Math.min(1,dt*(p.target>p.energy?.9:.45));
 const follow=Math.min(1,dt*1.4);
 p.x+=(p.tx-p.x)*follow;p.y+=(p.ty-p.y)*follow;
 if(p.energy>.01)p.trail.push({x:p.x,y:p.y,t:seconds,e:p.energy});
 while(p.trail.length&&seconds-p.trail[0].t>4.5)p.trail.shift();
 // Light dust is shed only while the hand moves, in proportion to its motion.
 const shed=Math.min(3,p.moved*.012);p.moved=0;
 for(let i=0;i<shed&&dust.length<70;i++){
  if(rand()>.45)continue;
  dust.push({x:p.x+(rand()-.5)*70,y:p.y+(rand()-.5)*60,vx:(rand()-.5)*5,vy:-(2+rand()*6),age:0,life:4+rand()*4,r:.8+rand()*1.3,phase:rand()*6.28});
 }
 if(p.energy<.004&&!p.trail.length&&!dust.length)return;
 const e=p.energy;
 if(e>.01){
  // Surface light leaning down toward the visitor.
  const sx=w*.475+(p.x-w*.475)*.35;
  const beam=ctx.createLinearGradient(sx,0,p.x,p.y);
  beam.addColorStop(0,'rgba(90,230,240,'+(.07*e).toFixed(3)+')');beam.addColorStop(.7,'rgba(90,230,240,'+(.025*e).toFixed(3)+')');beam.addColorStop(1,'rgba(90,230,240,0)');
  ctx.fillStyle=beam;
  // Edges dissolve: the beam is soft-focus light, never a drawn shape.
  if('filter' in ctx)ctx.filter='blur(28px)';
  const top=70+90*e,bottom=30+40*e;
  ctx.beginPath();ctx.moveTo(sx-top,-40);ctx.lineTo(sx+top,-40);ctx.lineTo(p.x+bottom,p.y);ctx.lineTo(p.x-bottom,p.y);ctx.closePath();ctx.fill();
  if('filter' in ctx)ctx.filter='none';
 }
 // Wake: the path keeps a little light that fades over a few seconds.
 for(let k=0;k<p.trail.length;k+=3){
  const q=p.trail[k],a=1-(seconds-q.t)/4.5;
  const g=glowSprite(34+50*(1-a));
  ctx.globalAlpha=a*a*.05*q.e;ctx.drawImage(g,q.x-g.width/2,q.y-g.height/2);
 }
 if(e>.01){
  const breathe=.85+.15*Math.sin(seconds*1.1);
  const g=glowSprite(150*breathe);ctx.globalAlpha=.11*e;ctx.drawImage(g,p.x-g.width/2,p.y-g.height/2);
  const c=glowSprite(60);ctx.globalAlpha=.07*e;ctx.drawImage(c,p.x-c.width/2,p.y-c.height/2);
 }
 for(let i=dust.length-1;i>=0;i--){
  const d=dust[i];d.age+=dt;
  if(d.age>d.life){dust.splice(i,1);continue;}
  d.vx*=Math.pow(.6,dt);d.x+=d.vx*dt+Math.sin(d.age*.9+d.phase)*.15;d.y+=d.vy*dt;
  const a=Math.sin(Math.PI*d.age/d.life);
  const g=glowSprite(d.r*5);ctx.globalAlpha=a*.32;ctx.drawImage(g,d.x-g.width/2,d.y-g.height/2);
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
 ensureFront(w,h);
 const ctx=frontCtx;ctx.setTransform(frontScale,0,0,frontScale,0,0);ctx.clearRect(0,0,w,h);
 if(motion.matches){lastFront=seconds;return;}
 const dt=lastFront?Math.min(.1,Math.max(0,seconds-lastFront)):0;lastFront=seconds;
 if(!nextBreath)nextBreath=seconds+1+rand()*2;
 if(seconds>=nextBreath){breath(w,h);nextBreath=seconds+1.4+rand()*rand()*5;}
 // Rarely a single large bubble passes close to the glass: a slow, soft bokeh.
 if(rand()<dt*.012)spawnBubble(w*(.15+rand()*.7),h+60,0,{r:9+rand()*8,speed:.55});
 ctx.globalCompositeOperation='lighter';
 drawPresence(ctx,w,h,seconds,dt);
 bubbles.sort((a,b)=>a.z-b.z);
 for(let i=bubbles.length-1;i>=0;i--){
  const b=bubbles[i];
  b.age+=dt;
  b.y-=b.speed*Math.min(1,.3+b.age*.6)*dt;
  b.drift*=Math.pow(.4,dt);b.x+=b.drift*dt;
  if(presence.energy>.02){
   // Near the visitor, bubbles slowly circle the light instead of being pushed.
   const dx=b.x-presence.x,dy=b.y-presence.y,d2=dx*dx+dy*dy,reach=Math.exp(-d2/(2*170*170))*presence.energy;
   if(reach>.01){const d=Math.sqrt(d2)+1;b.x+=(-dy/d*14-dx/d*3)*reach*dt;b.y+=(dx/d*6)*reach*dt;}
  }
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
root.AquariumEnvironment={background,texture,foreground,burst,feel,composite:()=> 'source-over'};
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
