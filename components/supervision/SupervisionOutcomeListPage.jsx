"use client";

/**
 * „Minu paketid" (M12 loend): tee `/supervisioon/valjundid`.
 *
 * Isiklikud püsiväljundid elavad protsessist ÜLE, seepärast on neil oma tee,
 * mitte ainult link suletud protsessist. Loend ise on supervisiooni laua üks
 * osa (`SupervisionHomePage.jsx`): siin avaneb sama laud pakkide osas. Eraldi
 * leht sama loendiga oleks kaks kohta, mis lähevad lahku, ja ühe vaatega leht
 * jätaks kiirmenüü ilma nimeta.
 */

import SupervisionHomePage from "./SupervisionHomePage";

export default function SupervisionOutcomeListPage() {
  return <SupervisionHomePage initialPart="outcomes" />;
}
