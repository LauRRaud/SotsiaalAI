"use client";

import { useId, useState } from 'react';
import Button from '@/components/ui/Button';
import { intakeErrorText } from './ragV2IntakeCopy';
import styles from './ragV2Intake.module.css';

function Anchors({ anchors, copy }) {
  return <details><summary>{copy.sources}</summary>{anchors.map((anchor, index) => <blockquote className={styles.excerpt} key={index}>
    <small>{copy.page} {anchor.pdf_page}</small><p>{anchor.quote}</p>
  </blockquote>)}</details>;
}

export default function RagAdminKnowledgePanel({ receipt, copy, busy, onPrepare, onApply }) {
  const titleId = useId(), [excludedCards, setExcludedCards] = useState([]), [excludedEdges, setExcludedEdges] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const preparation = receipt.knowledge_preparation, draft = preparation?.draft;
  const knowledge = draft?.knowledge || receipt.metadata.knowledge, text = copy.preparation;
  if (!preparation && !knowledge) return null;
  const editable = preparation?.state === 'draft_ready' && Boolean(draft?.knowledge);
  const cards = knowledge?.cards || [], edges = knowledge?.dependencies || [];
  const selectedCards = cards.filter(card => !excludedCards.includes(card.key)), kept = new Set(selectedCards.map(card => card.key));
  const selectedEdges = edges.filter(edge => !excludedEdges.includes(edge.key) && kept.has(edge.from) && edge.targets.every(target => kept.has(target.key)));
  const byKey = new Map(cards.map(card => [card.key, card.statement]));
  const gaps = draft?.unresolved || receipt.metadata.knowledge_preparation?.unresolved || [];
  const toggle = (setter, key) => { setConfirmed(false); setter(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key]); };
  return <section className={styles.review} aria-labelledby={titleId}>
    <h3 id={titleId}>{text.title}</h3>
    {preparation?.state === 'not_started' ? <>
      <p className={styles.note}>{text.explain}</p>
      <p>{text.cost.replace('{model}', preparation.plan.model).replace('{cost}', preparation.plan.max_cost_usd)}</p>
      <Button type="button" disabled={Boolean(busy)} onClick={() => onPrepare(preparation.plan.hash)}>{busy === 'knowledge' ? text.preparing : text.prepare}</Button>
    </> : null}
    {preparation?.error && preparation.error !== 'knowledge_already_prepared' ? <p className={styles.note} role="status">{intakeErrorText(copy, preparation.error)}</p> : null}
    {preparation?.state === 'draft_ready' && !cards.length ? <p>{text.empty}</p> : null}
    {cards.length ? <>
      <p className={styles.note}>{editable ? text.review : copy.knowledgeUnreviewed}</p>
      <details open={editable}><summary>{copy.claims}: {cards.length}</summary>
        {cards.map(card => <div className={styles.excerpt} key={card.key}>
          {editable ? <label className={styles.confirm}><input type="checkbox" checked={!excludedCards.includes(card.key)} disabled={Boolean(busy)}
            onChange={() => toggle(setExcludedCards, card.key)} /><span>{card.statement}</span></label> : <p>{card.statement}</p>}
          <p className={styles.note}>{text.kinds[card.kind]} · {card.scope}</p><Anchors anchors={card.anchors} copy={text} />
        </div>)}
      </details>
      {edges.length ? <details><summary>{copy.dependencies}: {edges.length}</summary>{edges.map(edge => {
        const available = kept.has(edge.from) && edge.targets.every(target => kept.has(target.key));
        const relation = <span>{text.relations[edge.type]}: {byKey.get(edge.from)} → {edge.targets.map(target => byKey.get(target.key) || text.external).join(edge.operator === 'any' ? ` ${text.any} ` : ` ${text.all} `)}</span>;
        return <div className={styles.excerpt} key={edge.key}>
          {editable ? <label className={styles.confirm}><input type="checkbox" checked={available && !excludedEdges.includes(edge.key)} disabled={Boolean(busy) || !available}
            onChange={() => toggle(setExcludedEdges, edge.key)} />{relation}</label> : <p>{relation}</p>}
          <p className={styles.note}>{edge.scope}</p><Anchors anchors={edge.anchors} copy={text} />
        </div>;
      })}</details> : null}
    </> : null}
    {gaps.length ? <details open><summary>{text.gaps}: {gaps.length}</summary>{gaps.map((gap, index) => <div className={styles.excerpt} key={index}>
      <p>{gap.statement}</p><p className={styles.note}>{gap.reason}</p><Anchors anchors={gap.anchors} copy={text} />
    </div>)}</details> : null}
    {editable ? <>
      <p>{text.selection.replace('{cards}', selectedCards.length).replace('{dependencies}', selectedEdges.length)}</p>
      <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={Boolean(busy)} onChange={event => setConfirmed(event.target.checked)} /><span>{text.confirm}</span></label>
      <div className="ra-actions"><Button type="button" disabled={Boolean(busy) || !confirmed || !selectedCards.length}
        onClick={() => onApply(draft.hash, { cards: selectedCards.map(card => card.key), dependencies: selectedEdges.map(edge => edge.key) })}>
        {busy === 'knowledge-apply' ? text.applying : text.apply}
      </Button></div>
    </> : null}
  </section>;
}
