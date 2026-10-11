"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { InboxBoard } from "./inbox/InboxViews";
import { INBOX_GROUPS, inboxListPath, inboxPagePath, inboxRow } from "./inbox/inboxRules";
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
 *
 * KAKS RÜHMA (omanik 11.10.2026: lõpetatud pöördumisi peab laual näha saama). Koordinaator
 * valib, kas ees on töös olevad või lõpetatud pöördumised (suletud, tagasi lükatud, saatja
 * tagasi võetud). `showFinished` otsustab server: töötajal, kes näeb ainult talle määratud
 * tööd, oleks „Lõpetatud" alati tühi ja seda talle ei näidata.
 */
export default function OrgInboxClient({ context, initialPage, initialGroup = "open", showFinished = false }) {
  const { t } = useI18n();
  const router = useRouter();
  const { call, busy, error } = useOrgApi();
  const organizationId = context.organization.id;
  const firstGroup = showFinished && INBOX_GROUPS.includes(initialGroup) ? initialGroup : "open";
  const [group, setGroup] = useState(firstGroup);
  /* Rühma loend, nagu see on laaditud: `null` = veel küsimata. Server annab kaasa selle rühma
     esimese lehe, mis on ees; teine küsitakse esimesel avamisel. */
  const [lists, setLists] = useState({
    open: null,
    finished: null,
    [firstGroup]: { items: initialPage?.items || [], nextCursor: initialPage?.nextCursor || null, hasMore: Boolean(initialPage?.hasMore) }
  });
  const sending = useRef(false);
  const list = lists[group];

  const load = useCallback(
    async (target, cursor = "") => {
      const payload = await call(inboxListPath(organizationId, { group: target, cursor }));
      if (!payload?.items) return;
      setLists((current) => {
        const known = cursor ? current[target]?.items || [] : [];
        const seen = new Set(known.map((item) => item.id));
        return {
          ...current,
          [target]: {
            items: [...known, ...payload.items.filter((item) => !seen.has(item.id))],
            nextCursor: payload.nextCursor || null,
            hasMore: Boolean(payload.hasMore)
          }
        };
      });
    },
    [call, organizationId]
  );

  /* Üks päring korraga: topeltvajutus ei küsi sama lehte kaks korda. */
  const once = useCallback(async (work) => {
    if (sending.current) return;
    sending.current = true;
    try {
      await work();
    } finally {
      sending.current = false;
    }
  }, []);

  const chooseGroup = useCallback(
    (next) => {
      if (!INBOX_GROUPS.includes(next) || next === group) return;
      setGroup(next);
      /* Aadress käib rühmaga kaasas (ilma lehte uuesti laadimata): värskendus ja „tagasi" jäävad samasse rühma. */
      window.history.replaceState(window.history.state, "", inboxPagePath(organizationId, next));
      /* Lõpetatud pöördumised küsitakse esimesel avamisel; hiljem on need juba käes. */
      if (!lists[next]) void once(() => load(next));
    },
    [group, lists, load, once, organizationId]
  );

  const rows = useMemo(() => (list?.items || []).map((item) => inboxRow(item, { t })), [list, t]);
  const hrefOf = useCallback((row) => `/org/${organizationId}/vastuvott/${row.id}`, [organizationId]);

  return (
    <OrgPart context={context} part="inbox">
      <InboxBoard
        t={t}
        rows={rows}
        hrefOf={hrefOf}
        groups={
          showFinished
            ? {
                value: group,
                options: INBOX_GROUPS.map((key) => ({ value: key, label: t(`org.inbox.groups.${key}`) })),
                busy: !list,
                onChange: chooseGroup
              }
            : null
        }
        /* Tavaline vajutus avab pöördumise lehe sees; uue vahekaardi vajutus jääb brauserile. */
        onOpen={(event, row) => {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          router.push(hrefOf(row));
        }}
        more={list?.hasMore && list.nextCursor ? { busy, onMore: () => once(() => load(group, list.nextCursor)) } : null}
        notice={error ? { tone: "risk", text: error } : null}
      />
    </OrgPart>
  );
}
