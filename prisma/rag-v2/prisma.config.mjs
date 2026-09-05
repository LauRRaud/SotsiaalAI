import { defineConfig } from 'prisma/config';
import { localPostgresUrl } from '../../lib/rag-v2/search/local-config.js';

// Separate local database only. Never fall back to the platform's DATABASE_URL.
export default defineConfig({
  schema: 'schema.prisma', migrations: { path: 'migrations' },
  datasource: { url: localPostgresUrl(process.env.RAG_V2_DATABASE_URL) },
});
