"use client";

import { useState } from "react";

import { CareIncidentFilter } from "@/lib/homeCare/constants";

import { homeCareBase, useHomeCareApi } from "../homeCareClient";
import { EMPTY_FILTER, EMPTY_PAGE, mergeEntry } from "./incidentRows";

/**
 * Erijuhtumite register: loend, filter ja avatud juhtum. Vaated on ühised
 * (../client/PartViews.jsx), kokku paneb need ./Incidents.jsx.
 *
 * Pärast iga muudatust laaditakse nähtav leht uuesti: seis otsustab, millisesse
 * vaatesse juhtum kuulub, ja loendurid peavad jääma õigeks.
 */
export function useIncidents({ organizationId, initial, focused: initialFocused }) {
  const { call, busy, error, setError } = useHomeCareApi();

  const [page, setPage] = useState(initial || EMPTY_PAGE);
  const [focused, setFocused] = useState(initialFocused || null);
  /* Loendis avatud juhtum: kirje jääb avatuks ka siis, kui seis viib ta loendist välja. */
  const [opened, setOpened] = useState(null);
  const [status, setStatus] = useState(initial?.filter || CareIncidentFilter.ACTIVE);
  const [draft, setDraft] = useState(EMPTY_FILTER);
  const [applied, setApplied] = useState(EMPTY_FILTER);

  const url = (nextStatus, query, cursor, take) => {
    const params = new URLSearchParams({ status: nextStatus });
    if (query.type) params.set("type", query.type);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    if (cursor) params.set("cursor", cursor);
    if (take) params.set("take", String(take));
    return `${homeCareBase(organizationId)}/erijuhtumid?${params.toString()}`;
  };

  /* Tagastab true, kui leht on laaditud. */
  const load = async (nextStatus, query, take) => {
    const result = await call(url(nextStatus, query, null, take), { fallbackKey: "home_care.errors.list_failed" });
    if (!result.ok) return false;
    setPage(result.data.incidents);
    setStatus(nextStatus);
    setApplied(query);
    setDraft(query);
    return true;
  };

  /* Tagastab true, kui järgmine lehekülg on laaditud. */
  const loadMore = async () => {
    if (!page.nextCursor) return false;
    const result = await call(url(status, applied, page.nextCursor), { fallbackKey: "home_care.errors.list_failed" });
    if (!result.ok) return false;
    setPage((current) => {
      const known = new Set(current.items.map((item) => item.id));
      return {
        ...result.data.incidents,
        items: [...current.items, ...result.data.incidents.items.filter((item) => !known.has(item.id))]
      };
    });
    return true;
  };

  /* Pärast muudatust laaditakse uuesti NII PALJU RIDU, kui parajasti näha on
     (server piirab saja reaga): „näita vanemaid" kaudu avatud read ja lahtine
     käik ei tohi muudatuse järel eest kaduda. */
  const onChange = (entry) => {
    setFocused((current) => mergeEntry(current, entry));
    setOpened((current) => mergeEntry(current, entry));
    load(status, applied, Math.max(page.items.length, 1));
  };

  return { page, focused, opened, setOpened, status, draft, setDraft, applied, load, loadMore, onChange, busy, error, setError };
}
