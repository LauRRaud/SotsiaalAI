"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_SAFETY_TOPICS, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { planDayLabel } from "./HomeCarePlanView";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/**
 * Ohutuskaart (K5-n): kümme küsimust kodu kui töökoha kohta, vastus jah või ei ja soovi
 * korral lühike märkus. Lugemisvaates on ees „jah"-vastused (see, mida peab enne minekut
 * teadma); „ei"-vastused on kokku võetud ühele reale. Täidavad meeskond ja hooldusjuht.
 */
export default function HomeCareSafetyCard({ organizationId, clientId, initial = null, canEdit = false }) {
  const { t } = useI18n();
  const { call, busy, error, setError } = useHomeCareApi();
  const fieldId = useId();
  const [card, setCard] = useState(initial || { items: [], assessedOn: null, reviewDue: false });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  const start = () => {
    setForm(
      Object.fromEntries(
        CARE_SAFETY_TOPICS.map((topic) => {
          const item = card.items.find((row) => row.topic === topic);
          return [topic, { answer: item?.answer || "", note: item?.note || "" }];
        })
      )
    );
    setError("");
    setEditing(true);
  };

  const setCell = (topic, key, value) => setForm((previous) => ({ ...previous, [topic]: { ...previous[topic], [key]: value } }));

  const save = async (event) => {
    event.preventDefault();
    /* Märkus ilma vastuseta ei lähe teele: vastamata teema märkus jäetakse välja. */
    const items = Object.fromEntries(Object.entries(form).map(([topic, item]) => [topic, { answer: item.answer || null, note: item.answer ? item.note : "" }]));
    const result = await call(`${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(clientId)}/ohutus`, {
      method: "PUT",
      body: { items },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    setCard(result.data.safety);
    setEditing(false);
  };

  if (!card.items.length && !canEdit) return null;
  const yes = card.items.filter((item) => item.answer === "YES");
  const no = card.items.filter((item) => item.answer === "NO");
  const open = CARE_SAFETY_TOPICS.length - card.items.length;

  return (
    <section className="hc-section" aria-labelledby={`${fieldId}-title`}>
      <h2 className="hc-section-title" id={`${fieldId}-title`}>
        {t("home_care.safety.title")}
        {card.reviewDue ? (
          <>
            {" "}
            <span className="hc-badge hc-badge--warn">{t("home_care.safety.review_due")}</span>
          </>
        ) : null}
      </h2>

      {editing ? (
        <form className="hc-form" onSubmit={save} aria-busy={busy}>
          <p className="hc-hint">{t("home_care.safety.edit_hint")}</p>
          {CARE_SAFETY_TOPICS.map((topic) => (
            <fieldset className="hc-fieldset" key={topic}>
              <legend className="hc-label">{t(`home_care.safety.questions.${topic}`)}</legend>
              <div className="hc-chips" role="group" aria-label={t(`home_care.safety.questions.${topic}`)}>
                {["YES", "NO"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="hc-chip"
                    aria-pressed={form[topic]?.answer === value}
                    onClick={() => setCell(topic, "answer", form[topic]?.answer === value ? "" : value)}
                  >
                    {t(`home_care.safety.answers.${value}`)}
                  </button>
                ))}
              </div>
              {form[topic]?.answer ? (
                <input
                  className="hc-input"
                  value={form[topic]?.note || ""}
                  onChange={(event) => setCell(topic, "note", event.target.value)}
                  maxLength={HOME_CARE_LIMITS.SAFETY_NOTE_MAX}
                  placeholder={t("home_care.safety.note_label")}
                  aria-label={`${t(`home_care.safety.questions.${topic}`)} ${t("home_care.safety.note_label")}`}
                  autoComplete="off"
                />
              ) : null}
            </fieldset>
          ))}
          {error ? (
            <p className="hc-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hc-row">
            <button className="hc-btn hc-btn--primary" type="submit" disabled={busy}>
              {t("home_care.safety.save")}
            </button>
            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setEditing(false)} disabled={busy}>
              {t("home_care.safety.cancel")}
            </button>
          </div>
        </form>
      ) : (
        <>
          {card.items.length ? (
            <ul className="hc-list hc-list--plain">
              {yes.map((item) => (
                <li key={item.topic}>
                  <strong>{t(`home_care.safety.topics.${item.topic}`)}</strong>
                  {item.note ? `: ${item.note}` : ""}
                </li>
              ))}
              {no.length ? <li className="hc-sub">{t("home_care.safety.no_line", { list: no.map((item) => t(`home_care.safety.topics.${item.topic}`)).join(", ") })}</li> : null}
              {open > 0 ? <li className="hc-sub">{t("home_care.safety.open_line", { count: open })}</li> : null}
              {card.assessedOn ? <li className="hc-sub">{t("home_care.safety.assessed_on", { date: planDayLabel(card.assessedOn) })}</li> : null}
            </ul>
          ) : (
            <p className="hc-hint">{t("home_care.safety.none")}</p>
          )}
          {canEdit ? (
            <div className="hc-row">
              <button className="hc-btn hc-btn--quiet" type="button" onClick={start} disabled={busy}>
                {card.items.length ? t("home_care.safety.edit") : t("home_care.safety.add")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
