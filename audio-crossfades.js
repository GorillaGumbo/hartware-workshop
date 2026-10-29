import {validateFadeCurve,fadeCurveGain} from './audio-fade-curves.js';
// Linear or equal-power overlap crossfades. Original PCM stays shared; only frame recipes are built.
export const maxCrossfadeMs=60000;
export function validateCrossfade(value){if(!Number.isInteger(value)||value<1||value>maxCrossfadeMs)throw new Error(`Crossfade needs a whole number from 1 to ${maxCrossfadeMs} ms.`);return value;}
export function crossfadeSections(sections,rate,milliseconds,curve='linear'){
 validateCrossfade(milliseconds);validateFadeCurve(curve);const result=sections.map(s=>({...s}));let end=0;
 for(let i=0;i<result.length;i++){
  const s=result[i],previous=result[i-1];if(curve!=='linear')s.fadeCurve=curve;let overlap=previous?Math.min(Math.round(milliseconds*rate/1000),Math.floor(previous.length/2),Math.floor(s.length/2)):0;if(overlap<2)overlap=0;
  s.timelineStart=end-overlap;s.timelineEnd=s.timelineStart+s.length;s.fadeInFrames=overlap;s.fadeInStart=s.timelineStart;s.fadeOutFrames=0;s.fadeOutStart=s.timelineEnd;
  if(previous){previous.fadeOutFrames=overlap;previous.fadeOutStart=s.timelineStart;}end=s.timelineEnd;
 }
 return result;
}
export function clipCrossfadeSections(sections,first,last){
 return sections.filter(s=>s.timelineEnd>first&&s.timelineStart<last).map(s=>{const start=Math.max(first,s.timelineStart),end=Math.min(last,s.timelineEnd),offsetFrame=s.offsetFrame+start-s.timelineStart,endFrame=s.endFrame-(s.timelineEnd-end);return {...s,offsetFrame,endFrame,length:endFrame-offsetFrame,timelineStart:start-first,timelineEnd:end-first,fadeInStart:s.fadeInStart-first,fadeOutStart:s.fadeOutStart-first};});
}
// Find the latest starting section; its predecessor can still be fading out.
export function timelineSection(sections,frame,hint=0){let at=hint;if(!sections[at]||frame<sections[at].timelineStart||at+1<sections.length&&frame>=sections[at+1].timelineStart){let low=0,high=sections.length-1;while(low<high){const mid=(low+high+1)>>1;if(sections[mid].timelineStart<=frame)low=mid;else high=mid-1;}at=low;}return at;}
export function timelineSample(samples,sections,frame,index){
 let result=0;for(let at=Math.max(0,index-1);at<=index;at++){
  const s=sections[at];if(frame<s.timelineStart||frame>=s.timelineEnd)continue;
  const position=s.offsetFrame+frame-s.timelineStart,first=Math.min(s.endFrame-1,Math.floor(position)),fraction=position-first,a=samples[first]??0,b=samples[Math.min(s.endFrame-1,first+1)]??0;
  let gain=1;if(s.fadeInFrames)gain*=fadeCurveGain((frame-s.fadeInStart)/(s.fadeInFrames-1),s.fadeCurve);if(s.fadeOutFrames)gain*=fadeCurveGain(1-(frame-s.fadeOutStart)/(s.fadeOutFrames-1),s.fadeCurve);
  result+=(a+(b-a)*fraction)*gain;
 }return result;
}
