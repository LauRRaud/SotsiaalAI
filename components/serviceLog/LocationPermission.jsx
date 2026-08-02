"use client";

/**
 * TEENUSPÄEVIK — asukohaluba ENNE esimest külastust.
 *
 * MIKS SEE PLOKK ON OLEMAS. Omanik sõnastas probleemi 02.08 täpselt: „kuidas
 * siis teha nii, et luba on esiteks peal (kas on sotsiaaltöötajaid, kes oskavad
 * luba panna? ei usu)". Ilma loata andis vajutus [KOHAL] ainult lause
 * „asukohta ei saadud" — ja kasutaja ei saanud teada ei seda, et asi on loas,
 * ega seda, et ta saab selle ise ära parandada.
 *
 * MIDA ME EI SAA JA MIDA SAAME:
 *
 *   ✗ Luba ise anda. Ühtegi veebi-API-t selleks ei ole ja see on meelega nii.
 *   ✓ Seisu lugeda ja KÜSIMUSE käivitada. Brauser näitab dialoogi ainult siis,
 *     kui leht `getCurrentPosition`-it kutsub — ja usaldusväärselt ainult
 *     KASUTAJA VAJUTUSE peale. Just seepärast on siin nupp, mitte automaatne
 *     päring lehe avanemisel: taustal tehtud kutse jääb mõnes brauseris
 *     vaikselt vahele ja kasutaja ei näe kunagi ühtegi dialoogi.
 *   ✓ Keeldumise korral öelda, KUST ta tagasi lülitada. „Luba on keelatud" ilma
 *     teeta on sama hea kui vaikimine.
 *
 * PLOKK EI BLOKEERI TÖÖD. Külastuse saab märkida ka loata — ajatempel on
 * tähtsam kui asukoht ja kunagi ei tohi juhtuda nii, et tehtud töö jääb kirja
 * panemata, sest satelliiti ei paistnud.
 */

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import {
  PERMISSION_STATE,
  captureLocationPoint,
  guessPlatformHint,
  isTrustedAccuracy,
  readPermissionState
} from "@/lib/serviceLog/geolocation";

export default function LocationPermission() {
  const { t } = useI18n();
  const [state, setState] = useState(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const refresh = useCallback(async () => {
    setState(await readPermissionState());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * KÜSIMINE ON PÄRIS MÕÕTMINE, mitte ainult dialoogi avamine. Kaks põhjust:
   * dialoog tulebki ainult päris kutse peale, ja tulemus ütleb kohe ka seda,
   * mida luba üksi ei ütle — kas seade annab kasutatava TÄPSUSE. Lubatud
   * asukoht ±3 km täpsusega ei tõenda kohalolekut, ja seda on parem teada
   * kontoris kui kliendi ukse taga.
   */
  const ask = useCallback(async () => {
    setChecking(true);
    setResult(null);
    try {
      const point = await captureLocationPoint();
      await refresh();
      if (!point) {
        setResult({ ok: false });
        return;
      }
      setResult({ ok: true, acc: point.acc ?? null, trusted: isTrustedAccuracy(point.acc) });
    } finally {
      setChecking(false);
    }
  }, [refresh]);

  /* Luba olemas ja kontroll tehtud → plokki ei ole. Roheline linnuke, mis jääb
     igaveseks ekraanile seisma, on müra. */
  if (state === PERMISSION_STATE.GRANTED && !result) return null;
  if (state === null) return null;

  const platform = guessPlatformHint();

  /**
   * ARVUTIS EI KÜSI ME MIDAGI.
   *
   * Omanik küsis otse: „me ei saa sellist teadet panna, on sellest reaalset
   * kasu?" — ja arvuti kohta on aus vastus EI. Lauaarvutil ei ole GPS-i;
   * brauser annab punkti WiFi-võrkude või IP järgi ja tema täpsus on sadu
   * meetreid kuni kümneid kilomeetreid. Selline punkt EI TÕENDA kohalolekut
   * niikuinii — loa palumine arvutis palub inimeselt õigust, mis talle midagi
   * ei anna. Asukohatempel on VÄLITÖÖ vahend ja välitööd tehakse telefoniga.
   *
   * Mõõtmine ise jääb alles: kui punkt juhtub tulema ja on täpne, läheb ta
   * kirja. Ära jääb ainult NÕUDMINE.
   */
  if (platform === "desktop" && state !== PERMISSION_STATE.GRANTED) return null;

  const denied = state === PERMISSION_STATE.DENIED;

  return (
    <p className="sl-location-note">
      {state === PERMISSION_STATE.UNSUPPORTED ? (
        t("service_log.permission.unsupported", "")
      ) : denied ? (
        <>
          {/* ÜKS LAUSE, MITTE SEIN.
              Siin oli nelja sammuga juhend brauseri menüüdest, mis seisis
              püsivalt vormi kohal. Ta oli korrektne ja kasutu: sotsiaaltöötaja
              ei loe ekraanilt Chrome'i seadete teekonda, ja ainus asi, mida tal
              päriselt teada on vaja, on see, ET asukohta ei märgita. Juhend
              jääb alles, aga voldituna — kes tahab, avab. */}
          {t("service_log.permission.denied_short", "")}{" "}
          <details className="sl-location-help">
            <summary>{t("service_log.permission.how", "")}</summary>
            <span>{t(`service_log.permission.hint.${platform}`, "")}</span>
          </details>
        </>
      ) : (
        <>
          {t("service_log.permission.why_short", "")}{" "}
          <button type="button" className="sl-location-ask" onClick={ask} disabled={checking}>
            {t("service_log.permission.allow", "")}
          </button>
        </>
      )}

      {result?.ok === false ? ` ${t("service_log.permission.failed", "")}` : ""}
      {result?.ok
        ? ` ${
            result.acc === null
              ? t("service_log.permission.ok", "")
              : t(result.trusted ? "service_log.permission.ok_accuracy" : "service_log.permission.ok_coarse", "", {
                  meters: String(result.acc)
                })
          }`
        : ""}
    </p>
  );
}
