"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { HOME_CARE_LIMITS } from "@/lib/homeCare/constants";

import { useScreenFocus } from "../client/useScreenFocus";
import { useSendOnce } from "../client/useSendOnce";
import { answerReady, nextRideLine, requestReady, rideChip, rideRights, rideStateLine, rideWhen, transportPage, transportRows } from "./transportRows";
import { RideAnswerView, RideCardView, RideRequestView, RideView, TransportView } from "./TransportViews";
import { useClientTransport } from "./useClientTransport";

/**
 * Kliendi lehe osa „Transport": konks hoiab olekut ja päringuid, siin pannakse
 * vaated kokku. Ees on üks vaade korraga: sõidud ja soovid, üks sõit,
 * hooldusjuhi vastus, uus soov või transpordikaart.
 *
 * Osa on lehel kogu aja (pooleli soov ei kao vaate vahetusel) ja joonistatakse
 * siis, kui ta on ees (`active`). Tagasi võetud soov või sõit kaob nimekirjast:
 * tagasivõtmine küsib seepärast teist vajutust.
 *
 * `who`: { canRequest, isCoordinator, canWrite }; `today`: tänane päev (varasemat päeva ei saa soovida);
 * `onChanged(transport)`: leht hoiab sama seisu osade laua plaadi jaoks.
 */
