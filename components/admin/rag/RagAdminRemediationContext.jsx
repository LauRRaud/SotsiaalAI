"use client";

import { useSearchParams } from "next/navigation";

import { buildRemediationContext } from "./remediationContext";

export default function RagAdminRemediationContext({ locale = "en" }) {
  const searchParams = useSearchParams();
  const context = buildRemediationContext(searchParams, locale);
  const et = String(locale || "").toLowerCase().startsWith("et");

  if (!context) return null;

  return (
    <section aria-label={et ? "Parandustöö kontekst" : "Remediation context"}>
      <div>
        <div>
          <div>{et ? "Quality queue parandustöö" : "Quality queue fix context"}</div>
          <div>
            {et
              ? "See vaade avati admin analytics quality queue lingilt. Allpool on paranduse siht ja väljad, mida kontrollida."
              : "This view was opened from an admin analytics quality queue link. The target and fields to review are shown below."}
          </div>
        </div>
        <span>{context.actionLabel}</span>
      </div>

      {context.fieldLabels.length > 0 ? (
        <div>
          <span>{et ? "Väljad" : "Fields"}</span>
          {context.fieldLabels.map(field => (
            <span key={field}>{field}</span>
          ))}
        </div>
      ) : null}

      {context.recommendedFieldLabels.length > 0 ? (
        <div>
          <span>{et ? "Soovituslikud" : "Recommended"}</span>
          {context.recommendedFieldLabels.map(field => (
            <span key={field}>{field}</span>
          ))}
        </div>
      ) : null}

      {context.focus || context.fileKey ? (
        <div>
          <span>{et ? "Fookus" : "Focus"}</span>
          {context.focus ? <span>{context.focus}</span> : null}
          {context.fileKey ? <span>file_key: {context.fileKey}</span> : null}
        </div>
      ) : null}

      {context.identifiers.length > 0 ? (
        <div>
          {context.identifiers.map(([key, value]) => (
            <div key={key}>
              <div>{key}</div>
              <div title={value}>{value}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
