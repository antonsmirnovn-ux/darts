/** User-selected Picsart / Gemini Orus recording set. Versioned to avoid old cached voices. */
export const CALLER_ROOT='/audio/orus-v1';
export function calloutPath(score:number|string):string|null{
 if(typeof score==='number'&&Number.isInteger(score)&&score>=0&&score<=180)return `${CALLER_ROOT}/${score}.mp3`;
 if(score==='Перебор')return `${CALLER_ROOT}/bust.mp3`;
 if(score==='Озвучка включена')return `${CALLER_ROOT}/voice-on.mp3`;
 return null;
}
