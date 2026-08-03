"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import { localizePath } from "@/lib/localizePath";
import PrivacyBadge from "./PrivacyBadge";
import styles from "./SupervisionPage.module.css";
import { isConflict, supervisionMessage, supervisionRequest } from "./supervisionClient";

const KINDS = ["PREP_TOPIC", "PRIVATE_NOTE", "CLOSING_REFLECTION"];

/**
 * Vaade 4 „Privaatne eeskamber" (Q2.6). Hämaram paneel = ruumigrammatika
 * „privaatne koht enne läve". Märgis „Ainult sina näed" on IGA kirje juures
 * püsivalt, mitte tooltip'ina — M6 on omanik-only ka superviisori eest.
 *
 * Salvestus on TEADLIK (nupp), mitte autosalvestus: nii ei saa võrgu- ega
 * CAS-viga kunagi kirjutatud teksti kaotada — ebaõnnestumisel jääb mustand
 * redaktorisse alles ja kasutaja näeb, mis juhtus.
 */
export default function EeskamberPanel({ process }) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState({ kind: "PREP_TOPIC", title: "", body: "" });
  const [editing, setEditing] = useState(null);

  const canWrite = Boolean(process.capabilities?.canManagePrivateItems);
  const canShare = Boolean(process.capabilities?.canShareTopic);

  const load = useCallback(async (signal) => {
    setLoadError("");
    try {
      const { ok, status, payload } = await supervisionRequest(
        `/api/supervision/processes/${encodeURIComponent(process.id)}/private-items`,
        { signal }
      );
      if (!ok) {
        setLoadError(supervisionMessage({ status, payload, t }));
        setItems([]);
        return;
      }
      setItems(payload?.items || []);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setLoadError(t("supervision.errors.load_failed"));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [process.id, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const create = useCallback(async (event) => {
    event?.preventDefault?.();
    const body = draft.body.trim();
    if (!body) return;
    setBusy("create");
    setMessage("");
    try {
      const { ok, status, payload } = await supervisionRequest(
        `/api/supervision/processes/${encodeURIComponent(process.id)}/private-items`,
        { method: "POST", body: { kind: draft.kind, title: draft.title.trim() || null, body } }
      );
      if (!ok) {
        setMessage(supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" }));
        return;
      }
      setDraft({ kind: "PREP_TOPIC", title: "", body: "" });
      await load();
    } catch {
      setMessage(t("supervision.errors.save_failed"));
    } finally {
      setBusy("");
    }
  }, [draft, load, process.id, t]);

  const save = useCallback(async () => {
    if (!editing) return;
    const body = editing.body.trim();
    if (!body) return;
    setBusy(`save:${editing.id}`);
    setMessage("");
    try {
      const { ok, status, payload } = await supervisionRequest(
        `/api/supervision/private-items/${encodeURIComponent(editing.id)}`,
        { method: "PATCH", body: { title: editing.title.trim() || null, body, expectedVersion: editing.version } }
      );
      if (!ok) {
        // CAS-konflikt: too värske seis, AGA jäta kasutaja tekst redaktorisse —
        // ta otsustab ise, kas kirjutada üle või kopeerida välja.
        if (isConflict(status)) {
          setMessage(t("supervision.common.conflictReload"));
          await load();
          return;
        }
        setMessage(supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" }));
        return;
      }
      setEditing(null);
      await load();
    } catch {
      setMessage(t("supervision.errors.save_failed"));
    } finally {
      setBusy("");
    }
  }, [editing, load, t]);

  const remove = useCallback(async (item) => {
    if (typeof window !== "undefined" && !window.confirm(t("supervision.eeskamber.deleteConfirm"))) return;
    setBusy(`delete:${item.id}`);
    setMessage("");
    try {
      const { ok, status, payload } = await supervisionRequest(
        `/api/supervision/private-items/${encodeURIComponent(item.id)}`,
        { method: "DELETE" }
      );
      if (!ok) {
        setMessage(supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" }));
        return;
      }
      if (editing?.id === item.id) setEditing(null);
      await load();
    } catch {
      setMessage(t("supervision.errors.save_failed"));
    } finally {
      setBusy("");
    }
  }, [editing, load, t]);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2>{t("supervision.eeskamber.title")}</h2>
        <p>{t("supervision.eeskamber.hint")}</p>
      </div>

      <PrivacyBadge scope="private" />

      <p aria-live="polite" className={styles.liveRegion} role="status" tabIndex={-1}>
        {message}
      </p>

      <div className={styles.eeskamber}>
        {loading ? <p className={styles.loading}>{t("supervision.common.loading")}</p> : null}

        {loadError ? (
          <div aria-live="polite" className={styles.loadError} role="status">
            <p>{loadError}</p>
            <Button onClick={() => { setLoading(true); void load(); }} variant="secondary">
              {t("supervision.common.retry")}
            </Button>
          </div>
        ) : null}

        {!loading && !loadError && !items.length ? (
          <p className={styles.empty}>{t("supervision.eeskamber.empty")}</p>
        ) : null}

        {!loading && !loadError && items.length ? (
          <div className={styles.itemList}>
            {items.map((item) => (
              <article key={item.id} className={styles.item}>
                <PrivacyBadge scope="private" />
                <div className={styles.badgeRow}>
                  <span className={styles.badge}>{t(`supervision.eeskamber.kind_${item.kind}`)}</span>
                  {item.sharedTopicId ? (
                    <span className={styles.badge}>{t("supervision.eeskamber.shared")}</span>
                  ) : null}
                </div>

                {editing?.id === item.id ? (
                  <div className={styles.form}>
                    <label>
                      {t("supervision.eeskamber.titleLabel")}
                      <Input
                        maxLength={200}
                        onChange={(event) => setEditing((prev) => ({ ...prev, title: event.target.value }))}
                        value={editing.title}
                      />
                    </label>
                    <label>
                      {t("supervision.eeskamber.bodyLabel")}
                      <textarea
                        maxLength={50000}
                        onChange={(event) => setEditing((prev) => ({ ...prev, body: event.target.value }))}
                        value={editing.body}
                      />
                    </label>
                    <div className={styles.actions}>
                      <Button disabled={busy === `save:${item.id}`} onClick={save} size="sm">
                        {busy === `save:${item.id}` ? t("supervision.common.saving") : t("supervision.common.save")}
                      </Button>
                      <Button onClick={() => setEditing(null)} size="sm" variant="secondary">
                        {t("supervision.common.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {item.title ? <h3 className={styles.itemTitle}>{item.title}</h3> : null}
                    <p className={styles.itemBody}>{item.body}</p>
                    <div className={styles.actions}>
                      {canWrite ? (
                        <Button
                          onClick={() => setEditing({
                            id: item.id, title: item.title || "", body: item.body, version: item.version
                          })}
                          size="sm"
                          variant="secondary"
                        >
                          {t("supervision.common.edit")}
                        </Button>
                      ) : null}
                      {canShare && !item.sharedTopicId ? (
                        <Button
                          as="a"
                          href={localizePath(
                            `/supervisioon/${process.id}/jaga?item=${encodeURIComponent(item.id)}`,
                            locale
                          )}
                          size="sm"
                        >
                          {t("supervision.eeskamber.share")}
                        </Button>
                      ) : null}
                      {canWrite ? (
                        <Button
                          disabled={busy === `delete:${item.id}`}
                          onClick={() => remove(item)}
                          size="sm"
                          variant="secondary"
                        >
                          {t("supervision.eeskamber.delete")}
                        </Button>
                      ) : null}
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        ) : null}

        {canWrite ? (
          <form className={styles.form} onSubmit={create}>
            <div className={styles.sectionHeading}>
              <h3>{t("supervision.eeskamber.new")}</h3>
            </div>
            <label>
              {t("supervision.eeskamber.kindLabel")}
              <Dropdown
                onChange={(next) => setDraft((prev) => ({ ...prev, kind: next }))}
                value={draft.kind}
                ariaLabel={t("supervision.eeskamber.kindLabel")}
                options={KINDS.map((kind) => ({
                  value: kind,
                  label: t(`supervision.eeskamber.kind_${kind}`)
                }))}
              />
            </label>
            <label>
              {t("supervision.eeskamber.titleLabel")}
              <Input
                maxLength={200}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                value={draft.title}
              />
            </label>
            <label>
              {t("supervision.eeskamber.bodyLabel")}
              <textarea
                maxLength={50000}
                onChange={(event) => setDraft((prev) => ({ ...prev, body: event.target.value }))}
                value={draft.body}
              />
            </label>
            <div className={styles.actions}>
              <Button disabled={busy === "create" || !draft.body.trim()} type="submit">
                {busy === "create" ? t("supervision.common.saving") : t("supervision.common.save")}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
