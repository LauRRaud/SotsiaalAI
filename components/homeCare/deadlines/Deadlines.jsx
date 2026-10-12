"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { DetailView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { clientHref, formatDateTime } from "../homeCareClient";
import SubPage from "../page/SubPage";
import { DEADLINES_PAGE, deadlineSections, sectionRows, talkRow, talkRows } from "./deadlineRows";
import { useTalkRequests } from "./useTalkRequests";

/**
 * Hooldusjuhi tähtaegade leht: konks hoiab rääkimise soove ja päringut, siin
 * pannakse vaated kokku. Ees on üks vaade korraga: nimekirjad, milles midagi on
 * (rääkimise soovid on kõige ees, sest inimene ootab), üks nimekiri ridadena (iga
 * rida on link kliendi lehele või sinna, kus asi tehakse) või üks rääkimise soov.
 *
 * Nimekirjad on need, mida muidu peab hooldusjuht ise meeles pidama. Lingid
 * kliendi lehele ja alalehtedele ei eellaadi: lehe avamine jätab avamislogisse rea.
 *
 * `deadlines`: nimekirjad (`clientCount` ja `truncated` ütlevad, mitut klienti loeti).
 */
export default function Deadlines({ context, deadlines }) {
  const { t, locale } = useI18n();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const talk = useTalkRequests({ organizationId, initial: deadlines.talkRequestsOpen || [] });
  /* "" (nimekirjad), "talk", "talk:<id>" või nimekirja võti. */
  const [screen, setScreen] = useState("");
  const [expanded, setExpanded] = useState({});
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();

  const go = (next) => {
    talk.setError("");
    setScreen(next);
  };
  const fault = talk.error ? { text: talk.error, tone: "risk" } : null;
  const moment = (value) => formatDateTime(value, timeZone);
  const sections = deadlineSections(deadlines, { t, locale, organizationId, moment });
  const [kind, id] = screen.split(":");
  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.deadlines.title")} onDesk={screen ? () => go("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  const pageOf = (key, rows) => {
    const shown = expanded[key] ? rows : rows.slice(0, DEADLINES_PAGE);
    const more = !expanded[key] && rows.length > DEADLINES_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded((now) => ({ ...now, [key]: true })) } : null;
    return { rows: shown, more };
  };
  const back = { label: t("home_care.parts.back"), onBack: () => go("") };

  /* --- Üks rääkimise soov --- */
  const request = kind === "talk" && id ? talk.items.find((item) => item.id === id) : null;
  if (request) {
    const row = talkRows([request], { t, moment })[0];
    return wrap(
      <DetailView
        title={t("home_care.deadlines.title")}
        question={t("home_care.talk.list_title")}
        head={{ name: row.title }}
        notices={[{ key: "line", text: row.line }]}
        cells={context.writable !== false ? [{ key: "handled", label: t("home_care.talk.handled"), onPress: async () => ((await once(() => talk.handled(request))) ? go("talk") : null) }] : []}
        links={[{ key: "client", title: t("home_care.client.page_name"), href: clientHref(organizationId, request.client.id) }]}
        busy={talk.busy}
        notice={fault}
        back={{ label: t("home_care.parts.back"), onBack: () => go("talk") }}
        mark="talk-request"
      />
    );
  }

  /* --- Rääkimise soovid --- */
  if (screen === "talk" && talk.items.length) {
    const page = pageOf("talk", talkRows(talk.items, { t, moment }).map((row) => ({ ...row, open: context.writable !== false })));
    return wrap(<RowsView title={t("home_care.deadlines.title")} question={`${t("home_care.talk.list_title")} · ${talk.items.length}`} rows={page.rows} onOpen={(key) => go(`talk:${key}`)} hint={t("home_care.talk.list_hint")} more={page.more} busy={talk.busy} notice={fault} back={back} mark="talk" />);
  }

  /* --- Üks nimekiri --- */
  const section = sections.find((item) => item.key === screen);
  if (section) {
    const page = pageOf(section.key, section.items);
    return wrap(<RowsView title={t("home_care.deadlines.title")} question={`${section.title} · ${section.items.length}`} rows={[]} links={page.rows} more={page.more} back={back} mark="section" />);
  }

  /* --- Nimekirjad --- */
  const rows = [talkRow(talk.items, { t }), ...sectionRows(sections)].filter(Boolean);
  return wrap(
    <RowsView
      title={t("home_care.deadlines.title")}
      question={t("home_care.deadlines.title")}
      lead={t("home_care.deadlines.intro", { count: deadlines.clientCount })}
      rows={rows}
      onOpen={go}
      empty={t("home_care.deadlines.none_all")}
      hint={[deadlines.truncated ? t("home_care.deadlines.truncated", { count: deadlines.clientCount }) : "", t("home_care.deadlines.feedback_hint")].filter(Boolean).join(" ")}
      mark="deadlines"
    />
  );
}
