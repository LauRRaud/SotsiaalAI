"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";

import OrgPart from "./OrgPart";
import { DataView, EditorsView, NoProfileView, TextView } from "./profile/ProfileViews";
import { PROFILE_TABS, convertSubject, editorNames, formFromProfile, profileDirty, shownProfileTab } from "./profile/profileRules";
import { useOrgApi } from "./useOrgApi";

/**
 * Organisatsiooni teenuseprofiil.
 *
 * TOIMETAJAD ON NIMEDEGA (§5.9: „jagatud kontot ei looda"). Loend ei ole
 * kaunistus — ta on selle nõude nähtav pool: iga toimetaja on inimene, kelle
 * auditijälg on eraldi.
 *
 * SALVESTAMINE KANNAB VERSIOONI (`expectedUpdatedAt`). Kaks toimetajat võivad
 * sama profiili korraga avada; kes teisena salvestab, saab 409 ega kirjuta
 * esimese muudatust vaikselt üle.
 *
 * KUJU (11.10). Vorm ja toimetajate kast üksteise all on nüüd kolm väikest
 * vaadet (andmed, kirjeldus, toimetajad), vt ./profile/ProfileViews.jsx; reeglid
 * on failis ./profile/profileRules.js. Andmed ja kirjeldus on üks kirje ja üks
 * salvestus: kummagi vaate nupp salvestab kogu vormi.
 */
export default function OrgProfileClient({ context, profile, editors, convertibleProfile }) {
  const { t } = useI18n();
  const { call, error, setError } = useOrgApi();
  const [form, setForm] = useState(() => formFromProfile(profile));
  const [convertConfirmed, setConvertConfirmed] = useState(false);
  const [wantedTab, setWantedTab] = useState("data");
  /* Mis päring käib: "" | "save" | "convert". */
  const [pending, setPending] = useState("");
  const [hint, setHint] = useState("");
  const sending = useRef(false);
  /* Pärast salvestamist laadib leht end ise uuesti: siis brauser lahkumist üle ei küsi. */
  const reloading = useRef(false);
  const rootRef = useRef(null);

  const organizationId = context.organization.id;
  const writable = context?.writable !== false;

  const save = useCallback(async () => {
    const payload = await call(`/api/org/${organizationId}/teenusprofiil`, {
      method: "PATCH",
      body: { profileId: profile.id, expectedUpdatedAt: profile.updatedAt, ...form },
      fallbackKey: "org.errors.profile_update_failed"
    });
    if (payload) {
      reloading.current = true;
      window.location.reload();
    }
  }, [call, form, organizationId, profile]);

  const convert = useCallback(async () => {
    const payload = await call(`/api/org/${organizationId}/teenusprofiil`, {
      method: "POST",
      body: { profileId: convertibleProfile.id, ownerConfirmed: convertConfirmed },
      fallbackKey: "org.errors.profile_convert_failed"
    });
    if (payload) {
      reloading.current = true;
      window.location.reload();
    }
  }, [call, convertConfirmed, convertibleProfile, organizationId]);

  /* Üks tegevus korraga: topeltvajutus ei saada teist päringut. */
  const once = useCallback(async (name, work) => {
    if (sending.current) return;
    sending.current = true;
    setPending(name);
    setHint("");
    try {
      await work();
    } finally {
      sending.current = false;
      setPending("");
    }
  }, []);

  const tab = shownProfileTab(wantedTab);
  const dirty = profile ? profileDirty(form, profile) : false;

  /* Vaate vahetusel läheb fookus valitud lahtrile (lahtrid joonistatakse uuesti). */
  const shown = useRef("");
  useEffect(() => {
    const first = shown.current === "";
    const moved = shown.current !== tab;
    shown.current = tab;
    if (first || !moved) return;
    rootRef.current?.querySelector("[role=radio][aria-checked=true]")?.focus({ preventScroll: true });
  }, [tab]);

  /* Salvestamata muudatustega lehelt lahkumine: brauser küsib üle. */
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      if (reloading.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const notice = error ? { tone: "risk", text: error } : hint ? { tone: "risk", text: hint } : null;
  const wrap = (view) => (
    <div ref={rootRef}>
      <OrgPart context={context} part="profile">
        {view}
      </OrgPart>
    </div>
  );

  if (!profile) {
    return wrap(
      <NoProfileView
        t={t}
        notice={notice}
        convert={
          convertibleProfile && writable
            ? {
                subject: convertSubject(convertibleProfile, { t }),
                confirmed: convertConfirmed,
                onConfirm: (value) => {
                  setConvertConfirmed(value);
                  setHint("");
                },
                busy: pending === "convert",
                onConvert: () => {
                  if (!convertConfirmed) {
                    setHint(t("org.profile.need_confirm"));
                    return;
                  }
                  void once("convert", convert);
                }
              }
            : null
        }
      />
    );
  }

  const tabs = [...PROFILE_TABS];
  const changeTab = (value) => {
    setError("");
    setHint("");
    setWantedTab(value);
  };
  const changeField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const saver = writable ? { busy: pending === "save", onSave: () => once("save", save) } : null;

  if (tab === "editors") return wrap(<EditorsView t={t} tabs={tabs} tab={tab} onTab={changeTab} editors={editorNames(editors, { t })} />);
  if (tab === "text") return wrap(<TextView t={t} tabs={tabs} tab={tab} onTab={changeTab} form={form} onField={changeField} readOnly={!writable} dirty={dirty} notice={notice} save={saver} />);
  return wrap(<DataView t={t} tabs={tabs} tab={tab} onTab={changeTab} form={form} onField={changeField} readOnly={!writable} dirty={dirty} notice={notice} save={saver} />);
}
