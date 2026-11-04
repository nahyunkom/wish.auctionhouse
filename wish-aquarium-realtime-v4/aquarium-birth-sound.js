/* A small sound for a creature being born in the shared aquarium (no music, no notes).
   Made live in the browser (Web Audio) from filtered noise only, timed to the 15-second birth:
   0–9 s  fine sparkling grains, like glittering sand, gather more and more densely
          over a soft airy breath that slowly rises;
   9–12 s the grains draw together in pitch and space as the form condenses;
   12 s   the breath opens and a fine fizz of tiny grains drifts away as the creature wakes.
   Browsers allow sound only after one touch, click or key on the page.
   M mutes / unmutes. ?sound=off turns it off. */
(function(root){
'use strict';
let off=false;
try{off=new URLSearchParams(location.search).get('sound')==='off';}catch(_){}
const Ctx=root.AudioContext||root.webkitAudioContext;
if(off||!Ctx)return;
let ac=null,out=null,verb=null,muted=false;
const VOLUME=2,WAKE=12;
let noise=null;
function impulse(seconds,decay){
 const rate=ac.sampleRate,len=Math.floor(rate*seconds),buf=ac.createBuffer(2,len,rate);
 for(let c=0;c<2;c++){const d=buf.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);}
 return buf;
}
function ensure(){
 if(ac)return true;
 try{
  ac=new Ctx();
  const comp=ac.createDynamicsCompressor();comp.threshold.value=-18;comp.ratio.value=3;comp.connect(ac.destination);
  const soft=ac.createBiquadFilter();soft.type='lowpass';soft.frequency.value=9000;soft.connect(comp);
  out=ac.createGain();out.gain.value=muted?0:VOLUME;out.connect(soft);
  verb=ac.createConvolver();verb.buffer=impulse(4.5,2.6);
  const wet=ac.createGain();wet.gain.value=.45;verb.connect(wet);wet.connect(out);
  return true;
 }catch(_){ac=null;return false;}
}
function unlock(){if(ensure()&&ac.state==='suspended')ac.resume();}
addEventListener('pointerdown',unlock,{passive:true});
addEventListener('keydown',e=>{unlock();if(e.key==='m'||e.key==='M'){muted=!muted;if(out)out.gain.setTargetAtTime(muted?0:VOLUME,ac.currentTime,.3);}});
function panner(pan){
 if(ac.createStereoPanner){const p=ac.createStereoPanner();p.pan.value=Math.max(-.9,Math.min(.9,pan));p.connect(out);p.connect(verb);return p;}
 const g=ac.createGain();g.connect(out);g.connect(verb);return g;
}
function noiseBuffer(){
 if(noise)return noise;
 const len=ac.sampleRate*2;noise=ac.createBuffer(1,len,ac.sampleRate);const d=noise.getChannelData(0);
 for(let i=0;i<len;i++)d[i]=Math.random()*2-1;return noise;
}
// One grain: a few milliseconds of noise through a narrow band, a glint of light as sound.
function grain(bus,at,freq,gain,len,pan){
 const src=ac.createBufferSource();src.buffer=noiseBuffer();
 const bp=ac.createBiquadFilter();bp.type='bandpass';bp.frequency.value=freq;bp.Q.value=18+Math.random()*14;
 const g=ac.createGain();g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(gain,at+len*.25);g.gain.exponentialRampToValueAtTime(.0001,at+len);
 src.connect(bp);bp.connect(g);
 if(ac.createStereoPanner){const p=ac.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));g.connect(p);p.connect(bus);}else g.connect(bus);
 src.start(at,Math.random()*1.5);src.stop(at+len+.02);
}
// An airy breath: noise through a slowly opening filter.
function breath(bus,at,dur,from,to,peak,shape){
 const src=ac.createBufferSource();src.buffer=noiseBuffer();src.loop=true;
 const bp=ac.createBiquadFilter();bp.type='bandpass';bp.Q.value=.7;
 bp.frequency.setValueAtTime(from,at);bp.frequency.exponentialRampToValueAtTime(to,at+dur*.85);
 const g=ac.createGain();g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(peak,at+dur*shape);g.gain.exponentialRampToValueAtTime(.0001,at+dur);
 src.connect(bp);bp.connect(g);g.connect(bus);src.start(at,Math.random());src.stop(at+dur+.05);
}
function birthSound(x){
 if(!ac||ac.state!=='running'||muted)return;
 const W=root.AquariumView?root.AquariumView.width():innerWidth;
 const center=Number.isFinite(x)&&W?(x/W)*2-1:0,bus=panner(center*.7),t0=ac.currentTime+.05;
 // The water breathes in under the gathering light.
 breath(bus,t0,WAKE+1.2,320,1300,.03,.85);
 // Grains gather: sparse and wide at first, then dense; near the end they close in
 // around one bright band and one place, as the particles condense into the form.
 for(let t=.15;t<WAKE-.2;){
  const k=t/WAKE,close=Math.max(0,(k-.65)/.35);
  const band=5200+(Math.random()-.5)*(5200*(1-close)+600);
  const spread=(1-close)*1.6+.2;
  grain(bus,t0+t,Math.max(2500,band),.16+k*.14,.06+Math.random()*.1,center+(Math.random()-.5)*spread);
  t+=Math.max(.018,.32*(1-k)*(1-k)+.018)*(.5+Math.random());
 }
 // It wakes: the breath opens once, and a fine fizz drifts up and away.
 breath(bus,t0+WAKE-.4,3.2,900,3200,.03,.25);
 for(let i=0;i<70;i++){const at=t0+WAKE+Math.pow(Math.random(),1.6)*2.6;
  grain(bus,at,5000+Math.random()*3500,.12*(1-(at-t0-WAKE)/2.8),.04+Math.random()*.06,center+(Math.random()-.5)*1.4);}
}
function hook(){
 const E=root.AquariumEnvironment;if(!E||!E.birth){setTimeout(hook,200);return;}
 if(E.birth.__birthSound)return;
 const b=E.birth;
 E.birth=function(points,x){try{birthSound(x);}catch(_){}return b.apply(this,arguments);};
 E.birth.__birthSound=true;
}
hook();
root.AquariumBirthSound={play:birthSound,unlock,tap:()=>ac?{ac,out}:null,get muted(){return muted;}};
})(typeof window!=='undefined'?window:globalThis);
