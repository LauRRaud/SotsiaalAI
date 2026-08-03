"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import Form from "@/components/ui/Form";
import { localizePath } from "@/lib/localizePath";
import styles from "./SupervisionPage.module.css";
import { supervisionMessage, supervisionRequest } from "./supervisionClient";

/**
 * Vaade 2 „Uue protsessi loomine" (Q2.6). Grandi puudumine on SELGITUS, mitte
 * tühi viga: server annab 403 `supervision.errors.grant_required` ja siin
 * kuvatakse, mida teha (pöördu administraatori poole).
 */
export default function SupervisionCreatePage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState({ type: "INDIVIDUAL", title: "", goal: "", plannedMeetingCount: "5" });
  const [titleError, setTitleError] = useState("");
  const [formError, setFormError] = useState("");
  const [grantRequired, setGrantRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const submit = useCallback(async (event) => {
    event?.preventDefault?.();
    setFormError("");
    setGrantRequired(false);
    const title = form.title.trim();
    if (!title) {
      setTitleError(t("supervision.errors.save_failed"));
      return;
    }
    setTitleError("");
    setSaving(true);
    try {
      const { ok, status, payload } = await supervisionRequest("/api/supervision/processes", {
        method: "POST",
        body: {
          type: form.type,
          title,
          goal: form.goal.trim() || null,
          plannedMeetingCount: Number(form.plannedMeetingCount) || 5
        }
      });
      if (!ok) {
        // 403 grant_required on ainus olek, mis vajab OMA selgitust — muidu
        // näeks kasutaja üldist „ei õnnestunud" ja ei teaks, mida teha.
        if (status === 403) {
          setGrantRequired(true);
          return;
        }
        setFormError(supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" }));
        return;
      }
      const id = payload?.process?.id;
      if (id) router.push(localizePath(`/supervisioon/${id}?ala=kontrakt`, locale));
    } catch {
      setFormError(t("supervision.errors.save_failed"));
    } finally {
      setSaving(false);
    }
  }, [form, locale, router, t]);

  return (
    <main className={styles.page}>
      <div className={styles.shell} data-glass-back-anchor="">
        <SubpageHeader title={t("supervision.create.title")} />
        <p className={styles.lead}>{t("supervision.create.draftHint")}</p>

        {grantRequired ? (
          <div className={styles.conflict} role="status">
            <p>{t("supervision.create.grantRequired")}</p>
          </div>
        ) : null}

        <p aria-live="polite" className={styles.liveRegion} role="status" tabIndex={-1}>
          {formError}
        </p>

        <Form className={styles.form} onSubmit={submit}>
          <label>
            {t("supervision.create.typeLabel")}
            <Dropdown
              value={form.type}
              onChange={(next) => update("type", next)}
              ariaLabel={t("supervision.create.typeLabel")}
              options={[
                { value: "INDIVIDUAL", label: t("supervision.type.INDIVIDUAL") },
                { value: "GROUP", label: t("supervision.type.GROUP") }
              ]}
            />
          </label>

          <label>
            {t("supervision.create.titleLabel")}
            <Input
              maxLength={200}
              onChange={(event) => update("title", event.target.value)}
              placeholder={t("supervision.create.titlePlaceholder")}
              required
              value={form.title}
            />
            {titleError ? <span className={styles.fieldError}>{titleError}</span> : null}
          </label>

          <label>
            {t("supervision.create.goalLabel")}
            <textarea
              maxLength={20000}
              onChange={(event) => update("goal", event.target.value)}
              value={form.goal}
            />
          </label>

          <label>
            {t("supervision.create.meetingsLabel")}
            <Input
              max={100}
              min={1}
              onChange={(event) => update("plannedMeetingCount", event.target.value)}
              type="number"
              value={form.plannedMeetingCount}
            />
          </label>

          <div className={styles.actions}>
            <Button disabled={saving} type="submit">
              {saving ? t("supervision.common.saving") : t("supervision.create.submit")}
            </Button>
            <Button as="a" href={localizePath("/supervisioon", locale)} variant="secondary">
              {t("supervision.common.cancel")}
            </Button>
          </div>
        </Form>
      </div>
    </main>
  );
}
