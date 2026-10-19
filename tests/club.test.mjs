import {replay} from '../lib/darts.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyClub,upsertMatch,parseClub,playerSummary,playerMatchSummary,spokenScore,HISTORY_EPOCH} from '../lib/club.ts';
const session={historyEpoch:HISTORY_EPOCH,id:'match1',startedAt:'2026-09-24T12:00:00Z',version:1,config:{start:301,out:'straight',target:1,teams:true,sides:[{name:'A',players:['Антон','Гость'],playerIds:['anton',null]},{name:'B',players:['Борис','Гость 2'],playerIds:['boris',null]}]},events:[{type:'visit',input:{score:180,darts:3}},{type:'visit',input:{score:60,darts:3}},{type:'visit',input:{score:121,darts:3}}]};
const club={...emptyClub(),players:[{id:'anton',name:'Антон'},{id:'boris',name:'Борис'}]};
test('archive round trip, team member stats and guest separation',()=>{const c=parseClub(JSON.stringify(upsertMatch(club,session)));const a=playerSummary(c,'anton');assert.equal(a.wins,1);assert.equal(a.played,1);assert.equal(a.average,180);assert.equal(a.maxes,1);assert.equal(a.darts,3);assert.equal(c.players.length,2);assert.equal(c.matches[0].events.length,3)});
test('undo updates existing archive without duplicating match or keeping win',()=>{let c=upsertMatch(club,session);c=upsertMatch(c,{...session,events:session.events.slice(0,-1)});assert.equal(c.matches.length,0);assert.equal(playerSummary(c,'anton').wins,0);assert.equal(playerSummary(c,'anton').played,0);c=upsertMatch(c,{...session,id:'match2'});assert.equal(c.matches.length,1)});
test('malformed backup rejected',()=>{assert.throws(()=>parseClub('{}'));assert.throws(()=>parseClub(JSON.stringify({...club,matches:[{...session,id:undefined}]})));assert.throws(()=>parseClub(JSON.stringify({...club,players:[],matches:[session]})))});
test('Russian spoken numbers',()=>{assert.equal(spokenScore(0),'ноль');assert.equal(spokenScore(56),'пятьдесят шесть');assert.equal(spokenScore(100),'сто');assert.equal(spokenScore(101),'сто один');assert.equal(spokenScore(180),'сто восемьдесят')});

test('personal history counts above 100, checkout and darts for each leg',()=>{
 const visit=(score,darts=3)=>({type:'visit',input:{score,darts}});
 const s={...session,id:'personal',config:{...session.config,teams:false,out:'double',target:2,sides:[{name:'Антон',players:['Антон'],playerIds:['anton']},{name:'Борис',players:['Борис'],playerIds:['boris']}]},events:[visit(100),visit(0),visit(94),visit(0),visit(107,2),{type:'next'},visit(0),visit(140),visit(0),visit(121),visit(0),visit(40)]};
 const c=upsertMatch(club,s),summary=playerSummary(c,'anton','x01');
 assert.equal(summary.bestOut,107);assert.equal(summary.hundreds,3);assert.equal(summary.best,140);
 const personal=playerMatchSummary(replay(s),'anton');
 assert.deepEqual(personal.legs.map(l=>({leg:l.leg,darts:l.darts,checkout:l.checkout})),[{leg:1,darts:8,checkout:107},{leg:2,darts:9,checkout:40}]);
 assert.equal(playerMatchSummary(replay(s),'boris').legs.length,0);
 assert.equal(playerSummary(c,'anton','cricket').played,0);
});
test('teammate checkout is not attributed to selected player',()=>{
 const c=upsertMatch(club,session);
 assert.equal(playerSummary(c,'anton').bestOut,0);
 assert.equal(playerSummary(c,'anton').hundreds,1);
 assert.equal(playerMatchSummary(replay(session),'anton').legs.length,0);
});
