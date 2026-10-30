// Local SVGs keep file tools independent of icon-font subsets.
export const snippetIconPath='M680-80v-120H560v-80h120v-120h80v120h120v80H760v120h-80ZM200-200v-200h80v120h120v80H200Zm0-360v-200h200v80H280v120h-80Zm480 0v-120H560v-80h200v200h-80Z';
export function createSnippetIcon(document){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');svg.setAttribute('viewBox','0 -960 960 960');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','currentColor');path.setAttribute('d',snippetIconPath);svg.append(path);return svg;}
export const audioToolPaths={
 undo:'M7,19V17h7.1q1.57,0 2.74-1T18,13.5T16.84,11T14.1,10H7.8l2.6,2.6L9,14L4,9L9,4l1.4,1.4L7.8,8h6.3q2.43,0 4.16,1.57T20,13.5t-1.74,3.93Q16.53,19 14.1,19H7Z',
 redo:'M9.9,19q-2.42,0-4.16-1.57T4,13.5T5.74,9.57T9.9,8h6.3L13.6,5.4L15,4l5,5l-5,5l-1.4-1.4L16.2,10H9.9q-1.57,0-2.74,1T6,13.5T7.16,16T9.9,17H17v2H9.9Z',
 loop:'M9,21L7.58,19.6L9.18,18H9q-2.93,0-4.96-2.04T2,11Q2,8.07 4.04,6.04T9,4h6q2.93,0 4.96,2.04T22,11t-2.04,4.96T15,18V16q2.07,0 3.54-1.46T20,11q0-2.08-1.46-3.54T15,6H9Q6.93,6 5.46,7.46T4,11t1.46,3.56T9,16.2H9.4L7.6,14.4L9,13l4,4L9,21Z',
 fade:'M2,22L21.98,2.02V12.65q-0.45-0.27-0.95-0.44t-1.05-0.26V6.85L6.83,20H13.2q0.2,0.57 0.5,1.07T14.38,22H2Zm16,0V19H15V17h3V14h2v3h3v2H20v3H18ZM6.83,20L19.98,6.85q-1.88,1.88-3.41,3.41q-1.54,1.54-3.02,3.03t-3.09,3.09T6.83,20Z',
 download:'M18,21l4-4l-1.4-1.4L19,17.2V13.02H17V17.2l-1.6-1.6L14,17l4,4Zm-4,3V22h8v2H14ZM6,20q-0.82,0-1.41-0.59T4,18V4Q4,3.17 4.59,2.59T6,2h7l6,6v3.02H17V9H12V4H6V18h6v2H6Zm0-2V11.02V9V4V18Z',
 play:'M8 5v14l11-7Z',stop:'M6 6h12v12H6Z',delete:'M7 4V2h10v2h5v2h-2v16H4V6H2V4Zm-1 2v14h12V6Zm3 2v10h2V8Zm4 0v10h2V8Z'
};
export function createAudioToolIcon(document,name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','currentColor');path.setAttribute('d',audioToolPaths[name]);svg.append(path);return svg;}
export function createDownloadIcon(document){return createAudioToolIcon(document,'download');}
