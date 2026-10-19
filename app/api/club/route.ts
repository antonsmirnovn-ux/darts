import { getD1 } from '@/db';
import { clearLegacyHistory, storeHistory } from '@/lib/history-store';
import { historyClub } from '@/lib/club';
import { parseClub, playerId, type Club } from '@/lib/club';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function readClub():Promise<Club>{const db=getD1();await clearLegacyHistory(db);const [p,m]=await Promise.all([db.prepare('SELECT id,name FROM club_players ORDER BY name').all<{id:string;name:string}>(),db.prepare('SELECT body FROM club_matches ORDER BY started_at,id').all<{body:string}>()]);return historyClub({version:1,players:p.results,matches:m.results.map(r=>JSON.parse(r.body))});}
export async function GET(){try{return json(await readClub())}catch(e){console.error('club read',e);return json({error:'Общая история временно недоступна. Попробуйте ещё раз.'},503)}}
export async function POST(req:Request){
 try{
  const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'Недопустимый источник запроса.'},403);
  const raw=await req.text();if(raw.length>1500000)return json({error:'Слишком много данных в одном запросе.'},413);
  let data;try{data=JSON.parse(raw)}catch{return json({error:'Некорректные данные.'},400)}
  let club:Club;try{club=parseClub(JSON.stringify({version:1,players:data.players,matches:data.match?[data.match.session]:[]}));if(club.players.length>2000||club.players.some(p=>p.id!==playerId(p.name)))throw Error();if(data.match&&(data.match.remove!==undefined&&typeof data.match.remove!=='boolean'))throw Error();if(data.match&&(!/^[a-f0-9]{64}$/.test(data.match.token)||!Number.isSafeInteger(data.match.revision)||data.match.revision<1||!/^[-a-zA-Z0-9_]{1,128}$/.test(data.match.session.id)))throw Error()}catch{return json({error:'Не удалось проверить игроков или матч.'},400)}
  const db=getD1();await clearLegacyHistory(db);
  if(club.players.length)await db.batch(club.players.map(p=>db.prepare('INSERT INTO club_players(id,name) VALUES(?,?) ON CONFLICT(id) DO NOTHING').bind(p.id,p.name)));
  if(data.match){const result=await storeHistory(db,data.match);if('error' in result)return json(result,409)}
  return json({ok:true});
 }catch(e){console.error('club save',e);return json({error:'Не удалось сохранить на сервере. Изменения остаются на устройстве.'},503)}
}
