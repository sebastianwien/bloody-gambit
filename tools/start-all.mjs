// Startet Spiel (Vite, Port 5180) und Server (Port 8790) zusammen. Strg+C beendet beide.
import { spawn } from 'node:child_process';

// Unter Windows heißt npm "npm.cmd" und startet nur über die Shell
const win = process.platform === 'win32';
const run = (script) =>
  win ? spawn(`npm run ${script}`, { stdio: 'inherit', shell: true }) : spawn('npm', ['run', script], { stdio: 'inherit' });
const procs = [run('dev'), run('server')];
const stop = () => {
  for (const p of procs) p.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => code && stop());
