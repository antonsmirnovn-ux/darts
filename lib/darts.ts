export type OutRule = 'double' | 'straight';
export type Side = { name: string; players: string[]; playerIds?: (string|null)[] };
export type GameKind = 'x01' | 'cricket' | 'round' | 'score';
export const gameTitle=(game:GameKind='x01')=>({x01:'501 / 301',cricket:'Крикет',round:'Большой раунд',score:'Набор очков'})[game];
export const CRICKET_TARGETS=[20,19,18,17,16,15,25];
export type Config = { firstSide?: number; game?: GameKind; rounds?: number; start: number; out: OutRule; target: number; teams: boolean; sides: Side[] };
export type Hit = { value: number; label: string; double: boolean };
export type VisitInput = { score: number; darts: number; bust?: boolean; hits?: Hit[] };
export type MatchEvent = { type: 'visit'; input: VisitInput } | { type: 'next' };
export type Session = { version: 1; id?: string; startedAt?: string; historyEpoch?: string; config: Config; events: MatchEvent[] };
export type Visit = VisitInput & { side: number; player: string; leg: number; before: number; after: number; credited: number; finished: boolean };
export type Match = { marks?: number[][]; winners?: number[]; config: Config; scores: number[]; wins: number[]; turns: number[]; active: number; leg: number; starter: number; status: 'playing' | 'leg' | 'won'; winner: number | null; visits: Visit[] };

