'use client';
import { useId } from 'react';
import styles from './PilotContextControls.module.css';

export default function PilotContextControls({ dialogue, disabled = false, t: translate }) {
  const id = useId();
  if (!dialogue?.enabled) return null;
  const t = (key, values) => translate(`m4Pilot.${key}`, values);
  const { data, selection, select } = dialogue;
  const continuing = ['same', 'correction'].includes(selection.contextMode);
  const scope = continuing ? data?.scopes.find(s => selection.contextTurnId ? s.turnId === selection.contextTurnId : s.scopeId === data?.active?.scopeId) : null;
  const answer = scope?.answers.find(a => a.turnId === selection.replyToTurnId);
  return <details className={styles.controls}>
    <summary>{t('dialogueControls')}{scope ? ` · ${t('personNumber', { number: scope.person })}` : ''}</summary>
    <p role="status">{dialogue.error ? t('contextUnavailable') : !dialogue.ready ? t('contextLoading')
      : scope ? t('activeContext', { topic: scope.title, count: scope.userTurns, max: data.limits.scopeTurns, revision: scope.correctionRevision })
        : continuing && data?.unavailable ? t('contextUnavailable') : t('emptyContext')}</p>
    {scope?.latestCorrection && <p>{t('latestCorrection', { text: scope.latestCorrection })}</p>}
    <div className={styles.fields}>
      <label htmlFor={`${id}-mode`}>{t('context')}<select id={`${id}-mode`} disabled={disabled || !dialogue.ready} value={selection.contextMode}
        onChange={event => select({ contextMode: event.target.value })}>
        <option value="same">{t('dialogueSame')}</option><option value="correction">{t('dialogueCorrection')}</option>
        <option value="new">{t('new')}</option><option value="new_person">{t('newPerson')}</option>
      </select></label>
      {continuing && !!data?.scopes.length && <label htmlFor={`${id}-scope`}>{t('chooseTopic')}<select id={`${id}-scope`} value={selection.contextTurnId || ''} disabled={disabled}
        onChange={event => select({ contextMode: selection.contextMode, ...(event.target.value ? { contextTurnId: event.target.value } : {}) })}>
        <option value="">{t('activeTopic')}</option>
        {data.scopes.map(s => <option key={s.scopeId} value={s.turnId}>{t('personNumber', { number: s.person })} · {s.title}</option>)}
      </select></label>}
      {continuing && !!scope?.answers.length && <label htmlFor={`${id}-answer`}>{t('chooseAnswer')}<select id={`${id}-answer`} value={selection.replyToTurnId || ''} disabled={disabled}
        onChange={event => select({ contextMode: selection.contextMode, ...(selection.contextTurnId ? { contextTurnId: selection.contextTurnId } : {}),
          ...(event.target.value ? { replyToTurnId: event.target.value } : {}) })}>
        <option value="">{t('latestAnswer')}</option>
        {scope.answers.map((a, i) => <option key={a.turnId} value={a.turnId}>{i + 1}. {a.question}</option>)}
      </select></label>}
      {answer?.points > 0 && <label htmlFor={`${id}-point`}>{t('choosePoint')}<select id={`${id}-point`} value={selection.replyToBlock || ''} disabled={disabled}
        onChange={event => { const { replyToBlock: _old, ...rest } = selection; select({ ...rest, ...(event.target.value ? { replyToBlock: Number(event.target.value) } : {}) }); }}>
        <option value="">{t('wholeAnswer')}</option>
        {Array.from({ length: answer.points }, (_, i) => <option key={i} value={i + 1}>{t('pointNumber', { number: i + 1 })}</option>)}
      </select></label>}
    </div>
    <p>{t('dialogueChoiceHint')}</p>
    {scope?.userTurns >= data?.limits.scopeTurns && <p role="alert">{t('contextLimit')}</p>}
    {dialogue.error && <button type="button" onClick={() => dialogue.refresh()} disabled={disabled}>{t('reloadContext')}</button>}
  </details>;
}
