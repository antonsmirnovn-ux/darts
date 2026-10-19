import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calloutPath,CALLER_ROOT} from '../lib/caller.ts';
import {existsSync} from 'node:fs';
test('every legal score uses the same selected recording set',()=>{
 for(let n=0;n<=180;n++){
  assert.equal(calloutPath(n),`${CALLER_ROOT}/${n}.mp3`);
  assert.ok(existsSync(new URL('../public'+calloutPath(n),import.meta.url)),`missing ${n}`);
 }
 for(const phrase of ['Перебор','Озвучка включена'])assert.ok(existsSync(new URL('../public'+calloutPath(phrase),import.meta.url)));
});
test('invalid scores and unknown messages do not switch to a device voice',()=>{
 for(const value of [-1,181,1.5,NaN,Infinity,'21','unknown'])assert.equal(calloutPath(value),null);
});
