import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  auth = require('firebase-tools/lib/auth');
const options = { project: 'beatsync-37390' };
auth.setActiveAccount(options, auth.getGlobalDefaultAccount());
await require('firebase-tools/lib/requireAuth').requireAuth(options);
const { Client } = require('firebase-tools/lib/apiv2');
const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
const path = '/projects/beatsync-37390/databases/(default)/documents/songs/monitoring';
const before = (await client.get(path)).body;
console.log('Firestore counts:', JSON.stringify(before.fields.counts.mapValue.fields));
if (process.argv.includes('--apply')) {
  const query =
    '?updateMask.fieldPaths=counts.medium&updateMask.fieldPaths=counts.hard&currentDocument.updateTime=' +
    encodeURIComponent(before.updateTime);
  const fields = {
    counts: {
      mapValue: { fields: { medium: { integerValue: '1559' }, hard: { integerValue: '2217' } } },
    },
  };
  await client.patch(path + query, { fields });
  const after = (await client.get(path)).body;
  for (const key of Object.keys(before.fields).filter((k) => k !== 'counts')) {
    if (JSON.stringify(before.fields[key]) !== JSON.stringify(after.fields[key]))
      throw new Error('Unexpected catalog field change: ' + key);
  }
  console.log(
    'Updated only counts.medium/counts.hard:',
    JSON.stringify(after.fields.counts.mapValue.fields),
  );
}
