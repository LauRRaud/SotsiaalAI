import { pilotGet } from '@/lib/chat/m4PilotServer';
import { dayText, plainRecordText, recordSourceLines } from '@/lib/chat/recordSourceLines';
import { serverT } from '@/lib/i18n/serverMessages';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getPublicSiteUrl } from '@/lib/siteUrl';
export const dynamic = 'force-dynamic';
// The fields of a municipality's record that the view names (lib/rag-v2/adapters/municipal-record.js); another field's
// value stands without a name.
const RECORD_FIELDS = new Set(['summary', 'targetGroup', 'conditions', 'amount', 'application', 'deadline', 'decisionTime', 'format', 'officialUrl', 'url',
  'last_checked', 'checked_at', 'retrieved_at', 'valid_from', 'valid_to', 'name', 'role', 'department', 'phone', 'email']);
const WEB = /^https?:\/\/\S+$/u;
function RecordLines({ lines, title, t }) {
  // A record checks the same day under two names (checked_at, last_checked): a line that says what one before it said
  // is not written again, nor the title the heading already gives.
  const seen = new Set(), shown = [];
  for (const line of lines) {
    const label = RECORD_FIELDS.has(line.field) ? t(`recordField.${line.field}`) : null, text = dayText(line.value.trim());
    if (line.field === 'title' && text === title || seen.has(`${label}\n${text}`)) continue;
    seen.add(`${label}\n${text}`); shown.push({ label, text });
  }
  return <dl style={{ display: 'grid', gap: '0.7rem', margin: 0 }}>
    {shown.map(({ label, text }, index) => <div key={index}>
      {label ? <dt style={{ fontSize: '0.85em', opacity: 0.75 }}>{label}</dt> : null}
      <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{WEB.test(text)
        ? <a href={text} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: 'anywhere' }}>{text}</a> : text}</dd>
    </div>)}
  </dl>;
}
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
  // Where the passage stands: its pages, or what kind of source it is (owner 22.10: "JSON on kirjas" read as a fault; a
  // file format says nothing to a reader). An act's XML has its provision beside it instead.
  const kinds = new Set((source.source_locations || []).map(item => item.kind));
  const location = source.pages.length ? t('pages', { pages: source.pages.join(', ') })
    : kinds.size === 1 && kinds.has('json') ? t('sourceRecord') : kinds.size === 1 && kinds.has('html') ? t('sourceWeb') : null;
  // A structured record (JSON) is shown field by field (recordSourceLines.js); other sources as their text.
  const record = !source.pages.length && source.source_locations?.length && source.source_locations.every(item => item.kind === 'json');
  const lines = record ? recordSourceLines(source.text, source.source_locations) : null;
  return <section style={{ padding: 24, maxWidth: 900, margin: 'auto' }}><h1>{source.title}</h1><p>{[source.provision, location, source.ref].filter(Boolean).join(' · ')}</p>
    {source.links?.length ? <p>{t('original')}: {source.links.map((url, index) => <span key={url}>{index ? ', ' : ''}<a href={url} target="_blank" rel="noopener noreferrer" title={url} style={{ overflowWrap: 'anywhere' }}>{new URL(url).hostname}</a></span>)}</p> : null}
    <a href={`/vestlus?conversation=${encodeURIComponent(params.convId)}`}>{t('closeSource')}</a>
    <details><summary>{t('version')}</summary><p style={{ overflowWrap: 'anywhere' }}>{source.version}</p>
      {!source.pages.length && source.source_locations?.map((item, index) => <p key={`${item.source_unit_id}/${index}`} style={{ overflowWrap: 'anywhere' }}>{item.path} [{item.start}–{item.end}]</p>)}</details>
    {source.superseded ? <p>{t(source.links?.length ? 'sourceChanged' : 'sourceGone')}</p>
      : lines ? <RecordLines lines={lines} title={String(source.title || '').trim()} t={t} />
        : <p style={{ whiteSpace: 'pre-wrap' }}>{record ? plainRecordText(source.text) : source.text}</p>}</section>;
}
