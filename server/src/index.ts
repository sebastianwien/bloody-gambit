// Platzhalter bis Phase 7: beantwortet nur den Gesundheitscheck.
import { createServer } from 'node:http';
const port = Number(process.env.PORT ?? 8790);
createServer((_req, res) => res.end('ok')).listen(port, () => console.log('Wolfsschach-Server auf Port', port));
