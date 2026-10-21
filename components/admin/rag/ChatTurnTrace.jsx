import { fill, getChatTraceCopy } from "./chatTraceCopy";

// The admin's view of one chat turn (lib/rag-v2/pilot/turn-trace.js gives the data). A server component: no state.
function dateTime(value, locale) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }).format(date) : "—";
}
const number = (value, digits = 4) => (Number.isFinite(value) ? value.toFixed(digits) : "—");

function channelName(name, copy) {
  if (name === "lexical") return copy.channels.lexical;
  if (name === "vector") return copy.channels.vector;
  const variant = /^vector_(\d+)$/.exec(name);
  if (variant) return fill(copy.channels.vectorN, { n: variant[1] });
  return name.startsWith("reserve") ? `${copy.channels.reserve} (${name})` : name;
}
function Channels({ ranks, contributions, copy }) {
  const names = Object.keys(ranks || {});
  if (!names.length) return <span>{copy.fields.none}</span>;
  return <span>{names.map(name => `${channelName(name, copy)} ${ranks[name]}${Number.isFinite(contributions?.[name]) ? ` (${number(contributions[name])})` : ""}`).join(" · ")}</span>;
}
function reasonText(reason, copy) {
  const key = reason.type === "cross_reference" && reason.named_act ? "cross_reference_named" : reason.type;
  const base = copy.reasons[key] || reason.type;
  const extra = [reason.from ? fill(copy.from, { ref: reason.from }) : null, reason.section ? `§ ${reason.section}` : null,
    Number.isFinite(reason.score) ? `${reason.score}` : null].filter(Boolean);
  return extra.length ? `${base} (${extra.join(", ")})` : base;
}
function Row({ label, children }) {
  return <tr><th scope="row">{label}</th><td>{children}</td></tr>;
}
function Json({ value }) {
  return <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(value, null, 2)}</pre>;
}

