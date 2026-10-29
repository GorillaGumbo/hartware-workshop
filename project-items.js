import {validEventName,validScriptName,scriptFileName,projectScripts,findScript,checkScriptBudget} from './project.js';
import {createFolder,moveProjectItem,parentFolder,organizationFor,hasProjectItem} from './project-folders.js';
export function normalizedFileName(value,previous){
 let name=String(value).trim(),ext=previous.includes('.')?previous.slice(previous.lastIndexOf('.')):'';
 if(ext&&!name.includes('.'))name+=ext;
 if(!name||name.length>160||/[\\/\u0000-\u001f\u007f]/.test(name)||['.','..','conf.lua'].includes(name.toLowerCase()))throw Error('Choose a filename without slashes or control characters.');
 if(ext&&name.slice(-ext.length).toLowerCase()!==ext.toLowerCase())throw Error(`Keep the ${ext} file extension.`);
 return name;
}
// Tokenize Lua literals/comments so refactoring does not change comments, prose or expressions.
function luaTokens(code){const out=[];let i=0;while(i<code.length){const start=i,c=code[i];if(/\s/.test(c)){i++;continue;}let comment=false;if(code.startsWith('--',i)){i+=2;comment=true;}const long=code.slice(i).match(/^\[(=*)\[/);if(long){const end=code.indexOf(']'+long[1]+']',i+long[0].length);i=end<0?code.length:end+long[1].length+2;if(!comment)out.push({start,end:i,kind:'string',raw:code.slice(start,i),value:code.slice(start+long[0].length,i-long[1].length-2).replace(/^\r?\n/,'')});continue;}if(comment){const end=code.indexOf('\n',i);i=end<0?code.length:end+1;continue;}
 if(c==='"'||c==="'"){i++;while(i<code.length){if(code[i]==='\\'){i+=2;continue;}if(code[i++]===c)break;}const raw=code.slice(start,i),body=raw.slice(1,-1);let value='',valid=raw.at(-1)===c;for(let j=0;j<body.length;j++){if(body[j]!=='\\'){value+=body[j];continue;}const escape=body[++j],simple={a:'\x07',b:'\b',f:'\f',n:'\n',r:'\r',t:'\t',v:'\x0b','\\':'\\',"'":"'",'"':'"','\n':'\n'};if(Object.hasOwn(simple,escape))value+=simple[escape];else if(escape==='z'){while(/\s/.test(body[j+1]??'')&&j+1<body.length)j++;}else if(escape==='x'&&/^[a-f\d]{2}$/i.test(body.slice(j+1,j+3))){value+=String.fromCharCode(parseInt(body.slice(j+1,j+3),16));j+=2;}else if(/\d/.test(escape??'')){const digits=body.slice(j).match(/^\d{1,3}/)[0];value+=String.fromCharCode(+digits);j+=digits.length-1;}else valid=false;}out.push({start,end:i,kind:'string',value:valid?value:null,raw});continue;}
 const word=code.slice(i).match(/^[A-Za-z_][A-Za-z_\d]*/);if(word){i+=word[0].length;out.push({start,end:i,kind:'word',value:word[0]});}else{out.push({start,end:++i,kind:'symbol',value:c});}}
 return out;
}
const callParts={event:[['lyd','.','audio','.','play'],['lyd','.','audio','.','stop']],asset:[['love','.','graphics','.','newImage'],['love','.','audio','.','newSource'],['love','.','filesystem','.','read'],['love','.','filesystem','.','getInfo'],['love','.','filesystem','.','load']]};
export function replaceLuaReferences(code,kind,from,to){const tokens=luaTokens(code),edits=[];for(let i=0;i<tokens.length;i++){for(const pattern of callParts[kind]??[]){if(!pattern.every((part,n)=>tokens[i+n]?.value===part)||['.',':'].includes(tokens[i-1]?.value))continue;let at=i+pattern.length;if(tokens[at]?.value==='(')at++;const token=tokens[at];if(token?.kind!=='string'||token.value!==from)continue;const next=tokens[at+1]?.value;if(![')',',',undefined].includes(next)&&tokens[i+pattern.length]?.value==='(')continue;edits.push({start:token.start,end:token.end,text:JSON.stringify(to)});}}
 const parts=[];let last=0;for(const edit of edits){parts.push(code.slice(last,edit.start),edit.text);last=edit.end;}parts.push(code.slice(last));return {code:parts.join(''),count:edits.length};}
export function renameProjectEntry(project,source,value){
 let entry,previous,name=String(value).trim();
 if(source.kind==='event'){entry=project.events.find(x=>x.id===source.id);if(!entry)throw Error('This Event is no longer available.');if(!validEventName(name)||project.events.some(x=>x.id!==source.id&&x.name===name))throw Error('Choose a nonblank, unique Event name.');previous=entry.name;}
 else if(source.kind==='asset'){entry=project.assets.find(x=>x.id===source.id);if(!entry)throw Error('This file is no longer available.');previous=entry.name;name=normalizedFileName(name,previous);if(['main.lua',...projectScripts(project).map(script=>script.name)].some(x=>x.toLowerCase()===name.toLowerCase())||project.assets.some(x=>x.id!==source.id&&x.name.toLowerCase()===name.toLowerCase()))throw Error('A file already uses that name.');}
 else if(source.kind==='script'){
  entry=findScript(project,source.id);if(!entry)throw Error('This script is no longer available.');previous=entry.name;name=normalizedFileName(name,previous);
  if(source.id!=='main.lua')name=name.slice(0,-4)+'.lua';if(name.toLowerCase()==='main.lua')name='main.lua';
  if(!validScriptName(name)||source.id!=='main.lua'&&name==='main.lua'||projectScripts(project).some(x=>x.id!==source.id&&x.name.toLowerCase()===name.toLowerCase())||project.assets.some(x=>x.name.toLowerCase()===name.toLowerCase()))throw Error('Choose a unique .lua filename; main.lua and conf.lua are reserved.');
 }else throw Error('This item cannot be renamed.');
 if(name===previous)return null;
 let references=0;const files=[];
 const edited=projectScripts(project).map(script=>{
  let result=replaceLuaReferences(script.code,source.kind==='event'?'event':'asset',previous,name);
  if(source.kind==='script'){
   result=replaceLuaReferences(script.code,'asset',previous,name);
   const modules=replaceLuaModuleReferences(result.code,previous.slice(0,-4),name.slice(0,-4));result={code:modules.code,count:result.count+modules.count};
  }
  references+=result.count;if(result.code!==script.code)files.push(script.id);
  return {...script,code:result.code,...(source.kind==='script'&&script.id===source.id?{name}:{})};
 });
 const copy={...project,code:edited.find(x=>x.id==='main.lua')?.code??'',scripts:edited.filter(x=>x.id!=='main.lua')};
 for(const script of edited)checkScriptBudget(copy,script.id,script.code);
 project.code=copy.code;if(project.scripts||copy.scripts.length)project.scripts=copy.scripts;
 if(source.kind==='script'){if(source.id==='main.lua')project.scriptName=name;}else entry.name=name;
 return {name,previous,references,files};
}
function replaceLuaModuleReferences(code,from,to){
 const tokens=luaTokens(code),edits=[];
 for(let i=0;i<tokens.length;i++)if(tokens[i].value==='require'&&!['.',':','function'].includes(tokens[i-1]?.value)){
  const paren=tokens[i+1]?.value==='(',token=tokens[i+(paren?2:1)];
  if(token?.kind==='string'&&token.value===from&&(!paren||tokens[i+3]?.value===')'))edits.push({start:token.start,end:token.end,text:JSON.stringify(to)});
 }
 let result=code;for(const edit of edits.reverse())result=result.slice(0,edit.start)+edit.text+result.slice(edit.end);return {code:result,count:edits.length};
}
export function moveProjectItems(project,sources,parentId){const copy={...project,organization:structuredClone(organizationFor(project))};let changed=false;for(const source of sources)changed=moveProjectItem(copy,source,parentId)||changed;if(changed)project.organization=copy.organization;return changed;}
export function groupProjectItems(project,sources,name='New folder',id=crypto.randomUUID()){
 if(!sources.length||sources.some(x=>x.kind==='folder'||x.section!==sources[0].section||!hasProjectItem(project,x.section,x.id))||new Set(sources.map(x=>x.id)).size!==sources.length)throw Error('Choose files or Events from one category.');
 const org=organizationFor(project),chains=sources.map(source=>{let parent=parentFolder(project,source.section,source.id),chain=[null];while(parent){chain.push(parent);parent=org.folders.find(x=>x.id===parent)?.parentId??null;}return [null,...chain.slice(1).reverse()];});let parentId=null;for(let i=1;i<chains[0].length&&chains.every(chain=>chain[i]===chains[0][i]);i++)parentId=chains[0][i];
 const copy={...project,organization:structuredClone(org)};createFolder(copy,sources[0].section,parentId,name,id);moveProjectItems(copy,sources,id);project.organization=copy.organization;return id;
}
