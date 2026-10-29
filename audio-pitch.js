// Authored semitone offsets. Native playback-rate pitch also changes duration.
export const pitchLimits=Object.freeze({min:-24,max:24});
export const defaultPitchRange=Object.freeze({minSemitones:-24,maxSemitones:24});
export function validatePitch(value){
 if(!Number.isFinite(value)||value<-24||value>24)throw new Error('Pitch must be finite, between −24 and +24 semitones.');
 return value;
}
export function validatePitchRange(range){
 if(!range||typeof range!=='object'||Array.isArray(range)||Object.keys(range).some(key=>!['minSemitones','maxSemitones'].includes(key))||!Number.isFinite(range.minSemitones)||!Number.isFinite(range.maxSemitones)||range.minSemitones>range.maxSemitones||range.minSemitones<-24||range.maxSemitones>24)throw new Error('Pitch range needs finite semitones: −24 ≤ minimum ≤ maximum ≤ +24.');
 return {minSemitones:range.minSemitones,maxSemitones:range.maxSemitones};
}
export const semitonesToRate=semitones=>2**(semitones/12);
export function samplePitchSemitones(range,random=Math.random){
 if(range==null)return 0;
 const {minSemitones,maxSemitones}=validatePitchRange(range);
 return minSemitones+(maxSemitones-minSemitones)*random();
}
