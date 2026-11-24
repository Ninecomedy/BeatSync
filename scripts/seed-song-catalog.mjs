import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const auth = require('firebase-tools/lib/auth');
const options = { project: 'beatsync-37390' };
auth.setActiveAccount(options, auth.getGlobalDefaultAccount());
await require('firebase-tools/lib/requireAuth').requireAuth(options);
const { Client } = require('firebase-tools/lib/apiv2');
const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
const root = '/projects/beatsync-37390/databases/(default)/documents';
const value = (v) =>
  typeof v === 'string'
    ? { stringValue: v }
    : typeof v === 'number'
      ? Number.isInteger(v)
        ? { integerValue: String(v) }
        : { doubleValue: v }
      : { mapValue: { fields: fields(v) } };
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, value(v)]));
for (const [id, data] of Object.entries(
  JSON.parse(fs.readFileSync('scripts/song-metadata.json')),
)) {
  const existing = await client.get(`${root}/songs/${id}`, { resolveOnHTTPError: true });
  if (existing.status === 200) {
    console.log(`Preserved existing song metadata: ${id}`);
    continue;
  }
  if (existing.status !== 404) throw new Error(`Catalog read failed: ${existing.status}`);
  await client.post(`${root}/songs`, { fields: fields(data) }, { queryParams: { documentId: id } });
  console.log(`Created song metadata: ${id}`);
}
