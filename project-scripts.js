// The legacy entry keeps its identity; additional Lua files have stable IDs.
export const maxScripts=64,maxScriptLength=500000,maxScriptTotal=2000000;
export const hasScript=project=>project.scriptPresent!==false;
export const scriptFileName=project=>project.scriptName??'main.lua';
export const validScriptName=name=>typeof name==='string'&&name.length>4&&name.length<=160&&name===name.trim()&&!/[\\/\u0000-\u001f\u007f]/.test(name)&&/\.lua$/i.test(name)&&name.toLowerCase()!=='conf.lua'&&(name.toLowerCase()!=='main.lua'||name==='main.lua');
export const projectScripts=project=>[...(hasScript(project)?[{id:'main.lua',name:scriptFileName(project),code:project.code}]:[]),...(project.scripts??[])];
export const findScript=(project,id)=>projectScripts(project).find(script=>script.id===id);
export const scriptRevision=project=>JSON.stringify(projectScripts(project));
export function checkScriptBudget(project,id,code){if(typeof code!=='string'||code.length>maxScriptLength||projectScripts(project).reduce((sum,script)=>sum+(script.id===id?0:script.code.length),code.length)>maxScriptTotal)throw Error('Lua files allow 500,000 characters each and 2,000,000 characters in total.');}
export function setScriptCode(project,id,code){const script=findScript(project,id);if(!script)throw Error('This script is no longer available.');checkScriptBudget(project,id,code);if(id==='main.lua')project.code=code;else script.code=code;}
export function nextScriptName(project){const used=new Set([...projectScripts(project),...project.assets].map(file=>file.name.toLowerCase()));let name='module.lua',n=2;while(used.has(name.toLowerCase()))name=`module${n++}.lua`;return name;}
export function validateScripts(project){
 if(!Array.isArray(project.scripts)||!project.scripts.length||project.scripts.length+(hasScript(project)?1:0)>maxScripts)throw Error('A project supports up to 64 Lua files.');
 const ids=new Set(['main.lua']),names=new Set(['main.lua','conf.lua',...(hasScript(project)?[scriptFileName(project).toLowerCase()]:[]),...(project.assets??[]).map(file=>file.name.toLowerCase())]);
 for(const script of project.scripts){if(!script||typeof script!=='object'||Array.isArray(script)||Object.keys(script).some(key=>!['id','name','code'].includes(key))||typeof script.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(script.id)||ids.has(script.id)||!validScriptName(script.name)||!script.name.endsWith('.lua')||names.has(script.name.toLowerCase()))throw Error('Lua files need unique IDs and unique .lua filenames; main.lua and conf.lua are reserved.');ids.add(script.id);names.add(script.name.toLowerCase());checkScriptBudget(project,script.id,script.code);}
}
export function scriptExportFiles(project){
 if(!hasScript(project))return {};const files=Object.fromEntries(projectScripts(project).map(script=>[script.name,script.code])),name=scriptFileName(project);
 if(name!=='main.lua')files['main.lua']=`assert(love.filesystem.load(${JSON.stringify(name)}))()\n`;
 return files;
}
