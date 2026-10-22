(function(root){
  'use strict';
  const settings={theme:'black',light:55};
  try {const saved=JSON.parse(localStorage.getItem('wish-aquarium-environment')||'null');if(saved){settings.theme=saved.theme==='blue'?'blue':'black';if(Number.isFinite(saved.light))settings.light=Math.max(0,Math.min(100,saved.light));}}catch(_){}
  const tinted=new WeakMap();
  function save(){try{localStorage.setItem('wish-aquarium-environment',JSON.stringify(settings));}catch(_){} }
  function sync(){
    document.body.dataset.water=settings.theme;
    document.querySelectorAll('[data-water-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.waterChoice===settings.theme)));
    const slider=document.querySelector('#water-light');slider.value=settings.light;slider.disabled=settings.theme!=='blue';
    document.querySelector('#water-light-value').textContent=settings.light+'%';
  }
  document.querySelectorAll('[data-water-choice]').forEach(button=>button.addEventListener('click',()=>{settings.theme=button.dataset.waterChoice;save();sync();}));
  document.querySelector('#water-light').addEventListener('input',event=>{settings.light=Number(event.target.value);save();sync();});
  sync();
  function background(ctx,w,h,time){
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    if(settings.theme!=='blue'){ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);ctx.restore();return;}
    const water=ctx.createLinearGradient(0,0,w*.18,h);
    water.addColorStop(0,'#087ca8');water.addColorStop(.32,'#07548c');water.addColorStop(.73,'#032c5b');water.addColorStop(1,'#011329');
    ctx.fillStyle=water;ctx.fillRect(0,0,w,h);
    const glow=ctx.createRadialGradient(w*.38,-h*.12,0,w*.38,0,w*.75);
    glow.addColorStop(0,'rgba(56,218,236,.32)');glow.addColorStop(1,'rgba(15,99,173,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    const still=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for(let i=0;i<4;i++){
      const x=w*(.12+i*.25)+(still?0:Math.sin(time*.06+i)*w*.015);
      ctx.save();ctx.translate(x,h*.15);ctx.rotate(-.14);ctx.scale(w*.07,h*.8);
      const beam=ctx.createRadialGradient(0,0,0,0,0,1);
      beam.addColorStop(0,'rgba(119,229,243,.10)');beam.addColorStop(.35,'rgba(72,190,233,.045)');beam.addColorStop(1,'rgba(51,165,219,0)');
      ctx.fillStyle=beam;ctx.fillRect(-1,-1,2,2);ctx.restore();
    }
    ctx.restore();
  }
  // Lighting affects only a disposable display canvas, never the source PNG or mask.
  function texture(image){
    if(settings.theme!=='blue'||settings.light===0)return image.canvas;
    const level=Math.round(settings.light/5)*5,previous=tinted.get(image);
    if(previous?.level===level)return previous.canvas;
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d'),data=ctx.createImageData(image.width,image.height),amount=level/100;
    data.data.set(image.pixels);
    const bounds=image.silhouette.bounds;
    for(let y=0;y<image.height;y++){
      const upper=Math.max(0,1-(y-bounds.y)/bounds.height);
      for(let x=0;x<image.width;x++){
        const p=(y*image.width+x)*4;
        data.data[p]=image.pixels[p]*(1-.23*amount)+4*upper*amount;
        data.data[p+1]=image.pixels[p+1]*(1-.06*amount)+12*upper*amount;
        data.data[p+2]=image.pixels[p+2]*(1+.06*amount)+18*upper*amount;
      }
    }
    ctx.putImageData(data,0,0);tinted.set(image,{level,canvas});return canvas;
  }
  // Fresh background every frame prevents additive buildup. Screen lets water light
  // pass through dark source fringes in blue mode instead of making black halos.
  function composite(){return settings.theme==='blue'?'screen':'source-over';}
  root.AquariumEnvironment={background,texture,composite};
})(window);
