/* The Lua VM lives in a terminable worker so Stop stays available. */
self.window = self;
importScripts('vendor/fengari-web.js');
importScripts('love-math.js');
const {lua, lauxlib, lualib, to_luastring, to_jsstring} = self.fengari;
let sourceName='main.lua',sourceFiles=new Map(),sourceAliases=new Map(),fileAliases=new Map();
let L, commands=[], keyset=new Set(), previousKeys=new Set(), imageAssets={}, width=800, height=600;
let color=[1,1,1,1], background=[.045,.055,.06,1], fontSize=18, deadline=0, logCount=0, audioCount=0;
const str=(s)=>to_luastring(String(s));
const getString=(l,i)=>to_jsstring(lauxlib.luaL_checkstring(l,i));
const num=(l,i,d=0)=>lua.lua_isnoneornil(l,i)?d:lauxlib.luaL_checknumber(l,i);
const fail=(l,msg)=>{lua.lua_pushstring(l,str(msg));return lua.lua_error(l);};
function pushCommand(type,args){if(commands.length>=2000)return fail(L,'Too many drawing commands in one frame.');commands.push({type,args,color:[...color],fontSize});}
function addFunction(name,fn){lua.lua_pushcfunction(L,fn);lua.lua_setfield(L,-2,str(name));}
function setGlobalFunction(name,fn){lua.lua_pushcfunction(L,fn);lua.lua_setglobal(L,str(name));}
function assetPath(l,index){if(lua.lua_istable(l,index)){lua.lua_getfield(l,index,str('_path'));const s=getString(l,-1);lua.lua_pop(l,1);return s;}return getString(l,index);}
function callLua(nargs){const at=lua.lua_gettop(L)-nargs;lua.lua_pushcfunction(L,l=>{const msg=lua.lua_tostring(l,1);lauxlib.luaL_traceback(l,l,msg,1);return 1;});lua.lua_insert(L,at);const status=lua.lua_pcall(L,nargs,0,at);lua.lua_remove(L,at);return status;}
function callback(name,args=[]){const top=lua.lua_gettop(L);lua.lua_getglobal(L,str('love'));lua.lua_getfield(L,-1,str(name));if(lua.lua_isfunction(L,-1)){for(const x of args)typeof x==='number'?lua.lua_pushnumber(L,x):typeof x==='boolean'?lua.lua_pushboolean(L,x):lua.lua_pushstring(L,str(x));deadline=Date.now()+45;const status=callLua(args.length);if(status!==lua.LUA_OK){const message=lua.lua_tostring(L,-1);lua.lua_settop(L,top);throw new Error(message?to_jsstring(message):'Lua stopped with an error.');}}lua.lua_settop(L,top);}
// Read only a small, known schema. lua_next ignores metatables; no Lua callbacks,
// arbitrary recursive conversion, handles or references can cross the worker boundary.
function audioOptions(l,index,path='lyd.audio.play options'){
 if(lua.lua_type(l,index)!==lua.LUA_TTABLE)throw new Error(`${path} must be a settings table (fades also accept false).`);
 const top=lua.lua_gettop(l),at=lua.lua_absindex(l,index),result={},isFade=path!=='lyd.audio.play options',allowed=isFade?['duration','curve','speed']:['volumeDb','fadeIn','fadeOut'];
 try{
  lua.lua_pushnil(l);
  while(lua.lua_next(l,at)){
   if(lua.lua_type(l,-2)!==lua.LUA_TSTRING||lua.lua_rawlen(l,-2)>32)throw new Error(`Unknown ${path} setting; use named fields.`);
   const key=to_jsstring(lua.lua_tostring(l,-2)),type=lua.lua_type(l,-1);
   if(!allowed.includes(key))throw new Error(`Unknown ${path} setting "${key}".`);
   if(key==='fadeIn'||key==='fadeOut'){
    if(type===lua.LUA_TBOOLEAN&&!lua.lua_toboolean(l,-1))result[key]=false;
    else result[key]=audioOptions(l,-1,key);
   }else if(key==='curve'||key==='speed'){
    if(type!==lua.LUA_TSTRING||lua.lua_rawlen(l,-1)>32)throw new Error(key==='curve'?`${path}.curve must be "straight", "rounded" or "smooth".`:`${path}.speed must be "fast", "medium" or "slow".`);
    result[key]=to_jsstring(lua.lua_tostring(l,-1));
   }else{
    if(type!==lua.LUA_TNUMBER)throw new Error(`${isFade?path+'.':''}${key} must be a number.`);
    result[key]=lua.lua_tonumber(l,-1);
   }
   lua.lua_pop(l,1);
  }
  return result;
 }finally{lua.lua_settop(l,top);}
}
function installMath(){
 const rngObjects=new WeakMap(),globalRng=new self.LovelyMath.RandomGenerator();globalRng.setSeed(Date.now());
 const optional=(l,i)=>lua.lua_isnoneornil(l,i)?undefined:num(l,i);
 function invoke(l,rng,method,start){
  try{
   if(method==='random'||method==='randomNormal'){const value=rng[method](optional(l,start),optional(l,start+1));lua.lua_pushnumber(l,value);return 1;}
   if(method==='setSeed'){rng.setSeed(lauxlib.luaL_checknumber(l,start),optional(l,start+1));return 0;}
   if(method==='getSeed'){for(const value of rng.getSeed())lua.lua_pushnumber(l,value);return 2;}
   if(method==='getState'){lua.lua_pushstring(l,str(rng.getState()));return 1;}
   if(method==='setState'){rng.setState(getString(l,start));return 0;}
  }catch(error){if(typeof error?.message!=='string')throw error;return fail(l,error.message);}
 }
 lua.lua_newtable(L);
 for(const [name,method] of Object.entries({random:'random',randomNormal:'randomNormal',setRandomSeed:'setSeed',getRandomSeed:'getSeed',setRandomState:'setState',getRandomState:'getState'}))addFunction(name,l=>invoke(l,globalRng,method,1));
 addFunction('newRandomGenerator',l=>{
  const rng=new self.LovelyMath.RandomGenerator();try{if(!lua.lua_isnoneornil(l,1))rng.setSeed(num(l,1),optional(l,2));}catch(error){if(typeof error?.message!=='string')throw error;return fail(l,error.message);}
  lua.lua_newtable(l);rngObjects.set(lua.lua_topointer(l,-1),rng);
  for(const method of ['random','randomNormal','setSeed','getSeed','setState','getState']){lua.lua_pushcfunction(l,ll=>{const receiver=lua.lua_istable(ll,1)?rngObjects.get(lua.lua_topointer(ll,1)):null;return receiver?invoke(ll,receiver,method,2):fail(ll,'Use a RandomGenerator receiver, for example rng:'+method+'(...).');});lua.lua_setfield(l,-2,str(method));}
  return 1;
 });
 lua.lua_setfield(L,-2,str('math'));
}
function admitScripts(message){
 sourceName=message.sourceName??'main.lua';sourceFiles=new Map();sourceAliases=new Map([['__lovely_script__',sourceName]]);fileAliases=new Map([[sourceName,'__lovely_script__']]);
 const files=message.scripts??[{name:sourceName,code:message.code}];let total=0,index=0;const names=new Set();
 if(!Array.isArray(files)||!files.length||files.length>64)throw Error('A preview supports up to 64 Lua files.');
 for(const file of files){if(typeof file?.name!=='string'||!file.name||file.name.length>160||/[\\/\u0000-\u001f\u007f]/.test(file.name)||names.has(file.name.toLowerCase())||typeof file.code!=='string'||file.code.length>500000||(total+=file.code.length)>2000000)throw Error('The Lua file list is invalid or exceeds the source limit.');names.add(file.name.toLowerCase());sourceFiles.set(file.name,file.code);if(file.name!==sourceName){const alias='__lovely_module_'+(++index)+'__';sourceAliases.set(alias,file.name);fileAliases.set(file.name,alias);}}
 if(sourceFiles.get(sourceName)!==message.code)throw Error('The entry script snapshot is inconsistent.');
}
function displayLuaMessage(message){let result=String(message);for(const [alias,name] of sourceAliases)result=result.replaceAll(alias+':',name+':');return result;}
function compileProjectFile(l,path){
 const code=sourceFiles.get(path);if(code===undefined){lua.lua_pushnil(l);lua.lua_pushstring(l,str('Project Lua file not found: '+path));return 2;}
 const bytes=str(code),status=lauxlib.luaL_loadbufferx(l,bytes,bytes.length,str('@'+fileAliases.get(path)),str('t'));
 if(status===lua.LUA_OK)return 1;
 lua.lua_pushnil(l);lua.lua_insert(l,-2);return 2;
}
function installProjectLoader(){
 setGlobalFunction('__lovely_project_module',l=>{const name=getString(l,1);return compileProjectFile(l,name.replaceAll('.','/')+'.lua');});
 const bootstrap=`local read = __lovely_project_module
__lovely_project_module = nil
local loaded, loading = {}, {}
local type, error, pcall = type, error, pcall
function require(name)
  if type(name) ~= "string" then error("require needs a module name string", 2) end
  if loaded[name] then return loaded[name] end
  if loading[name] then error("Circular require: " .. name, 2) end
  local loader, message = read(name)
  if not loader then error(message, 0) end
  loading[name] = true
  local ok, result = pcall(loader, name)
  loading[name] = nil
  if not ok then error(result, 0) end
  if result == nil then result = true end
  loaded[name] = result
  return result
end`;
 const bytes=str(bootstrap);if(lauxlib.luaL_loadbuffer(L,bytes,bytes.length,str('@__lovely_loader__'))!==lua.LUA_OK||callLua(0)!==lua.LUA_OK)throw Error(to_jsstring(lua.lua_tostring(L,-1)));
}
function setup(){
 if(L)lua.lua_close(L);L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L);
 for(const k of ['io','os','package','require','dofile','loadfile','fengari','debug']){lua.lua_pushnil(L);lua.lua_setglobal(L,str(k));}
 lua.lua_sethook(L,()=>{if(Date.now()>deadline)fail(L,'This code took too long. Check for a loop that never ends.');},lua.LUA_MASKCOUNT,10000);
 setGlobalFunction('print',l=>{if(logCount++<30){const parts=[];for(let i=1;i<=lua.lua_gettop(l);i++){const v=lauxlib.luaL_tolstring(l,i);parts.push(to_jsstring(v));lua.lua_pop(l,1);}postMessage({type:'log',message:displayLuaMessage(parts.join('\t'))});}return 0;});
 lua.lua_newtable(L);
 lua.lua_newtable(L);
 addFunction('newImage',l=>{const path=getString(l,1),a=imageAssets[path];if(!a||a.type!=='image')return fail(l,'Image not found: '+path);lua.lua_newtable(l);lua.lua_pushstring(l,str(path));lua.lua_setfield(l,-2,str('_path'));addFunction('getWidth',ll=>{lua.lua_pushnumber(ll,a.width);return 1;});addFunction('getHeight',ll=>{lua.lua_pushnumber(ll,a.height);return 1;});return 1;});
 addFunction('draw',l=>{const path=assetPath(l,1);if(!imageAssets[path])return fail(l,'Image not found: '+path);pushCommand('image',[path,num(l,2),num(l,3),num(l,4),num(l,5,1),num(l,6,1)]);return 0;});
 addFunction('rectangle',l=>{pushCommand('rectangle',[getString(l,1),num(l,2),num(l,3),num(l,4),num(l,5)]);return 0;});
 addFunction('circle',l=>{pushCommand('circle',[getString(l,1),num(l,2),num(l,3),num(l,4)]);return 0;});
 addFunction('line',l=>{const a=[];for(let i=1;i<=lua.lua_gettop(l);i++)a.push(num(l,i));pushCommand('line',a);return 0;});
 addFunction('print',l=>{pushCommand('text',[getString(l,1),num(l,2),num(l,3)]);return 0;});
 addFunction('setColor',l=>{color=[num(l,1,1),num(l,2,1),num(l,3,1),num(l,4,1)];return 0;});
 addFunction('setBackgroundColor',l=>{background=[num(l,1),num(l,2),num(l,3),num(l,4,1)];return 0;});
 addFunction('getWidth',l=>{lua.lua_pushnumber(l,width);return 1;});addFunction('getHeight',l=>{lua.lua_pushnumber(l,height);return 1;});
 addFunction('newFont',l=>{lua.lua_pushnumber(l,num(l,1,18));return 1;});addFunction('setFont',l=>{fontSize=num(l,1,18);return 0;});
 lua.lua_setfield(L,-2,str('graphics'));
 lua.lua_newtable(L);addFunction('isDown',l=>{let down=false;for(let i=1;i<=lua.lua_gettop(l);i++)if(keyset.has(getString(l,i)))down=true;lua.lua_pushboolean(l,down);return 1;});lua.lua_setfield(L,-2,str('keyboard'));
 lua.lua_newtable(L);addFunction('getDelta',l=>{lua.lua_pushnumber(l,1/60);return 1;});addFunction('getFPS',l=>{lua.lua_pushnumber(l,60);return 1;});lua.lua_setfield(L,-2,str('timer'));
 lua.lua_newtable(L);addFunction('load',l=>compileProjectFile(l,getString(l,1)));lua.lua_setfield(L,-2,str('filesystem'));
 installMath();
 lua.lua_setglobal(L,str('love'));
 // Graph Events are a prototype extension; never replace native love.audio.
 lua.lua_newtable(L);lua.lua_newtable(L);
 addFunction('play',l=>{
  // Bound worker traffic even if a script triggers in a tight loop.
  if(audioCount++>=32){if(audioCount===33)postMessage({type:'audio-warning',message:'Too many audio triggers in one frame. Use love.keypressed for one trigger per press.'});return 0;}
  const name=lua.lua_type(l,1)===lua.LUA_TSTRING&&lua.lua_rawlen(l,1)<=320?to_jsstring(lua.lua_tostring(l,1)):null;
  if(!name||name.length>80||/[\u0000-\u001f]/.test(name))postMessage({type:'audio-warning',message:'lyd.audio.play needs an Event name string (1–80 characters).'});
  else try{
   if(lua.lua_gettop(l)>2)throw new Error('lyd.audio.play accepts an Event name and one optional settings table.');
   const options=lua.lua_isnoneornil(l,2)?undefined:audioOptions(l,2);
   postMessage({type:'audio-event',name,...(options!==undefined?{options}:{})});
  }catch(error){postMessage({type:'audio-warning',message:error.message});}
  return 0;
 });
 addFunction('stop',l=>{
  if(audioCount++>=32){if(audioCount===33)postMessage({type:'audio-warning',message:'Too many audio triggers in one frame. Use love.keypressed for one trigger per press.'});return 0;}
  const name=lua.lua_type(l,1)===lua.LUA_TSTRING&&lua.lua_rawlen(l,1)<=320?to_jsstring(lua.lua_tostring(l,1)):null;
  if(!name||name.length>80||/[\u0000-\u001f]/.test(name))postMessage({type:'audio-warning',message:'lyd.audio.stop needs an Event name string (1–80 characters).'});
  else if(lua.lua_gettop(l)!==1)postMessage({type:'audio-warning',message:'lyd.audio.stop accepts exactly one Event name.'});
  else postMessage({type:'audio-stop',name});return 0;
 });
 lua.lua_setfield(L,-2,str('audio'));lua.lua_setglobal(L,str('lyd'));
 installProjectLoader();
}
onmessage=event=>{const m=event.data;try{if(m.type==='check'){
 const name=typeof m.sourceName==='string'?m.sourceName:'main.lua',check=lauxlib.luaL_newstate();
 try{const bytes=str(m.code),status=lauxlib.luaL_loadbuffer(check,bytes,bytes.length,str('@__lovely_script__'));let error=null;
 if(status!==lua.LUA_OK){const raw=to_jsstring(lua.lua_tostring(check,-1)),match=raw.match(/^__lovely_script__:(\d+):/);error={message:raw.replaceAll('__lovely_script__:',name+':'),line:match?Number(match[1]):1};}
 postMessage({type:'checked',id:m.id,error});}finally{lua.lua_close(check);}return;
 }if(m.type==='start'){admitScripts(m);audioCount=0;width=m.width;height=m.height;imageAssets=m.assets;commands=[];color=[1,1,1,1];background=[.045,.055,.06,1];keyset.clear();previousKeys.clear();logCount=0;deadline=Date.now()+120;setup();const bytes=str(m.code),s=lauxlib.luaL_loadbuffer(L,bytes,bytes.length,str('@__lovely_script__'));if(s!==lua.LUA_OK)throw new Error(to_jsstring(lua.lua_tostring(L,-1)));if(callLua(0)!==lua.LUA_OK)throw new Error(to_jsstring(lua.lua_tostring(L,-1)));callback('load');postMessage({type:'ready'});}else if(m.type==='mousepressed'){if(!Number.isFinite(m.x)||!Number.isFinite(m.y)||m.x<0||m.y<0||m.x>width||m.y>height||![1,2,3].includes(m.button))return;audioCount=0;callback('mousepressed',[m.x,m.y,m.button,m.istouch===true,1]);}else if(m.type==='frame'){audioCount=0;commands=[];keyset=new Set(m.keys);for(const k of keyset)if(!previousKeys.has(k))callback('keypressed',[k]);for(const k of previousKeys)if(!keyset.has(k))callback('keyreleased',[k]);previousKeys=new Set(keyset);callback('update',[Math.min(.05,m.dt)]);callback('draw');postMessage({type:'frame',commands,background});}}catch(error){const raw=String(error.message),locations=[];for(const [alias,name] of sourceAliases){const at=raw.indexOf(alias+':'),line=at>=0?raw.slice(at+alias.length+1).match(/^(\d+):/):null;if(line)locations.push({sourceName:name,line:Number(line[1]),at});}locations.sort((a,b)=>a.at-b.at);const location=locations[0];postMessage({type:'error',message:displayLuaMessage(raw).slice(0,8000),...(location?{sourceName:location.sourceName,line:location.line}:{})});}};
