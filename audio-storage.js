// Original bytes are separate from authored project metadata. No object URLs serialize.
export const AUDIO_PREFIX='audio-blob:';
export const limits=Object.freeze({file:128*1024*1024,project:512*1024*1024,manifest:24*1024*1024,pcm:128*1024*1024,inline:1024*1024});
export const isAudioRef=value=>typeof value==='string'&&/^audio-blob:[a-zA-Z0-9-]{1,100}$/.test(value);
export const cancelled=()=>Object.assign(new Error('Cancelled.'),{name:'AbortError'});
export function assertCurrent(current){if(!current())throw cancelled();}
export const pcmBytes=buffer=>(buffer.length??Math.ceil(buffer.duration*buffer.sampleRate))*buffer.numberOfChannels*4;
export function legacyBytes(data){const raw=atob(data.split(',')[1]);return Uint8Array.from(raw,c=>c.charCodeAt(0)).buffer;}
export function originalBlob(asset,blobs){if(isAudioRef(asset.data)){const blob=blobs.get(asset.data);if(!blob||blob.size!==asset.bytes)throw new Error(`Original audio is missing: ${asset.name}.`);return blob;}return new Blob([legacyBytes(asset.data)],{type:asset.data.slice(5,asset.data.indexOf(';'))});}
export function projectBlobs(project,blobs){const result=new Map();for(const a of project.assets)if(a.type==='audio'&&isAudioRef(a.data))result.set(a.data,originalBlob(a,blobs));return result;}
export function checkAssetBudget(assets){if(assets.length>100)throw new Error('A project can contain up to 100 files.');const refs=new Map(),bytes=assets.reduce((n,a)=>{if(a.bytes!=null&&(!Number.isSafeInteger(a.bytes)||a.bytes<0))throw new Error('Invalid original file size.');if(a.type==='audio'&&isAudioRef(a.data)){if(refs.has(a.data)){if(refs.get(a.data)!==a.bytes)throw new Error('Conflicting original audio sizes.');return n;}refs.set(a.data,a.bytes);}return n+(a.bytes??0);},0);if(bytes>limits.project)throw new Error('Keep original project files under 512 MiB total.');}
export class SerialDecoder {
 constructor(){this.tail=Promise.resolve();this.active=0;this.peak=0;}
 run(read,decode,current=()=>true){const job=this.tail.then(async()=>{assertCurrent(current);this.active++;this.peak=Math.max(this.peak,this.active);try{const bytes=await read();assertCurrent(current);const buffer=await decode(bytes);assertCurrent(current);if(!Number.isFinite(pcmBytes(buffer))||pcmBytes(buffer)>limits.pcm)throw new Error('Decoded audio exceeds 128 MiB. Use a shorter or lower-rate recording.');return buffer;}finally{this.active--;}});this.tail=job.catch(()=>{});return job;}
}
const magic=new TextEncoder().encode('LOVELYUI6\n');
export function packProject(project,blobs){
 checkAssetBudget(project.assets);const refs=projectBlobs(project,blobs),json=new TextEncoder().encode(JSON.stringify(project));if(json.length>limits.manifest)throw new Error('Project metadata is too large (24 MiB limit).');
 const length=new Uint8Array(4);new DataView(length.buffer).setUint32(0,json.length,true);return new Blob([magic,length,json,...refs.values()],{type:'application/x-lovely-ui'});
}
export async function unpackProject(file,validate,current=()=>true,progress=()=>{}){
 if(file.size>limits.project+limits.manifest+14)throw new Error('Project file exceeds the 512 MiB asset limit.');
 if(typeof file.slice!=='function'){const text=await file.text();assertCurrent(current);if(text.length>limits.manifest)throw new Error('Legacy JSON project exceeds the 24 MiB limit.');const project=validate(JSON.parse(text));if(project.assets.some(asset=>isAudioRef(asset.data)))throw new Error('This project needs its original .lovely-ui binary file.');return {project,blobs:new Map()};}
 progress('Reading project…');const head=new Uint8Array(await file.slice(0,14).arrayBuffer());assertCurrent(current);
 if(!magic.every((b,i)=>head[i]===b)){
  if(file.size>limits.manifest)throw new Error('Legacy JSON project exceeds the 24 MiB limit.');const project=validate(JSON.parse(await file.text()));assertCurrent(current);if(project.assets.some(asset=>isAudioRef(asset.data)))throw new Error('This project needs its original .lovely-ui binary file.');return {project,blobs:new Map()};
 }
 const size=new DataView(head.buffer).getUint32(10,true);if(!size||size>limits.manifest||size>file.size-14)throw new Error('Project header is invalid.');
 const project=validate(JSON.parse(await file.slice(14,14+size).text()));assertCurrent(current);if(![6,7,8,9,10,11,12,13,14,15,16].includes(project.version))throw new Error('Project manifest version is invalid.');
 let offset=14+size;const blobs=new Map();for(const a of project.assets)if(a.type==='audio'&&isAudioRef(a.data)&&!blobs.has(a.data)){if(offset+a.bytes>file.size)throw new Error(`Original audio is truncated: ${a.name}.`);blobs.set(a.data,file.slice(offset,offset+a.bytes,a.mime??''));offset+=a.bytes;}
 if(offset!==file.size)throw new Error('Project contains unexpected trailing bytes.');checkAssetBudget(project.assets);return {project,blobs};
}
// Both manifest and blobs commit in one transaction. A failed write retains the old snapshot.
export class ProjectRecovery {
 constructor(indexedDB=globalThis.indexedDB){this.indexedDB=indexedDB;this.opening=null;this.tail=Promise.resolve();this.knownBlobs=new Map();}
 async db(){if(!this.indexedDB)throw new Error('Browser recovery storage is unavailable.');if(!this.opening)this.opening=new Promise((resolve,reject)=>{const req=this.indexedDB.open('lovely-ui-recovery',1);let settled=false;const timer=setTimeout(()=>fail(new Error('Browser recovery storage did not respond.')),10000);const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error);};req.onupgradeneeded=()=>{for(const name of ['project','audio'])if(!req.result.objectStoreNames.contains(name))req.result.createObjectStore(name);};req.onblocked=()=>fail(new Error('Close other HärtWare tabs to update recovery storage.'));req.onerror=()=>fail(req.error);req.onsuccess=()=>{if(settled){req.result.close();return;}settled=true;clearTimeout(timer);const db=req.result;db.onversionchange=()=>{db.close();this.opening=null;};resolve(db);};}).catch(error=>{this.opening=null;throw error;});return this.opening;}
 save(project,blobs){const captured=projectBlobs(project,blobs);const job=this.tail.then(async()=>{const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction(['project','audio'],'readwrite'),audio=tx.objectStore('audio'),keys=audio.getAllKeys();keys.onsuccess=()=>{try{const old=new Set(keys.result);for(const [key,blob] of captured)if(this.knownBlobs.get(key)!==blob)audio.put(blob,key);for(const key of old)if(!captured.has(key))audio.delete(key);tx.objectStore('project').put(project,'current');}catch(error){try{tx.abort();}catch{}reject(error);}};tx.oncomplete=()=>{this.knownBlobs=captured;resolve();};tx.onabort=tx.onerror=()=>reject(tx.error??new Error('Recovery write failed.'));});});this.tail=job.catch(()=>{});return job;}
 async load(){await this.tail;const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction(['project','audio'],'readonly'),request=tx.objectStore('project').get('current'),blobs=new Map();let project;request.onsuccess=()=>{project=request.result;if(project)for(const a of project.assets)if(isAudioRef(a.data)){const req=tx.objectStore('audio').get(a.data);req.onsuccess=()=>blobs.set(a.data,req.result);}};tx.oncomplete=()=>{try{if(project)projectBlobs(project,blobs);this.knownBlobs=new Map(blobs);resolve(project?{project,blobs}:null);}catch(error){reject(error);}};tx.onabort=tx.onerror=()=>reject(tx.error??new Error('Recovery read failed.'));});}
}
