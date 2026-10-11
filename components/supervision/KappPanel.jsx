"use client";

/**
 * Protsessi laua osa „Kinnitatud väljundite kapp" (Q2.6 vaade 8).
 *
 * Puhas lugemisvaade: kinnitatud kokkuvõtted ja kehtiv kontrakt. Märgis ütleb,
 * MIKS need siin on: need jäävad alles ka pärast sulgemist (erinevalt jagatud
 * toorsisust, mis kustub).
 *
 * KUJU (09.10). Paneel näitas kõiki tekste korraga üksteise all kaartides. Nüüd
 * on kapis loend ja üks tekst avaneb korraga. Vaade on failis
 * ./process/ProcessViews.jsx, read teeb ./process/processRows.js.
 */

import { useMemo, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { CabinetView } from "./process/ProcessViews";
import { cabinetRows } from "./process/processRows";

export default function KappPanel({ process }) {
  const { t, locale } = useI18n();
  const [openId, setOpenId] = useState("");
  const rows = useMemo(() => cabinetRows(process, { t, locale }), [locale, process, t]);

  return (
    <CabinetView
      t={t}
      rows={rows}
      row={rows.find((row) => row.id === openId) || null}
      onOpen={setOpenId}
      onBack={() => setOpenId("")}
    />
  );
}
