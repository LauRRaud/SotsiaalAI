"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { DetailView, FormView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { formatDateTime } from "../homeCareClient";
import SubPage from "../page/SubPage";
import { EXPORT_PAGE, contentRows, excludedRows, exportMainRows, reasonChoices, recentRows, sizeLabel } from "./exportRows";
import { useExportFile } from "./useExportFile";

/**
 * Täieliku väljavõtte leht kogu asutuse hooldusjuhile: konks hoiab põhjust, päringut
 * ja valmis faili, siin pannakse vaated kokku. Ees on üks vaade korraga: esimene vaade
 * (mis failis on, mis ei ole, varasemad väljavõtted ning nupp „Koosta väljavõte"),
 * need kolm loendit omaette, põhjus, kinnitus, koostamine ja valmis fail.
 *
 * Fail sisaldab kõigi klientide andmeid, seetõttu on tegemine kolmes sammus (põhjus,
 * kinnitus, fail). Salvestamine algab ise, aga nupp „Salvesta fail" jääb vaatesse:
 * brauser võib pika koostamise järel automaatse allalaadimise keelata ja siis ei tohi
 * leht väita, et fail on alla laaditud. Kui kontrollsummat ei saa arvutada, öeldakse
 * seda välja, mitte ei näidata serveri summat nagu kontrollitut.
 *
 * `initial`: { counts, recent }.
 */
export default function ExportFile({ context, initial }) {
  const { t } = useI18n();
  const formId = useId();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const state = useExportFile({ organizationId, initial });
  const { data, done } = state;
  /* "" (esimene vaade), "contents", "excluded", "recent", "reason", "confirm" või "done". */
  const [screen, setScreen] = useState("");
  const [expanded, setExpanded] = useState({});
  const rootRef = useScreenFocus(screen);
  const savedRef = useRef("");
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();

  /* Valmis fail hakkab ise salvestuma; kui brauser seda ei luba, jääb nupp. */
  useEffect(() => {
    if (screen !== "done" || !done?.url || savedRef.current === done.url) return;
    savedRef.current = done.url;
    rootRef.current?.querySelector("[data-part-action=save_file]")?.click();
  }, [screen, done?.url, rootRef]);

  const go = (next) => {
    state.setError("");
    setScreen(next);
  };
  const fault = state.error ? { text: state.error, tone: "risk" } : null;
  const moment = (value) => formatDateTime(value, timeZone);
  const back = (target, label = t("home_care.parts.back")) => ({ label, onBack: () => go(target) });
  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.export.title")} onDesk={screen ? () => go("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  const pageOf = (key, rows) => {
    const shown = expanded[key] ? rows : rows.slice(0, EXPORT_PAGE);
    const more = !expanded[key] && rows.length > EXPORT_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded((now) => ({ ...now, [key]: true })) } : null;
    return { rows: shown, more };
  };

  /* --- Koostamine --- */
  if (state.working) {
    return wrap(<DetailView title={t("home_care.export.title")} question={t("home_care.export.make_title")} notices={[{ key: "working", text: t("home_care.export.working") }]} busy mark="export-working" />);
  }

  /* --- Valmis fail --- */
  if (screen === "done" && done) {
    return wrap(
      <DetailView
        title={t("home_care.export.title")}
        head={{ name: done.name }}
        notices={[
          { key: "ready", text: t("home_care.export.ready", { rows: done.rows, size: sizeLabel(t, done.bytes) }) },
          { key: "checksum", text: t("home_care.export.checksum", { sha: done.sha }) }
        ]}
        consequence={done.verified ? t("home_care.export.checksum_hint") : ""}
        notice={done.verified ? null : { text: t("home_care.export.not_verified"), tone: "risk" }}
        actions={[{ key: "save_file", label: t("home_care.export.save_file"), href: done.url, download: done.name, primary: true }]}
        back={back("", t("home_care.parts.done"))}
        mark="export-done"
      />
    );
  }

  /* --- Kinnitus --- */
  if (screen === "confirm" && state.reason) {
    return wrap(
      <DetailView
        title={t("home_care.export.title")}
        question={t("home_care.export.make_title")}
        notices={[
          { key: "reason", text: t(`home_care.export.reasons.${state.reason}`) },
          { key: "confirm", text: t("home_care.export.confirm_notice") }
        ]}
        actions={[
          {
            key: "confirm",
            label: t("home_care.export.confirm"),
            primary: true,
            /* Valmis fail viib valmis-vaatesse; tõrge jääb kinnituse vaatesse, kust saab uuesti proovida. */
            onPress: async () => {
              if (await once(state.download)) setScreen("done");
            }
          }
        ]}
        notice={fault}
        back={back("reason", t("home_care.entry.cancel"))}
        mark="export-confirm"
      />
    );
  }

  /* --- Põhjus --- */
  if (screen === "reason") {
    return wrap(
      <FormView
        title={t("home_care.export.title")}
        question={t("home_care.export.make_title")}
        form={{
          id: `${formId}-reason`,
          onSubmit: (event) => {
            event.preventDefault();
            if (state.reason) go("confirm");
          }
        }}
        fields={[{ kind: "pick", key: "reason", label: t("home_care.export.reason_label"), options: reasonChoices(t), value: state.reason, onChange: state.setReason, columns: 2 }]}
        hint={t("home_care.export.reason_hint")}
        save={{ label: t("home_care.export.start"), disabled: !state.reason }}
        notice={fault}
        back={back("")}
      />
    );
  }

  /* --- Mis failis on --- */
  if (screen === "contents") {
    return wrap(<RowsView title={t("home_care.export.title")} question={t("home_care.export.contents_title")} rows={contentRows(t, data.counts)} hint={t("home_care.export.contents_more")} back={back("")} mark="export-contents" />);
  }

  /* --- Mida failis ei ole --- */
  if (screen === "excluded") {
    const page = pageOf("excluded", excludedRows(t));
    return wrap(<RowsView title={t("home_care.export.title")} question={t("home_care.export.excluded_title")} rows={page.rows} more={page.more} back={back("")} mark="export-excluded" />);
  }

  /* --- Varasemad väljavõtted --- */
  if (screen === "recent") {
    const page = pageOf("recent", recentRows(t, data.recent, { moment }));
    return wrap(<RowsView title={t("home_care.export.title")} question={t("home_care.export.recent_title")} rows={page.rows} empty={t("home_care.export.recent_empty")} more={page.more} back={back("")} mark="export-recent" />);
  }

  /* --- Esimene vaade --- */
  return wrap(
    <RowsView
      title={t("home_care.export.title")}
      question={t("home_care.export.title")}
      lead={t("home_care.export.intro")}
      rows={exportMainRows(t, data, done)}
      onOpen={go}
      hint={t("home_care.export.who_hint")}
      actions={[
        {
          key: "make",
          label: t("home_care.export.start"),
          primary: true,
          /* Iga väljavõte küsib oma põhjust. */
          onPress: () => {
            state.setReason("");
            go("reason");
          }
        }
      ]}
      notice={fault}
      mark="export"
    />
  );
}