export const HITS: Hit[] = [
  ...Array.from({length:20},(_,i)=>({value:(20-i)*3,label:`T${20-i}`,double:false})),
  ...[20,16,18,12,10,8,6,4,2,1,19,17,15,14,13,11,9,7,5,3].map(n=>({value:n*2,label:`D${n}`,double:true})),
  {value:50,label:'Bull',double:true},
  ...Array.from({length:20},(_,i)=>({value:20-i,label:String(20-i),double:false})),
  {value:25,label:'25',double:false}, {value:0,label:'Мимо',double:false}
];
const FINALS=HITS.filter(h=>h.double);
const FINAL_PREFERENCE=['D16','D20','D8','D18','D12','D10','D4','Bull','D14','D6','D2','D1'];
const finalRank=(h:Hit)=>{const i=FINAL_PREFERENCE.indexOf(h.label);return i<0?100+i:i};
const preparationRank=(h:Hit)=>{
  if(h.label==='25'||h.double)return 10;
  if(h.label==='T20'||h.label==='T19')return 1;
  if(h.label.startsWith('T'))return 2;
  return 0;
};
type CheckoutPath={hits:Hit[]; final:number; prep:number[]};
const checkoutTables=new Map<OutRule,Map<number,Hit[]|null>>();
function checkoutTable(out:OutRule){
  const existing=checkoutTables.get(out);if(existing)return existing;
  const finals=out==='double'?FINALS:HITS.filter(h=>h.value>0), before=HITS.filter(h=>h.value>0);
  const table=new Map<number,Hit[]|null>();
  const better=(a:CheckoutPath,b:CheckoutPath)=>{
    if(a.hits.length!==b.hits.length)return a.hits.length-b.hits.length;
    const cost=(p:CheckoutPath)=>p.prep.reduce((x,y)=>x+y,0)+finalRank(p.hits.at(-1)!);
    const practical=cost(a)-cost(b);if(practical)return practical;
    for(let i=0;i<a.prep.length;i++)if(a.prep[i]!==b.prep[i])return a.prep[i]-b.prep[i];
    for(let i=0;i<a.hits.length-1;i++)if(a.hits[i].value!==b.hits[i].value)return b.hits[i].value-a.hits[i].value;
    return a.hits.map(h=>h.label).join(',').localeCompare(b.hits.map(h=>h.label).join(','));
  };
  for(let score=1;score<=180;score++){
    let best:CheckoutPath|undefined;
    for(const f of finals){if(f.value===score){const c={hits:[f],final:finalRank(f),prep:[]};if(!best||better(c,best)<0)best=c;}}
    for(const a of before)for(const f of finals)if(a.value+f.value===score){const c={hits:[a,f],final:finalRank(f),prep:[preparationRank(a)]};if(!best||better(c,best)<0)best=c;}
    for(const a of before)for(const b of before)for(const f of finals)if(a.value+b.value+f.value===score){const c={hits:[a,b,f],final:finalRank(f),prep:[preparationRank(a),preparationRank(b)]};if(!best||better(c,best)<0)best=c;}
    table.set(score,best?.hits??null);
  }
  checkoutTables.set(out,table);return table;
}
const totals: Set<number>[]=[new Set([0])];
for(let d=1;d<=3;d++) totals[d]=new Set([...totals[d-1]].flatMap(v=>HITS.map(h=>v+h.value)));
export function possibleScore(score:number,darts=3){return Number.isInteger(score)&&darts>=0&&darts<=3&&totals[darts].has(score)}
export function canFinish(score:number,darts:number,out:OutRule){
  if(score<=0||!Number.isInteger(darts)||darts<1||darts>3) return false;
  return (out==='double'?FINALS:HITS.filter(h=>h.value>0)).some(h=>totals[darts-1].has(score-h.value));
}
export function checkout(score:number,out:OutRule,maxDarts=3):Hit[]|null{
  if(!Number.isInteger(score)||score<1||score>180||maxDarts<1)return null;
  const path=checkoutTable(out).get(score)??null;
  return path&&path.length<=maxDarts?path:null;
}
export function evaluateHits(before:number,hits:Hit[],out:OutRule){
  let left=before;let used=0;
  for(const h of hits){
    used++;left-=h.value;
    if(left<0 || (out==='double'&&(left===1||(left===0&&!h.double))))return{score:before-left,darts:3,bust:true,finish:false,used};
    if(left===0)return{score:before,darts:used,bust:false,finish:true,used};
  }
  return{score:before-left,darts:used,bust:false,finish:false,used};
}
export function rematchConfig(config:Config):Config{
  return {...config,firstSide:((config.firstSide??0)+1)%config.sides.length};
}
export function initialMatch(config:Config):Match{
  const firstSide=config.firstSide??0;
  if(!Number.isInteger(firstSide)||firstSide<0||firstSide>=config.sides.length)throw Error('Некорректная сторона первого броска.');
  const kind=config.game??'x01';
  if(!['x01','cricket','round','score'].includes(kind))throw Error('Неизвестная игра.');
  if(kind==='score'&&(!Number.isInteger(config.rounds??10)||(config.rounds??10)<1||(config.rounds??10)>100))throw Error('Выберите от 1 до 100 подходов.');
  if(![301,501,701].includes(config.start)||!['double','straight'].includes(config.out)||![1,2,3,5].includes(config.target)||config.sides.length<2||config.sides.length>4||typeof config.teams!=='boolean')throw Error('Некорректные настройки игры.');
  if(config.teams&&config.sides.length!==2)throw Error('Выберите две команды.');
  for(const side of config.sides)if(typeof side.name!=='string'||!side.name.trim()||!Array.isArray(side.players)||side.players.length<1||side.players.length>4||side.players.some(p=>typeof p!=='string'||!p.trim()||p.length>32))throw Error('Укажите имена игроков.');
  return{config,marks:kind==='cricket'?config.sides.map(()=>CRICKET_TARGETS.map(()=>0)):undefined,scores:config.sides.map(()=>kind==='x01'?config.start:0),wins:config.sides.map(()=>0),turns:config.sides.map(()=>0),active:firstSide,leg:1,starter:firstSide,status:'playing',winner:null,visits:[]};
}
export function currentPlayer(m:Match,side=m.active){const s=m.config.sides[side];return s.players[m.turns[side]%s.players.length]}
export function advance(m:Match,event:MatchEvent):Match{
  if(m.config.game&&m.config.game!=='x01')return advanceOther(m,event);
  if(event.type==='next'){
    if(m.status!=='leg')throw Error('Сначала завершите лег.');
    const starter=((m.config.firstSide??0)+m.leg)%m.config.sides.length;
    return{...m,scores:m.scores.map(()=>m.config.start),active:starter,starter,leg:m.leg+1,status:'playing',winner:null};
  }
  if(event.type!=='visit'||m.status!=='playing')throw Error('Этот лег уже завершён.');
  const v=event.input,before=m.scores[m.active];
  if(!Number.isInteger(v.score)||v.score<0||v.score>180||!Number.isInteger(v.darts)||v.darts<1||v.darts>3)throw Error('Введите от 0 до 180 очков.');
  let bust=Boolean(v.bust);let darts=v.darts;let score=v.score;
  if(v.hits){
    if(!Array.isArray(v.hits)||v.hits.length<1||v.hits.length>3||v.hits.some(h=>!HITS.some(x=>x.value===h.value&&x.label===h.label&&x.double===h.double)))throw Error('Некорректные броски.');
    const result=evaluateHits(before,v.hits,m.config.out);
    if(result.used!==v.hits.length)throw Error('После закрытия или перебора ход окончен.');
    if(!result.finish&&!result.bust&&v.hits.length!==3)throw Error('Введите все три броска.');
    bust=result.bust;darts=result.bust?3:result.darts;score=result.score;
  }else if(!bust){
    if(!possibleScore(score,darts))throw Error('Такую сумму нельзя набрать указанным числом дротиков.');
    bust=score>before||(m.config.out==='double'&&before-score===1);
    if(!bust&&score===before&&!canFinish(before,darts,m.config.out))throw Error('Такое закрытие невозможно. Проверьте сумму или отметьте перебор.');
    if(!bust&&score!==before&&darts!==3)throw Error('Обычный подход учитывается за три дротика.');
  }
  if(bust)darts=3;
  const credited=bust?0:score,after=before-credited,finished=after===0;
  const visit:Visit={...v,score,darts,bust,side:m.active,player:currentPlayer(m),leg:m.leg,before,after,credited,finished};
  const scores=[...m.scores],wins=[...m.wins],turns=[...m.turns];
  scores[m.active]=after;turns[m.active]++;
  if(finished)wins[m.active]++;
  return{...m,scores,wins,turns,status:finished?(wins[m.active]>=m.config.target?'won':'leg'):'playing',winner:finished?m.active:null,active:finished?m.active:(m.active+1)%scores.length,visits:[...m.visits,visit]};
}
export function replay(session:Session){
  if(session.version!==1||!Array.isArray(session.events)||session.events.length>10000)throw Error('Не удалось прочитать матч.');
  return session.events.reduce(advance,initialMatch(session.config));
}
export function legResults(m:Match){
  if(m.config.game&&m.config.game!=='x01')return [];
  return m.visits.filter(v=>v.finished).map(finish=>({leg:finish.leg,side:finish.side,player:finish.player,checkout:finish.credited,darts:m.visits.filter(v=>v.side===finish.side&&v.leg===finish.leg).reduce((sum,v)=>sum+v.darts,0)}));
}

