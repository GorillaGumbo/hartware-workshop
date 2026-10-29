import {validateVolumeRange,sampleVolumeDb,dbToGain} from './audio-range.js';
// Runs on the audio clock. Rendering a frame or querying UI state never draws.
export class RangeLoopClock {
 constructor({range,initialDb,startAt,duration,plays},random=Math.random){
  this.range=validateVolumeRange(range);
  if(!Number.isFinite(initialDb)||initialDb<this.range.minDb||initialDb>this.range.maxDb||!Number.isFinite(startAt)||!Number.isFinite(duration)||duration<=0||!(plays===Infinity||Number.isInteger(plays)&&plays>=1))throw new Error('Invalid range playback clock.');
  this.db=initialDb;this.gain=dbToGain(initialDb);this.startAt=startAt;this.duration=duration;this.plays=plays;this.pass=0;this.random=random;this.frozen=false;this.changedAt=startAt;
 }
 step(time,freeze=false){
  if(freeze)this.frozen=true;
  if(this.frozen||time<this.startAt||time>=this.startAt+this.duration*this.plays)return false;
  const pass=Math.floor((time-this.startAt)/this.duration+1e-9);let changed=false;
  while(this.pass<pass){this.pass++;this.db=sampleVolumeDb(this.range,this.random);this.gain=dbToGain(this.db);this.changedAt=this.startAt+this.pass*this.duration;changed=true;}
  return changed;
 }
}
