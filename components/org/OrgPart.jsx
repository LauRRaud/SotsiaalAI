"use client";

/**
 * OrgPart — avatud organisatsiooni lehe kest: laud ja iga osa kannavad seda.
 *
 * MIKS. Igal alalehel seisid paneeli ülaservas organisatsiooni nimi, seisu rida
 * ja kuni 13 lingiga rida (`OrgHeader` + `OrgNav`): umbes 220 px 522 px
 * paneelist enne, kui sisu algas. Liikumine kuulub kiirmenüüsse (omanik 10.10),
 * paneel on sisu jaoks.
 *
 * KUIDAS. Organisatsioon on laud (`/org/<id>`): plaadid kõigi osadega, mida
 * inimene näeb. Osa on oma marsruut (serveri värav jääb iga osa ette). Kiirmenüüs
 * on nelja ruuduga nupp organisatsiooni nimega (viib lauale) ja avatud osa nimi:
 * sama võte mis Teekonna ja Juhtumitöö laual (`StepRail parts`). Telefonis
 * kiirmenüüs nimesid ei ole; seal ütleb rida paneeli ülaservas, kus inimene on.
 *
 * `part`: osa võti (`org.nav.<võti>`) või tühi, kui see leht ON laud.
 * `partLabel`: osa nimi, kui see ei tule võtmest (nt laua vaade „Minu koht" või
 *   koduteenuse alaleht „Päevaplaan": osa on `home_care`, nimi on alalehe oma).
 *   Kiirmenüü näitab nimest umbes 20 tähte; pikem nimi lõigatakse.
 * `onDesk`: mida nelja ruuduga nupp teeb; vaikimisi avab laua marsruudi.
 * `compact`: nelja ruuduga nupp ilma nimeta (nimi jääb nupu sildiks). Kasutus:
 *   osa sees käib sammudega töö ja sammud on kiirmenüüs kõrval; koos nimega
 *   läheks kiirmenüü liiga pikaks (omanik 09.10).
 *
 * INFO. Osa, millel on oma info (`PART_INFO`), saab infonupu kiirmenüüsse lehe
 * nime kõrvale: vajutus vahetab paneeli sisu info vastu ja tagasi (omanik
 * 11.10: info on kiirmenüüs, mitte lehe nurgas). Koduteenuse 23 lehte kannavad
 * osa `home_care` ja saavad info siit ühest kohast. Leht, mis registreerib oma
 * info ise (laud, graafik, aruanded), tabelisse ei kuulu: kaks registreerijat
 * ühel lehel kirjutaksid teineteist üle.
 */

import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepRail from "@/components/stage/StepRail";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";

import shared from "./org.module.css";

/* Osa võti → info võti failis lib/dashboardInfoContent.js. */
const PART_INFO = Object.freeze({ home_care: "home_care" });

export default function OrgPart({ context, part = "", partLabel = "", onDesk, compact = false, children }) {
  const { t } = useI18n();
  const router = useRouter();
  const organization = context?.organization || {};
  const name = organization.displayName || t("org.home.invites.unnamed");
  const label = partLabel || (part ? t(`org.nav.${part}`) : "");
  const open = Boolean(label);
  const toDesk = onDesk || (() => router.push(`/org/${organization.id}`));
  /* Tühi võti ei registreeri midagi: teiste osade lehed jäävad nii, nagu on. */
  usePanelInfoSlot({ infoId: PART_INFO[part] || "" });

  return (
    <>
      {/* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */}
      <h1 className="sr-only">{open ? t("org.desk.part_title", { organization: name, part: label }) : name}</h1>
      <StepRail
        parts
        steps={[{ key: part || "desk", label: label || name }]}
        activeIndex={0}
        wide={!open}
        onOverview={toDesk}
        label={t("org.desk.rail_label")}
        allLabel={name}
        allText={compact ? "" : undefined}
        stepLabel={() => label}
      />
      <div className={shared.page}>
        {open ? (
          <p className={shared.kicker}>
            {name} · {label}
          </p>
        ) : null}
        {children}
      </div>
    </>
  );
}
