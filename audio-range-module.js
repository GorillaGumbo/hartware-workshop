import {connectedRange,validateModulePosition} from './audio-random-modules.js';
// Typed control connections carry no audio.
export const rangeModuleMime='application/x-lovely-range-module';
export const isVolumeRangeConnected=audio=>!!connectedRange(audio,'sound-volume');
export const isVolumeRangeConnection=connection=>connection?.source==='volume-range'&&connection.sourceHandle==='value'&&connection.target==='sound'&&connection.targetHandle==='volume';
export const isPitchRangeConnected=audio=>!!connectedRange(audio,'sound-pitch');
export const isPitchRangeConnection=connection=>connection?.source==='pitch-range'&&connection.sourceHandle==='value'&&connection.target==='sound'&&connection.targetHandle==='pitch';
export const isOutputVolumeRangeConnected=audio=>!!connectedRange(audio,'output-volume');
export const isOutputVolumeRangeConnection=connection=>connection?.source==='output-volume-range'&&connection.sourceHandle==='value'&&connection.target==='output'&&connection.targetHandle==='volume';
export const validateRangePosition=validateModulePosition;
export function createRangeModuleDrag({hasModule,getEpoch=()=>0,toFlowPosition,onAdd,type='volume'}){
 return {
  start(event){if(hasModule()){event.preventDefault();return false;}event.dataTransfer.setData(rangeModuleMime,JSON.stringify({type,epoch:getEpoch()}));event.dataTransfer.effectAllowed='copy';return true;},
  over(event){if(hasModule()||!Array.from(event.dataTransfer?.types??[]).includes(rangeModuleMime))return false;event.preventDefault();event.dataTransfer.dropEffect='copy';return true;},
  drop(event){if(hasModule())return false;let payload;try{payload=JSON.parse(event.dataTransfer?.getData(rangeModuleMime));}catch{return false;}if(payload?.type!==type||payload.epoch!==getEpoch())return false;event.preventDefault();event.stopPropagation();let position;try{position=validateRangePosition(toFlowPosition({x:event.clientX,y:event.clientY}));}catch{return false;}return onAdd(position)!==false;}
 };
}
