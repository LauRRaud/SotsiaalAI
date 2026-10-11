'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n/I18nProvider';
import StepFlight from '@/components/stage/StepFlight';
import StepPanel from '@/components/stage/StepPanel';
import TextAreaField from '@/components/stage/TextAreaField';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ChatMessageItem from '@/components/alalehed/chat/ChatMessageItem';
import { ETHICS_FIELDS, ETHICS_TEXT_LIMIT, ETHICS_SHARE_LIMIT, ethicsDraftSuggestion, ethicsIdentifierTypes } from '@/lib/ethics/shared';
import { askEthicsAssistant } from '@/lib/ethics/assistantClient';
import { localizePath } from '@/lib/localizePath';
import styles from './ethics.module.css';

const empty = () => Object.fromEntries(['title', ...ETHICS_FIELDS, 'shareDraft'].map(key => [key, '']));
async function request(url, method = 'GET', body) {
  const response = await fetch(url, { method, cache: 'no-store', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.message || 'ethics.errors.failed');
  return result;
}
export default function EthicsPage({ canEdit }) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState([]), [cursor, setCursor] = useState(null);
  const [record, setRecord] = useState(null), [form, setForm] = useState(empty), [baseline, setBaseline] = useState(empty);
  const [opened, setOpened] = useState(false), [view, setView] = useState('list');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [notice, setNotice] = useState('');
  const [confirmed, setConfirmed] = useState(false), [answer, setAnswer] = useState(null);
  const creationKey = useRef(null), intent = useRef(null), working = useRef(false);
  const dirty = opened && JSON.stringify(form) !== JSON.stringify(baseline);
  const label = key => t(`ethics.${key}`);
  const note = <span className={styles.note}>{label('private')} · {dirty || !record ? label('unsaved') : label('saved_state')}</span>;
  const issues = ethicsIdentifierTypes(form.shareDraft);
  const load = useCallback(async next => {
    const result = await request(`/api/ethics${next ? `?cursor=${encodeURIComponent(next)}` : ''}`);
    setItems(previous => next ? [...previous, ...result.items] : result.items);
    setCursor(result.nextCursor);
  }, []);
  useEffect(() => {
    let live = true;
    request('/api/ethics').then(result => { if (live) { setItems(result.items); setCursor(result.nextCursor); } })
      .catch(error => { if (live) setNotice(error.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const guard = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  async function run(action) {
    if (working.current) return;
    working.current = true; setBusy(true); setNotice('');
    try { await action(); } catch (error) { setNotice(error.message?.startsWith('ethics.') || error.message?.startsWith('api.common.') || error.message === 'chat.crisis.notice' ? error.message : 'ethics.errors.failed'); }
    finally { working.current = false; setBusy(false); }
  }
  function assign(next) {
    setRecord(next); setForm(next?.content || empty()); setBaseline(next?.content || empty());
    setConfirmed(false); setAnswer(null); intent.current = null;
  }
  function change(key, value) { setForm(previous => ({ ...previous, [key]: value })); setConfirmed(false); setNotice(''); }
  async function save() {
    const result = record
      ? await request(`/api/ethics/${record.id}`, 'PATCH', { expectedVersion: record.version, content: form })
      : await request('/api/ethics', 'POST', { creationKey: creationKey.current, content: form });
    setRecord(result.reflection); setForm(result.reflection.content); setBaseline(result.reflection.content);
    setConfirmed(false); setNotice('ethics.saved'); await load();
    return result.reflection;
  }
  function open(next) {
    if (dirty && !window.confirm(label('discard'))) return;
    void run(async () => {
      assign(next ? (await request(`/api/ethics/${next.id}`)).reflection : null);
      creationKey.current = crypto.randomUUID(); setOpened(true); setView('question');
    });
  }
  async function assist() {
    const input = await request(`/api/ethics/${record.id}/assistant`, 'POST', { expectedVersion: record.version, confirmed, locale });
    if (intent.current?.question !== input.question) intent.current = { question: input.question, convId: crypto.randomUUID(), clientTurnKey: crypto.randomUUID() };
    const result = await askEthicsAssistant(input, intent.current);
    setAnswer(result); setView('assistant');
  }
  async function covision() {
    const result = await request(`/api/ethics/${record.id}/covision`, 'POST', { expectedVersion: record.version, confirmed });
    const fresh = await request(`/api/ethics/${record.id}`); setRecord(fresh.reflection); setNotice('ethics.handoff_done');
    setConfirmed(false);
    // Navigation is deliberate, through the link beside the result; no invitations are sent.
    if (!result.covisionCaseId) throw new Error('ethics.errors.failed');
  }
  const saveButton = <Button disabled={busy || !canEdit || !dirty} onClick={() => void run(save)}>{label('save')}</Button>;
  const steps = [
    { key: 'list', label: label('list'), free: true },
    ...(opened ? ETHICS_FIELDS.map(key => ({ key, label: label(`fields.${key}.short`), state: form[key] ? 'done' : 'empty', summary: form[key].slice(0, 90) })) : []),
    ...(opened ? [{ key: 'share', label: label('share'), free: true }, { key: 'assistant', label: label('assistant'), free: true }] : []),
    { key: 'sources', label: label('sources'), free: true }
  ];
  function render(step) {
    if (ETHICS_FIELDS.includes(step.key)) return <StepPanel title={step.label} lead={label(`fields.${step.key}.hint`)} note={note} actions={saveButton}>
      {step.key === 'question' ? <label className={styles.titleField}>{label('title_label')}<Input value={form.title} maxLength={160} disabled={busy || !canEdit} onChange={event => change('title', event.target.value)} /></label> : null}
      <TextAreaField label={label(`fields.${step.key}.label`)} value={form[step.key]} onChange={value => change(step.key, value)} maxLength={ETHICS_TEXT_LIMIT} disabled={busy || !canEdit} rows={4} />
    </StepPanel>;
    if (step.key === 'list') return <StepPanel title={step.label} question={label('lead')} note={label('private')} actions={canEdit ? <Button disabled={busy} onClick={() => open(null)}>{label('new')}</Button> : null}>
      <p className={styles.quiet}>{label('retention')}</p>
      {loading ? <p>{label('loading')}</p> : !items.length ? <p>{label('empty')}</p> : <ul className={styles.list}>{items.map(item => <li key={item.id}>
        <button className={styles.row} disabled={busy} onClick={() => open(item)}><span>{item.title || label('untitled')}</span><small>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(item.updatedAt))}</small></button>
      </li>)}</ul>}
      {cursor ? <Button disabled={busy} onClick={() => void run(() => load(cursor))}>{label('more')}</Button> : null}
      {record ? <><p>{label('selected')}: {record.content.title || record.content.question.slice(0, 100) || label('untitled')}</p><div className={styles.actions}><Button disabled={busy} onClick={() => {
        if (window.confirm(label('delete_confirm'))) void run(async () => { await request(`/api/ethics/${record.id}`, 'DELETE', { expectedVersion: record.version }); assign(null); setOpened(false); setView('list'); await load(); setNotice('ethics.deleted'); });
      }}>{label('delete')}</Button><Button disabled={busy || dirty} onClick={() => {
        const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'eetikaruum.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>{label('export')}</Button></div></> : null}
    </StepPanel>;
    if (step.key === 'share') return <StepPanel title={step.label} question={label('share_question')} lead={label('share_help')} note={note}>
      <TextAreaField label={label('snapshot')} value={form.shareDraft} onChange={value => change('shareDraft', value)} maxLength={ETHICS_SHARE_LIMIT} rows={5} disabled={busy || !canEdit} />
      <div className={styles.actions}><Button disabled={busy || !canEdit} onClick={() => {
        if (form.shareDraft && !window.confirm(label('replace'))) return;
        change('shareDraft', ethicsDraftSuggestion(form));
      }}>{label('suggest')}</Button>{saveButton}</div>
      <p className={styles.quiet}>{label('suggestion_note')}</p>
      {issues.length ? <p role="alert">{label('identifiers')} {issues.map(type => label(`identifier_types.${type}`)).join(', ')}</p> : null}
      <label className={styles.check}><input type="checkbox" checked={confirmed} disabled={busy || dirty || !record || !!issues.length} onChange={event => setConfirmed(event.target.checked)} />{label('confirmation')}</label>
      <p className={styles.quiet}>{label('ai_privacy')}</p>
      <div className={styles.actions}><Button disabled={busy || dirty || !confirmed || !canEdit || !form.shareDraft.trim()} onClick={() => void run(assist)}>{busy ? label('working') : label('ask')}</Button>
        <Button disabled={busy || dirty || !confirmed || !canEdit || !form.shareDraft.trim() || !!record?.covisionCaseId} onClick={() => void run(covision)}>{label('to_covision')}</Button></div>
      <p className={styles.quiet}>{label('covision_privacy')}</p>
      {record?.covisionCaseId ? <><Link href={localizePath(`/kovisioon?case=${encodeURIComponent(record.covisionCaseId)}`, locale)}>{label('open_covision')}</Link>
        <details className={styles.frozen}><summary>{label('frozen_snapshot')}</summary><p>{record.sharedText}</p></details></> : null}
      <p className={styles.quiet}>{label('expert_closed')}</p>
    </StepPanel>;
    if (step.key === 'assistant') return <StepPanel title={step.label} lead={label('ai_origin')} note={label('ai_not_saved')}>
      {answer ? <><ChatMessageItem role="ai" text={answer.answer} t={t} locale={locale} voiceEnabled={false} completionStatus="COMPLETED" />
        <ul className={styles.sources}>{(answer.sources || []).map(source => <li key={source.key}><Link href={source.url}>{source.label || source.title}</Link></li>)}</ul></> : <p>{label('no_answer')}</p>}
    </StepPanel>;
    return <StepPanel title={step.label} lead={label('source_help')}>
      <ul className={styles.sources}>
        <li><a href={`https://www.eswa.ee/wp-content/uploads/2026/05/sotsiaalvaldkonna-tootaja-koodeks${locale === 'en' ? '_eng' : locale === 'ru' ? '_RU' : ''}.pdf`} target="_blank" rel="noopener noreferrer">{label('source_code')}</a></li>
        <li><a href="https://www.ifsw.org/global-social-work-statement-of-ethical-principles/" target="_blank" rel="noopener noreferrer">{label('source_ifsw')}</a></li>
        <li><a href="https://www.eswa.ee/eetikakasiraamat/" target="_blank" rel="noopener noreferrer">{label('source_handbook')}</a></li>
      </ul><p className={styles.quiet}>{label('source_scope')}</p>
    </StepPanel>;
  }
  return <section className={styles.shell} aria-busy={busy}>
    <h1 className="sr-only">{label('title')}</h1>
    {notice ? <p className={styles.notice} role={notice.includes('.errors.') ? 'alert' : 'status'}>{t(notice)}</p> : null}
    {!canEdit ? <p>{label('read_only')}</p> : null}
    <StepFlight key={opened ? 'open' : 'closed'} flat label={label('title')} steps={steps} activeKey={view} initialIndex={Math.max(0, steps.findIndex(step => step.key === view))} onStepChange={(_index, step) => setView(step.key)}>{render}</StepFlight>
  </section>;
}
