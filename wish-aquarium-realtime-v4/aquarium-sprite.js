(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AquariumSprite = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  function quantile(values, q) {
    values.sort((a,b)=>a-b);
    return values[Math.floor((values.length-1)*q)] || 0;
  }
  // Work on a display-sized copy only. RGB channels and source files are untouched.
  function mask(pixels, width, height) {
    const n=width*height, border=[[],[],[]];
    let transparent=0;
    for(let i=0;i<n;i++) if(pixels[i*4+3]<250)transparent++;
    const nativeAlpha=transparent>n*.005;
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      if(x>1&&x<width-2&&y>1&&y<height-2)continue;
      const p=(y*width+x)*4;
      if(pixels[p+3]<250)continue;
      for(let c=0;c<3;c++)border[c].push(pixels[p+c]);
    }
    const bg=border.map(v=>quantile(v.slice(),.5));
    const noise=[];
    for(let i=0;i<border[0].length;i++)noise.push(Math.max(...bg.map((v,c)=>Math.abs(border[c][i]-v))));
    const floor=clamp(quantile(noise,.8)+4,8,24);
    const alpha=new Uint8Array(n);
    for(let i=0;i<n;i++) {
      const p=i*4;
      if(nativeAlpha) { alpha[i]=pixels[p+3]; continue; }
      const distance=Math.max(Math.abs(pixels[p]-bg[0]),Math.abs(pixels[p+1]-bg[1]),Math.abs(pixels[p+2]-bg[2]));
      let a=clamp((distance-floor)/22,0,1); a=a*a*(3-2*a);
      alpha[i]=Math.round(pixels[p+3]*a);
    }
    // Keep substantial connected silhouettes, including separate fins/tendrils;
    // remove isolated background specks, never fill holes in the creature.
    if(!nativeAlpha) {
      const visited=new Uint8Array(n), queue=new Int32Array(n), groups=[];
      for(let start=0;start<n;start++) {
        if(visited[start]||alpha[start]<12)continue;
        let head=0,tail=1;queue[0]=start;visited[start]=1;
        const members=[];
        while(head<tail) {
          const i=queue[head++];members.push(i);
          const x=i%width,y=Math.floor(i/width);
          for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
            if((!dx&&!dy)||x+dx<0||x+dx>=width||y+dy<0||y+dy>=height)continue;
            const j=i+dy*width+dx;
            if(!visited[j]&&alpha[j]>=12){visited[j]=1;queue[tail++]=j;}
          }
        }
        groups.push(members);
      }
      const largest=groups.reduce((m,g)=>Math.max(m,g.length),0);
      const minimum=Math.max(6,Math.floor(largest*.001));
      for(const group of groups)if(group.length<minimum)for(const i of group)alpha[i]=0;
    }
    let left=width,top=height,right=-1,bottom=-1,mass=0,cx=0,cy=0;
    for(let i=0;i<n;i++) {
      pixels[i*4+3]=alpha[i];
      if(alpha[i]<16)continue;
      const x=i%width,y=Math.floor(i/width),weight=alpha[i]/255;
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      mass+=weight;cx+=x*weight;cy+=y*weight;
    }
    if(!mass)return {empty:true,nativeAlpha,bg,floor};
    left=Math.max(0,left-3);top=Math.max(0,top-3);right=Math.min(width-1,right+3);bottom=Math.min(height-1,bottom+3);
    return {empty:false,nativeAlpha,bg,floor,bounds:{x:left,y:top,width:right-left+1,height:bottom-top+1},center:{x:cx/mass,y:cy/mass}};
  }
  function bend(position, center, time, phase, amplitude) {
    const distance=position-center;
    return Math.sin(time*1.15-distance*4.2+phase)*distance*amplitude;
  }
  function draw(context, source, info, width, height, time, phase, reducedMotion = false) {
    if(!info||info.empty)return;
    if(reducedMotion){const b=info.bounds;context.drawImage(source,b.x,b.y,b.width,b.height,-width/2,-height/2,width,height);return;}
    const b=info.bounds, horizontal=b.width>b.height*1.25;
    const center=horizontal?(info.center.x-b.x)/b.width:(info.center.y-b.y)/b.height;
    const extent=horizontal?width:height;
    const amplitude=Math.min(4,Math.max(1,Math.min(width,height)*.018));
    const strips=24;
    for(let i=0;i<strips;i++) {
      const a=i/strips,z=(i+1)/strips,size=extent/strips;
      const d0=bend(a,center,time,phase,amplitude),d1=bend(z,center,time,phase,amplitude);
      context.save();
      // Slight overlap closes subpixel rasterization seams between adjacent bands.
      const overlap=i===strips-1?0:.6;
      if(horizontal){
        context.transform(1,(d1-d0)/size,0,1,-width/2+a*width,d0);
        context.drawImage(source,b.x+a*b.width,b.y,b.width/strips+overlap*b.width/width,b.height,0,-height/2,size+overlap,height);
      } else {
        context.transform(1,0,(d1-d0)/size,1,d0,-height/2+a*height);
        context.drawImage(source,b.x,b.y+a*b.height,b.width,b.height/strips+overlap*b.height/height,-width/2,0,width,size+overlap);
      }
      context.restore();
    }
  }

  // Fragment-level displacement, in CSS pixels. Source PNGs and mask pixels stay intact.
  const vertexSource = `
    attribute vec2 aCorner;
    uniform vec2 uViewport,uPosition,uSize;
    uniform float uAngle;
    uniform float uPad;
    varying vec2 vLocal;
    varying vec2 vScreen;
    void main(){
      vLocal=(aCorner-.5)*(uSize+vec2(10.+uPad*2.));
      float c=cos(uAngle),s=sin(uAngle);
      vec2 p=uPosition+vec2(c*vLocal.x-s*vLocal.y,s*vLocal.x+c*vLocal.y);
      vScreen=p;
      gl_Position=vec4(p.x/uViewport.x*2.-1.,1.-p.y/uViewport.y*2.,0.,1.);
    }`;
  const fragmentSource = `
    precision mediump float;
    uniform sampler2D uImage;
    uniform vec4 uCrop;
    uniform vec2 uSize,uCenter;
    uniform float uTime,uPhase,uGain,uAlpha;
    // Underwater look, display only: depth blur, shared refraction, haze and moving caustic light.
    uniform float uWorld,uBlur,uFogAmount,uWobble,uLight;
    uniform vec3 uFog;
    uniform vec2 uView;
    varying vec2 vLocal;
    varying vec2 vScreen;
    vec4 tap(vec2 uv){
      if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return vec4(0.);
      vec4 c=texture2D(uImage,uCrop.xy+uv*uCrop.zw);
      return vec4(c.rgb*c.a,c.a);
    }
    float caustic(vec2 p,float t){
      vec2 q=p*.011;
      float a=sin(q.x*3.1+t*.95+sin(q.y*2.3+t*.62)*1.4);
      float b=sin(q.y*3.7-t*.74+sin(q.x*2.9-t*.53)*1.4);
      return pow(.5+.5*a*b,3.);
    }
    void main(){
      vec2 q=vLocal/uSize+.5;
      vec2 d=q-uCenter;
      float peripheral=smoothstep(.05,.55,length(d));
      float amp=min(2.6,max(.65,min(uSize.x,uSize.y)*.008))*uGain;
      // Continuous, overlapping currents, without discrete pixel blocks or flashing.
      vec2 wave=vec2(
        sin(q.y*12.-uTime*.83+uPhase)*.52+sin(q.x*19.+q.y*9.+uTime*.47+uPhase*1.7)*.24,
        sin(q.x*11.+uTime*.69+uPhase*1.3)*.45+sin(q.y*17.-q.x*7.-uTime*.39+uPhase)*.22
      );
      vec2 breath=d*sin(uTime*.92+uPhase)*min(uSize.x,uSize.y)*.004;
      vec2 offset=(wave*(.28+.72*peripheral)*amp+breath*uGain);
      // The same slow refraction field crosses every creature, like looking through moving water.
      vec2 refraction=vec2(
        sin(vScreen.y*.043+uWorld*1.25)+.6*sin((vScreen.x+vScreen.y)*.021-uWorld*.83),
        cos(vScreen.x*.038-uWorld*1.07)*.8+.4*sin(vScreen.y*.017+uWorld*.61)
      )*uWobble;
      vec2 uv=q-(offset+refraction)/uSize;
      vec4 color=tap(uv)*.13;
      if(uBlur>.05){
        // Three staggered rings: a smooth soft focus instead of ghosted copies.
        vec2 r=vec2(uBlur)/uSize;
        for(int i=0;i<8;i++){
          float a=float(i)*.785398+uPhase;
          color+=tap(uv+vec2(cos(a),sin(a))*r)*.026
                +tap(uv+vec2(cos(a+.2618),sin(a+.2618))*r*.68)*.039
                +tap(uv+vec2(cos(a+.5236),sin(a+.5236))*r*.36)*.044;
        }
      } else color=tap(uv);
      if(color.a<.002)discard;
      vec2 sc=vScreen/uView;
      float light=caustic(vScreen,uWorld)*uLight*mix(1.,.3,clamp(sc.y,0.,1.));
      vec3 rgb=color.rgb*(1.+light*.55)+vec3(.02,.09,.1)*light*color.a;
      rgb=mix(rgb,uFog*color.a,uFogAmount);
      float alpha=color.a*uAlpha;
      gl_FragColor=vec4(rgb*uAlpha,alpha);
    }`;
  function createRenderer(host) {
    if(!host || typeof document==='undefined')return null;
    const canvas=document.createElement('canvas');
    canvas.setAttribute('aria-hidden','true');
    canvas.className='creature-pixel-layer';
    Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
    let gl;
    try {gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});}catch(_){return null;}
    if(!gl)return null;
    let program,buffer,uniforms={},textures=new Map(),ready=false,frame=0,uploads=0,viewWidth=1,viewHeight=1;
    function initialize(){
      const compile=(type,source)=>{
        const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;}
        return shader;
      };
      const precision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
      const fragment=precision&&precision.precision>0?fragmentSource.replace('precision mediump float;','precision highp float;'):fragmentSource;
      const vs=compile(gl.VERTEX_SHADER,vertexSource),fs=compile(gl.FRAGMENT_SHADER,fragment);
      if(!vs||!fs){if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);return false;}
      program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);program=null;return false;}
      gl.useProgram(program);
      buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);
      const corner=gl.getAttribLocation(program,'aCorner');
      gl.enableVertexAttribArray(corner);gl.vertexAttribPointer(corner,2,gl.FLOAT,false,0,0);
      for(const name of ['uViewport','uPosition','uSize','uAngle','uImage','uCrop','uCenter','uTime','uPhase','uGain','uAlpha','uPad','uWorld','uBlur','uFogAmount','uWobble','uLight','uFog','uView'])uniforms[name]=gl.getUniformLocation(program,name);
      gl.activeTexture(gl.TEXTURE0);gl.uniform1i(uniforms.uImage,0);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0,0,0,0);return true;
    }
    ready=initialize();
    if(!ready)return null;
    host.appendChild(canvas);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;canvas.style.visibility='hidden';});
    canvas.addEventListener('webglcontextrestored',()=>{textures.clear();ready=initialize();canvas.style.visibility=ready?'visible':'hidden';});
    function begin(width,height,density,composite){
      if(!ready)return false;
      viewWidth=Math.max(1,width);viewHeight=Math.max(1,height);frame++;uploads=0;
      const w=Math.max(1,Math.round(viewWidth*density)),h=Math.max(1,Math.round(viewHeight*density));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      canvas.style.mixBlendMode=composite==='screen'?'screen':'normal';
      gl.viewport(0,0,w,h);gl.useProgram(program);
      gl.uniform2f(uniforms.uViewport,viewWidth,viewHeight);gl.uniform2f(uniforms.uView,viewWidth,viewHeight);gl.clear(gl.COLOR_BUFFER_BIT);
      return true;
    }
    function textureFor(source){
      let cached=textures.get(source);
      if(cached){cached.used=frame;return cached.texture;}
      // Upload at most two display textures per frame. Other creatures use the Canvas fallback.
      if(uploads>=2)return null;
      if(textures.size>=128){
        let oldestSource,oldest=Infinity;
        for(const [key,value] of textures)if(value.used<oldest){oldest=value.used;oldestSource=key;}
        gl.deleteTexture(textures.get(oldestSource).texture);textures.delete(oldestSource);
      }
      const texture=gl.createTexture();if(!texture)return null;
      try {
        gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
      }catch(_){gl.deleteTexture(texture);return null;}
      uploads++;textures.set(source,{texture,used:frame});return texture;
    }
    function drawCreature(source,info,options){
      if(!ready||!info||info.empty||!(options.width>0)||!(options.height>0))return false;
      const texture=textureFor(source);if(!texture)return false;
      const b=info.bounds;
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.uniform2f(uniforms.uPosition,options.x,options.y);
      gl.uniform2f(uniforms.uSize,options.width,options.height);
      gl.uniform1f(uniforms.uAngle,options.angle||0);
      gl.uniform4f(uniforms.uCrop,b.x/source.width,b.y/source.height,b.width/source.width,b.height/source.height);
      gl.uniform2f(uniforms.uCenter,clamp((info.center.x-b.x)/b.width,0,1),clamp((info.center.y-b.y)/b.height,0,1));
      gl.uniform1f(uniforms.uTime,(options.time||0)%(200*Math.PI));
      gl.uniform1f(uniforms.uPhase,options.phase||0);gl.uniform1f(uniforms.uGain,options.reducedMotion?0:1);
      gl.uniform1f(uniforms.uAlpha,options.alpha===undefined?1:clamp(options.alpha,0,1));
      const still=Boolean(options.reducedMotion);
      const blur=clamp(Number(options.blur)||0,0,8);
      gl.uniform1f(uniforms.uBlur,blur);gl.uniform1f(uniforms.uPad,Math.ceil(blur));
      gl.uniform1f(uniforms.uWorld,still?0:(Number(options.world)||0)%(200*Math.PI));
      gl.uniform1f(uniforms.uWobble,still?0:clamp(Number(options.wobble)||0,0,4));
      gl.uniform1f(uniforms.uLight,clamp(Number(options.light)||0,0,2.6));
      gl.uniform1f(uniforms.uFogAmount,clamp(Number(options.fog)||0,0,.9));
      const fog=options.fogColor||[0,0,0];gl.uniform3f(uniforms.uFog,fog[0],fog[1],fog[2]);
      gl.drawArrays(gl.TRIANGLES,0,6);return true;
    }
    return {begin,draw:drawCreature,get available(){return ready;},get textureCount(){return textures.size;}};
  }

  return {mask,bend,draw,createRenderer};
});
