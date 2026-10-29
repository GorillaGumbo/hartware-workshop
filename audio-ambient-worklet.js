import {AmbientLoopClock} from './audio-ambient.js';
import {timelineSection,timelineSample} from './audio-crossfades.js';
import {fileEdgeGain} from './audio-file-edges.js';
class AmbientLoopProcessor extends AudioWorkletProcessor {
 static get parameterDescriptors(){return [{name:'freeze',defaultValue:0,minValue:0,maxValue:1,automationRate:'a-rate'},{name:'stopAt',defaultValue:1e12,minValue:0,maxValue:1e12,automationRate:'a-rate'}];}
 constructor(options){super();this.config=options.processorOptions;this.file=this.config.file;this.clock=null;this.disposed=false;this.lastReport=-Infinity;this.port.onmessage=event=>{if(event.data?.type==='dispose'){this.disposed=true;this.clock=null;this.file=null;}else if(!this.disposed&&event.data?.type==='start'&&!this.clock)this.clock=new AmbientLoopClock({...this.config,length:this.file.sections.at(-1).timelineEnd,sourceRate:this.file.sampleRate,contextRate:sampleRate,startFrame:Math.round(event.data.startAt*sampleRate)});};this.port.postMessage({type:'ready'});}
 process(inputs,outputs,parameters){
  if(this.disposed)return false;if(!this.clock)return true;const output=outputs[0]??[],frames=output[0]?.length??0,clock=this.clock,file=this.file;
  for(let i=0;i<frames;i++){
   const frame=currentFrame+i,time=frame/sampleRate;
   if(time>=parameters.stopAt[parameters.stopAt.length===1?0:i]){this.port.postMessage({type:'ended'});return false;}
   if(parameters.freeze[parameters.freeze.length===1?0:i]>=.5)clock.freeze(frame);
   if(!clock.step(frame))continue;
   // Exactly two primary readheads, sharing the same immutable channel arrays.
   for(let slot=0;slot<2;slot++){const head=slot?clock.b:clock.a;if(!head||!head.gain)continue;const at=timelineSection(file.sections,head.position,head.sectionCursor??0);head.sectionCursor=at;const gain=head.gain*head.level*file.gain*fileEdgeGain(file.edges,head.position);
    for(let channel=0;channel<output.length;channel++){const samples=file.channels[Math.min(channel,file.channels.length-1)];output[channel][i]+=timelineSample(samples,file.sections,head.position,at)*gain;}
   }
  }
  const frame=currentFrame+Math.max(0,frames-1),time=frame/sampleRate;
  if(frame>=clock.startFrame&&time-this.lastReport>=1/30){const head=clock.dominant();this.port.postMessage({type:'state',time,pass:head.pass,position:head.position/file.sampleRate,holdMs:head.holdMs,db:head.db,outputDb:head.outputDb,separationMs:clock.separation/file.sampleRate*1000});this.lastReport=time;}
  return true;
 }
}
registerProcessor('lovely-ambient-loop',AmbientLoopProcessor);
