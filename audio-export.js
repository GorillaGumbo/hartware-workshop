import {playbackSections} from './audio-edits.js';
import {timelineSection,timelineSample} from './audio-crossfades.js';
import {fileEdgeFrames,fileEdgeGain} from './audio-file-edges.js';
import {fileGainAmplitude} from './audio-gain.js';

// Portable PCM16 files, rendered from the same immutable-source recipe as playback.
// The output budget is additional to the existing decoded-PCM budget.
export const maxAudioExportBytes=64*1024*1024;
export function wavFileName(name,used=new Set()){
 let base=String(name).replace(/\.[^.]*$/,'').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/^[. ]+|[. ]+$/g,'').slice(0,120).replace(/[. ]+$/g,'')||'sound';
 if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base))base='sound-'+base;
 let value=base+'.wav',n=2;while(used.has(value.toLowerCase()))value=`${base}-${n++}.wav`;used.add(value.toLowerCase());return value;
}
export function wavExportPlan(buffer,asset={}){
 const rate=buffer.sampleRate,channels=buffer.numberOfChannels;
 if(!Number.isInteger(rate)||rate<1||rate>768000||![1,2].includes(channels))throw new Error('WAV export supports mono or stereo audio.');
 const sections=playbackSections(buffer,asset),length=sections.at(-1).timelineEnd,bytes=44+length*channels*2;
 if(!Number.isSafeInteger(length)||length<1||bytes>maxAudioExportBytes)throw new Error('Export is limited to 64 MiB of WAV data. Create a shorter sound first.');
 return {rate,channels,sections,length,bytes};
}
export async function renderAudioWav(buffer,asset={},options={}){
 const {current=()=>true,progress=()=>{},yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}=options;
 const check=()=>{if(!current())throw Object.assign(new Error('Audio export cancelled.'),{name:'AbortError'});};check();
 const {rate,channels,sections,length,bytes}=wavExportPlan(buffer,asset),edges=fileEdgeFrames(asset.edgeFades,length,rate),gain=fileGainAmplitude(asset.gainDb??0);
 const data=new ArrayBuffer(bytes),view=new DataView(data),text=(at,value)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
 text(0,'RIFF');view.setUint32(4,bytes-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,rate,true);view.setUint32(28,rate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,bytes-44,true);
 const samples=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let index=0,at=44;
 for(let frame=0;frame<length;frame++){
  index=timelineSection(sections,frame,index);const level=fileEdgeGain(edges,frame)*gain;
  for(let channel=0;channel<channels;channel++){
   const sample=timelineSample(samples[channel],sections,frame,index)*level;
   if(!Number.isFinite(sample))throw new Error('This sound contains invalid audio samples.');
   if(Math.abs(sample)>1+1e-7)throw new Error('This export would clip. Normalize the sound or reduce its file gain, then export again.');
   view.setInt16(at,Math.round(Math.max(-1,Math.min(1,sample))*(sample<0?32768:32767)),true);at+=2;
  }
  if((frame+1)%16384===0){check();progress((frame+1)/length);await yieldTask();check();}
 }
 check();progress(1);return new Blob([data],{type:'audio/wav'});
}