export default function ChatTurnTrace({ trace, locale }) {
  const copy = getChatTraceCopy(locale), f = copy.fields, q = trace.question;
  const limits = trace.profile?.limits || {};
  return (
    <div className="space-y-6" data-chat-trace={trace.version}>
      {q.lean ? <p role="note">{fill(copy.lean, { at: dateTime(q.lean.at, locale) })}</p> : null}
      {!q.lean && !trace.laneAudit ? <p role="note">{copy.noLaneAudit}</p> : null}

      <section className="ra-card" aria-labelledby="trace-question">
        <h2 id="trace-question">{copy.sections.question}</h2>
        <table><tbody>
          <Row label={f.asked}>{q.text || f.none}</Row>
          {q.searchText && q.searchText !== q.text ? <Row label={f.searchText}>{q.searchText}</Row> : null}
          <Row label={f.role}>{q.role || f.none}</Row>
          <Row label={f.language}>{q.language || f.none}</Row>
          <Row label={f.time}>{dateTime(q.createdAt, locale)}</Row>
          <Row label={f.state}>{q.state || f.none}</Row>
          {q.failure ? <Row label={f.failure}><Json value={q.failure} /></Row> : null}
          <Row label={f.prompt}>{q.promptVersion || f.none}</Row>
          <Row label={f.profile}>{q.profile || f.none}</Row>
          <Row label={f.plan}>{q.plan || f.none}</Row>
          <Row label={f.generation}>{q.generation || f.none}</Row>
        </tbody></table>
      </section>

      <section className="ra-card" aria-labelledby="trace-plan">
        <h2 id="trace-plan">{copy.sections.plan}</h2>
        {trace.plan ? (
          <table><tbody>
            {trace.plan.greeting ? <Row label={f.state}>{f.greeting}</Row> : null}
            {trace.plan.thanks ? <Row label={f.state}>{f.thanks}</Row> : null}
            {trace.plan.assistantQuestion ? <Row label={f.state}>{f.assistantQuestion}</Row> : null}
            <Row label={f.variants}>{trace.plan.queries.length ? <ol>{trace.plan.queries.map(text => <li key={text}>{text}</li>)}</ol> : f.none}</Row>
            <Row label={f.plannedPlaces}>{trace.plan.plannedPlaces.length ? trace.plan.plannedPlaces.map(place => [place.name, place.quote && `„${place.quote}”`, place.person].filter(Boolean).join(" ")).join("; ") : f.none}</Row>
            <Row label={f.places}>{trace.plan.places.length ? <Json value={trace.plan.places} /> : f.none}</Row>
            <Row label={f.person}>{trace.plan.person ? <Json value={trace.plan.person} /> : f.none}</Row>
            <Row label={f.planLanguage}>{trace.plan.language ? <Json value={trace.plan.language} /> : f.none}</Row>
            <Row label={f.failures}>{trace.plan.failures.length ? trace.plan.failures.map(item => `${item.stage}: ${item.code}`).join(", ") : f.none}</Row>
          </tbody></table>
        ) : <p>{f.none}</p>}
      </section>

      <section className="ra-card" aria-labelledby="trace-lanes">
        <h2 id="trace-lanes">{copy.sections.lanes}</h2>
        <table>
          <thead><tr><th>{f.lane}</th><th>{f.laneState}</th><th>{f.refs}</th><th>{f.counts}</th><th>{f.leftOut}</th></tr></thead>
          <tbody>{trace.lanes.map(lane => (
            <tr key={lane.key}>
              <td>{lane.key} ({lane.kind})</td><td>{lane.state}</td><td>{lane.refs.join(", ") || f.none}</td>
              <td>{lane.candidateCounts ? Object.entries(lane.candidateCounts).map(([name, count]) => `${channelName(name, copy)}: ${Array.isArray(count) ? count.length : count}`).join(" · ") : f.none}</td>
              <td>{lane.leftOut && Object.keys(lane.leftOut).length ? Object.entries(lane.leftOut).map(([reason, count]) => `${copy.leftOutReasons[reason] || reason}: ${count}`).join(" · ") : f.none}</td>
            </tr>
          ))}</tbody>
        </table>
        {trace.records ? (
          <details><summary>{f.records} ({trace.records.region || f.none}, {trace.records.listed ?? 0}/{trace.records.catalogue ?? 0})</summary>
            <ul>{trace.records.entries.map(entry => <li key={entry.key}>{entry.key} · {entry.kind} · {entry.detail} · {entry.title || f.none}</li>)}</ul>
          </details>
        ) : null}
      </section>

      <section className="ra-card" aria-labelledby="trace-pool">
        <h2 id="trace-pool">{copy.sections.pool}</h2>
        {trace.pool.length ? (
          <table>
            <thead><tr><th>{f.rank}</th><th>{f.title}</th><th>{f.score}</th><th>{f.channels}</th><th>{f.pick}</th><th>{f.finalRef}</th></tr></thead>
            <tbody>{trace.pool.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}{item.reserved ? ` (${f.reserved})` : ""}</td>
                <td><strong>{item.title || f.none}</strong>{item.section ? ` › ${item.section}` : ""}{item.validFrom ? ` · ${item.validFrom}` : ""}{item.sourceType || item.authority ? <><br /><small>{[item.sourceType, item.authority].filter(Boolean).join(" · ")}</small></> : null}{item.lead ? <><br /><small>{item.lead}</small></> : null}</td>
                <td>{number(item.score)}</td>
                <td><Channels ranks={item.ranks} contributions={item.contributions} copy={copy} /></td>
                <td>{item.pick ? `#${item.pick}` : f.notPicked}</td>
                <td>{item.ref || (item.leftOut ? copy.leftOutReasons[item.leftOut] || item.leftOut : f.none)}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p>{f.none}</p>}
      </section>

      <section className="ra-card" aria-labelledby="trace-evidence">
        <h2 id="trace-evidence">{copy.sections.evidence}</h2>
        {trace.evidence.map(item => (
          <details key={item.ref}>
            <summary>
              <strong>{item.ref}</strong> {item.cited ? `· ${f.cited}` : ""} · {reasonText(item.reason, copy)} · {item.title || f.none}{item.provision ? ` ${item.provision}` : ""}
            </summary>
            <table><tbody>
              <Row label={f.source}>{[item.sourceType, item.authority, item.date, item.web].filter(Boolean).join(" · ") || f.none}</Row>
              <Row label={f.heading}>{item.heading || f.none}</Row>
              <Row label={f.lane}>{item.lane || f.none}</Row>
              <Row label={f.score}>{number(item.score)}</Row>
              <Row label={f.channels}><Channels ranks={item.ranks} contributions={item.contributions} copy={copy} /></Row>
              <Row label={f.text}><p className="whitespace-pre-wrap">{item.text || f.none}</p></Row>
            </tbody></table>
          </details>
        ))}
      </section>

      <section className="ra-card" aria-labelledby="trace-additions">
        <h2 id="trace-additions">{copy.sections.additions}</h2>
        {trace.additions && Object.keys(trace.additions).length ? (
          <table><tbody>{Object.entries(trace.additions).map(([name, audit]) => (
            <Row key={name} label={copy.additions[name] || name}><Json value={audit} /></Row>
          ))}</tbody></table>
        ) : <p>{f.none}</p>}
      </section>

      <section className="ra-card" aria-labelledby="trace-answer">
        <h2 id="trace-answer">{copy.sections.answer}</h2>
        {trace.answer ? (
          <table><tbody>
            <Row label={f.kind}>{trace.answer.kind || f.none}</Row>
            <Row label={f.blocks}>{trace.answer.blocks.length ? <ol>{trace.answer.blocks.map((block, index) => <li key={index}>{block.text} <small>[{block.refs.join(", ")}]</small></li>)}</ol> : f.none}</Row>
            <Row label={f.limitations}>{trace.answer.limitations.length ? <ul>{trace.answer.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul> : f.none}</Row>
            <Row label={f.clarification}>{trace.answer.clarification || f.none}</Row>
            {trace.answer.repairs?.length ? <Row label={f.repairs}><Json value={trace.answer.repairs} /></Row> : null}
          </tbody></table>
        ) : <p>{f.none}</p>}
      </section>

      <section className="ra-card" aria-labelledby="trace-request">
        <h2 id="trace-request">{copy.sections.request}</h2>
        {trace.request ? (
          <>
            <table><tbody>
              <Row label={f.model}>{trace.request.model || f.none}</Row>
              <Row label={f.reasoning}>{trace.request.reasoning || f.none}</Row>
              <Row label={f.maxOutput}>{trace.request.maxOutput ?? f.none}</Row>
              <Row label={f.evidenceChars}>{trace.request.evidenceChars}</Row>
            </tbody></table>
            <details><summary>{f.instructions}</summary><p className="whitespace-pre-wrap text-xs">{trace.request.instructions || f.none}</p></details>
            <details><summary>{f.developer}</summary>{trace.request.developer.length ? trace.request.developer.map((text, index) => <p key={index} className="whitespace-pre-wrap text-xs">{text}</p>) : <p>{f.none}</p>}</details>
            <details><summary>{f.modelContext}</summary><Json value={trace.request.modelContext} /></details>
          </>
        ) : <p>{f.none}</p>}
      </section>

      <section className="ra-card" aria-labelledby="trace-cost">
        <h2 id="trace-cost">{copy.sections.cost}</h2>
        <table>
          <thead><tr><th>{f.stage}</th><th>{f.state}</th><th>{f.input}</th><th>{f.output}</th><th>{f.usd}</th></tr></thead>
          <tbody>{trace.stages.map((stage, index) => (
            <tr key={`${stage.stage}-${index}`}><td>{copy.stages[stage.stage] || stage.stage}</td><td>{stage.state || f.none}</td>
              <td>{stage.input ?? f.none}</td><td>{stage.output ?? f.none}</td><td>{Number.isFinite(stage.nanoUsd) ? (stage.nanoUsd / 1e9).toFixed(6) : f.none}</td></tr>
          ))}</tbody>
        </table>
        {trace.phases ? <p>{f.phases}: {Object.entries(trace.phases).map(([name, ms]) => `${name} ${ms}`).join(" · ")}</p> : null}
      </section>

      <section className="ra-card" aria-labelledby="trace-explain">
        <h2 id="trace-explain">{copy.sections.explain}</h2>
        {trace.profile ? (
          <>
            {copy.explain.map((text, index) => (
              <p key={index}>{fill(text, { candidates: limits.candidates, rrf: trace.profile.rrf, vector: trace.profile.weights?.vector ?? 1, lexical: trace.profile.weights?.lexical ?? 1,
                poolPerDocument: limits.poolPerDocument ?? 30, topK: limits.topK, contextTokens: limits.contextTokens, referenceAdditions: limits.referenceAdditions ?? 0,
                namedActAdditions: limits.namedActAdditions ?? 0, expansionContextTokens: limits.expansionContextTokens ?? 0, finalLimit: trace.profile.finalLimit, perDocument: limits.perDocument })}</p>
            ))}
            <details><summary>{f.profile}: {trace.profile.id}</summary><Json value={trace.profile} /></details>
          </>
        ) : <p>{f.none}</p>}
      </section>
    </div>
  );
}
