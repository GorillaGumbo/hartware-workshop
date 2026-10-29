import {FadeClock} from './audio-fades.js';
class FadeProcessor extends AudioWorkletProcessor {
 static get parameterDescriptors(){return [{name:'releaseAt',defaultValue:1e12,minValue:0,maxValue:1e12,automationRate:'a-rate'}];}
 constructor(options){super();this.clock=new FadeClock(options.processorOptions);this.disposed=false;this.port.onmessage=event=>{if(event.data?.type==='dispose')this.disposed=true;};}
 process(inputs,outputs,parameters){
  if(this.disposed)return false;const input=inputs[0]??[],output=outputs[0]??[],frames=output[0]?.length??0;
  for(let i=0;i<frames;i++){const time=(currentFrame+i)/sampleRate,releaseAt=parameters.releaseAt[parameters.releaseAt.length===1?0:i],gain=this.clock.gainAt(time,releaseAt>=1e12?Infinity:releaseAt);for(let channel=0;channel<output.length;channel++)output[channel][i]=(input[Math.min(channel,input.length-1)]?.[i]??0)*gain;}
  return true;
 }
}
registerProcessor('lovely-fade',FadeProcessor);
