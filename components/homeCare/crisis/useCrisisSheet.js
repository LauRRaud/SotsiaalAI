"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { composeCrisisSheet } from "@/lib/homeCare/crisisSheet";

/**
 * Kriisinimekiri tabelifailina: fail tehakse brauseris nähtavast nimekirjast ja
 * salvestatakse; päringut ei ole. Vaated on ühised (../client/PartViews.jsx), kokku
 * paneb need ./CrisisList.jsx.
 */
export function useCrisisSheet(list) {
  const { t } = useI18n();

  const download = () => {
    const blob = new Blob([composeCrisisSheet(t, list)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kriisinimekiri-${list.today}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return { download };
}
