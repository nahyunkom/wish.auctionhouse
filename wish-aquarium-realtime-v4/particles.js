/* A living point-cloud membrane. All geometry is animated in the vertex shader. */
(() => {
  const canvas = document.querySelector('#membrane');
  if (!canvas) return;
  const small = matchMedia('(max-width: 760px)').matches;
  const count = small ? 24000 : 52000;
  const points = new Float32Array(count * 4);
  const colors = new Float32Array(count * 3);
  let seed = 68127;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    const a = random() * Math.PI * 2;
    const rim = random() < .61;
    const layer = Math.floor(random() * 6);
    const r = rim ? .79 + layer * .041 + (random() - .5) * .013 : Math.sqrt(random()) * .985;
    const cos = Math.cos(a), sin = Math.sin(a);
    let x = (cos > 0 ? cos : cos * .63) * r;
    let y = sin * r;
    // Fold the trailing edge into a narrow, flowing membrane.
    if (cos < -.3) x -= .12 * Math.sin(a * 3) ** 2;
    const z = (random() > .5 ? 1 : -1) * Math.sqrt(Math.max(0, 1 - r * r)) * .24;
    const k = i * 4;
    points[k] = x; points[k+1] = y; points[k+2] = z; points[k+3] = random();
    let color;
    if (rim && layer === 1) color = [.64, .72, .22];
    else if (rim && layer === 2) color = [.13, .74, .73];
    else if (rim) color = [.025, .28 + random() * .17, .7 + random() * .23];
    else color = random() < .13 ? [.49, .55, .23] : [.018, .28 + random() * .16, .39 + random() * .18];
    colors.set(color, i * 3);
  }
  const gl = canvas.getContext('webgl', {alpha:true,antialias:false,powerPreference:'low-power',depth:false});
  let w=1,h=1,dpr=1,t=0,last=0,raf=0,paused=false,visible=!document.hidden;
  let px=-10000,py=-10000,pressure=0;
  let cx=0,cy=0,radius=1,currentScene='welcome';
  const sceneTargets={welcome:[.62,.51,1],greeting:[.73,.51,.9],reply:[.26,.49,.95],introduction:[.76,.49,1.02],question:[.23,.51,.91],discovery:[.5,.5,1.12],result:[.82,.52,.92]};
  let position=[.62,.51,1], target=position.slice();
  function resize(){w=window.innerWidth;h=window.innerHeight;dpr=Math.min(window.devicePixelRatio||1,1.75);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);if(gl)gl.viewport(0,0,canvas.width,canvas.height);wake();}
  function geometry(){const mobile=w<=760;cx=w*(mobile?.54:position[0]);cy=h*(mobile?(currentScene==='welcome'?.47:.46):position[1]);radius=Math.min(h*(mobile?.36:.5),w*(mobile?.58:.41))*position[2];}
  let program, uniform={};
  const vertex=`
  precision highp float;
  attribute vec4 aPoint; attribute vec3 aColor;
  uniform vec2 uViewport,uCenter,uPointer;
  uniform float uTime,uRadius,uPixelRatio,uPressure;
  varying vec3 vColor; varying float vAlpha;
  void main(){
    vec3 p=aPoint.xyz; float seed=aPoint.w;
    float angle=atan(p.y,p.x);float r=length(p.xy);
    float breath=sin(uTime*.64)*.035;
    float wave=sin(angle*3.-uTime*.78+r*4.)*.014+sin(angle*7.+uTime*.37+seed)*.005;
    p.xy*=1.+breath+wave;
    p.x+=sin(p.y*4.+uTime*.53)*.025*(1.-smoothstep(-.2,.8,p.x));
    p.y+=sin(p.x*3.-uTime*.45)*.02;
    float rot=sin(uTime*.19)*.10-.04;
    p.xy=mat2(cos(rot),-sin(rot),sin(rot),cos(rot))*p.xy;
    p.x+=p.z*sin(uTime*.24)*.38;
    vec2 screen=uCenter+vec2(p.x,-p.y)*uRadius;
    vec2 delta=screen-uPointer;float distToPointer=length(delta);
    float influence=exp(-distToPointer*distToPointer/15000.)*uPressure;
    screen+=delta/max(distToPointer,1.)*influence*(24.+seed*22.);
    screen+=vec2(sin(seed*60.+uTime),cos(seed*90.+uTime))*.55;
    vec2 clip=screen/uViewport*2.-1.;
    gl_Position=vec4(clip.x,-clip.y,0.,1.);
    gl_PointSize=(.55+seed*.6+influence*.4)*uPixelRatio;
    vColor=aColor*(.88+.12*sin(uTime*.7+angle*2.));
    vAlpha=(.30+seed*.45)*(1.-.22*influence);
  }`;
  const fragment=`precision mediump float;varying vec3 vColor;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vColor,vAlpha*(1.-smoothstep(.2,.5,d)));}`;
  function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);return null;}return s;}
  let fallback;
  function initializeGPU(){if(gl){const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);if(vs&&fs){program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))program=null;}
    if(program){gl.useProgram(program);for(const [name,array,size] of [['aPoint',points,4],['aColor',colors,3]]){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,array,gl.STATIC_DRAW);const a=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,0,0);}for(const n of ['uViewport','uCenter','uPointer','uTime','uRadius','uPixelRatio','uPressure'])uniform[n]=gl.getUniformLocation(program,n);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.clearColor(0,0,0,0);}
  }
  }
  initializeGPU();
  if(!program){const replacement=document.createElement('canvas');replacement.id='membrane-fallback';canvas.after(replacement);canvas.style.display='none';fallback=replacement.getContext('2d');}
  function draw(){geometry();if(program){gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform2f(uniform.uViewport,w,h);gl.uniform2f(uniform.uCenter,cx,cy);gl.uniform2f(uniform.uPointer,px,py);gl.uniform1f(uniform.uTime,t);gl.uniform1f(uniform.uRadius,radius);gl.uniform1f(uniform.uPixelRatio,dpr);gl.uniform1f(uniform.uPressure,pressure);gl.drawArrays(gl.POINTS,0,count);}else if(fallback){const c=fallback.canvas;if(c.width!==canvas.width||c.height!==canvas.height){c.width=canvas.width;c.height=canvas.height;}fallback.setTransform(dpr,0,0,dpr,0,0);fallback.clearRect(0,0,w,h);const breath=1+Math.sin(t*.64)*.035;for(let i=0;i<count;i+=6){const k=i*4;let x=cx+(points[k]*breath+Math.sin(points[k+1]*4+t*.53)*.02)*radius;let y=cy-points[k+1]*radius*breath;const dx=x-px,dy=y-py,d=Math.hypot(dx,dy),f=Math.exp(-d*d/15000)*pressure*30;x+=dx/Math.max(d,1)*f;y+=dy/Math.max(d,1)*f;fallback.fillStyle=`rgba(${colors[i*3]*255},${colors[i*3+1]*255},${colors[i*3+2]*255},.68)`;fallback.fillRect(x,y,.8,.8);}}}
  function tick(now){raf=0;if(!visible)return;const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(!paused){t+=dt;position=position.map((v,i)=>v+(target[i]-v)*Math.min(1,dt*1.5));pressure*=Math.exp(-dt*.8);}else position=target.slice();draw();if(!paused)raf=requestAnimationFrame(tick);}
  function wake(){if(!raf&&visible)raf=requestAnimationFrame(tick);}
  function sync(){paused=document.body.classList.contains('motion-paused');currentScene=document.body.dataset.scene||'welcome';target=(sceneTargets[currentScene]||sceneTargets.welcome).slice();if(paused){pressure=0;position=target.slice();}last=0;wake();}
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class','data-scene']});
  window.addEventListener('resize',resize,{passive:true});
  window.addEventListener('pointermove',e=>{if(paused)return;px=e.clientX;py=e.clientY;pressure=Math.max(pressure,.7);wake();},{passive:true});
  window.addEventListener('pointerdown',e=>{if(paused)return;px=e.clientX;py=e.clientY;pressure=1.8;wake();},{passive:true});
  document.addEventListener('visibilitychange',()=>{visible=!document.hidden;last=0;if(!visible&&raf){cancelAnimationFrame(raf);raf=0;}if(visible)wake();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(raf)cancelAnimationFrame(raf);raf=0;visible=false;});
  canvas.addEventListener('webglcontextrestored',()=>{initializeGPU();visible=!document.hidden;last=0;resize();sync();});
  resize();sync();
})();
