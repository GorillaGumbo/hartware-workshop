import {apiEntries,apiEntry,apiEnums,previewEntries,variantsFor} from './lua-api.js';
// A lexical service, not a type checker. Comments and strings never become code.
export function luaTokens(code){
 const tokens=[];let i=0;
 while(i<code.length){
  const start=i,c=code[i];if(/\s/.test(c)){i++;continue;}
  let comment=code.startsWith('--',i);if(comment)i+=2;
  const long=code.slice(i).match(/^\[(=*)\[/);
  if(long){const close=']'+long[1]+']',end=code.indexOf(close,i+long[0].length);i=end<0?code.length:end+close.length;tokens.push({type:comment?'comment':'string',start,end:i,value:code.slice(start,i),long:true,closed:end>=0});continue;}
  if(comment){const end=code.indexOf('\n',i);i=end<0?code.length:end;tokens.push({type:'comment',start,end:i,value:code.slice(start,i)});continue;}
  if(c==='"'||c==="'"){
   i++;let closed=false;while(i<code.length){if(code[i]==='\\'){i+=code[i+1]==='\r'&&code[i+2]==='\n'?3:2;continue;}if(code[i]===c){i++;closed=true;break;}if(code[i]==='\n'||code[i]==='\r')break;i++;}
   i=Math.min(i,code.length);tokens.push({type:'string',start,end:i,value:code.slice(start,i),quote:c,closed});continue;
  }
  if(/[A-Za-z_]/.test(c)){while(i<code.length&&/[\w]/.test(code[i]))i++;tokens.push({type:'id',start,end:i,value:code.slice(start,i)});continue;}
  if(/[0-9]/.test(c)||c==='.'&&/\d/.test(code[i+1]??'')){const number=code.slice(i).match(/^(?:0[xX][\da-fA-F]+(?:\.[\da-fA-F]*)?(?:[pP][+-]?\d+)?|(?:\d+(?:\.(?!\.)\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/)[0];i+=number.length;tokens.push({type:'number',start,end:i,value:number});continue;}
  const symbol=['...','..','==','~=','<=','>=','::','//','<<','>>'].find(s=>code.startsWith(s,i))??c;i+=symbol.length;tokens.push({type:'symbol',start,end:i,value:symbol});
 }
 return tokens;
}
const significant=tokens=>tokens.filter(t=>t.type!=='comment');
function chainEnding(tokens,index){
 if(tokens[index]?.type!=='id')return null;
 let first=index;while(first>=2&&['.',':'].includes(tokens[first-1].value)&&tokens[first-2].type==='id')first-=2;
 return {name:tokens.slice(first,index+1).map(t=>t.value).join(''),first,last:index,start:tokens[first].start,end:tokens[index].end};
}
function rootShadowed(tokens,offset,root){
 // Conservative: do not offer rooted API knowledge when this file binds the root.
 for(let i=0;i<tokens.length&&tokens[i].start<offset;i++)if(tokens[i].value===root&&tokens[i].type==='id'){
  if(tokens[i-1]?.value==='local')return true;
  if(tokens[i+1]?.value==='='&&!['.',':'].includes(tokens[i-1]?.value))return true;
  if(tokens[i-1]?.value==='function'&&tokens[i+1]?.value==='(')return true;
  for(let j=i-1;j>=0&&!['=', ';','end'].includes(tokens[j].value);j--){if(tokens[j].value==='local')return true;if(tokens[j].value==='function'){const open=tokens.findIndex((t,k)=>k>j&&t.value==='(');if(open>=0&&open<i&&!tokens.slice(open+1,i).some(t=>t.value===')'))return true;break;}}
 }
 return false;
}
function apiChain(tokens,index,offset){const chain=chainEnding(tokens,index);if(!chain)return null;const root=chain.name.split(/[.:]/)[0];return rootShadowed(tokens,offset,root)?null:chain;}
function decodedPrefix(value){return value.replace(/\\([\\"'])/g,'$1');}
function escapeContent(value,quote){return value.replaceAll('\\','\\\\').replaceAll(quote,'\\'+quote).replaceAll('\n','\\n').replaceAll('\r','\\r');}
export function completions(code,offset,project={},manual=false){
 const all=luaTokens(code),inside=all.find(t=>t.start<offset&&(offset<t.end||offset===t.end&&(t.type==='comment'||t.type==='string'&&!t.closed)));
 if(inside?.type==='comment'||inside?.long)return null;
 if(inside?.type==='string'){
  const before=significant(all.filter(t=>t.end<=inside.start)),open=before.at(-1);
  const chain=open?.value==='('?apiChain(before,before.length-2,offset):open?.type==='id'?apiChain(before,before.length-1,offset):null;
  const choices=chain?.name==='love.filesystem.load'?(project.scripts??[]).map(file=>file.name):chain?.name==='require'?(project.scripts??[]).filter(file=>file.id!=='main.lua'&&!file.name.slice(0,-4).includes('.')).map(file=>file.name.slice(0,-4)):chain?.name==='love.graphics.newImage'?(project.assets??[]).filter(a=>a.type==='image').map(a=>a.name):['lyd.audio.play','lyd.audio.stop'].includes(chain?.name)?(project.events??[]).map(e=>e.name):null;
  if(!choices)return null;
  const prefix=decodedPrefix(code.slice(inside.start+1,offset)),from=inside.start+1,to=inside.end-(inside.closed?1:0);
  return {from,to,items:[...new Set(choices)].filter(name=>name.startsWith(prefix)).slice(0,80).map(name=>({label:name,text:escapeContent(name,inside.quote)+(inside.closed?'':inside.quote),kind:'project',description:chain.name==='love.filesystem.load'?'Lua file in this project':chain.name==='require'?'Lua module in this project':chain.name.includes('audio')?'Event in this project':'Image in this project'}))};
 }
 const before=significant(all.filter(t=>t.start<offset));let current=before.at(-1),prefix='',from=offset,to=offset;
 if(current?.type==='id'&&current.end>=offset){prefix=code.slice(current.start,offset);from=current.start;to=current.end;before.pop();}
 let parent='';
 if(['.',':'].includes(before.at(-1)?.value)){const separator=before.pop().value,chain=apiChain(before,before.length-1,offset);if(!chain)return null;parent=chain.name+separator;}
 if(!parent&&!manual)return null;
 const options=[];
 if(parent){
  for(const entry of apiEntries){if(!entry.name.startsWith(parent))continue;const label=entry.name.slice(parent.length);if(/[.:]/.test(label)||!label.startsWith(prefix))continue;
   const declaration=before[chainEnding(before,before.length-1)?.first-1]?.value==='function',hasCall=/^\s*\(/.test(code.slice(to)),callback=entry.kind==='callback'&&!hasCall&&declaration,call=entry.kind==='function'&&!hasCall&&!declaration;
   const args=(variantsFor(entry)[0]?.args??[]).filter(a=>a.name!=='...').map(a=>a.name).join(', ');
   options.push({label,text:callback?`${label}(${args})\n  \nend`:call?label+'()':label,...(callback?{cursor:label.length+args.length+5}:call?{cursor:label.length+1}:{}),kind:entry.kind,entry});
  }
 }else{
  for(const name of ['love','lyd','require'])if(name.startsWith(prefix)&&!rootShadowed(before,offset,name))options.push({label:name,text:name==='require'&&!/^\s*\(/.test(code.slice(to))?'require()':name,...(name==='require'&&!/^\s*\(/.test(code.slice(to))?{cursor:8}:{}),kind:name==='require'?'function':'module',entry:apiEntry(name)});
  for(const entry of previewEntries.filter(e=>e.kind==='callback'&&before.at(-1)?.value!=='function'))if(entry.name.split('.').at(-1).startsWith(prefix)){
   const args=(variantsFor(entry)[0]?.args??[]).map(a=>a.name).join(', '),head=`function ${entry.name}(${args})\n  `;
   options.push({label:entry.name+' callback',text:head+'\nend',cursor:head.length,kind:'snippet',entry});
  }
 }
 return {from,to,items:options.sort((a,b)=>Number(a.entry?.status==='native')-Number(b.entry?.status==='native')||a.label.localeCompare(b.label))};
}
export function symbolAt(code,offset){
 const all=luaTokens(code),token=all.find(t=>t.start<=offset&&offset<t.end);
 if(!token||token.type!=='id')return null;
 const tokens=significant(all),index=tokens.indexOf(token);let end=index;while(['.',':'].includes(tokens[end+1]?.value)&&tokens[end+2]?.type==='id')end+=2;
 const chain=apiChain(tokens,end,offset);return chain?apiEntry(chain.name):null;
}
export function callAt(code,offset){
 const all=luaTokens(code);if(all.some(t=>t.type==='comment'&&t.start<offset&&offset<=t.end))return null;
 const tokens=significant(all.filter(t=>t.start<offset)),stack=[];
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i];if(['(','{','['].includes(t.value))stack.push({op:t.value,open:t.start,entry:t.value==='('?apiEntry(apiChain(tokens,i-1,offset)?.name):null,arg:0});
  else if([')',']','}'].includes(t.value))stack.pop();else if(t.value===','&&stack.length)stack.at(-1).arg++;
 }
 return [...stack].reverse().find(s=>s.entry)??null;
}
function literalArgument(tokens){
 const first=tokens[0],last=tokens.at(-1);if(!first)return null;
 if(tokens.length===1){
  if(first.type==='number')return {type:'number',from:first.start};
  if(first.type==='string'&&first.closed)return {type:'string',from:first.start};
  if(['true','false','nil'].includes(first.value))return {type:first.value==='nil'?'nil':'boolean',from:first.start};
 }
 if(tokens.length===2&&first.value==='-'&&last.type==='number')return {type:'number',from:first.start};
 return null;
}
function parameterType(parameter){const type=parameter?.type;return apiEnums[type]?'string':type;}
function scanInlayCalls(code){
 const all=luaTokens(code),tokens=significant(all),stack=[],calls=[],openCalls=[],closing={')':'(',']':'[','}':'{'};
 function finish(frame,end,closed){if(!frame.entry||frame.unsafe)return;frame.args.push(tokens.slice(frame.start,end));frame.closed=closed;calls.push(frame);if(!closed)openCalls.push(frame);}
 for(let i=0;i<tokens.length;i++){
  const token=tokens[i];
  if(['(','[','{'].includes(token.value)){
   const chain=token.value==='('?chainEnding(tokens,i-1):null,known=chain?apiEntry(chain.name):null,entry=known&&tokens[chain.first-1]?.value!=='function'&&!rootShadowed(tokens,token.start,chain.name.split(/[.:]/)[0])?known:null;
   stack.push({op:token.value,open:token.start,entry:entry?.kind==='function'?entry:null,start:i+1,args:[]});
  }else if(closing[token.value]){
   if(stack.at(-1)?.op!==closing[token.value])continue;
   finish(stack.pop(),i,true);
  }else if(token.value===','&&stack.at(-1)?.entry){const frame=stack.at(-1);frame.args.push(tokens.slice(frame.start,i));frame.start=i+1;}
  else if(token.value==='function'&&stack.at(-1)?.entry)stack.at(-1).unsafe=true;
 }
 for(const frame of stack)finish(frame,tokens.length,false);
 return {calls,openCalls,inComment:all.some(t=>t.type==='comment'&&t.start<code.length&&t.end===code.length)};
}
function pendingLiteral(tokens,code,caret){
 if(!tokens.length)return {type:null,from:caret,pending:true};
 const first=tokens[0],raw=code.slice(first.start,caret);
 if(tokens.length===1&&first.type==='string')return {type:'string',from:first.start,pending:true};
 if(['true','false','nil'].some(value=>value.startsWith(raw)))return {type:'nil'.startsWith(raw)?'nil':'boolean',from:first.start,pending:true};
 if(/^-?(?:\d*(?:\.\d*)?(?:[eE][+-]?\d*)?|0[xX][\da-fA-F]*(?:\.[\da-fA-F]*)?(?:[pP][+-]?\d*)?)$/.test(raw))return {type:'number',from:first.start,pending:true};
 return null;
}
// Completed literals are document decorations. A caret-bounded prefix supplies
// the slot being authored, even when the call has no closing parenthesis yet.
export function inlayHints(code,caret=null){
 let {calls}=scanInlayCalls(code);
 if(Number.isInteger(caret)&&caret>=0&&caret<=code.length){
  const prefix=scanInlayCalls(code.slice(0,caret));
  if(!prefix.inComment)for(const active of prefix.openCalls){
   const index=active.args.length-1,existing=calls.find(call=>call.open===active.open),call=existing?.closed?existing:active;
   call.live={index,tokens:active.args[index],caret};
   if(call!==existing){calls=calls.filter(item=>item.open!==call.open);calls.push(call);}
  }
 }
 const hints=[];
 for(const call of calls){
  const literals=call.args.map(literalArgument);
  if(call.live){const {index,tokens,caret}=call.live;if(!literals[index])literals[index]=pendingLiteral(tokens,code,caret);}
  const empty=call.args.length===1&&!call.args[0].length,count=Math.max(empty?0:call.args.length,call.live?call.live.index+1:0);
  const candidates=variantsFor(call.entry).filter(variant=>{
   if(count>variant.args.length&&variant.args.at(-1)?.name!=='...')return false;
   return literals.every((literal,index)=>{
    if(!literal||literal.type===null)return true;const parameter=variant.args[index]??variant.args.at(-1),type=parameterType(parameter);
    return literal.type==='nil'||type===literal.type||['any','Variant'].includes(type);
   });
  });
  const exact=candidates.filter(variant=>variant.args.length===count),variants=exact.length?exact:candidates;
  for(let index=0;index<literals.length;index++){
   const literal=literals[index];if(!literal||!variants.length)continue;
   const parameters=variants.map(variant=>variant.args[index]??(variant.args.at(-1)?.name==='...'?variant.args.at(-1):null)),parameter=parameters[0];
   if(!parameter||parameter.name==='...'||!parameters.every(p=>p?.name===parameter.name))continue;
   hints.push({from:literal.from,label:parameter.name+':',entry:call.entry,parameter,index,pending:!!literal.pending});
  }
 }
 return hints.sort((a,b)=>a.from-b.from);
}
export function compatibilityWarnings(code){
 const tokens=luaTokens(code),result=[];
 for(const t of tokens)if(t.type==='symbol'&&['//','&','|','~','<<','>>'].includes(t.value)){
  result.push({line:code.slice(0,t.start).split('\n').length,message:`${t.value} is outside the Lua 5.1 common subset targeted for LÖVE 11.5.`});break;
 }
 return result;
}
export function errorLocation(message,sourceName){
 // Match the exact active filename; colons in names/messages cannot select another line.
 const escaped=sourceName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const match=String(message).match(new RegExp('(?:^|\\n|\\t)'+escaped+':(\\d+):'));
 return match?{sourceName,line:Number(match[1])}:null;
}
export function searchReference(query,includeNative=true){
 const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return apiEntries.filter(e=>(includeNative||e.status!=='native')&&words.every(w=>(e.name+' '+(e.description??'')).toLowerCase().includes(w))).sort((a,b)=>Number(b.kind==='module')-Number(a.kind==='module')||Number(a.status==='native')-Number(b.status==='native')||a.name.localeCompare(b.name)).slice(0,100);
}
