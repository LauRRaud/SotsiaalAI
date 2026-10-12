"use client";

import { useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { DetailView, RowsView } from "../client/PartViews";
import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { formatDateTime } from "../homeCareClient";
import SubPage from "../page/SubPage";
import { RELEASES_PAGE, releaseClientHref, releaseDocument, releaseNotices, releaseRows } from "./releaseRows";
import { useReleases } from "./useReleases";

/**
 * Väljastuste tööloendi leht hooldusjuhile: konks hoiab loetud ridu ja järgmist
 * lehekülge, siin pannakse vaated kokku. Ees on üks vaade korraga: väljastused
 * ridadena (neli rida korraga, „Näita veel" näitab veel neli või laeb järgmise
 * lehekülje) ja üks väljastus (kellele, mis alusel, kes koostas, sisu räsi ning
 * dokument uuel vahelehel ja link kliendile). Dokumendi sisu siin ei ole.
 *
 * `initial`: { items, hasMore, nextCursor }.
 */
export default function Releases({ context, initial }) {
  const { t } = useI18n();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const state = useReleases({ organizationId, initial });
  const { page } = state;
  /* "" (väljastused) või "release:<id>". */
  const [screen, setScreen] = useState("");
  const [shown, setShown] = useState(RELEASES_PAGE);
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist päringut. */
  const once = useSendOnce();

  const fault = state.error ? { text: state.error, tone: "risk" } : null;
  const moment = (value) => formatDateTime(value, timeZone);
  const wrap = (view) => (
    <SubPage context={context} label={t("home_care.releases.title")} onDesk={screen ? () => setScreen("") : undefined} notice={screen === ""}>
      <div ref={rootRef}>{view}</div>
    </SubPage>
  );
  const [kind, id] = screen.split(":");

  /* --- Üks väljastus --- */
  const release = kind === "release" ? page.items.find((item) => item.id === id) : null;
  if (release) {
    return wrap(
      <DetailView
        title={t("home_care.releases.title")}
        head={{ name: release.clientName }}
        notices={releaseNotices(t, release, { moment })}
        actions={[{ key: "document", label: t("home_care.chronology.open_document"), href: releaseDocument(organizationId, release), blank: true, primary: true }]}
        links={[{ key: "client", title: release.clientName, href: releaseClientHref(organizationId, release) }]}
        back={{ label: t("home_care.parts.back"), onBack: () => setScreen("") }}
        mark="release"
      />
    );
  }

  /* --- Väljastused --- */
  const rows = releaseRows(t, page.items, { moment });
  const hasMoreLoaded = shown < rows.length;
  return wrap(
    <RowsView
      title={t("home_care.releases.title")}
      question={t("home_care.releases.title")}
      rows={rows.slice(0, shown)}
      onOpen={(key) => setScreen(`release:${key}`)}
      empty={t("home_care.releases.empty")}
      hint={t("home_care.releases.intro")}
      more={
        hasMoreLoaded || page.hasMore
          ? {
              label: t("home_care.home.more"),
              onMore: async () => {
                if (hasMoreLoaded) {
                  setShown((now) => now + RELEASES_PAGE);
                  return;
                }
                if (await once(state.loadMore)) setShown((now) => now + RELEASES_PAGE);
              }
            }
          : null
      }
      busy={state.busy}
      notice={fault}
      mark="releases"
    />
  );
}
