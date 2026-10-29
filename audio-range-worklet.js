import {RangeLoopClock} from './audio-range-loop.js';
class RangeVolumeProcessor extends AudioWorkletProcessor {
 static get parameterDescriptors(){return [{name:'freeze',defaultValue:0,minValue:0,maxValue:1,automationRate:'a-rate'}];}
 constructor(options){super();this.clock=options.processorOptions.range?new RangeLoopClock(options.processorOptions):null;this.outputClock=options.processorOptions.outputRange?new RangeLoopClock(options.processorOptions.outputRange):null;this.disposed=false;this.reportedPass=0;this.reportedAt=options.processorOptions.startAt;this.port.onmessage=event=>{if(event.data?.type==='dispose')this.disposed=true;};}
 process(inputs,outputs,parameters){
  if(this.disposed)return false;
  const input=inputs[0]??[],output=outputs[0]??[],frames=output[0]?.length??0,freeze=parameters.freeze;
  for(let i=0;i<frames;i++){
   const time=(currentFrame+i)/sampleRate;
   const frozen=freeze[freeze.length===1?0:i]>=0.5;this.clock?.step(time,frozen);this.outputClock?.step(time,frozen);
   for(let channel=0;channel<output.length;channel++)output[channel][i]=(input[channel]?.[i]??0)*(this.clock?.gain??1)*(this.outputClock?.gain??1);
  }
  const time=(currentFrame+Math.max(0,frames-1))/sampleRate;
  const clock=this.clock??this.outputClock;
  if(clock.pass!==this.reportedPass&&time-this.reportedAt>=1/60){this.port.postMessage({...(this.clock?{db:this.clock.db}:{}),...(this.outputClock?{outputDb:this.outputClock.db}:{}),pass:clock.pass,time:clock.changedAt});this.reportedPass=clock.pass;this.reportedAt=time;}
  return true;
 }
}
registerProcessor('lovely-volume-range',RangeVolumeProcessor);
