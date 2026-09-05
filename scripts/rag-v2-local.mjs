import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const directory = path.resolve('tmp/rag-v2-services');
const mode = process.argv[2];
if (!['up', 'migrate', 'validate', 'stop'].includes(mode)) throw new Error('Use: node scripts/rag-v2-local.mjs up|migrate|validate|stop');
await fs.mkdir(directory, { recursive: true });
const configPath = path.join(directory, 'connections.json');
let config;
try { config = JSON.parse(await fs.readFile(configPath, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT' || mode !== 'up') throw error;
  const password = randomBytes(24).toString('hex'), key = randomBytes(24).toString('hex');
  config = { postgresUrl: `postgresql://rag_v2_dev:${password}@127.0.0.1:55432/rag_v2_dev`, qdrantUrl: 'http://127.0.0.1:56333', qdrantKey: key };
  await fs.writeFile(configPath, JSON.stringify(config), { flag: 'wx', mode: 0o600 });
  await fs.writeFile(path.join(directory, 'compose.env'), `RAG_V2_PG_PASSWORD=${password}\nRAG_V2_QDRANT_KEY=${key}\n`, { flag: 'wx', mode: 0o600 });
}
const compose = ['compose', '--project-name', 'sotsiaalai-rag-v2', '--env-file', path.join(directory, 'compose.env'), '-f', 'deploy/rag-v2/compose.yml'];
const result = mode === 'up' || mode === 'stop'
  ? spawnSync('docker', [...compose, ...(mode === 'up' ? ['up', '-d', '--wait', '--wait-timeout', '60'] : ['stop'])], { stdio: 'inherit', windowsHide: true })
  : spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...(mode === 'migrate' ? ['migrate', 'deploy'] : ['validate']), '--config', 'prisma/rag-v2/prisma.config.mjs'], {
    stdio: 'inherit', windowsHide: true, env: { ...process.env, RAG_V2_DATABASE_URL: config.postgresUrl },
  });
process.exitCode = result.status ?? 1;
