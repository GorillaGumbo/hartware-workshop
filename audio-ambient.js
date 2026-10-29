import {seededRandom} from './audio-files.js';
export const defaultAmbientLoop=Object.freeze({minHoldMs:2000,maxHoldMs:5000,crossfadeMs:1000,separationMs:100});
export const ambientLimits=Object.freeze({holdMs:600000,crossfadeMinMs:10,crossfadeMaxMs:60000,separationMs:60000});
export function validateAmbientLoop(value){
 const keys=Object.keys(defaultAmbientLoop);
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(k=>!keys.includes(k))||!keys.every(k=>Number.isInteger(value[k]))||value.minHoldMs<0||value.maxHoldMs<value.minHoldMs||value.maxHoldMs>ambientLimits.holdMs||value.crossfadeMs<ambientLimits.crossfadeMinMs||value.crossfadeMs>ambientLimits.crossfadeMaxMs||value.separationMs<0||value.separationMs>ambientLimits.separationMs)throw Error('Ambient Loop needs ordered hold times (0–600000 ms), a 10–60000 ms crossfade and 0–60000 ms separation.');
 return Object.fromEntries(keys.map(k=>[k,value[k]]));
}
export const circularPosition=(frame,length)=>((frame%length)+length)%length;
export const circularDistance=(a,b,length)=>{const distance=Math.abs(circularPosition(a,length)-circularPosition(b,length));return Math.min(distance,length-distance);};
// Sample the allowed circular arc directly: bounded work, no retry loop.
export function separatedPosition(position,length,separation,random){return circularPosition(position+separation+random()*(length-2*separation),length);}
// The processor owns this seeded clock. UI reads never advance it or draw randomness.
export class AmbientLoopClock {
 constructor({settings,length,sourceRate,contextRate,rate=1,startFrame=0,seed=1,volumeRange=null,outputVolumeRange=null}){
  this.settings=validateAmbientLoop(settings);if(!Number.isInteger(length)||length<2||![sourceRate,contextRate,rate].every(n=>Number.isFinite(n)&&n>0))throw Error('Ambient Loop needs at least two source frames and a valid playback rate.');
  Object.assign(this,{length,sourceRate,contextRate,rate,startFrame,volumeRange,outputVolumeRange});this.random=seededRandom(seed);this.fadeFrames=Math.max(2,Math.round(settings.crossfadeMs*contextRate/1000));this.separation=Math.min(Math.max(1,settings.separationMs*sourceRate/1000),(length-1)/2);this.pass=0;this.frozen=false;
  this.a=this.head(startFrame,Math.floor(this.random()*length),true);this.b=null;this.nextStart=startFrame+this.fadeFrames+this.a.holdFrames;
 }
 head(startFrame,offset,first=false){
  const holdMs=this.settings.minHoldMs+this.random()*(this.settings.maxHoldMs-this.settings.minHoldMs),sample=setting=>setting?(first?setting.initialDb:setting.range.minDb+this.random()*(setting.range.maxDb-setting.range.minDb)):null;
  const db=sample(this.volumeRange),outputDb=sample(this.outputVolumeRange);
  return {startFrame,offset,holdFrames:Math.round(holdMs*this.contextRate/1000),holdMs,pass:this.pass,position:offset,gain:0,db,outputDb,level:10**(((db??0)+(outputDb??0))/20)};
 }
 position(head,frame){return circularPosition(head.offset+(frame-head.startFrame)*this.sourceRate/this.contextRate*this.rate,this.length);}
 step(frame){
  if(frame<this.startFrame)return false;
  if(!this.frozen)while(frame>=this.nextStart){const at=this.nextStart;this.a=this.b??this.a;this.pass++;const offset=separatedPosition(this.position(this.a,at),this.length,this.separation,this.random);this.b=this.head(at,offset);this.nextStart=at+this.fadeFrames+this.b.holdFrames;}
  this.a.position=this.position(this.a,frame);if(this.b)this.b.position=this.position(this.b,frame);
  if(!this.frozen){if(this.b){const phase=Math.max(0,Math.min(1,(frame-this.b.startFrame)/(this.fadeFrames-1)));this.a.gain=phase===1?0:Math.cos(phase*Math.PI/2);this.b.gain=Math.sin(phase*Math.PI/2);}else this.a.gain=Math.sin(Math.max(0,Math.min(1,(frame-this.startFrame)/(this.fadeFrames-1)))*Math.PI/2);}
  return true;
 }
 freeze(frame){if(!this.frozen){this.step(frame);this.frozen=true;}}
 dominant(){return this.b&&this.b.gain>=this.a.gain?this.b:this.a;}
}
