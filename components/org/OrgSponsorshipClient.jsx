"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { MessageView, OfferView, WaitingView } from "./join/JoinViews";
import { joinState, offerFacts, organizationName } from "./join/joinRules";
import shared from "./org.module.css";
import { useOrgApi } from "./useOrgApi";
import { useSecondPress } from "./useSecondPress";

/**
 * Pöörduja sponsorluse vastuvõtt.
 *
 * KAKS SAMMU: eelvaade ei muuda midagi, nõustumine on eraldi tegu. Klikkimine
 * ei tekita tellimust ega sidet organisatsiooniga.
 *
 * Vaates EI OLE ühtegi organisatsiooni tööruumi elementi: pöörduja ei saa
 * liikmesust, ei näe struktuuri ega liikmeid. Ta näeb ainult seda, kes ja
 * mille eest maksab — ja mida see EI tähenda.
 *
 * KUJU (11.10). Igal seisul on oma väike vaade (`./join/JoinViews.jsx`), seisu
 * ja read otsustab `./join/joinRules.js`. Keeldumine küsib teist vajutust samal
 * nupul; poolik link ütleb, mis on valesti (varem jäi leht tühjaks).
 */
export default function OrgSponsorshipClient() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { call, error } = useOrgApi();
  const [preview, setPreview] = useState(null);
  const [done, setDone] = useState("");
  /* Kumb vastus on teel ("accept" või "decline"): `busy` on tõene ka eelvaate laadimisel. */
  const [pending, setPending] = useState("");
  const sending = useRef(false);
  const rootRef = useRef(null);
  const confirm = useSecondPress();

  useEffect(() => {
    let cancelled = false;
    if (!token) return undefined;
    (async () => {
      const payload = await call(`/api/org/sponsorlus?token=${encodeURIComponent(token)}`, {
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
      try {
        const payload = await call("/api/org/sponsorlus", {
          method: "POST",
          body: { token, action },
          fallbackKey: "org.errors.invite_invalid"
        });
        if (!payload) return;
        setDone(action === "accept" ? t("org.sponsorship.accepted") : t("org.sponsorship.declined"));
        setPreview(null);
      } finally {
        sending.current = false;
        setPending("");
      }
    },
    [call, t, token]
  );

  const state = joinState({ token, preview, done, error });

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

  const title = t("org.sponsorship.previewHeading");
  let view;
  if (state === "no_token") view = <MessageView title={title} text={t("org.join.offer_no_token")} tone="risk" />;
  else if (state === "done") view = <MessageView title={title} text={done} />;
  else if (state === "failed") view = <MessageView title={title} text={error} tone="risk" />;
  else if (state === "waiting") view = <WaitingView title={title} text={t("org.join.offer_loading")} />;
  else {
    view = (
      <OfferView
        t={t}
        question={t("org.join.offer_question", { name: organizationName(preview, { t }) })}
        facts={offerFacts(preview, { t, locale })}
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
