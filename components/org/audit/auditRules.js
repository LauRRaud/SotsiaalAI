/**
 * Auditi osa (`/org/<id>/audit`) reeglid ilma joonistamiseta: sündmuse rida.
 *
 * Audit näitab organisatsiooni enda haldustoiminguid. Ridadel ei ole IP-d,
 * seadet ega ühtegi sisuvälja.
 *
 * TOIMINGU NIMI ON LAUSE, mitte sisemine võti. Vana leht näitas toorest nime
 * (`org.member_suspended`) ja objekti liiki (`ORGANIZATION_MEMBERSHIP`). Iga
 * toiming saab kataloogist lause (`org.audit.actions.<nimi>`); toiming, millel
 * lauset veel ei ole (teine töö lisab toiminguid juurde), saab üldnime, mitte
 * toore võtme: koduteenuse toiming „Koduteenuse toiming", muu „Muu
 * haldustoiming". Objekti liiki eraldi ei näidata: lause ütleb selle juba.
 *
 * Leht (`../OrgAuditClient.jsx`) hoiab olekut ja teeb päringu, vaade
 * (`./AuditViews.jsx`) joonistab. Test: `tests/org-admin-views.test.mjs`.
 */

import { stampOf } from "../orgRules.js";

/** Toimingu lause võti: `org.member_suspended` → `org.audit.actions.member_suspended`. */
export function actionKey(action) {
  const name = String(action || "").replace(/^org\./, "");
  return /^[a-z0-9_]+$/.test(name) ? `org.audit.actions.${name}` : "";
}

/**
 * Sündmuse rida: mis juhtus ja millal. `t` tagastab puuduva võtme korral võtme
 * enda; siis on real üldnimi.
 */
export function auditRow(event, { t }) {
  const key = actionKey(event?.action);
  const label = key ? t(key) : "";
  const time = stampOf(event?.createdAt);
  return {
    id: String(event?.id || ""),
    title: label && label !== key ? label : t(String(event?.action || "").startsWith("org.home_care_") ? "org.audit.home_care" : "org.audit.other"),
    time,
    /* Loetamatu aeg jääb tühjaks (`time` on siis tühi), mitte ei viska viga. */
    createdAt: time ? new Date(event.createdAt).toISOString() : ""
  };
}
