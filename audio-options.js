import {shapeSettings,shapeCurves,shapeSpeeds} from './audio-shape.js';
import {dbToGain} from './audio-range.js';
// Per-play settings only: never write these values into the authored graph.
function table(value,keys,path){
 if(!value||Object.prototype.toString.call(value)!=='[object Object]')throw new Error(`${path} must be a settings table.`);
 for(const key of Object.keys(value))if(!keys.includes(key))throw new Error(`Unknown ${path} setting "${key.slice(0,40)}".`);
}
function fade(value,authored,path){
 const settings=shapeSettings(authored);
 if(value===undefined)return settings;
 if(value===false)return {...settings,enabled:false};
 table(value,['duration','curve','speed'],path);
 if(value.duration!==undefined&&(typeof value.duration!=='number'||!Number.isFinite(value.duration)||value.duration<0))throw new Error(`${path}.duration must be a finite number of seconds, 0 or greater.`);
 if(value.speed!==undefined&&!shapeSpeeds.some(x=>x.id===value.speed))throw new Error(`${path}.speed must be "fast", "medium" or "slow".`);
 // UI names are public; old technical names remain compatible with saved Lua.
 const curve=shapeCurves.find(x=>x.label.toLowerCase()===value.curve||x.id===value.curve);
 if(value.curve!==undefined&&!curve)throw new Error(`${path}.curve must be "straight", "rounded" or "smooth". For "fast", "medium" or "slow", use ${path}.speed.`);
 if(value.speed!==undefined)delete settings.duration;
 return {...settings,enabled:value.duration!==0,...(value.speed!==undefined?{speed:value.speed}:{}),...(value.duration!==undefined?{duration:value.duration}:{}),...(curve?{curve:curve.id}:{})};
}
export function eventPlaybackOptions(options,authored){
 if(options!==undefined)table(options,['volumeDb','fadeIn','fadeOut'],'lyd.audio.play options');
 const db=options?.volumeDb===undefined?0:options.volumeDb;
 if(typeof db!=='number'||!(Number.isFinite(db)||db===-Infinity)||db>0)throw new Error('volumeDb must be a number at or below 0 dB; use -math.huge for silence.');
 return {volume:dbToGain(db),shape:{in:fade(options?.fadeIn,authored?.in,'fadeIn'),out:fade(options?.fadeOut,authored?.out,'fadeOut')}};
}
