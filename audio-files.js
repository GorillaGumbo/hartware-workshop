// Authored file membership is separate from the transient selection cursor.
export const maxSoundFiles=32;
export const selectionModes=['random','shuffle','sequence'];
export function soundFileIds(event){return event?.assetIds??(event?.assetId?[event.assetId]:[]);}
export function validateRandomizer(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['mode','connected','position'].includes(key))||!selectionModes.includes(value.mode)||typeof value.connected!=='boolean')throw new Error('Randomizer needs a valid mode and connection.');
 if(value.position!=null&&(typeof value.position!=='object'||Object.keys(value.position).some(key=>!['x','y'].includes(key))||!['x','y'].every(key=>Number.isFinite(value.position[key])&&Math.abs(value.position[key])<=10000)))throw new Error('Randomizer position is invalid.');
 return value;
}
export function validateSoundFiles(event,assets){
 if(Object.hasOwn(event,'assetIds')){const ids=event.assetIds;if(!Array.isArray(ids)||ids.length>maxSoundFiles||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!assets.some(asset=>asset.id===id&&asset.type==='audio'))||event.assetId!==(ids[0]??null))throw new Error('Sound needs up to 32 unique audio files in a valid order.');}
 if(Object.hasOwn(event,'randomizer'))validateRandomizer(event.randomizer);
}
export function isRandomizerConnection(connection,event){
 return !!event?.randomizer&&((connection.source==='randomizer'&&connection.sourceHandle==='files'&&connection.target==='sound'&&connection.targetHandle==='files')||(connection.target==='randomizer'&&connection.targetHandle==='files'&&connection.source==='sound'&&connection.sourceHandle==='files'));
}
export function seededRandom(seed){let value=seed>>>0;return ()=>{value=(value+0x6D2B79F5)>>>0;let t=Math.imul(value^(value>>>15),1|value);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
const copyCursor=state=>({index:state.index??0,bag:[...(state.bag??[])]});
export function chooseFile(ids,mode,state={},random=Math.random){
 if(!ids.length)throw new Error('Sound has no files.');
 const next={index:state.index??0,bag:[...(state.bag??[])]};let id;
 if(mode==='sequence'){id=ids[next.index%ids.length];next.index=(next.index+1)%ids.length;}
 else if(mode==='shuffle'){if(!next.bag.length){next.bag=[...ids];for(let i=next.bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[next.bag[i],next.bag[j]]=[next.bag[j],next.bag[i]];}}id=next.bag.shift();}
 else id=mode==='random'?ids[Math.floor(random()*ids.length)]:ids[0];
 return {id,state:next};
}
// The main thread and processor replay the same seeded plan. UI reads never call Math.random.
export class FilePlaybackClock {
 constructor({files,mode=null,state={},seed=1,startAt=0,rate=1,plays=1,startOffset=0,volumeRange=null,outputVolumeRange=null}){
  this.files=files;this.mode=mode;this.initialState=copyCursor(state);this.state=copyCursor(state);this.random=seededRandom(seed);this.startAt=startAt;this.rate=rate;this.plays=plays;this.volumeRange=volumeRange;this.outputVolumeRange=outputVolumeRange;this.pass=0;this.frozen=null;this.ended=false;this.records=[];
  this.current=this.makeRecord(startAt-(Number.isFinite(startOffset)?Math.max(0,Math.min(files[0].duration-1e-9,startOffset)):0)/rate,0);if(Number.isFinite(plays)){this.records.push(this.current);for(let i=1;i<plays;i++)this.records.push(this.makeRecord(this.records[i-1].endAt,i));this.endAt=this.records.at(-1).endAt;}else this.endAt=Infinity;
 }
 makeRecord(startAt,pass){const selection=chooseFile(this.files.map(file=>file.id),this.mode,this.state,this.random);this.state=selection.state;const file=this.files.find(file=>file.id===selection.id),sample=setting=>setting?(pass===0?setting.initialDb:setting.range.minDb+this.random()*(setting.range.maxDb-setting.range.minDb)):null;return {id:file.id,startAt,endAt:startAt+file.duration/this.rate,pass,state:copyCursor(this.state),db:sample(this.volumeRange),outputDb:sample(this.outputVolumeRange)};}
 step(time){if(time<this.startAt)return null;while(time+1e-9>=this.current.endAt&&!this.ended){if(this.pass+1>=this.plays){this.ended=true;break;}this.pass++;this.current=this.records.length?this.records[this.pass]:this.makeRecord(this.current.endAt,this.pass);}return this.ended?null:this.current;}
 cursor(time){if(time<this.startAt)return copyCursor(this.initialState);this.step(time);return copyCursor(this.current.state);}
 freeze(time){this.step(time);if(!this.frozen)this.frozen={db:this.current.db,outputDb:this.current.outputDb};}
 values(){return this.frozen??this.current;}
}
