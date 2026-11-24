import { rankRows, bestPerScope, bestPlacement } from './ranking.js';
import { validateSettings, cloudWait } from '../settings/store.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  deleteField,
  setDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { auth, db } from './client.js';
export const observeAuth = (callback) => onAuthStateChanged(auth, callback);
export const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
export async function register(name, email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: name });
  await ensureProfile(user, name);
  return user;
}
export async function ensureProfile(user, name = user.displayName) {
  const ref = doc(db, 'profiles', user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return snapshot.data();
  if (!name?.trim()) return null;
  const profile = { name: name.trim(), createdAt: serverTimestamp() };
  await setDoc(ref, profile);
  return profile;
}
const listen = (q, callback, error) =>
  onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ ...d.data(), id: d.id }))), error);
export const watchScores = (cb, error, songId = 'neon-pulse-v1', difficulty = 'normal') =>
  listen(
    query(
      collection(db, 'scores'),
      where('songId', '==', songId),
      ...(songId === 'neon-pulse-v1' ? [] : [where('difficulty', '==', difficulty)]),
    ),
    (rows) => cb(rankRows(rows).slice(0, 20)),
    error,
  );
export const watchBest = (uid, cb, error, songId, difficulty) =>
  listen(
    query(
      collection(db, 'scores'),
      where('uid', '==', uid),
      ...(songId ? [where('songId', '==', songId)] : []),
      ...(difficulty && songId !== 'neon-pulse-v1' ? [where('difficulty', '==', difficulty)] : []),
      orderBy('score', 'desc'),
      limit(1),
    ),
    cb,
    error,
  );
export const watchChat = (cb, error) =>
  listen(
    query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(50)),
    (rows) => cb(rows.reverse()),
    error,
  );
export const watchReactions = (scoreId, cb, error) =>
  listen(collection(db, 'scores', scoreId, 'reactions'), cb, error);
export const newScoreId = () => doc(collection(db, 'scores')).id;
export async function saveScore(
  id,
  user,
  name,
  result,
  songId = 'neon-pulse-v1',
  difficulty = 'normal',
) {
  // Stable run ID makes retry after an uncertain acknowledgement idempotent.
  const ref = doc(db, 'scores', id);
  await runTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists()) return;
    tx.set(ref, {
      uid: user.uid,
      playerName: name,
      songId,
      difficulty,
      ...result,
      createdAt: serverTimestamp(),
    });
  });
}
export async function toggleReaction(scoreId, uid, kind) {
  const ref = doc(db, 'scores', scoreId, 'reactions', uid);
  await runTransaction(db, async (tx) => {
    const old = await tx.get(ref);
    const data = old.exists() ? old.data() : { like: false, love: false };
    tx.set(ref, {
      like: data.like,
      love: data.love,
      [kind]: !data[kind],
      updatedAt: serverTimestamp(),
    });
  });
}
export const sendMessage = (uid, playerName, text) =>
  setDoc(doc(collection(db, 'messages')), {
    uid,
    playerName,
    text: text.trim(),
    createdAt: serverTimestamp(),
  });

export const getSong = async (id) => {
  const snap = await getDoc(doc(db, 'songs', id));
  return snap.exists() ? snap.data() : null;
};
export const watchComments = (scoreId, cb, error) =>
  listen(
    query(collection(db, 'scores', scoreId, 'comments'), orderBy('createdAt'), limit(50)),
    cb,
    error,
  );
export const addComment = (scoreId, uid, playerName, text) =>
  setDoc(doc(collection(db, 'scores', scoreId, 'comments')), {
    uid,
    playerName,
    text: text.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
export const editComment = (scoreId, id, text) =>
  updateDoc(doc(db, 'scores', scoreId, 'comments', id), {
    text: text.trim(),
    updatedAt: serverTimestamp(),
  });
export const removeComment = (scoreId, id) => deleteDoc(doc(db, 'scores', scoreId, 'comments', id));

export async function loadUserSettings(uid, fallback) {
  const ref = doc(db, 'settings', uid);
  return cloudWait(
    runTransaction(db, async (tx) => {
      const snapshot = await tx.get(ref);
      if (snapshot.exists()) return validateSettings(snapshot.data());
      const settings = validateSettings(fallback);
      tx.set(ref, settings); // First-login migration: transaction never overwrites an existing document.
      return settings;
    }),
  );
}
export const saveUserSettings = (uid, settings) =>
  cloudWait(setDoc(doc(db, 'settings', uid), validateSettings(settings)));
export const saveProfilePicture = (uid, photo) => updateDoc(doc(db, 'profiles', uid), { photo });

export const removeProfilePicture = (uid) =>
  updateDoc(doc(db, 'profiles', uid), { photo: deleteField() });

export const watchPlacement = (uid, callback, error) => {
  let revision = 0;
  let active = true;
  const unsubscribe = listen(
    query(collection(db, 'scores'), where('uid', '==', uid)),
    async (rows) => {
      const current = ++revision;
      try {
        const placements = await Promise.all(
          bestPerScope(rows).map(async (row) => {
            const higher = await getDocs(
              query(
                collection(db, 'scores'),
                where('songId', '==', row.songId),
                ...(row.songId === 'neon-pulse-v1'
                  ? []
                  : [where('difficulty', '==', row.difficulty)]),
                where('score', '>', row.score),
                orderBy('score', 'desc'),
              ),
            );
            const higherUids = new Set(higher.docs.map(doc => doc.data().uid).filter(other => other && other !== uid));
            return { ...row, rank: higherUids.size + 1 };
          }),
        );
        if (active && current === revision) callback(bestPlacement(placements));
      } catch (e) {
        if (active && current === revision) error(e);
      }
    },
    error,
  );
  return () => {
    active = false;
    revision++;
    unsubscribe();
  };
};

export async function getCommentAvatar(uid) {
  const snapshot = await getDoc(doc(db, 'profiles', uid));
  const photo = snapshot.exists() ? snapshot.data().photo : null;
  return typeof photo === 'string' &&
    photo.length <= 32768 &&
    /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(photo)
    ? photo
    : null;
}
