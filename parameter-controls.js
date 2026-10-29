// Shared UI-only numeric entry; callers retain validation, history and playback ownership.
export const parameterPercent=(value,min,max)=>Math.max(0,Math.min(100,(value-min)/(max-min)*100));
export function parameterNumber(text,{min=-Infinity,max=Infinity,step=0,choices=null}={}){
 const raw=String(text).trim().replaceAll('−','-');
 let value;
 if(choices){value=choices.findIndex(label=>label.toLowerCase()===raw.toLowerCase());if(value<0)value=/^[+-]?\d+$/.test(raw)?Number(raw):NaN;}
 else if(/^-(?:inf(?:inity)?|∞)(?:\s*dB)?$/i.test(raw))value=-Infinity;
 else {const match=raw.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:\s*(?:dB|ms|s|st|semitones|%))?$/i);value=match?Number(match[1]):NaN;}
 if(Number.isNaN(value)||value===Infinity||value<min||value>max)throw Error('Enter a value from '+min+' to '+max+'.');
 if(value===-Infinity){if(min===-Infinity)return value;throw Error('Enter a finite value.');}
 if(step>0){const origin=Number.isFinite(min)?min:0;value=Number((origin+Math.round((value-origin)/step)*step).toFixed(10));}
 return Math.max(min,Math.min(max,value));
}
export const volumeToDb=value=>value>0?20*Math.log10(value):-Infinity;
export const dbToVolume=value=>value===-Infinity?0:10**(value/20);
export function paintParameterSlider(slider){slider.style.setProperty('--parameter-fill','calc(9px + (100% - 18px) * '+parameterPercent(Number(slider.value),Number(slider.min),Number(slider.max))/100+')');}
export function mountParameterValue(host,{label,getValue,onChange,min=-Infinity,max=Infinity,step=0,format=String,disabled=()=>false,document=host.ownerDocument,portal=null,restoreFocus=null}){
 let input=null,popup=null,disposed=false;
 host.tabIndex=0;host.setAttribute('role','button');host.setAttribute('aria-label',label+' · Double-click or Enter to type a value');host.setAttribute('data-tip',label+' · Double-click to type a value');
 const stop=e=>{e.stopPropagation();};
 function close(restore=false){if(!input)return;const old=input;input=null;old.onkeydown=old.onblur=old.onpointerdown=old.onclick=old.ondblclick=null;popup?.remove();popup=null;host.classList.remove('is-editing');sync();if(restore&&!disposed){if(restoreFocus)restoreFocus();else host.focus({preventScroll:true});}}
 function sync(){if(!input&&!disposed)host.textContent=format(getValue());host.setAttribute('aria-disabled',String(disabled()));host.tabIndex=disabled()?-1:0;if(input&&disabled())close();}
 function commit(restore){if(!input||disposed)return;if(disabled()){close(restore);return;}let value;try{value=parameterNumber(input.value,{min,max,step});}catch(error){input.setAttribute('aria-invalid','true');input.setAttribute('title',error.message);return false;}const old=getValue();close(restore);if(value!==old)onChange(value);sync();return true;}
 function open(e){e?.preventDefault();e?.stopPropagation();if(disposed||disabled()||input)return;input=document.createElement('input');input.type='text';input.inputMode='decimal';input.className='parameter-value-input nodrag nowheel';input.setAttribute('aria-label',label);input.value=String(getValue());host.classList.add('is-editing');if(portal){const box=host.getBoundingClientRect();popup=document.createElement('span');popup.className='parameter-value-popover';popup.style.left=Math.max(8,Math.min((document.documentElement?.clientWidth??(box.right+120))-110,box.left))+'px';popup.style.top=Math.max(8,Math.min((document.documentElement?.clientHeight??(box.bottom+70))-48,box.bottom+5))+'px';popup.append(input);portal.append(popup);}else host.replaceChildren(input);input.onpointerdown=input.onclick=input.ondblclick=stop;input.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();commit(true);}else if(e.key==='Escape'){e.preventDefault();close(true);}};input.onblur=()=>{if(commit(false)===false)close();};input.focus({preventScroll:true});input.select();}
 host.ondblclick=open;host.onpointerdown=stop;host.onkeydown=e=>{if(e.key==='Enter'||e.key==='F2'){open(e);}};sync();
 return {sync,open,destroy(){disposed=true;close();host.ondblclick=host.onpointerdown=host.onkeydown=null;}};
}
