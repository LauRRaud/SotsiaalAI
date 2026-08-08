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
 * on täpselt see koht, kus koormuse mõõdik tekiks kogemata.
 *
 * TEENUSKIHTI SIIA EI IMPORDITA. `lib/casework/workbench.js` toob endaga Prisma
 * kliendi, seega sektsioonide järjekord on siin oma konstandina — ja et kaks
 * loendit ei saaks lahku minna, kontrollib neid `workbenchUi.test.js` teineteise
 * vastu. Kaks tõde ilma testita on ainult aja küsimus.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useEffectiveRole } from "@/components/auth/useEffectiveRole";
import { useI18n } from "@/components/i18n/I18nProvider";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";
import { provenanceLabelKey } from "@/lib/workspaces/provenance";

import { caseLabelText, caseWorkRequest } from "./caseWorkClient";
import { resolveSection, WORKBENCH_SECTION_ORDER } from "./workbenchView";

/** Töötaja rollid — sama hulk mis `lib/casework/routes.js` väraval. */
const WORKER_ROLES = new Set(["SOCIAL_WORKER", "SERVICE_PROVIDER"]);

function timeText(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale || "et", { dateStyle: "short", timeStyle: "short" });
}

/**
 * K1 tööruumi liik → pind, kus tegu tehakse.
 *
 * DESKRIPTORI `href` EI OLE URL: ta on `{ action: "open_workspace", target }`
 * ehk kavatsus, mille lahendab iga pind ise. Laud peab seetõttu teadma, kuhu
 * ta viib — ja ta teab seda NIMELISELT, mitte liigist tuletades. Tuletus
 * (`/vestlus?workspace=${kind}`) andis esimeses läbisõidus katkise lingi, sest
 * tööruumi liik (`pre_inquiry`) ja töölaua võti (`pre_inquiries`) ei ole sama
 * string.
 */
const WORKSPACE_ROUTES = Object.freeze({
  pre_inquiry: "/eelpoordumised",
  practice_reflection: "/refleksioon"
});

/**
 * Rida = pealkiri + meta + tee edasi.
 *
 * TEE ON L1 OTSENE TAGAJÄRG: laud ütleb „see ootab sinu tegu" ja tegu tehakse
 * mujal. Tundmatu liigi puhul jääb rida siiski nähtavaks, aga ILMA lingita —
 * katkine link on halvem kui puuduv, sest ta lubab teed, mida ei ole.
 */
