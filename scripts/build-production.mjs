import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const env = { ...process.env };
for (const line of fs.readFileSync('.env.production', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^(VITE_[A-Z_]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
}
env.VITE_USE_EMULATORS = 'false';
if (env.VITE_FIREBASE_PROJECT_ID !== 'beatsync-37390')
  throw new Error('Production project must be beatsync-37390');
for (const args of [
  ['scripts/generate-hosted-demo.mjs'],
  ['node_modules/vite/bin/vite.js', 'build'],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
// Only explicitly authorized sound recordings may be published.
const allowed = new Set(['Clcik.mp4', 'neon-pulse.wav']);
const audioDir = path.resolve('dist/audio');
for (const name of fs.readdirSync(audioDir)) {
  if (!allowed.has(name)) fs.unlinkSync(path.join(audioDir, name));
}
console.log('Production assets checked: original Neon Pulse + authorized Clcik only');
