'use client';
import { useState } from 'react';
import { playerId, type Club, keyName, playerSummary, playerMatchSummary } from '@/lib/club';
import { replay, gameTitle, winnerText, type GameKind, type Match } from '@/lib/darts';
export function ClubPanel({club,onChange,onMatch}:{club:Club;onChange:(c:Club)=>void;onMatch:(m:Match)=>void}){
 const [names,setNames]=useState(''),[selected,setSelected]=useState(''),[message,setMessage]=useState('');
 const [game,setGame]=useState<GameKind|'all'>('all');
 const [query,setQuery]=useState<{player:string;game:GameKind|'all'}|null>(null);
 const summary=query?playerSummary(club,query.player,query.game==='all'?undefined:query.game):null;
 const shown=summary?.matches??[];
 const add=()=>{const list=names.split(/[\n,;]/).map(n=>n.trim()).filter(Boolean);if(!list.length)return;if(list.some(n=>n.length>32)){setMessage('Имя должно быть не длиннее 32 символов.');return}const used=new Set(club.players.map(p=>keyName(p.name)));const added=list.filter(n=>{if(used.has(keyName(n)))return false;used.add(keyName(n));return true}).map(name=>({id:playerId(name),name}));onChange({...club,players:[...club.players,...added]});setNames('');setMessage(`Добавлено игроков: ${added.length}`)};
 return <div className="club-panel">
 {!query&&<div className="club-history-search"><label>Игрок<select className="history-game-filter" aria-label="История игрока" value={selected} onChange={e=>{setSelected(e.target.value);setQuery(null)}}><option value="">Выберите игрока</option>{club.players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <label>Игра<select className="history-game-filter" aria-label="Фильтр истории по игре" value={game} onChange={e=>{setGame(e.target.value as GameKind|'all');setQuery(null)}}><option value="all">Все игры</option>{(['x01','cricket','round','score'] as GameKind[]).map(k=><option value={k} key={k}>{gameTitle(k)}</option>)}</select></label>
 <button className="primary" disabled={!selected} onClick={()=>setQuery({player:selected,game})}>Посмотреть</button></div>}
 {query&&<button className="primary club-history-back" onClick={()=>setQuery(null)}>Назад</button>}
 {query&&<h3 className="club-results-title">{club.players.find(p=>p.id===query.player)?.name} · {query.game==='all'?'Все игры':gameTitle(query.game)}</h3>}
 {summary&&<div className="club-stats"><span>Матчей завершено<strong>{summary.played}</strong></span><span>Побед, включая командные<strong>{summary.wins}</strong></span>{query?.game!=='all'&&<><span>Средний за 3, очки<strong>{summary.average.toFixed(1)}</strong></span><span>Лучший подход<strong>{summary.best}</strong></span><span>Подходов 180<strong>{summary.maxes}</strong></span><span>Подходов больше 100<strong>{summary.hundreds}</strong></span>{query?.game==='x01'&&<span>Лучшее закрытие<strong>{summary.bestOut||'—'}</strong></span>}</>}</div>}
 {query&&<div className="club-history">{[...shown].reverse().map(s=>{const m=replay(s),personal=playerMatchSummary(m,query.player),classic=!m.config.game||m.config.game==='x01';return <button className="history-match" key={s.id} onClick={()=>onMatch(m)}><span>{s.startedAt?new Date(s.startedAt).toLocaleDateString('ru-RU'):'Без даты'} · {s.config.game&&s.config.game!=='x01'?gameTitle(s.config.game):s.config.start}</span><span className="history-match-meta">Лучший подход: {personal.best}</span>{classic&&(personal.legs.length?personal.legs.map(l=><span className="history-match-meta" key={l.leg}>Лег {l.leg}: {m.config.teams?'команда — ':''}{l.darts} дротиков · Закрытие: {l.checkout}</span>):<span className="history-match-meta">Игрок не закрывал леги</span>)}<strong>{s.config.sides.map(x=>x.name).join(' / ')}</strong><span>{m.status==='won'?winnerText(m):'Не завершён'} · {(s.config.game&&s.config.game!=='x01'?m.scores:m.wins).join(' : ')}</span></button>})}{!shown.length&&<p className="club-note">У этого игрока пока нет завершённых матчей по выбранному фильтру.</p>}</div>}
 {!query&&<section className="club-new-player"><h3>Новый игрок</h3><label>Имя игрока<textarea aria-label="Список постоянных игроков" value={names} onChange={e=>setNames(e.target.value)} placeholder={'Имя или несколько имён через запятую'}/></label><button className="primary" onClick={add} disabled={!names.trim()}>Добавить</button></section>}
 {!query&&message&&<p role="status">{message}</p>}
 </div>
}
