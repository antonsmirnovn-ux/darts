import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeClub,playerId,playerSummary} from '../lib/club.ts';
test('legacy player IDs migrate consistently, with history linked',()=>{const c=normalizeClub({version:1,players:[{id:'old',name:'Антон'}],matches:[{version:1,id:'m',startedAt:'2026-09-24T00:00:00Z',config:{start:501,out:'double',target:1,teams:false,sides:[{name:'Антон',players:['Антон'],playerIds:['old']},{name:'Гость',players:['Гость'],playerIds:[null]}]},events:[{type:'visit',input:{score:56,darts:3}}]}]});assert.equal(c.players[0].id,playerId(' антон '));assert.equal(c.matches[0].config.sides[0].playerIds[0],c.players[0].id);assert.equal(playerSummary(c,c.players[0].id).average,0);assert.equal(c.matches[0].config.sides[1].playerIds[0],null)});
