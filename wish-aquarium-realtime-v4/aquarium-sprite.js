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
  function draw(context, source, info, width, height, time, phase) {
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
  return {mask,bend,draw};
});
