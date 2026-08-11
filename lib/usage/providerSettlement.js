import { describeProviderFailure } from "@/lib/net/providerRequest";
import { commitUsageForRequest, releaseUsageForRequest } from "@/lib/usage/routeAdapter";

/**
 * VÄLISE KUTSE ARVELDUS: kaks lõppu, mõlemad ühes kohas (SOL-VOICE-01, -02).
 *
 * MIS OLI VALESTI. `/api/stt` ja `/api/tts` kandsid kumbki oma koopiat samast otsusest ja
 * mõlemas oli sama kaks viga:
 *
 *   1. „töö on valmis" lipp seati ENNE commit'i, seega commit'i viga ei vabastanud
 *      reservatsiooni JA marsruut vastas veaga — kasutaja kaotas valmis transkripti või heli
 *      ja ühik jäi rippuma. Mõlemad korraga, ühest reast.
 *   2. iga tõrge sai sama vastuse: meie ajapiir, kasutaja Stop ja provideri päris viga olid
 *      eristamatud nii kasutajale kui logile.
 *
 * REEGEL. Õnnestunud kutse lõpeb commit'iga, mille VIGA EI OLE kasutaja probleem: tulemus on
 * olemas ja kuulub talle, reservatsioon jääb reaperile (`lib/usage/paidResult.js` teine piir).
 * Ebaõnnestunud kutse lõpeb ALATI vabastusega — mitte midagi ei jõudnud kasutajani, seega ei
 * ole mille eest võtta — aga staatus ja logi sõltuvad sellest, KES katkestas.
 *
 * MIKS OMA MOODUL: see on ainus koht, kus mõlemat lõppu saab päris andmebaasi vastu mõõta
 * ilma marsruudi seansikihita. Marsruudis oleks ta ainult ridade järjekord.
 */

/**
 * @returns commit'itud kogus (`actualAmount`) või `null`, kui commit kukkus.
 */
export async function commitProviderUsage({ handle, actualAmount = null, onError = null }) {
  if (!handle) return null;
  try {
    await commitUsageForRequest(handle, actualAmount == null ? {} : { actualAmount });
    return actualAmount;
  } catch (error) {
    onError?.(error);
    return null;
  }
}

/**
 * @returns `{ reason, status, aborted, log, released }` — `released` ütleb, kas vabastus ise
 *          õnnestus, sest ka tema viga ei tohi vaikselt kaduda.
 */
export async function settleProviderFailure({ handle, error, onError = null }) {
  const failure = describeProviderFailure(error);
  if (!handle) return { ...failure, released: false };

  try {
    await releaseUsageForRequest(handle, { reason: failure.reason });
    return { ...failure, released: true };
  } catch (releaseError) {
    onError?.(releaseError);
    return { ...failure, released: false };
  }
}
