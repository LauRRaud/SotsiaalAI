/**
 * SOL-RAGADMIN-04 — KOV RAG reseti serveripoolne kinnitusvärav.
 *
 * MIDA SEE FAIL LAHENDAB. Reset kirjutas pelga `confirmReset: true` peale. Kogu
 * kaitse elas brauseris: dry-run ja `window.confirm`. Server ei nõudnud dry-run'i
 * sõrmejälge, täpset kinnitusteksti ega põhjust — seega **otsene API-kutse jättis
 * kogu kinnitamise vahele** ja kinnitamise ning kirjutuse vahel muutunud plaan
 * võis kustutada rohkem dokumente, kui admin nägi.
 *
 * VÄRAV ON SAMA, MIS TEISTEL HÄVITAVATEL ADMINITOIMINGUTEL — mitte sarnane, vaid
 * seesama kood (`lib/admin/dangerousActionGate.js`). Teine koopia oleks tähendanud,
 * et HMAC, TTL ja sõrmejälje kuju lähevad esimese muudatusega lahku ja üks pool
 * jääb nõrgemaks, ilma et keegi seda näeks.
 *
 * MIS ON SÕRMEJÄLJES JA MIKS. Sõrmejälg kannab TÄPSELT seda, mida admin kinnitab:
 * millise KOV-i, millise kihi, MILLISED doc_id-d kustutatakse, MILLISED
 * snapshot'id arhiveeritakse ja kas admini rida lähtestatakse — pluss põhjus.
 * Kui plaan kinnitamise ja kirjutuse vahel MUUTUB (dokument tekib või kaob),
 * ei kehti token enam. Paljas arv siin ei piisaks: „13 dokumenti" jääb „13-ks"
 * ka siis, kui üks vahetub teise vastu.
 *
 * ÜHEKORDNE KASUTUS on auditirea primaarvõti (`jti`), seega teine kasutus põrkab
 * andmebaasi vastu ka üle protsesside ja restartide. Ja seesama rida ON hävitava
 * toimingu jälg — seni ei jäänud KOV RAG resetist ühtegi auditirida maha.
 */

import {
  assertPreview,
  createPreview,
  normalizeReason,
  requestAuditFields,
  requireExecutionFields,
  reserveDangerousActionPreview
} from "@/lib/admin/dangerousActionGate";

export const KOV_RAG_RESET_KIND = "kov_rag_state_reset";
export const KOV_RAG_RESET_AUDIT_ACTION = "ADMIN_KOV_RAG_STATE_RESET";

/**
 * Mõju arv, mis läheb kinnitusteksti sisse. Kolm hävitavat poolt kokku: kustutatud
 * RAG-dokumendid, arhiveeritud snapshot'id ja admini rea lähtestus.
 */
export function kovRagResetImpact(plan) {
  const actions = plan?.planned_actions || {};
  const docs = Array.isArray(actions.delete_rag_documents_via_service)
    ? actions.delete_rag_documents_via_service.length
    : 0;
  const snapshots = Array.isArray(actions.archive_active_source_package_snapshots)
    ? actions.archive_active_source_package_snapshots.length
    : 0;
  const adminRow = actions.reset_kov_admin_state ? 1 : 0;
  return docs + snapshots + adminRow;
}

/** Tekst, mille admin peab TÄPSELT kirjutama. */
export function kovRagResetConfirmation(slug, impact) {
  return `RESET KOV RAG ${String(slug || "").trim()} ${Number(impact || 0)}`;
}

/**
 * Sõrmejälg on TÄISLOEND, mitte kokkuvõte — vt failipea. Järjestus on plaanis juba
 * stabiilne (`.sort()`), aga siin sorditakse uuesti, sest sõrmejälg ei tohi
 * sõltuda kutsuja järjekorrast.
 */
