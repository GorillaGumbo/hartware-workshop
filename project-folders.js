// Folders organize existing project identities; names and runtime paths stay unchanged.
export const explorerSections=['scripts','events','images','sounds'];
export const emptyOrganization=()=>({folders:[],items:[]});
export function validFolderName(name){return typeof name==='string'&&name===name.trim()&&name.length>0&&name.length<=80&&!/[\\/\u0000-\u001f\u007f]/.test(name)&&!['.','..'].includes(name);}
export function hasProjectItem(project,section,id){return section==='scripts'?(project.scriptPresent!==false&&id==='main.lua'||!!project.scripts?.some(script=>script.id===id)):section==='events'?!!project.events?.some(x=>x.id===id):!!project.assets.some(x=>x.id===id&&x.type===(section==='sounds'?'audio':'image'));}
const onlyKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
export function validateOrganization(org,project){
 if(!onlyKeys(org,['folders','items'])||!Array.isArray(org.folders)||!Array.isArray(org.items)||org.folders.length>128||org.items.length>196)throw Error('The project folder list is invalid.');
 const folders=new Map(),siblings=new Set(),placements=new Set();
 for(const f of org.folders){if(!onlyKeys(f,['id','section','parentId','name'])||typeof f.id!=='string'||!f.id||f.id.length>100||folders.has(f.id)||!explorerSections.includes(f.section)||!validFolderName(f.name)||(f.parentId!==null&&typeof f.parentId!=='string'))throw Error('A project folder is invalid.');const key=JSON.stringify([f.section,f.parentId,f.name.toLowerCase()]);if(siblings.has(key))throw Error('Folders in the same location need different names.');siblings.add(key);folders.set(f.id,f);}
 for(const f of org.folders){let at=f,depth=0;const seen=new Set();while(at){if(seen.has(at.id)||++depth>8)throw Error('Folders cannot contain themselves or be more than eight levels deep.');seen.add(at.id);if(at.parentId===null)break;const parent=folders.get(at.parentId);if(!parent||parent.section!==f.section)throw Error('A folder must stay inside its own project category.');at=parent;}}
 for(const item of org.items){const key=JSON.stringify([item?.section,item?.id]);if(!onlyKeys(item,['section','id','parentId'])||!explorerSections.includes(item.section)||typeof item.id!=='string'||!hasProjectItem(project,item.section,item.id)||placements.has(key)||!folders.has(item.parentId)||folders.get(item.parentId).section!==item.section)throw Error('A project item has an invalid folder.');placements.add(key);}
 return org;
}
export function organizationFor(project){return project.organization??emptyOrganization();}
export function parentFolder(project,section,id){return organizationFor(project).items.find(x=>x.section===section&&x.id===id)?.parentId??null;}
export function pruneOrganization(project){const org=organizationFor(project);org.items=org.items.filter(x=>hasProjectItem(project,x.section,x.id)&&org.folders.some(f=>f.id===x.parentId&&f.section===x.section));return org;}
export function createFolder(project,section,parentId=null,name='New folder',id=crypto.randomUUID()){
 const org=structuredClone(organizationFor(project));let n=2,unique=name;while(org.folders.some(f=>f.section===section&&f.parentId===parentId&&f.name.toLowerCase()===unique.toLowerCase()))unique=`${name} ${n++}`;
 org.folders.push({id,section,parentId,name:unique});validateOrganization(org,project);project.organization=org;return id;
}
export function renameFolder(project,id,name){const org=structuredClone(organizationFor(project)),folder=org.folders.find(f=>f.id===id);if(!folder)throw Error('This folder is no longer available.');if(folder.name===name)return false;folder.name=name;validateOrganization(org,project);project.organization=org;return true;}
export function moveProjectItem(project,source,parentId){
 const org=structuredClone(organizationFor(project));if(source.kind==='folder'){const folder=org.folders.find(f=>f.id===source.id&&f.section===source.section);if(!folder)throw Error('This folder is no longer available.');if(folder.parentId===parentId)return false;folder.parentId=parentId;}
 else{if(!hasProjectItem(project,source.section,source.id))throw Error('This item is no longer available.');if(parentFolder(project,source.section,source.id)===parentId)return false;org.items=org.items.filter(x=>x.section!==source.section||x.id!==source.id);if(parentId!==null)org.items.push({section:source.section,id:source.id,parentId});}
 validateOrganization(org,project);project.organization=org;return true;
}
export function removeFolder(project,id){const org=structuredClone(organizationFor(project));if(!org.folders.some(f=>f.id===id))return false;if(org.folders.some(f=>f.parentId===id)||org.items.some(x=>x.parentId===id))throw Error('Move the folder’s contents before deleting it.');org.folders=org.folders.filter(f=>f.id!==id);project.organization=org;return true;}
