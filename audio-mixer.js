// One voice per Event, one shared AudioContext and decoded-file cache.
// AudioPlayer remains responsible for each voice's timing, DSP and cancellation.
export class AudioMixer {
 constructor(Player,{fileIds,onState=()=>{},onError=()=>{}}){
  this.Player=Player;this.fileIds=fileIds;this.onState=onState;this.onError=onError;this.players=new Map();this.modules=new Map();
  this.root=new Player(undefined,label=>{if(this.disposing)return;if(label==='Loading')for(const player of this.players.values())if(!player.source)player.status=label;onState(label,null);},undefined,error=>onError(error,null));
 }
 player(id){
  if(id==null||this.disposing)return this.root;
  if(!this.players.has(id)){
   const player=new this.Player(()=>this.root.ensureContext(),label=>{player.status=label;if(!this.disposing)this.onState(label,id);},undefined,error=>this.onError(error,id));
   player.fileBuffers=this.root.fileBuffers;player.fileData=this.root.fileData;player.buffer=this.root.fileBuffers.get(this.fileIds(id)[0])??null;player.status=player.buffer?'Ready':'No file';
   player.loadWorklet=(context,url)=>this.loadWorklet(context,url);this.players.set(id,player);
  }
  return this.players.get(id);
 }
 loadWorklet(context,url){
  const key=String(url);if(!this.modules.has(key)){const pending=Promise.resolve().then(()=>context.audioWorklet.addModule(url)).catch(error=>{if(this.modules.get(key)===pending)this.modules.delete(key);throw error;});this.modules.set(key,pending);}return this.modules.get(key);
 }
 refresh(){
  for(const [id,player] of this.players){
   player.fileBuffers=this.root.fileBuffers;player.fileData=this.root.fileData;
   if(!player.source&&!['Starting','Releasing'].includes(player.status)){
    const buffer=this.root.fileBuffers.get(this.fileIds(id)[0])??null,changed=buffer!==player.buffer;player.buffer=buffer;if(buffer){player.ensureContext();player.updateVolume();}
    if(changed||['Loading','No file','Could not load'].includes(player.status)){player.status=buffer?'Ready':'No file';this.onState(player.status,id);}
   }
  }
 }
 async loadFiles(files){const loaded=await this.root.loadFiles(files);if(loaded)this.refresh();return loaded;}
 async cacheFiles(files,isCurrent,forceIds){const loaded=await this.root.cacheFiles(files,isCurrent,forceIds);if(loaded)this.refresh();return loaded;}
 unlock(){this.root.unlock();}
 stopWhere(predicate){for(const [id,player] of this.players)if(predicate(id))player.stop();}
 stopAll(){this.stopWhere(()=>true);}
 activeCount(){return [...this.players.values()].filter(player=>player.source||player.status==='Starting').length;}
 clear(){this.stopAll();this.root.clear();for(const [id,player] of this.players){player.buffer=null;player.status='No file';this.onState('No file',id);}this.refresh();}
 remove(id){const player=this.players.get(id);if(!player)return false;player.stop();player.buffer=null;player.gain?.disconnect();player.gain=null;player.context=null;player.rangeModule=null;player.fileModule=null;player.fadeModule=null;player.edgeModule=null;player.ambientModule=null;player.eventOrders.clear();this.players.delete(id);return true;}
 dispose(){
  this.disposing=true;for(const player of this.players.values()){player.stop();player.buffer=null;player.gain?.disconnect();player.gain=null;player.context=null;player.rangeModule=null;player.fileModule=null;player.fadeModule=null;player.edgeModule=null;player.ambientModule=null;player.eventOrders.clear();}
  this.players.clear();this.modules.clear();this.root.dispose();this.disposing=false;this.onState('No file',null);
 }
}
