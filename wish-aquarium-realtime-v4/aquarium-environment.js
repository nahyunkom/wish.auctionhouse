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
 return .55*noise(p*1.8+vec2(time*.055,time*.022))
       +.28*noise(p*4.2-vec2(time*.04,time*.026))
       +.17*noise(p*9.1+vec2(time*.018,-time*.03));
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
  float beamCenter=-.16+.10*p.z+sin(p.z*.35+time*.075)*.10;
  float mainBeam=exp(-pow((p.x-beamCenter)/(.28+depth*.055),2.));
  float broadBeam=exp(-pow((p.x-beamCenter)/(.72+depth*.10),2.));
  float sideBeam=exp(-pow((p.x+2.4+.08*p.z)/.36,2.))*.19;
  float visibility=exp(-depth*.13);
  float shafts=(mainBeam*(.64+caustic*.78)+broadBeam*.11+sideBeam)*visibility;
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
 float columnX=.475+sin(time*.065+q.y*3.)*.004;
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
root.AquariumEnvironment={background,texture,composite:()=> 'source-over'};
})(window);
