import {shapeSettings,shapeDuration,shapeValue} from './audio-shape.js';
import {FilePlaybackClock} from './audio-files.js';
export const defaultFadeSpeed=Object.freeze({minMs:100,maxMs:2000});
export const maxFades=4;
export const fadeTargets=Object.freeze([{id:'sound-volume',node:'sound',handle:'volume',label:'Sound volume'},{id:'output-volume',node:'output',handle:'volume',label:'Output volume'}]);
export function validateFadeSpeed(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['minMs','maxMs'].includes(key))||!Number.isInteger(value.minMs)||!Number.isInteger(value.maxMs)||value.minMs<1||value.maxMs>60000||value.minMs>=value.maxMs)throw new Error('Fade speed limits need whole milliseconds from 1 to 60000, with the fast limit below the slow limit.');
 return {minMs:value.minMs,maxMs:value.maxMs};
}
export const fadeSpeed=settings=>settings?.fadeSpeed??defaultFadeSpeed;
export function validateFades(modules){
 if(!Array.isArray(modules)||modules.length>maxFades)throw new Error('Use at most four Fade modules.');
 const ids=new Set(),routes=new Set();return modules.map(module=>{
  if(!module||typeof module!=='object'||Array.isArray(module)||Object.keys(module).some(key=>!['id','direction','target','curve','durationMs','start','collapsed','position'].includes(key))||typeof module.id!=='string'||!/^(fade-\d+|fade-in|fade-out)$/.test(module.id)||module.id.length>80||ids.has(module.id))throw new Error('Fade needs a unique module ID and authored settings only.');
  ids.add(module.id);
  if(!['in','out'].includes(module.direction)||!['linear','logarithmic','smooth'].includes(module.curve)||!Number.isFinite(module.durationMs)||module.durationMs<=0||!['trigger','each-play'].includes(module.start)||module.direction==='out'&&module.start!=='trigger'||typeof module.collapsed!=='boolean')throw new Error('Fade needs a direction, curve, duration, timing and collapsed state.');
  if(module.target!==null&&!fadeTargets.some(target=>target.id===module.target))throw new Error('Fade connects only to Sound or Output Volume.');
  const route=module.direction+':'+module.target;if(module.target!==null&&routes.has(route))throw new Error('Use one Fade of each direction per Volume input.');if(module.target!==null)routes.add(route);
  const result={id:module.id,direction:module.direction,target:module.target,curve:module.curve,durationMs:module.durationMs,start:module.start,collapsed:module.collapsed};
  if(Object.hasOwn(module,'position')){const p=module.position;if(!p||Object.keys(p).some(key=>!['x','y'].includes(key))||!['x','y'].every(key=>Number.isFinite(p[key])&&Math.abs(p[key])<=10000))throw new Error('Fade needs a finite canvas position.');result.position={x:p.x,y:p.y};}
  return result;
 });
}
// Legacy Shape is represented without dirtying a project merely by opening it.
export function fadeModules(event){
 if(!event)return [];if(Array.isArray(event.fades))return event.fades;
 return ['in','out'].filter(direction=>shapeSettings(event.shape?.[direction]).enabled).map(direction=>{const shape=shapeSettings(event.shape[direction]);return {id:'fade-'+direction,direction,target:direction==='in'?'sound-volume':'output-volume',curve:shape.curve,durationMs:shapeDuration(shape)*1000,start:'trigger',collapsed:false};});
}
export function withFadeModules(event,modules){const next={...event,fades:validateFades(modules)};delete next.shape;return next;}
export function connectFade(modules,id,target){
 const module=modules.find(item=>item.id===id);if(!module||!fadeTargets.some(item=>item.id===target)||module.target===target||modules.some(item=>item.id!==id&&item.direction===module.direction&&item.target===target))return null;
 return validateFades(modules.map(item=>item.id===id?{...item,target}:item));
}
export function fadeConnection(connection,event){
 // React Flow normalizes a connection started at the target into source→target.
 const target=connection?.sourceHandle==='value'?fadeTargets.find(item=>item.node===connection.target&&item.handle===connection.targetHandle)?.id:null;
 const module=fadeModules(event).find(item=>item.id===connection?.source);return target&&module&&!fadeModules(event).some(item=>item.id!==module.id&&item.direction===module.direction&&item.target===target)?{id:module.id,target}:null;
}
export function authoredFadeShape(event){
 if(!Array.isArray(event?.fades))return event?.shape;
 return Object.fromEntries(['in','out'].map(direction=>{const module=event.fades.find(item=>item.direction===direction&&item.target);return [direction,module?{enabled:true,curve:module.curve,speed:'medium',duration:module.durationMs/1000}:{enabled:false,curve:'smooth',speed:'medium'}];}));
}
export function playbackFades(event,options={}){
 if(!Array.isArray(event?.fades))return null;
 let modules=event.fades.filter(module=>module.target).map(module=>({...module,duration:module.durationMs/1000}));
 for(const direction of options.fadeOverrides??[]){const setting=shapeSettings(options.shape?.[direction]);if(!setting.enabled){modules=modules.filter(module=>module.direction!==direction);continue;}
  if(!modules.some(module=>module.direction===direction))modules.push({id:'lua-'+direction,direction,target:direction==='in'?'sound-volume':'output-volume',start:'trigger'});
  modules=modules.map(module=>module.direction===direction?{...module,curve:setting.curve,duration:shapeDuration(setting)}:module);
 }
 return modules;
}
// Gain factors commute while Sound and Output contain only scalar gain stages.
// Repeat boundaries use the same seeded audio clock as actual file playback.
export class FadeClock {
 constructor({fades,startAt,duration,plays=1,filePlan=null}){this.fades=fades;this.startAt=startAt;this.duration=duration;this.plays=plays;this.files=filePlan?new FilePlaybackClock(filePlan):null;}
 gainAt(time,releaseAt=Infinity){
  if(time<this.startAt)return 0;const reference=Math.min(time,releaseAt),record=this.files?.step(reference),passStart=this.files?(record??this.files.current).startAt:this.startAt+Math.max(0,Math.min(this.plays-1,Math.floor((reference-this.startAt+1e-9)/this.duration)))*this.duration;
  let gain=1;for(const fade of this.fades){if(fade.direction==='in'){const start=fade.start==='each-play'?passStart:this.startAt;gain*=shapeValue(fade.curve,(reference-start)/fade.duration);}else if(time>=releaseAt)gain*=1-shapeValue(fade.curve,(time-releaseAt)/fade.duration);}
  return gain;
 }
}
