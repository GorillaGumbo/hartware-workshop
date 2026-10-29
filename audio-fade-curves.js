// Shared amplitude laws for file edges, crossfades, waveform analysis and playback.
export function validateFadeCurve(value){if(!['linear','equal-power'].includes(value))throw new Error('Fade type must be linear or equal-power.');return value;}
export function fadeCurveGain(position,curve='linear'){const t=Math.max(0,Math.min(1,position));return curve==='equal-power'?Math.sin(t*Math.PI/2):t;}
