import {luaTarget,statusLabel,signature,variantsFor} from './lua-api.js';
import {completions,symbolAt,callAt,inlayHints,compatibilityWarnings,searchReference} from './lua-intelligence.js';
export function mountLuaTools({editor:cm,project,onJump,document,window,createCompiler=()=>new Worker('preview-worker.js')}){
 if(!cm.getWrapperElement)return {close(){},check(){},destroy(){}};
 const wrapper=cm.getWrapperElement(),status=document.getElementById('lua-status'),reference=document.getElementById('lua-reference-dialog'),search=document.getElementById('lua-reference-search'),native=document.getElementById('lua-reference-native'),results=document.getElementById('lua-reference-results'),detail=document.getElementById('lua-reference-detail');
 const popup=document.createElement('section');popup.className='lua-popover';popup.hidden=true;popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Lua reference popover');document.body.append(popup);
 const inlayButton=document.getElementById('lua-inlays');
 let lastSource=project().sourceName,compiler=null,request=0,timer=null,watchdog=null,hoverTimer=null,highlight=null,disposed=false,popupKind='',lastHover=null,diagnostic=null,lastInput=0,inlaysVisible=true,pointerSelecting=false,inlaysPending=false,inlayMarks=[];
 const closeReference=()=>{clearTimeout(hoverTimer);popup.hidden=true;popupKind='';lastHover=null;};
 const close=closeReference;
 function renderInlays(){
  if(disposed||!cm.setBookmark)return;
  if(pointerSelecting){inlaysPending=true;return;}
  inlaysPending=false;
  const hints=inlaysVisible?inlayHints(cm.getValue(),cm.getCursor&&!cm.somethingSelected?.()?cm.indexFromPos(cm.getCursor()):null):[];
  cm.operation(()=>{
   const previous=new Map();for(const item of inlayMarks){const pos=item.mark.find();if(pos)previous.set(cm.indexFromPos(pos)+':'+item.key,item);else item.mark.clear();}
   inlayMarks=hints.map(hint=>{
    const key=hint.entry.name+':'+hint.index+':'+hint.label,id=hint.from+':'+key,existing=previous.get(id);
    if(existing){previous.delete(id);return existing;}
    const widget=document.createElement('span');widget.className='lua-inlay';widget.textContent=hint.label;widget.setAttribute('aria-hidden','true');widget.setAttribute('contenteditable','false');
    // Let CodeMirror place the caret and select text when a drag starts on a label.
    return {key,mark:cm.setBookmark(cm.posFromIndex(hint.from),{widget,insertLeft:true,handleMouseEvents:true})};
   });
   for(const item of previous.values())item.mark.clear();
  });
 }
 function swapDocument(){cm.operation?.(()=>{for(const item of inlayMarks)item.mark.clear();});inlayMarks=[];schedule();renderInlays();}
 function setInlays(visible){inlaysVisible=visible;inlayButton.setAttribute('aria-pressed',String(visible));renderInlays();}
 inlayButton.onclick=()=>{setInlays(!inlaysVisible);cm.focus();};
 function pointerDown(event){if(event.button!==0)return;pointerSelecting=true;closeReference();}
 function pointerUp(){pointerSelecting=false;if(inlaysPending)renderInlays();}
 const clearHighlight=()=>{if(highlight!==null){cm.removeLineClass(highlight,'background','cm-lua-diagnostic');highlight=null;}};
 function renderEntry(root,entry,arg=null){
  root.replaceChildren();const title=document.createElement('strong');title.textContent=entry.name;root.append(title);
  const badge=document.createElement('span');badge.className='lua-api-badge';badge.textContent=statusLabel(entry);root.append(badge);
  const variants=variantsFor(entry);
  for(const variant of variants.slice(0,8)){const pre=document.createElement('pre');pre.textContent=signature(entry,variant);root.append(pre);}
  const description=document.createElement('p');description.textContent=entry.description;root.append(description);
  if(entry.notes){const note=document.createElement('p');note.className='lua-api-note';note.textContent=entry.notes;root.append(note);}
  if(arg!==null){const p=document.createElement('p');const parameter=variants[0]?.args[Math.min(arg,(variants[0]?.args.length??1)-1)];p.className='lua-active-parameter';p.textContent=parameter?`Argument ${arg+1}: ${parameter.name} · ${parameter.type}`:'No parameters';root.append(p);}
  const dl=document.createElement('dl');dl.className='lua-parameters';
  for(const parameter of variants[0]?.args??[]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=parameter.name+' · '+parameter.type;dd.textContent=parameter.description??(parameter.default!==undefined?'Default: '+parameter.default:'');dl.append(dt,dd);}root.append(dl);
  if(entry.example){const pre=document.createElement('pre');pre.className='lua-example';pre.textContent=entry.example;root.append(pre);}
  if(entry.previewVariants&&entry.variants.length){const disclosure=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Native LÖVE overloads';disclosure.append(summary);for(const variant of entry.variants){const pre=document.createElement('pre');pre.textContent=signature(entry,variant);disclosure.append(pre);}root.append(disclosure);}
  if(entry.url){const a=document.createElement('a');a.href=entry.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open LÖVE reference ↗';root.append(a);}
 }
 function show(entry,coords,kind,arg=null){
  if(!entry||reference.open||document.getElementById('script-panel').hidden)return close();
  popup.replaceChildren();const button=document.createElement('button');button.className='bare lua-popover-close';button.textContent='×';button.setAttribute('aria-label','Close Lua reference');button.onclick=close;popup.append(button);const body=document.createElement('div');renderEntry(body,entry,arg);popup.append(body);popupKind=kind;popup.hidden=false;
  const width=Math.min(430,window.innerWidth-24);popup.style.width=width+'px';popup.style.left=Math.max(12,Math.min(coords.left,window.innerWidth-width-12))+'px';popup.style.top='12px';const height=popup.getBoundingClientRect().height;
  popup.style.top=Math.max(12,Math.min(coords.bottom+7,window.innerHeight-height-12))+'px';
 }
 function showCurrent(){const offset=cm.indexFromPos(cm.getCursor()),code=cm.getValue(),entry=symbolAt(code,Math.max(0,offset-1))??callAt(code,offset)?.entry;if(entry){show(entry,cm.cursorCoords(null,'window'),'reference');popup.querySelector('button')?.focus();}else openReference();}
 function hints(editor){
  const data=completions(editor.getValue(),editor.indexFromPos(editor.getCursor()),project(),true);if(!data?.items.length)return null;
  return {from:editor.posFromIndex(data.from),to:editor.posFromIndex(data.to),list:data.items.map(item=>({text:item.text,displayText:item.label,render(el){const label=document.createElement('span');label.textContent=item.label;const kind=document.createElement('small');kind.textContent=item.entry?statusLabel(item.entry):item.description;el.append(label,kind);},hint(ed,_,completion){const from=ed.posFromIndex(data.from),to=ed.posFromIndex(data.to);ed.replaceRange(completion.text,from,to,'complete');if(item.cursor!==undefined)ed.setCursor(ed.posFromIndex(data.from+item.cursor));}}))};
 }
 function complete(manual=true){if(disposed)return;const data=completions(cm.getValue(),cm.indexFromPos(cm.getCursor()),project(),manual);if(!data?.items.length)return;close();cm.showHint({hint:hints,completeSingle:false,closeOnUnfocus:true});}
 function inputRead(_,change){lastInput=Date.now();closeReference();if(change.origin==='setValue'||change.origin==='complete')return;complete(false);}
 function cursorActivity(){if(popupKind)closeReference();}
 function blur(_,event){if(popup.contains(event?.relatedTarget))return;closeReference();}

 function setDiagnostic(value){
  diagnostic=value;clearHighlight();status.textContent=value?`${value.kind==='error'?'Error':'Target note'} · line ${value.line}`:'Syntax OK';status.dataset.kind=value?.kind??'ok';status.setAttribute('aria-label','Lua syntax check: '+status.textContent);status.disabled=!value;status.setAttribute('data-tip',value?.message??'Syntax checked without running. Native compatibility still needs verification.');
  if(value&&value.line<=cm.lineCount())highlight=cm.addLineClass(value.line-1,'background','cm-lua-diagnostic');
 }
 function check(){
  if(disposed)return;clearTimeout(timer);clearTimeout(watchdog);compiler?.terminate();compiler=null;
  const id=++request,code=cm.getValue(),sourceName=project().sourceName;clearHighlight();diagnostic=null;status.textContent='Checking…';status.setAttribute('aria-label','Lua syntax check: Checking');status.disabled=true;status.dataset.kind='pending';
  try{compiler=createCompiler();compiler.onmessage=event=>{
   const message=event.data;if(disposed||id!==request||message.type!=='checked'||message.id!==id||code!==cm.getValue()||sourceName!==project().sourceName)return;
   clearTimeout(watchdog);compiler?.terminate();compiler=null;
   const warning=compatibilityWarnings(code)[0];setDiagnostic(message.error?{...message.error,kind:'error',code,sourceName}:warning?{...warning,kind:'warning',code,sourceName}:null);
  };compiler.onerror=()=>{if(id!==request)return;clearTimeout(watchdog);compiler?.terminate();compiler=null;status.textContent='Check unavailable';status.setAttribute('data-tip','Syntax checking could not start. Run to see runtime errors.');};
  compiler.postMessage({type:'check',id,code,sourceName});watchdog=setTimeout(()=>{if(id!==request)return;compiler?.terminate();compiler=null;status.textContent='Check unavailable';status.setAttribute('data-tip','Syntax checking timed out. Try editing again.');},3000);
  }catch{status.textContent='Check unavailable';}
 }
 function schedule(_,change){lastInput=Date.now();lastSource=project().sourceName;close();clearTimeout(timer);clearTimeout(watchdog);compiler?.terminate();compiler=null;request++;clearHighlight();diagnostic=null;status.textContent='Checking…';status.setAttribute('aria-label','Lua syntax check: Checking');status.disabled=true;status.dataset.kind='pending';timer=setTimeout(check,450);}
 const keymap={'Ctrl-Space':()=>complete(true),'Cmd-Space':()=>complete(true),'F1':showCurrent,'Shift-Ctrl-Space':()=>setInlays(!inlaysVisible),Esc:()=>{if(!popup.hidden){closeReference();return;}return window.CodeMirror.Pass;}};
 cm.addKeyMap(keymap);cm.on('inputRead',inputRead);cm.on('cursorActivity',cursorActivity);cm.on('change',schedule);cm.on('changes',renderInlays);cm.on('swapDoc',swapDocument);cm.on('scroll',closeReference);cm.on('blur',blur);
 function hover(event){clearTimeout(hoverTimer);if(pointerSelecting||event.buttons||cm.somethingSelected?.()||cm.state.completionActive||Date.now()-lastInput<600)return;const pos=cm.coordsChar({left:event.clientX,top:event.clientY},'window'),entry=symbolAt(cm.getValue(),cm.indexFromPos(pos));if(entry?.name===lastHover)return;if(!entry){if(popupKind==='hover')close();return;}lastHover=entry.name;hoverTimer=setTimeout(()=>show(entry,cm.charCoords(pos,'window'),'hover'),350);}
 const leave=()=>clearTimeout(hoverTimer);wrapper.addEventListener('mousedown',pointerDown);wrapper.addEventListener('mousemove',hover);wrapper.addEventListener('mouseleave',leave);document.addEventListener('mouseup',pointerUp);window.addEventListener('blur',pointerUp);
 function outside(event){if(!popup.contains(event.target)&&!wrapper.contains(event.target))close();}
 popup.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();closeReference();cm.focus();}};
 document.addEventListener('pointerdown',outside);window.addEventListener('resize',closeReference);
 function renderResults(){results.replaceChildren();const entries=searchReference(search.value,native.checked);for(const entry of entries){const button=document.createElement('button');button.className='lua-reference-result';button.type='button';button.textContent=entry.name;const badge=document.createElement('small');badge.textContent=statusLabel(entry);button.append(badge);button.onclick=()=>{for(const b of results.children)b.removeAttribute('aria-current');button.setAttribute('aria-current','true');renderEntry(detail,entry);};results.append(button);}if(entries.length){results.firstElementChild.setAttribute('aria-current','true');renderEntry(detail,entries[0]);}else detail.textContent='No matching APIs. Try a function or module name.';document.getElementById('lua-reference-count').textContent=entries.length===100?'First 100 matches':`${entries.length} matches`;}
 function openReference(){close();renderResults();reference.showModal();search.focus();}
 document.getElementById('lua-reference').onclick=openReference;document.getElementById('lua-reference-close').onclick=()=>reference.close();reference.addEventListener('close',()=>cm.focus());search.oninput=renderResults;native.onchange=renderResults;
 status.onclick=()=>{if(diagnostic)onJump(diagnostic.message,{...diagnostic});};
 document.getElementById('lua-target').textContent='LÖVE '+luaTarget.love+' · subset';
 setInlays(true);check();
 return {close,check,suspend(){request++;clearTimeout(timer);clearTimeout(watchdog);compiler?.terminate();compiler=null;close();},refresh(){if(project().sourceName!==lastSource)schedule();},destroy(){disposed=true;request++;clearTimeout(timer);clearTimeout(watchdog);clearTimeout(hoverTimer);compiler?.terminate();clearHighlight();cm.removeKeyMap(keymap);cm.off('inputRead',inputRead);cm.off('cursorActivity',cursorActivity);cm.off('change',schedule);cm.off('changes',renderInlays);cm.off('swapDoc',swapDocument);cm.off('scroll',closeReference);cm.off('blur',blur);wrapper.removeEventListener('mousedown',pointerDown);wrapper.removeEventListener('mousemove',hover);wrapper.removeEventListener('mouseleave',leave);document.removeEventListener('mouseup',pointerUp);window.removeEventListener('blur',pointerUp);document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',closeReference);cm.operation?.(()=>{for(const item of inlayMarks)item.mark.clear();});inlayMarks=[];inlayButton.onclick=null;popup.remove();}};
}
