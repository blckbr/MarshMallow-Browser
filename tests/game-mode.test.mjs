import test from 'node:test';import assert from 'node:assert/strict';import {resolveGameMode,resolveWindowBackgroundPolicy} from '../electron/lib/game-mode.mjs';
test('manual off wins',()=>assert.equal(resolveGameMode({preference:'off',signals:{largeCanvas:true,webgl:true,pointerLock:true}}).active,false));
test('automatic detects strong game signals',()=>assert.equal(resolveGameMode({preference:'auto',signals:{largeCanvas:true,webgl:true}}).active,true));
test('one active game makes window continuous',()=>{const r=resolveWindowBackgroundPolicy([{id:'a',gameActive:true,saveResourcesInBackground:false},{id:'b',gameActive:false,saveResourcesInBackground:false}]);assert.equal(r.continuous,true);assert.deepEqual(r.demandingTabIds,['a']);});
