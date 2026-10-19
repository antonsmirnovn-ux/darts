'use client';
import { useState } from 'react';
import { ArrowLeft, BarChart3, Delete, Undo2, Trophy } from 'lucide-react';
import { advance, CRICKET_TARGETS, currentPlayer, gameTitle, HITS, stats, winnerText, type Match, type Hit, type VisitInput } from '@/lib/darts';
import { useKeyClick } from '@/hooks/use-key-click';
const miss=HITS.find(h=>h.value===0)!;
const hitFor=(target:number,multiple:number)=>HITS.find(h=>h.label===(target===25?(multiple===2?'Bull':'25'):multiple===3?`T${target}`:multiple===2?`D${target}`:String(target)))!;
function Marks({count}:{count:number}){return <svg className="cricket-mark" viewBox="0 0 40 40" aria-hidden="true">{count===0?null:count===1?<path d="M11 29L29 11"/>:<><path d="M10 10l20 20M30 10L10 30"/>{count===3&&<circle cx="20" cy="20" r="17"/>}</>}</svg>}
function Dots({count}:{count:number}){return <span className="mark-dots" aria-hidden="true">{Array.from({length:count},(_,i)=><i key={i}/>)}</span>}
function preview(m:Match,hits:Hit[]){
  if(!hits.length)return null;
  const input={score:hits.reduce((sum,h)=>sum+h.value,0),darts:hits.length,hits};
  try{return advance(m,{type:'visit',input})}catch{return null}
}
export function OtherGame({m,onCommit,onUndo,onMenu,onDetails,onRematch}:{m:Match;onCommit:(input:VisitInput)=>Match;onUndo:()=>void;onMenu:()=>void;onDetails:()=>void;onRematch:()=>void}){
 const [entry,setEntry]=useState(''),[hits,setHits]=useState<Hit[]>([]),[error,setError]=useState('');
 const click=useKeyClick(),kind=m.config.game!,cricket=kind==='cricket',round=m.turns[m.active]+1,target=round===21?25:round;
 const next=preview(m,hits),done=hits.length===3||next?.status==='won';
 const add=(hit:Hit)=>{if(done)return;click();setHits(a=>[...a,hit]);setError('')};
 const digit=(value:string)=>{click();setEntry(a=>(a==='0'?value:a+value).slice(0,3));setError('')};
 const submit=()=>{try{onCommit(kind==='score'?{score:Number(entry),darts:3}:{score:hits.reduce((sum,h)=>sum+h.value,0),darts:hits.length,hits})}catch(e){setError((e as Error).message)}};
 const draftPoints=cricket?(next?.scores[m.active]??m.scores[m.active])-m.scores[m.active]:hits.reduce((sum,h)=>sum+h.value,0);
 return <section className={`other-game ${cricket?'cricket-game':''}`}>
  <div className="other-toolbar"><button className="toolbar-button" aria-label="В меню" onClick={onMenu}><ArrowLeft/></button><div><h1>{gameTitle(kind)}</h1><p>{m.status==='won'?'Игра завершена':cricket?`Подход ${round}`:`Подход ${round} / ${kind==='round'?21:m.config.rounds??10}`}</p></div><button className="toolbar-button" aria-label="Ходы и статистика" onClick={onDetails}><BarChart3/></button></div>
  {cricket&&<div className="cricket-scoreboard" data-players={m.config.sides.length}>{m.config.sides.map((side,i)=>{return <article className={i===m.active?'current':''} key={i}>
   <h2><span className="cricket-player-number">{i+1}</span>{side.name}</h2><strong data-testid={`score-${i}`}>{m.scores[i]}</strong>
   <div className="cricket-player-average"><span>Ср. попаданий</span><b>{(()=>{const visits=m.visits.filter(v=>v.side===i),darts=visits.reduce((a,v)=>a+v.darts,0),marks=visits.reduce((a,v)=>a+(v.hits??[]).reduce((b,h)=>b+(h.value===0?0:h.label==='Bull'?2:h.label.startsWith('T')?3:h.label.startsWith('D')?2:1),0),0);return darts?(marks*3/darts).toFixed(2):'0.00'})()}</b></div>
  </article>})}</div>}
  {cricket&&m.status==='playing'&&<>
   <p className="other-turn" aria-live="polite">{currentPlayer(m)} — ваш бросок</p>
   <div className="cricket-entry-top"><div className="cricket-entry-bar" aria-label="Дротики подхода">{[0,1,2].map(i=><output key={i} aria-label={`${i+1}-й дротик`}>{hits[i]?.label??'—'}</output>)}<button className="coral-action" aria-label="Удалить дротик" disabled={!hits.length} onClick={()=>setHits(a=>a.slice(0,-1))}><Delete/></button><button className="primary" disabled={!hits.length} onClick={submit}>Записать</button></div></div>
  </>}
  {cricket?<div className="cricket-board">
   <div className="cricket-mark-labels" style={{gridTemplateColumns:`repeat(${m.config.sides.length},36px) minmax(0,1fr)`}}>{m.config.sides.map((_,i)=><span key={i}>{i+1}</span>)}<span>Попадания в сектор</span></div>
   {CRICKET_TARGETS.map((n,t)=>{const closed=m.marks!.every(row=>row[t]===3);return <div className={`cricket-sector-row ${closed?'closed-sector':''}`} key={n} aria-label={closed?`Сектор ${n===25?'Bull':n} закрыт всеми игроками`:undefined} style={{gridTemplateColumns:`repeat(${m.config.sides.length},36px) minmax(0,1fr)`}}>
    {m.config.sides.map((side,i)=><span key={i} aria-label={`${side.name}, ${n}: ${m.marks![i][t]} из 3`}><Marks count={m.marks![i][t]}/></span>)}
    <div className="cricket-sector-buttons">{(n===25?[1,2]:[1,2,3]).map(mult=><button key={mult} disabled={m.status!=='playing'||done||closed} aria-label={`${n===25?'Bull':n}, ${mult} ${mult===1?'отметка':'отметки'}`} onClick={()=>add(hitFor(n,mult))}><strong>{n===25?'Bull':n}</strong><Dots count={mult}/></button>)}</div>
   </div>})}
  </div>:<div className="points-board">{m.config.sides.map((side,i)=><article className={i===m.active?'current':''} key={i}><h2>{side.name}</h2><strong data-testid={`score-${i}`}>{m.scores[i]}</strong><span>Подходов: {m.turns[i]} · ср. {stats(m,i).average.toFixed(1)}</span></article>)}</div>}
  {m.status==='won'?<div className="other-winner panel"><Trophy/><h2>{winnerText(m)}</h2><p>{m.config.sides.map((s,i)=>`${s.name}: ${m.scores[i]}`).join(' · ')}</p><button className="primary" onClick={onRematch}>Реванш</button><button className="secondary" onClick={onMenu}>Выбрать игру</button><button className="text-button" onClick={onUndo}><Undo2 size={18}/> Отменить последний ход</button></div>:<>
   {!cricket&&<p className="other-turn" aria-live="polite">{currentPlayer(m)} — ваш бросок</p>}
   {kind==='score'?<div className="reference-total"><div className="reference-entry"><output aria-label="Введённые очки" aria-live="polite" className={!entry?'placeholder':''}>{entry||'Введите счёт'}</output><button className="reference-submit" disabled={!entry} onClick={submit}>Записать</button></div><div className="reference-keypad keypad">{[1,2,3,4,5,6,7,8,9].map(n=><button key={n} onClick={()=>digit(String(n))}>{n}</button>)}<button className="delete-key" aria-label="Удалить цифру" onClick={()=>setEntry(a=>a.slice(0,-1))}><Delete/></button><button onClick={()=>digit('0')}>0</button><button className="undo-key" disabled={!m.visits.length} onClick={onUndo}><Undo2/><span>Отменить ход</span></button></div></div>:<>
    {!cricket&&<div className="round-target"><span>Бросаем в</span><strong>{target===25?'25 / 50':`сектор ${target}`}</strong></div>}
    {!cricket&&<div className="other-slots" aria-label="Дротики подхода">{[0,1,2].map(i=><div key={i}><small>{i+1}-й</small><strong>{hits[i]?.label??'—'}</strong></div>)}<button className="coral-action" aria-label="Удалить дротик" disabled={!hits.length} onClick={()=>setHits(a=>a.slice(0,-1))}><Delete/></button></div>}
    {cricket?null:<div className="round-input">{(target===25?[1,2]:[1,2,3]).map(mult=><button key={mult} disabled={done} onClick={()=>add(hitFor(target,mult))}><strong>{target*mult}</strong><span>{target===25?(mult===1?'25':'Bull'):mult===1?'Одинарный':mult===2?'Удвоение':'Утроение'}</span></button>)}</div>}
    {!cricket&&<div className="other-actions"><button className="secondary" disabled={done} onClick={()=>add(miss)}>Мимо</button><button className="primary" disabled={cricket?!hits.length:!done} onClick={submit}>Записать{(cricket?hits.length>0:done)?` · ${draftPoints}`:''}</button></div>}
    {cricket&&<button className="secondary cricket-miss" disabled={done} onClick={()=>add(miss)}>Мимо</button>}
    <button className="coral-action other-undo" disabled={!m.visits.length} onClick={onUndo}><Undo2 size={18}/> Отменить ход</button>
   </>}
   {error&&<p className="error-text" role="alert">{error}</p>}
  </>}
 </section>;
}
export function OtherDetails({m}:{m:Match}){
 return <div className="other-details"><h3>{gameTitle(m.config.game)}</h3>{m.status==='won'&&<p>{winnerText(m)}</p>}<div className="other-totals">{m.config.sides.map((s,i)=><div key={i}><strong>{s.name}: {m.scores[i]}</strong><span>Подходов: {m.turns[i]} · Дротиков: {stats(m,i).darts}</span><span>Средний за 3: {stats(m,i).average.toFixed(1)} очка</span></div>)}</div><h3>История подходов</h3><div className="visit-list">{[...m.visits].reverse().map((v,i)=><div className="other-visit" key={i}><span>#{v.leg} · {v.player}</span><strong>+{v.credited} → {v.after}</strong>{v.hits&&<small>{v.hits.map(h=>h.label).join(' · ')}</small>}</div>)}{!m.visits.length&&<p>Пока нет записанных подходов.</p>}</div></div>;
}
