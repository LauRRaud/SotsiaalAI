"use client";

/**
 * Abisoovide ja abipakkumiste loend.
 *
 * KUJU (09.10). Paneel näitas nähtavat pealkirja, kuulutuste arvu ja kõrgeid
 * kaarte veel ühe tumeda kasti sees. Nüüd on see üks vaade (`StepPanel`): rida
 * on madal (pealkiri ja märksõnad, märgid „Minu kuulutus" ja seis, tee edasi)
 * ja terve rida avab kuulutuse. Minu kuulutused on enne teiste omi. Read teeb
 * ./helpListingRows.js, kujundus on failis ./helpListings.module.css.
 *
 * PANEEL EI LAE EGA LOO MIDAGI: read, laadimise seis ja tegevused annab
 * kasutaja (`components/alalehed/ChatBody.jsx`). Kuulutus luuakse vestluses
 * (abisoovi ja abipakkumise töövoog), mitte siin.
 *
 * KOLM KASUTUST.
 *  - Töölaua sees (`embedded`, `hideHeader`): lehe nime ütleb kiirmenüü,
 *    pealkirja paneelil ei ole.
 *  - Modaalina vestluse kohal (ilma `embedded`-ita): pealkiri ja tagasitee on
 *    modaali päises.
 *  - Avatud kuulutus (`detailNode`) tuleb loendi asemele. See on veel vanal
 *    ühisel kihil, seepärast saab ta siin oma senise ümbrise.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useI18n } from "@/components/i18n/I18nProvider";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import { DashboardInfoTrigger, dashboardInfoTriggerCornerClassName } from "@/components/ui/DashboardInfoOverlay";
import Modal from "@/components/ui/Modal";
import { SubpageHeader } from "@/components/ui/SubpageHeader";

import { listingCountText, listingGroups, listingKind, listingRows } from "./helpListingRows";
import styles from "./helpListings.module.css";
import { getHelpUiText } from "./helpUiText";

export default function HelpListingsPanel({
  locale: _locale = "et",
  title = "",
  side: _side = "left",
  items = [],
  loading = false,
  error = "",
  emptyText = "",
  nextOffset = null,
  isClosing = false,
  onLoadMore,
  onSelectItem,
  detailNode = null,
  infoId,
  embedded = false,
  hideHeader = false,
  onClose,
  onBackToProfile,
  onBackToWorkspace
}) {
  const { t } = useI18n();
  const ui = getHelpUiText(t);
  const [isMounted, setIsMounted] = useState(false);
  const hasDetail = Boolean(detailNode);
  const isWorkspaceReturn = embedded || Boolean(onBackToWorkspace);
  const isWorkspaceSubpageReturn = isWorkspaceReturn && !embedded;
  /* Avatud kuulutuse (ja modaali) ümbris: vana ühise kihi klassid, millest
     `SelectedListingContext` oma välimuse saab. */
  const legacyContentClassName = [
    "feature-page",
    "feature-page__surface",
    "feature-page--help-listings",
    "help-listings-modal-content",
    isWorkspaceSubpageReturn ? "help-listings-modal-content--workspace" : "",
    embedded ? "help-listings-modal-content--embedded" : "",
    isClosing ? "pointer-events-none" : ""
  ].filter(Boolean).join(" ");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (embedded) return undefined;
    if (!isMounted) return undefined;
    const root = document.documentElement;
    document.body.classList.toggle("modal-open", true);
    root.classList.toggle("modal-open", true);
    document.body.classList.toggle("help-listings-modal-open", true);
    root.classList.toggle("help-listings-modal-open", true);
    return () => {
      document.body.classList.remove("modal-open");
      root.classList.remove("modal-open");
      document.body.classList.remove("help-listings-modal-open");
      root.classList.remove("help-listings-modal-open");
    };
  }, [embedded, isMounted]);

  const handleBackClick = () => {
    (onBackToProfile || onBackToWorkspace || onClose)?.();
  };

  const backAriaLabel = onBackToProfile
    ? t("buttons.back")
    : onBackToWorkspace
      ? t("workspace_feature_pages.back_to_workspace")
      : ui.close;

  const kind = listingKind({ items, infoId, title, ui });
  const groups = listingGroups(listingRows(items, ui), {
    kind,
    ui,
    othersLabel: kind === "offer" ? t("chat.help.otherOffers") : t("chat.help.otherRequests")
  });
  const countText = listingCountText(items.length, { ui, complete: nextOffset == null });

  const rowBody = (row, opens) => (
    <>
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>{row.title}</span>
        {row.summary ? <span className={styles.rowSub}>{row.summary}</span> : null}
      </span>
      <span className={styles.rowMeta}>
        {row.chips.map((chip) => (
          <span key={chip.key} className={styles.chip} data-tone={chip.tone}>
            {chip.text}
          </span>
        ))}
      </span>
      {opens ? (
        <span className={styles.rowOpen} aria-hidden="true">
          {t("chat.help.openShort")} ›
        </span>
      ) : null}
    </>
  );

  const header = !hideHeader ? (
    <SubpageHeader
      onBack={handleBackClick}
      backAriaLabel={backAriaLabel}
      showBack={!isWorkspaceReturn}
      titleAs="h2"
      /* Töölaua sees on lehe nimi kiirmenüüs: pealkiri jääb ekraanilugejale.
         Modaalis kiirmenüüd ei ole ja pealkiri ütleb, mis aken lahti on. */
      headerClassName={embedded ? "sr-only" : undefined}
      titleWrapClassName={isWorkspaceReturn ? "help-listings-workspace-title-wrap" : undefined}
      rightSlot={
        infoId && !isWorkspaceReturn ? (
          <DashboardInfoTrigger
            infoId={infoId}
            title={title}
            className={dashboardInfoTriggerCornerClassName}
          />
        ) : null
      }
    >
      {title}
    </SubpageHeader>
  ) : null;

  const list = (
    <StepPanel title={title || ui.listingPlural} lead={countText || undefined}>
      <div className={styles.stack}>
        {error ? (
          <p className={styles.notice} role="alert">
            {error}
          </p>
        ) : null}
        {groups.length ? (
          groups.map((group) => (
            <section key={group.key} className={styles.group} aria-label={group.label || undefined}>
              {group.label ? <h4 className={styles.groupTitle}>{group.label}</h4> : null}
              <ul className={styles.rows}>
                {group.rows.map((row) => (
                  <li key={row.key} className={styles.rowItem}>
                    {/* Kui kasutaja avamise tegevust ei andnud, ei ole rida nupp:
                        nupp, mis midagi ei tee, on halvem kui tavaline rida. */}
                    {onSelectItem ? (
                      <button type="button" className={styles.row} onClick={() => onSelectItem(row.item)}>
                        {rowBody(row, true)}
                      </button>
                    ) : (
                      <div className={styles.rowStatic}>{rowBody(row, false)}</div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : loading ? (
          <p className={styles.quiet}>{ui.loading}</p>
        ) : error ? null : (
          /* „Kuulutusi ei ole" öeldakse ainult siis, kui loend päriselt laaditi. */
          <p className={styles.quiet}>{emptyText || ui.empty || ""}</p>
        )}
        {/* Juba laaditud read jäävad juurde laadimise ajaks ette; nupp on sel
            ajal keelatud, et sama lehte ei küsitaks kaks korda. */}
        {nextOffset != null && groups.length ? (
          <Button type="button" size="sm" variant="secondary" className={styles.more} disabled={loading} onClick={onLoadMore}>
            {loading ? ui.loading : ui.loadMore}
          </Button>
        ) : null}
      </div>
    </StepPanel>
  );

  if (embedded) {
    return hasDetail ? (
      <div className="workspace-feature-embedded">
        <div className={legacyContentClassName}>{detailNode}</div>
      </div>
    ) : (
      <div className={styles.page}>
        {header}
        {list}
      </div>
    );
  }

  if (!isMounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <Modal
      open
      variant="glass"
      onClose={onClose}
      closeOnOverlayClick={!isClosing}
      aria-label={title || ui.listingPlural}
      className={`help-listings-modal-overlay overflow-y-auto ${isWorkspaceReturn ? "help-listings-modal-overlay--workspace" : ""}`}
      contentClassName={legacyContentClassName}
    >
      {hasDetail ? (
        detailNode
      ) : (
        <>
          {/* Päis jääb modaali sisu otseseks lapseks nagu enne: loendi ümbris on
              konteiner ja võtaks päise tagasi-nupu paigutuse enda külge. */}
          {header}
          <div className={styles.dialog}>{list}</div>
        </>
      )}
    </Modal>,
    document.body
  );
}
