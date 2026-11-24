import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
let env, a, b, guest;
const score = () => ({
  uid: 'alice',
  playerName: 'Alice',
  songId: 'neon-pulse-v1',
  score: 1500,
  maxCombo: 2,
  perfect: 1,
  good: 1,
  miss: 46,
  createdAt: serverTimestamp(),
});
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-beatsync-rules',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
  });
  await env.clearFirestore();
  a = env.authenticatedContext('alice').firestore();
  b = env.authenticatedContext('bob').firestore();
  guest = env.unauthenticatedContext().firestore();
  await setDoc(doc(a, 'profiles', 'alice'), { name: 'Alice', createdAt: serverTimestamp() });
  await setDoc(doc(b, 'profiles', 'bob'), { name: 'Bob', createdAt: serverTimestamp() });
});
after(async () => {
  await env?.cleanup();
});
test('owner profile creation, public game names only, deny escalation and invalid updates', async () => {
  await assertFails(getDoc(doc(b, 'profiles', 'alice')));
  await assertSucceeds(getDoc(doc(a, 'profiles', 'alice')));
  for (const data of [
    { name: 'x', createdAt: serverTimestamp() },
    { name: 5 },
    { name: 'x'.repeat(1000) },
    { admin: true },
    { email: 'private@example.com' },
  ])
    await assertFails(updateDoc(doc(b, 'profiles', 'alice'), data));
  await assertFails(updateDoc(doc(a, 'profiles', 'alice'), { admin: true }));
  await assertFails(updateDoc(doc(a, 'profiles', 'alice'), { name: 'x'.repeat(1000) }));
  await assertFails(setDoc(doc(a, 'profiles', 'alice'), { name: 'Alice' }));
  await assertFails(
    setDoc(doc(a, 'profiles', 'other'), { name: 'Alice', createdAt: serverTimestamp() }),
  );
});
test('score writes and app queries succeed; forged ownership, totals and mutations denied', async () => {
  await assertSucceeds(setDoc(doc(a, 'scores', 'rules-run'), score()));
  await assertSucceeds(
    getDocs(query(collection(b, 'scores'), orderBy('score', 'desc'), limit(20))),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(a, 'scores'),
        where('uid', '==', 'alice'),
        orderBy('score', 'desc'),
        limit(1),
      ),
    ),
  );
  for (const change of [
    { uid: 'bob' },
    { playerName: 'Bob' },
    { score: -1 },
    { score: 999999999 },
    { score: 48000 },
    { perfect: '1' },
    { miss: 0 },
    { maxCombo: 49 },
    { songId: 'other' },
    { createdAt: new Date(0) },
    { extra: true },
  ])
    await assertFails(setDoc(doc(a, 'scores', 'bad-run'), { ...score(), ...change }));
  await assertFails(updateDoc(doc(a, 'scores', 'rules-run'), { score: 2 }));
  await assertFails(updateDoc(doc(b, 'scores', 'rules-run'), { uid: 'bob' }));
  await assertFails(deleteDoc(doc(a, 'scores', 'rules-run')));
});
test('reaction ownership, schema, parent existence and no counter manipulation', async () => {
  const ref = doc(b, 'scores', 'rules-run', 'reactions', 'bob');
  await assertSucceeds(setDoc(ref, { like: true, love: false, updatedAt: serverTimestamp() }));
  await assertSucceeds(setDoc(ref, { like: true, love: true, updatedAt: serverTimestamp() }));
  await assertFails(
    setDoc(doc(a, 'scores', 'rules-run', 'reactions', 'bob'), {
      like: false,
      love: false,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(updateDoc(ref, { like: 5, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(ref, { like: true, updatedAt: serverTimestamp() }));
  await assertFails(
    setDoc(doc(a, 'scores', 'missing', 'reactions', 'alice'), {
      like: true,
      love: true,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(updateDoc(doc(b, 'scores', 'rules-run'), { likesCount: 100 }));
});
test('chat messages must use own UID and name, bounded text, server timestamp', async () => {
  const data = { uid: 'bob', playerName: 'Bob', text: 'Hello Alice', createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(b, 'messages', 'rules-message'), data));
  await assertSucceeds(
    getDocs(query(collection(a, 'messages'), orderBy('createdAt', 'desc'), limit(50))),
  );
  for (const change of [
    { uid: 'alice' },
    { playerName: 'Alice' },
    { text: '' },
    { text: ' ' },
    { text: 'x'.repeat(281) },
    { text: 123 },
    { createdAt: new Date(0) },
    { admin: true },
  ])
    await assertFails(setDoc(doc(b, 'messages', 'bad'), { ...data, ...change }));
  await assertFails(updateDoc(doc(b, 'messages', 'rules-message'), { text: 'changed' }));
});
test('unauthenticated reads/writes and comments are denied', async () => {
  for (const path of ['profiles', 'scores', 'messages'])
    await assertFails(getDocs(collection(guest, path)));
  await assertFails(setDoc(doc(guest, 'scores', 'guest'), score()));
  await assertFails(
    setDoc(doc(a, 'scores', 'rules-run', 'comments', 'future'), { text: 'Not enabled' }),
  );
});
test('comments are scoped to an existing score and only the owner may edit/delete', async () => {
  const ref = doc(a, 'scores', 'rules-run', 'comments', 'comment-a');
  const data = {
    uid: 'alice',
    playerName: 'Alice',
    text: 'Hello',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(ref, data));
  await assertSucceeds(getDoc(doc(b, 'scores', 'rules-run', 'comments', 'comment-a')));
  await assertFails(
    updateDoc(doc(b, 'scores', 'rules-run', 'comments', 'comment-a'), {
      text: 'Hijack',
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(deleteDoc(doc(b, 'scores', 'rules-run', 'comments', 'comment-a')));
  await assertFails(updateDoc(ref, { uid: 'bob', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { text: ' ', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { text: 'x'.repeat(281), updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref, { text: 'Edited', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(a, 'scores', 'missing', 'comments', 'x'), data));
  await assertSucceeds(deleteDoc(ref));
});
test('song metadata is read-only for signed-in players; profiles and reactions stay owner scoped', async () => {
  await env.withSecurityRulesDisabled(async (context) =>
    setDoc(doc(context.firestore(), 'songs', 'neon-pulse-v1'), { mode: 'hosted' }),
  );
  await assertSucceeds(getDoc(doc(a, 'songs', 'neon-pulse-v1')));
  await assertFails(getDoc(doc(guest, 'songs', 'neon-pulse-v1')));
  await assertFails(setDoc(doc(a, 'songs', 'evil'), { audioPath: 'https://evil.example' }));
  await assertSucceeds(updateDoc(doc(a, 'profiles', 'alice'), { name: 'Alice updated' }));
  await assertSucceeds(updateDoc(doc(a, 'profiles', 'alice'), { name: 'Alice' }));
  await assertFails(getDoc(doc(b, 'profiles', 'alice')));
  const ref = doc(a, 'scores', 'rules-run', 'reactions', 'alice');
  await assertSucceeds(setDoc(ref, { like: true, love: false, updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(b, 'scores', 'rules-run', 'reactions', 'alice')));
  await assertSucceeds(deleteDoc(ref));
});

test('account settings: owner isolation, valid values and four unique keys', async () => {
  const ref = doc(a, 'settings', 'alice');
  const settings = {
    noteSpeed: 1.6,
    musicVolume: 0.3,
    sfxVolume: 0,
    keys: ['KeyA', 'KeyS', 'KeyJ', 'KeyK'],
  };
  await assertSucceeds(setDoc(ref, settings));
  await assertSucceeds(getDoc(ref));
  await assertFails(getDoc(doc(b, 'settings', 'alice')));
  await assertFails(getDoc(doc(guest, 'settings', 'alice')));
  await assertFails(setDoc(doc(b, 'settings', 'alice'), settings));
  for (const patch of [
    { noteSpeed: 3 },
    { musicVolume: -1 },
    { sfxVolume: 2 },
    { keys: ['KeyA', 'KeyA', 'KeyJ', 'KeyK'] },
    { keys: ['KeyA', 'KeyS', 'KeyJ', 'Bogus'] },
    { admin: true },
  ])
    await assertFails(updateDoc(ref, patch));
  await assertSucceeds(updateDoc(ref, { sfxVolume: 0.7 }));
});
test('account picture: bounded private thumbnail preserves name and timestamps', async () => {
  const ref = doc(a, 'profiles', 'alice');
  await assertSucceeds(updateDoc(ref, { photo: 'data:image/webp;base64,AAAA' }));
  await assertFails(
    updateDoc(doc(b, 'profiles', 'alice'), { photo: 'data:image/webp;base64,AAAA' }),
  );
  await assertFails(getDoc(doc(b, 'profiles', 'alice')));
  for (const photo of [
    'https://example.com/photo',
    'data:image/svg+xml;base64,AAAA',
    'data:image/webp;base64,' + 'A'.repeat(32768),
  ])
    await assertFails(updateDoc(ref, { photo }));
  await assertSucceeds(updateDoc(ref, { photo: 'data:image/webp;base64,BBBB' }));
  await assertFails(updateDoc(doc(b, 'profiles', 'alice'), { photo: deleteField() }));
  await assertSucceeds(updateDoc(ref, { photo: deleteField() }));
  await assertSucceeds(getDoc(ref));
});
test('account leaderboard: song filter reads existing immutable scores', async () => {
  const ref = doc(a, 'scores', 'account-check');
  await assertSucceeds(setDoc(ref, score()));
  await assertSucceeds(
    getDocs(
      query(
        collection(b, 'scores'),
        where('songId', '==', 'neon-pulse-v1'),
        orderBy('score', 'desc'),
        limit(20),
      ),
    ),
  );
  await assertFails(updateDoc(ref, { score: 999999 }));
});

test('persistence: all active song difficulties accept valid scores and reject forged data', async () => {
  const catalog = JSON.parse(readFileSync('scripts/song-metadata.json', 'utf8'));
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [id, song] of Object.entries(catalog))
      await setDoc(doc(ctx.firestore(), 'songs', id), song);
  });
  for (const [songId, song] of Object.entries(catalog)) {
    for (const [difficulty, count] of Object.entries(song.counts || { normal: 48 })) {
      const data = { ...score(), songId, difficulty, miss: count - 2 };
      const ref = doc(a, 'scores', 'persistence-' + songId + '-' + difficulty);
      await assertSucceeds(setDoc(ref, data));
      await assertSucceeds(
        getDocs(
          query(
            collection(b, 'scores'),
            where('songId', '==', songId),
            where('difficulty', '==', difficulty),
            orderBy('score', 'desc'),
          ),
        ),
      );
      await assertFails(
        setDoc(doc(a, 'scores', 'bad-' + songId + '-' + difficulty), { ...data, miss: count }),
      );
      await assertFails(setDoc(doc(b, 'scores', 'stolen-' + songId + '-' + difficulty), data));
      await assertFails(updateDoc(ref, { score: 100000 }));
    }
  }
  await assertFails(
    setDoc(doc(a, 'scores', 'unknown-difficulty'), {
      ...score(),
      songId: 'rabbit-hole',
      difficulty: 'lunatic',
    }),
  );
  await assertSucceeds(getDoc(doc(a, 'profiles', 'alice')));
});