export function stats(m:Match,side:number,player?:string,leg?:number){
  const v=m.visits.filter(v=>v.side===side&&(!player||v.player===player)&&(leg===undefined||v.leg===leg));
  const darts=v.reduce((s,v)=>s+v.darts,0),points=v.reduce((s,v)=>s+v.credited,0);
  return{average:darts?points/darts*3:0,darts,best:Math.max(0,...v.map(v=>v.credited)),hundreds:v.filter(v=>v.credited>=100).length,maxes:v.filter(v=>v.credited===180).length,checkouts:v.filter(v=>v.finished).length,bestOut:Math.max(0,...v.filter(v=>v.finished).map(v=>v.credited))};
}


export function cricketHit(hit:Hit){
  if(hit.value===0)return null;
  if(hit.label==='Bull')return {target:25,marks:2};
  if(hit.label==='25')return {target:25,marks:1};
  const marks=hit.label.startsWith('T')?3:hit.label.startsWith('D')?2:1;
  const target=hit.value/marks;
  return CRICKET_TARGETS.includes(target)&&target!==25?{target,marks}:null;
}
export function winnerText(m:Match){
  const winners=m.winners??(m.winner===null?[]:[m.winner]);
  return (winners.length>1?'Ничья: ':'Победа: ')+winners.map(i=>m.config.sides[i].name).join(' / ');
}
function advanceOther(m:Match,event:MatchEvent):Match{
  if(event.type!=='visit'||m.status!=='playing')throw Error('Игра уже завершена.');
  const v=event.input,kind=m.config.game!,side=m.active,round=m.turns[side]+1;
  if(v.bust||!Number.isInteger(v.score)||v.score<0||v.score>180||!Number.isInteger(v.darts)||v.darts<1||v.darts>3)throw Error('Некорректный подход.');
  if(v.hits&&(!Array.isArray(v.hits)||v.hits.length!==v.darts||v.hits.some(h=>!HITS.some(x=>x.value===h.value&&x.label===h.label&&x.double===h.double))))throw Error('Некорректные дротики.');
  const scores=[...m.scores],turns=[...m.turns],marks=m.marks?.map(row=>[...row]);
  let credited=0,winners:number[]=[];
  if(kind==='cricket'){
    if(!v.hits||!marks)throw Error('Укажите попадания каждого дротика.');
    for(let i=0;i<v.hits.length;i++){
      const hit=cricketHit(v.hits[i]);
      if(v.hits[i].value&&!hit)throw Error('В крикете учитываются 15–20 и центр.');
      if(hit){const index=CRICKET_TARGETS.indexOf(hit.target),before=marks[side][index];
        const extra=Math.max(0,before+hit.marks-3);
        marks[side][index]=Math.min(3,before+hit.marks);
        if(marks.some((row,j)=>j!==side&&row[index]<3)){scores[side]+=extra*hit.target;credited+=extra*hit.target;}
      }
      if(marks[side].every(n=>n===3)&&scores.every(n=>scores[side]>=n)){
        winners=[side];if(i!==v.hits.length-1)throw Error('После победного дротика подход окончен.');
      }
    }
  }else{
    if(v.darts!==3)throw Error('В подходе три дротика.');
    if(kind==='round'){
      const values=round===21?[0,25,50]:[0,round,round*2,round*3];
      const valid=new Set(values.flatMap(a=>values.flatMap(b=>values.map(c=>a+b+c))));
      if(round>21||!valid.has(v.score)||v.hits?.some(h=>!values.includes(h.value)||(h.value!==0&&!(round===21?['25','Bull']:[String(round),`D${round}`,`T${round}`]).includes(h.label)))||v.hits&&v.hits.reduce((n,h)=>n+h.value,0)!==v.score)throw Error('Считайте только попадания в текущий сектор.');
    }else if(!possibleScore(v.score)||v.hits&&v.hits.reduce((n,h)=>n+h.value,0)!==v.score)throw Error('Такую сумму нельзя набрать за три дротика.');
    credited=v.score;scores[side]+=credited;
  }
  turns[side]++;
  const limit=kind==='round'?21:m.config.rounds??10;
  if(kind!=='cricket'&&turns.every(n=>n>=limit)){
    const best=Math.max(...scores);winners=scores.flatMap((score,i)=>score===best?[i]:[]);
  }
  const finished=winners.length>0;
  const visit:Visit={...v,score:credited,side,player:currentPlayer(m),leg:round,before:m.scores[side],after:scores[side],credited,finished};
  return {...m,marks,scores,turns,winners,winner:finished?winners[0]:null,wins:scores.map((_,i)=>finished&&winners.length===1&&winners[0]===i?1:0),status:finished?'won':'playing',active:finished?side:(side+1)%scores.length,leg:kind==='cricket'?Math.min(...turns)+1:Math.min(limit,Math.min(...turns)+1),visits:[...m.visits,visit]};
}
