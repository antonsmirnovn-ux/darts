import { replay, legResults, type Match, type Session, type GameKind } from './darts.ts';
export type Player={id:string;name:string};
export type Club={version:1;players:Player[];matches:Session[]};
export const createId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
export const CLUB_KEY='darts13.club.v1';
// Owner-requested reset: old offline copies cannot restore erased test games.
export const HISTORY_EPOCH='2026-10-03-clean-history';
export const isArchivedMatch=(s:Session)=>s.historyEpoch===HISTORY_EPOCH&&replay(s).status==='won';
export const historyClub=(c:Club):Club=>({...c,matches:c.matches.filter(isArchivedMatch)});
export const emptyClub=():Club=>({version:1,players:[],matches:[]});
export const keyName=(s:string)=>s.trim().normalize('NFC').toLocaleLowerCase('ru-RU');
export function upsertMatch(club:Club,s:Session):Club{return {...club,matches:[...club.matches.filter(m=>m.id!==s.id&&isArchivedMatch(m)),...(isArchivedMatch(s)?[s]:[])]}}
export function parseClub(raw:string):Club{
 const c=JSON.parse(raw);if(c?.version!==1||!Array.isArray(c.players)||!Array.isArray(c.matches))throw Error('Это не файл истории «13шка дартс».');
 const ids=new Set(),names=new Set();for(const p of c.players){if(typeof p.id!=='string'||!p.id||typeof p.name!=='string'||!p.name.trim()||p.name.length>32||ids.has(p.id)||names.has(keyName(p.name)))throw Error('Некорректный список игроков.');ids.add(p.id);names.add(keyName(p.name))}
 const matches=new Set();for(const s of c.matches){replay(s);if(typeof s.id!=='string'||!s.id||matches.has(s.id)||!Number.isFinite(Date.parse(s.startedAt)))throw Error('Некорректная история матчей.');matches.add(s.id);for(const side of s.config.sides){if(side.playerIds&&(!Array.isArray(side.playerIds)||side.playerIds.length!==side.players.length||side.playerIds.some((id:unknown)=>id!==null&&!ids.has(id))))throw Error('Не найден профиль игрока.')}}return c;
}
export function playerSummary(club:Club,id:string,game?:GameKind){
 let played=0,wins=0,darts=0,points=0,best=0,maxes=0,hundreds=0,bestOut=0;
 const matches=club.matches.filter(s=>isArchivedMatch(s)&&(!game||(s.config.game??'x01')===game)&&s.config.sides.some(side=>side.playerIds?.includes(id)));
 for(const s of matches){const m=replay(s),i=s.config.sides.findIndex(side=>side.playerIds?.includes(id)),side=s.config.sides[i],name=side.players[side.playerIds!.indexOf(id)];if(m.status==='won'){played++;if(m.winner===i&&(!m.winners||m.winners.length===1))wins++}for(const v of m.visits.filter(v=>v.side===i&&v.player===name)){darts+=v.darts;points+=v.credited;best=Math.max(best,v.credited);if(v.credited===180)maxes++;if(v.credited>100)hundreds++;if(v.finished&&(!m.config.game||m.config.game==='x01'))bestOut=Math.max(bestOut,v.credited)}}
 return {matches,played,wins,darts,best,maxes,hundreds,bestOut,average:darts?points/darts*3:0};
}
export function playerMatchSummary(m:Match,id:string){
 const side=m.config.sides.findIndex(s=>s.playerIds?.includes(id));
 if(side<0)return {best:0,legs:[]};
 const team=m.config.sides[side],name=team.players[team.playerIds!.indexOf(id)];
 const visits=m.visits.filter(v=>v.side===side&&v.player===name);
 return {best:Math.max(0,...visits.map(v=>v.credited)),legs:legResults(m).filter(l=>l.side===side&&l.player===name)};
}
export function spokenScore(n:number):string{const units=['ноль','один','два','три','четыре','пять','шесть','семь','восемь','девять','десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];const tens=['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];if(n===100)return 'сто';if(n>100)return 'сто '+spokenScore(n-100);if(n<20)return units[n];return tens[Math.floor(n/10)]+(n%10?' '+units[n%10]:'');}

export const playerId=(name:string)=>'p_'+Array.from(new TextEncoder().encode(keyName(name)),v=>v.toString(16).padStart(2,'0')).join('');
export function normalizeClub(club:Club):Club{
 const ids=new Map(club.players.map(p=>[p.id,playerId(p.name)]));
 const players=Array.from(new Map(club.players.map(p=>[playerId(p.name),{id:playerId(p.name),name:p.name.trim()}])).values());
 return {...club,players,matches:club.matches.map(s=>normalizeSession(s,ids))};
}
export function normalizeSession(s:Session,ids:Map<string,string>):Session{return {...s,config:{...s.config,sides:s.config.sides.map(side=>({...side,playerIds:side.playerIds?.map(id=>id?ids.get(id)??id:null)}))}}}
