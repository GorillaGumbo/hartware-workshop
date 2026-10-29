// Existing volume curves, with preset or per-play durations. No automation or DSP processors.
export const shapeCurves=[{id:'linear',label:'Straight',technical:'Linear'},{id:'logarithmic',label:'Rounded',technical:'Logarithmic'},{id:'smooth',label:'Smooth',technical:'S-curve'}];
export const shapeSpeeds=[{id:'fast',label:'Fast',seconds:0.1},{id:'medium',label:'Medium',seconds:0.5},{id:'slow',label:'Slow',seconds:2}];
export function shapeSettings(value){return {enabled:value?.enabled===true,curve:shapeCurves.some(x=>x.id===value?.curve)?value.curve:'smooth',speed:shapeSpeeds.some(x=>x.id===value?.speed)?value.speed:'medium',...(Number.isFinite(value?.duration)&&value.duration>0?{duration:value.duration}:{})};}
export const shapeDuration=settings=>settings.duration??shapeSpeeds.find(x=>x.id===settings.speed)?.seconds??0.5;
export function shapeValue(curve,time){const t=Math.max(0,Math.min(1,time));return curve==='logarithmic'?Math.log1p(9*t)/Math.log(10):curve==='smooth'?t*t*(3-2*t):t;}
export function shapeSamples(curve,from=0,to=1){return Float32Array.from({length:128},(_,i)=>from+(to-from)*shapeValue(curve,i/127));}
// Match Web Audio's linear interpolation between the scheduled curve samples.
export function sampleEnvelope(envelope,time){if(!envelope)return 1;const index=Math.max(0,Math.min(127,(time-envelope.start)/envelope.duration*127)),lo=Math.floor(index),hi=Math.min(127,lo+1);return envelope.values[lo]+(envelope.values[hi]-envelope.values[lo])*(index-lo);}
