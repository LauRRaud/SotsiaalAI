import { intakeError } from './intake.js';

// Both the refreshed session and the current database row must still grant admin access.
export function assertIntakePrincipal(session, user) {
  if (!session?.user?.id || session.authDegraded) throw intakeError('unauthorized', 401);
  if (!user || session.user.id !== user.id || user.accessSuspendedAt
    || !user.isAdmin && user.role !== 'ADMIN' || !session.user.isAdmin && session.user.role !== 'ADMIN') throw intakeError('forbidden', 403);
  return user;
}
