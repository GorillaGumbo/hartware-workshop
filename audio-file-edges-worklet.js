import {nativeEdgeGain} from './audio-file-edges.js';
class FileEdgeProcessor extends AudioWorkletProcessor {
 constructor(options){super();this.config=options.processorOptions;this.disposed=false;this.port.onmessage=event=>{if(event.data?.type==='dispose')this.disposed=true;};}
 process(inputs,outputs){if(this.disposed)return false;const input=inputs[0]??[],output=outputs[0]??[],frames=output[0]?.length??0;for(let i=0;i<frames;i++){const gain=nativeEdgeGain(this.config,(currentFrame+i)/sampleRate);for(let channel=0;channel<output.length;channel++)output[channel][i]=(input[Math.min(channel,input.length-1)]?.[i]??0)*gain;}return true;}
}
registerProcessor('lovely-file-edges',FileEdgeProcessor);
