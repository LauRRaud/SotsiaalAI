"use client";

/**
 * JTA-V1 (E2) — pind „Juhtumitöö laud".
 *
 * LAUD ON LUGEJA (L1). Siin ei ole ühtegi kirjutavat operatsiooni: iga rida
 * viib omaniku-pinnale, kus tegu tehakse. Laud, mis ise kirjutab, hakkaks
 * allikast lahku minema — ja esimene kord, kui laud ütleb „3 puudu" ja juhtum
 * ütleb „2 puudu", ei usu töötaja enam kumbagi.
 *
 * SEKTSIOONI OLEK ON OSA SISUST (L2). Tühi kast ja „selle jaoks ei ole veel
 * tööriista" näevad ühesugused välja, aga tähendavad vastupidist. Iga sektsioon
 * ütleb VÄLJA, miks ta tühi on: `EMPTY` = tööd ei ole, `FORBIDDEN` = seda
 * tööriista ei ole sinu rollil, `TIMEOUT` = allikas ei jõudnud, `ERROR` = katki.
 * Neli eri teksti, mitte üks hall kast.
 *
 * LAUD EI LOENDA TÖÖTAJAT (L3). Ei mahajäämust, ei „X üle tähtaja" märgist, ei
 * võrdlust eelmise perioodiga, ei kogusummat sektsioonide üleselt. Ainus arv
 * pinnal on `openMissingInfoCount` ja ta on SELLE juhtumi oma. Ptk 8.8 keeld
 * („ei tohi kasutada töötajate hindamiseks") peab olema arhitektuuris — ja laud
 * on täpselt see koht, kus koormuse mõõdik tekiks kogemata. Sama kehtib
 * ülevaate kohta: plaat näitab sektsiooni esimest rida, mitte ridade arvu.
 *
 * KUJU (09.10): KOGU LAUD ja SEKTSIOON ERALDI. Varem oli laud üks pikk
 * sektsioonide rida, mida tuli alla kerida. Nüüd avaneb leht ülevaates (kõik
 * sektsioonid plaatidena, igaühel esimene rida või tühjuse põhjus) ja
 * sektsioon avaneb omaette vaates. See on platvormi sammulava
 * (`components/stage/StepFlight.jsx`) laias vaates: sektsioonid on kiirmenüüs,
 * välja kerides jõuab tagasi kogu lauale. Sektsioonid ei ole sammud, seepärast
 * annab leht lavale oma sõnad („Kogu laud", „Osa 3/10").
 *
 * TEENUSKIHTI SIIA EI IMPORDITA. `lib/casework/workbench.js` toob endaga Prisma
 * kliendi, seega sektsioonide järjekord on siin oma konstandina
 * (`workbenchView.js`) — ja et kaks loendit ei saaks lahku minna, kontrollib
 * neid `tests/casework-workbench-view.test.mjs` teineteise vastu.
 *
 * Kujundus: workbench.module.css (selle faili kõrval). Read: workbenchRows.js.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import { useI18n } from "@/components/i18n/I18nProvider";
import StepFlight from "@/components/stage/StepFlight";
import StepPanel from "@/components/stage/StepPanel";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";

import { caseWorkRequest } from "./caseWorkClient";
import { workbenchRows } from "./workbenchRows";
import { resolveSection, sectionSummary, WORKBENCH_SECTION_ORDER } from "./workbenchView";
import styles from "./workbench.module.css";

/** Töötaja rollid — sama hulk mis `lib/casework/routes.js` väraval. */
const WORKER_ROLES = new Set(["SOCIAL_WORKER", "SERVICE_PROVIDER"]);

/**
 * Rida = pealkiri + märk + aeg + tee edasi.
 *
 * `Link`, MITTE `<a>`: toores ankur teeb täisdokumendi-navigatsiooni, laadib
 * rakenduse uuesti ja viskab ära sessiooni-, i18n- ja rollikonteksti, mille
 * pind just üles ehitas. Tundmatu liigi rida jääb nähtavaks ILMA teeta.
 */
