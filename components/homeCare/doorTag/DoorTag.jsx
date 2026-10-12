"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { DetailView, FormView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { clientHref, formatDateTime } from "../homeCareClient";
import SubPage from "../page/SubPage";
import { madeLine, tagRights } from "./doorTagRows";
import { TagView } from "./DoorTagViews";
import { useDoorTag } from "./useDoorTag";

/**
 * Uksesildi leht hooldusjuhile: konks hoiab silti ja päringuid, siin pannakse
 * vaated kokku. Ees on üks vaade korraga: silt (QR-kood ja nupud), sildi aadress
 * (kopeerimiseks) või haldus (uus silt, tühistamine).
 *
 * Silt ei anna ligipääsu: leht avaneb ikka ainult sisse logitud töötajale, kes
 * klienti näeb. Uue sildi tegemine ja tühistamine teevad seinal oleva sildi
 * kasutuks: mõlemad küsivad teist vajutust samal lahtril ja tagajärg on lause
 * all servas.
 *
 * `client`: { id, displayName }; `initialTag`: { url, createdAt, qr } või null; `context.writable`: asutus on kirjutatav.
 */
export default function DoorTag({ context, client, initialTag }) {
  const { t } = useI18n();
  const formId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const state = useDoorTag({ organizationId, client, initialTag });
  const { tag } = state;
  const rights = tagRights({ writable: context.writable }, tag);
  /* "" (silt), "url" või "manage". */
  const [screen, setScreen] = useState("");
  /* Kinnitamist ootav tegevus: "" | "issue" | "revoke". */
  const [armed, setArmed] = useState("");
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut (kaks silti ega kaht tühistamist). */
  const once = useSendOnce();

  const go = (next) => {
    setArmed("");
    state.setError("");
    setScreen(next);
  };
  const fault = state.error ? { text: state.error, tone: "risk" } : null;
  const wrap = (view) => (
    <SubPage
      context={context}
      label={t("home_care.door_tag.title")}
      up={{ label: t("home_care.client.page_name"), href: clientHref(organizationId, client.id) }}
      onDesk={screen ? () => go("") : undefined}
      notice={screen === ""}
    >
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  /* Teist vajutust küsiv tegevus: esimene vajutus valmistab ette, teine teeb ära ja viib silla vaatesse. */
  const twice = (key, run) => async () => {
    if (armed !== key) {
      setArmed(key);
      return;
    }
    setArmed("");
    if (await once(run)) setScreen("");
  };

  /* --- Sildi aadress --- */
  if (screen === "url" && tag) {
    return wrap(
      <FormView
        title={t("home_care.door_tag.title")}
        question={t("home_care.door_tag.url_label")}
        form={{
          id: `${formId}-url`,
          onSubmit: async (event) => {
            event.preventDefault();
            await state.copy();
          }
        }}
        fields={[
          { kind: "area", key: "url", label: t("home_care.door_tag.url_label"), value: tag.url, onChange: () => {}, rows: 3, readOnly: true },
          { kind: "note", key: "safe", text: t("home_care.door_tag.safe") }
        ]}
        hint={t("home_care.door_tag.nfc_hint")}
        save={{ label: state.copied ? t("home_care.door_tag.copied") : t("home_care.door_tag.copy") }}
        back={{ label: t("home_care.parts.back"), onBack: () => go("") }}
      />
    );
  }

  /* --- Haldus --- */
  if (screen === "manage" && rights.manage) {
    return wrap(
      <DetailView
        title={t("home_care.door_tag.title")}
        question={client.displayName}
        head={{ name: t("home_care.door_tag.title") }}
        cells={[
          { key: "replace", label: t(armed === "issue" ? "home_care.door_tag.replace_confirm" : "home_care.door_tag.replace"), armed: armed === "issue", onPress: twice("issue", state.issue) },
          { key: "revoke", label: t(armed === "revoke" ? "home_care.door_tag.revoke_confirm" : "home_care.door_tag.revoke"), armed: armed === "revoke", onPress: twice("revoke", state.revoke) }
        ]}
        consequence={armed === "issue" ? t("home_care.door_tag.replace_note") : armed === "revoke" ? t("home_care.door_tag.revoke_note") : ""}
        busy={state.busy}
        notice={fault}
        back={{ label: t("home_care.parts.back"), onBack: () => go("") }}
        mark="manage"
      />
    );
  }

  /* --- Silt --- */
  if (tag) {
    return wrap(
      <TagView
        title={t("home_care.door_tag.title")}
        name={client.displayName}
        qr={{ side: tag.qr.side, d: tag.qr.d, label: t("home_care.door_tag.qr_label") }}
        made={madeLine(t, tag, (value) => formatDateTime(value, timeZone))}
        hint={t("home_care.door_tag.print_hint")}
        actions={[
          { key: "print", label: t("home_care.door_tag.open_print"), primary: true, href: `${state.base}/dokument`, blank: true },
          { key: "url", label: t("home_care.door_tag.url_label"), onPress: () => go("url") },
          rights.manage ? { key: "manage", label: t("home_care.door_tag.manage"), onPress: () => go("manage") } : null
        ].filter(Boolean)}
        busy={state.busy}
        notice={fault}
        back={null}
      />
    );
  }

  /* --- Silti ei ole --- */
  return wrap(
    <DetailView
      title={t("home_care.door_tag.title")}
      question={client.displayName}
      notices={[
        { key: "none", text: t("home_care.door_tag.none") },
        { key: "intro", text: t("home_care.door_tag.intro") }
      ]}
      actions={rights.make ? [{ key: "make", label: t("home_care.door_tag.make"), primary: true, busy: state.busy, onPress: () => once(state.issue) }] : []}
      consequence={rights.make ? "" : t("home_care.client.read_only")}
      busy={state.busy}
      notice={fault}
      mark="no-tag"
    />
  );
}
