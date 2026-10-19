'use client';

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useCaller } from '@/hooks/use-caller';
import { useKeyClick } from '@/hooks/use-key-click';
import { SharedClub } from '@/lib/shared-club';
import { OtherGame, OtherDetails } from '@/components/other-game';
import { ClubPanel } from '@/components/club-panel';
import { normalizeClub, normalizeSession, playerId, createId, CLUB_KEY, emptyClub, parseClub, upsertMatch, historyClub, HISTORY_EPOCH, type Club, type Player } from '@/lib/club';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LogOut, Settings, Grid3X3, Target, ArrowUpRight, ArrowRight, Users, UserRound, Trophy, Undo2, Delete, HelpCircle, Plus, Check, X, Crosshair, Flag, ChevronRight, BarChart3, ListOrdered, ShieldCheck } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { gameTitle, type GameKind, type Config, type Hit, type Session, type VisitInput, type Match, type OutRule, advance, initialMatch, rematchConfig, replay, currentPlayer, stats, legResults, checkout, canFinish, possibleScore, evaluateHits } from '@/lib/darts';

const STORAGE='oche.match.v1';
const colors=['#F47B6B','#F6F4F1','#F47B6B','#F6F4F1'];
const format=(n:number)=>n.toLocaleString('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1});

function Choices({label,value,onChange,options,className=''}:{label:string;value:string;onChange:(v:string)=>void;options:{value:string;label:React.ReactNode}[];className?:string}){
  return <RadioGroup aria-label={label} value={value} onValueChange={onChange} className={`choices ${className}`}>
    {options.map(o=><label className={`choice ${value===o.value?'selected':''}`} key={o.value}><RadioGroupItem className="choice-radio" value={o.value}/><span>{o.label}</span></label>)}
  </RadioGroup>;
}

function PlayerField({label,name,id,players,onChange}:{label:string;name:string;id:string|null;players:Player[];onChange:(name:string,id:string|null)=>void}){
 return <div className="roster-field"><Select value={id??'guest'} onValueChange={value=>{const p=players.find(p=>p.id===value);onChange(p?.name??'',p?.id??null)}}><SelectTrigger className="player-picker" aria-label={`${label}: выбрать игрока`}><SelectValue/></SelectTrigger><SelectContent className="player-picker-menu" position="popper" align="start"><SelectItem value="guest">Гость — ввести имя</SelectItem>{players.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}{!players.length&&<p className="picker-empty">Добавьте имена в разделе «Игроки и история».</p>}</SelectContent></Select>{!id&&<input aria-label={label} maxLength={32} placeholder="Имя гостя" value={name} onChange={e=>onChange(e.target.value,null)}/>}</div>;
}

function Setup({onStart,onCancel,previous,players}:{players:Player[];onStart:(c:Config)=>void;onCancel?:()=>void;previous?:Config}){
  const [game,setGame]=useState<GameKind>(previous?.game??'x01');
  const [rounds,setRounds]=useState(previous?.game==='score'?(previous.rounds??10):10);
  const [teams,setTeams]=useState(previous?.teams??false);
  const [count,setCount]=useState(previous&&!previous.teams?previous.sides.length:2);
  const [size,setSize]=useState(previous?.teams?previous.sides[0].players.length:2);
  const [start,setStart]=useState(previous?.start===301?301:501);
  const [target,setTarget]=useState(previous?.target??1);
  const [names,setNames]=useState<string[]>(Array.from({length:4},(_,i)=>previous&&!previous.teams?previous.sides[i]?.name??'':''));
  const [teamNames,setTeamNames]=useState(previous?.teams?previous.sides.map(s=>s.name):['','']);
  const [members,setMembers]=useState<string[][]>(Array.from({length:2},(_,t)=>Array.from({length:4},(_,i)=>previous?.teams?previous.sides[t]?.players[i]??'':'')));
  const [selected,setSelected]=useState<Record<string,string|null>>(()=>Object.fromEntries(previous?.sides.flatMap((side,t)=>side.players.map((_,i)=>[previous.teams?`${t}-${i}`:`${t}`,side.playerIds?.[i]??null]))??[]));
  const [error,setError]=useState('');
  const submit=()=>{
    const sides=teams?Array.from({length:2},(_,t)=>({name:teamNames[t].trim()||`Команда ${t+1}`,players:Array.from({length:size},(_,i)=>members[t][i].trim()||`Игрок ${t*size+i+1}`)})):Array.from({length:count},(_,i)=>({name:names[i].trim()||`Игрок ${i+1}`,players:[names[i].trim()||`Игрок ${i+1}`]}));
    const all=sides.flatMap(s=>s.players).map(n=>n.toLowerCase());
    if(new Set(all).size!==all.length){setError('Назовите игроков по-разному, чтобы не путать очередь и статистику.');return;}
    if(teams&&sides[0].name.toLowerCase()===sides[1].name.toLowerCase()){setError('У команд должны быть разные названия.');return;}
    onStart({game,rounds:game==='round'?21:rounds,start,out:'double',target,teams,sides:sides.map((side,t)=>({...side,playerIds:side.players.map((_,i)=>selected[teams?`${t}-${i}`:`${t}`]??null)}))});
  };
  return <section className="setup">
    <div className="page-heading"><div><p className="eyebrow">У ОДНОЙ МИШЕНИ</p><h1>Новая игра<span>.</span></h1></div><span className="outline-badge"><Target size={16}/> ДАРТС</span></div>
    <div className="game-picker" role="radiogroup" aria-label="Выбор игры">{(['x01','cricket','round','score'] as GameKind[]).map(kind=><button key={kind} type="button" role="radio" aria-checked={game===kind} className={game===kind?'selected':''} onClick={()=>setGame(kind)}><strong>{gameTitle(kind)}</strong><span>{{x01:'Списать счёт до нуля',cricket:'Закрыть 15–20 и Bull',round:'21 подход · секторы 1–20 и центр',score:'Набрать максимум очков'}[kind]}</span></button>)}</div>
    <div className="setup-grid">
      <div className="setup-rules panel">
        <div className="section-caption"><span>01</span><h2>Формат матча</h2>{game==='cricket'&&<Dialog><DialogTrigger asChild><button type="button" className="cricket-rules-help" aria-label="Правила крикета"><HelpCircle size={24} aria-hidden="true"/></button></DialogTrigger><DialogContent className="oche-dialog"><DialogTitle>Правила крикета</DialogTitle><DialogDescription>Секторы 15–20 и Bull. Игроки или команды бросают по очереди, до трёх дротиков за подход.</DialogDescription><div className="rules-content"><section><h3>Как закрыть сектор</h3><p>Наберите три отметки: одинарное попадание — одна, удвоение — две, утроение — три. В центре 25 даёт одну отметку, Bull (50) — две.</p></section><section><h3>Как набрать очки</h3><p>После закрытия сектора лишние попадания приносят очки, пока он открыт хотя бы у одного соперника. Когда сектор закрыли все, очки за него больше не начисляются.</p></section><section><h3>Как победить</h3><p>Закройте все секторы и наберите не меньше очков, чем каждый из соперников.</p></section></div></DialogContent></Dialog>}</div>
        {game==='x01'&&<fieldset><legend>Начальный счёт</legend><Choices label="Начальный счёт" value={String(start)} onChange={v=>setStart(+v)} className="score-choices" options={[301,501].map(v=>({value:String(v),label:v}))}/></fieldset>}
        <fieldset><legend>Как играем</legend><Choices label="Как играем" value={teams?'teams':'single'} onChange={v=>setTeams(v==='teams')} options={[{value:'single',label:<><UserRound size={18}/> Каждый за себя</>},{value:'teams',label:<><Users size={18}/> Командами</>}]}/></fieldset>
        {game==='x01'&&<fieldset><legend>Побед в легах для победы в матче</legend><Choices label="Побед для победы в матче" value={String(target)} onChange={v=>setTarget(+v)} options={[1,2,3,5].map(v=>({value:String(v),label:v}))}/></fieldset>}
        {game==='score'&&<fieldset><legend>Подходов по 3 дротика</legend><Choices label="Количество подходов" value={String(rounds)} onChange={v=>setRounds(+v)} options={[5,10,20].map(v=>({value:String(v),label:v}))}/></fieldset>}
        {(game==='round'||game==='score')&&<p className="game-rules-summary">{game==='round'?'По 3 дротика в секторы 1–20 по порядку, затем 3 в центр (25/50). Удвоения и утроения учитываются. Побеждает наибольшая сумма.':'По 3 дротика за подход. Побеждает наибольшая сумма после одинакового числа подходов. При равном счёте — ничья.'}</p>}
      </div>
      <div className="setup-players panel">
        <div className="section-caption"><span>02</span><h2>{teams?'Состав команд':'Игроки'}</h2></div>
        <fieldset><legend>{teams?'Игроков в каждой команде':'Количество игроков'}</legend><Choices label={teams?'Игроков в команде':'Количество игроков'} value={String(teams?size:count)} onChange={v=>teams?setSize(+v):setCount(+v)} options={[2,3,4].map(v=>({value:String(v),label:teams?`${v} × ${v}`:String(v)}))}/></fieldset>
        {!teams?<div className="player-inputs">{Array.from({length:count},(_,i)=><div className="player-input" key={i}><span className="player-avatar">{i+1}</span><PlayerField label={`Имя игрока ${i+1}`} name={names[i]} id={selected[String(i)]??null} players={players} onChange={(name,id)=>{setNames(a=>a.map((n,j)=>j===i?name:n));setSelected(a=>({...a,[String(i)]:id}))}}/></div>)}</div>:<div className="team-inputs">{[0,1].map(t=><div className="team-block" key={t}><label className="team-title-input"><Users size={18}/><input aria-label={`Название команды ${t+1}`} maxLength={32} placeholder={`Команда ${t+1}`} value={teamNames[t]} onChange={e=>setTeamNames(a=>a.map((n,i)=>i===t?e.target.value:n))}/></label>{Array.from({length:size},(_,i)=><PlayerField key={i} label={`Команда ${t+1}, игрок ${i+1}`} name={members[t][i]} id={selected[`${t}-${i}`]??null} players={players} onChange={(name,id)=>{setMembers(a=>a.map((m,j)=>j===t?m.map((n,k)=>k===i?name:n):m));setSelected(a=>({...a,[`${t}-${i}`]:id}))}}/>)}</div>)}</div>}
        <div className="setup-bottom"><div className="match-summary"><span>{game==='x01'?start:gameTitle(game)}</span><span>{teams?`${size} на ${size}`:`${count} игрока`}</span><span>{game==='x01'?`До ${target} ${target===1?'победы':'побед'}`:game==='round'?'21 подход':game==='score'?`${rounds} подходов`:'15–20 · Bull'}</span></div>
          {error&&<p className="error-text" role="alert">{error}</p>}
          <button className="primary start-button" onClick={submit}>К мишени <ArrowUpRight size={23}/></button>
          {onCancel&&<button className="text-button cancel-setup" onClick={onCancel}>Вернуться к матчу</button>}
        </div>
      </div>
    </div>
    <p className="local-note"><ShieldCheck size={15}/> Общий список игроков и история доступны с любого телефона.</p>
  </section>;
}

function Scoreboard({m}:{m:Match}){
  const i=m.active,s=m.config.sides[i],st=stats(m,i),last=m.visits.filter(v=>v.side===i&&v.leg===m.leg).at(-1);
  const route=checkout(m.scores[i],m.config.out);
  const others=m.config.sides.map((side,index)=>({side,index})).filter(x=>x.index!==i);
  return <div className="reference-board">
    <article className="thrower-card" aria-label={`${s.name}: ${m.scores[i]} очков, текущий игрок`}>
      <div className="thrower-name"><span className="reference-avatar">{i+1}</span><div><h2>{s.name}</h2>{m.config.teams&&<p>{currentPlayer(m,i)}</p>}</div></div>
      <div className="thrower-score-row"><strong className="thrower-score" data-testid={`score-${i}`}>{m.scores[i]}</strong><span className="reference-legs" aria-label={`${m.wins[i]} побед в легах`}>{m.wins[i]}</span></div>
      <dl className="thrower-stats"><div><dt>Средний за 3</dt><dd>{format(st.average)}</dd></div><div><dt>Последний</dt><dd>{last?(last.bust?'Перебор':last.credited):'—'}</dd></div><div><dt>Дротиков в леге</dt><dd>{stats(m,i,undefined,m.leg).darts}</dd></div></dl>
      <div className="reference-checkout">{m.scores[i]===0?<><Flag size={16}/> Лег закрыт</>:route?<><Crosshair size={16}/>{route.map(h=>h.label).join(' · ')}</>:<span>{m.status==='playing'?'Ваш ход':'Лег завершён'}</span>}</div>
    </article>
    <div className={`opponents ${others.length===1?'single-opponent':''}`}>
      {others.map(({side,index})=><article className="opponent" key={index} aria-label={`${side.name}: ${m.scores[index]} очков`}><span className="reference-avatar">{index+1}</span><div className="opponent-name"><h2>{side.name}</h2>{m.config.teams&&<p>{currentPlayer(m,index)}</p>}</div><span className="reference-legs" aria-label={`${m.wins[index]} побед в легах`}>{m.wins[index]}</span><strong className="opponent-score" data-testid={`score-${index}`}>{m.scores[index]}</strong></article>)}
    </div>
  </div>;
}

function MatchDetails({m}:{m:Match}){
  if(m.config.game&&m.config.game!=='x01')return <OtherDetails m={m}/>;
  return <Tabs defaultValue="visits" className="match-details"><TabsList variant="line" className="details-tabs"><TabsTrigger value="visits"><ListOrdered size={16}/> Ходы</TabsTrigger><TabsTrigger value="stats"><BarChart3 size={16}/> Статистика</TabsTrigger></TabsList>
    <TabsContent value="visits"><div className="visit-list">{m.visits.length===0?<div className="empty"><Target size={22}/><p>Первый подход — за вами.</p><span>Здесь появится история бросков.</span></div>:[...m.visits].reverse().map((v,index)=><div className="visit-row" key={m.visits.length-index}><span className="visit-leg">Л{v.leg}</span><span className="visit-player"><i style={{background:colors[v.side]}}/>{v.player}</span><span className={v.bust?'bust-text':'visit-value'}>{v.bust?'Перебор':v.credited}{v.finished&&<Flag size={14}/>}</span><span className="visit-after">{v.after}</span></div>)}</div></TabsContent>
    <TabsContent value="stats"><div className="statistics">{m.config.sides.map((s,i)=>{const st=stats(m,i);return <section key={i} className="stats-side"><h3><i style={{background:colors[i]}}/>{s.name}</h3><dl><div><dt>Средний за 3 дротика</dt><dd>{format(st.average)}</dd></div><div><dt>Лучший подход</dt><dd>{st.best}</dd></div><div><dt>Дротиков за матч</dt><dd>{st.darts}</dd></div><div><dt>Подходов 100+ / 180</dt><dd>{st.hundreds} / {st.maxes}</dd></div><div><dt>Лучшее закрытие</dt><dd>{st.bestOut||'—'}</dd></div></dl>{m.config.teams&&<div className="member-stats">{s.players.map((p,j)=><p key={j}><span>{p}</span><strong>{format(stats(m,i,p).average)}</strong></p>)}</div>}</section>})}</div>{legResults(m).length>0&&<section className="leg-results"><h3>Закрытые леги</h3><div className="leg-results-scroll"><table><thead><tr><th scope="col">Лег</th><th scope="col">Победитель</th><th scope="col">Дротиков</th><th scope="col">Закрытие</th></tr></thead><tbody>{legResults(m).map(result=><tr key={result.leg}><th scope="row">{result.leg}</th><td>{m.config.sides[result.side].name}{m.config.teams&&<small>{result.player}</small>}</td><td><strong>{result.darts}</strong></td><td>{result.checkout}</td></tr>)}</tbody></table></div></section>}<p className="stats-note">Средние рассчитаны за весь матч. Перебор = 0 очков за 3 дротика.</p></TabsContent>
  </Tabs>;
}

export default function Home(){
  const clickDigit=useKeyClick();
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false),[setup,setSetup]=useState(false),[help,setHelp]=useState(false),[newConfirm,setNewConfirm]=useState(false);
  const [entry,setEntry]=useState('');
  const [pressedDigit,setPressedDigit]=useState('');
  useEffect(()=>{if(!pressedDigit)return;const timer=setTimeout(()=>setPressedDigit(''),180);return()=>clearTimeout(timer)},[pressedDigit]);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[storageError,setStorageError]=useState('');
  const [finish,setFinish]=useState<number|null>(null);
  const [details,setDetails]=useState(false),[clubOpen,setClubOpen]=useState(false),[historic,setHistoric]=useState<Match|null>(null);
  const [club,setClub]=useState<Club>(emptyClub),[voiceOn,setVoiceOn]=useState(false),[voiceError,setVoiceError]=useState('');
  const voiceRef=useRef(false);voiceRef.current=voiceOn;
  const {speak,stop:stopVoice}=useCaller(setVoiceError);
  const clubRef=useRef(club);clubRef.current=club;
  const [cloudStatus,setCloudStatus]=useState('Подключаем общую историю…');
  const shared=useRef<SharedClub|null>(null);
  const saveClub=(next:Club)=>{if(shared.current){shared.current.save(next)}else{clubRef.current=next;setClub(next);setStorageError('Общая история ещё не подключена. Повторите после загрузки.')}};
  const toggleVoice=()=>{const next=!voiceOn;setVoiceOn(next);voiceRef.current=next;try{localStorage.setItem('darts13.voice',String(next))}catch{}stopVoice();setVoiceError('');clickDigit()};
  const sessionRef=useRef(session);sessionRef.current=session;
  const m=useMemo(()=>session?replay(session):null,[session]);
  const resetInput=()=>{setEntry('');setError('');setFinish(null)};
  useEffect(()=>{let loaded=emptyClub();try{const raw=localStorage.getItem(CLUB_KEY);if(raw)loaded=parseClub(raw)}catch{setStorageError('Локальную копию не удалось прочитать. Загружаем общую историю.')}const aliases=new Map(loaded.players.map(p=>[p.id,playerId(p.name)]));loaded=historyClub(normalizeClub(loaded));try{const raw=localStorage.getItem(STORAGE);if(raw){let s=JSON.parse(raw) as Session;replay(s);s.id??=createId();s.startedAt??=new Date().toISOString();s=normalizeSession(s,aliases);if(replay(s).status!=='won')s.historyEpoch=HISTORY_EPOCH;loaded=upsertMatch(loaded,s);sessionRef.current=s;setSession(s)}setVoiceOn(localStorage.getItem('darts13.voice')==='true')}catch{setStorageError('Предыдущий матч не удалось восстановить. Можно начать новый.')}clubRef.current=loaded;setClub(loaded);try{shared.current=new SharedClub(loaded,c=>{clubRef.current=c;setClub(c)},setCloudStatus);shared.current.start()}catch{setStorageError('Не удалось открыть очередь сохранения. Скачайте копию истории и сообщите об ошибке.')}setReady(true);return()=>shared.current?.stop()},[]);
  useEffect(()=>{if(!ready||!session)return;saveClub(upsertMatch(clubRef.current,session));try{localStorage.setItem(STORAGE,JSON.stringify(session))}catch{setStorageError('Текущий матч не удалось сохранить на устройстве. Не закрывайте страницу до отправки на сервер.')}},[session,ready]);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(t)},[notice]);
  const commit=(input:VisitInput)=>{
    const s=sessionRef.current;if(!s)throw Error('Сначала начните матч.');
    const next=advance(replay(s),{type:'visit',input});
    const updated:Session={...s,events:[...s.events,{type:'visit',input}]};
    sessionRef.current=updated;setSession(updated);resetInput();
    const v=next.visits.at(-1)!;
    if(voiceRef.current)speak(v.bust?'Перебор':v.credited);
    setNotice(v.bust?'Перебор. Счёт до подхода сохранён.':v.credited===180?'180! Максимальный подход.':'');
    return next;
  };
  const safelyCommit=(input:VisitInput)=>{try{commit(input)}catch(e){setError((e as Error).message)}};
  const startMatch=(config:Config)=>{if(config.game==='cricket'){stopVoice();setVoiceError('')}config={...config,start:config.start===301?301:501,out:'double'};initialMatch(config);const s:Session={version:1,id:createId(),historyEpoch:HISTORY_EPOCH,startedAt:new Date().toISOString(),config,events:[]};if(sessionRef.current)saveClub(upsertMatch(clubRef.current,sessionRef.current));sessionRef.current=s;setSession(s);setSetup(false);resetInput();setNotice('');};
  const undo=()=>{stopVoice();const s=sessionRef.current;if(!s||!s.events.length)return;const events=[...s.events];if(events.at(-1)?.type==='next')events.pop();events.pop();const updated={...s,events};sessionRef.current=updated;setSession(updated);resetInput();setNotice('Последний ход отменён.');};
  const nextLeg=()=>{if(!session)return;const updated:Session={...session,events:[...session.events,{type:'next'}]};replay(updated);sessionRef.current=updated;setSession(updated);resetInput();};
  const append=(v:string)=>{clickDigit();setPressedDigit(v);setError('');setEntry(e=>(e==='0'?v:e+v).slice(0,3));};
  const submitTotal=()=>{
    if(!m||entry==='')return;const score=+entry;
    if(!possibleScore(score)){setError('Такую сумму нельзя набрать за три дротика. Проверьте ввод.');return;}
    if(score===m.scores[m.active]){
      if(!canFinish(score,3,m.config.out)){safelyCommit({score:0,darts:3,bust:true});return;}
      setError('');setFinish(score);return;
    }
    safelyCommit({score,darts:3});
  };
  useEffect(()=>{
    if(!m||(m.config.game&&m.config.game!=='x01')||m.status!=='playing'||setup||help||details||clubOpen||historic||newConfirm||finish!==null)return;
    const key=(e:KeyboardEvent)=>{if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName))return;if(/^\d$/.test(e.key)){e.preventDefault();append(e.key)}else if(e.key==='Backspace'){e.preventDefault();setEntry(v=>v.slice(0,-1))}else if(e.key==='Enter'&&(e.target as HTMLElement)?.tagName!=='BUTTON'){e.preventDefault();submitTotal()}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  });
  useEffect(()=>{
    const ctx=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:unknown)=>unknown}}).modelContext;
    if(!ctx?.registerTool)return;const lifecycle=new AbortController();
    const register=(tool:unknown)=>{try{Promise.resolve(ctx.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}};
    register({name:'read_darts_match',title:'Текущий счёт',description:'Read the current local darts match, scores and active player.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>{const s=sessionRef.current;if(!s)return{started:false};const game=replay(s);return{status:game.status,leg:game.leg,activePlayer:currentPlayer(game),scores:game.config.sides.map((side,i)=>({name:side.name,score:game.scores[i],legs:game.wins[i]}))}}});
    register({name:'record_darts_visit',title:'Записать подход',description:'Record one visit in the current match. Exact finishes require confirmFinish=true and the actual dart count; for double-out this confirms a final double or Bull.',inputSchema:{type:'object',properties:{score:{type:'integer',minimum:0,maximum:180},darts:{type:'integer',minimum:1,maximum:3},bust:{type:'boolean'},confirmFinish:{type:'boolean'}},required:['score','darts'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input:unknown)=>{const v=input as VisitInput&{confirmFinish?:boolean};if(!v||typeof v!=='object'||Object.keys(v).some(k=>!['score','darts','bust','confirmFinish'].includes(k))||(v.bust!==undefined&&typeof v.bust!=='boolean')||(v.confirmFinish!==undefined&&typeof v.confirmFinish!=='boolean'))throw Error('Некорректный подход.');const s=sessionRef.current;if(!s)throw Error('Сначала начните матч.');const game=replay(s);if(game.config.game==='cricket'||game.config.game==='round')throw Error('Введите дротики на игровом экране.');if((!game.config.game||game.config.game==='x01')&&!v.bust&&v.score===game.scores[game.active]&&v.confirmFinish!==true)throw Error('Подтвердите закрытие и число дротиков.');const next=commit({score:v.score,darts:v.darts,bust:v.bust});await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));return{scores:next.scores,status:next.status,activePlayer:currentPlayer(next)}}});
    return()=>lifecycle.abort();
  },[]);

  return <div className={`app-shell ${m&&!setup?`match-screen ${m.config.game&&m.config.game!=='x01'?'other-screen':''}`:''}`}>
    <header className="app-header"><a href="/" className="wordmark" aria-label="13шка дартс — главная"><Target className="brand-target" strokeWidth={2.2} aria-hidden="true"/><span>13шка<small>дартс</small></span></a><span className="header-caption">DARTS SCOREKEEPER</span><div className="header-actions"><button className="text-button help-button" aria-label="Как играть" onClick={()=>setHelp(true)}><HelpCircle size={18}/><span>Как играть</span></button>{m&&!setup&&<button className="secondary compact" onClick={()=>setNewConfirm(true)}><Plus size={18}/><span>Новая игра</span></button>}</div></header>
    <main>
      {ready&&(!m||setup)&&<div className="club-controls"><button className="primary club-button" onClick={()=>setClubOpen(true)}><Users size={20}/> Игроки и история</button><button type="button" role="switch" aria-checked={voiceOn} aria-label="Озвучка результатов броска" className="voice-switch" onClick={toggleVoice}><span className="voice-switch-copy"><strong>Озвучка</strong><span>{voiceOn?'Включена':'Выключена'}</span></span><span className="voice-switch-track" aria-hidden="true"><span className="voice-switch-thumb"/></span></button></div>}
      {voiceError&&<p className="storage-warning" role="status">{voiceError}</p>}
      {storageError&&<p className="storage-warning" role="alert">{storageError}</p>}
      {/^(Нет связи|Этот матч|Матч изменён|Копия)/.test(cloudStatus)&&<p className="storage-warning" role="status">{cloudStatus}</p>}
      {!ready?<div className="loading-state">Готовим мишень…</div>:!m||setup?<Setup players={club.players} previous={m?.config} onStart={startMatch} onCancel={m?()=>setSetup(false):undefined}/>:m.config.game&&m.config.game!=='x01'?<OtherGame key={`${session?.id}-${session?.events.length}`} m={m} onCommit={commit} onUndo={undo} onMenu={()=>setNewConfirm(true)} onDetails={()=>setDetails(true)} onRematch={()=>startMatch(rematchConfig(m.config))}/>:<section className="game">
        <div className="reference-toolbar"><button className="toolbar-button" aria-label="Новая игра" onClick={()=>setNewConfirm(true)}><LogOut/></button><div className="reference-match-title"><h1>ДО {m.config.target} {m.config.target===1?'ПОБЕДЫ':'ПОБЕД'}</h1><p>{m.config.start} · {m.config.out==='double'?'Double out':'Straight out'} · Лег {m.leg}</p></div><div className="toolbar-actions"><button className="toolbar-button" aria-label="Ходы и статистика" onClick={()=>setDetails(true)}><BarChart3/></button><button className="toolbar-button" aria-label="Настройки матча" onClick={()=>setNewConfirm(true)}><Settings/></button></div></div>
        <div className="game-grid"><Scoreboard m={m}/>
          <aside className="entry-panel panel">
            {m.status==='playing'?<>
              <div className="reference-turn" aria-live="polite"><strong>{currentPlayer(m)}</strong><span> — ВАШ БРОСОК!</span></div>
              <div className="input-tabs">
                <div className="reference-total"><div className={`reference-entry ${error?'has-error':''}`}><span className="entry-keyboard-icon"><Grid3X3/></span><output aria-label="Введённые очки" aria-live="polite" className={entry===''?'placeholder':''}>{entry||'Введите счёт'}</output><button className="reference-submit" disabled={entry===''} onClick={submitTotal}>Записать</button></div>
                  <div className="keypad reference-keypad">{[1,2,3,4,5,6,7,8,9].map(v=><button className={pressedDigit===String(v)?'is-pressed':''} key={v} onClick={()=>append(String(v))}>{v}</button>)}<button className="delete-key" aria-label="Удалить цифру" onClick={()=>{setEntry(v=>v.slice(0,-1));setError('')}}><Delete/></button><button className={pressedDigit==='0'?'is-pressed':''} onClick={()=>append('0')}>0</button><button className="key-label undo-key" disabled={!session?.events.length} onClick={undo}><Undo2 size={18}/><span>Отменить ход</span></button></div>

                </div>
              </div>
              {error&&<p className="error-text" role="alert">{error}</p>}

            </>:<div className="win-panel"><div className="trophy-circle"><Trophy size={36} strokeWidth={1.5}/></div><p className="eyebrow">{m.status==='won'?'МАТЧ ЗАВЕРШЁН':'ЛЕГ ЗАКРЫТ'}</p><h2>{m.config.sides[m.winner!].name}</h2><p className="winner-caption">{m.status==='won'?'Победа в матче!':'Ещё один лег в копилку.'}</p><div className="final-score">{m.wins.map((w,i)=><span key={i} style={{color:colors[i]}}>{i>0&&<small>:</small>}{w}</span>)}</div><div className="winning-stats"><div><span>Дротиков в леге</span><strong>{stats(m,m.winner!,undefined,m.leg).darts}</strong></div><div><span>Средний</span><strong>{format(stats(m,m.winner!).average)}</strong></div><div><span>Закрытие</span><strong>{m.visits.at(-1)?.credited}</strong></div></div>{m.status==='leg'?<button className="primary" onClick={nextLeg}>Следующий лег <ArrowRight size={20}/></button>:<><button className="primary" onClick={()=>startMatch(rematchConfig(m.config))}>Реванш <ArrowRight size={20}/></button><button className="secondary" onClick={()=>setSetup(true)}>Новый состав</button></>}<button className="text-button" onClick={undo}><Undo2 size={17}/> Отменить последний ход</button></div>}
          </aside>
        </div>

      </section>}
    </main>
    {(!m||setup)&&<footer className="app-footer"><span>13шка дартс</span><span>Хорошей игры.</span><span>301 / 501</span></footer>}
    {notice&&<div className="toast" role="status"><Check size={18}/>{notice}</div>}
    <Dialog open={clubOpen} onOpenChange={setClubOpen}><DialogContent className="oche-dialog club-dialog"><DialogTitle>Игроки и история</DialogTitle><DialogDescription>Ваш постоянный коллектив и результаты игр.</DialogDescription><ClubPanel club={club} onChange={saveClub} onMatch={setHistoric}/></DialogContent></Dialog>
    <Dialog open={!!historic} onOpenChange={v=>!v&&setHistoric(null)}><DialogContent className="oche-dialog match-stats-dialog"><DialogTitle>История матча</DialogTitle><DialogDescription>{historic?.config.sides.map(s=>s.name).join(' / ')}</DialogDescription>{historic&&<MatchDetails m={historic}/>}</DialogContent></Dialog>
    <Dialog open={details} onOpenChange={setDetails}><DialogContent className="oche-dialog match-stats-dialog"><DialogTitle>Ходы и статистика</DialogTitle><DialogDescription>{m?`${gameTitle(m.config.game)} · ${m.config.game&&m.config.game!=='x01'?'Подход':'Лег'} ${m.leg}`:'Текущий матч'}</DialogDescription>{m&&<MatchDetails m={m}/>}</DialogContent></Dialog>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="oche-dialog"><DialogTitle>Коротко о правилах</DialogTitle><DialogDescription>Одна мишень, один общий экран. Игроки бросают по очереди.</DialogDescription><div className="rules-content"><section><h3>Крикет</h3><p>Закройте 15–20 и центр тремя отметками: одинарное попадание — одна, удвоение — две, утроение — три; 25 — одна, 50 — две. Лишние попадания дают очки, пока хотя бы один соперник не закрыл сектор. Победа — все секторы закрыты, счёт не ниже чужого.</p></section><section><h3>Большой раунд и набор очков</h3><p>Большой раунд: 21 подход по три дротика, секторы 1–20 и центр 25/50. Набор очков: максимум за выбранное число подходов. В обоих режимах побеждает наибольшая сумма; при равном счёте — ничья.</p></section><section><h3>Цель — ровно ноль</h3><p>Каждый подход состоит максимум из трёх дротиков. Набранные очки вычитаются из 301 или 501.</p></section><section><h3>Закрытие через удвоение</h3><p>Последний дротик должен попасть в удвоение D или Bull (50).</p></section><section><h3>Перебор</h3><p>Если ушли ниже нуля, а при Double out также оставили 1 или закрыли без удвоения — весь подход не засчитывается. Следующий ход начинается с прежнего счёта. При вводе суммы неверное закрытие отмечайте в окне подтверждения закрытия.</p></section><section><h3>Командная игра</h3><p>У команды общий счёт. Команды чередуются, а игроки внутри команды бросают по порядку. Очередь игроков продолжается между легами; первая команда каждого лега меняется.</p></section><section><h3>Ввод и отмена</h3><p>Введите сумму очков за подход. Кнопка «Отменить ход» возвращает предыдущий счёт и очередь, в том числе после закрытия. Лег — одна партия от начального счёта до нуля.</p></section><section><h3>Сохранение</h3><p>Игроки и история матчей хранятся на сервере и доступны всем по ссылке. Текущий матч продолжается на устройстве, где его начали; в общую историю отправляются только полностью завершённые матчи. При потере связи изменения ожидают отправки на этом устройстве. Гости сохраняются в истории матча, но не добавляются в постоянный коллектив. Историю можно скачать и восстановить на другом устройстве.</p></section></div></DialogContent></Dialog>
    <Dialog open={finish!==null} onOpenChange={v=>!v&&setFinish(null)}><DialogContent className="oche-dialog finish-dialog"><div className="dialog-icon"><Flag size={26}/></div><DialogTitle>Закрытие на {finish}</DialogTitle><DialogDescription>{m?.config.out==='double'?'Последний дротик попал в удвоение или Bull? Выберите, каким дротиком закрыли.':'Каким дротиком закрыли лег? Это нужно для точного среднего.'}</DialogDescription><div className="finish-buttons">{[1,2,3].map(d=><button key={d} className="secondary" disabled={finish===null||!canFinish(finish,d,m?.config.out??'double')} onClick={()=>finish!==null&&safelyCommit({score:finish,darts:d})}><strong>{d}</strong><span>{d===1?'Первым':d===2?'Вторым':'Третьим'}</span></button>)}</div><button className="text-button" onClick={()=>safelyCommit({score:0,darts:3,bust:true})}>Был перебор — не засчитывать</button></DialogContent></Dialog>
    <AlertDialog open={newConfirm} onOpenChange={setNewConfirm}><AlertDialogContent className="oche-dialog"><AlertDialogTitle>Начать новый матч?</AlertDialogTitle><AlertDialogDescription>В историю попадают только завершённые матчи. Если начать новую игру, недоигранный матч будет заменён. Пока можно изменить настройки и вернуться — новая игра начнётся только после «К мишени».</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel>Продолжить игру</AlertDialogCancel><AlertDialogAction onClick={()=>{setSetup(true);resetInput()}}>Настроить матч</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
