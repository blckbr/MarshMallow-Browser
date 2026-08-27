import fs from 'node:fs';
import crypto from 'node:crypto';
export function compareVersions(a,b) {
  const pa=String(a||'').split('.').map((x)=>Number(x)||0), pb=String(b||'').split('.').map((x)=>Number(x)||0);
  const n=Math.max(pa.length,pb.length);
  for(let i=0;i<n;i++){const d=(pa[i]||0)-(pb[i]||0); if(d) return d>0?1:-1;} return 0;
}
export function validateReleaseMetadata(json) {
  const version=String(json?.version||'').trim(), url=String(json?.url||'').trim(), sha256=String(json?.sha256||'').trim().toLowerCase();
  if(!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) return {ok:false,error:'version-invalid',version,url,sha256};
  let parsed; try{parsed=new URL(url);}catch{return {ok:false,error:'url-invalid',version,url,sha256};}
  if(parsed.protocol!=='https:') return {ok:false,error:'url-not-https',version,url,sha256};
  if(parsed.hostname.toLowerCase()!=='github.com') return {ok:false,error:'url-host-invalid',version,url,sha256};
  const expectedPath=`/blckbr/MarshMallow-Browser/releases/download/v${version}/MarshMallow-Setup-${version}.exe`;
  if(parsed.pathname!==expectedPath) return {ok:false,error:'url-path-invalid',version,url,sha256};
  if(!/^[a-f0-9]{64}$/.test(sha256)) return {ok:false,error:'sha256-invalid',version,url,sha256};
  const releaseUrl=String(json?.releaseUrl||'').trim();
  if(releaseUrl){
    let releaseParsed; try{releaseParsed=new URL(releaseUrl);}catch{return {ok:false,error:'release-url-invalid',version,url,sha256};}
    if(releaseParsed.protocol!=='https:'||releaseParsed.hostname.toLowerCase()!=='github.com'||releaseParsed.pathname!==`/blckbr/MarshMallow-Browser/releases/tag/v${version}`) return {ok:false,error:'release-url-invalid',version,url,sha256};
  }
  return {ok:true,version,url,sha256,size:Number(json?.size||0),releaseUrl,publishedAt:String(json?.publishedAt||'')};
}
export async function sha256File(filePath) {
  return await new Promise((resolve,reject)=>{const h=crypto.createHash('sha256'), s=fs.createReadStream(filePath); s.on('data',(d)=>h.update(d)); s.on('error',reject); s.on('end',()=>resolve(h.digest('hex')));});
}
