import path from 'node:path';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import prisma from '@/lib/prisma';
import { loadAdminConfig, configFingerprint } from '@/lib/rag-v2/admin/config.js';
import { IntakeService, intakeError } from '@/lib/rag-v2/admin/intake.js';
import { parsePdf } from '@/lib/rag-v2/parser.js';
import { assertIntakePrincipal } from '@/lib/rag-v2/admin/auth.js';

async function currentPrincipal() {
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user?.id || session.authDegraded) throw intakeError('unauthorized', 401);
  const user = await prisma.user.findUnique({ where: { id: session.user.id },
    select: { id: true, role: true, isAdmin: true, accessSuspendedAt: true, sessionVersion: true } }).catch(() => null);
  return assertIntakePrincipal(session, user);
}

export async function intakeSession() {
  const user = await currentPrincipal();
  const config = await loadAdminConfig();
  if (!config.users.includes(user.id)) throw intakeError('forbidden', 403);
  const original = configFingerprint(config);
  const assertAccess = async () => {
    const [current, latest] = await Promise.all([currentPrincipal(), loadAdminConfig()]);
    if (current.id !== user.id || current.sessionVersion !== user.sessionVersion || !latest.users.includes(user.id)
      || configFingerprint(latest) !== original) throw intakeError('rag_v2_access_changed', 403);
  };
  return { config, service: new IntakeService({ config, userId: user.id, assertAccess,
    dependencies: { ingestDependencies: { parsePdf: (bytes, processing) => parsePdf(bytes, processing,
      { workerPath: path.join(process.cwd(), 'lib/rag-v2/pdf-worker.js') }) } } }) };
}
