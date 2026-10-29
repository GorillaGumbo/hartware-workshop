import {validateFadeCurve} from './audio-fade-curves.js';
import {validateFileEdges} from './audio-file-edges.js';
import {validateFileGain} from './audio-gain.js';
import {validateCrossfade,crossfadeSections,clipCrossfadeSections} from './audio-crossfades.js';
// Authored seconds refer to immutable original audio. No PCM copies or edit history serialize.
export const trimKey=trim=>trim?`${trim.start}:${trim.end}`:'';
export const maxAudioSections=64;
const recipeKey=asset=>asset?.sections?'o:'+asset.sections.map(trimKey).join(','):asset?.segments?'s:'+asset.segments.map(trimKey).join(','):trimKey(asset?.trim);
export const audioEditKey=asset=>recipeKey(asset)+(asset?.crossfadeMs?`|x:${asset.crossfadeMs}:${asset.editSampleRate??''}:${asset.crossfadeCurve??'linear'}`:'')+(asset?.gainDb?`|g:${asset.gainDb}`:'')+(asset?.edgeFades?`|e:${asset.edgeFades.inMs}:${asset.edgeFades.outMs}:${asset.edgeFades.inCurve??'linear'}:${asset.edgeFades.outCurve??'linear'}`:'');
export function validateTrim(trim,duration){
 if(!trim||typeof trim!=='object'||Array.isArray(trim)||Object.keys(trim).length!==2||Object.keys(trim).some(key=>!['start','end'].includes(key))||!Number.isFinite(duration)||duration<=0||!Number.isFinite(trim.start)||!Number.isFinite(trim.end)||trim.start<0||trim.end<=trim.start||trim.end>duration)throw new Error('Trim needs start/end seconds inside the original recording.');
 return {start:trim.start,end:trim.end};
}
export function fileSpan(buffer,trim=null){
 const rate=buffer.sampleRate??48000,total=buffer.length??Math.round(buffer.duration*rate);
 if(trim)validateTrim(trim,buffer.duration+1/rate);
 const first=trim?Math.max(0,Math.min(total-1,Math.round(trim.start*rate))):0,last=trim?Math.max(first+1,Math.min(total,Math.round(trim.end*rate))):total;
 return {start:first/rate,end:trim?last/rate:buffer.duration,duration:trim?(last-first)/rate:buffer.duration,offsetFrame:first,endFrame:last,length:last-first};
}
export function validateSections(sections,duration){
 if(!Array.isArray(sections)||!sections.length||sections.length>maxAudioSections)throw new Error(`Keep between 1 and ${maxAudioSections} audio sections.`);
 let end=0;for(const section of sections){validateTrim(section,duration);if(section.start<end)throw new Error('Audio sections must follow the original order without overlap.');end=section.end;}return sections.map(section=>({...section}));
}
export function validateAudioOrder(sections,duration){
 if(!Array.isArray(sections)||!sections.length||sections.length>maxAudioSections)throw new Error(`Keep between 1 and ${maxAudioSections} audio sections.`);
 const result=Array.from(sections,section=>validateTrim(section,duration)),sorted=[...result].sort((a,b)=>a.start-b.start);for(let i=1;i<sorted.length;i++)if(sorted[i].start<sorted[i-1].end)throw new Error('Audio sections cannot overlap or repeat original samples.');return result;
}
export function sourceSections(asset,duration=asset.duration){if([asset.trim,asset.segments,asset.sections].filter(Boolean).length>1)throw new Error('Use one audio edit recipe.');return asset.sections?validateAudioOrder(asset.sections,duration):asset.segments?validateSections(asset.segments,duration):[asset.trim?validateTrim(asset.trim,duration):{start:0,end:duration}];}
export function setAudioRecipe(asset,recipe){delete asset.trim;delete asset.segments;delete asset.sections;if(Array.isArray(recipe)){const chronological=recipe.every((s,i)=>!i||s.start>=recipe[i-1].end);asset[chronological?'segments':'sections']=recipe.map(s=>({...s}));}else if(recipe)asset.trim={...recipe};}
export function fileSections(buffer,asset={}){
 const ranges=sourceSections(asset,buffer.duration+1/(buffer.sampleRate??48000)),frames=[];
 for(const range of ranges){const span=fileSpan(buffer,asset.trim||asset.segments||asset.sections?range:null),last=frames.at(-1);if(last&&span.offsetFrame>=last.offsetFrame&&span.offsetFrame<=last.endFrame){last.endFrame=Math.max(last.endFrame,span.endFrame);last.end=last.endFrame/(buffer.sampleRate??48000);last.length=last.endFrame-last.offsetFrame;last.duration=last.end-last.start;}else frames.push({...span});}
 let length=0;for(const span of frames){span.timelineStart=length;length+=span.length;span.timelineEnd=length;}return frames;
}
export function selectSections(sections,start,end,remove=false){
 const duration=sections.reduce((n,s)=>n+s.end-s.start,0);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>duration+1e-9)throw new Error('Select audio inside the edited file.');
 const result=[];let offset=0;
 for(const section of sections){const length=section.end-section.start,first=Math.max(0,Math.min(length,start-offset)),last=Math.max(0,Math.min(length,end-offset));if(remove){if(first>1e-9)result.push({start:section.start,end:section.start+first});if(length-last>1e-9)result.push({start:section.start+last,end:section.end});}else if(last-first>1e-9)result.push({start:section.start+first,end:section.start+last});offset+=length;}
 if(!result.length)throw new Error('Keep some audio in the file.');return result;
}
export function sectionRecipe(sections,duration){
 const merged=[];for(const section of sections){const previous=merged.at(-1);if(previous&&Math.abs(previous.end-section.start)<1e-9)previous.end=section.end;else merged.push({...section});}validateAudioOrder(merged,duration);
 if(merged.length===1){const only=merged[0];return only.start===0&&only.end===duration?null:only;}return merged;
}
export function splitAndSwap(sections,point,duration){const length=sections.reduce((n,s)=>n+s.end-s.start,0);if(!Number.isFinite(point)||point<=0||point>=length)throw new Error('Choose a split point inside the edited file.');return sectionRecipe([...selectSections(sections,point,length),...selectSections(sections,0,point)],duration);}
export function playbackSections(buffer,asset={},selection=null){
 const raw=fileSections(buffer,asset),spans=asset.crossfadeMs?crossfadeSections(raw,buffer.sampleRate,asset.crossfadeMs,asset.crossfadeCurve):raw,duration=spans.at(-1).timelineEnd/buffer.sampleRate;if(!selection)return spans;
 if(!Number.isFinite(selection.start)||!Number.isFinite(selection.end)||selection.start<0||selection.end<=selection.start||selection.end>duration+1e-9)throw new Error('Choose a selection inside the recording.');
 if(asset.crossfadeMs)return clipCrossfadeSections(spans,Math.round(selection.start*buffer.sampleRate),Math.round(selection.end*buffer.sampleRate));
 return fileSections(buffer,{sections:selectSections(spans.map(({start,end})=>({start,end})),selection.start,selection.end)});
}
// A rolling join edit uses available source handles. A circular pair instead rolls
// its shared outer split: the original end/start seam stays intact inside the loop.
function joinMovePlan(asset,rate,index){
 if(!asset.crossfadeMs||!Number.isInteger(rate)||rate<1||rate>768000)throw new Error('Choose an active crossfade.');
 const total=Math.round(asset.duration*rate),raw=fileSections({duration:asset.duration,length:total,sampleRate:rate},asset),mixed=crossfadeSections(raw,rate,asset.crossfadeMs);
 if(!Number.isInteger(index)||index<0||index>=raw.length-1)throw new Error('Choose an internal crossfade.');
 const left=raw[index],right=raw[index+1],a=mixed[index],b=mixed[index+1];if(!b.fadeInFrames)throw new Error('This join is too short to blend.');
 const circular=left.offsetFrame===right.endFrame||left.endFrame===total&&right.offsetFrame===0,minLeft=Math.max(2,2*a.fadeInFrames,2*a.fadeOutFrames),minRight=Math.max(2,2*b.fadeInFrames,2*b.fadeOutFrames);
 let min=minLeft-left.length,max=right.length-minRight;
 if(circular){min=Math.max(min,right.endFrame-total);max=Math.min(max,left.offsetFrame);}
 else{min=Math.max(min,-right.offsetFrame);max=Math.min(max,total-left.endFrame);}
 for(let i=0;i<raw.length;i++){if(i===index||i===index+1)continue;const other=raw[i];
  if(circular){if(other.endFrame<=left.offsetFrame)max=Math.min(max,left.offsetFrame-other.endFrame);if(other.offsetFrame>=right.endFrame)min=Math.max(min,right.endFrame-other.offsetFrame);}
  else{if(other.offsetFrame>=left.endFrame)max=Math.min(max,other.offsetFrame-left.endFrame);if(other.endFrame<=right.offsetFrame)min=Math.max(min,other.endFrame-right.offsetFrame);}
 }
 return {raw,index,circular,min,max,rate};
}
export function crossfadeJoinLimits(asset,rate,index){const p=joinMovePlan(asset,rate,index);return {min:p.min/rate,max:p.max/rate,circular:p.circular};}
export function moveCrossfadeJoin(asset,rate,index,seconds){
 const p=joinMovePlan(asset,rate,index),delta=Math.round(seconds*rate);if(!Number.isFinite(seconds)||delta<p.min||delta>p.max)throw new Error('The crossfade cannot move beyond the available source audio.');
 const ranges=p.raw.map(s=>({start:s.offsetFrame/rate,end:s.endFrame/rate}));
 if(p.circular){ranges[index].start=(p.raw[index].offsetFrame-delta)/rate;ranges[index+1].end=(p.raw[index+1].endFrame-delta)/rate;}
 else{ranges[index].end=(p.raw[index].endFrame+delta)/rate;ranges[index+1].start=(p.raw[index+1].offsetFrame+delta)/rate;}
 validateAudioOrder(ranges,asset.duration);return ranges;
}
export function editedDuration(asset){if(asset.crossfadeMs&&asset.editSampleRate){const rate=asset.editSampleRate,spans=playbackSections({duration:asset.duration,length:Math.round(asset.duration*rate),sampleRate:rate},asset);return spans.at(-1).timelineEnd/rate;}return (asset.sections??asset.segments??[asset.trim??{start:0,end:asset.duration}]).reduce((n,s)=>n+s.end-s.start,0);}
const capture=asset=>({trim:asset.trim?{...asset.trim}:null,segments:asset.segments?.map(s=>({...s}))??null,sections:asset.sections?.map(s=>({...s}))??null,edgeFades:asset.edgeFades?{...asset.edgeFades}:null,gainDb:asset.gainDb??null,crossfadeMs:asset.crossfadeMs??null,crossfadeCurve:asset.crossfadeCurve??null,editSampleRate:asset.editSampleRate??null,duration:asset.duration??null});
const same=(a,b)=>audioEditKey(a)===audioEditKey(b)&&a.duration===b.duration;
function apply(asset,value){if(value.edgeFades)asset.edgeFades={...value.edgeFades};else delete asset.edgeFades;for(const key of ['gainDb','crossfadeMs','crossfadeCurve','editSampleRate']){if(value[key]!==null)asset[key]=value[key];else delete asset[key];}for(const key of ['trim','segments','sections']){if(value[key])asset[key]=Array.isArray(value[key])?value[key].map(s=>({...s})):{...value[key]};else delete asset[key];}if(value.duration!==null)asset.duration=value.duration;else delete asset.duration;}
export class AudioEditHistory {
 constructor(limit=50){this.limit=limit;this.entries=new Map();}
 entry(asset){let entry=this.entries.get(asset.id);if(!entry||entry.source!==asset.data){entry={source:asset.data,undo:[],redo:[]};this.entries.set(asset.id,entry);}return entry;}
 status(asset){const entry=this.entry(asset);return {undo:entry.undo.length>0,redo:entry.redo.length>0};}
 change(asset,recipe,duration=asset.duration,{restore=false}={}){if(recipe){if(Array.isArray(recipe))validateAudioOrder(recipe,duration);else validateTrim(recipe,duration);}const before=capture(asset),candidate={duration,...(!restore&&asset.edgeFades?{edgeFades:{...asset.edgeFades}}:{}),...(!restore&&asset.gainDb?{gainDb:asset.gainDb}:{})};setAudioRecipe(candidate,recipe);const next=capture(candidate);if(same(before,next))return false;const entry=this.entry(asset);entry.undo.push(before);if(entry.undo.length>this.limit)entry.undo.shift();entry.redo=[];apply(asset,next);return true;}
 crossfade(asset,milliseconds,rate,curve=asset.crossfadeCurve??'linear'){if(milliseconds!==null){validateFadeCurve(curve);validateCrossfade(milliseconds);if(!Number.isInteger(rate)||rate<1||rate>768000)throw new Error('Audio sample rate is invalid.');if(sourceSections(asset).length<2)throw new Error('Create an internal join before adding a crossfade.');}const before=capture(asset),next={...before,crossfadeMs:milliseconds,crossfadeCurve:milliseconds!==null&&curve==='equal-power'?curve:null,editSampleRate:milliseconds===null?null:rate};if(same(before,next))return false;const entry=this.entry(asset);entry.undo.push(before);if(entry.undo.length>this.limit)entry.undo.shift();entry.redo=[];apply(asset,next);return true;}
 moveJoin(asset,index,seconds,rate){if(Number.isFinite(seconds)&&Math.round(seconds*rate)===0)return false;const ranges=moveCrossfadeJoin(asset,rate,index,seconds),before=capture(asset),candidate={...before};setAudioRecipe(candidate,ranges);const next=capture(candidate);if(same(before,next))return false;const entry=this.entry(asset);entry.undo.push(before);if(entry.undo.length>this.limit)entry.undo.shift();entry.redo=[];apply(asset,next);return true;}
 gain(asset,value){validateFileGain(value);const before=capture(asset),gainDb=Math.abs(value)<1e-6?null:value;if(Math.abs((before.gainDb??0)-(gainDb??0))<1e-6)return false;const next={...before,gainDb},entry=this.entry(asset);entry.undo.push(before);if(entry.undo.length>this.limit)entry.undo.shift();entry.redo=[];apply(asset,next);return true;}
 edges(asset,value){const valid=validateFileEdges(value),before=capture(asset),next={...before,edgeFades:valid.inMs||valid.outMs?valid:null};if(same(before,next))return false;const entry=this.entry(asset);entry.undo.push(before);if(entry.undo.length>this.limit)entry.undo.shift();entry.redo=[];apply(asset,next);return true;}
 move(asset,direction){const entry=this.entry(asset),from=entry[direction],to=entry[direction==='undo'?'redo':'undo'];if(!from.length)return false;to.push(capture(asset));apply(asset,from.pop());return true;}
 prune(assets){for(const [id,entry] of this.entries)if(!assets.some(asset=>asset.id===id&&asset.data===entry.source))this.entries.delete(id);}
 forget(id){this.entries.delete(id);}
 clear(){this.entries.clear();}
}
