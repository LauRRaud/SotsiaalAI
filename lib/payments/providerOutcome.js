import { PaymentStatus } from "@/generated/prisma/client";

/**
 * SOL-PAY-02 — EBAMÄÄRANE TULEMUS EI OLE EITUS.
 *
 * MIS OLI VALESTI. Kolm makseraja `catch`-i (tellimuse init, kordusmakse worker,
 * sponsorkutse init) märkisid IGA erandi peale kohaliku makse `FAILED`-iks.
 * Webhook loeb `FAILED` lõplikuks ja lubab sealt edasi ainult `REFUNDED`-i,
 * seega hilisem `PAID` kinnitati 200-ga, aga ei aktiveerinud midagi. Provider
 * võis makse vastu võtta ja meie kirjutasime tema kohta „ebaõnnestus" —
 * kasutaja raha oli võetud, ligipääsu ei olnud, ja järgmine katse võis lisaks
 * tekitada teise makse.
 *
 * MIS SIIN ON. Üks küsimus: **kas provider ütles ise ära?**
 *
 *   · **Ta ei näinud päringut** (puuduv konfiguratsioon, puuduv token) — raha ei
 *     saanud liikuda, seega `FAILED` on aus ja lõplik.
 *   · **Ta vastas selge eitusega** (HTTP 4xx, mis EI ole ajastuse/konflikti oma)
 *     — see on providerilt kinnitatud eitus, `FAILED`.
 *   · **Kõik muu** — timeout, katkenud ühendus, 5xx, 408/409/429, arusaamatu
 *     vastus VÕI meie enda kirjutusviga PÄRAST providerikutset — jätab tulemuse
 *     lahtiseks: `RECONCILE_PENDING`. Sealt saab `PAID` veel üles korjata ja
 *     reconciliation-worker küsida providerilt üle.
 *
 * Vaikimisi ebamäärane: tundmatu vea korral eeldatakse, et raha VÕIS liikuda.
 * Vale suunas eksimine maksab siin kasutaja raha, teises suunas ühe lahtise rea.
 */

/** Kus ahelas katkes — kutsuja teab seda, erind mitte. */
export const PaymentFailureStage = {
  /** Enne ühtki providerikutset (valideerimine, puuduv konfiguratsioon, DB). */
  BEFORE_PROVIDER: "before_provider",
  /** Providerikutse ise (transaction create, charge). */
  PROVIDER_CALL: "provider_call",
  /** Provider vastas edukalt, kukkus meie enda järeltöö (DB-kirjutus vms). */
  AFTER_PROVIDER: "after_provider"
};

/**
 * HTTP-koodid, mis on 4xx aga EI ütle „ei" — nad ütlevad „mitte praegu" või
 * „see on juba olemas". Mõlemal juhul võib tehing provideri pool eksisteerida.
 */
const AMBIGUOUS_HTTP_STATUSES = new Set([408, 409, 423, 425, 429]);

/**
 * Erandid, mille viskab meie oma kood ENNE võrgukutset. Neid ei saa tuletada
 * `error.status`-est, sest `fetch`-i ei toimunud — seega nad on nimeliselt siin.
 */
const NEVER_SENT_MESSAGES = new Set([
  "api.subscription.provider_unavailable",
  "api.subscription.recurring_provider_unavailable",
  "api.subscription.recurring_token_missing"
]);

export function isNeverSentProviderError(error) {
  return NEVER_SENT_MESSAGES.has(String(error?.message || "").trim());
}

/**
 * Kas provider vastas ise eitusega? Ainult siis on `FAILED` aus.
 * HTTP-vastuseta erind (timeout, abort, DNS, katkenud ühendus) ei ole eitus.
 */
export function isProviderConfirmedRejection(error) {
  if (!error) return false;
  const status = Number(error?.status);
  if (!Number.isFinite(status) || status < 400) return false;
  if (status >= 500) return false;
  if (AMBIGUOUS_HTTP_STATUSES.has(status)) return false;
  return true;
}

/**
 * @param {object} options
 * @param {string} options.stage - `PaymentFailureStage` väärtus
 * @param {unknown} options.error
 * @returns {{status: string, terminal: boolean, providerConfirmed: boolean, reason: string}}
 */
export function classifyPaymentFailure({ stage, error } = {}) {
  if (stage === PaymentFailureStage.BEFORE_PROVIDER || isNeverSentProviderError(error)) {
    return {
      status: PaymentStatus.FAILED,
      terminal: true,
      providerConfirmed: false,
      reason: "not_sent"
    };
  }

  if (stage === PaymentFailureStage.PROVIDER_CALL && isProviderConfirmedRejection(error)) {
    return {
      status: PaymentStatus.FAILED,
      terminal: true,
      providerConfirmed: true,
      reason: "provider_rejected"
    };
  }

  return {
    status: PaymentStatus.RECONCILE_PENDING,
    terminal: false,
    providerConfirmed: false,
    reason:
      stage === PaymentFailureStage.AFTER_PROVIDER ? "local_after_provider" : "provider_ambiguous"
  };
}

/** Seisud, mille peale ükski hilisem sõnum enam midagi ei muuda (v.a REFUNDED). */
export function isTerminalPaymentStatus(status) {
  return (
    status === PaymentStatus.PAID ||
    status === PaymentStatus.CANCELED ||
    status === PaymentStatus.FAILED ||
    status === PaymentStatus.PART_REFUNDED ||
    status === PaymentStatus.REFUNDED
  );
}

/** Lahendamata katse: raha võis liikuda, keegi peab veel otsustama. */
export function isUnresolvedPaymentStatus(status) {
  return status === PaymentStatus.INITIATED || status === PaymentStatus.RECONCILE_PENDING;
}

/**
 * Seisud, mis hoiavad kordusmakse valikut kinni. Mõlemal on sama põhjus: raha VÕIS
 * liikuda ja keegi ei ole veel otsustanud, mis juhtus. Teine katse tähendaks
 * teist laadimist sama kuu eest.
 *
 * `REVIEW_REQUIRED` (SOL-PAY-05) kuulub siia, aga MITTE automaatse
 * reconciliation'i valikusse: provideri ülekordamine ütleks sama „PAID", mis
 * kontrolli üldse kukutas — otsuse teeb inimene.
 */
export const RENEWAL_BLOCKING_STATUSES = Object.freeze([
  PaymentStatus.RECONCILE_PENDING,
  PaymentStatus.REVIEW_REQUIRED
]);
