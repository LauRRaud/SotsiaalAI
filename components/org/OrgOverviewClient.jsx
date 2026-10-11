"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";

import { DeskView, PlaceView } from "./desk/DeskViews";
import { deskChip, deskNoticeKey, deskTiles, placeFacts, seatLine } from "./desk/orgDesk";
import OrgPart from "./OrgPart";

/**
 * Avatud organisatsioon: LAUD.
 *
 * KUJU (11.10). Leht oli ülevaade viie kastiga, mille kohal seisid nimi ja kuni
 * 13 lingiga rida. Nüüd on esimene vaade laud: organisatsiooni nimi, üks rida
 * inimese koha kohta ja plaadid kõigi osadega, mida ta näeb. Plaat avab osa
 * marsruudi; plaat „Minu koht" avab laua enda teise vaate (seis, roll, üksused,
 * õigused, moodulid), mis oli varem ülevaate sisu.
 *
 * PRIVAATSUSTEADE ON SISU, mitte kaunistus: kasutaja peab nägema mustvalgel,
 * mida organisatsioon tema kohta EI näe (arenduskava §4, §7.4). See seisab
 * mõlema vaate all servas ja seda ei tohi eemaldada „ruumi säästmiseks".
 *
 * Vaated on failis ./desk/DeskViews.jsx, reeglid failis ./desk/orgDesk.js.
 */
export default function OrgOverviewClient({ context }) {
  const { t } = useI18n();
  const router = useRouter();
  /* ⓘ kiirmenüüs: sama selgitus mis organisatsioonide avalehel. */
  usePanelInfoSlot({ infoId: "org" });
  const [view, setView] = useState("desk");
  const rootRef = useRef(null);

  const tiles = useMemo(() => deskTiles(context, { t }), [context, t]);
  const noticeKey = deskNoticeKey(context);

  /* Tavaline vajutus avab osa lehe sees; uue vahekaardi vajutus jääb brauserile. */
  const openTile = useCallback(
    (event, tile) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      router.push(tile.href);
    },
    [router]
  );

  /* Vaate vahetusel (laud ↔ minu koht) kaob vajutatud plaat: fookus läheb vaate
     pealkirjale. Esimesel joonistusel fookust ei võeta. */
  const shown = useRef("");
  useEffect(() => {
    const first = shown.current === "";
    const moved = shown.current !== view;
    shown.current = view;
    if (first || !moved) return;
    rootRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
  }, [view]);

  if (view === "place") {
    return (
      <div ref={rootRef}>
        <OrgPart context={context} partLabel={t("org.desk.place.name")} onDesk={() => setView("desk")}>
          <PlaceView t={t} facts={placeFacts(context, { t })} />
        </OrgPart>
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <OrgPart context={context}>
        <DeskView
          t={t}
          name={context.organization.displayName}
          chip={deskChip(context, { t })}
          seat={seatLine(context, { t })}
          notice={noticeKey ? t(noticeKey) : ""}
          tiles={tiles}
          onOpen={openTile}
          onView={setView}
        />
      </OrgPart>
    </div>
  );
}
