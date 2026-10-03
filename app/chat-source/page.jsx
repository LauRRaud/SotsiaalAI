import { pilotGet } from '@/lib/chat/m4PilotServer';
import { serverT } from '@/lib/i18n/serverMessages';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getPublicSiteUrl } from '@/lib/siteUrl';
export const dynamic = 'force-dynamic';
export default async function ChatSourcePage({ searchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ['convId', 'turnId', 'ref']) if (typeof params[key] === 'string') query.set(key, params[key]);
  if (query.size !== 3) notFound();
  const response = await pilotGet(new Request(`${getPublicSiteUrl()}/api/chat/pilot?${query}`));
  const source = await response.json();
  const locale = (await cookies()).get('NEXT_LOCALE')?.value || 'et';
  const t = (key, values) => serverT(locale, `m4Pilot.${key}`, values);
  if (!response.ok) return <section><h1>{t('source')}</h1><p>{t('denied')}</p></section>;
  const location = source.pages.length ? t('pages', { pages: source.pages.join(', ') })
    : [...new Set((source.source_locations || []).map(item => item.kind.toUpperCase()))].join(', ');
  return <section style={{ padding: 24, maxWidth: 900, margin: 'auto' }}><h1>{source.title}</h1><p>{[location, source.ref].filter(Boolean).join(' · ')}</p>
    {source.links?.length ? <p>{t('original')}: {source.links.map((url, index) => <span key={url}>{index ? ', ' : ''}<a href={url} target="_blank" rel="noopener noreferrer" title={url} style={{ overflowWrap: 'anywhere' }}>{new URL(url).hostname}</a></span>)}</p> : null}
    <a href={`/vestlus?conversation=${encodeURIComponent(params.convId)}`}>{t('closeSource')}</a>
    <details><summary>{t('version')}</summary><p style={{ overflowWrap: 'anywhere' }}>{source.version}</p>
      {!source.pages.length && source.source_locations?.map((item, index) => <p key={`${item.source_unit_id}/${index}`} style={{ overflowWrap: 'anywhere' }}>{item.path} [{item.start}–{item.end}]</p>)}</details>
    <p style={{ whiteSpace: 'pre-wrap' }}>{source.text}</p></section>;
}
