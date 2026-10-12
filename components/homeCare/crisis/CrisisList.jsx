"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { DetailView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import SubPage from "../page/SubPage";
import { planDayLabel } from "../plan/planRows";
import { CRISIS_PAGE, crisisLinks, crisisMainRows, figureNotices, groupTimeLine } from "./crisisRows";
import { useCrisisSheet } from "./useCrisisSheet";

/**
 * Kriisinimekirja leht hooldusjuhile: siin pannakse vaated kokku, päringuid ei ole.
 * Ees on üks vaade korraga: esimene vaade (arvud riskianalüüsi jaoks, kolm rühma,
 * hindamata kliendid ja nupp tabelifaili jaoks), arvud ja üks rühm link-ridadena
 * kliendi lehele (neli rida korraga, „Näita veel" näitab ülejäänud).
 *
 * Fail tehakse samast nimekirjast ja sisaldab ka arve; seda saab välja printida,
 * sest kriisis ei pruugi rakendus töötada. Lingid kliendi lehele ei eellaadi: lehe
 * avamine jätab avamislogisse rea.
 *
 * `list`: { today, clientCount, truncated, groups, unset, figures }.
 */
export default function CrisisList({ context, list }) {
  const { t } = useI18n();
  const organizationId = context.organization.id;
  const sheet = useCrisisSheet(list);
  /* "" (esimene vaade), "figures", "DAILY", "WEEKLY", "SELF" või "unset". */
  const [screen, setScreen] = useState("");
  const [expanded, setExpanded] = useState({});
  const rootRef = useScreenFocus(screen);

  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.crisis.list_title")} onDesk={screen ? () => setScreen("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  const back = { label: t("home_care.parts.back"), onBack: () => setScreen("") };

  /* --- Arvud riskianalüüsi jaoks --- */
  if (screen === "figures" && list.figures) {
    return wrap(<DetailView title={t("home_care.crisis.list_title")} question={t("home_care.crisis.figures.title")} notices={figureNotices(t, list)} consequence={t("home_care.crisis.figures.hint")} back={back} mark="crisis-figures" />);
  }

  /* --- Üks rühm või hindamata kliendid --- */
  const group = list.groups.find((item) => item.level === screen);
  if (group || screen === "unset") {
    const items = group ? group.clients : list.unset;
    const links = crisisLinks(items, { t, organizationId });
    const title = group ? t(`home_care.crisis.levels.${group.level}`) : t("home_care.crisis.unset_title");
    return wrap(
      <RowsView
        title={t("home_care.crisis.list_title")}
        question={`${title}${items.length ? ` · ${items.length}` : ""}`}
        lead={group && items.length ? groupTimeLine(t, group) : ""}
        rows={[]}
        links={expanded[screen] ? links : links.slice(0, CRISIS_PAGE)}
        empty={items.length ? "" : t(group ? "home_care.crisis.group_empty" : "home_care.crisis.unset_empty")}
        more={!expanded[screen] && links.length > CRISIS_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded((now) => ({ ...now, [screen]: true })) } : null}
        back={back}
        mark={`crisis-${screen}`}
      />
    );
  }

  /* --- Esimene vaade --- */
  return wrap(
    <RowsView
      title={t("home_care.crisis.list_title")}
      question={t("home_care.crisis.list_title")}
      lead={t("home_care.crisis.list_intro", { count: list.clientCount, date: planDayLabel(list.today) })}
      rows={crisisMainRows(t, list)}
      onOpen={setScreen}
      hint={[list.truncated ? t("home_care.crisis.truncated", { count: list.clientCount }) : "", t("home_care.crisis.download_hint")].filter(Boolean).join(" ")}
      actions={[{ key: "download", label: t("home_care.crisis.download"), primary: true, disabled: !list.clientCount, onPress: sheet.download }]}
      mark="crisis"
    />
  );
}
