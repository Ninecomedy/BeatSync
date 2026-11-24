import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
const env = { ...process.env };
const bundledJava = 'C:/Program Files/Android/openjdk/jdk-21.0.8';
const javaHome = env.JAVA_HOME || (existsSync(bundledJava) ? bundledJava : null);
// Windows environment keys are case-insensitive, but a copied JS object is not.
// Keep a single PATH key and include this Node binary for CLI child commands.
const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path');
const inheritedPath = pathKey ? env[pathKey] : '';
for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
env.PATH = [path.dirname(process.execPath), javaHome && path.join(javaHome, 'bin'), inheritedPath]
  .filter(Boolean)
  .join(path.delimiter);
const mode = process.argv[2] || 'start';
const args = [
  'node_modules/firebase-tools/lib/bin/firebase.js',
  `emulators:${mode}`,
  '--project',
  'demo-beatsync',
  '--only',
  'auth,firestore',
];
if (mode === 'exec') args.push(process.argv[3] || 'node --test tests/firebase.test.js');
const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
