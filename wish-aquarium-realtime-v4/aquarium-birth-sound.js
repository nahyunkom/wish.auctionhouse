/* A small sound for a creature being born in the shared aquarium (no background music).
   Made live in the browser (Web Audio), timed to the 15-second particle birth:
   0–9 s  fine glints gather, more and more, over a soft rising breath of water;
   9–12 s the glints draw together and a clear tone rises as the form condenses;
   12 s   a soft glassy bloom and a few bubbles as the creature wakes and swims.
   Browsers allow sound only after one touch, click or key on the page.
   M mutes / unmutes. ?sound=off turns it off. */
(function(root){
'use strict';
let off=false;
try{off=new URLSearchParams(location.search).get('sound')==='off';}catch(_){}
const Ctx=root.AudioContext||root.webkitAudioContext;
if(off||!Ctx)return;
let ac=null,out=null,verb=null,muted=false;
const VOLUME=1.2,WAKE=12;
const BLOOM=[587.33,739.99,880,1108.73];   // D5 F#5 A5 C#6: open and gentle
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
  out=ac.createGain();out.gain.value=muted?0:VOLUME;out.connect(comp);
  verb=ac.createConvolver();verb.buffer=impulse(4.5,2.6);
  const wet=ac.createGain();wet.gain.value=.7;verb.connect(wet);wet.connect(out);
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
// One glint: a tiny high sine that blinks in and out.
function glint(bus,at,freq,gain){
 const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=freq;
 g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(gain,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+.18+Math.random()*.25);
 o.connect(g);g.connect(bus);o.start(at);o.stop(at+.5);
}
function bubble(bus,at,gain){
 const o=ac.createOscillator(),g=ac.createGain(),f=420+Math.random()*700,len=.05+Math.random()*.07;
 o.type='sine';o.frequency.setValueAtTime(f,at);o.frequency.exponentialRampToValueAtTime(f*(1.8+Math.random()),at+len);
 g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(gain,at+.006);g.gain.exponentialRampToValueAtTime(.0001,at+len+.06);
 o.connect(g);g.connect(bus);o.start(at);o.stop(at+len+.1);
}
function birthSound(x){
 if(!ac||ac.state!=='running'||muted)return;
 const W=root.AquariumView?root.AquariumView.width():innerWidth;
 const bus=panner(Number.isFinite(x)&&W?(x/W)*2-1:0),t0=ac.currentTime+.05;
 // A soft breath of water rising under everything.
 const len=Math.floor(ac.sampleRate*WAKE),buf=ac.createBuffer(1,len,ac.sampleRate),d=buf.getChannelData(0);let last=0;
 for(let i=0;i<len;i++){last=(last+.02*(Math.random()*2-1))/1.02;d[i]=last*3;}
 const breath=ac.createBufferSource();breath.buffer=buf;
 const bp=ac.createBiquadFilter();bp.type='bandpass';bp.Q.value=.9;
 bp.frequency.setValueAtTime(260,t0);bp.frequency.exponentialRampToValueAtTime(1400,t0+WAKE-.5);
 const bg=ac.createGain();bg.gain.setValueAtTime(0,t0);bg.gain.linearRampToValueAtTime(.16,t0+7);bg.gain.linearRampToValueAtTime(.22,t0+WAKE-.6);bg.gain.exponentialRampToValueAtTime(.0001,t0+WAKE+1.5);
 breath.connect(bp);bp.connect(bg);bg.connect(bus);breath.start(t0);breath.stop(t0+WAKE+1.6);
 // Glints gather: sparse at first, then dense, then they tighten toward one pitch.
 for(let t=.2;t<WAKE-.3;){
  const k=t/WAKE,base=1800+k*1400,spread=(1-Math.max(0,k-.7)/.3)*1600+200;
  glint(bus,t0+t,base+(Math.random()-.5)*spread,.012+k*.02);
  t+=Math.max(.035,.45*(1-k)*(1-k)+.03)*(.6+Math.random()*.8);
 }
 // The form condenses: a clear tone rising from 9 s to the wake.
 const rise=ac.createOscillator(),rg=ac.createGain();rise.type='sine';
 rise.frequency.setValueAtTime(293.66,t0+8.6);rise.frequency.exponentialRampToValueAtTime(587.33,t0+WAKE);
 rg.gain.setValueAtTime(0,t0+8.6);rg.gain.linearRampToValueAtTime(.05,t0+11.2);rg.gain.exponentialRampToValueAtTime(.0001,t0+WAKE+.6);
 rise.connect(rg);rg.connect(bus);rise.start(t0+8.6);rise.stop(t0+WAKE+.7);
 // It wakes: a glassy bloom and a few bubbles.
 BLOOM.forEach((f,i)=>{
  const at=t0+WAKE+i*.12,o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=f;
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.06,at+.03);g.gain.exponentialRampToValueAtTime(.0001,at+4.5);
  o.connect(g);g.connect(bus);o.start(at);o.stop(at+4.6);
 });
 for(let i=0;i<10;i++)bubble(bus,t0+WAKE+.3+i*.11+Math.random()*.08,.03+Math.random()*.02);
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
