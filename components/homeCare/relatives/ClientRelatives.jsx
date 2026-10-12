"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { CARE_REPRESENTATIVE_BASES, CARE_SHARING_LEVELS, HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import {
  relativeName,
  relativeReady,
  relativeRights,
  relativeRows,
  relativeSheet,
  relativeWhoReady,
  representationRow,
  representativeReady,
  representativeRows,
  representativeSheet
} from "./relativeRows";
import {
  RelativeShareView,
  RelativeView,
  RelativeWhoView,
  RelativesView,
  RepresentativeMoreView,
  RepresentativeView,
  RepresentativeWhoView,
  RepresentativesView,
  SharingCardView
} from "./RelativesViews";
import { useRelatives, useRepresentatives } from "./useClientRelatives";

/**
 * Kliendi lehe osa „Lähedased": konksud hoiavad lähedaste ja esindusõiguse
 * olekut ja päringuid, siin pannakse vaated kokku. Ees on üks vaade korraga:
 * lähedased, üks lähedane, vormi kaks vaadet, jagamiskaart, esindajad, üks
 * esindaja või uue esindaja kaks vaadet.
 *
 * Osa on lehel kogu aja (pooleli vorm ei kao vaate vahetusel) ja joonistatakse
 * siis, kui ta on ees (`active`). Lähedase eemaldamine kustutab temaga tehtud
 * kokkuleppe ja esindusõiguse lõpetamine võtab kirje nimekirjast: mõlemad
 * küsivad teist vajutust.
 *
 * `who`: { canEdit, canFlag } (muudab hooldusjuht; kahtluse märgib ja jagamiskaardi avab meeskond);
 * `initial`: { relatives, representatives }; `onChanged(key, value)`: leht hoiab sama seisu plaadi rea jaoks.
 */
