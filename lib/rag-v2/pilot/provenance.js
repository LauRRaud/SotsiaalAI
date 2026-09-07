import fs from 'node:fs/promises';
import path from 'node:path';
import { hash } from '../contracts.js';
import { digest } from './contracts.js';

// Runtime modules and server authorization are bound to the approved local implementation.
// Evaluation files and human acceptance labels are deliberately outside this runtime manifest.
export async function implementationManifest(root = process.cwd()) {
  const files = ['auth.js', 'package.json', 'package-lock.json', 'prisma/schema.prisma', 'lib/prisma.js', 'lib/retention.js',
    'messages/et.json', 'messages/en.json', 'messages/ru.json', 'lib/chat/m4PilotServer.js', 'lib/chat/m4PilotClientContract.js', 'lib/chat/m4PilotIntent.js', 'lib/chat/routeServerUtils.js', 'lib/chat-api-rate-limit.js', 'app/api/chat/route.js',
    'app/vestlus/page.js', 'app/chat-source/page.jsx', 'components/ChatSidebar.jsx', 'components/alalehed/ChatBody.jsx', 'components/alalehed/chat/ChatBodyView.jsx',
    'components/chat/hooks/useChatStream.js', 'components/chat/hooks/useChatConversationState.js', 'components/alalehed/chat/ChatSourcesPanel.jsx',
    'components/chat/hooks/usePilotDialogue.js', 'components/chat/PilotContextControls.jsx', 'components/chat/PilotContextControls.module.css'];
  async function walk(relative) {
    for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await walk(name);
      else if (/\.(js|jsx|json|css)$/.test(name)) files.push(name);
    }
  }
  for (const dir of ['lib/rag-v2', 'lib/auth', 'app/api/chat/pilot', 'app/rag-pilot']) await walk(dir);
  const manifest = {};
  for (const file of files.sort()) manifest[file] = hash(await fs.readFile(path.join(root, file)));
  return { files: manifest, hash: digest(manifest) };
}
