import {defaultVolumeRange,validateVolumeRange} from './audio-range.js';
import {defaultPitchRange,validatePitchRange} from './audio-pitch.js';
// Controls describe their units/range; a Random Range instance has no fixed type.
export const maxRandomRanges=32;
export const rangeControls=Object.freeze([
 Object.freeze({id:'sound-volume',node:'sound',handle:'volume',label:'Sound volume',parameter:'volume',unit:'dB',legacy:'volumeRange',legacyId:'volume-range',defaults:defaultVolumeRange,validate:validateVolumeRange}),
 Object.freeze({id:'sound-pitch',node:'sound',handle:'pitch',label:'Sound pitch',parameter:'pitch',unit:'semitones',legacy:'pitchRange',legacyId:'pitch-range',defaults:defaultPitchRange,validate:validatePitchRange}),
 Object.freeze({id:'output-volume',node:'output',handle:'volume',label:'Output volume',parameter:'volume',unit:'dB',legacy:'outputVolumeRange',legacyId:'output-volume-range',defaults:defaultVolumeRange,validate:validateVolumeRange})
]);
export const rangeControl=id=>rangeControls.find(control=>control.id===id);
export const legacyRangeKeys=rangeControls.flatMap(control=>[control.legacy,control.legacy+'Connected',control.legacy+'Position']);
export function validateModulePosition(position){
 if(!position||typeof position!=='object'||Array.isArray(position)||Object.keys(position).some(key=>!['x','y'].includes(key))||!Number.isFinite(position.x)||!Number.isFinite(position.y)||Math.abs(position.x)>10000||Math.abs(position.y)>10000)throw new Error('Random Range needs a finite canvas position between −10000 and 10000.');
 return {x:position.x,y:position.y};
}
export function validateRandomRanges(modules){
 if(!Array.isArray(modules)||modules.length>maxRandomRanges)throw new Error(`Use at most ${maxRandomRanges} Random Range modules.`);
 const ids=new Set(),targets=new Set();
 return modules.map(module=>{
  if(!module||typeof module!=='object'||Array.isArray(module)||Object.keys(module).some(key=>!['id','target','parameter','range','position'].includes(key))||typeof module.id!=='string'||!/^(?:random-range-\d+|volume-range|pitch-range|output-volume-range)$/.test(module.id)||module.id.length>80||ids.has(module.id))throw new Error('Random Range needs a unique module id and authored settings only.');
  ids.add(module.id);const control=rangeControl(module.target);
  if(module.target!==null&&(!control||targets.has(module.target)))throw new Error('Each Random Range needs a compatible, available control.');
  if(module.target!==null)targets.add(module.target);
  if(![null,'volume','pitch'].includes(module.parameter)||control&&control.parameter!==module.parameter||module.parameter===null&&(module.target!==null||Object.hasOwn(module,'range'))||module.parameter!==null&&!Object.hasOwn(module,'range'))throw new Error('Random Range units must match its connected control.');
  const result={id:module.id,target:module.target,parameter:module.parameter};
  if(module.parameter!==null)result.range=(module.parameter==='pitch'?validatePitchRange:validateVolumeRange)(module.range);
  if(Object.hasOwn(module,'position'))result.position=validateModulePosition(module.position);
  return result;
 });
}
// Read old project fields without mutating or dirtying the project on Open/render.
export function randomRangeModules(audio){
 if(!audio)return [];
 if(Array.isArray(audio.randomRanges))return audio.randomRanges;
 return rangeControls.filter(control=>audio[control.legacy]).map(control=>({id:control.legacyId,target:audio[control.legacy+'Connected']===false?null:control.id,parameter:control.parameter,range:{...audio[control.legacy]},...(audio[control.legacy+'Position']?{position:{...audio[control.legacy+'Position']}}:{})}));
}
export const connectedRange=(audio,target)=>randomRangeModules(audio).find(module=>module.target===target)?.range??null;
export function withRandomRangeModules(audio,modules){
 const next={...audio,randomRanges:validateRandomRanges(modules)};
 for(const key of legacyRangeKeys)delete next[key];
 return next;
}
export function connectRandomRange(modules,id,target){
 const control=rangeControl(target),module=modules.find(item=>item.id===id);
 if(!module||!control||modules.some(item=>item.id!==id&&item.target===target)||module.target===target)return null;
 return validateRandomRanges(modules.map(item=>item.id!==id?item:{...item,target,parameter:control.parameter,range:module.parameter===control.parameter?{...module.range}:{...control.defaults}}));
}
export function randomRangeConnectionTarget(connection){return connection?.sourceHandle==='value'?rangeControls.find(control=>control.node===connection.target&&control.handle===connection.targetHandle)?.id??null:null;}
export function isRandomRangeConnection(connection,audio){
 const target=randomRangeConnectionTarget(connection),modules=randomRangeModules(audio);
 return !!target&&modules.some(module=>module.id===connection.source)&&!modules.some(module=>module.id!==connection.source&&module.target===target);
}
