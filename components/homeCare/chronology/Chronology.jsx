"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { FormView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { clientHref, formatDateTime, homeCareBase } from "../homeCareClient";
import SubPage from "../page/SubPage";
import { ENTRIES_PAGE, choiceOf, createReady, detailsReady, entryRows, isEdited, shownText } from "./chronologyRows";
import { useChronology } from "./useChronology";

/**
 * Kronoloogia koostamise leht hooldusjuhile: konks hoiab valikuid ja päringuid,
 * siin pannakse vaated kokku. Ees on üks vaade korraga: ajavahemik, kirjed
 * (valitud kirjed on märgitud), üks kirje (lisa dokumenti ja muuda väljastatavat
 * teksti), dokumendi andmete kaks vaadet (kes küsis ja mis alusel; viide ja
 * kokkuvõte) ning koostatud dokument.
 *
 * Dokumenti lähevad AINULT valitud kirjed; piiratud nähtavusega kirjed on
 * vaikimisi välja jäetud. Teksti muutmine siin päeviku kirjet ei muuda. Leht
 * hoiab kõik valikud, nii et vaate vahetus ei kaota midagi. Koostatud dokument
 * avaneb uuel vahelehel.
 *
 * `client`: { id, displayName }; `context.writable`: asutus on kirjutatav.
 */