export default function ClientTransport({ active, organizationId, clientId, title, name, initial, who, today = "", onChanged }) {
  const { t } = useI18n();
  const formId = useId();
  const transport = useClientTransport({ organizationId, clientId, initial, onChanged });
  /* "" (sõidud), "new" (uus soov), "card" (transpordikaart), "ride:<id>", "arrange:<id>" või "decline:<id>". */
  const [screen, setScreen] = useState("");
  /* Tagasivõtmise esimene vajutus on tehtud. */
  const [armed, setArmed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const rootRef = useScreenFocus(screen);
  /* Teine vajutus päringu ajal ei saada teist soovi ega ava teist akent (kaart avaneb uues aknas kohe vajutuse peale). */
  const once = useSendOnce();

  if (!active) return null;

  const go = (next) => {
    setArmed(false);
    transport.setError("");
    setScreen(next);
  };
  const fault = transport.error ? { text: transport.error, tone: "risk" } : null;
  const wrap = (view) => <div ref={rootRef}>{view}</div>;
  const { form } = transport;
  const text = (key) => ({ value: form[key] || "", onChange: (value) => transport.setField(key, value), max: HOME_CARE_LIMITS.TRANSPORT_TEXT_MAX });
  const toList = { label: t("home_care.transport.cancel"), onBack: () => go("") };

  if (screen === "new" && who.canRequest) {
    return wrap(
      <RideRequestView
        title={t("home_care.transport.request")}
        form={{
          id: `${formId}-request`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (await once(transport.create)) go("");
          }
        }}
        day={{ label: t("home_care.transport.day_label"), value: form.wantedOn || "", onChange: (value) => transport.setField("wantedOn", value), min: today, required: true }}
        time={{ label: t("home_care.transport.time_label"), value: form.wantedTime || "", onChange: (value) => transport.setField("wantedTime", value) }}
        destination={{ label: t("home_care.transport.destination_label"), ...text("destination"), required: true }}
        needs={{ label: t("home_care.transport.needs_label"), ...text("needs") }}
        hint={t("home_care.transport.request_hint")}
        save={{ label: t("home_care.transport.request_save"), busy: transport.busy, disabled: !requestReady(form) }}
        notice={fault}
        back={toList}
      />
    );
  }

  if (screen === "card" && who.canRequest) {
    return wrap(
      <RideCardView
        title={t("home_care.transport.card_title")}
        text={t("home_care.transport.card_hint")}
        open={{
          label: t("home_care.transport.card_open"),
          busy: transport.busy,
          onOpen: () => once(transport.openCard)
        }}
        notice={fault}
        back={{ label: t("home_care.parts.back"), onBack: () => go("") }}
      />
    );
  }

  const [kind, id] = screen.split(":");
  const opened = id ? transport.data.requests.find((item) => item.id === id) : null;
  const rights = opened ? rideRights(opened, who) : null;

  if ((kind === "arrange" || kind === "decline") && opened && rights.answer) {
    const arranged = kind === "arrange";
    return wrap(
      <RideAnswerView
        title={t(arranged ? "home_care.transport.arrange" : "home_care.transport.decline")}
        when={rideWhen(t, opened)}
        destination={opened.destination}
        form={{
          id: `${formId}-answer`,
          onSubmit: async (event) => {
            event.preventDefault();
            if (await once(() => transport.answer({ kind, id: opened.id }))) go("");
          }
        }}
        pickup={arranged ? { label: t("home_care.transport.pickup_label"), value: form.pickupTime || "", onChange: (value) => transport.setField("pickupTime", value) } : null}
        note={{ label: t(arranged ? "home_care.transport.arrange_note_label" : "home_care.transport.decline_reason_label"), ...text("answerNote"), required: !arranged }}
        save={{ label: t(arranged ? "home_care.transport.arrange_save" : "home_care.transport.decline_save"), busy: transport.busy, disabled: !answerReady(kind, form) }}
        notice={fault}
        back={{ label: t("home_care.transport.cancel"), onBack: () => go(`ride:${opened.id}`) }}
      />
    );
  }

  if (opened) {
    const answer = (next, values) => () => {
      transport.start(values);
      go(`${next}:${opened.id}`);
    };
    return wrap(
      <RideView
        title={title}
        when={rideWhen(t, opened)}
        chip={rideChip(opened, who, { t })}
        destination={opened.destination}
        needs={opened.needs ? { label: t("home_care.transport.needs_short"), value: opened.needs } : null}
        state={rideStateLine(t, opened)}
        actions={[
          rights.answer ? { key: "arrange", label: t("home_care.transport.arrange"), onPress: answer("arrange", { pickupTime: opened.wantedTime || "", answerNote: "" }) } : null,
          rights.answer ? { key: "decline", label: t("home_care.transport.decline"), onPress: answer("decline", { answerNote: "" }) } : null,
          rights.withdraw
            ? {
                key: "withdraw",
                label: t("home_care.transport.withdraw"),
                armed,
                /* Tagasivõtmine küsib teist vajutust samal lahtril. */
                onPress: async () => {
                  if (!armed) {
                    setArmed(true);
                    return;
                  }
                  setArmed(false);
                  if (await once(() => transport.withdraw(opened))) setScreen("");
                }
              }
            : null
        ].filter(Boolean)}
        consequence={armed ? t(opened.state === "ARRANGED" ? "home_care.transport.withdraw_arranged_note" : "home_care.transport.withdraw_note") : ""}
        busy={transport.busy}
        notice={fault}
        back={{ label: t("home_care.parts.back"), onBack: () => go("") }}
      />
    );
  }

  const page = transportPage(transportRows(transport.data, who, { t }), expanded);
  return wrap(
    <TransportView
      title={title}
      name={name}
      next={nextRideLine(transport.data, { t })}
      rows={page.rows}
      onOpen={(key) => go(`ride:${key}`)}
      empty={t("home_care.transport.none")}
      busy={transport.busy}
      notice={fault}
      more={page.more ? { label: t("home_care.home.more"), onMore: () => setExpanded(true) } : null}
      card={who.canRequest ? { label: t("home_care.transport.card_title"), onOpen: () => go("card") } : null}
      request={
        who.canRequest
          ? {
              label: t("home_care.transport.request"),
              onRequest: () => {
                transport.start({ wantedOn: "", wantedTime: "", destination: "", needs: "" });
                go("new");
              }
            }
          : null
      }
    />
  );
}
