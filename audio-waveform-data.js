import {fileEdgeFrames,fileEdgeGain} from './audio-file-edges.js';
import {fileGainAmplitude} from './audio-gain.js';
import {timelineSection,timelineSample} from './audio-crossfades.js';
import {playbackSections,audioEditKey} from './audio-edits.js';
// Bounded display data, independent of transport and authored project state.
export const peakLimits=Object.freeze({points:32768,entries:8});
// Search 5 ms around each edge: within its kept section, or on the processed timeline when fades/blends are active.
// Minimize the worst adjacent-sample amplitude across every channel; ties do not drift.
export function quietSelection(buffer,asset,selection){
 const sections=playbackSections(buffer,asset),rate=buffer.sampleRate,total=sections.at(-1).timelineEnd,edges=fileEdgeFrames(asset.edgeFades,total,rate);
 if(!selection||!Number.isFinite(selection.start)||!Number.isFinite(selection.end)||selection.start<0||selection.end<=selection.start||selection.end>total/rate+1e-9)throw new Error('Choose a selection inside the edited file.');
 const first=Math.round(selection.start*rate),last=Math.round(selection.end*rate);if(first>=last||first<0||last>total)throw new Error('Select at least one audio frame.');
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i)),radius=Math.floor(rate*.005);if(!channels.length)throw new Error('This file has no audio channels.');
 if(asset.crossfadeMs||edges){const score=at=>{let peak=0;for(const samples of channels)for(const point of [Math.max(0,at-1),Math.min(total-1,at)]){const value=timelineSample(samples,sections,point,timelineSection(sections,point))*fileEdgeGain(edges,point);if(!Number.isFinite(value))return Infinity;peak=Math.max(peak,Math.abs(value));}return peak;},edge=(frame,low,high)=>{let best=frame,value=score(frame);for(let at=low;at<=high;at++){const candidate=score(at);if(candidate<value-1e-12||candidate===value&&Math.abs(at-frame)<Math.abs(best-frame)){best=at;value=candidate;}}return best;};const start=edge(first,Math.max(0,first-radius),Math.min(last-1,first+radius)),end=edge(last,Math.max(start+1,last-radius),Math.min(total,last+radius));return {start:start/rate,end:end/rate};}
 function edge(frame,end,limit){
  const section=sections.find(s=>end?frame>s.timelineStart&&frame<=s.timelineEnd:frame>=s.timelineStart&&frame<s.timelineEnd);
  const low=Math.max(frame-radius,section.timelineStart+(end?1:0),end?limit+1:0),high=Math.min(frame+radius,section.timelineEnd-(end?0:1),end?total:limit-1);
  const score=at=>{const source=section.offsetFrame+at-section.timelineStart,a=end?source-1:source,b=end?Math.min(section.endFrame-1,source):Math.max(section.offsetFrame,source-1);let peak=0;for(const data of channels){const x=data[a],y=data[b];if(!Number.isFinite(x)||!Number.isFinite(y))return Infinity;peak=Math.max(peak,Math.abs(x),Math.abs(y));}return peak;};
  let best=frame,value=score(frame);for(let at=low;at<=high;at++){const candidate=score(at);if(candidate<value-1e-12||candidate===value&&Math.abs(at-frame)<Math.abs(best-frame)){best=at;value=candidate;}}return best;
 }
 const start=edge(first,false,last),end=edge(last,true,start);return {start:start/rate,end:end/rate};
}
export async function waveformPeaks(buffer,{trim=null,segments=null,sections:ordered=null,crossfadeMs=null,crossfadeCurve='linear',gainDb=0,edgeFades=null,current=()=>true,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0)),progress=()=>{}}={}){
 const check=()=>{if(!current())throw Object.assign(new Error('Waveform cancelled.'),{name:'AbortError'});};
 check();const gain=fileGainAmplitude(gainDb),sections=playbackSections(buffer,{trim,segments,sections:ordered,crossfadeMs,crossfadeCurve}),length=sections.at(-1).timelineEnd,edges=fileEdgeFrames(edgeFades,length,buffer.sampleRate),buckets=Math.min(length,peakLimits.points/2);
 if(!buckets||!buffer.numberOfChannels)throw new Error('This file has no audio samples.');
 const count=Math.min(2,buffer.numberOfChannels),combined=buffer.numberOfChannels>2,peaks=Array.from({length:combined?1:count},()=>new Float32Array(buckets*2));
 let scanned=0,sinceYield=0,sourcePeak=0,peak=null;const total=length*buffer.numberOfChannels;
 for(let channel=0;channel<buffer.numberOfChannels;channel++){
  const samples=buffer.getChannelData(channel),out=peaks[combined?0:channel];let sectionIndex=0;
  for(let bucket=0;bucket<buckets;bucket++){
   const start=Math.floor(bucket*length/buckets),end=Math.floor((bucket+1)*length/buckets);let low=out[bucket*2],high=out[bucket*2+1];
   let position=start;if(crossfadeMs){for(;position<end;position++){sectionIndex=timelineSection(sections,position,sectionIndex);const sample=timelineSample(samples,sections,position,sectionIndex)*fileEdgeGain(edges,position);if(Number.isFinite(sample)&&Math.abs(sample)>sourcePeak){sourcePeak=Math.abs(sample);peak={time:position/buffer.sampleRate,channel,sample};}const value=Number.isFinite(sample)?Math.max(-1,Math.min(1,sample*gain)):0;low=Math.min(low,value);high=Math.max(high,value);}}while(position<end){while(position>=sections[sectionIndex].timelineEnd)sectionIndex++;const section=sections[sectionIndex],until=Math.min(end,section.timelineEnd),source=section.offsetFrame+position-section.timelineStart;for(let i=source;i<source+until-position;i++){const sample=samples[i]*fileEdgeGain(edges,position+i-source);if(Number.isFinite(sample)&&Math.abs(sample)>sourcePeak){sourcePeak=Math.abs(sample);peak={time:(position+i-source)/buffer.sampleRate,channel,sample};}const value=Number.isFinite(sample)?Math.max(-1,Math.min(1,sample*gain)):0;low=Math.min(low,value);high=Math.max(high,value);}position=until;}
   out[bucket*2]=low;out[bucket*2+1]=high;scanned+=end-start;sinceYield+=end-start;
   if(sinceYield>=262144){check();progress(scanned/total);await yieldTask();check();sinceYield=0;}
  }
 }
 check();progress(1);return {peaks,sourcePeak,peak,gainDb,edgeFades:edges?{inMs:edges.inFrames/buffer.sampleRate*1000,outMs:edges.outFrames/buffer.sampleRate*1000}:null,duration:length/buffer.sampleRate,sourceStart:sections[0].start,sourceSections:sections.map(({start,end})=>({start,end})),joins:sections.slice(1).map(s=>s.timelineStart/buffer.sampleRate),crossfadeMs,blends:sections.filter(s=>s.fadeInFrames).map(s=>({start:s.timelineStart/buffer.sampleRate,end:(s.timelineStart+s.fadeInFrames)/buffer.sampleRate})),originalDuration:buffer.duration,sampleRate:buffer.sampleRate,length,channels:buffer.numberOfChannels,combined};
}
export function selectionBounds(start,end,data){
 if(!data||!Number.isFinite(start)||!Number.isFinite(end))return null;
 const first=Math.max(0,Math.min(data.length-1,Math.round(start*data.sampleRate))),last=Math.max(0,Math.min(data.length,Math.round(end*data.sampleRate)));
 return last>first?{start:first/data.sampleRate,end:last/data.sampleRate}:null;
}
export class WaveformCache {
 constructor(){this.entries=new Map();}
 get(id,source,editKey=''){const entry=this.entries.get(id);if(!entry||entry.source!==source||entry.editKey!==editKey){this.entries.delete(id);return null;}this.entries.delete(id);this.entries.set(id,entry);return entry.data;}
 set(id,source,data,editKey=''){this.entries.delete(id);this.entries.set(id,{source,data,editKey});while(this.entries.size>peakLimits.entries)this.entries.delete(this.entries.keys().next().value);}
 prune(assets){for(const [id,entry] of this.entries)if(!assets.some(asset=>asset.id===id&&asset.data===entry.source&&audioEditKey(asset)===entry.editKey))this.entries.delete(id);}
 clear(){this.entries.clear();}
}
