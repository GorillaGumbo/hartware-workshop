import {validateAmbientLoop,circularPosition} from './audio-ambient.js';
import {fileEdgeFrames} from './audio-file-edges.js';
import {fileGainAmplitude} from './audio-gain.js';
import {shapeSettings,shapeDuration,shapeSamples,sampleEnvelope} from './audio-shape.js';
import {validatePitch,semitonesToRate} from './audio-pitch.js';
import {validateVolumeRange,dbToGain,maxVolumeGain} from './audio-range.js';
import {FilePlaybackClock,chooseFile,seededRandom} from './audio-files.js';
import {FadeClock} from './audio-fades.js';
import {playbackSections,audioEditKey} from './audio-edits.js';
// One voice; LÖVE equivalent: Source:setVolume(soundVolume * outputVolume * playVolume * rangeGain * envelope).
export class AudioPlayer {
 constructor(createContext=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),onState=()=>{},createRangeNode=(context,options)=>new AudioWorkletNode(context,'lovely-volume-range',options),onError=()=>{},createFileNode=(context,options)=>new AudioWorkletNode(context,'lovely-file-selection',options),createFadeNode=(context,options)=>new AudioWorkletNode(context,'lovely-fade',options),createEdgeNode=(context,options)=>new AudioWorkletNode(context,'lovely-file-edges',options),createAmbientNode=(context,options)=>new AudioWorkletNode(context,'lovely-ambient-loop',options)) {
  this.createAmbientNode=createAmbientNode;this.ambientModule=null;this.ambientNode=null;this.ambientSnapshot=null;this.ambientSettings=null;
  this.createEdgeNode=createEdgeNode;this.edgeNode=null;this.edgeModule=null;
  this.createFadeNode=createFadeNode;this.fadeNode=null;this.fadeClock=null;this.fadeSettings=[];this.fadeModule=null;
  this.eventOrders=new Map();this.eventKey=null;this.cacheGeneration=0;this.createContext=createContext;this.onState=onState;this.context=null;this.gain=null;this.buffer=null;this.source=null;this.volume=1;this.outputVolume=1;this.playVolume=1;this.releaseShape=null;this.generation=0;this.envelopeGain=null;this.envelope=null;this.releasing=false;this.endAt=Infinity;this.startedAt=null;
  this.createRangeNode=createRangeNode;this.onError=onError;this.playbackRate=1;this.pitchSample=null;this.rangeNode=null;this.rangeDb=null;this.outputRangeDb=null;this.rangePass=0;this.rangeModule=null;this.releaseAt=null;
  this.createFileNode=createFileNode;this.fileBuffers=new Map();this.fileData=new Map();this.fileNode=null;this.fileRun=null;this.fileModule=null;this.fileCursor={};this.fileSignature=null;this.activeFileId=null;this.fileStopAt=Infinity;
 }
 loadWorklet(context,url){return context.audioWorklet.addModule(url);}
 ensureContext(){
  if(!this.context){this.context=this.createContext();this.rangeModule=this.fileModule=this.fadeModule=this.edgeModule=this.ambientModule=null;this.gain=this.context.createGain();this.gain.gain.value=this.volume*this.outputVolume;this.gain.connect(this.context.destination);}
  return this.context;
 }
 async load(bytes){
  this.stop();this.buffer=null;const token=this.generation;this.onState('Loading');
  try{const buffer=await this.ensureContext().decodeAudioData(bytes.slice(0));if(token!==this.generation)return false;this.buffer=buffer;this.onState('Ready');return true;}
  catch(error){if(token!==this.generation)return false;this.onState('Could not load');throw new Error('This audio file could not be decoded. Try a WAV, MP3 or OGG supported by your browser.');}
 }
 async loadFiles(files,{forceIds=[]}={}){
  this.stop();const token=this.generation;this.onState('Loading');
  try{const decoded=[];for(const file of files){if(token!==this.generation)return false;decoded.push([file.id,!forceIds.includes(file.id)&&this.fileData.get(file.id)===file.data&&this.fileBuffers.has(file.id)?this.fileBuffers.get(file.id):await this.ensureContext().decodeAudioData(file.bytes.slice(0))]);}if(token!==this.generation)return false;this.fileBuffers=new Map(decoded);this.fileData=new Map(files.map(file=>[file.id,file.data]));this.buffer=decoded[0]?.[1]??null;this.resetFileOrder();this.onState(this.buffer?'Ready':'No file');return true;}
  catch(error){if(token!==this.generation)return false;this.onState('Could not load');throw new Error('An audio file could not be decoded. Try WAV, MP3 or OGG supported by your browser.');}
 }
 async cacheFiles(files,isCurrent=()=>true,forceIds=[]){
  const token=this.cacheGeneration;try{
  const decoded=[];for(const file of files){if(token!==this.cacheGeneration||!isCurrent())return false;decoded.push([file.id,!forceIds.includes(file.id)&&this.fileData.get(file.id)===file.data&&this.fileBuffers.has(file.id)?this.fileBuffers.get(file.id):await this.ensureContext().decodeAudioData(file.bytes.slice(0))]);}
  if(token!==this.cacheGeneration||!isCurrent())return false;
  this.fileBuffers=new Map(decoded);this.fileData=new Map(files.map(file=>[file.id,file.data]));if(!this.source)this.buffer=decoded[0]?.[1]??null;return true;
  }catch(error){if(token!==this.cacheGeneration||!isCurrent())return false;throw new Error('An audio file could not be decoded. Try WAV, MP3 or OGG supported by your browser.');}
 }
 useEvent(key){if(key===undefined||key===this.eventKey)return;this.stop();this.eventOrders.set(this.eventKey,{cursor:this.fileCursor,signature:this.fileSignature});this.eventKey=key;const saved=this.eventOrders.get(key);this.fileCursor=saved?.cursor??{};this.fileSignature=saved?.signature??null;}
 resetFileOrder(key=this.eventKey){this.eventOrders.delete(key);if(key===this.eventKey){this.fileCursor={};this.fileSignature=null;}}
 commitFileOrder(){if(this.fileRun&&!this.preserveFileOrder)this.fileCursor=this.fileRun.cursor(Math.min(this.context.currentTime,this.fileStopAt-1e-7));}
 syncFiles(){if(!this.fileRun)return;const record=this.fileRun.step(Math.min(this.context.currentTime,this.fileStopAt-1e-7)),values=this.fileRun.values();this.activeFileId=record?.id??null;this.rangePass=this.fileRun.pass;this.rangeDb=values.db;this.outputRangeDb=values.outputDb;}
 playingFile(){this.syncFiles();return this.source?this.activeFileId:null;}
 async play({eventKey,ambientLoop=null,repeat=null,shape=null,volume=1,volumeRange=null,outputVolumeRange=null,pitchSemitones=0,sampledPitch=null,files=null,selectionMode=null,fades=null,auditionRange=null,startOffset=0}={}){
  this.useEvent(eventKey);
  if(ambientLoop)return this.playAmbient({ambientLoop,shape,volume,volumeRange,outputVolumeRange,pitchSemitones,sampledPitch,files,selectionMode,fades});
  if(files?.length>1)return this.playFiles({repeat,shape,volume,volumeRange,outputVolumeRange,pitchSemitones,sampledPitch,files,selectionMode,fades});
  const original=files?.[0]?this.fileBuffers.get(files[0].id):this.buffer;if(original&&((files?.[0]?.segments||files?.[0]?.sections)&&playbackSections(original,files[0],auditionRange).length>1||files?.[0]?.crossfadeMs))return this.playFiles({repeat,shape,volume,volumeRange,outputVolumeRange,pitchSemitones,sampledPitch,files,selectionMode,fades,auditionRange,startOffset});
  this.stop();if(files?.[0])this.buffer=this.fileBuffers.get(files[0].id)??null;if(!this.buffer)return false;const token=this.generation,ctx=this.ensureContext();
  if(files?.[0]){const buffer=this.fileBuffers.get(files[0].id);if(!buffer)return false;this.buffer=buffer;this.activeFileId=files[0].id;}
  const span=playbackSections(this.buffer,files?.[0]??{},auditionRange)[0];
  this.auditionRange=auditionRange?{...auditionRange}:null;
  this.playbackSpan=span;
  const sourceRate=this.buffer.sampleRate??48000,offset=auditionRange?0:Math.max(0,Math.min(span.length/sourceRate-1/sourceRate,Math.round((Number.isFinite(startOffset)?startOffset:0)*sourceRate)/sourceRate));
  const edgeSettings=files?.[0]?.edgeFades??null;
  const plays=repeat?.mode==='forever'?Infinity:repeat?.mode==='count'?Math.max(1,Math.min(99,Math.round(repeat.count)||1)):1;
  this.onState('Starting');
  try{await ctx.resume();if(token!==this.generation||!this.buffer)return false;if(fades?.length&&!await this.prepareFades(fades,token))return false;if(edgeSettings&&!await this.prepareFileEdges(token))return false;
   validatePitch(pitchSemitones);if(sampledPitch!==null)validatePitch(sampledPitch);
   const fileGain=fileGainAmplitude(files?.[0]?.gainDb??0),rate=semitonesToRate(pitchSemitones+(sampledPitch??0)),duration=(this.playbackSpan.end-this.playbackSpan.start)/rate;
   const range=volumeRange?validateVolumeRange(volumeRange.range):null,outputRange=outputVolumeRange?validateVolumeRange(outputVolumeRange.range):null,hasRange=!!(range||outputRange);
   if(hasRange&&plays>1){if(!ctx.audioWorklet)throw new Error('AudioWorklet is unavailable.');if(!this.rangeModule){const module=this.loadWorklet(ctx,new URL('./audio-range-worklet.js',import.meta.url)).catch(error=>{if(this.rangeModule===module)this.rangeModule=null;throw error;});this.rangeModule=module;}await this.rangeModule;if(token!==this.generation||!this.buffer)return false;}
   const source=ctx.createBufferSource(),fadeIn=shapeSettings(shape?.in),fadeOut=shapeSettings(shape?.out);source.buffer=this.buffer;source.loop=plays>1;this.playbackRate=rate;this.pitchSample=sampledPitch;if(rate!==1)source.playbackRate.setValueAtTime(rate,ctx.currentTime);this.source=source;this.playVolume=volume*fileGain;this.releaseShape=fadeOut;this.updateVolume();
   if(files?.[0]?.trim||files?.[0]?.segments||files?.[0]?.sections||auditionRange){source.loopStart=this.playbackSpan.start;source.loopEnd=this.playbackSpan.end;}
   source.onended=()=>{source.disconnect();if(this.source===source){const stopped=this.releasing;this.source=null;this.startedAt=null;this.clearEnvelope();this.onState(stopped?'Stopped':'Finished');}};
   // Give the audio thread time to construct the range processor before the shared start clock.
   try{const startAt=ctx.currentTime+(hasRange&&plays>1||this.fadeSettings.length||edgeSettings?0.02:0);this.startedAt=startAt-offset/rate;this.endAt=Number.isFinite(plays)?this.startedAt+duration*plays:Infinity;
    const initial=(setting,limits)=>{if(!limits)return null;const db=setting.initialDb;if(!Number.isFinite(db)||db<limits.minDb||db>limits.maxDb)throw new Error('Invalid sampled volume.');return db;};
    this.rangeDb=initial(volumeRange,range);this.outputRangeDb=initial(outputVolumeRange,outputRange);
    if(hasRange&&plays>1){this.rangeNode=this.createRangeNode(ctx,{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[this.buffer.numberOfChannels??1],processorOptions:{range,initialDb:this.rangeDb,startAt,duration,plays,...(outputRange?{outputRange:{range:outputRange,initialDb:this.outputRangeDb,startAt,duration,plays}}:{})}});
     this.rangeNode.port.onmessage=event=>{const m=event.data,valid=(db,limits)=>!limits||Number.isFinite(db)&&db>=limits.minDb&&db<=limits.maxDb;if(token!==this.generation||this.source!==source||!m||!valid(m.db,range)||!valid(m.outputDb,outputRange)||!Number.isFinite(m.time)||m.time<startAt||this.releasing&&m.time>this.releaseAt||!Number.isInteger(m.pass)||m.pass<=this.rangePass||m.pass>=plays)return;if(range)this.rangeDb=m.db;if(outputRange)this.outputRangeDb=m.outputDb;this.rangePass=m.pass;this.onState(this.releasing?'Releasing':'Playing');};
     this.rangeNode.onprocessorerror=()=>{if(token!==this.generation||this.source!==source)return;this.stop();this.onState('Could not play');this.onError(new Error('Random Range could not process audio. Press Play to try again.'));};
    }
    this.updateVolume();let input=this.rangeNode??source;if(this.rangeNode)source.connect(this.rangeNode);
    if(edgeSettings){const length=playbackSections(this.buffer,files?.[0]??{}).at(-1).timelineEnd;input=this.connectFileEdges(input,{edges:fileEdgeFrames(edgeSettings,length,this.buffer.sampleRate),startAt:this.startedAt,sourceRate:this.buffer.sampleRate,rate,offsetFrame:Math.round((auditionRange?.start??0)*this.buffer.sampleRate),selectionLength:span.length},token);}
    input=this.connectFades(input,{startAt,duration,plays},token);
    if(fadeIn.enabled||fadeOut.enabled){this.envelopeGain=ctx.createGain();this.envelopeGain.connect(this.gain);input.connect(this.envelopeGain);if(fadeIn.enabled)this.scheduleEnvelope(fadeIn,startAt,0,1);}else input.connect(this.gain);
    if(files?.[0]?.trim||files?.[0]?.segments||files?.[0]?.sections||auditionRange||offset){if(plays>1)source.start(startAt,this.playbackSpan.start+offset);else source.start(startAt,this.playbackSpan.start+offset,this.playbackSpan.end-this.playbackSpan.start-offset);}else source.start(startAt);if(Number.isFinite(plays)&&plays>1)source.stop(this.endAt);
   }catch(error){source.onended=null;try{source.stop();}catch{}source.disconnect();this.source=null;this.startedAt=null;this.clearEnvelope();throw error;}
   this.onState('Playing');return true;
  }catch(error){if(token!==this.generation)return false;this.onState('Could not play');throw new Error(edgeSettings&&!ctx.audioWorklet?'File-edge fades need a secure connection. Open the app over HTTPS in a supported browser.':'Playback could not start. Click Play to try again.');}
 }
 async playFiles({repeat,shape,volume,volumeRange,outputVolumeRange,pitchSemitones,sampledPitch,files,selectionMode,fades,auditionRange=null,startOffset=0}){
  this.stop();const token=this.generation,ctx=this.ensureContext(),signature=JSON.stringify([files.map(file=>[file.id,audioEditKey(file)]),selectionMode]);if(files.length>1&&signature!==this.fileSignature){this.fileCursor={};this.fileSignature=signature;}
  const plays=repeat?.mode==='forever'?Infinity:repeat?.mode==='count'?Math.max(1,Math.min(99,Math.round(repeat.count)||1)):1;
  this.onState('Starting');
  try{await ctx.resume();if(token!==this.generation)return false;if(fades?.length&&!await this.prepareFades(fades,token))return false;validatePitch(pitchSemitones);if(sampledPitch!==null)validatePitch(sampledPitch);if(!ctx.audioWorklet)throw new Error('AudioWorklet is unavailable.');
   if(!this.fileModule){const module=this.loadWorklet(ctx,new URL('./audio-files-worklet.js',import.meta.url)).catch(error=>{if(this.fileModule===module)this.fileModule=null;throw error;});this.fileModule=module;}await this.fileModule;if(token!==this.generation)return false;
   const channelSets=new Map();const buffers=files.map(file=>{const buffer=this.fileBuffers.get(file.id);if(!buffer||!(buffer.duration>0))throw new Error('A Sound file is not ready.');const sections=playbackSections(buffer,file,files.length===1?auditionRange:null),duration=sections.at(-1).timelineEnd/buffer.sampleRate;const length=playbackSections(buffer,file).at(-1).timelineEnd;return {id:file.id,edges:fileEdgeFrames(file.edgeFades,length,buffer.sampleRate),edgeOffsetFrame:files.length===1?Math.round((auditionRange?.start??0)*buffer.sampleRate):0,gain:fileGainAmplitude(file.gainDb??0),duration,offsetFrame:sections[0].offsetFrame,endFrame:sections[0].endFrame,sections,sampleRate:buffer.sampleRate,channels:channelSets.get(buffer)??(channelSets.set(buffer,Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i))),channelSets.get(buffer))};});
   if(files.length===1){this.buffer=this.fileBuffers.get(files[0].id);this.auditionRange=auditionRange?{...auditionRange}:null;this.playbackSpan={start:0,end:buffers[0].duration};}
   for(const setting of [volumeRange,outputVolumeRange])if(setting){const range=validateVolumeRange(setting.range);if(!Number.isFinite(setting.initialDb)||setting.initialDb<range.minDb||setting.initialDb>range.maxDb)throw new Error('Invalid sampled volume.');}
   this.preserveFileOrder=files.length===1;this.playbackRate=semitonesToRate(pitchSemitones+(sampledPitch??0));this.pitchSample=sampledPitch;const startAt=ctx.currentTime+.02,config={files:buffers,mode:selectionMode,state:this.preserveFileOrder?{}:this.fileCursor,seed:Math.floor(Math.random()*4294967296),startAt,rate:this.playbackRate,plays,volumeRange,outputVolumeRange,startOffset:files.length===1&&!auditionRange?Math.max(0,Math.min(buffers[0].duration-1/buffers[0].sampleRate,Math.round((Number.isFinite(startOffset)?startOffset:0)*buffers[0].sampleRate)/buffers[0].sampleRate)):0};
   this.playVolume=volume;this.releaseShape=shapeSettings(shape?.out);
   const node=this.createFileNode(ctx,{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[Math.max(...buffers.map(file=>file.channels.length))],processorOptions:{...config,deferStart:true}});this.source=node;this.fileNode=node;this.fileStopAt=Infinity;node.stop=time=>{this.fileStopAt=time??ctx.currentTime;node.parameters.get('stopAt').setValueAtTime(this.fileStopAt,ctx.currentTime);};
   let readyResolve;const ready=new Promise(resolve=>readyResolve=resolve);this.cancelFileReady=()=>readyResolve(false);
   node.port.onmessage=event=>{if(token!==this.generation||this.source!==node)return;if(event.data?.type==='ready'){readyResolve(true);return;}if(event.data?.type==='ended'){const stopped=this.releasing;this.commitFileOrder();this.source=null;this.startedAt=null;this.clearEnvelope();this.onState(stopped?'Stopped':'Finished');}else if(event.data?.type==='pass'){this.syncFiles();this.onState(this.releasing?'Releasing':'Playing');}};
   node.onprocessorerror=()=>{if(token!==this.generation||this.source!==node)return;this.stop();this.onState('Could not play');this.onError(new Error('File playback could not process audio. Press Play to try again.'));};
   // Connected but silent until the processor acknowledges its PCM transfer.
   node.connect(this.gain);if(!await ready||token!==this.generation)return false;this.cancelFileReady=null;node.disconnect();config.startAt=ctx.currentTime+.02;this.startedAt=config.startAt;this.fileRun=new FilePlaybackClock({...config,files:buffers.map(({id,duration})=>({id,duration}))});this.endAt=this.fileRun.endAt;node.port.postMessage({type:'start',startAt:config.startAt});
   const input=this.connectFades(node,{startAt:config.startAt,duration:1,plays,filePlan:{...config,files:buffers.map(({id,duration})=>({id,duration}))}},token,Math.max(...buffers.map(file=>file.channels.length)));const fadeIn=shapeSettings(shape?.in);if(fadeIn.enabled||this.releaseShape.enabled){this.envelopeGain=ctx.createGain();this.envelopeGain.connect(this.gain);input.connect(this.envelopeGain);if(fadeIn.enabled)this.scheduleEnvelope(fadeIn,config.startAt,0,1);}else input.connect(this.gain);
   this.syncFiles();this.updateVolume();this.onState('Playing');return true;
  }catch(error){if(token!==this.generation)return false;this.stop();this.onState('Could not play');console.warn('File processor could not start:',error?.message);throw new Error(!ctx.audioWorklet?'Joined audio and multi-file Events need a secure connection. Open the app over HTTPS in a supported browser.':'File playback could not start. Click Play to try again.',{cause:error});}
 }
 async playAmbient({ambientLoop,shape,volume,volumeRange,outputVolumeRange,pitchSemitones,sampledPitch,files,selectionMode,fades}){
  const settings=validateAmbientLoop(ambientLoop);if(!files?.length)return false;this.stop();const token=this.generation,ctx=this.ensureContext(),signature=JSON.stringify([files.map(file=>[file.id,audioEditKey(file)]),selectionMode]);
  if(signature!==this.fileSignature){this.fileCursor={};this.fileSignature=signature;}this.onState('Starting');
  try{
   await ctx.resume();if(token!==this.generation)return false;validatePitch(pitchSemitones);if(sampledPitch!==null)validatePitch(sampledPitch);if(!ctx.audioWorklet)throw Error('AudioWorklet is unavailable.');
   // Ambient handoffs own the inner envelopes; connected Fades shape the whole Event.
   if(fades?.length&&!await this.prepareFades(fades.map(fade=>({...fade,start:'trigger'})),token))return false;
   if(!this.ambientModule){const pending=this.loadWorklet(ctx,new URL('./audio-ambient-worklet.js',import.meta.url)).catch(error=>{if(this.ambientModule===pending)this.ambientModule=null;throw error;});this.ambientModule=pending;}await this.ambientModule;if(token!==this.generation)return false;
   for(const setting of [volumeRange,outputVolumeRange])if(setting){const range=validateVolumeRange(setting.range);if(!Number.isFinite(setting.initialDb)||setting.initialDb<range.minDb||setting.initialDb>range.maxDb)throw Error('Invalid sampled volume.');}
   const seed=Math.floor(Math.random()*4294967296),selected=chooseFile(files.map(file=>file.id),selectionMode,this.fileCursor,seededRandom(seed)),file=files.find(file=>file.id===selected.id),buffer=this.fileBuffers.get(file.id);if(!buffer)throw Error('The Ambient Loop file is not ready.');
   const sections=playbackSections(buffer,file),length=sections.at(-1).timelineEnd;if(length<2)throw Error('Ambient Loop needs at least two source frames.');
   const descriptor={id:file.id,sampleRate:buffer.sampleRate,sections,edges:fileEdgeFrames(file.edgeFades,length,buffer.sampleRate),gain:fileGainAmplitude(file.gainDb??0),channels:Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i))};
   this.buffer=buffer;this.activeFileId=file.id;this.playbackSpan={start:0,end:length/buffer.sampleRate};this.playbackRate=semitonesToRate(pitchSemitones+(sampledPitch??0));this.pitchSample=sampledPitch;this.playVolume=volume;this.releaseShape=shapeSettings(shape?.out);this.ambientSettings=settings;this.rangeDb=volumeRange?.initialDb??null;this.outputRangeDb=outputVolumeRange?.initialDb??null;
   const node=this.createAmbientNode(ctx,{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[buffer.numberOfChannels],processorOptions:{file:descriptor,settings,rate:this.playbackRate,seed:(seed^0x9e3779b9)>>>0,volumeRange,outputVolumeRange}});this.source=this.ambientNode=node;
   node.stop=time=>node.parameters.get('stopAt').setValueAtTime(time??ctx.currentTime,ctx.currentTime);
   let resolveReady;const ready=new Promise(resolve=>resolveReady=resolve);this.cancelFileReady=()=>resolveReady(false);
   node.port.onmessage=event=>{if(token!==this.generation||this.source!==node)return;const m=event.data;if(m?.type==='ready'){resolveReady(true);return;}if(m?.type==='ended'){const stopped=this.releasing;this.source=null;this.startedAt=null;this.clearEnvelope();this.onState(stopped?'Stopped':'Finished');return;}if(m?.type!=='state'||!Number.isFinite(m.time)||m.time<this.startedAt||!Number.isInteger(m.pass)||m.pass<0||!Number.isFinite(m.position)||m.position<0||m.position>=length/buffer.sampleRate)return;const valid=(db,setting)=>setting?Number.isFinite(db)&&db>=setting.range.minDb&&db<=setting.range.maxDb:db===null;if(!valid(m.db,volumeRange)||!valid(m.outputDb,outputVolumeRange))return;this.ambientSnapshot={...m};this.rangePass=m.pass;this.rangeDb=m.db;this.outputRangeDb=m.outputDb;this.onState(this.releasing?'Releasing':'Playing');};
   node.onprocessorerror=()=>{if(token!==this.generation||this.source!==node)return;this.stop();this.onState('Could not play');this.onError(Error('Ambient Loop could not process audio. Press Play to try again.'));};
   // Await the admitted PCM transfer before setting the actual shared start clock.
   node.connect(this.gain);if(!await ready||token!==this.generation)return false;this.cancelFileReady=null;node.disconnect();const startAt=ctx.currentTime+.02;this.startedAt=startAt;this.endAt=Infinity;
   const input=this.connectFades(node,{startAt,duration:1,plays:Infinity},token,buffer.numberOfChannels);this.envelopeGain=ctx.createGain();this.envelopeGain.connect(this.gain);input.connect(this.envelopeGain);const fadeIn=shapeSettings(shape?.in);if(fadeIn.enabled)this.scheduleEnvelope(fadeIn,startAt,0,1);
   node.port.postMessage({type:'start',startAt});this.fileCursor=selected.state;this.updateVolume();this.onState('Playing');return true;
  }catch(error){if(token!==this.generation)return false;this.stop();this.onState('Could not play');throw Error(!ctx.audioWorklet?'Ambient Loop needs HTTPS and AudioWorklet support.':error.message||'Ambient Loop could not start.');}
 }
 async prepareFileEdges(token){const ctx=this.context;if(!ctx.audioWorklet)throw new Error('AudioWorklet is unavailable.');if(!this.edgeModule){const module=this.loadWorklet(ctx,new URL('./audio-file-edges-worklet.js',import.meta.url)).catch(error=>{if(this.edgeModule===module)this.edgeModule=null;throw error;});this.edgeModule=module;}await this.edgeModule;return token===this.generation;}
 connectFileEdges(input,config,token){const node=this.createEdgeNode(this.context,{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[this.buffer.numberOfChannels??1],processorOptions:config});this.edgeNode=node;node.onprocessorerror=()=>{if(token!==this.generation||this.edgeNode!==node)return;this.stop();this.onState('Could not play');this.onError(new Error('File-edge fades could not process audio. Press Play to try again.'));};input.connect(node);return node;}
 async prepareFades(fades,token){
  if(!fades?.length)return token===this.generation;
  const ctx=this.context;if(!ctx.audioWorklet)throw new Error('AudioWorklet is unavailable.');
  if(!this.fadeModule){const module=this.loadWorklet(ctx,new URL('./audio-fade-worklet.js',import.meta.url)).catch(error=>{if(this.fadeModule===module)this.fadeModule=null;throw error;});this.fadeModule=module;}
  await this.fadeModule;if(token!==this.generation)return false;this.fadeSettings=fades.map(fade=>({...fade}));return true;
 }
 connectFades(input,clock,token,channels=this.buffer?.numberOfChannels??1){
  if(!this.fadeSettings.length)return input;
  const config={...clock,fades:this.fadeSettings};this.fadeClock=new FadeClock(config);const node=this.createFadeNode(this.context,{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[channels],processorOptions:config});this.fadeNode=node;
  node.onprocessorerror=()=>{if(token!==this.generation||this.fadeNode!==node)return;this.stop();this.onState('Could not play');this.onError(new Error('Fade could not process audio. Press Play to try again.'));};input.connect(node);return node;
 }
 // Prime the existing context in a user gesture, without creating a voice.
 unlock(){if(this.context?.state==='suspended')void this.context.resume().catch(()=>{});}
 setVolume(value){this.volume=Math.max(0,Math.min(maxVolumeGain,Number(value)||0));this.updateVolume();}
 setOutputVolume(value){this.outputVolume=Math.max(0,Math.min(maxVolumeGain,Number(value)||0));this.updateVolume();}
 updateVolume(){if(this.gain)this.gain.gain.setValueAtTime(this.volume*this.outputVolume*this.playVolume*(this.rangeNode||this.fileNode||this.ambientNode?1:dbToGain(this.rangeDb??0)*dbToGain(this.outputRangeDb??0)),this.context.currentTime);}
 effectiveVolume(){this.syncFiles();return this.volume*this.outputVolume*this.playVolume*dbToGain(this.rangeDb??0)*dbToGain(this.outputRangeDb??0);}
 sampledRange(){this.syncFiles();return this.source&&this.rangeDb!==null?{db:this.rangeDb,pass:this.rangePass}:null;}
 sampledOutputRange(){this.syncFiles();return this.source&&this.outputRangeDb!==null?{db:this.outputRangeDb,pass:this.rangePass}:null;}
 sampledPitchRange(){return this.source&&this.pitchSample!==null?{semitones:this.pitchSample,pass:0}:null;}
 // Display-only position within the current file, read from the audio clock.
 progress(){if(this.ambientNode){const m=this.ambientSnapshot,D=this.playbackSpan?.end;if(!m||!D)return 0;return circularPosition(m.position+Math.max(0,this.context.currentTime-m.time)*this.playbackRate,D)/D;}if(this.fileRun){const record=this.fileRun.step(Math.min(this.context.currentTime,this.fileStopAt-1e-7));return record?Math.max(0,Math.min(1,(this.context.currentTime-record.startAt)/(record.endAt-record.startAt))):0;}if(!this.source||this.startedAt===null||!this.buffer?.duration)return 0;const elapsed=Math.max(0,this.context.currentTime-this.startedAt),duration=(this.playbackSpan?this.playbackSpan.end-this.playbackSpan.start:this.buffer.duration)/this.playbackRate;return this.source.loop?(elapsed%duration)/duration:Math.min(1,elapsed/duration);}
 auditionPosition(){if(!this.source||this.startedAt===null)return null;return (this.auditionRange?.start??0)+this.progress()*(this.playbackSpan?this.playbackSpan.end-this.playbackSpan.start:this.buffer.duration);}
 scheduleEnvelope(settings,start,from,to){const values=shapeSamples(settings.curve,from,to),duration=shapeDuration(settings);this.envelopeGain.gain.setValueCurveAtTime(values,start,duration);this.envelope={values,start,duration};}
 release({shape=this.releaseShape}={}){
  if(this.releasing)return false;
  if(this.ambientNode){
   if(this.startedAt===null||this.context.currentTime<this.startedAt){this.stop();return false;}
   const now=this.context.currentTime;this.ambientNode.parameters.get('freeze').setValueAtTime(1,now);
   if(!this.fadeSettings.some(fade=>fade.direction==='out')&&!shapeSettings(shape).enabled){const level=sampleEnvelope(this.envelope,now),duration=this.ambientSettings.crossfadeMs/1000,values=Float32Array.from({length:128},(_,i)=>i===127?0:level*Math.cos(i/127*Math.PI/2));this.envelopeGain.gain.cancelScheduledValues(now);this.envelopeGain.gain.setValueCurveAtTime(values,now,duration);this.envelope={values,start:now,duration};this.releaseAt=now;this.source.stop(now+duration);this.releasing=true;this.onState('Releasing');return true;}
  }
  if(this.fadeNode&&(!this.ambientNode||this.fadeSettings.some(fade=>fade.direction==='out'))){const outs=this.fadeSettings.filter(fade=>fade.direction==='out'),now=this.context.currentTime;if(!this.source||!outs.length||this.endAt<=now){this.stop();return false;}
   try{this.releaseAt=now;this.rangeNode?.parameters.get('freeze').setValueAtTime(1,now);this.fileRun?.freeze(now);this.fileNode?.parameters.get('freeze').setValueAtTime(1,now);this.fadeNode.parameters.get('releaseAt').setValueAtTime(now,now);this.source.stop(Math.min(this.endAt,now+Math.min(...outs.map(fade=>fade.duration))));this.releasing=true;this.onState('Releasing');return true;}catch(error){this.stop();throw new Error('The fade could not start. Playback stopped.');}}
  const settings=shapeSettings(shape);
  if(!this.source||!settings.enabled||!this.envelopeGain){this.stop();return false;}
  const now=this.context.currentTime,level=sampleEnvelope(this.envelope,now);
  if(level<=0||this.endAt<=now){this.stop();return false;}
  try{
   this.releaseAt=now;this.rangeNode?.parameters.get('freeze').setValueAtTime(1,now);
   this.fileRun?.freeze(now);this.fileNode?.parameters.get('freeze').setValueAtTime(1,now);
   // Cancel the in-flight fade before scheduling a release from its current level.
   this.envelopeGain.gain.cancelScheduledValues(now);this.scheduleEnvelope(settings,now,level,0);
   this.source.stop(Math.min(this.endAt,now+shapeDuration(settings)));this.releasing=true;this.onState('Releasing');return true;
  }catch(error){this.stop();throw new Error('The fade could not start. Playback stopped.');}
 }
 clearEnvelope(){if(this.ambientNode){this.ambientNode.port.onmessage=null;this.ambientNode.onprocessorerror=null;this.ambientNode.port.postMessage({type:'dispose'});this.ambientNode.port.close();this.ambientNode.disconnect();}this.ambientNode=null;this.ambientSettings=null;this.ambientSnapshot=null;if(this.edgeNode){this.edgeNode.onprocessorerror=null;this.edgeNode.port.postMessage({type:"dispose"});this.edgeNode.port.close();this.edgeNode.disconnect();}this.edgeNode=null;if(this.fadeNode){this.fadeNode.onprocessorerror=null;this.fadeNode.port.postMessage({type:"dispose"});this.fadeNode.port.close();this.fadeNode.disconnect();}this.fadeNode=null;this.fadeClock=null;this.fadeSettings=[];this.cancelFileReady?.();this.cancelFileReady=null;if(this.fileNode){this.fileNode.port.onmessage=null;this.fileNode.onprocessorerror=null;this.fileNode.port.postMessage({type:'dispose'});this.fileNode.port.close();this.fileNode.disconnect();}this.fileNode=null;this.fileRun=null;this.preserveFileOrder=false;this.activeFileId=null;if(this.rangeNode){this.rangeNode.port.onmessage=null;this.rangeNode.onprocessorerror=null;this.rangeNode.port.postMessage({type:'dispose'});this.rangeNode.port.close();this.rangeNode.disconnect();}this.rangeNode=null;this.rangeDb=null;this.outputRangeDb=null;this.rangePass=0;this.playbackRate=1;this.pitchSample=null;this.releaseAt=null;if(this.envelopeGain){this.envelopeGain.gain.cancelScheduledValues(this.context.currentTime);this.envelopeGain.disconnect();}this.envelopeGain=null;this.envelope=null;this.releasing=false;this.endAt=Infinity;this.releaseShape=null;this.playVolume=1;this.updateVolume();}
 stop(){this.commitFileOrder();this.generation++;const source=this.source;this.source=null;this.startedAt=null;this.auditionRange=null;this.playbackSpan=null;if(source){source.onended=null;try{source.stop();}finally{source.disconnect();}}this.clearEnvelope();this.onState(this.buffer?'Stopped':'No file');}
 clear(){this.stop();this.buffer=null;this.fileBuffers.clear();this.fileData.clear();this.resetFileOrder();this.onState('No file');}
 dispose(){this.cacheGeneration++;this.eventOrders.clear();this.clear();this.gain?.disconnect();const ctx=this.context;this.gain=null;this.context=null;this.rangeModule=null;this.fileModule=null;this.fadeModule=null;this.edgeModule=null;if(ctx&&ctx.state!=='closed')void ctx.close().catch(()=>{});}
}
