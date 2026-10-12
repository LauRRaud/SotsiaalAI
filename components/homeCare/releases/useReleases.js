"use client";

import { useState } from "react";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";

/**
 * Väljastuste tööloend: loetud read ja järgmine lehekülg. Vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./Releases.jsx.
 */
export function useReleases({ organizationId, initial }) {
  const { call, busy, error } = useHomeCareApi();
  const [page, setPage] = useState(initial || { items: [], hasMore: false, nextCursor: null });

  /* Tagastab true, kui järgmine lehekülg on laaditud. */
  const loadMore = async () => {
    if (!page.nextCursor) return false;
    const result = await call(
      `${homeCareBase(organizationId)}/valjastused?cursor=${encodeURIComponent(page.nextCursor)}`,
      { fallbackKey: "home_care.errors.list_failed" }
    );
    if (!result.ok) return false;
    setPage((current) => {
      const known = new Set(current.items.map((item) => item.id));
      return {
        ...result.data.releases,
        items: [...current.items, ...result.data.releases.items.filter((item) => !known.has(item.id))]
      };
    });
    return true;
  };

  return { page, loadMore, busy, error };
}
