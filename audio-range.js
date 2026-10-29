// Authored dB limits only. Sample at an Event trigger, never an update frame.
export const defaultVolumeRange=Object.freeze({minDb:-6,maxDb:0});
export function validateVolumeRange(range){
 if(!range||typeof range!=='object'||Array.isArray(range)||Object.keys(range).some(key=>!['minDb','maxDb'].includes(key))||!Number.isFinite(range.minDb)||!Number.isFinite(range.maxDb)||range.minDb>range.maxDb||range.maxDb>0)throw new Error('Volume range needs finite dB values: minimum ≤ maximum ≤ 0 dB.');
 return {minDb:range.minDb,maxDb:range.maxDb};
}
export const dbToGain=db=>10**(db/20);
export function sampleVolumeDb(range,random=Math.random){
 if(range==null)return 0;
 const {minDb,maxDb}=validateVolumeRange(range);
 return minDb+(maxDb-minDb)*random();
}
