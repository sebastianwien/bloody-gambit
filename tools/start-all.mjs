// Startet Spiel (Vite, Port 5180) und Server (Port 8790) zusammen. Strg+C beendet beide.
import { spawn } from 'node:child_process';

const procs = [
  // shell: unter Windows heißt npm "npm.cmd" und startet nur über die Shell
  spawn('npm run dev', { stdio: 'inherit', shell: true }),
  spawn('npm run server', { stdio: 'inherit', shell: true }),
];
const stop = () => {
  for (const p of procs) p.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => code && stop());
