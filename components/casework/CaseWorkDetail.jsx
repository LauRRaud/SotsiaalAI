"use client";

/**
 * JUHTUM-V1 (CASEWORK-P7) E6 — juhtumi detailvaade.
 *
 * KOLM ASJA, MIS SIIN ON TAHTLIKUD:
 *
 *   1. KIRJUTUSKAITSE ON NÄHTAV, MITTE AINULT VASTUSES. `READ_ONLY` ja
 *      `ARCHIVED` juhtumis on kirjutusnupud VÄLJAS ja lause ütleb, miks. Server
 *      keeldub nagunii (L14), aga vorm, mis laseb kirjutada ja siis vea annab,
 *      õpetab inimest arvama, et viga on tema tehtud.
 *
 *   2. KLIENDIVIITE KUSTUTAMINE ON ALLES KA SIIS. See on ainus erand
 *      kirjutuskeelust (L17): andmesubjekti õigus ei tohi jääda retention-oleku
 *      taha kinni.
 *
 *   3. RADA A EI OLE SIIN MUUDETAV. Kui juhtum on seotud platvormi kasutajaga
 *      (`clientUserId`), siis vabatekstiväljad PEAVAD olema tühjad (L11) ja
 *      nende näitamine tähendaks vormi, mille salvestamine annab alati vea.
 *      Kliendiotsingut V1-s ei ole (O-JU-4), seega rada A siit ka ei sünni.
 *
 * TEKST ON TEKST. Ükski väli ei jõua siit `dangerouslySetInnerHTML`-i — juhtumi
 * punktid on plain text ja HTML nende sees kuvatakse märkidena, mitte
 * märgistusena (testileping 38).
 */

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { PROVENANCES, provenanceLabelKey } from "@/lib/workspaces/provenance";

import {
  caseLabelText,
  caseWorkRequest,
  fromLocalInputValue,
  missingInfoStatusKey,
  retentionLabelKey,
  targetTypeKey,
  toLocalInputValue
} from "./caseWorkClient";

/* Kanooniline sihttüüpide register elab serveris (`lib/casework/caseWorkItem.js`)
   ja tundmatu tüüp kukub seal FAIL-CLOSED. Siin on ainult valikuloend — kui
   register kasvab, ei ava seda pind, vaid migratsioon (L15). */
const TARGET_TYPES = ["USER_DOCUMENT", "AGENT_ARTIFACT", "FIELD_VISIT"];

/* V1-s on lubatud ainult STAR2 (L6). Süsteemi nimi EI OLE tõlgitav tekst — ta on
   välise registri nimi ja peab kõigis keeltes ühtemoodi kõlama. */
const EXTERNAL_SYSTEMS = ["STAR2"];

const ITEMS_PAGE_SIZE = 25;
const MISSING_INFO_PAGE_SIZE = 50;

