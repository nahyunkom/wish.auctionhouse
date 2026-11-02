/* Live underwater soundscape for the shared aquarium, made in the browser (Web Audio).
   No recordings: a deep water hum, a slow drifting pad, bubbles that follow the bubble
   surges on screen, and a clear glassy bloom when a creature is released.
   Browsers only allow sound after a gesture, so it starts on the first touch, click or key.
   M mutes / unmutes. ?sound=off turns it off for the page. */
(function(root){
'use strict';
let off=false;
try{off=new URLSearchParams(location.search).get('sound')==='off';}catch(_){}
const Ctx=root.AudioContext||root.webkitAudioContext;
if(off||!Ctx)return;
let ac=null,master=null,wet=null,dry=null,started=false,muted=false,padVoices=[],chordIndex=0;
const VOLUME=.55;
// Slow, open chords (Hz). Low and wide so they sit under the room, never a melody.
const CHORDS=[
 [73.42,110.00,164.81,220.00,277.18],   // D A E A C#
 [65.41,98.00,146.83,196.00,246.94],    // C G D G B
 [61.74,92.50,138.59,185.00,233.08],    // B F# C# F# A#
 [69.30,103.83,155.56,207.65,261.63]    // C# G# D# G# C
];
function impulse(seconds,decay){
 const rate=ac.sampleRate,len=Math.floor(rate*seconds),buf=ac.createBuffer(2,len,rate);
 for(let c=0;c<2;c++){const d=buf.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);}
 return buf;
}
function brownNoise(seconds){
 const len=Math.floor(ac.sampleRate*seconds),buf=ac.createBuffer(1,len,ac.sampleRate),d=buf.getChannelData(0);let last=0;
 for(let i=0;i<len;i++){last=(last+.02*(Math.random()*2-1))/1.02;d[i]=last*3.5;}
 return buf;
}
function lfo(freq,depth,target){const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=freq;g.gain.value=depth;o.connect(g);g.connect(target);o.start();return o;}
function build(){
 ac=new Ctx();
 const comp=ac.createDynamicsCompressor();comp.threshold.value=-20;comp.ratio.value=3;comp.connect(ac.destination);
 master=ac.createGain();master.gain.value=0;master.connect(comp);
 const verb=ac.createConvolver();verb.buffer=impulse(6,2.4);
 wet=ac.createGain();wet.gain.value=.65;verb.connect(wet);wet.connect(master);
 dry=ac.createGain();dry.gain.value=.5;dry.connect(master);
 dry.connect(verb);
 // 1. The water itself: brown noise under a slowly breathing low-pass.
 const hum=ac.createBufferSource();hum.buffer=brownNoise(8);hum.loop=true;
 const humLp=ac.createBiquadFilter();humLp.type='lowpass';humLp.frequency.value=220;humLp.Q.value=.6;
 const humGain=ac.createGain();humGain.gain.value=.55;
 hum.connect(humLp);humLp.connect(humGain);humGain.connect(master);humGain.connect(verb);
 lfo(.045,90,humLp.frequency);lfo(.07,.12,humGain.gain);hum.start();
 // A higher, airy wash: the light near the surface.
 const air=ac.createBufferSource();air.buffer=brownNoise(6);air.loop=true;
 const airBp=ac.createBiquadFilter();airBp.type='bandpass';airBp.frequency.value=900;airBp.Q.value=.7;
 const airGain=ac.createGain();airGain.gain.value=.05;air.connect(airBp);airBp.connect(airGain);airGain.connect(verb);
 lfo(.031,400,airBp.frequency);air.start();
 // 2. The pad: soft detuned sines that drift between chords.
 const padBus=ac.createGain();padBus.gain.value=.11;
 const padLp=ac.createBiquadFilter();padLp.type='lowpass';padLp.frequency.value=900;padLp.Q.value=.3;
 padBus.connect(padLp);padLp.connect(dry);lfo(.02,350,padLp.frequency);
 for(let i=0;i<5;i++){
  const pair=[];
  for(const det of [-4,4]){
   const o=ac.createOscillator();o.type=i<2?'sine':'triangle';o.frequency.value=CHORDS[0][i];o.detune.value=det;
   const g=ac.createGain();g.gain.value=i<2?.5:.22;o.connect(g);g.connect(padBus);lfo(.05+i*.013,.12,g.gain);o.start();pair.push(o);
  }
  padVoices.push(pair);
 }
 setInterval(()=>{chordIndex=(chordIndex+1)%CHORDS.length;const t=ac.currentTime;
  padVoices.forEach((pair,i)=>pair.forEach(o=>{o.frequency.cancelScheduledValues(t);o.frequency.setValueAtTime(o.frequency.value,t);o.frequency.exponentialRampToValueAtTime(CHORDS[chordIndex][i],t+9);}));
 },26000);
 scheduleBubbles();
}
// 3. A bubble: a short sine whose pitch rises as it lets go, as real bubbles sound.
function bubble(gain,base){
 if(!ac||muted)return;
 const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain(),p=ac.createStereoPanner?ac.createStereoPanner():null;
 const f=base||(380+Math.random()*900),len=.05+Math.random()*.08;
 o.type='sine';o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*(1.8+Math.random()*1.2),t+len);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain||(.025+Math.random()*.035),t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+len+.05);
 o.connect(g);if(p){p.pan.value=Math.random()*1.6-.8;g.connect(p);p.connect(dry);}else g.connect(dry);
 o.start(t);o.stop(t+len+.08);
}
function scheduleBubbles(){
 const surge=root.AquariumEnvironment&&root.AquariumEnvironment.surgeLevel?root.AquariumEnvironment.surgeLevel():0;
 // A steady trickle, a rush during a surge, and now and then a little run.
 const n=Math.random()<.18?3+Math.floor(Math.random()*5):1;
 for(let i=0;i<n;i++)setTimeout(()=>bubble(),i*(40+Math.random()*70));
 setTimeout(scheduleBubbles,(380+Math.random()*900)/(1+surge*4));
}
// 4. A release: a soft glassy bloom and a rising stream of bubbles.
function bloom(){
 if(!ac||muted)return;
 const t=ac.currentTime,notes=CHORDS[chordIndex].slice(2).map(f=>f*4);
 notes.forEach((f,i)=>{
  const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=f;
  const s=t+i*.35;g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(.05,s+.04);g.gain.exponentialRampToValueAtTime(.0001,s+5);
  o.connect(g);g.connect(dry);o.start(s);o.stop(s+5.2);
 });
 for(let i=0;i<22;i++)setTimeout(()=>bubble(.04+Math.random()*.03,300+i*40+Math.random()*200),300+i*90+Math.random()*80);
}
function touch(){if(!ac||muted)return;for(let i=0;i<5;i++)setTimeout(()=>bubble(.035),i*(50+Math.random()*60));}
function start(){
 if(started){if(ac&&ac.state==='suspended')ac.resume();return;}
 started=true;try{build();}catch(_){return;}
 ac.resume&&ac.resume();
 master.gain.setValueAtTime(0,ac.currentTime);master.gain.linearRampToValueAtTime(VOLUME,ac.currentTime+6);
}
function setMuted(value){
 muted=value;if(!ac)return;const t=ac.currentTime;
 master.gain.cancelScheduledValues(t);master.gain.setValueAtTime(master.gain.value,t);master.gain.linearRampToValueAtTime(muted?0:VOLUME,t+1.5);
}
addEventListener('pointerdown',()=>{start();touch();},{passive:true});
addEventListener('keydown',e=>{start();if(e.key==='m'||e.key==='M')setMuted(!muted);});
// Follow the aquarium: releases bloom. Wait until the environment exists.
function hook(){
 const E=root.AquariumEnvironment;if(!E){setTimeout(hook,200);return;}
 if(E.birth&&!E.birth.__sound){const b=E.birth;E.birth=function(){bloom();return b.apply(this,arguments);};E.birth.__sound=true;}
 else if(E.burst&&!E.burst.__sound){const b=E.burst;E.burst=function(){bloom();return b.apply(this,arguments);};E.burst.__sound=true;}
}
hook();
root.AquariumSound={start,tap:()=>master&&ac?{ac,master}:null,mute:()=>setMuted(true),unmute:()=>setMuted(false),get muted(){return muted;}};
})(typeof window!=='undefined'?window:globalThis);
