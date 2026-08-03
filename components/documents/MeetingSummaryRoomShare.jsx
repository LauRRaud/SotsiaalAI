"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Dropdown from "@/components/ui/Dropdown";
import { useI18n } from "@/components/i18n/I18nProvider";

const MEETING_SUMMARY_SHARE_ROLES = new Set(["SOCIAL_WORKER", "SERVICE_PROVIDER"]);

/**
 * U10: share a specialist-confirmed meeting summary into a shared room.
 * Posts the artifact by id to the room-message endpoint, which resolves and
 * validates the confirmed MEETING_SUMMARY content server-side. The person then
 * sees the summary in the room and can reply ("understood" / "correction").
 */
export default function MeetingSummaryRoomShare({ artifactId }) {
  const { t } = useI18n();
  const { data: session } = useSession();
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [sharing, setSharing] = useState(false);
  /* T20 P2 (O-CO-2 = a): kinnitusring on valikuline — jagaja otsustab siin. */
  const [requestApproval, setRequestApproval] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const userRole = String(session?.user?.role || "").trim().toUpperCase();
  const canShare = Boolean(session?.user?.isAdmin || MEETING_SUMMARY_SHARE_ROLES.has(userRole));

  useEffect(() => {
    if (!canShare) {
      setLoadingRooms(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingRooms(true);
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const list = Array.isArray(data?.rooms)
          ? data.rooms.filter((room) => Number(room?.memberCount) > 1)
          : [];
        setRooms(list);
        // Sharing a client summary is privacy-sensitive: require an explicit
        // room choice instead of silently defaulting to the first room.
        setSelectedRoomId("");
      } catch {
        if (!cancelled) setRooms([]);
      } finally {
        if (!cancelled) setLoadingRooms(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canShare]);

  const shareToRoom = useCallback(async () => {
    if (sharing || !selectedRoomId) return;
    setSharing(true);
    setNotice("");
    setError("");
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(selectedRoomId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryArtifactId: artifactId,
          // FINAL approval plus this explicit share action confirms that the
          // approved summary text may be posted to the selected private room.
          privacyDecision: { action: "send_original" },
          // T20 P2: valikuline kinnitusring professionaalidelt (O-CO-2 = a).
          requestSummaryApproval: requestApproval
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || t("documents.meeting_summary_share.error", "Kokkuvõtte jagamine ebaõnnestus."));
      }
      setNotice(t("documents.meeting_summary_share.success", "Kokkuvõte jagati ruumi."));
    } catch (shareError) {
      setError(shareError?.message || t("documents.meeting_summary_share.error", "Kokkuvõtte jagamine ebaõnnestus."));
    } finally {
      setSharing(false);
    }
  }, [artifactId, requestApproval, selectedRoomId, sharing, t]);

  if (!canShare) return null;

  return (
    <div>
      <h2>{t("documents.meeting_summary_share.title", "Jaga kokkuvõte ühisesse ruumi")}</h2>
      <p>{t("documents.meeting_summary_share.hint", "Pöörduja näeb kinnitatud kokkuvõtet ruumis ja saab vastata.")}</p>
      {loadingRooms ? (
        <p>{t("documents.meeting_summary_share.loading", "Laen ruume…")}</p>
      ) : rooms.length ? (
        <div>
          <label>
            <span>{t("documents.meeting_summary_share.room_label", "Ruum")}</span>
            <Dropdown
              value={selectedRoomId}
              onChange={setSelectedRoomId}
              ariaLabel={t("documents.meeting_summary_share.room_label", "Ruum")}
              placeholder={t("documents.meeting_summary_share.select_room", "Vali ühine ruum")}
              options={rooms.map((room) => ({ value: room.id, label: room.title || room.id }))}
            />
          </label>
          <Checkbox
            checked={requestApproval}
            onChange={setRequestApproval}
            label={t("documents.meeting_summary_share.request_approval", "Küsi osalejatelt kinnitust")}
          />
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => void shareToRoom()}
            disabled={sharing || !selectedRoomId}
          >
            {sharing
              ? t("documents.meeting_summary_share.sharing", "Jagan…")
              : t("documents.meeting_summary_share.share", "Jaga ruumi")}
          </Button>
        </div>
      ) : (
        <p>{t("documents.meeting_summary_share.no_rooms", "Sul pole veel ühtegi ruumi.")}</p>
      )}
      {notice ? <p>{notice}</p> : null}
      {error ? <p>{error}</p> : null}
    </div>
  );
}
