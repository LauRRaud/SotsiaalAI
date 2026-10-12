"use client";

import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HISTORY_TITLE_MAX } from "@/lib/homeCare/historyLimits";

import { useSendOnce } from "../client/useSendOnce";
import { formatDateTime } from "../homeCareClient";
import { DOC_PAGE, historyRows } from "./diaryRows";
import { HistoryAddView, HistoryDocView, HistoryListView } from "./HistoryViews";
import { useImportedHistory } from "./useImportedHistory";

/**
 * Kliendi varasem ajalugu teisest kohast: konks hoiab olekut ja päringuid, siin
 * pannakse vaated kokku. Ees on üks vaade korraga: dokumentide loend, ühe
 * dokumendi tekst või üle toomise vorm.
 *
 * Üle toob ja eemaldab hooldusjuht (`canManage`). Eemaldamine küsib teist
 * vajutust samal nupul: algne dokument jääb sinna, kust see toodi, aga siit
 * kaob tekst ja otsing seda enam ei leia.
 *
 * `back`: { label, onBack } viib tagasi päeviku loendisse.
 */
export default function ImportedHistory({ organizationId, clientId, histories, timeZone, canManage = false, back, onChange }) {
  const { t } = useI18n();
  const rootRef = useRef(null);
  const fileRef = useRef(null);
  const history = useImportedHistory({ organizationId, clientId, histories, onChange });
  /* "" (loend), "add" või avatud dokumendi ID. */
  const [screen, setScreen] = useState("");
  const [armed, setArmed] = useState(false);
  /* Mitu lõiku avatud dokumendist on ees. */
  const [shownBlocks, setShownBlocks] = useState(DOC_PAGE);
  /* Teine vajutus päringu ajal ei saada teist päringut (nuppu välja ei lülitata). */
  const once = useSendOnce();

  /* Vaate vahetusel algab paneel ülalt ja fookus läheb vaate pealkirjale. Esimesel joonistusel fookust ei võeta. */
  const shown = useRef(screen);
  useEffect(() => {
    if (shown.current === screen) return;
    shown.current = screen;
    rootRef.current?.closest(".panel-body")?.scrollTo({ top: 0 });
    rootRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
  }, [screen]);

  const moment = (value) => formatDateTime(value, timeZone);
  const toList = {
    label: t("home_care.entry_steps.to_list"),
    onBack: () => {
      setArmed(false);
      history.reader.setError("");
      history.writer.setError("");
      setScreen("");
    }
  };
  const fault = (message) => (message ? { text: message, tone: "risk" } : null);

  if (screen === "add" && canManage) {
    return (
      <div ref={rootRef}>
        <HistoryAddView
          title={t("home_care.history.add")}
          lead={t("home_care.history.add_hint")}
          name={{ label: t("home_care.history.name_label"), hint: t("home_care.history.name_hint"), value: history.title, onChange: history.setTitle, max: HISTORY_TITLE_MAX }}
          text={{ label: t("home_care.history.text_label"), value: history.text, onChange: history.typeText }}
          file={{ label: t("home_care.diary.pick_file"), inputRef: fileRef, onFile: history.readFile, note: history.fileNote }}
          problem={history.tooLong ? t("home_care.errors.history_too_large") : ""}
          notice={fault(history.writer.error)}
          save={{
            label: t("home_care.history.save"),
            busy: history.writer.busy,
            disabled: history.writer.busy || history.tooLong || !history.text.trim() || !history.title.trim(),
            onSave: async () => {
              if (await history.submit()) setScreen("");
            }
          }}
          back={{ ...toList, label: t("home_care.entry.cancel") }}
        />
      </div>
    );
  }

  const doc = screen && screen !== "add" ? histories.find((item) => item.id === screen) : null;
  if (doc) {
    const state = history.open[doc.id];
    const loaded = state?.blocks.length || 0;
    /* „Näita veel": kõigepealt juba laaditud lõigud, siis järgmine lehekülg serverist. */
    const showMore = async () => {
      if (shownBlocks >= loaded && state?.hasMore) await history.load(doc.id, state.nextAfter);
      setShownBlocks((count) => count + DOC_PAGE);
    };
    const pressRemove = async () => {
      if (!armed) {
        setArmed(true);
        return;
      }
      if (await once(() => history.remove(doc.id))) {
        setArmed(false);
        setScreen("");
      }
    };
    return (
      <div ref={rootRef}>
        <HistoryDocView
          title={doc.title}
          meta={t("home_care.history.meta", { time: moment(doc.createdAt), name: doc.importedByName, count: doc.charCount })}
          mark={t("home_care.history.mark")}
          blocks={state ? state.blocks.slice(0, shownBlocks).map((block) => ({ key: block.position, text: block.text })) : null}
          busy={history.reader.busy}
          more={shownBlocks < loaded || state?.hasMore ? { label: t("home_care.home.more"), onMore: showMore } : null}
          remove={
            canManage
              ? {
                  armed,
                  label: t("home_care.history.remove"),
                  confirm: t("home_care.diary.history_remove_confirm"),
                  consequence: t("home_care.diary.history_remove_note"),
                  onPress: pressRemove,
                  busy: history.writer.busy
                }
              : null
          }
          notice={fault(history.reader.error || history.writer.error)}
          back={toList}
        />
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <HistoryListView
        title={t("home_care.history.title")}
        mark={t("home_care.history.mark")}
        rows={historyRows(histories, { t, moment })}
        onOpen={(id) => {
          setArmed(false);
          setShownBlocks(DOC_PAGE);
          setScreen(id);
          /* Tekst laaditakse alles avamisel; juba laaditud tekst jääb ette. */
          if (!history.open[id]) history.load(id);
        }}
        empty={t("home_care.history.empty")}
        add={canManage ? { label: t("home_care.history.add"), onOpen: () => setScreen("add") } : null}
        back={back}
      />
    </div>
  );
}
