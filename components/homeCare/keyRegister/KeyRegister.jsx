"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import SubPage from "../page/SubPage";
import { REGISTER_PAGE, keyLinks, registerMainRows } from "./registerRows";

/**
 * Võtmeraamatu leht hooldusjuhile: siin pannakse vaated kokku, päringuid ei ole. Ees
 * on üks vaade korraga: esimene vaade (tagastamata võtmed, kõik võtmed) ja üks
 * loend link-ridadena kliendi lehele (neli rida korraga, „Näita veel" näitab
 * ülejäänud). Võtme annab üle või lõpetab kliendi lehel.
 *
 * Lingid kliendi lehele ei eellaadi: lehe avamine jätab avamislogisse rea.
 *
 * `register`: { keys, unreturned, total, truncated }.
 */
export default function KeyRegister({ context, register }) {
  const { t } = useI18n();
  const organizationId = context.organization.id;
  /* "" (esimene vaade), "unreturned" või "register". */
  const [screen, setScreen] = useState("");
  const [expanded, setExpanded] = useState({});
  const rootRef = useScreenFocus(screen);

  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.keys.register_title")} onDesk={screen ? () => setScreen("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );

  /* --- Üks loend --- */
  if (screen === "unreturned" || screen === "register") {
    const items = screen === "unreturned" ? register.unreturned : register.keys;
    const links = keyLinks(items, { t, organizationId });
    return wrap(
      <RowsView
        title={t("home_care.keys.register_title")}
        question={`${t(`home_care.keys.${screen}_title`)}${items.length ? ` · ${items.length}` : ""}`}
        rows={[]}
        links={expanded[screen] ? links : links.slice(0, REGISTER_PAGE)}
        empty={items.length ? "" : t(`home_care.keys.${screen}_empty`)}
        hint={register.truncated ? t("home_care.keys.truncated", { count: register.total }) : ""}
        more={!expanded[screen] && links.length > REGISTER_PAGE ? { label: t("home_care.home.more"), onMore: () => setExpanded((now) => ({ ...now, [screen]: true })) } : null}
        back={{ label: t("home_care.parts.back"), onBack: () => setScreen("") }}
        mark={`keys-${screen}`}
      />
    );
  }

  /* --- Esimene vaade --- */
  return wrap(
    <RowsView
      title={t("home_care.keys.register_title")}
      question={t("home_care.keys.register_title")}
      lead={t("home_care.keys.register_intro")}
      rows={registerMainRows(t, register)}
      onOpen={setScreen}
      hint={register.truncated ? t("home_care.keys.truncated", { count: register.total }) : ""}
      mark="keys"
    />
  );
}
