import { HISTORY_EPOCH, isArchivedMatch } from './club.ts';
import type { Session } from './darts.ts';
/** Owner-requested reset, with fixed generation to reject old offline uploads.
 * Deletes game records only; permanent players are preserved. */
export async function clearLegacyHistory(db:D1Database){
 await db.prepare("DELETE FROM club_matches WHERE COALESCE(json_extract(body, '$.historyEpoch'), '') <> ?").bind(HISTORY_EPOCH).run();
}
export async function storeHistory(db:D1Database,entry:{session:Session;token:string;revision:number;remove?:boolean}){
 const {session,token,revision}=entry;
 if(session.historyEpoch!==HISTORY_EPOCH)return {ok:true,discarded:true};
 const remove=entry.remove===true||!isArchivedMatch(session);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),v=>v.toString(16).padStart(2,'0')).join('');
 const body=JSON.stringify(session);
 const claim=db.prepare('INSERT INTO club_match_claims(id,token_hash,revision,removed) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,removed=excluded.removed WHERE club_match_claims.token_hash=excluded.token_hash AND club_match_claims.revision<excluded.revision').bind(session.id,hash,revision,remove?1:0);
 const mutate=remove?
  db.prepare('DELETE FROM club_matches WHERE id=? AND EXISTS(SELECT 1 FROM club_match_claims WHERE id=? AND token_hash=? AND revision=? AND removed=1)').bind(session.id,session.id,hash,revision):
  db.prepare('INSERT INTO club_matches(id,started_at,body,token_hash,revision) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM club_match_claims WHERE id=? AND token_hash=? AND revision=? AND removed=0) ON CONFLICT(id) DO UPDATE SET body=excluded.body,revision=excluded.revision WHERE club_matches.token_hash=excluded.token_hash AND club_matches.revision<excluded.revision').bind(session.id,session.startedAt,body,hash,revision,session.id,hash,revision);
 await db.batch([claim,mutate]);
 const saved=await db.prepare('SELECT token_hash,revision,removed FROM club_match_claims WHERE id=?').bind(session.id).first<{token_hash:string;revision:number;removed:number}>();
 if(!saved)throw Error('Match receipt not persisted');
 if(saved.token_hash!==hash)return {error:'Этот матч записан с другого устройства. Его общая история не изменена.',conflict:true};
 if(saved.revision===revision){
  if(saved.removed!==(remove?1:0))return {error:'Матч изменён в другой вкладке. Обновите страницу.',conflict:true};
  if(!remove){const row=await db.prepare('SELECT body FROM club_matches WHERE id=?').bind(session.id).first<{body:string}>();if(row?.body!==body)return {error:'Матч изменён в другой вкладке. Обновите страницу.',conflict:true}}
 }
 return {ok:true};
}
