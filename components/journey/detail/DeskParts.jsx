"use client";

/**
 * Avatud Teekonna laua osad, mille andmed ja päringud on lehel: olukord, soov,
 * saadetud ja vastused, eelpöördumine, abi otsimine, teenuse jätkumine,
 * teekonnarada ning paberleht ja andmed.
 *
 * MIKS. Avatud Teekond oli üks pikk veerg (1536 × 640 aknas 6091 px sisu 522 px
 * paneelis): iga funktsioon seisis eelmise all, pealkirjad paneelil, nupud
 * venitatud või murdunud. Nüüd on iga osa üks asi ja selle sees vahetuvad
 * väikesed vaated kohapeal (lugemine, vorm, eelvaade); osa sees olevad vaated on
 * ühelaiused lahtrid, mitte uued laua osad.
 *
 * Siin on ainult kuju ja osa enda vaate olek (mis vaade on ees, pooleli vorm).
 * Otsused on failis ./journeyDesk.js; andmed ja päringud lehel
 * (`../JourneyDetail.jsx`). Sammud, hinnang ja paus on omaette failides
 * (`../JourneySteps.jsx`, `../JourneyAssessment.jsx`, `../JourneyClosure.jsx`),
 * sest need teevad oma päringud ise.
 *
 * Kujundus: detail.module.css (siin kõrval) ja ../journey.module.css.
 */

import { useEffect, useRef, useState } from "react";

import ChoiceChips from "@/components/stage/ChoiceChips";
import ChoiceRow from "@/components/stage/ChoiceRow";
import CheckCard from "@/components/stage/CheckCard";
import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import { JOURNEY_LIST_LIMITS, JOURNEY_PRIMARY_PATHS, JOURNEY_TEXT_LIMITS } from "@/lib/journey/constants";
import { journeyRoadmap } from "@/lib/journey/roadmap";

import JourneyPaperSheet from "../JourneyPaperSheet";
import shared from "../journey.module.css";
import { Cells, Chip, Counter, Facts, LineField, OwnText, SMALL, TwoPress, blockRepeatEnter, footNote, ignoreKeyRepeat, useStageRemeasure, useSwapFocus } from "./DeskBits";
import styles from "./detail.module.css";
import {
  CONFIRM_MS,
  continuityForm,
  continuityOf,
  dayOf,
  deviceStatusKey,
  formDirty,
  hasContinuity,
  journeyWish,
  linkedState,
  listItems,
  pressTooSoon,
  previewNoteKey,
  rebaseForm,
  situationForm,
  situationProblemKey,
  situationReadTabs,
  textToLines
} from "./journeyDesk";

/* Osa teatab lehele, kas selles on salvestamata teksti (lahkumise värav). */
function useReportDirty(desk, dirty) {
  const setDirty = desk?.setDirty;
  useEffect(() => {
    setDirty?.(dirty);
    return () => setDirty?.(false);
  }, [dirty, setDirty]);
}

/* Teekond pandi kõrvale (paus või lõpetamine teises osas) ajal, mil siin oli vorm
   lahti: vorm sulgub, muidu jääks see pärast uuesti avamist vana tekstiga ette
   ja salvestamata teksti märk hoiaks lahkumist kinni. */
function useCloseWhenArchived(archived, close) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (archived) closeRef.current();
  }, [archived]);
}

/* Vaate ilmumise hetk: topeltklõpsu teine vajutus ei saada äsja ilmunud vormi. */
function useShownAt(key) {
  const at = useRef(0);
  useEffect(() => {
    at.current = Date.now();
  }, [key]);
  return at;
}

/** „Loobu", mis muudetud vormil küsib teist vajutust samal nupul. */
function useDiscard(dirty, onDiscard) {
  const [armed, setArmed] = useState(false);
  const askedAt = useRef(0);
  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);
  const press = () => {
    if (dirty && !armed) {
      askedAt.current = Date.now();
      setArmed(true);
      return;
    }
    if (dirty && pressTooSoon(askedAt.current)) return;
    setArmed(false);
    onDiscard();
  };
  return { armed, press, clear: () => setArmed(false) };
}

function DiscardButton({ t, discard }) {
  return (
    <Button {...SMALL} className={discard.armed ? shared.armed : undefined} onKeyDown={ignoreKeyRepeat} onClick={discard.press}>
      {discard.armed ? t("journey.desk.discard_confirm") : t("journey.actions.decline")}
    </Button>
  );
}

