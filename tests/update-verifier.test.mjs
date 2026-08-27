import test from 'node:test';
import assert from 'node:assert/strict';
import {compareVersions,validateReleaseMetadata} from '../electron/lib/update-verifier.mjs';
const hash='a'.repeat(64);
test('5.0.1 newer than 5.0.0',()=>assert.equal(compareVersions('5.0.1','5.0.0'),1));
test('http release rejected',()=>assert.equal(validateReleaseMetadata({version:'5.0.1',url:'http://x',sha256:hash}).ok,false));
test('foreign https release host is rejected',()=>assert.equal(validateReleaseMetadata({version:'5.0.1',url:'https://evil.example/MarshMallow-Setup-5.0.1.exe',sha256:hash}).ok,false));
test('wrong github repository is rejected',()=>assert.equal(validateReleaseMetadata({version:'5.0.1',url:'https://github.com/other/MarshMallow-Browser/releases/download/v5.0.1/MarshMallow-Setup-5.0.1.exe',sha256:hash}).ok,false));
test('official release metadata accepted',()=>assert.equal(validateReleaseMetadata({version:'5.0.0',url:'https://github.com/blckbr/MarshMallow-Browser/releases/download/v5.0.0/MarshMallow-Setup-5.0.0.exe',releaseUrl:'https://github.com/blckbr/MarshMallow-Browser/releases/tag/v5.0.0',sha256:hash,size:123}).ok,true));
