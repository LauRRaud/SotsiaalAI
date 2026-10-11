"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";

// Vastuse tagasiside põhjused haldurile (kasutaja näeb neid vestluse kataloogist, chat.answer_feedback.reason_*).
const ANSWER_REASONS = {
  unanswered: { et: "Ei vastanud küsimusele", en: "Didn't answer the question" },
  wrong_or_outdated: { et: "Vale või vananenud", en: "Wrong or outdated" },
  unclear: { et: "Raske aru saada", en: "Hard to understand" },
  other: { et: "Muu", en: "Other" }
};
// Allika veateate põhjused haldurile (kasutaja näeb neid kataloogist, chat.sources.report_*).
const SOURCE_REASONS = {
  outdated: { et: "Info on aegunud", en: "Information is outdated" },
  wrong_content: { et: "Sisu ei vasta", en: "Content does not match" },
  broken_link: { et: "Link ei avane", en: "Link does not open" },
  wrong_source: { et: "Vale allikas", en: "Wrong source" },
  other: { et: "Muu", en: "Other" }
};

/** Üks teadete järjekord: avatud teadete laadimine ja lahendatuks märkimine auditi märkusega. */
function useFeedbackQueue(endpoint) {
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [notes, setNotes] = useState({});

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch(`${endpoint}?status=OPEN`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error("load_failed");
      setItems(payload.items || []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  const resolve = useCallback(async item => {
    const resolutionNote = String(notes[item.id] || "").trim();
    if (!resolutionNote) return;
    setState(`resolving:${item.id}`);
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionNote })
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error("resolve_failed");
      setItems(current => current.filter(entry => entry.id !== item.id));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [endpoint, notes]);

  const setNote = useCallback((id, value) => setNotes(current => ({ ...current, [id]: value })), []);
  return { items, state, notes, setNote, load, resolve };
}

function QueueStatus({ queue, et, emptyText }) {
  return (
    <>
      {queue.state === "loading" ? <p>{et ? "Laadin…" : "Loading…"}</p> : null}
      {queue.state === "error" ? <p role="alert">{et ? "Toiming ebaõnnestus." : "The action failed."}</p> : null}
      {queue.state !== "loading" && queue.items.length === 0 ? <p>{emptyText}</p> : null}
    </>
  );
}

// Teade kustub 30 päeva pärast saatmist, ka lahendamata: järjekord ütleb kuupäeva, et miski ei kaoks märkamatult.
function ExpiryNote({ item, et }) {
  if (!item.expiresAt) return null;
  const date = new Intl.DateTimeFormat(et ? "et-EE" : "en-GB", { dateStyle: "medium" }).format(new Date(item.expiresAt));
  return <span>{et ? `Kustub ${date}` : `Deleted on ${date}`}</span>;
}

function ResolveControls({ queue, item, et }) {
  const resolving = queue.state === `resolving:${item.id}`;
  return (
    <>
      <label>
        <span>{et ? "Lahenduse auditi märkus" : "Resolution audit note"}</span>
        <textarea rows={2} maxLength={1000} value={queue.notes[item.id] || ""} onChange={event => queue.setNote(item.id, event.target.value)} />
      </label>
      <Button type="button" onClick={() => queue.resolve(item)} disabled={!String(queue.notes[item.id] || "").trim() || resolving}>
        {resolving ? (et ? "Lahendan…" : "Resolving…") : (et ? "Märgi lahendatuks" : "Resolve")}
      </Button>
    </>
  );
}

export default function RagAdminSourceFeedbackScreen({ locale = "en" }) {
  const et = String(locale).startsWith("et");
  const answers = useFeedbackQueue("/api/admin/answer-feedback");
  const sources = useFeedbackQueue("/api/admin/source-feedback");
  const formatTime = value => new Intl.DateTimeFormat(et ? "et-EE" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  return (
    <div className="ra-grid" aria-busy={answers.state === "loading" || sources.state === "loading" ? "true" : "false"}>
      <section className="ra-card ra-col-12">
        <div className="ra-card-head">
          <h2>{et ? "Vastuste tagasiside" : "Answer feedback"}</h2>
          <Button type="button" size="sm" onClick={answers.load}>{et ? "Värskenda" : "Refresh"}</Button>
        </div>
        <p>
          {et
            ? "Inimene andis vestluses vastuse kohta tagasisidet. Küsimus ja vastus on näha seni, kuni vestlus on alles; pöörde tunnuse järgi saab pöörde kirjest lugeda, miks vastus selline tuli. Teade kustub 30 päeva pärast saatmist, ka lahendamata."
            : "A person gave feedback about an answer in the chat. The question and the answer are shown while the conversation exists; the turn id leads to the turn's record, which tells why the answer came out as it did. A report is deleted 30 days after it was sent, resolved or not."}
        </p>
        <QueueStatus queue={answers} et={et} emptyText={et ? "Avatud tagasisidet ei ole." : "There is no open feedback."} />
        <div className="ra-source-feedback-list">
          {answers.items.map(item => (
            <article key={item.id} className="ra-source-feedback-item">
              <div>
                <strong>{ANSWER_REASONS[item.category]?.[et ? "et" : "en"] || item.category}</strong>
                <span>{et ? "Pööre" : "Turn"}</span>
                <code>{item.turnId}</code>
                <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
                <ExpiryNote item={item} et={et} />
              </div>
              {item.note ? <p className="ra-answer-feedback-text">{item.note}</p> : null}
              {item.question || item.answer ? (
                <details>
                  <summary>{et ? "Küsimus ja vastus" : "Question and answer"}</summary>
                  {item.question ? <p className="ra-answer-feedback-text"><strong>{et ? "Küsimus: " : "Question: "}</strong>{item.question}</p> : null}
                  {item.answer ? <p className="ra-answer-feedback-text"><strong>{et ? "Vastus: " : "Answer: "}</strong>{item.answer}</p> : null}
                </details>
              ) : (
                <p>{et ? "Küsimust ja vastust ei saa näidata: vestlus on kustutatud või aegunud, või jäi pööre vastuseta." : "The question and the answer cannot be shown: the conversation was deleted or expired, or the turn got no answer."}</p>
              )}
              <ResolveControls queue={answers} item={item} et={et} />
            </article>
          ))}
        </div>
      </section>
      <section className="ra-card ra-col-12">
        <div className="ra-card-head">
          <h2>{et ? "Allikate veateated" : "Source error reports"}</h2>
          <Button type="button" size="sm" onClick={sources.load}>{et ? "Värskenda" : "Refresh"}</Button>
        </div>
        <p>
          {et
            ? "Inimene teatas allikate paneelis ühe vastuse ühe allika veast. Dokumendi tunnuse järgi leiab allika korpusest; pööre ja viide ütlevad, millises vastuses seda kasutati. Teade kustub 30 päeva pärast saatmist, ka lahendamata."
            : "A person reported an error of one source of one answer in the sources panel. The document id finds the source in the corpus; the turn and the reference tell which answer used it. A report is deleted 30 days after it was sent, resolved or not."}
        </p>
        <QueueStatus queue={sources} et={et} emptyText={et ? "Avatud teateid ei ole." : "There are no open reports."} />
        <div className="ra-source-feedback-list">
          {sources.items.map(item => (
            <article key={item.id} className="ra-source-feedback-item">
              <div>
                <strong>{SOURCE_REASONS[item.category]?.[et ? "et" : "en"] || item.category}</strong>
                {item.sourceTitle ? <span>{item.sourceTitle}</span> : null}
                <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
                <ExpiryNote item={item} et={et} />
              </div>
              <div>
                <span>{et ? "Dokument" : "Document"}</span>
                <code>{item.sourceId}</code>
                {item.turnId ? (
                  <>
                    <span>{et ? "Pööre" : "Turn"}</span>
                    <code>{item.turnId}</code>
                    <span>{item.sourceRef}</span>
                  </>
                ) : null}
              </div>
              {item.note ? <p className="ra-answer-feedback-text">{item.note}</p> : null}
              <ResolveControls queue={sources} item={item} et={et} />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
