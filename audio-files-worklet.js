import {fileEdgeGain} from './audio-file-edges.js';
import {timelineSection,timelineSample} from './audio-crossfades.js';
import {FilePlaybackClock} from './audio-files.js';
class FileSelectionProcessor extends AudioWorkletProcessor {
 static get parameterDescriptors(){return [{name:'freeze',defaultValue:0,minValue:0,maxValue:1,automationRate:'a-rate'},{name:'stopAt',defaultValue:1e12,minValue:0,maxValue:1e12,automationRate:'a-rate'}];}
 constructor(options){super();const config=options.processorOptions;this.config=config;this.files=new Map(config.files.map(file=>[file.id,file]));this.clock=config.deferStart?null:new FilePlaybackClock(config);this.disposed=false;this.lastPass=-1;this.lastReport=-Infinity;this.port.onmessage=event=>{if(event.data?.type==='dispose')this.disposed=true;else if(!this.disposed&&event.data?.type==='start')this.clock=new FilePlaybackClock({...this.config,startAt:event.data.startAt});};if(config.deferStart)this.port.postMessage({type:'ready'});}
 process(inputs,outputs,parameters){
  if(this.disposed)return false;if(!this.clock)return true;const output=outputs[0]??[],frames=output[0]?.length??0;
  for(let i=0;i<frames;i++){
   const time=(currentFrame+i)/sampleRate,stop=parameters.stopAt[parameters.stopAt.length===1?0:i];
   if(time>=stop){this.port.postMessage({type:'ended'});return false;}
   if(parameters.freeze[parameters.freeze.length===1?0:i]>=.5)this.clock.freeze(time);
   const record=this.clock.step(time);if(!record){if(this.clock.ended){this.port.postMessage({type:'ended'});return false;}continue;}
   const file=this.files.get(record.id),relative=Math.max(0,(time-record.startAt)*file.sampleRate*this.clock.rate);const sections=file.sections;
   const at=sections?timelineSection(sections,relative,file.sectionCursor??0):0;if(sections)file.sectionCursor=at;
   const values=this.clock.values(),db=(values.db??0)+(values.outputDb??0);if(db!==this.gainDb){this.gainDb=db;this.gain=10**(db/20);}const gain=this.gain*(file.gain??1)*fileEdgeGain(file.edges,relative+(file.edgeOffsetFrame??0));
   for(let channel=0;channel<output.length;channel++){const data=file.channels[Math.min(channel,file.channels.length-1)];if(sections)output[channel][i]=timelineSample(data,sections,relative,at)*gain;else{const position=(file.offsetFrame??0)+relative,index=Math.floor(position),fraction=position-index,last=(file.endFrame??data.length)-1,a=data[Math.min(index,last)]??0,b=data[Math.min(index+1,last)]??0;output[channel][i]=(a+(b-a)*fraction)*gain;}}
  }
  const time=(currentFrame+Math.max(0,frames-1))/sampleRate;
  if(this.clock.pass!==this.lastPass&&time-this.lastReport>=1/60){this.port.postMessage({type:'pass',pass:this.clock.pass});this.lastPass=this.clock.pass;this.lastReport=time;}
  return true;
 }
}
registerProcessor('lovely-file-selection',FileSelectionProcessor);
