import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  auth = require('firebase-tools/lib/auth'),
  options = { project: 'beatsync-37390' };
auth.setActiveAccount(options, auth.getGlobalDefaultAccount());
await require('firebase-tools/lib/requireAuth').requireAuth(options);
const { Client } = require('firebase-tools/lib/apiv2'),
  client = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
const path = '/projects/beatsync-37390/databases/(default)/documents/songs/rabbit-hole';
const before = (await client.get(path)).body;
const desired = JSON.parse(fs.readFileSync('scripts/song-metadata.json'))['rabbit-hole'];
const names = ['charts', 'audioFilenames', 'counts', 'labels', 'stars'];
const encode = (v) =>
  typeof v === 'string'
    ? { stringValue: v }
    : typeof v === 'number'
      ? Number.isInteger(v)
        ? { integerValue: String(v) }
        : { doubleValue: v }
      : {
          mapValue: {
            fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)])),
          },
        };
const query =
  '?' +
  names.map((n) => 'updateMask.fieldPaths=' + n).join('&') +
  '&currentDocument.updateTime=' +
  encodeURIComponent(before.updateTime);
await client.patch(path + query, {
  fields: Object.fromEntries(names.map((n) => [n, encode(desired[n])])),
});
const after = (await client.get(path)).body;
for (const name of Object.keys(before.fields).filter((n) => !names.includes(n)))
  assert.deepEqual(after.fields[name], before.fields[name]);
for (const name of names) assert.deepEqual(after.fields[name], encode(desired[name]));
console.log(
  'Updated Rabbit Hole option maps only: Hard 4.00, x1.0 asset, audio.mp3; unrelated fields/user data preserved',
);
