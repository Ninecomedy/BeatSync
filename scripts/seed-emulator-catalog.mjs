// Explicit localhost-only seed for fresh Emulator sessions; never contacts production.
import fs from 'node:fs';
const catalog = JSON.parse(fs.readFileSync('scripts/song-metadata.json', 'utf8'));
const encode = v => typeof v === 'string' ? {stringValue:v} : typeof v === 'number' ? (Number.isInteger(v) ? {integerValue:String(v)} : {doubleValue:v}) : {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}};
let created=0;
for (const [id, song] of Object.entries(catalog)) {
  const response = await fetch('http://127.0.0.1:8080/v1/projects/demo-beatsync/databases/(default)/documents/songs/'+id+'?currentDocument.exists=false', {
    method:'PATCH', headers:{'Content-Type':'application/json',Authorization:'Bearer owner'}, body:JSON.stringify(encode(song).mapValue),
  });
  if (response.ok) created++;
  else if (![409,412].includes(response.status)) throw new Error('Emulator catalog seed failed: '+response.status);
}
console.log('Emulator catalog: '+created+' new songs; existing documents preserved');
