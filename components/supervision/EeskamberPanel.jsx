"use client";

/**
 * Protsessi laua osa „Privaatne eeskamber" (Q2.6 vaade 4): olek ja päringud.
 *
 * Eeskamber on ruumigrammatikas „privaatne koht enne läve". Märgis „Ainult
 * sina näed" on IGA kirje juures püsivalt, mitte tooltip'ina: M6 on omanik-only
 * ka superviisori eest (SUP-P3, SUP-P10).
 *
 * Salvestus on TEADLIK (nupp), mitte autosalvestus: nii ei saa võrgu- ega
 * CAS-viga kunagi kirjutatud teksti kaotada. Ebaõnnestumisel jääb tekst
 * vormi alles ja inimene näeb, mis juhtus.
 *
 * KUJU (09.10). Paneel oli hämar kast klaaspaneeli sees: kõik kirjed kõrgete
 * kaartidena, muutmise vorm kaardi sees ja uue mustandi vorm lõpus. Nüüd on
 * osas üks asi korraga: loend, avatud kirje, muutmine või uus mustand (enne
 * liik, siis tekst). Vaade on failis ./process/WorkViews.jsx.
 *
 * LOEND TULEB LEHELT (`items`, ./process/usePrivateItems.js): sama loendit
 * näitab kõigi osade vaate plaat. Eeskamber lahendab oma versioonikonflikti
 * ise: protsessi vastust see ei puuduta.
 *
 * VERSIOONIKONFLIKT EI JÄTA INIMEST LUKKU. Vana paneel jättis konflikti järel
 * teksti alles, aga saatis järgmisel salvestamisel sama vana versiooni: teine
 * katse andis jälle konflikti ja peale kirjutada ei saanudki. Nüüd võetakse
 * värskest loendist uus versioon, tekst jääb alles ja lause ütleb, et uus
 * salvestamine kirjutab vahepealse muudatuse üle.
 *
 * KUSTUTAMINE KÜSIB TEIST VAJUTUST lehel endal; vana paneel kasutas brauseri
 * küsimusakent.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";

import { AntechamberView } from "./process/WorkViews";
import { PRIVATE_ITEM_KINDS, antechamberMode, privateItemRows, privateItemView, privateKindOptions, shareHref } from "./process/processRows";
import { isConflict, supervisionMessage, supervisionRequest } from "./supervisionClient";

const NEW_DRAFT = Object.freeze({ kind: PRIVATE_ITEM_KINDS[0], title: "", body: "" });

export default function EeskamberPanel({ process, items, glow }) {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState("list");
  const [openId, setOpenId] = useState("");
  const [draft, setDraft] = useState(NEW_DRAFT);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const running = useRef(false);

  const canWrite = Boolean(process.capabilities?.canManagePrivateItems);
  const { reload } = items;

  /** Värske loend pärast õnnestunud tegu. Kui see ei tule, öeldakse seda: loend ees võib olla vana. */
  const refresh = useCallback(async () => {
    if (!(await reload())) setMessage(t("supervision.errors.load_failed"));
  }, [reload, t]);

  /** Üks päring korraga; välju päringu ajaks ei keelata (fookus jääb väljale). */
  const request = useCallback(
    async (key, url, options, onRefused) => {
      if (running.current) return false;
      running.current = true;
      setBusy(key);
      setMessage("");
      try {
        const { ok, status, payload } = await supervisionRequest(url, options);
        if (!ok) {
          if (!(await onRefused?.(status))) {
            setMessage(supervisionMessage({ status, payload, t, fallbackKey: "supervision.errors.save_failed" }));
          }
          return false;
        }
        return true;
      } catch {
        setMessage(t("supervision.errors.save_failed"));
        return false;
      } finally {
        running.current = false;
        setBusy("");
      }
    },
    [t]
  );

  const create = useCallback(async () => {
    const body = draft.body.trim();
    if (!body) return;
    const ok = await request("create", `/api/supervision/processes/${encodeURIComponent(process.id)}/private-items`, {
      method: "POST",
      body: { kind: draft.kind, title: draft.title.trim() || null, body }
    });
    if (!ok) return;
    setDraft(NEW_DRAFT);
    setMode("list");
    await refresh();
  }, [draft, process.id, refresh, request]);

  const save = useCallback(async () => {
    if (!editing) return;
    const body = editing.body.trim();
    if (!body) return;
    const ok = await request(
      `save:${editing.id}`,
      `/api/supervision/private-items/${encodeURIComponent(editing.id)}`,
      { method: "PATCH", body: { title: editing.title.trim() || null, body, expectedVersion: editing.version } },
      async (status) => {
        if (!isConflict(status)) return false;
        /* CAS-konflikt: too värske seis, AGA jäta inimese tekst vormi. Värske
           versioon läheb vormi kaasa, et uus salvestamine oleks teadlik peale
           kirjutamine, mitte sama konflikt teist korda. */
        const list = await reload();
        /* Värsket seisu ei saadud: tekst jääb vormi ja inimene saab uuesti proovida. */
        if (!list) return false;
        const fresh = list.find((row) => row.id === editing.id);
        if (!fresh) {
          setMessage(t("supervision.common.notFound"));
          return true;
        }
        setEditing((current) => (current && current.id === fresh.id ? { ...current, version: fresh.version } : current));
        setMessage(t("supervision.process.antechamber.conflictKept"));
        return true;
      }
    );
    if (!ok) return;
    setEditing(null);
    setMode("item");
    await refresh();
  }, [editing, refresh, reload, request, t]);

  const remove = useCallback(
    async (itemId) => {
      const ok = await request(`delete:${itemId}`, `/api/supervision/private-items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
      if (!ok) return;
      setEditing(null);
      setOpenId("");
      setMode("list");
      await refresh();
    },
    [refresh, request]
  );

  const rows = useMemo(() => privateItemRows(items.data, process, { t }), [items.data, process, t]);
  const opened = useMemo(
    () =>
      privateItemView(
        (Array.isArray(items.data) ? items.data : []).find((row) => row?.id === openId),
        process,
        { t }
      ),
    [items.data, openId, process, t]
  );
  const kinds = useMemo(() => privateKindOptions(t), [t]);

  const shown = antechamberMode({ mode, canWrite, hasItem: Boolean(opened), hasEditing: Boolean(editing) });

  return (
    <AntechamberView
      t={t}
      glow={glow}
      mode={shown}
      source={items}
      rows={rows}
      item={opened}
      canWrite={canWrite}
      note={message}
      kinds={kinds}
      draft={draft}
      onDraft={setDraft}
      /* Liik valitud: liigi kaardid annavad koha teksti vormile. */
      onKind={(kind) => {
        setDraft((current) => ({ ...current, kind }));
        setMode("write");
      }}
      editing={editing}
      onEditing={setEditing}
      busy={Boolean(busy)}
      onMode={(next) => {
        setMessage("");
        if (next === "edit" && opened) {
          setEditing({ id: opened.id, title: opened.heading, body: opened.body, version: opened.version });
        }
        if (next !== "edit") setEditing(null);
        setMode(next);
      }}
      onOpen={(itemId) => {
        setMessage("");
        setOpenId(itemId);
        setMode("item");
      }}
      onCreate={create}
      onSave={save}
      onDelete={remove}
      onShare={(itemId) => router.push(shareHref(process.id, itemId))}
    />
  );
}
