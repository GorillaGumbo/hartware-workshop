// One non-interactive explanation layer for DOM and React controls.
export function mountTooltips({document,window,delay=400}){
 const tip=document.createElement('div');tip.id='ui-tooltip';tip.className='ui-tooltip';tip.setAttribute('role','tooltip');tip.setAttribute('popover','manual');tip.hidden=true;document.body.append(tip);
 let hovered=null,focused=null,focusElement=null,anchor=null,described=null,pending=null,timer=null,leaveTimer=null,disposed=false,pointerInput=false;
 const blocked=new Set(),listeners=[];
 const textFor=element=>element?.getAttribute?.('data-tip')?.trim()||(element?.tagName==='BUTTON'?element.getAttribute('aria-label')?.trim():'')||'';
 function ownerFor(node){if(node?.nodeType&&tip.contains(node))return anchor;let fallback=null;for(let element=node?.nodeType===3?node.parentElement:node;element&&element!==tip;element=element.parentElement){if(element.getAttribute?.('data-tip')?.trim())return element;if(!fallback&&element.tagName==='BUTTON'&&textFor(element))fallback=element;}return fallback;}
 function available(element){
  if(!element?.isConnected||document.hidden)return false;
  for(let parent=element;parent;parent=parent.parentElement)if(parent.hidden||parent.getAttribute('aria-hidden')==='true'||(parent.tagName==='DIALOG'&&!parent.open))return false;
  return !element.getClientRects||element.getClientRects().length>0;
 }
 function clearLeave(){if(leaveTimer!==null)window.clearTimeout(leaveTimer);leaveTimer=null;}
 function clearTimer(){if(timer!==null)window.clearTimeout(timer);timer=null;pending=null;clearLeave();}
 function leave(){clearLeave();leaveTimer=window.setTimeout(()=>{leaveTimer=null;if(!hovered&&!focused)conceal();},120);}
 function detachDescription(){if(!described)return;const ids=(described.getAttribute('aria-describedby')??'').split(/\s+/).filter(id=>id&&id!==tip.id);if(ids.length)described.setAttribute('aria-describedby',ids.join(' '));else described.removeAttribute('aria-describedby');described=null;}
 function conceal(){clearTimer();try{tip.hidePopover?.();}catch{}tip.hidden=true;detachDescription();anchor=null;}
 function hide(){conceal();hovered=focused=focusElement=null;blocked.clear();}
 function place(){
  const box=anchor.getBoundingClientRect(),size=tip.getBoundingClientRect(),inset=8,gap=8,width=window.innerWidth,height=window.innerHeight;
  const left=Math.max(inset,Math.min(box.left+(box.width-size.width)/2,width-size.width-inset));
  const below=box.bottom+gap,top=below+size.height<=height-inset?below:box.top-size.height-gap;
  tip.style.left=left+'px';tip.style.top=Math.max(inset,Math.min(top,height-size.height-inset))+'px';
 }
 function refresh(){
  if(disposed||!anchor)return;
  const text=textFor(anchor);if(!text||!available(anchor)){hide();return;}
  if(tip.textContent!==text)tip.textContent=text;
  place();
 }
 function show(owner){
  if(disposed||blocked.has(owner)||!available(owner)||!textFor(owner))return;
  conceal();anchor=owner;tip.textContent=textFor(owner);
  // A popover escapes card clipping and the modal top layer without taking focus.
  // Browsers without popovers keep the fixed layer inside the active dialog.
  const host=owner.closest?.('dialog[open]')??document.body;if(tip.parentElement!==host)host.append(tip);
  described=focused===owner&&focusElement?focusElement:owner;
  const ids=new Set((described.getAttribute('aria-describedby')??'').split(/\s+/).filter(Boolean));ids.add(tip.id);described.setAttribute('aria-describedby',[...ids].join(' '));
  tip.hidden=false;try{tip.showPopover?.();}catch{}place();
 }
 function reconcile(immediate=false){
  const owner=hovered??focused;if(!owner||blocked.has(owner)||!available(owner)||!textFor(owner)){conceal();return;}
  if(anchor===owner&&!tip.hidden){refresh();return;}
  if(pending===owner&&!immediate)return;
  conceal();if(immediate){show(owner);return;}
  pending=owner;timer=window.setTimeout(()=>{timer=null;pending=null;if((hovered??focused)===owner)show(owner);},delay);
 }
 function dismiss(){if(hovered)blocked.add(hovered);if(focused)blocked.add(focused);conceal();}
 function listen(surface,type,handler,options){surface.addEventListener(type,handler,options);listeners.push(()=>surface.removeEventListener(type,handler,options));}
 listen(document,'pointerover',event=>{if(event.pointerType==='touch')return;const owner=ownerFor(event.target);if(owner===hovered)return;hovered=owner;clearLeave();if(!owner&&anchor&&!focused){leave();return;}reconcile(false);},true);
 listen(document,'pointerout',event=>{if(event.pointerType==='touch'||ownerFor(event.relatedTarget)===hovered)return;blocked.delete(hovered);hovered=null;if(anchor&&!focused){leave();return;}reconcile(!!focused);},true);
 listen(document,'focusin',event=>{focused=ownerFor(event.target);focusElement=event.target;hovered=null;if(pointerInput){blocked.add(focused);conceal();return;}blocked.delete(focused);reconcile(true);},true);
 listen(document,'focusout',event=>{if(focused?.contains?.(event.relatedTarget))return;blocked.delete(focused);focused=focusElement=null;reconcile(false);},true);
 listen(document,'pointerdown',event=>{pointerInput=true;if(event.pointerType==='touch')hide();else dismiss();},true);
 listen(document,'click',dismiss,true);listen(document,'dragstart',hide,true);
 listen(document,'keydown',event=>{pointerInput=false;if(event.key==='Escape')dismiss();},true);
 listen(document,'scroll',hide,true);listen(window,'resize',hide);listen(window,'blur',hide);listen(window,'pagehide',hide);
 listen(document,'visibilitychange',()=>{if(document.hidden)hide();});
 const observer=window.MutationObserver?new window.MutationObserver(refresh):null;
 observer?.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-tip','aria-label','hidden','aria-hidden','open']});
 return {hide,refresh,dispose(){hide();disposed=true;observer?.disconnect();for(const remove of listeners)remove();tip.remove();}};
}
