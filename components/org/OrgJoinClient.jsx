"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { usePanelInfoSlot } from "@/components/ui/PanelInfoSlot";

import { InviteView, MessageView, WaitingView } from "./join/JoinViews";
import { inviteFacts, joinState, offeredName, organizationName } from "./join/joinRules";
import shared from "./org.module.css";
import { useOrgApi } from "./useOrgApi";
import { useSecondPress } from "./useSecondPress";

/**
 * Kutse vastuvõtt KAHE sammuna (arenduskava §5.5).
 *
 * Samm 1 (GET) näitab, millega inimene nõustub: organisatsioon, üksus,
 * hinnastatav roll, kavandatud õigused. See ei muuda mitte midagi.
 * Samm 2 (POST) on teadlik nõustumine. Lingile klikkimine üksi ei tee kellestki
 * liiget — see on tahtlik ja seda ei tohi „mugavuse pärast" ühte sammu suruda.
 *
 * KUJU (11.10). Leht oli 674 px kõrgune veerg vanal ühisel kihil. Nüüd on igal
 * seisul oma väike vaade (`./join/JoinViews.jsx`); mis seis parajasti on ja mis
 * read eelvaates seisavad, otsustab `./join/joinRules.js`. See fail hoiab
 * olekut ja teeb päringud. Keeldumine küsib teist vajutust samal nupul; pärast
 * nõustumist jäävad nupud lukku, kuni tööruum avaneb.
 */
export default function OrgJoinClient() {
  const { t } = useI18n();
  /* ⓘ kiirmenüüs: sama selgitus mis organisatsioonide avalehel (liitumine ja kohad). */
  usePanelInfoSlot({ infoId: "org" });
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { call, error } = useOrgApi();
  const [preview, setPreview] = useState(null);
  const [done, setDone] = useState("");
  const [leaving, setLeaving] = useState(false);
  /* Kumb vastus on teel ("accept" või "decline"): `busy` on tõene ka eelvaate laadimisel. */
  const [pending, setPending] = useState("");
  const sending = useRef(false);
  const rootRef = useRef(null);
  const confirm = useSecondPress();

  useEffect(() => {
    let cancelled = false;
    if (!token) return undefined;
    (async () => {
      const payload = await call(`/api/org/join?token=${encodeURIComponent(token)}`, {
        fallbackKey: "org.errors.invite_invalid"
      });
      if (!cancelled && payload?.preview) setPreview(payload.preview);
    })();
    return () => {
      cancelled = true;
    };
  }, [call, token]);

  const respond = useCallback(
    async (action) => {
      /* Topeltvajutus ei saada teist päringut: `busy` jõuab nupuni alles
         järgmise joonistusega. */
      if (sending.current) return;
      sending.current = true;
      setPending(action);
      let opening = false;
      try {
        const payload = await call("/api/org/join", {
          method: "POST",
          body: { token, action },
          fallbackKey: "org.errors.invite_invalid"
        });
        if (!payload) return;
        if (action === "accept") {
          /* Lukk jääb peale, kuni tööruum avaneb. */
          opening = true;
          setLeaving(true);
          router.push(payload.organizationId ? `/org/${payload.organizationId}` : "/org");
          return;
        }
        setDone(t("org.invites.declined"));
        setPreview(null);
      } finally {
        if (!opening) {
          sending.current = false;
          setPending("");
        }
      }
    },
    [call, router, t, token]
  );

  const state = joinState({ token, preview, done, error, leaving });

  /* Seisu vahetusel (eelvaade → otsus) kaob vajutatud nupp: fookus läheb vaate
     pealkirjale. Esimesel joonistusel fookust ei võeta. */
  const shown = useRef("");
  useEffect(() => {
    const first = shown.current === "";
    const moved = shown.current !== state;
    shown.current = state;
    if (first || !moved || state === "waiting") return;
    rootRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
  }, [state]);

  const title = t("org.invites.previewHeading");
  const home = { href: "/org", label: t("org.home.heading") };
  let view;
  if (state === "no_token") view = <MessageView title={title} text={t("org.join.no_token")} tone="risk" action={home} />;
  else if (state === "leaving") view = <WaitingView title={title} text={t("org.join.opening")} />;
  else if (state === "done") view = <MessageView title={title} text={done} action={home} />;
  else if (state === "failed") view = <MessageView title={title} text={error} tone="risk" action={home} />;
  else if (state === "waiting") view = <WaitingView title={title} text={t("org.join.loading")} />;
  else {
    const name = offeredName(preview);
    view = (
      <InviteView
        t={t}
        question={t("org.join.invite_question", { name: organizationName(preview, { t }) })}
        facts={inviteFacts(preview, { t })}
        nameNote={name ? t("org.invites.previewName", { name }) : ""}
        notice={error ? { tone: "risk", text: error } : null}
        decline={{ armed: confirm.armed === "decline", busy: pending === "decline", onPress: () => confirm.press("decline", () => respond("decline")) }}
        accept={{
          busy: pending === "accept",
          onPress: () => {
            confirm.clear();
            void respond("accept");
          }
        }}
      />
    );
  }

  /* Lehe nimi on kiirmenüüs; pealkiri jääb ekraanilugejale. */
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <div className={shared.page} ref={rootRef}>
        {view}
      </div>
    </>
  );
}
