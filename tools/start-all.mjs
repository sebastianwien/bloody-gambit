// Startet Spiel (Vite, Port 5180) und Server (Port 8790) zusammen. Strg+C beendet beide.
import { spawn } from 'node:child_process';

const procs = [
  spawn('npm', ['run', 'dev'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'server'], { stdio: 'inherit' }),
];
const stop = () => {
  for (const p of procs) p.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => code && stop());