export default function CaseWorkDetail({ caseId, onBack, onChanged }) {
  const { t, locale } = useI18n();

  const [record, setRecord] = useState(null);
  const [counts, setCounts] = useState({ items: 0, openMissingInfo: 0 });
  const [state, setState] = useState("loading");
  const [errorKey, setErrorKey] = useState(null);
  const [busy, setBusy] = useState(false);

  const [items, setItems] = useState([]);
  const [itemsCursor, setItemsCursor] = useState(null);
  const [missingInfo, setMissingInfo] = useState([]);
  const [missingCursor, setMissingCursor] = useState(null);

  const [displayName, setDisplayName] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [nextContact, setNextContact] = useState("");
  const [externalSystem, setExternalSystem] = useState("");
  const [externalReference, setExternalReference] = useState("");

  const [linkType, setLinkType] = useState(TARGET_TYPES[0]);
  const [linkTargetId, setLinkTargetId] = useState("");

  const [missingText, setMissingText] = useState("");
  const [missingProvenance, setMissingProvenance] = useState("");

  const [retentionReason, setRetentionReason] = useState("");

  const isActive = record?.retentionState === "ACTIVE";
  const isTrackA = Boolean(record?.clientUserId);
  const isErased = Boolean(record?.clientErasedAt);

  const loadCase = useCallback(async () => {
    const body = await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}`, { locale });
    setRecord(body.case || null);
    setCounts(body.counts || { items: 0, openMissingInfo: 0 });
    /* Vormiväljad tulevad ALATI serveri vastusest, mitte kohalikust mälust:
       kustutatud kliendiviide peab tühjendama ka välja, mille sisse töötaja
       parasjagu vaatab. */
    setDisplayName(body.case?.clientDisplayName || "");
    setExternalRef(body.case?.clientExternalRef || "");
    setNextContact(toLocalInputValue(body.case?.nextContactAt));
    setExternalSystem(body.case?.externalSystem || "");
    setExternalReference(body.case?.externalReference || "");
  }, [caseId, locale]);

  const loadItems = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      const params = new URLSearchParams({ limit: String(ITEMS_PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      const body = await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/items?${params.toString()}`, {
        locale
      });
      setItems((previous) => (append ? [...previous, ...(body.items || [])] : body.items || []));
      setItemsCursor(body.nextCursor || null);
    },
    [caseId, locale]
  );

  const loadMissingInfo = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      const params = new URLSearchParams({ limit: String(MISSING_INFO_PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      const body = await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/missing-info?${params.toString()}`, {
        locale
      });
      setMissingInfo((previous) => (append ? [...previous, ...(body.items || [])] : body.items || []));
      setMissingCursor(body.nextCursor || null);
    },
    [caseId, locale]
  );

  const loadAll = useCallback(async () => {
    setState("loading");
    setErrorKey(null);
    try {
      await Promise.all([loadCase(), loadItems(), loadMissingInfo()]);
      setState("ready");
    } catch (error) {
      setErrorKey(error?.messageKey || "casework.page.load_error");
      setState("error");
    }
  }, [loadCase, loadItems, loadMissingInfo]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /** Üks koht, kus kirjutus õnnestub või annab tõlkevõtmega vea. */
  const run = useCallback(
    async (operation) => {
      setBusy(true);
      setErrorKey(null);
      try {
        await operation();
        onChanged?.();
      } catch (error) {
        setErrorKey(error?.messageKey || "casework.errors.unexpected");
      } finally {
        setBusy(false);
      }
    },
    [onChanged]
  );

  const saveBasics = useCallback(
    (event) => {
      event.preventDefault();
      return run(async () => {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}`, {
          method: "PATCH",
          locale,
          body: {
            /* Rada A juhtumil ei saadeta vabatekstivälju üldse: nende
               saatmine — ka tühjana — tähendaks kliendiraja vaikset vahetust. */
            ...(isTrackA || isErased
              ? {}
              : {
                  clientDisplayName: displayName.trim() || null,
                  clientExternalRef: externalRef.trim() || null
                }),
            externalSystem: externalSystem || null,
            externalReference: externalReference.trim() || null,
            nextContactAt: fromLocalInputValue(nextContact)
          }
        });
        await loadCase();
      });
    },
    [caseId, displayName, externalRef, externalReference, externalSystem, isErased, isTrackA, loadCase, locale, nextContact, run]
  );

  const linkItem = useCallback(
    (event) => {
      event.preventDefault();
      return run(async () => {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/items`, {
          method: "POST",
          locale,
          body: { targetType: linkType, targetId: linkTargetId.trim() }
        });
        setLinkTargetId("");
        await Promise.all([loadItems(), loadCase()]);
      });
    },
    [caseId, linkTargetId, linkType, loadCase, loadItems, locale, run]
  );

  const unlinkItem = useCallback(
    (itemId) =>
      run(async () => {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/items/${encodeURIComponent(itemId)}`, {
          method: "DELETE",
          locale
        });
        await Promise.all([loadItems(), loadCase()]);
      }),
    [caseId, loadCase, loadItems, locale, run]
  );

  const addMissingInfo = useCallback(
    (event) => {
      event.preventDefault();
      return run(async () => {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/missing-info`, {
          method: "POST",
          locale,
          body: { text: missingText, provenance: missingProvenance }
        });
        setMissingText("");
        setMissingProvenance("");
        await Promise.all([loadMissingInfo(), loadCase()]);
      });
    },
    [caseId, loadCase, loadMissingInfo, locale, missingProvenance, missingText, run]
  );

  const setMissingStatus = useCallback(
    (itemId, status) =>
      run(async () => {
        await caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/missing-info/${encodeURIComponent(itemId)}`,
          { method: "PATCH", locale, body: { status } }
        );
        await Promise.all([loadMissingInfo(), loadCase()]);
      }),
    [caseId, loadCase, loadMissingInfo, locale, run]
  );

  const removeMissingInfo = useCallback(
    (itemId) =>
      run(async () => {
        await caseWorkRequest(
          `/cases/${encodeURIComponent(caseId)}/missing-info/${encodeURIComponent(itemId)}`,
          { method: "DELETE", locale }
        );
        await Promise.all([loadMissingInfo(), loadCase()]);
      }),
    [caseId, loadCase, loadMissingInfo, locale, run]
  );

  const transitionRetention = useCallback(
    (toState) =>
      run(async () => {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/retention`, {
          method: "POST",
          locale,
          body: { toState, reason: retentionReason }
        });
        setRetentionReason("");
        await loadCase();
      }),
    [caseId, loadCase, locale, retentionReason, run]
  );

  const eraseClientReference = useCallback(
    () =>
      run(async () => {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/client-reference`, {
          method: "DELETE",
          locale,
          body: { reason: "worker_request" }
        });
        await loadCase();
      }),
    [caseId, loadCase, locale, run]
  );

  if (state === "loading" && !record) return <p className="cw-empty">{t("casework.page.loading", "")}</p>;

  if (!record) {
    return (
      <>
        <button className="cw-button" type="button" onClick={onBack}>
          {t("casework.page.back_to_list", "")}
        </button>
        <p className="cw-error" role="alert">
          {t(errorKey || "casework.page.load_error", "")}
        </p>
      </>
    );
  }

  const writeDisabled = busy || !isActive;

  return (
    <>
      <header className="cw-intro">
        <button className="cw-button" type="button" onClick={onBack}>
          {t("casework.page.back_to_list", "")}
        </button>
        <h1 className="cw-title">{caseLabelText(record.label, t)}</h1>
        <p className="cw-case-meta">
          <span className="cw-badge">{t(retentionLabelKey(record.retentionState), "")}</span>{" "}
          {counts.items} {t("casework.page.counts_items", "")} · {counts.openMissingInfo}{" "}
          {t("casework.page.counts_open_missing_info", "")}
        </p>
        {!isActive ? <p className="cw-notice">{t("casework.page.read_only_notice", "")}</p> : null}
        {errorKey ? (
          <p className="cw-error" role="alert">
            {t(errorKey, "")}
          </p>
        ) : null}
      </header>

      <section className="cw-section">
        <h2 className="cw-section-title">{t("casework.page.section_basics", "")}</h2>
        <form className="cw-form" onSubmit={saveBasics}>
          {isTrackA || isErased ? null : (
            <>
              <div className="cw-field">
                <label className="cw-label" htmlFor="cw-display-name">
                  {t("casework.page.client_display_name", "")}
                </label>
                <input
                  id="cw-display-name"
                  className="cw-input"
                  type="text"
                  value={displayName}
                  maxLength={120}
                  disabled={writeDisabled}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>
              <div className="cw-field">
                <label className="cw-label" htmlFor="cw-external-ref">
                  {t("casework.page.client_external_ref", "")}
                </label>
                <input
                  id="cw-external-ref"
                  className="cw-input"
                  type="text"
                  value={externalRef}
                  maxLength={120}
                  disabled={writeDisabled}
                  onChange={(event) => setExternalRef(event.target.value)}
                />
              </div>
            </>
          )}

          <div className="cw-field">
            <label className="cw-label" htmlFor="cw-next-contact">
              {t("casework.page.next_contact", "")}
            </label>
            <input
              id="cw-next-contact"
              className="cw-input"
              type="datetime-local"
              value={nextContact}
              disabled={writeDisabled}
              onChange={(event) => setNextContact(event.target.value)}
            />
          </div>

          <h3 className="cw-section-title">{t("casework.page.section_star", "")}</h3>
          <div className="cw-field">
            <label className="cw-label" htmlFor="cw-external-system">
              {t("casework.page.star_system", "")}
            </label>
            {/* V1-s on lubatud ainult STAR2 (L6) — vaba tekstiväli tekitaks
                süsteeminimede sõnastiku, mida keegi ei halda. */}
            <select
              id="cw-external-system"
              className="cw-select"
              value={externalSystem}
              disabled={writeDisabled}
              onChange={(event) => setExternalSystem(event.target.value)}
            >
              <option value="">—</option>
              {EXTERNAL_SYSTEMS.map((system) => (
                <option key={system} value={system}>
                  {system}
                </option>
              ))}
            </select>
          </div>
          <div className="cw-field">
            <label className="cw-label" htmlFor="cw-external-reference">
              {t("casework.page.star_reference", "")}
            </label>
            <input
              id="cw-external-reference"
              className="cw-input"
              type="text"
              value={externalReference}
              maxLength={120}
              disabled={writeDisabled}
              onChange={(event) => setExternalReference(event.target.value)}
            />
          </div>

          <button className="cw-button" type="submit" disabled={writeDisabled}>
            {t("casework.page.save", "")}
          </button>
        </form>
      </section>

      <section className="cw-section">
        <h2 className="cw-section-title">{t("casework.page.section_items", "")}</h2>
        <p className="cw-hint">{t("casework.page.items_hint", "")}</p>

        {items.length ? (
          <ul className="cw-list">
            {items.map((item) => (
              <li className="cw-item" key={item.id}>
                <span className="cw-item-text">
                  <span className="cw-badge">{t(targetTypeKey(item.targetType), "")}</span>{" "}
                  <span className="cw-item-meta">{item.targetId}</span>
                </span>
                <button
                  className="cw-button"
                  type="button"
                  disabled={writeDisabled}
                  onClick={() => unlinkItem(item.id)}
                >
                  {t("casework.page.unlink", "")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cw-empty">{t("casework.page.items_empty", "")}</p>
        )}

        {itemsCursor ? (
          <button className="cw-button" type="button" onClick={() => loadItems({ cursor: itemsCursor, append: true })}>
            {t("casework.page.load_more", "")}
          </button>
        ) : null}

        <form className="cw-form cw-form--inline" onSubmit={linkItem}>
          <div className="cw-field">
            <label className="cw-label" htmlFor="cw-link-type">
              {t("casework.page.item_type", "")}
            </label>
            <select
              id="cw-link-type"
              className="cw-select"
              value={linkType}
              disabled={writeDisabled}
              onChange={(event) => setLinkType(event.target.value)}
            >
              {TARGET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(targetTypeKey(type), "")}
                </option>
              ))}
            </select>
          </div>
          <div className="cw-field">
            <label className="cw-label" htmlFor="cw-link-target">
              {t("casework.page.item_target_id", "")}
            </label>
            <input
              id="cw-link-target"
              className="cw-input"
              type="text"
              value={linkTargetId}
              disabled={writeDisabled}
              onChange={(event) => setLinkTargetId(event.target.value)}
            />
          </div>
          <button className="cw-button" type="submit" disabled={writeDisabled || !linkTargetId.trim()}>
            {t("casework.page.link_submit", "")}
          </button>
        </form>
      </section>

      <section className="cw-section">
        <h2 className="cw-section-title">{t("casework.page.section_missing_info", "")}</h2>

        {missingInfo.length ? (
          <ul className="cw-list">
            {missingInfo.map((item) => (
              <li className="cw-item" key={item.id}>
                {/* Tekst on TEKST: sisu tuleb React'i lapsena, mitte HTML-ina. */}
                <span className="cw-item-text">{item.text}</span>
                <span className="cw-item-meta">
                  <span className="cw-badge">{t(missingInfoStatusKey(item.status), "")}</span>{" "}
                  <span className="cw-badge">
                    {t(provenanceLabelKey(item.provenance) || "casework.errors.provenance_unknown", "")}
                  </span>
                </span>
                <span className="cw-row">
                  {item.status === "OPEN" ? (
                    <button
                      className="cw-button"
                      type="button"
                      disabled={writeDisabled}
                      onClick={() => setMissingStatus(item.id, "RESOLVED")}
                    >
                      {t("casework.page.mark_resolved", "")}
                    </button>
                  ) : (
                    <button
                      className="cw-button"
                      type="button"
                      disabled={writeDisabled}
                      onClick={() => setMissingStatus(item.id, "OPEN")}
                    >
                      {t("casework.page.reopen", "")}
                    </button>
                  )}
                  <button
                    className="cw-button"
                    type="button"
                    disabled={writeDisabled}
                    onClick={() => removeMissingInfo(item.id)}
                  >
                    {t("casework.page.remove", "")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cw-empty">{t("casework.page.missing_info_empty", "")}</p>
        )}

        {missingCursor ? (
          <button
            className="cw-button"
            type="button"
            onClick={() => loadMissingInfo({ cursor: missingCursor, append: true })}
          >
            {t("casework.page.load_more", "")}
          </button>
        ) : null}

        <form className="cw-form" onSubmit={addMissingInfo}>
          <div className="cw-field">
            <label className="cw-label" htmlFor="cw-missing-text">
              {t("casework.page.missing_info_text", "")}
            </label>
            <textarea
              id="cw-missing-text"
              className="cw-textarea"
              value={missingText}
              maxLength={2000}
              disabled={writeDisabled}
              onChange={(event) => setMissingText(event.target.value)}
            />
          </div>
          <div className="cw-field">
            <label className="cw-label" htmlFor="cw-missing-provenance">
              {t("casework.page.missing_info_provenance", "")}
            </label>
            {/* PÄRITOLU ON KOHUSTUSLIK ja tuleb jagatud sõnastikust
                (`lib/workspaces/provenance.js`) — teist koopiat siia ei teki. */}
            <select
              id="cw-missing-provenance"
              className="cw-select"
              value={missingProvenance}
              disabled={writeDisabled}
              onChange={(event) => setMissingProvenance(event.target.value)}
            >
              <option value="">{t("casework.page.provenance_placeholder", "")}</option>
              {PROVENANCES.map((value) => (
                <option key={value} value={value}>
                  {t(provenanceLabelKey(value), "")}
                </option>
              ))}
            </select>
          </div>
          <button
            className="cw-button"
            type="submit"
            disabled={writeDisabled || !missingText.trim() || !missingProvenance}
          >
            {t("casework.page.missing_info_add", "")}
          </button>
        </form>
      </section>

      <section className="cw-section">
        <h2 className="cw-section-title">{t("casework.page.section_retention", "")}</h2>
        <p className="cw-hint">{t("casework.page.retention_hint", "")}</p>
        <p className="cw-case-meta">
          {t("casework.page.retention_state", "")}
          {": "}
          <span className="cw-badge">{t(retentionLabelKey(record.retentionState), "")}</span>
        </p>

        {record.retentionState === "ARCHIVED" ? null : (
          <>
            <div className="cw-field">
              <label className="cw-label" htmlFor="cw-retention-reason">
                {t("casework.page.retention_reason", "")}
              </label>
              {/* PÕHJUS ON KOHUSTUSLIK (L14) ja ta jääb auditisse — nupp on
                  väljas seni, kuni ta on kirjutatud. */}
              <input
                id="cw-retention-reason"
                className="cw-input"
                type="text"
                value={retentionReason}
                maxLength={500}
                disabled={busy}
                onChange={(event) => setRetentionReason(event.target.value)}
              />
            </div>
            <div className="cw-row">
              {record.retentionState === "ACTIVE" ? (
                <button
                  className="cw-button cw-button--danger"
                  type="button"
                  disabled={busy || !retentionReason.trim()}
                  onClick={() => transitionRetention("READ_ONLY")}
                >
                  {t("casework.page.retention_to_read_only", "")}
                </button>
              ) : (
                <button
                  className="cw-button cw-button--danger"
                  type="button"
                  disabled={busy || !retentionReason.trim()}
                  onClick={() => transitionRetention("ARCHIVED")}
                >
                  {t("casework.page.retention_to_archived", "")}
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <section className="cw-section">
        <h2 className="cw-section-title">{t("casework.page.section_client_reference", "")}</h2>
        <p className="cw-hint">{t("casework.page.erase_hint", "")}</p>
        {isErased ? (
          <p className="cw-notice">{t("casework.page.erased", "")}</p>
        ) : (
          /* NUPP ON ALLES KA `READ_ONLY` JA `ARCHIVED` JUHTUMIS (L17) — ainus
             koht selles vaates, kus `busy` on ainus takistus. */
          <button className="cw-button cw-button--danger" type="button" disabled={busy} onClick={eraseClientReference}>
            {t("casework.page.erase_client_reference", "")}
          </button>
        )}
      </section>
    </>
  );
}
