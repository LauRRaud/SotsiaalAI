"use client";

/**
 * JTA-V1 — kohtumise heli: näost näkku kohtumise salvestamine juhtumi juures.
 *
 * MIKS OMA OSA JUHTUMI LAVAL, mitte märkmete osa tükk (09.10). Salvesti seisis
 * märkmete sektsioonis loomise vormi ja loendi vahel ja tegi selle osa paneelist
 * kõrgemaks. Ta ei ole märkme osa: salvestis on töötaja helidokument, mis
 * seotakse juhtumiga, ja märkme ridu ta EI kirjuta. Lava osana jääb salvesti
 * tööle ka siis, kui töötaja kirjutab samal ajal märget või vaatab juhtumi
 * teist osa: lava hoiab kõik osad alles.
 *
 * KOHTUMISE HELI. Salvestis on töötaja helidokument ja juhtumiga seob teda
 * olemasolev seoseregister (0 kopeeritud rida). Märkme ridu ta EI kirjuta:
 * transkript on masina tekst ja märkme rea päritolu kinnitab inimene ise.
 *
 * Salvesti ise (`components/documents/SessionRecorder.jsx`) on muutmata. Siin
 * on sidumise päring ja teated; vaade on failis ./sections/NoteViews.jsx.
 */

import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { localizePath } from "@/lib/localizePath";

import { caseWorkRequest } from "./caseWorkClient";
import { AudioView } from "./sections/NoteViews";

/**
 * `locked`: juhtum ei ole aktiivne. `caseBusy`: juhtumi enda kirjutus käib.
 * `active`: see osa on laval ees. `onLinked`: salvestatud osa seoti juhtumiga
 * (juhtum värskendab seoste loendit). `onRecording(käib)`: salvestamise seis
 * osa plaadi jaoks juhtumi ülevaates.
 */
export default function MeetingAudioSection({ caseId, locked, caseBusy, active, onLinked, onRecording }) {
  const { t, locale } = useI18n();
  const [noticeKey, setNoticeKey] = useState(null);
  const [errorKey, setErrorKey] = useState(null);

  /**
   * SALVESTATUD OSA SEOTAKSE JUHTUMIGA KOHE, olemasoleva seoseregistri kaudu.
   *
   * Sidumise tõrge EI KAOTA salvestist: helifail on selleks hetkeks juba töötaja
   * dokumentides ja seose saab lisada seoste alt käsitsi. Seepärast on tõrkel oma
   * tekst, mitte üldine veateade.
   */
  const linkRecordedPart = useCallback(
    async (audioSource) => {
      setErrorKey(null);
      try {
        await caseWorkRequest(`/cases/${encodeURIComponent(caseId)}/items`, {
          method: "POST",
          locale,
          body: { targetType: "USER_DOCUMENT", targetId: audioSource.id }
        });
      } catch {
        setNoticeKey(null);
        setErrorKey("casework.note.audio_link_failed");
        return;
      }
      setNoticeKey("casework.note.audio_linked");
      /* Seos on selleks hetkeks tehtud. Kui seoste loendi värskendamine
         ebaõnnestub, ei ole see sidumise tõrge: varem läks ka see „sidumine
         ebaõnnestus" teate alla ja juhatas inimese sama seost teist korda
         lisama. Loend värskeneb järgmisel laadimisel. */
      try {
        await onLinked?.();
      } catch {
        /* seos on olemas, loend jäi värskendamata */
      }
    },
    [caseId, locale, onLinked]
  );

  return (
    <AudioView
      t={t}
      title={t("casework.page.parts.audio.title", "")}
      disabled={locked || caseBusy}
      glow={active}
      notice={
        noticeKey
          ? { text: t(noticeKey, ""), linkText: t("casework.note.audio_open_documents", ""), href: localizePath("/dokreziim", locale) }
          : null
      }
      errorText={errorKey ? t(errorKey, "") : ""}
      onPartSaved={linkRecordedPart}
      onRecording={onRecording}
    />
  );
}
