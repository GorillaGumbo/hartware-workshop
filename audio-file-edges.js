import {validateFadeCurve,fadeCurveGain} from './audio-fade-curves.js';
// File-relative linear or equal-power fades, evaluated after section/crossfade mixing and before file gain.
export const maxFileFadeMs=60000;
export function validateFileEdges(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['inMs','outMs','inCurve','outCurve'].includes(key))||![value.inMs,value.outMs].every(ms=>Number.isInteger(ms)&&ms>=0&&ms<=maxFileFadeMs))throw new Error('File fades need whole milliseconds from 0 to 60000 for each edge.');
 for(const key of ['inCurve','outCurve'])if(Object.hasOwn(value,key))validateFadeCurve(value[key]);
 return {inMs:value.inMs,outMs:value.outMs,...(value.inCurve==='equal-power'?{inCurve:value.inCurve}:{}),...(value.outCurve==='equal-power'?{outCurve:value.outCurve}:{})};
}
export function fileEdgeFrames(value,length,rate){if(!value)return null;const curves=validateFileEdges(value);return {...(curves.inCurve?{inCurve:curves.inCurve}:{}),...(curves.outCurve?{outCurve:curves.outCurve}:{}),length,inFrames:Math.min(length,Math.round(value.inMs*rate/1000)),outFrames:Math.min(length,Math.round(value.outMs*rate/1000))};}
export function fileEdgeGain(edges,frame){
 if(!edges)return 1;if(frame<0||frame>=edges.length)return 0;let gain=1;
 if(edges.inFrames)gain*=edges.inFrames===1?(frame<1?0:1):fadeCurveGain(frame/(edges.inFrames-1),edges.inCurve);
 if(edges.outFrames)gain*=edges.outFrames===1?(frame>=edges.length-1?0:1):fadeCurveGain((edges.length-1-frame)/(edges.outFrames-1),edges.outCurve);
 return gain;
}
export function nativeEdgeGain(config,time){const frame=(time-config.startAt)*config.sourceRate*config.rate;if(frame<0)return 0;let relative=frame%config.selectionLength;if(relative<1e-7||config.selectionLength-relative<1e-7)relative=0;return fileEdgeGain(config.edges,config.offsetFrame+relative);}
