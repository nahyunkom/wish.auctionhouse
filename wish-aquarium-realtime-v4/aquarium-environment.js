(function(root){
  'use strict';
  // A fixed scene: the supplied photographic reference provides all water colors,
  // fish composition and light. Do not read the retired theme/lighting preferences.
  const tinted=new WeakMap();
  function background(ctx,w,h) {
    // Clear only the live layer. The reference stays visible underneath.
    ctx.clearRect(0,0,w,h);
  }
  function texture(image) {
    const previous=tinted.get(image);if(previous)return previous;
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d'),data=ctx.createImageData(image.width,image.height);
    data.data.set(image.pixels);
    // Underwater color in a disposable display copy; original PNG/RGBA untouched.
    for(let p=0;p<data.data.length;p+=4){
      data.data[p]=image.pixels[p]*.52;
      data.data[p+1]=image.pixels[p+1]*.91;
      data.data[p+2]=Math.min(255,image.pixels[p+2]*1.04+8);
    }
    ctx.putImageData(data,0,0);tinted.set(image,canvas);return canvas;
  }
  function composite(){return 'source-over';}
  root.AquariumEnvironment={background,texture,composite};
})(window);
