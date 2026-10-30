import {validateAmbientLoop} from './audio-ambient.js';
import {validatePools} from './audio-snippets.js';
import {validateFadeCurve} from './audio-fade-curves.js';
import {validateFileEdges} from './audio-file-edges.js';
import {validateFileGain} from './audio-gain.js';
import {isAudioRef,limits,checkAssetBudget} from './audio-storage.js';
import {validateCrossfade} from './audio-crossfades.js';
import {validateTrim,validateSections,validateAudioOrder} from './audio-edits.js';
import {validateFades,validateFadeSpeed} from './audio-fades.js';
import {validateOrganization} from './project-folders.js';
export const FORMAT='lovely-ui-prototype';
import {validatePitch,validatePitchRange} from './audio-pitch.js';
import {validateVolumeRange,maxVolumeGain} from './audio-range.js';
import {validateRandomRanges,legacyRangeKeys} from './audio-random-modules.js';
import {validateRangePosition} from './audio-range-module.js';
import {validateSoundFiles} from './audio-files.js';
export const maxEvents=32;
import {hasScript,scriptFileName,validScriptName,validateScripts} from './project-scripts.js';
export * from './project-scripts.js';
export function projectEvents(project){return Array.isArray(project.events)?project.events:project.audio?[project.audio]:[];}
export function validEventName(name){return typeof name==='string'&&name.length<=80&&!!name.trim()&&!/[\u0000-\u001f]/.test(name);}
export function nextEventName(events){let name='jump',n=2;while(events.some(event=>event.name===name))name=`event ${n++}`;return name;}
export function validateProject(value){
 if(value?.format===FORMAT&&value.version===16){
  validateScripts(value);const legacy={...value,version:15};delete legacy.scripts;
  if(value.organization)legacy.organization={...value.organization,items:value.organization.items?.filter(item=>item.section!=='scripts'||item.id==='main.lua')};
  validateProject(legacy);if(value.organization)validateOrganization(value.organization,value);return value;
 }
 if(Object.hasOwn(value??{},'scripts'))throw Error('Multiple Lua files need project version 16.');
 if(value?.format===FORMAT&&value.version===15){
  if(!Array.isArray(value.events)||Object.hasOwn(value,'audio'))throw Error('Ambient Loop needs a version-15 Event list.');
  const events=value.events.map(event=>{if(Object.hasOwn(event??{},'ambientLoop')){validateAmbientLoop(event.ambientLoop);if(event.repeat!=null)throw Error('Choose Ambient Loop or Repeat for an Event.');}const copy={...event};delete copy.ambientLoop;return copy;});
  validateProject({...value,version:Object.hasOwn(value,'soundPools')?14:13,events});return value;
 }
 if(projectEvents(value??{}).some(event=>Object.hasOwn(event??{},'ambientLoop')))throw Error('Ambient Loop needs project version 15.');
 if(value?.format===FORMAT&&value.version===14){validatePools(value);const copy={...value,version:13};delete copy.soundPools;validateProject(copy);return value;}
 if(Object.hasOwn(value??{},'soundPools'))throw Error('Sound pools need project version 14.');
 if(value?.format===FORMAT&&[7,8,9,10,11,12,13].includes(value.version)){
  if(!Array.isArray(value.assets)||!Array.isArray(value.events)||Object.hasOwn(value,'audio'))throw new Error('The edited project is invalid.');
  for(const asset of value.assets)if(Object.hasOwn(asset??{},'trim')){if(asset.type!=='audio'||!asset.data)throw new Error('Only loaded audio files can be trimmed.');validateTrim(asset.trim,asset.duration);}
  for(const asset of value.assets)if(Object.hasOwn(asset??{},'segments')){if(![8,9,10,11,12,13].includes(value.version)||asset.type!=='audio'||!asset.data||(Object.hasOwn(asset,'trim')||Object.hasOwn(asset,'sections')))throw new Error('Audio sections need one version-8 edit recipe.');validateSections(asset.segments,asset.duration);}
  for(const asset of value.assets)if(Object.hasOwn(asset??{},'sections')){if(![9,10,11,12,13].includes(value.version)||asset.type!=='audio'||!asset.data||Object.hasOwn(asset,'trim')||Object.hasOwn(asset,'segments'))throw new Error('Playback order needs one version-9 audio recipe.');validateAudioOrder(asset.sections,asset.duration);}
  for(const asset of value.assets){const blend=Object.hasOwn(asset??{},'crossfadeMs'),rate=Object.hasOwn(asset??{},'editSampleRate');if(blend||rate){if(![10,11,12,13].includes(value.version)||!blend||!rate||asset.type!=='audio'||!asset.data||(asset.sections??asset.segments??[]).length<2||!Number.isInteger(asset.editSampleRate)||asset.editSampleRate<1||asset.editSampleRate>768000)throw new Error('Crossfades need a version-10 joined audio recipe and sample rate.');validateCrossfade(asset.crossfadeMs);}}
  for(const asset of value.assets)if(Object.hasOwn(asset??{},'gainDb')){if(![11,12,13].includes(value.version)||asset.type!=='audio'||!asset.data||asset.gainDb===0)throw new Error('File gain needs a version-11 loaded audio recipe.');validateFileGain(asset.gainDb);}
  for(const asset of value.assets)if(Object.hasOwn(asset??{},'edgeFades')){if(![12,13].includes(value.version)||asset.type!=='audio'||!asset.data)throw new Error('File-edge fades need a version-12 loaded audio recipe.');const edges=validateFileEdges(asset.edgeFades);if(!edges.inMs&&!edges.outMs)throw new Error('Omit disabled file-edge fades.');}
  for(const asset of value.assets){const curve=Object.hasOwn(asset??{},'crossfadeCurve');const edges=asset?.edgeFades;if(curve||edges&&(Object.hasOwn(edges,'inCurve')||Object.hasOwn(edges,'outCurve'))){if(value.version!==13)throw new Error('Fade types need project version 13.');if(curve){if(!asset.crossfadeMs)throw new Error('Crossfade type needs an active crossfade.');validateFadeCurve(asset.crossfadeCurve);}}}
  const assets=value.assets.map(asset=>{const copy={...asset};delete copy.trim;delete copy.segments;delete copy.sections;delete copy.crossfadeMs;delete copy.crossfadeCurve;delete copy.editSampleRate;delete copy.gainDb;delete copy.edgeFades;return copy;}),version=assets.some(asset=>isAudioRef(asset.data))?6:value.scriptPresent===false?5:value.scriptName?4:value.organization?3:2;
  validateProject({...value,version,assets});return value;
 }
 if(Array.isArray(value?.assets)&&value.assets.some(asset=>Object.hasOwn(asset??{},'trim')||Object.hasOwn(asset??{},'segments')||Object.hasOwn(asset??{},'sections')||Object.hasOwn(asset??{},'crossfadeMs')||Object.hasOwn(asset??{},'crossfadeCurve')||Object.hasOwn(asset??{},'editSampleRate')||Object.hasOwn(asset??{},'gainDb')||Object.hasOwn(asset??{},'edgeFades')))throw new Error('Audio edits need project version 7–13.');
 if(value?.format===FORMAT&&value.version===6){
  if(Object.hasOwn(value,'audio')||!Array.isArray(value.events))throw new Error('The Event list is invalid.');
  checkAssetBudget(value.assets??[]);const refs=new Map();
  for(const a of value.assets)if(a.type==='audio'&&a.data!=null){
   if(!isAudioRef(a.data)){if(typeof a.data==='string'&&/^data:[^,;]*;base64,[A-Za-z0-9+/]*={0,2}$/.test(a.data)&&a.data.length<=8500000)continue;throw new Error('Version-6 audio needs original-byte references.');}
   if(!Number.isSafeInteger(a.bytes)||a.bytes<=0||a.bytes>limits.file||typeof a.mime!=='string'||a.mime.length>200||!Number.isFinite(a.duration)||a.duration<=0||!Number.isSafeInteger(a.pcmBytes)||a.pcmBytes<=0||a.pcmBytes>limits.pcm)throw new Error('Audio metadata exceeds supported resource limits.');
   if(refs.has(a.data)&&refs.get(a.data)!==a.bytes)throw new Error('Conflicting original audio sizes.');refs.set(a.data,a.bytes);
  }
  const legacy={...value,version:value.scriptPresent===false?5:value.scriptName?4:value.organization?3:2,assets:value.assets.map(a=>isAudioRef(a.data)?{...a,data:null}:a)};validateProject(legacy);return value;
 }

 if(value?.format===FORMAT&&[2,3,4,5].includes(value.version)){
  if(Object.hasOwn(value,'audio')||!Array.isArray(value.events)||value.events.length>maxEvents)throw new Error('The Event list is invalid.');
  const ids=new Set(),names=new Set();
  const legacy={...value,version:1};delete legacy.events;delete legacy.organization;delete legacy.scriptName;delete legacy.scriptPresent;validateProject({...legacy,audio:null});
  for(const event of value.events){
   if(!event||typeof event.id!=='string'||!event.id||event.id.length>100||!validEventName(event.name)||ids.has(event.id)||names.has(event.name))throw new Error('Events need unique IDs and nonblank, unique names.');
   ids.add(event.id);names.add(event.name);validateProject({...legacy,audio:event});
  }
  if(value.version===3||[4,5].includes(value.version)&&Object.hasOwn(value,'organization'))validateOrganization(value.organization,value);else if(Object.hasOwn(value,'organization'))throw new Error('Folders need a version-3 project.');
  if(value.version===4){if(!validScriptName(value.scriptName)||value.assets.some(x=>x.name.toLowerCase()===value.scriptName.toLowerCase()))throw new Error('The script filename is invalid.');}else if(Object.hasOwn(value,'scriptName'))throw new Error('A renamed script needs a version-4 project.');
  if(value.version===5){if(value.scriptPresent!==false||value.code!==''||Object.hasOwn(value,'scriptName'))throw new Error('A script-free project must have no source or script filename.');}else if(Object.hasOwn(value,'scriptPresent'))throw new Error('Removing the script needs a version-5 project.');
  return value;
 }
 if(!value||value.format!==FORMAT||value.version!==1||(Object.hasOwn(value,'events')||Object.hasOwn(value,'organization')||Object.hasOwn(value,'scriptName')||Object.hasOwn(value,'scriptPresent')))throw new Error('Open a .lovely-ui.json prototype project, or a .lua file.');
 if(typeof value.name!=='string'||value.name.length>80||/[\u0000-\u001f]/.test(value.name)||typeof value.code!=='string'||value.code.length>500000)throw new Error('The project name or source code is invalid.');
 if(value.settings&&Object.hasOwn(value.settings,'fadeSpeed'))validateFadeSpeed(value.settings.fadeSpeed);
 const settings=value.settings;if(!settings||!Number.isInteger(settings.width)||!Number.isInteger(settings.height)||settings.width<160||settings.width>1920||settings.height<120||settings.height>1080)throw new Error('The preview dimensions are invalid.');
 if(!Array.isArray(value.assets)||value.assets.length>100)throw new Error('The asset list is invalid.');
 const ids=new Set(),names=new Set();
 for(const a of value.assets){
  if(!a||typeof a.id!=='string'||typeof a.name!=='string'||!a.name||a.name.length>160||/[\\/]/.test(a.name)||a.name==='main.lua'||a.name==='conf.lua'||ids.has(a.id)||names.has(a.name)||!['image','audio'].includes(a.type))throw new Error('An asset has an invalid or duplicate name.');
  ids.add(a.id);names.add(a.name);
  if(a.type==='image'&&(typeof a.data!=='string'||!/^data:image\/(png|jpeg|webp|gif);base64,/.test(a.data)||a.data.length>16000000))throw new Error('An image is missing or invalid.');
  if(a.type==='audio'&&a.data!=null&&(typeof a.data!=='string'||!/^data:[^,;]*;base64,[A-Za-z0-9+/]*={0,2}$/.test(a.data)||a.data.length>8500000))throw new Error('An audio file is invalid or too large.');
 }
 if(value.audio!=null){const a=value.audio;if(typeof a.name!=='string'||a.name.length>80||/[\u0000-\u001f]/.test(a.name)||!Number.isFinite(a.volume)||a.volume<0||a.volume>maxVolumeGain||(a.assetId!=null&&!value.assets.some(x=>x.id===a.assetId&&x.type==='audio')))throw new Error('The audio event is invalid.');}
 if(value.audio)validateSoundFiles(value.audio,value.assets);
 if(value.audio&&Object.hasOwn(value.audio,'outputVolume')&&(!Number.isFinite(value.audio.outputVolume)||value.audio.outputVolume<0||value.audio.outputVolume>maxVolumeGain))throw new Error('Output volume must be between silence and +12 dB.');
 if(value.audio?.repeat!=null){const r=value.audio.repeat;if(!['count','forever'].includes(r.mode)||!Number.isInteger(r.count)||r.count<1||r.count>99)throw new Error('Repeat needs a valid mode and a count from 1 to 99.');}
 if(value.audio&&Object.hasOwn(value.audio,'randomRanges')){if(legacyRangeKeys.some(key=>Object.hasOwn(value.audio,key)))throw new Error('Use generic Random Range settings without duplicate legacy range fields.');validateRandomRanges(value.audio.randomRanges);}
 if(value.audio&&Object.hasOwn(value.audio,'volumeRange'))validateVolumeRange(value.audio.volumeRange);
 if(value.audio&&Object.hasOwn(value.audio,'volumeRangeConnected')&&(!value.audio.volumeRange||typeof value.audio.volumeRangeConnected!=='boolean'))throw new Error('Random Range connection must be true or false and needs a module.');
 if(value.audio&&Object.hasOwn(value.audio,'volumeRangePosition')){if(!value.audio.volumeRange)throw new Error('Random Range position needs a module.');validateRangePosition(value.audio.volumeRangePosition);}
 if(value.audio&&Object.hasOwn(value.audio,'outputVolumeRange'))validateVolumeRange(value.audio.outputVolumeRange);
 if(value.audio&&Object.hasOwn(value.audio,'outputVolumeRangeConnected')&&(!value.audio.outputVolumeRange||typeof value.audio.outputVolumeRangeConnected!=='boolean'))throw new Error('Random Range connection must be true or false and needs a module.');
 if(value.audio&&Object.hasOwn(value.audio,'outputVolumeRangePosition')){if(!value.audio.outputVolumeRange)throw new Error('Random Range position needs a module.');validateRangePosition(value.audio.outputVolumeRangePosition);}
 if(value.audio&&Object.hasOwn(value.audio,'pitchSemitones'))validatePitch(value.audio.pitchSemitones);
 if(value.audio&&Object.hasOwn(value.audio,'pitchRange'))validatePitchRange(value.audio.pitchRange);
 if(value.audio&&Object.hasOwn(value.audio,'pitchRangeConnected')&&(!value.audio.pitchRange||typeof value.audio.pitchRangeConnected!=='boolean'))throw new Error('Pitch Range connection must be true or false and needs a module.');
 if(value.audio&&Object.hasOwn(value.audio,'pitchRangePosition')){if(!value.audio.pitchRange)throw new Error('Pitch Range position needs a module.');validateRangePosition(value.audio.pitchRangePosition);}
 if(value.audio&&Object.hasOwn(value.audio,'fades')){if(Object.hasOwn(value.audio,'shape'))throw new Error('Use Fade modules without duplicate legacy Shape settings.');validateFades(value.audio.fades);}
 if(value.audio?.shape!=null){const s=value.audio.shape;if(typeof s!=='object'||Array.isArray(s))throw new Error('Shape settings are invalid.');for(const direction of ['in','out']){const p=s[direction];if(p!=null&&(typeof p.enabled!=='boolean'||!['linear','logarithmic','smooth'].includes(p.curve)||!['fast','medium','slow'].includes(p.speed)))throw new Error('Shape needs valid curve and speed presets.');}}
 return value;
}
export function snapshot(state){const missing=!hasScript(state),organized=!!state.organization?.folders.length,renamed=!missing&&scriptFileName(state)!=='main.lua',ambient=state.events?.some(event=>!!event.ambientLoop),multi=missing||organized||renamed||(Array.isArray(state.events)&&state.events.length>1);return JSON.stringify({format:FORMAT,version:state.scripts?.length?16:ambient?15:state.soundPools?.length?14:state.assets.some(a=>Object.hasOwn(a,'crossfadeCurve')||a.edgeFades&&(Object.hasOwn(a.edgeFades,'inCurve')||Object.hasOwn(a.edgeFades,'outCurve')))?13:state.assets.some(a=>Object.hasOwn(a,'edgeFades'))?12:state.assets.some(a=>Object.hasOwn(a,'gainDb'))?11:state.assets.some(a=>a.crossfadeMs)?10:state.assets.some(a=>a.sections)?9:state.assets.some(a=>a.segments)?8:state.assets.some(a=>a.trim)?7:state.assets.some(a=>isAudioRef(a.data))?6:missing?5:renamed?4:organized?3:multi?2:1,name:state.name,code:state.code,...(state.scripts?.length?{scripts:state.scripts.map(script=>({...script}))}:{}),settings:{...state.settings},assets:state.assets.map(a=>({...a})),...((state.scripts?.length||ambient||state.soundPools?.length||multi||state.assets.some(a=>isAudioRef(a.data)||a.trim||a.segments||a.sections||a.gainDb||a.edgeFades))?{events:state.events.map(event=>({...event}))}:{audio:state.audio?{...state.audio}:state.events?.[0]?{...state.events[0]}:null}),...(state.soundPools?.length?{soundPools:structuredClone(state.soundPools)}:{}),...(organized?{organization:structuredClone(state.organization)}:{}),...(renamed?{scriptName:scriptFileName(state)}:{}),...(missing?{scriptPresent:false}:{})});}
export function uniqueName(name,assets){const safe=name.replace(/[\\/]/g,'_').slice(0,150);if(!assets.some(a=>a.name.toLowerCase()===safe.toLowerCase()))return safe;const dot=safe.lastIndexOf('.'),base=dot>0?safe.slice(0,dot):safe,ext=dot>0?safe.slice(dot):'';let n=2;while(assets.some(a=>a.name.toLowerCase()===`${base}-${n}${ext}`.toLowerCase()))n++;return `${base}-${n}${ext}`;}
export function exportName(name,extension){return (name.trim().replace(/[^\p{L}\p{N} _-]/gu,'').replace(/\s+/g,'-').toLowerCase()||'my-game')+extension;}
export const STARTER=`-- Move with the arrow keys
local x = 160
local speed = 180
local player

function love.load()
  player = love.graphics.newImage("player.png")
end

function love.update(dt)
  if love.keyboard.isDown("right") then
    x = x + speed * dt
  elseif love.keyboard.isDown("left") then
    x = x - speed * dt
  end
end

function love.draw()
  love.graphics.draw(player, x, 240)
  love.graphics.rectangle("fill", 0, 272, 800, 12)
end`;
