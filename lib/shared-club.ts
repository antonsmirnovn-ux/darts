import { CLUB_KEY, HISTORY_EPOCH, createId, normalizeClub, parseClub, historyClub, isArchivedMatch, type Club } from './club.ts';
import type { Session } from './darts.ts';
const QUEUE_KEY='darts13.shared.queue.v1';
type Pending={session:Session;token:string;revision:number;remove?:boolean};
type Queue={initialized:boolean;playersDirty:boolean;pending:Record<string,Pending>;tokens:Record<string,string>;revisions:Record<string,number>};
export class SharedClub {
 private club:Club;private queue:Queue;private busy=false;private stopped=false;private timer:ReturnType<typeof setInterval>|undefined;
 private onClub:(club:Club)=>void;private onStatus:(text:string)=>void;
 constructor(local:Club,onClub:(club:Club)=>void,onStatus:(text:string)=>void){
  this.onClub=onClub;this.onStatus=onStatus;this.club=historyClub(normalizeClub(local));
  this.queue={initialized:false,playersDirty:false,pending:{},tokens:{},revisions:{}};
  try{const raw=localStorage.getItem(QUEUE_KEY);if(raw){const q=JSON.parse(raw);if(q&&q.pending&&q.tokens&&q.revisions)this.queue=q}}catch{}
  // Discard wiped games and old unfinished uploads, keeping the roster.
  this.queue.pending=Object.fromEntries(Object.entries(this.queue.pending).filter(([,p])=>p.session?.historyEpoch===HISTORY_EPOCH&&(p.remove||isArchivedMatch(p.session))));
 }
 private emit(){if(!this.stopped)this.onClub(this.club)}
 private status(s:string){if(!this.stopped)this.onStatus(s)}
 private persist(){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(this.queue));localStorage.setItem(CLUB_KEY,JSON.stringify(this.club))}catch{this.status('Копия на устройстве не сохраняется. Не закрывайте страницу до отправки на сервер.')}}
 private enqueue(s:Session,remove=false){if(!s.id)return;const id=s.id;this.queue.tokens[id]??=createId()+createId();const revision=(this.queue.revisions[id]??0)+1;this.queue.revisions[id]=revision;this.queue.pending[id]={session:s,token:this.queue.tokens[id],revision,remove}}
 start(){if(!this.queue.initialized){this.queue.playersDirty=!!this.club.players.length;for(const s of this.club.matches)this.enqueue(s);this.queue.initialized=true}this.persist();this.emit();void this.sync();this.timer=setInterval(()=>void this.sync(),30000);window.addEventListener('online',this.refresh);window.addEventListener('focus',this.refresh)}
 private refresh=()=>{void this.sync()};
 stop(){this.stopped=true;if(this.timer)clearInterval(this.timer);window.removeEventListener('online',this.refresh);window.removeEventListener('focus',this.refresh)}
 save(next:Club){
  next=historyClub(normalizeClub(next));
  if(JSON.stringify(next.players)!==JSON.stringify(this.club.players))this.queue.playersDirty=true;
  const previous=new Map(this.club.matches.map(s=>[s.id,JSON.stringify(s)]));const remaining=new Set(next.matches.map(s=>s.id));
  for(const s of this.club.matches)if(s.id&&!remaining.has(s.id)&&this.queue.tokens[s.id])this.enqueue(s,true);
  for(const s of next.matches)if(previous.get(s.id)!==JSON.stringify(s))this.enqueue(s);
  this.club=next;this.persist();this.emit();void this.sync();
 }
 async sync(){if(this.busy||this.stopped)return;this.busy=true;this.status('Синхронизация…');try{
  while(this.queue.playersDirty||Object.keys(this.queue.pending).length){
   const next=Object.values(this.queue.pending)[0];const players=this.club.players;
   const r=await fetch('/api/club',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({players,match:next}),signal:AbortSignal.timeout(20000)});
   if(!r.ok){const problem=await r.json() as {error?:string};throw Error(problem.error||'Ошибка сохранения')}
   if(next&&this.queue.pending[next.session.id!]?.revision===next.revision)delete this.queue.pending[next.session.id!];
   if(JSON.stringify(players)===JSON.stringify(this.club.players))this.queue.playersDirty=false;this.persist();
  }
  const r=await fetch('/api/club',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Общая история временно недоступна.');const remote=historyClub(parseClub(await r.text()));
  const players=Array.from(new Map([...remote.players,...(this.queue.playersDirty?this.club.players:[])].map(p=>[p.id,p])).values());const matches=new Map(remote.matches.map(s=>[s.id,s]));
  for(const item of Object.values(this.queue.pending)){if(item.remove)matches.delete(item.session.id);else matches.set(item.session.id,item.session)}
  this.club={version:1,players,matches:[...matches.values()].sort((a,b)=>(a.startedAt??'').localeCompare(b.startedAt??''))};this.persist();this.emit();this.status(Object.keys(this.queue.pending).length||this.queue.playersDirty?'Есть изменения для отправки':'Игроки и история сохранены на сервере');
 }catch(e){this.status(`${(e as Error).message.includes('друг')?(e as Error).message:'Нет связи с общей историей. Изменения сохранены на устройстве.'} Отправка повторится автоматически при подключении.`)}finally{this.busy=false}}
}
