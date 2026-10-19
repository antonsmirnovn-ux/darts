'use client';
import { useCallback, useEffect, useRef } from 'react';
import { calloutPath } from '@/lib/caller';
export function useCaller(onError:(message:string)=>void){
 const audio=useRef<HTMLAudioElement|null>(null),sequence=useRef(0);
 const stop=useCallback(()=>{sequence.current++;if(audio.current){audio.current.pause();audio.current.currentTime=0}},[]);
 useEffect(()=>{
  audio.current=new Audio(calloutPath('Озвучка включена')!);audio.current.preload='auto';audio.current.load();
  return()=>{stop();if(audio.current){audio.current.removeAttribute('src');audio.current.load()}audio.current=null};
 },[stop]);
 const speak=useCallback((score:number|string)=>{
  stop();const turn=sequence.current;onError('');
  const src=calloutPath(score),player=audio.current;
  if(!src||!player){onError('Запись этого результата недоступна.');return}
  if(player.getAttribute('src')!==src)player.src=src;
  player.volume=0.85;player.playbackRate=1;
  void player.play().catch(()=>{if(turn===sequence.current)onError('Звук не воспроизведён. Проверьте громкость и включите озвучку заново.')});
 },[onError,stop]);
 return {speak,stop};
}
