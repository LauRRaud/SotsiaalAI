'use client';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import styles from './pilot.module.css';
import PilotContextControls from '@/components/chat/PilotContextControls';
import { usePilotDialogue } from '@/components/chat/hooks/usePilotDialogue';

async function api(url, body, pilot = false) {
  const response = await fetch(url, { cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json', ...(pilot ? { 'x-rag-pilot': '1' } : {}) }, body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.code || 'pilot_failed');
  return value;
}

export default function PilotClient() {
  const { t: translate, locale } = useI18n();
  const t = (key, values) => translate(`m4Pilot.${key}`, values);
  const [status, setStatus] = useState(null), [convId, setConvId] = useState(''), [turns, setTurns] = useState([]);
  const [question, setQuestion] = useState(''), [contextMode, setContextMode] = useState('new'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [source, setSource] = useState(null);
  const pending = useRef(null), submitting = useRef(false), sourceDialog = useRef(null);
  const dialogue = usePilotDialogue({ enabled: !!status?.dialogueEnabled, convId });
  useEffect(() => { if (source && !sourceDialog.current?.open) sourceDialog.current?.showModal(); }, [source]);
  async function loadConversation(id) {
    setTurns([]); setSource(null);
    const value = await api(`/api/chat/pilot?convId=${encodeURIComponent(id)}`);
    setConvId(id); setTurns(value.turns); setSource(null);
    window.history.replaceState(null, '', `?convId=${encodeURIComponent(id)}`);
  }
  useEffect(() => { let active = true;
    api('/api/chat/pilot').then(async value => {
      if (!active) return; setStatus(value);
      const id = new URL(window.location.href).searchParams.get('convId');
      if (id) await loadConversation(id);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  async function submit(event) {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const id = convId || (await api('/api/chat/pilot', { action: 'create' })).convId;
      setConvId(id); window.history.replaceState(null, '', `?convId=${encodeURIComponent(id)}`);
      const saved = sessionStorage.getItem(`m4-intent/${id}`);
      // Browser persistence carries only the intent key, never question/source content.
      pending.current = pending.current || { convId: id, clientTurnKey: saved || crypto.randomUUID(), question, contextMode, language: locale,
        ...(dialogue.enabled ? dialogue.selection : {}) };
      sessionStorage.setItem(`m4-intent/${id}`, pending.current.clientTurnKey);
      const value = await api('/api/chat', pending.current, true);
      if (value.state === 'completed') { pending.current = null; sessionStorage.removeItem(`m4-intent/${id}`); setQuestion(''); }
      if (dialogue.enabled) await dialogue.refresh({ accepted: !!value.context });
      await loadConversation(id);
    } catch (e) { setError(e.message); if (convId) { await loadConversation(convId).catch(() => {}); if (dialogue.enabled) await dialogue.refresh(); } }
    finally { submitting.current = false; setBusy(false); }
  }
  async function showSource(turn, ref) {
    setError(''); setSource(null);
    try { setSource(await api(`/api/chat/pilot?convId=${encodeURIComponent(convId)}&turnId=${encodeURIComponent(turn.id)}&ref=${ref}`)); }
    catch (e) { setError(e.message); }
  }
  return <div className={styles.page}>
    <header><p className={styles.eyebrow}>{t('eyebrow')}</p><h1>{t('title')}</h1>
      <p>{status?.mode === 'test' ? t('test') : status?.mode === 'real' ? t('real') : t('checking')}</p>
      <p>{t('scope')}</p></header>
    <nav aria-label={t('nav')}><button onClick={() => { setConvId(''); setTurns([]); setSource(null); pending.current = null; window.history.replaceState(null, '', '/rag-pilot'); }}>{t('newConversation')}</button>
      {status?.conversations.map(c => <button key={c.id} onClick={() => loadConversation(c.id).catch(e => setError(e.message))}>{new Date(c.createdAt).toLocaleString(locale)}</button>)}
      {convId && <button disabled={busy} onClick={async () => { try { await api('/api/chat/pilot', { action: 'delete', convId }); sessionStorage.removeItem(`m4-intent/${convId}`); setConvId(''); setTurns([]); setSource(null); pending.current = null; window.history.replaceState(null, '', '/rag-pilot'); } catch (e) { setError(e.message); } }}>{t('deleteConversation')}</button>}</nav>
    <div className={styles.columns}><section aria-label={t('conversation')}>
      {turns.map(turn => <article className={styles.turn} key={turn.id}><h2>{turn.question || t('pending')}</h2>
        {turn.answer ? <><p className={styles.eyebrow}>{t(turn.answer.kind)}</p>{turn.answer.blocks.map((block, i) => <div key={i}><p className={styles.text}>{block.text}</p>{block.refs.map(ref => <button key={ref} onClick={() => showSource(turn, ref)}>{t('open', { ref })}</button>)}</div>)}
          {turn.answer.limitations.map((limit, i) => <p key={i} className={styles.limit}>{limit}</p>)}{turn.answer.clarification && <p>{turn.answer.clarification}</p>}
          <details><summary>{t('sources')}</summary>{turn.sources.map(s => <p key={s.ref}><button onClick={() => showSource(turn, s.ref)}>{s.ref} · {s.used ? t('used') : t('found')}</button> {s.title} · {t('pages', { pages: s.pages.join(', ') })}</p>)}</details></> : <p>{t('state', { state: turn.state })}</p>}
        {turn.measurements && <details><summary>{t('metrics')}</summary><p>{t('metricNote')}</p><pre className={styles.text}>{JSON.stringify(turn.measurements, null, 2)}</pre></details>}
        {turn.recoverable && <button onClick={async () => { try { await api('/api/chat/pilot', { action: 'recover', convId, turnId: turn.id }); await loadConversation(convId); } catch (e) { setError(e.message); } }}>{t('recover')}</button>}</article>)}
      <form onSubmit={submit}>{dialogue.enabled ? <PilotContextControls dialogue={dialogue} disabled={busy} t={translate} /> : <><label htmlFor="m4-context">{t('context')}</label><select id="m4-context" value={contextMode} onChange={e => setContextMode(e.target.value)} disabled={busy}>
        <option value="new">{t('new')}</option><option value="same">{t('same')}</option><option value="new_person">{t('newPerson')}</option><option value="correction">{t('correction')}</option></select>
        </>}
        <label htmlFor="m4-question">{t('question')}</label><textarea id="m4-question" required maxLength={4000} value={question} onChange={e => setQuestion(e.target.value)} disabled={busy} rows={4} />
        <button type="submit" disabled={busy || !status || dialogue.enabled && !dialogue.ready}>{busy ? t('sending') : t('send')}</button><p role="status">{busy ? t('waiting') : ''}</p>
      </form>{convId && !busy && <button onClick={() => { sessionStorage.removeItem(`m4-intent/${convId}`); pending.current = null; setQuestion(''); setError(''); }} title={t('nextIntentHint')}>{t('nextIntent')}</button>}{error && <p role="alert" className={styles.error}>{t('error', { code: error })}</p>}</section>
      {source && <dialog ref={sourceDialog} onCancel={() => setSource(null)} aria-label={t('source')} className={styles.source}><button onClick={() => setSource(null)}>{t('closeSource')}</button><h2>{source.title}</h2><p>{t('pages', { pages: source.pages.join(', ') })} · {source.ref}</p><details><summary>{t('version')}</summary><p>{source.version}</p></details><p className={styles.text}>{source.text}</p></dialog>}
    </div>
    <p>{t('sourceHint')}</p>
  </div>;
}
