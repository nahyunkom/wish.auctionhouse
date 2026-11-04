/* A small sound for a creature being born in the shared aquarium: twinkling sparkle,
   like fairy dust or light catching on particles. No low tones, no swells.
   Made live in the browser (Web Audio), timed to the 15-second birth:
   0–12 s soft, very high twinkles in a bright major pentatonic, sparse at first and a
          little denser as the particles gather;
   12 s   a light upward sparkle as the creature wakes, then it fades.
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
  verb=ac.createConvolver();verb.buffer=impulse(2.2,3);
  const wet=ac.createGain();wet.gain.value=.35;verb.connect(wet);wet.connect(out);
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
// Bright major pentatonic, high up (C6 to E8): it can only sound light and sweet.
const TWINKLE=(()=>{const base=[1046.5,1174.66,1318.51,1567.98,1760];const out=[];
 for(const m of [1,2,4])for(const f of base)if(f*m<=5300)out.push(f*m);return out;})();
// One twinkle: a soft sine with a faint octave sparkle, quick in, gentle ring out.
function twinkle(bus,at,freq,gain,pan){
 const g=ac.createGain();g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(gain,at+.004);
 const ring=.25+Math.random()*.35;g.gain.exponentialRampToValueAtTime(.0001,at+ring);
 for(const [mul,amt] of [[1,1],[2,.18]]){const o=ac.createOscillator(),og=ac.createGain();o.type='sine';o.frequency.value=freq*mul;og.gain.value=amt;o.connect(og);og.connect(g);o.start(at);o.stop(at+ring+.02);}
 if(ac.createStereoPanner){const p=ac.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));g.connect(p);p.connect(bus);}else g.connect(bus);
}
const pick=lo=>TWINKLE[Math.min(TWINKLE.length-1,lo+Math.floor(Math.random()*(TWINKLE.length-lo)))];
function birthSound(x){
 if(!ac||ac.state!=='running'||muted)return;
 const W=root.AquariumView?root.AquariumView.width():innerWidth;
 const center=Number.isFinite(x)&&W?(x/W)*2-1:0,bus=panner(center*.6),t0=ac.currentTime+.05;
 // Twinkles while the particles gather: sparse, then a little denser.
 for(let t=.2;t<WAKE-.1;){
  const k=t/WAKE;
  twinkle(bus,t0+t,pick(Math.floor(k*4)),.03+k*.03,center+(Math.random()-.5)*1.4);
  t+=(.55-.38*k)*(.5+Math.random());
 }
 // It wakes: a quick, light upward sparkle.
 const run=TWINKLE.slice(3);
 run.forEach((f,i)=>twinkle(bus,t0+WAKE+i*.07,f,.05-i*.003,center+(i/run.length-.5)*.8));
 for(let i=0;i<8;i++)twinkle(bus,t0+WAKE+.8+i*.18+Math.random()*.1,pick(6),.025,center+(Math.random()-.5)*1.2);
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
