"use client";

/**
 * U10: spetsialisti kinnitatud kohtumise kokkuvõtte jagamine ühisesse ruumi.
 *
 * Kokkuvõte läheb ruumi sõnumina: leht saadab ainult teksti tunnuse ja ruumi
 * sõnumite marsruut otsib kinnitatud MEETING_SUMMARY sisu ise üles ning
 * kontrollib seda serveris. Ruumi liikmed näevad kokkuvõtet ja saavad vastata.
 *
 * KUJU (09.10). Jagamine oli koostatud teksti lehe lõpus pealkirja, rippvaliku,
 * märkeruudu ja nupuga. Nüüd on see lehe omaette väike vaade (`ShareView`
 * failis ./detail/DetailViews.jsx): ruumid on valikus kohe näha, kinnituse
 * küsimine on selgitusega märkekaart ja jagamine küsib teist vajutust. Ruumi
 * postitatud kokkuvõtet on liikmed juba näinud, seda tagasi võtta ei saa.
 *
 * KES SEDA NÄEB, otsustab leht (`canShareMeetingSummary`, ./detail/detailModel.js):
 * see komponent joonistatakse ainult neile, kes jagada tohivad.
 *
 * Siin on ruumide laadimine, valik ja jagamise päring. Õnnestumisest (ka
 * osalisest: jagati, aga kinnitust ei saanud küsida) teatab komponent lehele
 * (`onShared`), sest see teade peab jääma ette ka siis, kui vaade vahetub.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { ShareView } from "./detail/DetailViews";
import { useTwoPress } from "./detail/detailHooks";
import { RequestFailure, failureText, serverMessage, shareOutcome, shareRoomOptions } from "./detail/detailModel";

export default function MeetingSummaryRoomShare({ artifactId, title, glow = true, onShared }) {
  const { t } = useI18n();
  const [rooms, setRooms] = useState({ status: "loading", list: [] });
  const [attempt, setAttempt] = useState(0);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  /* T20 P2 (O-CO-2 = a): kinnitusring on valikuline, jagaja otsustab siin. */
  const [requestApproval, setRequestApproval] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  /* Üks jagamise päring korraga. Nuppu selleks välja ei lülitata: väljalülitatud
     nupp kaotaks klaviatuuri fookuse. */
  const busyRef = useRef(false);
  const confirm = useTwoPress();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRooms({ status: "loading", list: [] });
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        /* Laadimise viga ei ole „ruume ei ole”: vaade ütleb, et loendit ei saanud kätte. */
        if (!res.ok || !Array.isArray(data?.rooms)) {
          setRooms({ status: "error", list: [] });
          return;
        }
        setRooms({ status: "ready", list: data.rooms });
        /* Kliendi kokkuvõtte jagamine on privaatsuse seisukohalt tundlik: ruum
           valitakse alati ise, esimest ruumi vaikimisi ette ei panda. */
        setSelectedRoomId("");
      } catch {
        if (!cancelled) setRooms({ status: "error", list: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const options = useMemo(() => shareRoomOptions(rooms.list, t), [rooms.list, t]);
  const selected = options.find((option) => option.value === selectedRoomId) || null;

  const shareToRoom = useCallback(async () => {
    if (busyRef.current || !selected) return;
    busyRef.current = true;
    setSharing(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(selected.value)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryArtifactId: artifactId,
          /* Teksti kinnitamine ja see jagamise tegevus koos kinnitavad, et
             kinnitatud kokkuvõtte võib valitud ruumi postitada. */
          privacyDecision: { action: "send_original" },
          /* T20 P2: valikuline kinnitusring professionaalidelt (O-CO-2 = a). */
          requestSummaryApproval: requestApproval
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new RequestFailure(serverMessage(data, t, t("documents.meeting_summary_share.error")));
      }
      onShared?.({ room: selected.label, ...shareOutcome(data, { asked: requestApproval }) });
    } catch (shareError) {
      setError(failureText(shareError, t("documents.meeting_summary_share.error")));
    } finally {
      busyRef.current = false;
      setSharing(false);
    }
  }, [artifactId, onShared, requestApproval, selected, t]);

  /* Valiku muutus võtab teise vajutuse ootelt maha: selgitus nupu kõrval
     nimetas ruumi, mis oli valitud esimese vajutuse ajal. */
  const change = (apply) => (value) => {
    confirm.disarm();
    setError("");
    apply(value);
  };

  return (
    <ShareView
      t={t}
      title={title}
      rooms={{
        status: rooms.status,
        options,
        value: selected ? selected.value : "",
        onChange: change(setSelectedRoomId),
        onRetry: () => setAttempt((value) => value + 1)
      }}
      approval={{ checked: requestApproval, onChange: change(setRequestApproval) }}
      note={error}
      tone="risk"
      sharing={sharing}
      glow={glow}
      confirm={confirm.action("share", {
        label: t("documents.meeting_summary_share.share"),
        armedLabel: t("documents.meeting_summary_share.confirm"),
        note: t("documents.meeting_summary_share.confirm_note", { room: selected?.label || "" }),
        run: () => void shareToRoom()
      })}
    />
  );
}