export function kovRagResetFingerprint(plan, reason) {
  const actions = plan?.planned_actions || {};
  return {
    slug: String(plan?.municipality?.slug || "").trim(),
    layer: String(plan?.cleanup_layer || "all"),
    docIds: [...(actions.delete_rag_documents_via_service || [])].sort(),
    snapshotIds: [...(actions.archive_active_source_package_snapshots || [])].sort(),
    adminRowId: actions.reset_kov_admin_state?.admin_id || null,
    resetsAdminRow: Boolean(actions.reset_kov_admin_state),
    reason
  };
}

/**
 * DRY-RUN. Tagastab plaani kõrvale allkirjastatud token'i, täpse kinnitusteksti ja
 * aegumise. Põhjus on siin KOHUSTUSLIK, sest ta läheb sõrmejälje sisse: hiljem
 * teise põhjusega kirjutamine ei ole see, mida keegi kinnitas.
 */
export function previewKovRagReset({ plan, body, now = new Date(), env = process.env }) {
  const reason = normalizeReason(body?.reason);
  const impact = kovRagResetImpact(plan);
  return {
    reset_gate: {
      impact,
      reason,
      ...createPreview({
        kind: KOV_RAG_RESET_KIND,
        fingerprint: kovRagResetFingerprint(plan, reason),
        impact,
        confirmation: kovRagResetConfirmation(plan?.municipality?.slug, impact),
        now,
        env
      })
    }
  };
}

/**
 * KIRJUTUSE VÄRAV. Kutsutakse VÄRSKELT arvutatud plaaniga ja see plaan on seesama,
 * mis läheb täitmisele — muidu kontrolliks värav ühte plaani ja server täidaks
 * teist, mis on täpselt see viga, mille vastu ta on.
 *
 * @returns {Promise<{ jti: string, reason: string, impact: number }>}
 */
export async function assertKovRagResetGate({
  db,
  plan,
  body,
  actorUserId = null,
  request = null,
  now = new Date(),
  env = process.env
}) {
  const reason = requireExecutionFields(body || {});
  const impact = kovRagResetImpact(plan);
  const slug = String(plan?.municipality?.slug || "").trim();

  const preview = assertPreview({
    kind: KOV_RAG_RESET_KIND,
    fingerprint: kovRagResetFingerprint(plan, reason),
    impact,
    expectedConfirmation: kovRagResetConfirmation(slug, impact),
    confirmation: body?.confirmation,
    previewToken: body?.previewToken,
    now,
    env
  });

  /* Broneerimine on ÜHTLASI jälg. Ta sünnib enne tööd, sest hävitava toimingu
     jälg peab olema olemas ka siis, kui töö poole peal katkeb. */
  await reserveDangerousActionPreview({
    db,
    jti: preview.jti,
    data: {
      actorUserId,
      action: KOV_RAG_RESET_AUDIT_ACTION,
      resourceType: "MunicipalityKovAdmin",
      resourceId: slug,
      ...requestAuditFields(request),
      meta: {
        reason,
        layer: String(plan?.cleanup_layer || "all"),
        impact,
        plannedDocCount: (plan?.planned_actions?.delete_rag_documents_via_service || []).length,
        plannedSnapshotCount: (plan?.planned_actions?.archive_active_source_package_snapshots || []).length,
        resetsAdminRow: Boolean(plan?.planned_actions?.reset_kov_admin_state),
        result: { status: "started" }
      }
    }
  });

  return { jti: preview.jti, reason, impact };
}

/**
 * Tulemuse kirjapanek samale auditireale. EI VISKA: jälje täiendamise tõrge ei
 * tohi muuta seda, mis päriselt juhtus.
 */
export async function recordKovRagResetOutcome({ db, jti, result }) {
  if (!jti) return null;
  try {
    const row = await db.dataAuditLog.findUnique({ where: { id: jti }, select: { meta: true } });
    const meta = row?.meta && typeof row.meta === "object" ? row.meta : {};
    return await db.dataAuditLog.update({
      where: { id: jti },
      data: { meta: { ...meta, result } }
    });
  } catch {
    return null;
  }
}
