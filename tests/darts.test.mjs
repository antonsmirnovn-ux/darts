import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialMatch,rematchConfig,advance,currentPlayer,checkout,canFinish,possibleScore,evaluateHits,replay,stats,legResults,HITS} from '../lib/darts.ts';
const config=(teams=false,n=2)=>({start:301,out:'double',target:2,teams,sides:Array.from({length:n},(_,i)=>({name:`S${i}`,players:teams?[`P${i}a`,`P${i}b`]:[`P${i}`]}))});
const turn=(m,score,darts=3,bust=false)=>advance(m,{type:'visit',input:{score,darts,bust}});
test('2, 3 and 4 players rotate correctly',()=>{for(const n of [2,3,4]){let m=initialMatch(config(false,n));for(let i=0;i<n*2;i++){assert.equal(m.active,i%n);m=turn(m,60)}assert.deepEqual(m.scores,Array(n).fill(181))}});
test('team score shared while members alternate',()=>{let m=initialMatch(config(true));assert.equal(currentPlayer(m),'P0a');m=turn(m,60);assert.equal(currentPlayer(m),'P1a');m=turn(m,40);assert.equal(currentPlayer(m),'P0b');m=turn(m,100);assert.deepEqual(m.scores,[141,261]);assert.equal(stats(m,0,'P0a').average,60);assert.equal(stats(m,0,'P0b').average,100)});
test('bust resets whole visit and credits zero for three darts',()=>{let m={...initialMatch(config()),scores:[40,301]};m=turn(m,60);assert.equal(m.scores[0],40);assert.equal(m.visits[0].bust,true);assert.equal(stats(m,0).average,0);assert.equal(stats(m,0).darts,3);let leftOne=turn({...initialMatch(config()),scores:[40,301]},39);assert.equal(leftOne.scores[0],40)});
test('exact final dart, leg transition and match win',()=>{let m={...initialMatch(config()),scores:[40,301]};m=turn(m,40,1);assert.equal(m.status,'leg');assert.equal(stats(m,0).average,120);assert.equal(m.wins[0],1);m=advance(m,{type:'next'});assert.equal(m.active,1);assert.equal(m.leg,2);assert.deepEqual(m.scores,[301,301]);m={...m,scores:[301,32],wins:[0,1]};m=turn(m,32,1);assert.equal(m.status,'won');assert.equal(m.winner,1);assert.throws(()=>turn(m,0))});
test('unreachable totals and finishes are rejected',()=>{assert.equal(possibleScore(179),false);assert.equal(possibleScore(178),false);assert.equal(possibleScore(163),false);assert.equal(possibleScore(180),true);assert.equal(canFinish(169,3,'double'),false);assert.equal(canFinish(170,3,'double'),true);assert.equal(canFinish(100,1,'double'),false);assert.equal(canFinish(40,1,'double'),true);assert.equal(checkout(169,'double'),null);assert.deepEqual(checkout(170,'double').map(h=>h.label),['T20','T20','Bull']);assert.throws(()=>turn(initialMatch(config()),179))});
test('per-dart handles wrong final double, one left and early finish',()=>{const h=s=>HITS.find(x=>x.label===s);assert.equal(evaluateHits(40,[h('20'),h('20')],'double').bust,true);assert.equal(evaluateHits(40,[h('T13')],'double').bust,true);assert.equal(evaluateHits(50,[h('Bull')],'double').finish,true);assert.equal(evaluateHits(40,[h('D20')],'double').darts,1);assert.equal(evaluateHits(20,[h('20')],'straight').finish,true);assert.throws(()=>advance({...initialMatch(config()),scores:[40,301]},{type:'visit',input:{score:40,darts:2,hits:[h('D20'),h('Мимо')]}}))});
test('replay preserves result and removing last event restores state',()=>{const s={version:1,config:config(),events:[{type:'visit',input:{score:180,darts:3}},{type:'visit',input:{score:0,darts:3}},{type:'visit',input:{score:121,darts:3}}]};assert.equal(replay(s).status,'leg');assert.deepEqual(replay({...s,events:s.events.slice(0,-1)}).scores,[121,301]);assert.equal(replay({...s,events:s.events.slice(0,-1)}).active,0)});
test('straight out permits one remaining and one point finish',()=>{let m={...initialMatch({...config(),out:'straight'}),scores:[21,301]};m=turn(m,20);assert.equal(m.scores[0],1);m=turn(m,0);m=turn(m,1,1);assert.equal(m.status,'leg')});
test('checkout hints use legal finishing hits for every reachable score',()=>{for(const out of ['double','straight'])for(let score=1;score<=180;score++){const path=checkout(score,out);assert.equal(Boolean(path),canFinish(score,3,out),`${out} ${score}`);if(path){assert.ok(path.length<=3);assert.equal(path.reduce((s,h)=>s+h.value,0),score);if(out==='double')assert.ok(path.at(-1).double);assert.equal(evaluateHits(score,path,out).finish,true)}}});

test('leg dart counts stay separate from match totals and survive replay / undo',()=>{
 const c={...config(true),target:2};const events=[];let m=initialMatch(c);
 const add=(score,darts=3,bust=false)=>{const e={type:'visit',input:{score,darts,bust}};events.push(e);m=advance(m,e)};
 add(180);add(0);add(121);assert.equal(legResults(m)[0].darts,6);
 const next={type:'next'};events.push(next);m=advance(m,next);
 add(0);add(180);add(0);add(0,3,true);add(0);add(121);
 assert.equal(m.status,'won');assert.equal(stats(m,0).darts,15);assert.equal(stats(m,0,undefined,2).darts,9);
 assert.deepEqual(legResults(m).map(r=>[r.leg,r.side,r.darts]),[[1,0,6],[2,0,9]]);
 const session={version:1,config:c,events};assert.deepEqual(legResults(replay(session)),legResults(m));
 assert.equal(legResults(replay({...session,events:events.slice(0,-1)})).length,1);
});

test('rematch rotates the original opening side for singles and teams, independent of winner / last leg',()=>{
 for(const teams of [false,true])for(const n of teams?[2]:[2,3,4]){
  let c=config(teams,n);
  for(let match=0;match<n*2;match++){
   const m=initialMatch(c);assert.equal(m.active,match%n);assert.equal(m.starter,match%n);
   const nextLeg=advance({...m,status:'leg',winner:(match+1)%n},{type:'next'});assert.equal(nextLeg.active,(match+1)%n);
   c=rematchConfig(nextLeg.config);assert.equal(c.firstSide,(match+1)%n);
   assert.deepEqual(c.sides,m.config.sides);
   assert.equal(replay({version:1,config:c,events:[]}).active,(match+1)%n);
  }
 }
 assert.throws(()=>initialMatch({...config(),firstSide:2}));
 assert.throws(()=>initialMatch({...config(),firstSide:-1}));
});
