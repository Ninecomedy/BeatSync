import { spawnSync } from 'node:child_process';
const checks = [
  ['--test', 'tests/game.test.js', 'tests/firebase.test.js'],
  ['node_modules/@playwright/test/cli.js', 'test'],
  ['node_modules/vite/bin/vite.js', 'build'],
];
for (const args of checks) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}
