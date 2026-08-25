"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import { DashboardInfoTrigger, dashboardInfoTriggerCornerClassName } from "@/components/ui/DashboardInfoOverlay";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import Modal from "@/components/ui/Modal";
import Panel from "@/components/ui/Panel";
import { useI18n } from "@/components/i18n/I18nProvider";
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
  const ownSectionLabel = title === ui.helpOffers ? ui.myHelpOffers : ui.myHelpRequests;
  const [isMounted, setIsMounted] = useState(false);
  const ownItems = useMemo(
    () => items.filter((item) => item?.isOwn),
    [items]
  );
  const otherItems = useMemo(
    () => items.filter((item) => !item?.isOwn),
    [items]
  );
  const hasDetail = Boolean(detailNode);
  const isWorkspaceReturn = embedded || Boolean(onBackToWorkspace);
  const isWorkspaceSubpageReturn = isWorkspaceReturn && !embedded;
  const [workspaceModalHeight, setWorkspaceModalHeight] = useState(null);
  const helpListingsWorkspaceStyle = isWorkspaceReturn && workspaceModalHeight
    ? { "--help-listings-workspace-measured-height": `${workspaceModalHeight}px` }
    : undefined;
  const countLabel = `${items.length} ${items.length === 1 ? ui.listingSingular : ui.listingPlural}`;
  const helpListingsContentClassName = [
    "feature-page",
    "feature-page__surface",
    "feature-page--help-listings",
    "help-listings-modal-content",
    isWorkspaceSubpageReturn ? "help-listings-modal-content--workspace" : "",
    embedded ? "help-listings-modal-content--embedded" : "",
    isClosing ? "pointer-events-none" : ""
  ].filter(Boolean).join(" ");
  const listingsScrollClassName = "help-listings-scroll min-h-0 flex-1 overflow-y-auto";

  const renderListingCard = (item) => (
    <button
      key={`${item.kind}-${item.id}`}
      type="button"
      onClick={() => onSelectItem?.(item)}
      className="help-listings-item-card text-left"
    >
      <div>
        <div>{item.title}</div>
        <div>
          {item.isOwn ? <span>{ui.ownListing}</span> : null}
          {item.statusLabel ? <span>{item.statusLabel}</span> : null}
        </div>
      </div>
      {item.summary ? <div>{item.summary}</div> : null}
    </button>
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!isWorkspaceReturn || typeof window === "undefined") return undefined;

    const measureWorkspace = () => {
      const node = document.querySelector("[data-chat-container]");
      const rect = node?.getBoundingClientRect?.();
      const nextHeight = Math.round(rect?.height || 0);
      if (nextHeight > 0) setWorkspaceModalHeight(nextHeight);
    };

    measureWorkspace();
    window.addEventListener("resize", measureWorkspace);

    let resizeObserver;
    const node = document.querySelector("[data-chat-container]");
    if (node && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(measureWorkspace);
      resizeObserver.observe(node);
    }

    return () => {
      window.removeEventListener("resize", measureWorkspace);
      resizeObserver?.disconnect?.();
    };
  }, [isWorkspaceReturn]);

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

  if (!isMounted || typeof document === "undefined") {
    return null;
  }

  const handleBackClick = () => {
    (onBackToProfile || onBackToWorkspace || onClose)?.();
  };

  const backAriaLabel = onBackToProfile
    ? t("buttons.back")
    : onBackToWorkspace
      ? t("workspace_feature_pages.back_to_workspace")
      : ui.close;

  const content = (
    <div className={helpListingsContentClassName} style={helpListingsWorkspaceStyle}>
      {hasDetail ? detailNode : (
        <>
        {!hideHeader ? (
          <SubpageHeader
            onBack={handleBackClick}
            backAriaLabel={backAriaLabel}
            showBack={!isWorkspaceReturn}
            titleAs="h2"
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
        ) : null}

        <div>
          <p>{countLabel}</p>
        </div>

        <div className="help-listings-body flex min-h-0 flex-1 flex-col">
          <Panel
            variant="subpage"
            padding="sm"
            className="help-listings-panel flex min-h-0 flex-1 flex-col"
          >
            {loading ? <div>{ui.loading}</div> : null}
            {!loading && error ? <div>{error}</div> : null}
            {!loading && !error && !items.length ? (
              <div>
                {emptyText || ui.empty || ""}
              </div>
            ) : null}
            {!loading && !error && items.length ? (
              <div className={listingsScrollClassName}>
                <div>
                  {ownItems.length ? <div>{ownSectionLabel}</div> : null}
                  {ownItems.map(renderListingCard)}
                  {otherItems.map(renderListingCard)}
                </div>
              </div>
            ) : null}
          </Panel>

          {!loading && nextOffset != null ? (
            <div>
              <Button type="button" variant="primary" size="md" onClick={onLoadMore}>
                {ui.loadMore}
              </Button>
            </div>
          ) : null}
        </div>
        </>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className="workspace-feature-embedded">
        {content}
      </div>
    );
  }

  return createPortal(
    <Modal
      open
      variant="glass"
      onClose={onClose}
      closeOnOverlayClick={!isClosing}
      aria-label={title || ui.listingPlural}
      className={`help-listings-modal-overlay overflow-y-auto ${isWorkspaceReturn ? "help-listings-modal-overlay--workspace" : ""}`}
      contentClassName={helpListingsContentClassName}
      style={helpListingsWorkspaceStyle}
    >
      {hasDetail ? detailNode : content.props.children}
    </Modal>,
    document.body
  );
}