/** Loetav loend pealkirjaga: read üksteise all, ilma kastita. */
function Lines({ title, items, emptyText }) {
  return (
    <div className={styles.group}>
      <p className={styles.groupTitle}>{title}</p>
      {items.length ? (
        <ul className={styles.lines}>
          {items.map((item, index) => (
            <li key={`${index}-${item}`} className={styles.lineItem}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className={shared.small}>{emptyText}</p>
      )}
    </div>
  );
}

/* Loendiväli tekstina: üks rida on üks kirje (teemad, puuduolev info jt). */
function ListField({ t, label, value, onChange, maxItems }) {
  return (
    <TextAreaField
      label={label}
      hint={t("journey.labels.item_limit_count", { current: textToLines(value).length, limit: maxItems, characters: JOURNEY_TEXT_LIMITS.shortItem })}
      value={value}
      onChange={onChange}
      rows={4}
    />
  );
}

/* ---------- Olukord -------------------------------------------------------------- */

/**
 * Olukord: mida inimene kirjeldas ja mis platvorm sellest kokku pani. Muutmise
 * vorm on neljas osas; server salvestab kõik ühe päringuga, seega salvestab
 * „Salvesta muudatused" kõigi osade muudatused korraga ja vaade ütleb seda.
 *
 * `onSave(form)` tagastab, kas salvestamine õnnestus.
 */
export function SituationPart({ t, journey, archived, lifeDomains, busy, error, onSave, desk }) {
  const base = situationForm(journey);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(base);
  const [tab, setTab] = useState("text");
  const [readTab, setReadTab] = useState("text");
  /* Vaade, mida enam ei ole (puuduolev info kustutati ära), langeb kirjeldusele. */
  const readTabs = situationReadTabs(journey);
  const shownTab = readTabs.includes(readTab) ? readTab : "text";
  const [problem, setProblem] = useState("");
  /* Muudetud või mitte: võrdlus Teekonna endaga, mitte avamisel võetud koopiaga. */
  const dirty = editing && !archived && formDirty(form, base);
  useReportDirty(desk, dirty);
  useCloseWhenArchived(archived, () => setEditing(false));
  /* Teine osa salvestas Teekonna ajal, mil see vorm oli lahti: puutumata väljad
     võtavad uue väärtuse (vt `rebaseForm`). */
  const openedFrom = useRef(base);
  const stamp = journey?.updatedAt || "";
  useEffect(() => {
    const fresh = situationForm(journey);
    setForm((current) => rebaseForm(current, openedFrom.current, fresh));
    openedFrom.current = fresh;
    /* Ainult Teekonna muutumisel: `journey` ise on igal joonistusel uus objekt. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);
  const view = editing && !archived ? `edit:${tab}` : `read:${readTab}`;
  useStageRemeasure(`${view}:${problem}:${error}`);
  const rootRef = useSwapFocus(editing && !archived ? "edit" : "read");
  const shownAt = useShownAt(editing);
  const discard = useDiscard(dirty, () => {
    setEditing(false);
    setProblem("");
  });
  const set = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setProblem("");
    discard.clear();
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy || pressTooSoon(shownAt.current)) return;
    const key = situationProblemKey(form);
    setProblem(key);
    if (key) {
      /* Puudu on pealkiri või kirjeldus: need on esimeses osas. */
      setTab("text");
      return;
    }
    if (await onSave(form)) setEditing(false);
  };

  const title = t("journey.desk.parts.situation.title");
  if (editing && !archived) {
    const quiet = discard.armed ? t("journey.desk.discard_note") : t("journey.desk.situation.save_all");
    return (
      <div className={styles.swap} ref={rootRef}>
        <Form className={styles.form} validate={false} onSubmit={submit} onKeyDown={blockRepeatEnter}>
          <StepPanel
            title={title}
            note={footNote(discard.armed ? null : problem ? { text: t(problem), tone: "risk" } : error ? { text: error, tone: "risk" } : null, quiet)}
            actions={
              <>
                <DiscardButton t={t} discard={discard} />
                <Button type="submit" size="sm" variant="primary" glow={desk?.glow !== false} aria-busy={busy ? "true" : undefined}>
                  {t("journey.actions.save_changes")}
                </Button>
              </>
            }
          >
            <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
              <Cells
                label={t("journey.desk.situation.tabs.label")}
                options={["text", "direction", "topics", "notes"].map((value) => ({ value, label: t(`journey.desk.situation.tabs.${value}`) }))}
                value={tab}
                onChange={setTab}
              />
              {tab === "text" ? (
                <div className={styles.fields}>
                  <LineField t={t} label={t("journey.labels.title")} size="lg" value={form.title} max={JOURNEY_TEXT_LIMITS.title} autoFocus onChange={set("title")} />
                  <TextAreaField label={t("journey.labels.summary")} value={form.summary} onChange={set("summary")} rows={5} maxLength={JOURNEY_TEXT_LIMITS.summary} />
                  <Counter t={t} value={form.summary} limit={JOURNEY_TEXT_LIMITS.summary} />
                </div>
              ) : null}
              {tab === "direction" ? (
                <ChoiceRow
                  label={t("journey.labels.primary_path")}
                  options={JOURNEY_PRIMARY_PATHS.map((value) => ({ value, label: t(`journey.primary_paths.${value}`) }))}
                  value={form.primaryPath || "UNKNOWN"}
                  onChange={set("primaryPath")}
                  columns={3}
                  keepColumns
                />
              ) : null}
              {tab === "topics" ? (
                <div className={styles.columns}>
                  <ListField t={t} label={t("journey.labels.domains")} value={form.domains} onChange={set("domains")} maxItems={JOURNEY_LIST_LIMITS.domains} />
                  <ListField t={t} label={t("journey.labels.missing_info")} value={form.missingInfo} onChange={set("missingInfo")} maxItems={JOURNEY_LIST_LIMITS.missingInfo} />
                </div>
              ) : null}
              {tab === "notes" ? (
                <div className={styles.columns}>
                  <ListField t={t} label={t("journey.labels.risk_signals")} value={form.riskSignals} onChange={set("riskSignals")} maxItems={JOURNEY_LIST_LIMITS.riskSignals} />
                  <ListField t={t} label={t("journey.labels.suggested_actions")} value={form.suggestedActions} onChange={set("suggestedActions")} maxItems={JOURNEY_LIST_LIMITS.suggestedActions} />
                </div>
              ) : null}
            </div>
          </StepPanel>
        </Form>
      </div>
    );
  }

  return (
    <div className={styles.swap} ref={rootRef}>
      <StepPanel
        title={title}
        question={journey.title}
        note={footNote(error ? { text: error, tone: "risk" } : null, archived ? t("journey.messages.archived_readonly") : "")}
        actions={
          archived ? null : (
            <Button
              type="button"
              size="sm"
              variant="primary"
              glow={desk?.glow !== false}
              data-edit-situation="1"
              onClick={() => {
                const fresh = situationForm(journey);
                openedFrom.current = fresh;
                setForm(fresh);
                setTab("text");
                setEditing(true);
              }}
            >
              {t("journey.actions.edit")}
            </Button>
          )
        }
      >
        <div className={shared.stack}>
          <Cells
            label={t("journey.desk.situation.read_tabs.label")}
            options={readTabs.map((value) => ({ value, label: t(`journey.desk.situation.read_tabs.${value}`) }))}
            value={shownTab}
            onChange={setReadTab}
          />
          {shownTab === "text" ? <OwnText text={journey.summary} /> : null}
          {shownTab === "noticed" ? (
            <>
              <Facts
                items={[
                  { key: "path", label: t("journey.labels.primary_path"), value: t(`journey.primary_paths.${journey.primaryPath || "UNKNOWN"}`) },
                  { key: "domains", label: t("journey.labels.domains"), value: listItems(journey.domains).join(", ") },
                  { key: "life", label: t("journey.review.life_domains"), value: lifeDomains.join(", ") }
                ]}
              />
              {/* Platvormi pakutud sammud on osas „Järgmised sammud" (sealt saab
                  need sammuks võtta): siin neid teist korda ei loetleta. */}
              <Lines title={t("journey.labels.risk_signals")} items={listItems(journey.riskSignals)} emptyText={t("journey.messages.empty_risk_signals")} />
            </>
          ) : null}
          {/* Omaette vaade ja täislaiuses: küsimus mahub ühele reale. */}
          {shownTab === "missing" ? <Lines title={t("journey.labels.missing_info")} items={listItems(journey.missingInfo)} /> : null}
        </div>
      </StepPanel>
    </div>
  );
}

/* ---------- Soov ------------------------------------------------------------------- */

/**
 * Inimese soov tema enda sõnadega. Omaette väli, mitte osa kokkuvõttest:
 * kokkuvõtte korrastab platvorm, soovi ei puuduta keegi peale inimese enda.
 * Jagamisse läheb see ainult siis, kui inimene valib „inimese soov".
 */
export function WishPart({ t, journey, archived, busy, error, onSave, desk }) {
  const wish = journeyWish(journey);
  const limit = JOURNEY_TEXT_LIMITS.personWish;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(wish);
  const dirty = editing && !archived && text !== wish;
  useReportDirty(desk, dirty);
  useCloseWhenArchived(archived, () => setEditing(false));
  const shown = editing && !archived ? "edit" : "read";
  useStageRemeasure(`${shown}:${error}`);
  const rootRef = useSwapFocus(shown);
  const shownAt = useShownAt(shown);
  const discard = useDiscard(dirty, () => setEditing(false));

  const submit = async (event) => {
    event.preventDefault();
    if (busy || pressTooSoon(shownAt.current)) return;
    if (await onSave(text)) setEditing(false);
  };

  const title = t("journey.wish.title");
  if (shown === "edit") {
    return (
      <div className={styles.swap} ref={rootRef}>
        <Form className={styles.form} validate={false} onSubmit={submit} onKeyDown={blockRepeatEnter}>
          <StepPanel
            title={title}
            note={footNote(discard.armed ? null : error ? { text: error, tone: "risk" } : null, discard.armed ? t("journey.desk.discard_note") : "")}
            actions={
              <>
                <DiscardButton t={t} discard={discard} />
                <Button type="submit" size="sm" variant="primary" glow={desk?.glow !== false} aria-busy={busy ? "true" : undefined}>
                  {t("journey.wish.save")}
                </Button>
              </>
            }
          >
            <div data-autofocus="" aria-busy={busy ? "true" : undefined}>
              <TextAreaField
                label={t("journey.wish.label")}
                hint={t("journey.wish.hint")}
                value={text}
                onChange={(value) => {
                  setText(value);
                  discard.clear();
                }}
                rows={6}
                maxLength={limit}
              />
              <Counter t={t} value={text} limit={limit} />
            </div>
          </StepPanel>
        </Form>
      </div>
    );
  }

  return (
    <div className={styles.swap} ref={rootRef}>
      <StepPanel
        title={title}
        note={footNote(error ? { text: error, tone: "risk" } : null, archived ? t("journey.messages.archived_readonly") : t("journey.desk.wish.private"))}
        actions={
          archived ? null : (
            <Button
              type="button"
              size="sm"
              variant="primary"
              glow={desk?.glow !== false}
              data-edit-wish="1"
              onClick={() => {
                setText(wish);
                setEditing(true);
              }}
            >
              {wish ? t("journey.wish.edit") : t("journey.wish.add")}
            </Button>
          )
        }
      >
        {wish ? <OwnText text={wish} /> : <p className={shared.quiet}>{t("journey.wish.empty")}</p>}
      </StepPanel>
    </div>
  );
}

/* ---------- Saadetud ja vastused ------------------------------------------------------ */

/**
 * Seotud eelpöördumised: mis on saadetud ja mis on tagasi tulnud. Seis on SAATJA
 * silmade läbi (vt `linkedPreInquiryState`), mitte vastuvõtja töövoo seis. Rida
 * avab pöördumise enda lehel.
 *
 * `more`: { busy, onMore } või null. `related`: muud seotud asjad sõnade ridadena.
 */
export function SentPart({ t, journey, hrefOf, more, error, related, onShare }) {
  const items = Array.isArray(journey?.linkedPreInquiries) ? journey.linkedPreInquiries : [];
  useStageRemeasure(`${items.length}:${error}`);
  return (
    <StepPanel
      title={t("journey.desk.parts.sent.title")}
      lead={items.length ? undefined : t("journey.related.pre_inquiries_empty")}
      note={footNote(error ? { text: error, tone: "risk" } : null, items.length ? t("journey.desk.sent.note") : "")}
      actions={
        items.length ? null : (
          <Button {...SMALL} onClick={onShare}>
            {t("journey.pre_inquiry.open")}
          </Button>
        )
      }
    >
      <div className={shared.stack}>
        {items.length ? (
          <ul className={shared.rows}>
            {items.map((item) => {
              const state = linkedState(item);
              const topic = String(item?.topic || "").trim() || t("journey.related.pre_inquiry_untitled");
              const href = hrefOf(item);
              /* Asutus on töö lõpetanud: pöördumise ruum on ainult loetav, seega peab see olema
                 näha juba siit, mitte alles ruumis. See on rea värskeim seis ja tuleb viimase
                 vastuse kuupäeva asemele: mõlemad korraga ei mahu telefonis ühele reale (mõõdetud
                 390 px laiuses) ja märk „saaja on vastanud" jääb reale niikuinii. */
              const when = item?.workClosedAt
                ? t("journey.related.work_closed", { date: dayOf(item.workClosedAt) })
                : item?.lastReplyAt
                  ? t("journey.related.last_reply", { date: dayOf(item.lastReplyAt) })
                  : "";
              return (
                <li key={item.id} className={shared.rowItem}>
                  {/* Tavaline link (terve lehe laadimine), nagu vanal lehel: pöördumiste
                      leht loeb avatava pöördumise aadressilt oma esimesel joonistusel. */}
                  <a className={shared.row} href={href} aria-label={t("journey.desk.sent.open_named", { title: topic })}>
                    <span className={shared.rowMain}>
                      <span className={shared.rowTitle}>{topic}</span>
                      {when ? <span className={shared.rowSub}>{when}</span> : null}
                    </span>
                    <span className={shared.rowMeta}>
                      <Chip tone={state === "ANSWERED" ? "wait" : undefined}>{t(`journey.related.pre_inquiry_state.${state}`, "")}</Chip>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
        {more ? (
          <div>
            <Button {...SMALL} aria-busy={more.busy ? "true" : undefined} onClick={more.onMore}>
              {t("journey.actions.load_more")}
            </Button>
          </div>
        ) : null}
        <Facts items={related} />
      </div>
    </StepPanel>
  );
}

/* ---------- Jagamine: mida kaasa võtta ja mida saaja näeb ------------------------------- */

/**
 * Jagamise valik ja eelvaade kahe lahtrina. Valikud on ühelaiused märkelahtrid;
 * eelvaade on tekst, mille server valitud osadest kokku paneb.
 *
 * `share`: { options: [{ value, label }], selected, onToggle, previewText, previewState }
 */
function ShareBody({ t, share, tab, onTab, labels, children }) {
  const previewNote = previewNoteKey({ state: share.previewState, text: share.previewText });
  return (
    <div className={shared.stack}>
      <Cells
        label={labels.tabs}
        options={[
          { value: "choose", label: t("journey.desk.share.tabs.choose") },
          { value: "preview", label: labels.preview }
        ]}
        value={tab}
        onChange={onTab}
      />
      {tab === "choose" ? (
        <>
          <ChoiceChips label={labels.question} options={share.options} values={share.selected} onToggle={share.onToggle} columns={3} keepColumns />
          {children}
        </>
      ) : (
        <p className={styles.preview} aria-live="polite">
          {previewNote ? t(previewNote) : share.previewText}
        </p>
      )}
    </div>
  );
}

/**
 * Eelpöördumine selle Teekonna põhjal: inimene valib, mida kaasa võtab, näeb,
 * mida saaja näeks, ja jätkab pöördumise lehel. Midagi ei saadeta siit.
 *
 * `share`: valikud ja eelvaade; `ack`: { needed, checked, onChange } teise inimese
 * teabe jagamise kinnitus; `blockKey`: miks edasi minna ei saa (kataloogi võti).
 */
export function SharePart({ t, share, ack, blockKey, href, desk }) {
  const [tab, setTab] = useState("choose");
  useStageRemeasure(`${tab}:${share.options.length}:${ack.needed}:${share.previewState}:${share.previewText?.length || 0}`);
  return (
    <StepPanel
      title={t("journey.desk.parts.share.title")}
      note={blockKey ? t(blockKey) : t("journey.pre_inquiry.privacy_note")}
      actions={
        /* Tavaline link (terve lehe laadimine): pöördumiste leht loeb Teekonna ja
           valitud osad aadressilt oma esimesel joonistusel. Lehe sees liikudes
           ei oleks aadress siis veel uus ja Teekonna sisu ei tuleks kaasa. */
        <Button as="a" href={href} size="sm" variant="primary" glow={desk?.glow !== false} disabled={Boolean(blockKey)} data-share-continue="1">
          {t("journey.share.continue")}
        </Button>
      }
    >
      <ShareBody t={t} share={share} tab={tab} onTab={setTab} labels={{ tabs: t("journey.desk.share.tabs.label"), question: t("journey.share.title"), preview: t("journey.share.recipient_preview") }}>
        {ack.needed ? <CheckCard title={t("journey.share.person_context_ack")} checked={ack.checked} onChange={ack.onChange} /> : null}
      </ShareBody>
    </StepPanel>
  );
}

/* ---------- Abi otsimine --------------------------------------------------------------- */

function LinkButton({ href, children, primary = false, glow = true, ...rest }) {
  return (
    <Button as="a" href={href} size="sm" variant={primary ? "primary" : "secondary"} glow={primary ? glow : false} {...rest}>
      {children}
    </Button>
  );
}

/**
 * Abi otsimine: teenusekaart selle Teekonna teemadega ning, kui kirjeldus neile
 * viitab, abivahendus (abipakkumised ja abisoov), abivahendid ja tervisekontakt.
 * Iga tee on omaette vaade ühelaiuste lahtrite taga. Abisoovi jaoks valib
 * inimene, mida kaasa võtab; kuulutus sünnib alles järgmisel lehel.
 *
 * `kinds`: vaated, mis sellel Teekonnal on. `initial`: aadressilt tulnud vaade.
 */
export function HelpPart({ t, kinds, initial, map, mediation, devices, health, requestShare, links, error, onShare, desk }) {
  const [kind, setKind] = useState(initial && kinds.includes(initial) ? initial : kinds[0]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestTab, setRequestTab] = useState("choose");
  const shown = kinds.includes(kind) ? kind : kinds[0];
  const view = requestOpen ? "request" : shown;
  /* Abisoovi eelvaadet küsitakse serverilt ainult siis, kui see vaade on ees. */
  const onRequestView = requestShare.onView;
  useEffect(() => {
    onRequestView?.(requestOpen);
  }, [onRequestView, requestOpen]);
  useStageRemeasure(`${view}:${requestTab}:${health.draftOpen}:${mediation.loading}:${requestShare.previewState}:${requestShare.previewText?.length || 0}`);
  /* Lahtri vahetus fookust ei liiguta (lahtririda on raadiorühm ja nooleklahv
     peab selles edasi liikuma): fookus liigub, kui abisoovi vaade avaneb või
     sulgub ja kui küsimuste mustand ilmub või kaob. */
  const rootRef = useSwapFocus(requestOpen ? "request" : `kinds:${shown === "health" && health.draftOpen}`);
  const glow = desk?.glow !== false;
  const title = t("journey.desk.parts.help.title");
  const cells = (
    <Cells label={t("journey.desk.help.kinds.label")} options={kinds.map((value) => ({ value, label: t(`journey.desk.help.kinds.${value}`) }))} value={shown} onChange={setKind} />
  );

  let body;
  if (view === "request") {
    body = (
      <StepPanel
        title={title}
        note={requestShare.selected.length ? t("journey.helpMediation.share.privacy") : t("journey.desk.share.need_choice")}
        actions={
          <>
            <Button {...SMALL} onClick={() => setRequestOpen(false)}>
              {t("journey.desk.back")}
            </Button>
            <LinkButton href={requestShare.href} primary glow={glow} disabled={!requestShare.selected.length} data-request-continue="1">
              {t("journey.helpMediation.share.continue")}
            </LinkButton>
          </>
        }
      >
        <ShareBody
          t={t}
          share={requestShare}
          tab={requestTab}
          onTab={setRequestTab}
          labels={{ tabs: t("journey.desk.share.tabs.label"), question: t("journey.helpMediation.share.title"), preview: t("journey.desk.help.request_preview") }}
        />
      </StepPanel>
    );
  } else if (shown === "mediation") {
    body = (
      <StepPanel
        title={title}
        note={t("journey.helpMediation.privacy")}
        actions={
          <>
            <LinkButton href={links.helpRequests}>{t("journey.helpMediation.viewRequests")}</LinkButton>
            <LinkButton href={links.createHelpOffer}>{t("journey.helpMediation.createOffer")}</LinkButton>
            {mediation.hasMatches ? <LinkButton href={links.helpOffers}>{t("journey.helpMediation.viewOffers")}</LinkButton> : null}
            <Button type="button" size="sm" variant="primary" glow={glow} data-create-request="1" onClick={() => setRequestOpen(true)}>
              {t("journey.helpMediation.createRequest")}
            </Button>
          </>
        }
      >
        <div className={shared.stack}>
          {cells}
          <p className={shared.quiet} aria-live="polite">
            {mediation.loading ? t("journey.helpMediation.checkingOffers") : mediation.hasMatches ? t("journey.helpMediation.offersFoundHint") : t("journey.helpMediation.noOffersHint")}
          </p>
          {mediation.noRegion ? <p className={shared.small}>{t("journey.helpMediation.noRegionHint")}</p> : null}
          {mediation.serviceHint ? <p className={shared.small}>{t("journey.helpMediation.serviceHint")}</p> : null}
        </div>
      </StepPanel>
    );
  } else if (shown === "devices") {
    /* Teenusekaart on sama osa esimene lahter: eraldi nuppu selle jaoks siin ei ole. */
    body = (
      <StepPanel
        title={title}
        actions={
          <>
            <LinkButton href={links.documents}>{t("journey.assistiveDevices.addDocument")}</LinkButton>
            <Button {...SMALL} data-device-request="1" onClick={() => setRequestOpen(true)}>
              {t("journey.assistiveDevices.createPracticalHelpRequest")}
            </Button>
            <Button type="button" size="sm" variant="primary" glow={glow} data-device-share="1" onClick={onShare}>
              {t("journey.pre_inquiry.open")}
            </Button>
          </>
        }
      >
        <div className={shared.stack}>
          {cells}
          <ul className={shared.rows} aria-label={t("journey.assistiveDevices.title")}>
            {devices.items.map((item) => (
              <li key={item.id} className={shared.rowItem}>
                <span className={styles.plainRow}>
                  <span className={styles.rowHead}>
                    <span className={shared.rowTitle}>{item.name}</span>
                    <Chip>{deviceStatusKey(item.status) ? t(deviceStatusKey(item.status)) : ""}</Chip>
                    {item.relatedNeedTags?.length ? <span className={styles.rowText}>{item.relatedNeedTags.join(", ")}</span> : null}
                  </span>
                  {item.supportNeed ? <span className={styles.rowText}>{item.supportNeed}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className={shared.small}>{t("journey.assistiveDevices.safetyNote")}</p>
        </div>
      </StepPanel>
    );
  } else if (shown === "health") {
    body = (
      <StepPanel
        title={title}
        note={footNote(error ? { text: error, tone: "risk" } : null, health.draftOpen ? t("journey.healthContact.noAutomaticSharing") : t("journey.healthContact.privateNote"))}
        actions={
          <>
            <LinkButton href={links.documents}>{t("journey.serviceContinuity.addDocument")}</LinkButton>
            <LinkButton href={links.preInquiry}>{t("journey.healthContact.createPreInquiry")}</LinkButton>
            {health.draftOpen ? (
              <>
                <Button {...SMALL} onClick={health.onClose}>
                  {t("journey.desk.back")}
                </Button>
                <Button {...SMALL} data-copy-health="1" onClick={health.onCopy}>
                  {health.copied ? t("journey.desk.help.copied") : t("journey.desk.help.copy")}
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" variant="primary" glow={glow} data-health-questions="1" onClick={health.onCreate}>
                {t("journey.healthContact.createQuestions")}
              </Button>
            )}
          </>
        }
      >
        <div className={shared.stack}>
          {cells}
          {health.draftOpen ? (
            <>
              <div data-autofocus="">
                <TextAreaField label={t("journey.healthContact.questionsDraftTitle")} value={health.draft} onChange={health.onChange} rows={3} />
              </div>
              {/* Hädaabi lause jääb näha ka siis, kui mustand on ees. */}
              <p className={shared.small}>{t("journey.healthContact.notMedicalAdvice")}</p>
            </>
          ) : (
            <>
              <p className={shared.quiet}>{t("journey.healthContact.description")}</p>
              <p className={shared.small}>{t("journey.healthContact.notMedicalAdvice")}</p>
            </>
          )}
        </div>
      </StepPanel>
    );
  } else {
    body = (
      <StepPanel
        title={title}
        note={t("journey.service_map.privacy_note")}
        actions={
          <LinkButton href={links.serviceMap} primary glow={glow} data-open-map="1">
            {t("journey.service_map.open")}
          </LinkButton>
        }
      >
        <div className={shared.stack}>
          {cells}
          <p className={shared.quiet}>{map.hasFilter ? t("journey.service_map.filtered_description") : t("journey.service_map.fallback_description")}</p>
          {map.hasFilter && !map.hasMunicipality ? <p className={shared.small}>{t("journey.service_map.missing_municipality")}</p> : null}
        </div>
      </StepPanel>
    );
  }

  return (
    <div className={styles.swap} ref={rootRef}>
      {body}
    </div>
  );
}

/* ---------- Teenuse jätkumine ----------------------------------------------------------- */

const YES_NO_FIELDS = Object.freeze(["hasDecisionOrPlan", "documentAttached", "kovAlreadyInvolved", "providerAlreadyInvolved"]);

/**
 * Teenuse jätkumise kontroll: kui inimesel on teenus, tugi, otsus või plaan, mis
 * võib vajada jätkumise täpsustamist. Vorm on neljas osas ja salvestatakse ühe
 * päringuga. Lõppkuupäeva väli on näha ainult siis, kui inimene ütleb, et päev on
 * teada (vanal lehel sai kuupäeva kirjutada ja see jäeti vaikselt salvestamata).
 *
 * `rules`: { missing(form), actions(form) } lehelt; `onSave(form)` tagastab, kas õnnestus.
 */
export function ContinuityPart({ t, journey, archived, busy, error, rules, onSave, links, desk }) {
  const base = continuityForm(journey);
  const saved = continuityOf(journey);
  const exists = hasContinuity(journey);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(base);
  const [tab, setTab] = useState("service");
  const dirty = editing && !archived && formDirty(form, base);
  useReportDirty(desk, dirty);
  useCloseWhenArchived(archived, () => setEditing(false));
  const shown = editing && !archived ? "edit" : "read";
  useStageRemeasure(`${shown}:${tab}:${form.knownEndDate}:${error}`);
  const rootRef = useSwapFocus(shown);
  const shownAt = useShownAt(shown);
  const discard = useDiscard(dirty, () => setEditing(false));
  const set = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }));
    discard.clear();
  };
  const yesNoOptions = [
    { value: "YES", label: t("journey.serviceContinuity.yes") },
    { value: "NO", label: t("journey.serviceContinuity.no") },
    { value: "", label: t("journey.serviceContinuity.unknown") }
  ];
  const title = t("journey.desk.parts.continuity.title");

  const submit = async (event) => {
    event.preventDefault();
    if (busy || pressTooSoon(shownAt.current)) return;
    if (await onSave(form)) setEditing(false);
  };

  if (shown === "edit") {
    return (
      <div className={styles.swap} ref={rootRef}>
        <Form className={styles.form} validate={false} onSubmit={submit} onKeyDown={blockRepeatEnter}>
          <StepPanel
            title={title}
            note={footNote(discard.armed ? null : error ? { text: error, tone: "risk" } : null, discard.armed ? t("journey.desk.discard_note") : t("journey.desk.continuity.save_all"))}
            actions={
              <>
                <DiscardButton t={t} discard={discard} />
                <Button type="submit" size="sm" variant="primary" glow={desk?.glow !== false} aria-busy={busy ? "true" : undefined}>
                  {t("journey.serviceContinuity.save")}
                </Button>
              </>
            }
          >
            <div className={shared.stack} aria-busy={busy ? "true" : undefined}>
              <Cells
                label={t("journey.desk.continuity.tabs.label")}
                options={["service", "time", "state", "goal"].map((value) => ({ value, label: t(`journey.desk.continuity.tabs.${value}`) }))}
                value={tab}
                onChange={setTab}
              />
              {tab === "service" ? (
                <div className={styles.fields}>
                  <div className={styles.fieldPair}>
                    <LineField t={t} label={t("journey.serviceContinuity.serviceName")} value={form.serviceName} max={160} autoFocus placeholder={t("journey.serviceContinuity.serviceNamePlaceholder")} onChange={set("serviceName")} />
                    <LineField t={t} label={t("journey.serviceContinuity.currentProvider")} value={form.currentProvider} max={160} placeholder={t("journey.serviceContinuity.currentProviderPlaceholder")} onChange={set("currentProvider")} />
                  </div>
                  <LineField t={t} label={t("journey.serviceContinuity.municipality")} value={form.municipality} max={160} placeholder={t("journey.serviceContinuity.municipalityPlaceholder")} onChange={set("municipality")} />
                </div>
              ) : null}
              {tab === "time" ? (
                <div className={styles.fields}>
                  <div>
                    <ChoiceRow label={t("journey.serviceContinuity.hasExistingService")} layout="scale" options={yesNoOptions} value={form.hasExistingService} onChange={set("hasExistingService")} />
                    <ChoiceRow label={t("journey.serviceContinuity.knownEndDate")} layout="scale" options={yesNoOptions} value={form.knownEndDate} onChange={set("knownEndDate")} />
                  </div>
                  {form.knownEndDate === "YES" ? (
                    <LineField t={t} label={t("journey.serviceContinuity.endDate")} value={form.endDate} max={80} placeholder={t("journey.serviceContinuity.endDatePlaceholder")} onChange={set("endDate")} />
                  ) : null}
                </div>
              ) : null}
              {tab === "state" ? (
                <div>
                  {YES_NO_FIELDS.map((field) => (
                    <ChoiceRow key={field} label={t(`journey.serviceContinuity.${field}`)} layout="scale" options={yesNoOptions} value={form[field]} onChange={set(field)} />
                  ))}
                </div>
              ) : null}
              {tab === "goal" ? (
                <div className={styles.fields}>
                  <TextAreaField
                    label={t("journey.serviceContinuity.userGoal")}
                    hint={t("journey.serviceContinuity.userGoalPlaceholder")}
                    value={form.userGoal}
                    onChange={set("userGoal")}
                    rows={3}
                    maxLength={JOURNEY_TEXT_LIMITS.contextText}
                  />
                  <Facts items={[{ key: "next", label: t("journey.serviceContinuity.nextSteps"), value: rules.actions(form).map((action) => action.title).join(", ") }]} />
                </div>
              ) : null}
            </div>
          </StepPanel>
        </Form>
      </div>
    );
  }

  const missing = rules.missing(base);
  return (
    <div className={styles.swap} ref={rootRef}>
      <StepPanel
        title={title}
        lead={exists ? undefined : t("journey.serviceContinuity.description")}
        note={footNote(error ? { text: error, tone: "risk" } : null, exists ? t("journey.serviceContinuity.privacyNote") : t("journey.serviceContinuity.notOfficialAssessment"))}
        actions={
          <>
            {exists ? (
              <>
                <LinkButton href={links.documents}>{t("journey.serviceContinuity.addDocument")}</LinkButton>
                <LinkButton href={links.serviceMap}>{t("journey.serviceContinuity.openServiceMap")}</LinkButton>
                <LinkButton href={links.preInquiry}>{t("journey.serviceContinuity.createPreInquiry")}</LinkButton>
              </>
            ) : null}
            {archived ? null : (
              <Button
                type="button"
                size="sm"
                variant="primary"
                glow={desk?.glow !== false}
                data-edit-continuity="1"
                onClick={() => {
                  setForm(continuityForm(journey));
                  setTab("service");
                  setEditing(true);
                }}
              >
                {exists ? t("journey.actions.edit") : t("journey.serviceContinuity.open")}
              </Button>
            )}
          </>
        }
      >
        {exists ? (
          <div className={shared.stack}>
            <Facts
              items={[
                { key: "service", label: t("journey.serviceContinuity.serviceName"), value: saved.serviceName },
                { key: "provider", label: t("journey.serviceContinuity.currentProvider"), value: saved.currentProvider },
                { key: "municipality", label: t("journey.serviceContinuity.municipality"), value: saved.municipality },
                { key: "end", label: t("journey.desk.continuity.end_date"), value: saved.endDate },
                { key: "missing", label: t("journey.serviceContinuity.missingInfo"), value: missing.join(", ") }
              ]}
            />
            <p className={shared.own}>{saved.userGoal || t("journey.serviceContinuity.existingSummaryEmpty")}</p>
            <p className={shared.small}>{t("journey.serviceContinuity.notOfficialAssessment")}</p>
          </div>
        ) : null}
      </StepPanel>
    </div>
  );
}

/* ---------- Teekonnarada ------------------------------------------------------------------ */

/**
 * Teekonnarada: mis on tehtud ja mis on pooleli, tuletatuna faktidest (vt
 * `lib/journey/roadmap.js`), ning sündmuste ajalugu. Ainult lugemiseks.
 */
export function RoadPart({ t, journey, stateWord }) {
  const [tab, setTab] = useState("road");
  const rows = journeyRoadmap(journey);
  const events = (Array.isArray(journey?.activity) ? journey.activity : []).map((item, index) => {
    const key = `notifications.events.${String(item.type || "").replaceAll(".", "_")}`;
    const name = t(key);
    /* Sündmus, millele kataloogis nime ei ole, kannab üldist nime, mitte toorest koodi. */
    return { id: item.id || index, title: name === key ? t("journey.desk.road.event") : name, day: dayOf(item.occurredAt) };
  });
  useStageRemeasure(`${tab}:${events.length}`);
  return (
    <StepPanel title={t("journey.roadmap.title")} note={t("journey.desk.road.note")}>
      <div className={shared.stack}>
        <Cells
          label={t("journey.roadmap.title")}
          options={[
            { value: "road", label: t("journey.desk.road.tabs.road") },
            ...(events.length ? [{ value: "events", label: t("journey.desk.road.tabs.events") }] : [])
          ]}
          value={tab === "events" && events.length ? "events" : "road"}
          onChange={setTab}
        />
        {tab === "events" && events.length ? (
          <ul className={shared.rows}>
            {events.map((event) => (
              <li key={event.id} className={shared.rowItem}>
                <span className={styles.factRow}>
                  <span className={shared.rowTitle}>{event.title}</span>
                  <span className={shared.time}>{event.day}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <ol className={shared.rows} aria-label={t("journey.roadmap.title")}>
            {rows.map((row) => (
              <li key={row.key} className={shared.rowItem}>
                <span className={styles.factRow} data-state={row.state}>
                  <span className={shared.rowTitle}>{t(`journey.roadmap.${row.key}`)}</span>
                  <Chip tone={row.state === "done" ? "ok" : row.state === "todo" ? undefined : "wait"}>{stateWord(row.state)}</Chip>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </StepPanel>
  );
}

/* ---------- Paberleht ja andmed -------------------------------------------------------------- */

/**
 * Paberleht, fail ja kustutamine. Kustutamine on pöördumatu: see küsib teist
 * vajutust samal nupul ja tagajärg seisab nupu kõrval; enne seda pakub vaade
 * faili alla laadida.
 *
 * `onExport()` ja `onDelete()` on lehe päringud; `busy` ütleb, kumb käib.
 */
export function DataPart({ t, locale, journey, busy, error, onExport, onDelete }) {
  const [tab, setTab] = useState("paper");
  useStageRemeasure(`${tab}:${error}`);
  const exportButton = (
    <Button {...SMALL} data-export="1" aria-busy={busy === "export" ? "true" : undefined} onKeyDown={ignoreKeyRepeat} onClick={onExport}>
      {busy === "export" ? t("journey.desk.data.exporting") : t("journey.desk.data.export")}
    </Button>
  );
  return (
    <StepPanel title={t("journey.desk.parts.data.title")} note={footNote(error ? { text: error, tone: "risk" } : null)}>
      <div className={shared.stack}>
        <Cells
          label={t("journey.desk.parts.data.title")}
          options={["paper", "file", "delete"].map((value) => ({ value, label: t(`journey.desk.data.tabs.${value}`) }))}
          value={tab}
          onChange={setTab}
        />
        {tab === "paper" ? <JourneyPaperSheet journey={journey} locale={locale} t={t} /> : null}
        {tab === "file" ? (
          <>
            <p className={shared.quiet}>{t("journey.desk.data.file_lead")}</p>
            <div>{exportButton}</div>
          </>
        ) : null}
        {tab === "delete" ? (
          <>
            <p className={shared.quiet}>{t("journey.delete.body")}</p>
            <div>{exportButton}</div>
            <TwoPress
              danger
              label={t("journey.actions.delete")}
              confirmLabel={t("journey.delete.confirm")}
              cancelLabel={t("journey.actions.decline")}
              note={t("journey.desk.data.delete_note")}
              busy={busy === "delete"}
              busyLabel={t("journey.desk.data.deleting")}
              onConfirm={onDelete}
            />
          </>
        ) : null}
      </div>
    </StepPanel>
  );
}
