"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgHeader from "@/components/org/OrgHeader";
import Dropdown from "@/components/ui/Dropdown";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import HomeCareOutbox from "./HomeCareOutbox";
import { WEEKDAYS, slotLine } from "./HomeCareSlotList";
import { homeCareBase, useHomeCareApi } from "./homeCareClient";

/* Plaanitud kestuse kiirvalikud minutites. */
const MINUTE_CHOICES = Object.freeze([15, 30, 45, 60, 90]);

const EMPTY_FORM = Object.freeze({ weekdays: [], startTime: "09:00", plannedMinutes: "45", workerMembershipId: "", note: "" });

/**
 * Kliendi käigumuster hooldusjuhile: korduvad käigud nädalas.
 *
 * Uus käik lisatakse korraga mitmele nädalapäevale. Muudatus kehtib tänasest: juba
 * alanud käik lõpetatakse eilse päevaga ja selle asemele tekib uus rida, nii et
 * möödunud päevade plaan jääb nii, nagu see oli. Töötaja valitakse kliendi meeskonnast;
 * valiku juures on näha, mitu käigu kirjet ta selle kliendi juures viimase 28 päeva
 * jooksul kirjutas.
 */
export default function HomeCareSlots({ context, initial }) {
  const { t } = useI18n();
  const { call, busy, error } = useHomeCareApi();
  const fieldId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const client = initial.client;
  const base = `${homeCareBase(organizationId)}/kliendid/${encodeURIComponent(client.id)}/kaigud`;
  const clientHref = `/org/${organizationId}/koduteenus/kliendid/${client.id}`;
  const canEdit = Boolean(initial.canEdit);

  const [slots, setSlots] = useState(initial.slots || []);
  const [team, setTeam] = useState(initial.team || []);
  /* Avatud vorm: `{ mode: "add" }` või `{ mode: "edit", id, version, weekday }`. Korraga üks. */
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmEnd, setConfirmEnd] = useState(null);
  const [notice, setNotice] = useState("");

  const apply = (data) => {
    setSlots(data.slots || []);
    setTeam(data.team || []);
  };
  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const toggleWeekday = (weekday) =>
    setForm((previous) => ({
      ...previous,
      weekdays: previous.weekdays.includes(weekday) ? previous.weekdays.filter((value) => value !== weekday) : [...previous.weekdays, weekday]
    }));

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditing({ mode: "add" });
    setNotice("");
    setConfirmEnd(null);
  };
  const openEdit = (slot) => {
    setForm({
      weekdays: [slot.weekday],
      startTime: slot.startTime,
      plannedMinutes: String(slot.plannedMinutes),
      workerMembershipId: slot.worker?.membershipId || "",
      note: slot.note || ""
    });
    setEditing({ mode: "edit", id: slot.id, version: slot.version, weekday: slot.weekday });
    setNotice("");
    setConfirmEnd(null);
  };

  const workerOptions = [
    { value: "", label: t("home_care.slots.worker_none") },
    ...team.map((member) => ({
      value: member.membershipId,
      label: t("home_care.slots.worker_option", { name: member.name || "—", count: member.recentVisits })
    }))
  ];
  /* Muudetava käigu töötaja võib olla meeskonnast lahkunud: valik peab teda siiski näitama. */
  if (form.workerMembershipId && !workerOptions.some((option) => option.value === form.workerMembershipId)) {
    const current = slots.find((slot) => slot.worker?.membershipId === form.workerMembershipId);
    workerOptions.push({ value: form.workerMembershipId, label: current?.worker?.name || "—" });
  }

  const save = async (event) => {
    event.preventDefault();
    const fields = {
      startTime: form.startTime,
      plannedMinutes: form.plannedMinutes,
      workerMembershipId: form.workerMembershipId || null,
      note: form.note
    };
    const result =
      editing.mode === "edit"
        ? await call(`${base}/${encodeURIComponent(editing.id)}`, {
            method: "PATCH",
            body: { ...fields, version: editing.version },
            fallbackKey: "home_care.errors.save_failed"
          })
        : await call(base, { method: "POST", body: { ...fields, weekdays: form.weekdays }, fallbackKey: "home_care.errors.save_failed" });
    if (!result.ok) return;
    apply(result.data);
    setEditing(null);
    setNotice(t("home_care.slots.saved"));
  };

  const end = async (slot) => {
    const result = await call(`${base}/${encodeURIComponent(slot.id)}`, {
      method: "DELETE",
      body: { version: slot.version },
      fallbackKey: "home_care.errors.save_failed"
    });
    if (!result.ok) return;
    apply(result.data);
    setConfirmEnd(null);
    setNotice(t("home_care.slots.ended"));
  };

  const formBlock = editing ? (
    <form className="hc-form" onSubmit={save} aria-busy={busy}>
      <h3 className="hc-section-title">
        {editing.mode === "edit"
          ? t("home_care.slots.edit_title", { weekday: t(`home_care.slots.weekdays_long.${editing.weekday}`) })
          : t("home_care.slots.new_title")}
      </h3>

      {editing.mode === "add" ? (
        <div className="hc-field">
          <span className="hc-label">{t("home_care.slots.weekdays_label")}</span>
          <div className="hc-chips" role="group" aria-label={t("home_care.slots.weekdays_label")}>
            {WEEKDAYS.map((weekday) => (
              <button
                key={weekday}
                type="button"
                className="hc-chip"
                aria-pressed={form.weekdays.includes(weekday)}
                aria-label={t(`home_care.slots.weekdays_long.${weekday}`)}
                onClick={() => toggleWeekday(weekday)}
              >
                {t(`home_care.slots.weekdays.${weekday}`)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="hc-hint">{t("home_care.slots.edit_hint")}</p>
      )}

      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-time`}>
          {t("home_care.slots.time_label")}
        </label>
        <input
          id={`${fieldId}-time`}
          className="hc-input"
          type="time"
          value={form.startTime}
          onChange={(event) => setField("startTime", event.target.value)}
          required
        />
      </div>
      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-minutes`}>
          {t("home_care.slots.minutes_label")}
        </label>
        <input
          id={`${fieldId}-minutes`}
          className="hc-input"
          type="number"
          inputMode="numeric"
          min={HOME_CARE_LIMITS.SLOT_MINUTES_MIN}
          max={HOME_CARE_LIMITS.SLOT_MINUTES_MAX}
          value={form.plannedMinutes}
          onChange={(event) => setField("plannedMinutes", event.target.value)}
          required
        />
        <div className="hc-chips" role="group" aria-label={t("home_care.visit.minutes_quick")}>
          {MINUTE_CHOICES.map((value) => (
            <button
              key={value}
              type="button"
              className="hc-chip"
              aria-pressed={form.plannedMinutes === String(value)}
              onClick={() => setField("plannedMinutes", String(value))}
            >
              {t("home_care.visit.minutes", { minutes: value })}
            </button>
          ))}
        </div>
      </div>
      <div className="hc-field">
        <span className="hc-label">{t("home_care.slots.worker_label")}</span>
        <Dropdown
          value={form.workerMembershipId}
          onChange={(value) => setField("workerMembershipId", value)}
          ariaLabel={t("home_care.slots.worker_label")}
          options={workerOptions}
        />
        {team.length === 0 ? <p className="hc-hint">{t("home_care.slots.team_empty")}</p> : null}
      </div>
      <div className="hc-field">
        <label className="hc-label" htmlFor={`${fieldId}-note`}>
          {t("home_care.slots.note_label")}
        </label>
        <input
          id={`${fieldId}-note`}
          className="hc-input"
          value={form.note}
          onChange={(event) => setField("note", event.target.value)}
          maxLength={HOME_CARE_LIMITS.SLOT_NOTE_MAX}
          autoComplete="off"
        />
      </div>

      {error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="hc-row">
        <button className="hc-btn hc-btn--primary" type="submit" disabled={busy || (editing.mode === "add" && form.weekdays.length === 0)}>
          {t("home_care.slots.save")}
        </button>
        <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setEditing(null)} disabled={busy}>
          {t("home_care.slots.cancel")}
        </button>
      </div>
    </form>
  ) : null;

  return (
    <section className="ow-shell hc-shell">
      <OrgHeader context={context} />
      <HomeCareOutbox ownerId={context.membership?.id || ""} timeZone={timeZone} />

      <div className="hc-head">
        <Link className="hc-back" href={clientHref} prefetch={false}>
          {t("home_care.plan.back")}
        </Link>
        <h2 className="hc-title">{t("home_care.slots.editor_title", { name: client.displayName })}</h2>
        <p className="hc-sub">{t("home_care.slots.editor_intro")}</p>
      </div>

      {notice ? (
        <p className="hc-ok" role="status">
          {notice}
        </p>
      ) : null}
      {!editing && error ? (
        <p className="hc-error" role="alert">
          {error}
        </p>
      ) : null}

      {editing?.mode === "add" ? formBlock : null}
      {canEdit && !editing ? (
        <div className="hc-row">
          <button className="hc-btn hc-btn--primary" type="button" onClick={openAdd} disabled={busy}>
            {t("home_care.slots.add")}
          </button>
        </div>
      ) : null}
      {!canEdit ? <p className="hc-notice">{t("home_care.client.read_only")}</p> : null}

      {slots.length === 0 ? (
        <p className="hc-sub">{t("home_care.slots.none")}</p>
      ) : (
        WEEKDAYS.filter((weekday) => slots.some((slot) => slot.weekday === weekday)).map((weekday) => (
          <section className="hc-section" key={weekday} aria-labelledby={`${fieldId}-day-${weekday}`}>
            <h3 className="hc-section-title" id={`${fieldId}-day-${weekday}`}>
              {t(`home_care.slots.weekdays_long.${weekday}`)}
            </h3>
            <ul className="hc-list hc-list--plain">
              {slots
                .filter((slot) => slot.weekday === weekday)
                .map((slot) =>
                  editing?.mode === "edit" && editing.id === slot.id ? (
                    <li key={slot.id}>{formBlock}</li>
                  ) : (
                    <li key={slot.id}>
                      <span>{slotLine(t, slot, initial.today)}</span>
                      {slot.worker && !slot.worker.active ? (
                        <>
                          {" "}
                          <span className="hc-badge hc-badge--warn">{t("home_care.slots.worker_inactive")}</span>
                        </>
                      ) : null}
                      {canEdit && !editing ? (
                        <span className="hc-row">
                          <button className="hc-btn hc-btn--quiet" type="button" onClick={() => openEdit(slot)} disabled={busy}>
                            {t("home_care.slots.edit")}
                          </button>
                          {confirmEnd === slot.id ? (
                            <button className="hc-btn hc-btn--danger" type="button" onClick={() => end(slot)} disabled={busy}>
                              {t("home_care.slots.end_confirm")}
                            </button>
                          ) : (
                            <button className="hc-btn hc-btn--quiet" type="button" onClick={() => setConfirmEnd(slot.id)} disabled={busy}>
                              {t("home_care.slots.end")}
                            </button>
                          )}
                        </span>
                      ) : null}
                    </li>
                  )
                )}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
