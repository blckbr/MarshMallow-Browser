import test from 'node:test';import assert from 'node:assert/strict';import {buildHistoryMenu} from '../electron/lib/navigation-history.mjs';
test('back menu nearest previous first',()=>{const e=['a','b','c','d'].map((x)=>({url:`https://${x}.test`,title:x}));assert.deepEqual(buildHistoryMenu(e,3,'back',15).map((x)=>x.index),[2,1,0]);});
test('forward menu nearest next first',()=>{const e=['a','b','c','d'].map((x)=>({url:`https://${x}.test`,title:x}));assert.deepEqual(buildHistoryMenu(e,1,'forward',15).map((x)=>x.index),[2,3]);});
