"use client";

import { useId, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { PERSON_NAME_MAX } from "@/lib/org/personName";

/**
 * Inimese enda ees- ja perekonnanimi konto seadetes.
 *
 * Üks rida samas kujus nagu teised konto toimingud: vasakul selgitus ja väljad, paremal nupp.
 * Nimi salvestub eraldi marsruudiga (`PUT /api/profile/name`), mitte e-posti ja PIN-i rajaga.
 */
export default function ProfileNameForm({ initialFirstName = "", initialLastName = "", disabled = false, onSaved }) {
  const { t } = useI18n();
  const fieldId = useId();
  const [saved, setSaved] = useState({ firstName: initialFirstName, lastName: initialLastName });
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const first = firstName.trim();
  const last = lastName.trim();
  const dirty = first !== saved.firstName || last !== saved.lastName;
  const complete = Boolean(first && last);

  const change = (setter) => (event) => {
    setter(event.target.value);
    setDone(false);
    setError("");
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy || !dirty || !complete) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/profile/name", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ firstName: first, lastName: last })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setError(resolveApiMessage({ payload, t, fallbackKey: "profile.name.save_failed" }));
        return;
      }
      const name = { firstName: payload.name?.firstName || first, lastName: payload.name?.lastName || last };
      setSaved(name);
      setFirstName(name.firstName);
      setLastName(name.lastName);
      setDone(true);
      onSaved?.(name);
    } catch {
      setError(t("profile.name.save_failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="konto-row konto-name" onSubmit={save} noValidate aria-busy={busy}>
      <div className="konto-row__text">
        <p className="konto-hint">{t("profile.name.hint")}</p>
        <div className="konto-name__fields">
          <label htmlFor={`${fieldId}-first`}>
            <span className="konto-hint">{t("profile.name.first")}</span>
            <Input
              id={`${fieldId}-first`}
              type="text"
              autoComplete="given-name"
              maxLength={PERSON_NAME_MAX}
              value={firstName}
              onChange={change(setFirstName)}
              disabled={disabled || busy}
              invalid={dirty && !first}
            />
          </label>
          <label htmlFor={`${fieldId}-last`}>
            <span className="konto-hint">{t("profile.name.last")}</span>
            <Input
              id={`${fieldId}-last`}
              type="text"
              autoComplete="family-name"
              maxLength={PERSON_NAME_MAX}
              value={lastName}
              onChange={change(setLastName)}
              disabled={disabled || busy}
              invalid={dirty && !last}
            />
          </label>
        </div>
        {/* Salvestamise nupp on poole nimega kinni; see rida ütleb, miks. */}
        {dirty && !complete ? (
          <p className="konto-hint" role="status">
            {t("profile.name.incomplete")}
          </p>
        ) : null}
        {error ? (
          <p className="konto-hint" role="alert">
            {error}
          </p>
        ) : null}
        {done && !dirty ? (
          <p className="konto-hint" role="status">
            {t("profile.name.saved")}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={disabled || busy || !dirty || !complete}>
        {t("profile.name.save")}
      </Button>
    </form>
  );
}
