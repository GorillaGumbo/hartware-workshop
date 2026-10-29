import {validateTrim} from './audio-edits.js';
import {checkAssetBudget} from './audio-storage.js';
export const maxPoolSounds=32;
export const poolForAsset=(project,id)=>(project.soundPools??[]).find(pool=>pool.assetIds.includes(id));
export function validatePools(project){
 const pools=project.soundPools;if(!Array.isArray(project.assets)||!Array.isArray(pools)||!pools.length||pools.length>32)throw Error('Keep between 1 and 32 sound pools.');
 const ids=new Set(),names=new Set(),members=new Set();
 for(const pool of pools){
  if(!pool||Object.keys(pool).sort().join(',')!=='assetIds,id,name,sourceId'||typeof pool.id!=='string'||!pool.id||pool.id.length>100||ids.has(pool.id)||typeof pool.name!=='string'||pool.name!==pool.name.trim()||!pool.name||pool.name.length>80||/[\\/\u0000-\u001f\u007f]/.test(pool.name)||names.has(pool.name.toLowerCase())||!Array.isArray(pool.assetIds)||pool.assetIds.length>maxPoolSounds)throw Error('A sound pool is invalid.');
  ids.add(pool.id);names.add(pool.name.toLowerCase());
  const source=project.assets.find(a=>a.id===pool.sourceId);if(!source?.data||source.type!=='audio'||!Number.isFinite(source.duration))throw Error('A sound pool needs its original recording.');
  for(const id of pool.assetIds){const asset=project.assets.find(a=>a.id===id);if(typeof id!=='string'||members.has(id)||id===source.id||!asset||asset.type!=='audio'||asset.data!==source.data||asset.duration!==source.duration||asset.bytes!==source.bytes||!asset.trim||asset.segments||asset.sections||asset.crossfadeMs)throw Error('Pool snippets need independent trims of the same original recording.');validateTrim(asset.trim,source.duration);members.add(id);}
 }
 if(pools.some(pool=>members.has(pool.sourceId)))throw Error('A pool snippet cannot be another pool’s source.');
 return pools;
}
export function createSoundPool(project,sourceId,id){
 const source=project.assets.find(a=>a.id===sourceId);if(!source?.data||source.type!=='audio'||poolForAsset(project,sourceId))throw Error('Choose an original recording to create a pool.');
 const existing=(project.soundPools??[]).find(p=>p.sourceId===sourceId);if(existing)return existing;
 const base=(source.name.replace(/\.[^.]+$/,'').replace(/[\\/\u0000-\u001f\u007f]/g,'_').trim()||'Recording').slice(0,65)+' snippets';let name=base,index=2;while((project.soundPools??[]).some(p=>p.name.toLowerCase()===name.toLowerCase()))name=base+' '+index++;
 const pool={id,name,sourceId,assetIds:[]},next={...project,soundPools:[...(project.soundPools??[]),pool]};validatePools(next);project.soundPools=next.soundPools;return pool;
}
export function createPoolSnippet(project,poolId,selection,id){
 const pool=project.soundPools?.find(p=>p.id===poolId),source=project.assets.find(a=>a.id===pool?.sourceId);if(!pool||!source)throw Error('This pool is no longer available.');if(pool.assetIds.length>=maxPoolSounds)throw Error('A pool can contain up to 32 snippets.');validateTrim(selection,source.duration);
 const ext=source.name.match(/\.[^.]+$/)?.[0]??'.wav',base='Snippet',used=new Set([...project.assets.map(a=>a.name),'main.lua','conf.lua',project.scriptName??'main.lua'].map(n=>n.toLowerCase()));let index=pool.assetIds.length+1,name;do{name=base+' '+String(index++).padStart(2,'0')+ext;}while(used.has(name.toLowerCase()));
 const asset={id,name,type:'audio',data:source.data,bytes:source.bytes,duration:source.duration,trim:{...selection},...(source.mime?{mime:source.mime}:{}),...(source.pcmBytes?{pcmBytes:source.pcmBytes}:{})};
 const next={...project,assets:[...project.assets,asset],soundPools:project.soundPools.map(p=>p===pool?{...pool,assetIds:[...pool.assetIds,id]}:p)};checkAssetBudget(next.assets);validatePools(next);project.assets=next.assets;pool.assetIds.push(id);return asset;
}
export function renamePool(project,id,name){const pool=project.soundPools?.find(p=>p.id===id);if(!pool)throw Error('This pool is no longer available.');const next={...project,soundPools:project.soundPools.map(p=>p===pool?{...p,name}:p)};validatePools(next);pool.name=name;}
export function prunePools(project){if(!project.soundPools)return;for(const pool of project.soundPools)pool.assetIds=pool.assetIds.filter(id=>project.assets.some(a=>a.id===id));if(!project.soundPools.length)delete project.soundPools;}
// Pool trimming keeps the whole original available as handles, with existing per-sound history.
export function trimSnippet(history,asset,bounds){validateTrim(bounds,asset.duration);return history.change(asset,bounds,asset.duration);}
