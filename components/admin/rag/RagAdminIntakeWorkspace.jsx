"use client";

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import RagAdminPageFrame from './RagAdminPageFrame';
import RagAdminKnowledgePanel from './RagAdminKnowledgePanel';
import { getRagV2IntakeCopy, intakeErrorText } from './ragV2IntakeCopy';
import { EMPTY_INTAKE_FIELDS, intakeFormFromMetadata, intakeMetadataFromForm } from './ragV2Metadata';
import styles from './ragV2Intake.module.css';

const endpoint = '/api/admin/rag/v2/intake';
const formatValue = value => value === null || value === undefined ? '—' : typeof value === 'string' ? value : JSON.stringify(value);
async function responseJson(response) {
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.code || 'rag_v2_intake_failed');
  return data;
}
function setJobUrl(job) {
  const url = new URL(window.location.href);
  if (job) url.searchParams.set('job', job); else url.searchParams.delete('job');
  window.history.replaceState(null, '', url);
}

export default function RagAdminIntakeWorkspace({ locale }) {
  const copy = getRagV2IntakeCopy(locale);
  const [fields, setFields] = useState(EMPTY_INTAKE_FIELDS), [extra, setExtra] = useState('{}');
  const [pdf, setPdf] = useState(null), [confirmed, setConfirmed] = useState(false), [reviewed, setReviewed] = useState(false);
  const [receipt, setReceipt] = useState(null), [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(''), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(), job = new URL(window.location.href).searchParams.get('job');
    const options = { credentials: 'same-origin', cache: 'no-store', signal: controller.signal };
    Promise.all([fetch(endpoint, options).then(responseJson).then(configuration => setStatus(configuration.status)), job ? fetch(endpoint + '?job=' + encodeURIComponent(job), options).then(responseJson) : null])
      .then(([, saved]) => {
        if (saved?.receipt) {
          setReceipt(saved.receipt);
          const form = intakeFormFromMetadata(saved.receipt.metadata); setFields(form.fields); setExtra(form.extra);
        }
      }).catch(cause => { if (cause.name !== 'AbortError') setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  function invalidate() { setReceipt(null); setReviewed(false); setError(''); setJobUrl(null); }
  function update(key, value) { invalidate(); setFields(current => ({ ...current, [key]: value })); }
  async function importMetadata(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > (status?.max_metadata_bytes || 1024 * 1024)) throw new Error('metadata_too_large');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      const form = intakeFormFromMetadata(JSON.parse(text)); invalidate(); setFields(form.fields); setExtra(form.extra);
    } catch { setError('invalid_metadata_json'); }
  }
  let preview = '', metadataValid = true;
  try { preview = JSON.stringify(intakeMetadataFromForm(fields, extra), null, 2); } catch { metadataValid = false; }
  async function prepare(event) {
    event.preventDefault();
    if (!pdf || !confirmed || !metadataValid) { setError('intake_fields_required'); return; }
    if (pdf.size > status.max_file_bytes) { setError('pdf_too_large'); return; }
    setBusy('prepare'); setError(''); setReviewed(false);
    try {
      const form = new FormData();
      form.append('pdf', pdf); form.append('metadata', new Blob([preview], { type: 'application/json' }));
      form.append('sourceUse', 'confirmed');
      const data = await fetch(endpoint, { method: 'POST', body: form, credentials: 'same-origin' }).then(responseJson);
      setReceipt(data.receipt); setJobUrl(data.receipt.job_id);
    } catch (cause) { setError(cause.message); } finally { setBusy(''); }
  }
  async function publish() {
    if (!receipt?.plan || !reviewed) return;
    setBusy('publish'); setError('');
    try {
      const data = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', jobId: receipt.job_id, planHash: receipt.plan.hash }) }).then(responseJson);
      setReceipt(data.receipt);
      const current = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' }).then(responseJson);
      setStatus(current.status);
    } catch (cause) {
      setError(cause.message);
      try {
        const saved = await fetch(endpoint + '?job=' + encodeURIComponent(receipt.job_id), { credentials: 'same-origin', cache: 'no-store' }).then(responseJson);
        setReceipt(saved.receipt);
      } catch { /* Keep the original publication error if the receipt is no longer accessible. */ }
    } finally { setBusy(''); }
  }
  async function knowledgeAction(action, data) {
    setBusy(action === 'prepareKnowledge' ? 'knowledge' : 'knowledge-apply'); setError(''); setReviewed(false);
    try {
      const result = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, jobId: receipt.job_id, ...data }) }).then(responseJson);
      setReceipt(result.receipt); setJobUrl(result.receipt.job_id);
      if (action === 'applyKnowledge') {
        const form = intakeFormFromMetadata(result.receipt.metadata); setFields(form.fields); setExtra(form.extra);
      }
      const current = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' }).then(responseJson); setStatus(current.status);
    } catch (cause) {
      setError(cause.message);
      try {
        const saved = await fetch(endpoint + '?job=' + encodeURIComponent(receipt.job_id), { credentials: 'same-origin', cache: 'no-store' }).then(responseJson);
        setReceipt(saved.receipt);
      } catch { /* Preserve the operation error if the source is no longer accessible. */ }
    } finally { setBusy(''); }
  }
  const assetUrl = asset => endpoint + '?job=' + encodeURIComponent(receipt.job_id) + '&asset=' + asset;
  return <RagAdminPageFrame locale={locale} activeKey="ingest" title={copy.title} subtitle={copy.subtitle}>
    {loading ? <p role="status">{copy.loading}</p> : null}
    {error ? <div className={styles.error} role="alert"><p>{intakeErrorText(copy, error)}</p><details><summary>{copy.code}</summary><code>{error}</code></details></div> : null}
    {status ? <p className={styles.note}>{copy.limit}: <strong>{status.cap_usd} USD</strong> · {copy.reserved}: {status.reserved_usd} USD</p> : null}
    {status?.knowledge_preparation?.enabled ? <p className={styles.note}>{copy.preparation.budget}: <strong>{status.knowledge_preparation.cap_usd} USD</strong> · {copy.reserved}: {status.knowledge_preparation.reserved_usd} USD</p> : null}
    <div className={styles.layout}>
      <form className="ra-card ra-form" onSubmit={prepare}>
        <h2 className="ra-card-title">1. {copy.prepare}</h2>
        <fieldset disabled={Boolean(busy) || !status} className={styles.fieldset}>
          <label className={styles.field}>{copy.pdf}<input type="file" accept="application/pdf,.pdf" onChange={event => { invalidate(); setPdf(event.target.files?.[0] || null); }} /></label>
          <label className={styles.field}>{copy.import}<input type="file" accept="application/json,.json" onChange={importMetadata} /></label>
          <div className="ra-form-grid">{Object.entries(copy.fields).map(([key, label]) => <label key={key} className={styles.field}>{label}
            {key === 'authors' || key === 'tags' ? <textarea rows="2" value={fields[key]} onChange={event => update(key, event.target.value)} />
              : key === 'language' ? <select value={fields.language} onChange={event => update(key, event.target.value)}>{!['et', 'en', 'ru'].includes(fields.language) ? <option value={fields.language}>{fields.language}</option> : null}<option value="et">Eesti</option><option value="en">English</option><option value="ru">Русский</option></select>
                : <input type={key === 'year' ? 'number' : 'text'} min={key === 'year' ? '1' : undefined} value={fields[key]}
                    maxLength={key === 'title' ? 500 : 512} onChange={event => update(key, event.target.value)} required={['document_id', 'title', 'source_type'].includes(key)} />}
          </label>)}</div>
          <details><summary>{copy.extra}</summary><p className={styles.note}>{copy.extraHelp}</p>
            <label className={styles.field}>{copy.extra}<textarea rows="7" value={extra} spellCheck={false} onChange={event => { invalidate(); setExtra(event.target.value); }} /></label></details>
          <details><summary>{copy.preview}</summary><pre className={styles.code}>{metadataValid ? preview : copy.invalid}</pre></details>
          <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>{copy.use}</span></label>
          <Button type="submit" disabled={Boolean(busy) || !confirmed || !pdf || !metadataValid}>{busy === 'prepare' ? copy.preparing : copy.prepare}</Button>
        </fieldset>
      </form>
      <section className="ra-card" aria-label={copy.status} aria-busy={Boolean(busy)} aria-live="polite">
        <h2 className="ra-card-title">2. {copy.status}</h2>
        <p className={styles.note}>{receipt ? receipt.published ? copy.published : receipt.state === 'stopped' ? copy.stopped : receipt.state === 'vectors_ready' ? copy.indexPending : copy.ready : copy.empty}</p>
        {receipt ? <>
          <h3>{receipt.metadata.title}</h3>
          <div className={styles.metrics}><span><strong>{receipt.bundle.pages}</strong>{copy.pages}</span><span><strong>{receipt.bundle.chunks}</strong>{copy.chunks}</span><span><strong>{receipt.bundle.warnings.length}</strong>{copy.warnings}</span></div>
          {receipt.bundle.knowledge?.cards > 0 ? <div className={styles.review}>
            <h3>{copy.knowledge}</h3>
            <p>{copy.claims}: <strong>{receipt.bundle.knowledge.cards}</strong> · {copy.dependencies}: <strong>{receipt.bundle.knowledge.dependencies}</strong></p>
            <p className={styles.note}>{copy.knowledgeUnreviewed}</p>
          </div> : null}
          <div className="ra-actions"><a href={assetUrl('pdf')}>{copy.downloadPdf}</a><a href={assetUrl('metadata')}>{copy.downloadMetadata}</a></div>
          <RagAdminKnowledgePanel key={receipt.job_id + (receipt.knowledge_preparation?.draft?.hash || '')} receipt={receipt} copy={copy} busy={busy}
            onPrepare={planHash => knowledgeAction('prepareKnowledge', { planHash })}
            onApply={(draftHash, selection) => knowledgeAction('applyKnowledge', { draftHash, selection })} />
          {receipt.bundle.warnings.length ? <div className={styles.review}><h3>{copy.warnings}</h3><ul>{receipt.bundle.warnings.map((warning, index) =>
            <li key={warning.code + index}>{copy.warningText[warning.code] || warning.code.replaceAll('_', ' ')}</li>)}</ul></div> : null}
          <details className={styles.review}><summary>{copy.details}</summary><dl className={styles.provenance}>
            {Object.entries(receipt.bundle.fields).map(([key, field]) => <div key={key}><dt>{copy.fields[key] || key.replaceAll('_', ' ')}</dt>
              <dd>{formatValue(field.value)}<small>{copy.origin}: {[...new Set(field.provenance.map(item => copy.origins[item.kind] || item.kind))].join(' · ')}</small></dd></div>)}</dl></details>
          <details className={styles.review} open><summary>{copy.excerpt}</summary>{receipt.bundle.excerpt.map(item =>
            <div key={item.id} className={styles.excerpt}><small>{copy.page} {item.pages.join(', ')}</small><p>{item.text}</p></div>)}</details>
          {receipt.preparation_error ? <p role="status">{copy.notPrepared} ({receipt.preparation_error})</p> : null}
          {receipt.plan ? <details className={styles.review}><summary>{copy.scope}</summary><p>{copy.sources}: {receipt.plan.documents} · {copy.external}: {receipt.plan.external_inputs} · {copy.reused}: {receipt.plan.reused_inputs}</p></details> : null}
          {receipt.plan && !receipt.published && receipt.state !== 'stopped' ? <>
            <label className={styles.confirm}><input type="checkbox" disabled={Boolean(busy)} checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><span>{copy.review}</span></label>
            <Button type="button" onClick={publish} disabled={Boolean(busy) || !reviewed}>{busy === 'publish' ? copy.publishing : copy.publish}</Button>
          </> : null}
          <p className={styles.note}>{copy.binding}</p>
          <small>{copy.expires}: {new Date(receipt.expires_at).toLocaleString(locale)}</small>
        </> : null}
      </section>
    </div>
  </RagAdminPageFrame>;
}
