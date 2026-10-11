import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/auth';
import { resolveSessionRoleState, requireSubscription } from '@/lib/authz';
import { canUseEthics } from '@/lib/ethics/shared';
import { getLocaleFromCookies, getMessagesSync } from '@/lib/i18n';
import { localizePath } from '@/lib/localizePath';
import { buildLocalizedMetadata } from '@/lib/metadata';
import { loginHref } from '@/lib/safeNextPath';
import EthicsPage from '@/components/ethics/EthicsPage';
export async function generateMetadata() {
  const locale = getLocaleFromCookies(await cookies());
  return buildLocalizedMetadata({ locale, pathname: '/eetikaruum', title: getMessagesSync(locale)?.ethics?.title || 'Eetikaruum' });
}
export default async function Page() {
  const jar = await cookies(), locale = getLocaleFromCookies(jar), session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user?.id || session.authDegraded) redirect(localizePath(loginHref('/eetikaruum'), locale));
  const role = resolveSessionRoleState(session, jar), subscription = await requireSubscription(session, role.effectiveRole);
  return <EthicsPage canEdit={canUseEthics(role.effectiveRole, role.isAdmin) && subscription.ok} />;
}
