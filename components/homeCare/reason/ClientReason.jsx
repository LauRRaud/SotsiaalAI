"use client";

import { useId } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import { FormView } from "../client/PartViews";
import { useSendOnce } from "../client/useSendOnce";
import { reasonCodes, reasonRights } from "./reasonRows";
import { useReason } from "./useReason";

/**
 * Põhjuse küsimine meeskonda mittekuuluvalt hooldajalt: üks vaade. Kaks kohta
 * kasutavad seda: lehe avamine (sisu asemel) ja juba lahti olev leht, kui
 * päevane luba lõppes või inimene eemaldati meeskonnast. Teisel juhul jääb leht
 * alles (vaade ilmub avatud vaate kohale), et pooleli olev kirje ei kaoks.
 *
 * Teine vajutus päringu ajal ei saada teist päringut. `writable`: põhjuse annab see, kes tohib kirjutada.
 */
export default function ClientReason({ organizationId, clientId, writable, onGranted }) {
  const { t } = useI18n();
  const formId = useId();
  const reason = useReason({ organizationId, clientId, onGranted });
  const once = useSendOnce();
  const rights = reasonRights({ writable });

  return (
    <FormView
      title={t("home_care.reason.title")}
      lead={t("home_care.reason.intro")}
      form={{
        id: `${formId}-reason`,
        onSubmit: async (event) => {
          event.preventDefault();
          if (rights.submit) await once(reason.submit);
        }
      }}
      fields={[
        { kind: "pick", key: "code", label: t("home_care.reason.code_label"), options: reasonCodes(t), value: reason.reasonCode, onChange: reason.setReasonCode },
        { kind: "text", key: "text", label: t("home_care.reason.text_label"), value: reason.reasonText, onChange: reason.setReasonText, max: 300 }
      ]}
      hint={rights.submit ? "" : t("home_care.client.read_only")}
      save={{ label: t("home_care.reason.submit"), busy: reason.busy, disabled: !rights.submit }}
      notice={reason.error ? { text: reason.error, tone: "risk" } : null}
      mark="reason"
    />
  );
}