export default function Chronology({ context, client }) {
  const { t } = useI18n();
  const formId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const chronology = useChronology({ organizationId, client });
  /* "" (ajavahemik), "entries", "entry:<id>", "who", "extra" või "release". */
  const [screen, setScreen] = useState("");
  const [expanded, setExpanded] = useState(false);
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut ega teist dokumenti. */
  const once = useSendOnce();

  const go = (next) => {
    chronology.setError("");
    setScreen(next);
  };
  const fault = chronology.error ? { text: chronology.error, tone: "risk" } : null;
  const back = (target, label = t("home_care.parts.back")) => ({ label, onBack: () => go(target) });
  const moment = (value) => formatDateTime(value, timeZone);
  const { draft, items, choices, selected, details, release } = chronology;
  const [kind, id] = screen.split(":");
  const wrap = (view) => (
    <SubPage
      context={context}
      label={t("home_care.chronology.title")}
      up={{ label: t("home_care.client.page_name"), href: clientHref(organizationId, client.id) }}
      onDesk={screen ? () => go("") : undefined}
      notice={screen === ""}
    >
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  const entriesTitle = t("home_care.chronology.entries_title", { selected: selected.length, total: items.length });

  /* --- Kirjed --- */
  if (screen === "entries" && draft) {
    const rows = entryRows(items, choices, { t, moment });
    const shown = expanded ? rows : rows.slice(0, ENTRIES_PAGE);
    return wrap(
      <RowsView
        title={t("home_care.chronology.title")}
        question={entriesTitle}
        rows={shown}
        onOpen={(key) => go(`entry:${key}`)}
        empty={t("home_care.chronology.empty")}
        more={!expanded && rows.length > ENTRIES_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded(true) } : null}
        actions={items.length ? [{ key: "next", label: t("home_care.parts.next"), primary: true, disabled: selected.length === 0, onPress: () => go("who") }] : []}
        back={back("")}
        mark="entries"
      />
    );
  }

  const item = kind === "entry" ? items.find((entry) => entry.entryId === id) : null;
  if (item) {
    const choice = choiceOf(choices, item.entryId);
    const edited = isEdited(item, choice);
    return wrap(
      <FormView
        title={t("home_care.chronology.title")}
        question={`${moment(item.occurredAt)} · ${item.authorName}`}
        form={{
          id: `${formId}-entry`,
          onSubmit: (event) => {
            event.preventDefault();
            go("entries");
          }
        }}
        fields={[
          item.coordinatorOnly ? { kind: "note", key: "restricted", text: t("home_care.chronology.restricted") } : null,
          { kind: "check", key: "include", label: t("home_care.chronology.include"), value: choice.included, onChange: (value) => chronology.patchChoice(item.entryId, { included: value }) },
          choice.included
            ? {
                kind: "area",
                key: "text",
                label: t("home_care.chronology.text_label"),
                value: shownText(item, choice),
                onChange: (value) => chronology.patchChoice(item.entryId, { text: value }),
                max: HOME_CARE_LIMITS.ENTRY_TEXT_MAX,
                rows: 6
              }
            : { kind: "note", key: "text_muted", text: shownText(item, choice) }
        ].filter(Boolean)}
        save={{ label: t("home_care.parts.done") }}
        extra={edited ? [{ key: "reset", label: t("home_care.chronology.reset_text"), onPress: () => chronology.patchChoice(item.entryId, { text: null, editing: false }) }] : []}
        notice={fault}
        back={back("entries")}
      />
    );
  }

  /* --- Dokumendi andmed: kaks vaadet --- */
  if (screen === "who" && draft && items.length) {
    return wrap(
      <FormView
        title={t("home_care.chronology.title")}
        question={t("home_care.chronology.details_title")}
        form={{
          id: `${formId}-who`,
          onSubmit: (event) => {
            event.preventDefault();
            if (detailsReady(details)) go("extra");
          }
        }}
        fields={[
          { kind: "text", key: "requester", label: t("home_care.chronology.requester"), value: details.requester, onChange: chronology.setRequester, max: HOME_CARE_LIMITS.CHRONOLOGY_LINE_MAX, required: true },
          { kind: "note", key: "requester_hint", text: t("home_care.chronology.requester_hint") },
          { kind: "text", key: "basis", label: t("home_care.chronology.basis"), value: details.basis, onChange: chronology.setBasis, max: HOME_CARE_LIMITS.CHRONOLOGY_LINE_MAX, required: true },
          { kind: "note", key: "basis_hint", text: t("home_care.chronology.basis_hint") }
        ]}
        save={{ label: t("home_care.parts.next"), disabled: !detailsReady(details) }}
        notice={fault}
        back={back("entries")}
      />
    );
  }

  if (screen === "extra" && draft && items.length) {
    return wrap(
      <FormView
        title={t("home_care.chronology.title")}
        question={t("home_care.chronology.details_title")}
        form={{
          id: `${formId}-extra`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (createReady({ selected, release, writable: context.writable }) && detailsReady(details) && (await once(chronology.create))) go("release");
          }
        }}
        fields={[
          { kind: "text", key: "registry_ref", label: t("home_care.chronology.registry_ref"), value: details.registryRef, onChange: chronology.setRegistryRef, max: HOME_CARE_LIMITS.CHRONOLOGY_REF_MAX },
          { kind: "area", key: "summary", label: t("home_care.chronology.summary"), value: details.summary, onChange: chronology.setSummary, max: HOME_CARE_LIMITS.ENTRY_TEXT_MAX, rows: 4 }
        ]}
        hint={context.writable ? "" : t("home_care.client.read_only")}
        save={{ label: t("home_care.chronology.create"), busy: chronology.busy, disabled: !createReady({ selected, release, writable: context.writable }) }}
        notice={fault}
        back={back("who")}
      />
    );
  }

  /* --- Koostatud dokument --- */
  if (screen === "release" && release) {
    return wrap(
      <RowsView
        title={t("home_care.chronology.title")}
        question={t("home_care.chronology.created")}
        rows={[]}
        hint={t("home_care.chronology.print_hint")}
        links={[
          { key: "document", title: t("home_care.chronology.open_document"), href: `${homeCareBase(organizationId)}/valjastused/${release.id}/dokument`, blank: true },
          { key: "releases", title: t("home_care.releases.link"), href: `/org/${organizationId}/koduteenus/valjastused` }
        ]}
        back={back("extra")}
        mark="release"
      />
    );
  }

  /* --- Ajavahemik --- */
  return wrap(
    <FormView
      title={t("home_care.chronology.title")}
      question={client.displayName}
      lead={t("home_care.chronology.period_title")}
      form={{
        id: `${formId}-period`,
        onSubmit: async (event) => {
          event.preventDefault();
          if (chronology.from && chronology.to && (await once(chronology.loadDraft))) {
            setExpanded(false);
            go("entries");
          }
        }
      }}
      fields={[
        { kind: "day", key: "from", label: t("home_care.filter.from"), value: chronology.from, onChange: chronology.setFrom },
        { kind: "day", key: "to", label: t("home_care.filter.to"), value: chronology.to, onChange: chronology.setTo }
      ]}
      hint={t("home_care.chronology.intro")}
      save={{ label: t("home_care.chronology.load"), busy: chronology.busy, disabled: !chronology.from || !chronology.to }}
      extra={draft ? [{ key: "entries", label: entriesTitle, onPress: () => go("entries") }] : []}
      notice={fault}
    />
  );
}
