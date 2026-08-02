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
import Button from "@/components/ui/Button";
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

  const denied = state === PERMISSION_STATE.DENIED;
  const platform = guessPlatformHint();

  return (
    <section className={denied ? "sl-permission sl-permission-warn" : "sl-permission"}>
      <h3 className="sl-list-title">{t("service_log.permission.title", "")}</h3>

      {state === PERMISSION_STATE.UNSUPPORTED ? (
        <p className="sl-source">{t("service_log.permission.unsupported", "")}</p>
      ) : denied ? (
        <>
          {/* KEELDUMIST EI SAA LEHT TAGASI VÕTTA. Ainus aus vastus on täpne
              tee seadetesse — seadme kaupa, sest nad on erinevad. */}
          <p>{t("service_log.permission.denied", "")}</p>
          <ol className="sl-permission-steps">
            {(t(`service_log.permission.steps.${platform}`, "") || "")
              .split("|")
              .filter(Boolean)
              .map((step) => (
                <li key={step}>{step}</li>
              ))}
          </ol>
        </>
      ) : (
        <>
          <p>{t("service_log.permission.why", "")}</p>
          <Button type="button" onClick={ask} disabled={checking}>
            {t("service_log.permission.allow", "")}
          </Button>
        </>
      )}

      {result?.ok === false ? <p className="sl-source">{t("service_log.permission.failed", "")}</p> : null}
      {result?.ok ? (
        <p className={result.trusted ? "sl-source" : "sl-source sl-source-warn"}>
          {result.acc === null
            ? t("service_log.permission.ok", "")
            : t(result.trusted ? "service_log.permission.ok_accuracy" : "service_log.permission.ok_coarse", "", {
                meters: String(result.acc)
              })}
        </p>
      ) : null}

      {/* IP EI OLE ASUKOHT. Omanik mõõtis: avaliku IP järgi andis üks leht
          täiesti vale koha ja ainus õige asi seal oli sideettevõtte nimi.
          Seepärast on siin kirjas, MIS meie number tähendab. */}
      <p className="sl-source">{t("service_log.permission.not_ip", "")}</p>
    </section>
  );
}
