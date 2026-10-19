import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialMatch,advance,replay,HITS,currentPlayer} from '../lib/darts.ts';
import {parseClub,playerSummary,HISTORY_EPOCH} from '../lib/club.ts';
const cfg=(game,n=2,teams=false)=>({game,start:501,out:'double',target:1,rounds:10,teams,sides:Array.from({length:n},(_,i)=>({name:`P${i}`,players:teams?[`P${i}a`,`P${i}b`]:[`P${i}`],playerIds:teams?[null,null]:['p'+i]}))});
const hit=label=>HITS.find(h=>h.label===label);
const visit=(m,score)=>advance(m,{type:'visit',input:{score,darts:3}});
const shots=(m,labels)=>{const hits=labels.map(hit);return advance(m,{type:'visit',input:{score:hits.reduce((n,h)=>n+h.value,0),darts:hits.length,hits}})};
test('big round completes exactly 21 approaches per player, including 25/50',()=>{
 let m=initialMatch(cfg('round',4));
 for(let r=1;r<=20;r++)for(let p=0;p<4;p++){assert.equal(m.turns[m.active]+1,r);m=visit(m,r*6);assert.equal(m.status,'playing')}
 for(let p=0;p<4;p++){m=shots(m,['25','Bull','Мимо']);assert.equal(m.status,p===3?'won':'playing')}
 assert.deepEqual(m.scores,[1335,1335,1335,1335]);assert.deepEqual(m.winners,[0,1,2,3]);assert.deepEqual(m.turns,[21,21,21,21]);assert.equal(m.visits.length,84);assert.throws(()=>visit(m,0));
});
test('big round rejects impossible sector totals and scores only current sector',()=>{let m=initialMatch(cfg('round'));assert.throws(()=>visit(m,10));m=visit(m,0);m=visit(m,0);assert.equal(m.leg,2);assert.throws(()=>shots(m,['D1','Мимо','Мимо']));assert.throws(()=>visit(m,3));assert.equal(visit(m,18).scores[0],18)});
test('score race gives all sides equal turns and supports unique winner / ties',()=>{for(const tie of [false,true]){let m=initialMatch({...cfg('score',3),rounds:1});m=visit(m,180);assert.equal(m.status,'playing');m=visit(m,tie?180:60);m=visit(m,0);assert.equal(m.status,'won');assert.deepEqual(m.winners,tie?[0,1]:[0]);assert.deepEqual(m.wins,tie?[0,0,0]:[1,0,0])}assert.throws(()=>visit(initialMatch(cfg('score')),179))});
test('cricket closes with three marks, scores overflow only against open opponents',()=>{let m=initialMatch(cfg('cricket',3));m=shots(m,['T20','20','D20']);assert.equal(m.scores[0],60);assert.equal(m.marks[0][0],3);m=shots(m,['T20','Мимо','Мимо']);m=shots(m,['20','Мимо','Мимо']);m=shots(m,['T20','Мимо','Мимо']);assert.equal(m.scores[0],120);m=shots(m,['Мимо','Мимо','Мимо']);m=shots(m,['D20','Мимо','Мимо']);m=shots(m,['T20','Мимо','Мимо']);assert.equal(m.scores[0],120)});
test('cricket needs every target and a non-losing score, can end before third dart',()=>{let m=initialMatch(cfg('cricket'));m={...m,marks:[[3,3,3,3,3,3,1],[3,3,3,3,3,3,0]],scores:[0,25]};assert.equal(shots(m,['Bull']).status,'playing');m=shots(m,['Bull','Bull']);assert.equal(m.status,'won');assert.equal(m.scores[0],50);assert.equal(m.visits[0].darts,2);assert.throws(()=>shots({...m,status:'playing',marks:[[3,3,3,3,3,3,1],[0,0,0,0,0,0,0]]},['Bull','25']));});
test('cricket accepts one or two darts and rejects targets outside 15–20 / bull',()=>{let m=initialMatch(cfg('cricket'));const single=shots(m,['T20']);assert.equal(single.active,1);assert.equal(single.marks[0][0],3);assert.equal(single.visits[0].darts,1);const two=shots(m,['20','20']);assert.equal(two.marks[0][0],2);assert.equal(two.visits[0].darts,2);assert.equal(shots(m,['D20']).marks[0][0],2);assert.throws(()=>shots(m,[]));assert.throws(()=>shots(m,['14','Мимо','Мимо']));m=shots(m,['25','Bull','Bull']);assert.equal(m.marks[0][6],3);assert.equal(m.scores[0],50)});
test('teams rotate inside each side in new disciplines',()=>{let m=initialMatch(cfg('round',2,true));assert.equal(currentPlayer(m),'P0a');m=visit(m,3);m=visit(m,3);assert.equal(currentPlayer(m),'P0b');assert.equal(m.turns[m.active]+1,2)});
test('all games serialize, validate as shared history, and undo by replay; ties are not wins',()=>{for(const game of ['round','score','cricket']){const config=cfg(game);const input=game==='cricket'?{score:60,darts:3,hits:['T20','Мимо','Мимо'].map(hit)}:{score:3,darts:3};const session={historyEpoch:HISTORY_EPOCH,version:1,id:game,startedAt:'2026-10-02T00:00:00Z',config,events:[{type:'visit',input}]};const club=parseClub(JSON.stringify({version:1,players:[{id:'p0',name:'P0'},{id:'p1',name:'P1'}],matches:[session]}));assert.equal(club.matches[0].config.game,game);assert.equal(replay(session).visits.length,1);assert.deepEqual(replay({...session,events:[]}).scores,[0,0]);assert.equal(playerSummary(club,'p0',game).matches.length,0)}const s={historyEpoch:HISTORY_EPOCH,version:1,id:'tie',startedAt:'2026-10-02T00:00:00Z',config:{...cfg('score'),rounds:1},events:[0,0].map(score=>({type:'visit',input:{score,darts:3}}))};assert.equal(playerSummary({version:1,players:[],matches:[s]},'p0').wins,0)});

test('cricket marks accumulate across turns: single, single, double closes and scores 20',()=>{
 let m=initialMatch(cfg('cricket'));
 m=shots(m,['20']);assert.equal(m.marks[0][0],1);assert.equal(m.scores[0],0);
 m=shots(m,['Мимо']);assert.equal(m.marks[0][0],1);
 m=shots(m,['20']);assert.equal(m.marks[0][0],2);assert.equal(m.scores[0],0);
 m=shots(m,['Мимо']);assert.equal(m.marks[0][0],2);
 m=shots(m,['D20']);assert.equal(m.marks[0][0],3);assert.equal(m.scores[0],20);
 m=shots(m,['Мимо']);m=shots(m,['20']);assert.equal(m.marks[0][0],3);assert.equal(m.scores[0],40);
 m=shots(m,['T20']);assert.ok(m.marks.every(row=>row[0]===3));
 const scores=[...m.scores];m=shots(m,['20']);assert.deepEqual(m.scores,scores);
});