export default function ClientRelatives({ active, organizationId, clientId, title, name, initial, who, onChanged }) {
  const { t } = useI18n();
  const formId = useId();
  const ids = { organizationId, clientId };
  const relatives = useRelatives({ ...ids, initial: initial.relatives || [], onChanged: (value) => onChanged("relatives", value) });
  const representatives = useRepresentatives({ ...ids, initial: initial.representatives || [], onChanged: (value) => onChanged("representatives", value) });
  /* "" (lähedased), "relative:<id>", "who", "share", "card", "reps" (esindajad), "rep:<id>", "rep_who" või "rep_more". */
  const [screen, setScreen] = useState("");
  /* Tegevus, mille esimene vajutus on tehtud (teine vajutus teeb selle ära). */
  const [armed, setArmed] = useState("");
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut ega ava teist akent. */
  const once = useSendOnce();

  if (!active) return null;

  const go = (next) => {
    setArmed("");
    relatives.setError("");
    representatives.setError("");
    setScreen(next);
  };
  const fault = (message) => (message ? { text: message, tone: "risk" } : null);
  const wrap = (view) => <div ref={rootRef}>{view}</div>;
  const back = (target, label = t("home_care.parts.back")) => ({ label, onBack: () => go(target) });
  /* Teist vajutust küsiv tegevus: esimene vajutus valmistab ette, teine teeb ära ja viib vaatesse `done`. */
  const twice = (key, run, done) => async () => {
    if (armed !== key) {
      setArmed(key);
      return;
    }
    setArmed("");
    if (await once(run)) setScreen(done);
  };
  const [kind, id] = screen.split(":");

  /* --- Lähedase vorm: kes ta on, siis mida talle rääkida võib --- */
  const { form } = relatives;
  const formTitle = t(form.relativeId ? "home_care.relatives.edit" : "home_care.relatives.add");
  const formBack = form.relativeId ? `relative:${form.relativeId}` : "";
  const field = (source, key, max) => ({ value: source.form[key] || "", onChange: (value) => source.setField(key, value), max });

  if (kind === "who" && who.canEdit) {
    return wrap(
      <RelativeWhoView
        title={formTitle}
        form={{
          id: `${formId}-who`,
          onSubmit: (event) => {
            event.preventDefault();
            if (relativeWhoReady(form)) go("share");
          }
        }}
        name={{ label: t("home_care.relatives.name_label"), ...field(relatives, "name", HOME_CARE_LIMITS.RELATIVE_NAME_MAX) }}
        relation={{ label: t("home_care.relatives.relation_label"), ...field(relatives, "relation", HOME_CARE_LIMITS.RELATIVE_RELATION_MAX) }}
        phone={{ label: t("home_care.relatives.phone_label"), ...field(relatives, "phone", HOME_CARE_LIMITS.REFERRAL_PHONE_MAX) }}
        next={{ label: t("home_care.parts.next"), disabled: !relativeWhoReady(form) }}
        back={back(formBack, t("home_care.relatives.cancel"))}
      />
    );
  }

  if (kind === "share" && who.canEdit) {
    return wrap(
      <RelativeShareView
        title={formTitle}
        who={relativeName(form)}
        form={{
          id: `${formId}-share`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (relativeReady(form) && (await once(relatives.save))) go("");
          }
        }}
        level={{
          label: t("home_care.relatives.level_label"),
          options: CARE_SHARING_LEVELS.map((value) => ({ value, label: t(`home_care.relatives.levels.${value}`) })),
          value: form.level,
          onChange: (value) => relatives.setField("level", value)
        }}
        noTell={{ label: t("home_care.relatives.no_tell_label"), ...field(relatives, "noTell", HOME_CARE_LIMITS.RELATIVE_NO_TELL_MAX) }}
        hint={t("home_care.relatives.edit_hint")}
        save={{ label: t("home_care.relatives.save"), busy: relatives.busy, disabled: !relativeReady(form) }}
        notice={fault(relatives.error)}
        /* Tagasi esimesse vaatesse: kirjutatu jääb alles. */
        back={back("who")}
      />
    );
  }

  if (kind === "card" && who.canFlag) {
    return wrap(
      <SharingCardView
        title={t("home_care.relatives.card_title")}
        text={t("home_care.relatives.card_hint")}
        open={{ label: t("home_care.relatives.card_open"), busy: relatives.busy, onPress: () => once(relatives.openCard) }}
        notice={fault(relatives.error)}
        back={back("")}
      />
    );
  }

  const relative = kind === "relative" ? relatives.items.find((item) => item.id === id) : null;
  if (relative) {
    const rights = relativeRights(relative, who);
    return wrap(
      <RelativeView
        title={title}
        sheet={relativeSheet(relative, { t })}
        actions={[
          rights.flag ? { key: "doubt", label: t("home_care.relatives.doubt_flag"), onPress: () => once(() => relatives.flagDoubt(relative)) } : null,
          rights.edit
            ? {
                key: "edit",
                label: t("home_care.relatives.edit"),
                onPress: () => {
                  relatives.start(relative);
                  go("who");
                }
              }
            : null,
          rights.remove ? { key: "remove", label: t("home_care.relatives.remove"), armed: armed === "remove", onPress: twice("remove", () => relatives.remove(relative), "") } : null
        ].filter(Boolean)}
        consequence={armed === "remove" ? t("home_care.relatives.remove_note") : ""}
        busy={relatives.busy}
        notice={fault(relatives.error)}
        back={back("")}
      />
    );
  }

  /* --- Esindusõigus --- */
  const repForm = representatives.form;
  if (kind === "rep_who" && who.canEdit) {
    return wrap(
      <RepresentativeWhoView
        title={t("home_care.representative.add")}
        form={{
          id: `${formId}-rep-who`,
          onSubmit: (event) => {
            event.preventDefault();
            if (representativeReady(repForm)) go("rep_more");
          }
        }}
        name={{ label: t("home_care.representative.name_label"), ...field(representatives, "name", HOME_CARE_LIMITS.RELATIVE_NAME_MAX) }}
        basis={{
          label: t("home_care.representative.basis_label"),
          options: CARE_REPRESENTATIVE_BASES.map((value) => ({ value, label: t(`home_care.representative.bases.${value}`) })),
          value: repForm.basis,
          onChange: (value) => representatives.setField("basis", value)
        }}
        scope={{ label: t("home_care.representative.scope_label"), hint: t("home_care.representative.scope_hint"), ...field(representatives, "scope", HOME_CARE_LIMITS.REPRESENTATIVE_SCOPE_MAX) }}
        next={{ label: t("home_care.parts.next"), disabled: !representativeReady(repForm) }}
        back={back("reps", t("home_care.representative.cancel"))}
      />
    );
  }

  if (kind === "rep_more" && who.canEdit) {
    return wrap(
      <RepresentativeMoreView
        title={t("home_care.representative.add")}
        who={repForm.name}
        form={{
          id: `${formId}-rep-more`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (representativeReady(repForm) && (await once(representatives.save))) go("reps");
          }
        }}
        from={{ label: t("home_care.representative.from_label"), ...field(representatives, "validFrom") }}
        until={{ label: t("home_care.representative.until_label"), ...field(representatives, "validUntil") }}
        checked={{ label: t("home_care.representative.checked_label"), ...field(representatives, "checkedOn") }}
        phone={{ label: t("home_care.representative.phone_label"), ...field(representatives, "phone", HOME_CARE_LIMITS.REFERRAL_PHONE_MAX) }}
        copy={{ label: t("home_care.representative.copy_label"), ...field(representatives, "copyKept", HOME_CARE_LIMITS.DECISION_ORIGINAL_MAX) }}
        hints={`${t("home_care.representative.form_hint")} ${t("home_care.representative.checked_hint")}`}
        save={{ label: t("home_care.representative.save"), busy: representatives.busy, disabled: !representativeReady(repForm) }}
        notice={fault(representatives.error)}
        back={back("rep_who")}
      />
    );
  }

  const representative = kind === "rep" ? representatives.items.find((item) => item.id === id) : null;
  if (representative) {
    return wrap(
      <RepresentativeView
        title={t("home_care.representative.title")}
        sheet={representativeSheet(representative, { t })}
        labels={{ basis: t("home_care.representative.basis_label"), scope: t("home_care.representative.scope_short") }}
        actions={who.canEdit ? [{ key: "end", label: t("home_care.representative.end"), armed: armed === "end", onPress: twice("end", () => representatives.end(representative), "reps") }] : []}
        consequence={armed === "end" ? t("home_care.representative.end_note") : ""}
        busy={representatives.busy}
        notice={fault(representatives.error)}
        back={back("reps")}
      />
    );
  }

  const representation = representationRow(representatives.items, who, { t });
  if ((kind === "reps" || kind === "rep") && representation) {
    return wrap(
      <RepresentativesView
        title={t("home_care.representative.title")}
        rows={representativeRows(representatives.items, { t })}
        onOpen={(key) => go(`rep:${key}`)}
        empty={t("home_care.representative.none")}
        busy={representatives.busy}
        notice={fault(representatives.error)}
        add={
          who.canEdit
            ? {
                label: t("home_care.representative.add"),
                onAdd: () => {
                  representatives.start();
                  go("rep_who");
                }
              }
            : null
        }
        back={back("")}
      />
    );
  }

  return wrap(
    <RelativesView
      title={title}
      name={name}
      rows={relativeRows(relatives.items, { t })}
      onOpen={(key) => go(`relative:${key}`)}
      empty={t("home_care.relatives.none")}
      rule={relatives.items.length ? t("home_care.relatives.rule") : ""}
      representation={representation ? { ...representation, onOpen: () => go("reps") } : null}
      busy={relatives.busy}
      notice={fault(relatives.error)}
      card={who.canFlag ? { label: t("home_care.relatives.card_title"), onOpen: () => go("card") } : null}
      add={
        who.canEdit
          ? {
              label: t("home_care.relatives.add"),
              onAdd: () => {
                relatives.start();
                go("who");
              }
            }
          : null
      }
    />
  );
}
