import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
export const emulatorMode =
  import.meta.env.VITE_USE_EMULATORS === 'true' ||
  (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== 'false');
const config = emulatorMode
  ? {
      apiKey: 'demo-api-key',
      authDomain: 'demo-beatsync.firebaseapp.com',
      projectId: 'demo-beatsync',
      appId: 'demo-beatsync-web',
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
if (Object.values(config).some((value) => !value))
  throw new Error('Firebase config ไม่ครบ กรุณาตรวจ .env.local');
const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);
if (emulatorMode) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