function Row({ row, openText }) {
  const body = (
    <>
      <span className={styles.rowTitle}>{row.title}</span>
      <span className={styles.rowMeta}>
        {row.badge ? <span className={styles.badge}>{row.badge}</span> : null}
        {row.meta ? <span className={styles.time}>{row.meta}</span> : null}
      </span>
      {row.href ? (
        <span className={styles.rowOpen} aria-hidden="true">
          {openText} ›
        </span>
      ) : null}
    </>
  );
  return (
    <li>
      {row.href ? (
        <Link className={styles.row} href={row.href}>
          {body}
        </Link>
      ) : (
        <div className={styles.row} data-static="1">
          {body}
        </div>
      )}
    </li>
  );
}

export default function CaseWorkbenchShell() {
  const { t, locale } = useI18n();
  const { effectiveRole, isRoleResolved } = useEffectiveRole();
  const allowed = WORKER_ROLES.has(String(effectiveRole || "").toUpperCase());

  /* ⓘ SISU TULEB LEHELT. Juhend elab `lib/dashboardInfoContent.js`-is võtme
     `casework_workbench` all ja avaneb kiirmenüüs lehe nime kõrval. Tema viimane
     osa ütleb piirid välja (ei ole koormuse mõõdik · ei näita kellegi teise tööd
     · AI ei otsusta) — need on täpselt need laused, mida ei tohi jätta kasutaja
     enda avastada. */
  usePanelInfoSlot({ infoId: "casework_workbench" });

  const [sections, setSections] = useState(null);
  const [state, setState] = useState("loading");
  const [errorKey, setErrorKey] = useState(null);

  /**
   * VANA LAUD JÄÄB EKRAANILE, AGA MÄRGISTATULT (omaniku kuues audit 08.08).
   *
   * Kaks halba varianti, mille vahelt see valitud on: tühjendada laud iga
   * ebaõnnestunud värskenduse peale (töötaja kaotab kogu vaate ühe võrgutõrke
   * pärast) või jätta vana info alles VAIKIDES — ja see teine on siin kõige
   * ohtlikum, sest juhtumitöö laual tähendab „ei ole enam puuduvat infot"
   * midagi. Alles jääb, aga laud ütleb välja, et need on eelmise laadimise
   * andmed.
   */
  const load = useCallback(async () => {
    setState("loading");
    setErrorKey(null);
    try {
      const body = await caseWorkRequest("/workbench", { locale });
      setSections(body.sections || {});
      setState("ready");
    } catch (error) {
      setErrorKey(error?.messageKey || "casework.workbench.load_error");
      setState("error");
    }
  }, [locale]);

  useEffect(() => {
    if (!allowed) return;
    load();
  }, [allowed, load]);

  /* Sektsioon → lava osa. Sektsiooni PUUDUMINE ei ole tühi sektsioon (L2): kui
     koondlugeja teda ei saatnud, ei ole seda tööriista veel olemas ja tühi
     plaat väidaks vastupidist. OLEK OTSUSTAB, mitte ridade arv — otsus ise on
     `workbenchView.js`-is, et teda saaks päriselt testida. */
  const parts = useMemo(() => {
    if (!sections) return [];
    return WORKBENCH_SECTION_ORDER.filter((key) => sections[key]).map((key) => {
      const data = sections[key];
      const { showItems, noticeKey, items } = resolveSection(data);
      const rows = showItems ? workbenchRows(key, items, { t, locale }) : [];
      const noticeText = noticeKey ? t(noticeKey, "") : "";
      const label = t(`casework.workbench.section_${key}`, "");
      return {
        key,
        label,
        short: t(`casework.workbench.short_${key}`, label),
        /* Hele number = sektsioonis on ridu; see on olemasolu märk, mitte loendur. */
        state: rows.length ? "done" : "empty",
        summary: sectionSummary({ rows, noticeText, moreText: t("casework.workbench.more_rows", "") }),
        /* Sektsioon võib olla pikk loend: tema järgi ühist kõrgust ei võeta. */
        free: true,
        rows,
        noticeText,
        /* `notice` käib kaasa ka siis, kui ridu ON. Praegu ei kasuta seda ükski
           sektsioon — `activePreparations` hoiatus kadus koos põhjusega
           (SOL-CW-13) — aga mehhanism jääb: sektsioon, mis kuvab midagi muud
           kui oma nimi lubab, peab saama seda välja öelda ka ridade kõrval. */
        hint: data.notice ? t(data.notice, "") : ""
      };
    });
  }, [sections, t, locale]);

  if (!isRoleResolved) return null;

  if (!allowed) {
    return (
      <section className={styles.shell}>
        <p className={styles.quiet}>{t("casework.workbench.not_allowed", "")}</p>
      </section>
    );
  }

  /* Nupp on olemas MÕLEMAS lõppseisus. Varem kuvati ta ainult `ready` peal,
     seega ebaõnnestunud laadimise järel ei olnud pinnal ühtegi teed uuesti
     proovida — ainus väljapääs oli lehe taaslaadimine. */
  const refresh = (
    <button className={styles.refresh} type="button" disabled={state === "loading"} onClick={() => load()}>
      {t(state === "error" ? "casework.workbench.retry" : "casework.workbench.refresh", "")}
    </button>
  );

  return (
    <section className={styles.shell}>
      {/* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */}
      <h1 className="sr-only">{t("casework.workbench.title", "")}</h1>

      {errorKey ? (
        <p className={styles.notice} data-tone="risk" role="alert">
          {t(errorKey, "")}
        </p>
      ) : null}

      {/* Vana laud on ekraanil ja värskendus kukkus — seda ei tohi vaikida.
          `aria-live`, mitte role="status": ühine lehekiht joonistab iga
          status-rolliga elemendi teatekastina. */}
      {state === "error" && sections ? (
        <p className={styles.notice} aria-live="polite">
          {t("casework.workbench.stale_notice", "")}
        </p>
      ) : null}

      {state === "loading" && !sections ? <p className={styles.quiet}>{t("casework.workbench.loading", "")}</p> : null}

      {parts.length ? (
        <StepFlight
          key={parts.map((part) => part.key).join("|")}
          label={t("casework.workbench.title", "")}
          steps={parts}
          startWide
          parts
          texts={{
            all: t("casework.workbench.all_sections", ""),
            position: (current, total, label) =>
              t("casework.workbench.section_position", "")
                .replace("{current}", String(current))
                .replace("{total}", String(total))
                .replace("{label}", label)
          }}
          wideLead={
            /* TOOTEPIIR ON KOGU LAUA KOHAL, mitte abitekstis: laud ei ole
               koormuse mõõdik ja seda peab lugema enne, kui ridu vaadatakse. */
            <div className={styles.lead}>
              <p className={styles.leadText}>{t("casework.workbench.subtitle", "")}</p>
              {refresh}
            </div>
          }
        >
          {(part) => (
            <StepPanel title={part.label}>
              <div className={styles.part}>
                {part.hint ? <p className={styles.quiet}>{part.hint}</p> : null}
                {part.rows.length ? (
                  <ul className={styles.rows}>
                    {part.rows.map((row) => (
                      <Row key={row.id} row={row} openText={t("casework.workbench.open", "")} />
                    ))}
                  </ul>
                ) : null}
                {part.noticeText ? <p className={styles.quiet}>{part.noticeText}</p> : null}
              </div>
            </StepPanel>
          )}
        </StepFlight>
      ) : null}

      {/* Laadimine ebaõnnestus ja lauda ei ole: tee uuesti proovida peab olema. */}
      {!parts.length && state !== "loading" ? refresh : null}
    </section>
  );
}
