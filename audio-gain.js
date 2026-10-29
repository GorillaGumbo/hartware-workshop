// One linked gain for every channel; peak normalization does not alter the original PCM.
export const fileGainLimits=Object.freeze({minDb:-96,maxDb:96,targetDb:-1});
export function validateFileGain(value){if(!Number.isFinite(value)||value<fileGainLimits.minDb||value>fileGainLimits.maxDb)throw new Error('File gain must be between −96 and +96 dB.');return value;}
export const fileGainAmplitude=value=>10**(validateFileGain(value)/20);
export function normalizationGain(sourcePeak){
 if(!Number.isFinite(sourcePeak)||sourcePeak<0)throw new Error('Prepare the waveform before normalizing.');
 if(sourcePeak===0)throw new Error('This file is silent. There is no peak to normalize.');
 const value=fileGainLimits.targetDb-20*Math.log10(sourcePeak);validateFileGain(value);return Math.abs(value)<1e-6?0:value;
}