function Row({ href, title, meta, badge, t }) {
  return (
    <li className="cw-case">
      {href ? (
        /* `Link`, MITTE `<a>`: toores ankur teeb täisdokumendi-navigatsiooni,
           laadib rakenduse uuesti ja viskab ära sessiooni-, i18n- ja
           rollikonteksti, mille pind just üles ehitas. Platvormi ülejäänud
           sisenavigatsioon käib `Link`-i või `router.push`-i kaudu.

           Teed on siin LOKAALINEUTRAALSED ja see on õige: `localizePath()`
           EEMALDAB keeleprefiksi ja `proxy.js` suunab `/et|/ru|/en` teed
           308-ga neutraalsele kujule, pannes keele küpsisesse. Prefiksi
           lisamine oleks siin viga, mitte parandus. */
        <Link className="cw-case-label" href={href}>
          {title}
        </Link>
      ) : (
        <span className="cw-case-label">{title}</span>
      )}
      <span className="cw-case-meta">
        {badge ? <span className="cw-badge">{badge}</span> : null}
        {meta ? <span className="cw-muted">{meta}</span> : null}
      </span>
      {href ? <span className="cw-muted">{t("casework.workbench.open", "")}</span> : null}
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

  const renderRows = useCallback(
    (key, items) => {
      switch (key) {
        /* K1 deskriptor (`receivedPreInquiries`, `practiceReflection`). `goal` ja
           `progress` EI lähe lauale: nad on tööruumi sisu ja avanevad tööruumis.

           `title` ON KAS TÕLKEVÕTI VÕI TEKST — adapterid on siin teadlikult
           erinevad: sisuta tööruum (eelpöördumine, meetodipeegel) annab võtme,
           sest pealkiri ei tohi kanda kliendi sisu, ja nimega tööruum (teekond,
           ruum) annab teksti. `t(title, title)` katab mõlemat: puuduv võti
           annab varuks sama stringi. Esimene läbisõit kuvas siin
           „workspace.kind.pre_inquiry" — võti lekkis pinnale. */
        case "receivedPreInquiries":
        case "practiceReflection":
          return items.map((row) => (
            <Row
              key={row?.ref?.id}
              href={WORKSPACE_ROUTES[row?.ref?.kind] || null}
              title={row?.title ? t(row.title, row.title) : t("casework.label.untitled", "")}
              meta={timeText(row?.lastMeaningfulActivityAt, locale)}
              badge={row?.nextAction?.labelKey ? t(row.nextAction.labelKey, "") : null}
              t={t}
            />
          ));

        case "todaysContacts":
        case "upcomingContacts":
          return items.map((row) => (
            <Row
              key={row.caseId}
              href={`/juhtumid?juhtum=${encodeURIComponent(row.caseId)}`}
              title={caseLabelText(row.label, t)}
              meta={timeText(row.nextContactAt, locale)}
              t={t}
            />
          ));

        /* L3: arv on SELLE juhtumi lahtiste punktide oma. Ta ei summeeru
           sektsiooni peale kokku ja tal ei ole „liiga palju" läve. */
        case "activePreparations":
          return items.map((row) => (
            <Row
              key={row.caseId}
              href={`/juhtumid?juhtum=${encodeURIComponent(row.caseId)}`}
              title={caseLabelText(row.label, t)}
              meta={timeText(row.nextContactAt, locale)}
              badge={
                row.openMissingInfoCount
                  ? t("casework.workbench.missing_count", "").replace("{count}", String(row.openMissingInfoCount))
                  : null
              }
              t={t}
            />
          ));

        /* Punkti tekst ON sektsiooni mõte, seega ta jääb. Renderdatakse
           tekstina — `dangerouslySetInnerHTML`-i siin ei ole ega tule. */
        case "openMissingInfo":
          return items.map((row) => (
            <Row
              key={row.itemId}
              href={`/juhtumid?juhtum=${encodeURIComponent(row.caseId)}`}
              title={row.text}
              meta={timeText(row.createdAt, locale)}
              badge={t(provenanceLabelKey(row.provenance) || "casework.errors.provenance_unknown", "")}
              t={t}
            />
          ));

        /* Staatus tuleb VÕRGUSTIKUJAGAMISE oma sõnastikust, mitte lauast: sama
           seis on juba nimetatud „Minu jagamistes" ja teine sõnastus tähendaks,
           et sama rida loeb kahel pinnal kaht eri asja. */
        case "networkPreparation":
          return items.map((row) => (
            <Row
              key={row.shareId}
              href="/eelpoordumised"
              title={t("casework.workbench.share_row", "")}
              meta={timeText(row.updatedAt, locale)}
              badge={t(`network_share.status.${row.status}`, "")}
              t={t}
            />
          ));

        case "covisionPreparation":
          return items.map((row) => (
            <Row
              key={row.seedId}
              href="/teemaseemned"
              title={row.title || t("casework.workbench.seed_untitled", "")}
              meta={timeText(row.updatedAt, locale)}
              /* Teemaseemne seisul EI OLE mujal sõnastikku (kontrollitud
                 06→08.08: `TopicSeedStatus` viis väärtust ei esine üheski
                 messages-failis), seega ta sünnib siin. Toorest enum'i nime
                 pinnale ei kuvata — tundmatu väärtus annab tühja silti. */
              badge={t(`casework.workbench.seed_status_${row.status}`, "")}
              t={t}
            />
          ));

        /* #4 (E6). Siht on JUHTUM, mitte mustand: mustandil ei ole oma
           marsruuti ja tema koht on juhtumi detailvaates. Tüüp ja seis on
           tõlkevõtmed — laual ei ole ühtegi mustandi VÄLJA, sest väljad
           kannavad kliendi teksti. */
        case "draftsAwaitingTransfer":
          return items.map((row) => (
            <Row
              key={row.draftId}
              href={`/juhtumid?juhtum=${encodeURIComponent(row.caseId)}`}
              title={t(`casework.draft.type_${row.draftType}`, "")}
              meta={timeText(row.updatedAt, locale)}
              badge={t(`casework.star2.${row.transferState}`, "")}
              t={t}
            />
          ));

        /* #10 (E6). Ajalugu kannab TEGU ja aega. Väljade võtmed on auditis
           olemas, aga laual neid ei ole (L20): siin on küsimus „mis juhtus",
           mitte „mis täpselt kopeeriti". */
        case "transferHistory":
          return items.map((row) => (
            <Row
              key={row.eventId}
              href={`/juhtumid?juhtum=${encodeURIComponent(row.caseId)}`}
              title={t(`casework.transfer.kind_${row.kind}`, "")}
              meta={timeText(row.createdAt, locale)}
              badge={t(`casework.draft.type_${row.draftType}`, "")}
              t={t}
            />
          ));

        default:
          return null;
      }
    },
    [locale, t]
  );

  if (!isRoleResolved) return null;

  if (!allowed) {
    return (
      <section className="cw-shell">
        <p className="cw-empty">{t("casework.workbench.not_allowed", "")}</p>
      </section>
    );
  }

  return (
    <section className="cw-shell">
      <header className="cw-intro">
        <h1 className="cw-title">{t("casework.workbench.title", "")}</h1>
        {/* TOOTEPIIR ON PEALKIRJA KÕRVAL, mitte abitekstis: laud ei ole koormuse
            mõõdik ja seda peab lugema enne, kui numbreid vaadatakse. */}
        <p className="cw-subtitle">{t("casework.workbench.subtitle", "")}</p>
      </header>

      {errorKey ? (
        <p className="cw-error" role="alert">
          {t(errorKey, "")}
        </p>
      ) : null}

      {/* Vana laud on ekraanil ja värskendus kukkus — seda ei tohi vaikida. */}
      {state === "error" && sections ? (
        <p className="cw-hint" role="status">
          {t("casework.workbench.stale_notice", "")}
        </p>
      ) : null}

      {state === "loading" && !sections ? <p className="cw-empty">{t("casework.workbench.loading", "")}</p> : null}

      {sections
        ? WORKBENCH_SECTION_ORDER.map((key) => {
            const data = sections[key];
            /* Sektsiooni PUUDUMINE ei ole tühi sektsioon (L2): kui koondlugeja
               teda ei saatnud, ei ole seda tööriista veel olemas ja tühi kast
               väidaks vastupidist. */
            if (!data) return null;

            /* OLEK OTSUSTAB, mitte ridade arv — otsus ise on
               `workbenchView.js`-is, et teda saaks päriselt testida. */
            const { showItems, noticeKey, items } = resolveSection(data);

            return (
              <section className="cw-section" key={key}>
                <h2 className="cw-section-title">{t(`casework.workbench.section_${key}`, "")}</h2>

                {/* `notice` käib kaasa ka siis, kui ridu ON — just nii ütleb
                    `activePreparations`, et need on juhtumid, mitte veel
                    ettevalmistused. */}
                {data.notice ? <p className="cw-hint">{t(data.notice, "")}</p> : null}

                {showItems ? <ul className="cw-list">{renderRows(key, items)}</ul> : null}
                {noticeKey ? <p className="cw-empty">{t(noticeKey, "")}</p> : null}
              </section>
            );
          })
        : null}

      {/* Nupp on olemas MÕLEMAS lõppseisus. Varem kuvati ta ainult `ready`
          peal, seega ebaõnnestunud laadimise järel ei olnud pinnal ühtegi teed
          uuesti proovida — ainus väljapääs oli lehe taaslaadimine. */}
      {state !== "loading" ? (
        <button className="cw-button" type="button" onClick={() => load()}>
          {t(state === "error" ? "casework.workbench.retry" : "casework.workbench.refresh", "")}
        </button>
      ) : null}
    </section>
  );
}
