"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { InboxBoard } from "./inbox/InboxViews";
import { inboxRow } from "./inbox/inboxRules";
import OrgPart from "./OrgPart";
import { useOrgApi } from "./useOrgApi";

/**
 * Organisatsiooni vastuvõtulaud.
 *
 * Loend ei kanna lähteobjekti sisu — ainult seisu ja vastutajat. Sisu avaneb
 * ühe kirje avamisel, mis on eraldi teadlik samm ja mis märgib pöördujale
 * nähtava `openedAt` ajatempli.
 *
 * Tühi loend ei tähenda „viga" ega „pole õigust": õiguseta liige näeb sama
 * tühja lauda kui organisatsioon, kuhu pole veel keegi pöördunud. Just see
 * teeb loendist mittepaljastava pinna.
 *
 * KUJU (11.10). Tabeli asemel madalad read (`./inbox/InboxViews.jsx`); rea
 * sisu otsustab `./inbox/inboxRules.js`.
 */
export default function OrgInboxClient({ context, initialPage }) {
  const { t } = useI18n();
  const router = useRouter();
  const { call, busy, error } = useOrgApi();
  const organizationId = context.organization.id;
  const [items, setItems] = useState(initialPage?.items || []);
  const [nextCursor, setNextCursor] = useState(initialPage?.nextCursor || null);
  const [hasMore, setHasMore] = useState(Boolean(initialPage?.hasMore));
  const sending = useRef(false);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const payload = await call(`/api/org/${organizationId}/inbox?cursor=${encodeURIComponent(nextCursor)}`);
    if (!payload?.items) return;
    setItems((current) => {
      const known = new Set(current.map((item) => item.id));
      return [...current, ...payload.items.filter((item) => !known.has(item.id))];
    });
    setNextCursor(payload.nextCursor || null);
    setHasMore(Boolean(payload.hasMore));
  }, [call, nextCursor, organizationId]);

  const rows = useMemo(() => items.map((item) => inboxRow(item, { t })), [items, t]);
  const hrefOf = useCallback((row) => `/org/${organizationId}/vastuvott/${row.id}`, [organizationId]);

  return (
    <OrgPart context={context} part="inbox">
      <InboxBoard
        t={t}
        rows={rows}
        hrefOf={hrefOf}
        /* Tavaline vajutus avab pöördumise lehe sees; uue vahekaardi vajutus jääb brauserile. */
        onOpen={(event, row) => {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          router.push(hrefOf(row));
        }}
        more={
          hasMore
            ? {
                busy,
                onMore: async () => {
                  if (sending.current) return;
                  sending.current = true;
                  try {
                    await loadMore();
                  } finally {
                    sending.current = false;
                  }
                }
              }
            : null
        }
        notice={error ? { tone: "risk", text: error } : null}
      />
    </OrgPart>
  );
}
