"use client";

/**
 * SK-V1 E3 — kiireloomulise abipalve sissevõtt. Avalik nimi „Kiireloomuline
 * abipalve" (O-SK-7); „Sotsiaalkiirabi" on sisemine teemakood ja seda siin ei
 * kuvata.
 *
 * Neli asja on siin tahtlikud ja neid ei tohi „kasutajamugavuse" nimel muuta:
 *
 *   1. **Piirkonna valik tuleb avatud laudade loendist**, mitte omavalitsuste
 *      registrist. Kui ükski laud ei ole valmis, ei ole ka valikut ega vormi —
 *      nuppu, mis ei vii kuhugi, siin ei teki.
 *   2. **Kriisilukk on esimene samm.** „Kas keegi on ohus? Jah" viib kohe 112
 *      ekraanile ega saada midagi. Sama teeb `detectCrisis()` teksti peal. Server
 *      kordab mõlemat kontrolli — see siin on kiirus, mitte kaitse.
 *   3. **Inimene näeb ENNE saatmist, kuhu ja mis läheb**: laua nimi, lugemisaeg,
 *      kes tohib pöörduda, tema kulu ja 112 piir. Saatmine ongi nõusolek
 *      (leping 3.4), seega peab pilt olema täielik enne vajutust.
 *   4. **Neli välja, mitte rohkem.** Sissetulek, leibkond, eluase ja varasemad
 *      teenused on vastuvõtja töö küsida. Pikk küsimustik kell 23.47 ei ole
 *      eelinfo kogumine, vaid filter, mis jätab välja täpselt need, kelle pärast
 *      see funktsioon olemas on.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { detectCrisis } from "@/lib/chat/safety";

function txt(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

const EMPTY = {
  municipalityId: "",
  situationVerbatim: "",
  contactName: "",
  contactPhone: "",
  safetyAnswer: null
};

function DeskCard({ t, desk }) {
  if (!desk) return null;
  const rows = [
    ["urgent.desk.reading_time", "Lugemisaeg", desk.readingTimePromise],
    ["urgent.desk.opening_hours", "Tööaeg", desk.openingHours],
    ["urgent.desk.who_may_contact", "Kes tohib pöörduda", desk.whoMayContact],
    ["urgent.desk.cost", "Sinu kulu", desk.costToPerson],
    ["urgent.desk.contact_channel", "Vastuvõtt", desk.contactChannel],
    ["urgent.desk.emergency_boundary", "Millal helistada 112", desk.emergencyBoundary]
  ];
  return (
    <section aria-labelledby="urgent-desk-heading">
      <h3 id="urgent-desk-heading">{txt(t, "urgent.desk.heading", "Kuhu see läheb")}</h3>
      <p><strong>{desk.publicName}</strong></p>
      <dl>
        {rows.map(([key, fallback, value]) => (
          <div key={key}>
            <dt>{txt(t, key, fallback)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {/* Lugemisaeg ei ole reageerimisaeg. Seda ei tohi jätta lugejale endale
          tõlgendada — vale ootus on siin kallim kui liigne tekst. */}
      <p><small>{txt(t, "urgent.desk.reading_time_note", "Platvorm saab lubada ainult seda, millal keegi sinu kirjelduse läbi loeb.")}</small></p>
      {desk.preAssessmentRequired ? (
        <p>{txt(t, "urgent.desk.pre_assessment_required", "See omavalitsus eeldab eelhindamist.")}</p>
      ) : null}
    </section>
  );
}

export default function UrgentRequestForm() {
  const { t } = useI18n();
  const { status } = useSession();

  const [regions, setRegions] = useState([]);
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [stage, setStage] = useState("form");
  const [sent, setSent] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const loadRegions = useCallback(async () => {
    setLoadingRegions(true);
    try {
      const response = await fetch("/api/urgent-requests/regions", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      setRegions(response.ok && Array.isArray(payload?.regions) ? payload.regions : []);
    } catch {
      setRegions([]);
    } finally {
      setLoadingRegions(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") void loadRegions();
  }, [status, loadRegions]);

  const selected = useMemo(
    () => regions.find((region) => region.municipalityId === form.municipalityId) || null,
    [regions, form.municipalityId]
  );

  if (status === "loading") return <p>{txt(t, "urgent.loading", "Laen...")}</p>;

  if (status !== "authenticated") {
    return (
      <section>
        <h2>{txt(t, "urgent.title", "Kiireloomuline abipalve")}</h2>
        <p><strong>{txt(t, "urgent.not_emergency", "See ei ole hädaabinumber. Vahetu ohu korral helista 112.")}</strong></p>
        <p>{txt(t, "urgent.auth_required", "Abipalve saatmiseks logi sisse.")}</p>
        <Button as="a" href="/vestlus?login=1">{txt(t, "urgent.actions.login", "Logi sisse")}</Button>
      </section>
    );
  }

  // Haru C: eluoht ei tekita järjekorda. See ekraan ei ole veateade, vaid
  // vastus — ja ta ei paku ühtegi teed tagasi saatmise juurde peale enda
  // ümberlükkamise.
  if (stage === "emergency") {
    return (
      <section aria-labelledby="urgent-emergency-title">
        <h2 id="urgent-emergency-title">{txt(t, "urgent.emergency.title", "Helista kohe 112")}</h2>
        <p>{txt(t, "urgent.emergency.body", "Sa kirjeldasid olukorda, kus keegi võib olla vahetus ohus.")}</p>
        <p>{txt(t, "chat.crisis.notice", "Vahetu ohu korral helista 112.")}</p>
        <Button type="button" onClick={() => setStage("form")}>
          {txt(t, "urgent.emergency.back", "Tagasi vormile")}
        </Button>
      </section>
    );
  }

  if (stage === "sent" && sent) {
    return (
      <section aria-labelledby="urgent-sent-title">
        <h2 id="urgent-sent-title">{txt(t, "urgent.sent.title", "Abipalve on saadetud")}</h2>
        <p>{txt(t, `urgent.status.${sent.status}`, sent.status)}</p>
        <p>{txt(t, "urgent.sent.reading_time", "Lubatud lugemisaeg: {readingTime}").replace("{readingTime}", sent.readingTimePromise || "")}</p>
        {sent.canRecall ? (
          <>
            <p><small>{txt(t, "urgent.sent.recall_hint", "Saad selle tagasi võtta seni, kuni keegi ei ole seda läbi lugenud.")}</small></p>
            <Button type="button" disabled={busy} onClick={() => void act(`/api/urgent-requests/${sent.id}/recall`)}>
              {txt(t, "urgent.sent.recall", "Võta tagasi")}
            </Button>
          </>
        ) : null}
        {sent.convertedPreInquiryId ? (
          <p>{txt(t, "urgent.sent.converted", "Sellest on tehtud eelpöördumise mustand.")}</p>
        ) : (
          <Button type="button" disabled={busy} onClick={() => void act(`/api/urgent-requests/${sent.id}/convert`)}>
            {txt(t, "urgent.sent.convert", "Tee sellest eelpöördumine")}
          </Button>
        )}
        {error ? <p role="alert">{error}</p> : null}
      </section>
    );
  }

  if (loadingRegions) return <p>{txt(t, "urgent.loading", "Laen...")}</p>;

  // Haru B: rada on peidetud. Mitte „nupp, mis annab vea", vaid aus vastus koos
  // sellega, mis ASEMEL olemas on.
  if (!regions.length) {
    return (
      <section aria-labelledby="urgent-unavailable-title">
        <h2 id="urgent-unavailable-title">{txt(t, "urgent.unavailable.title", "Selles piirkonnas seda rada praegu ei ole")}</h2>
        <p>{txt(t, "urgent.unavailable.body", "Kiireloomulise abipalve saab saata ainult sinna, kus on kokku lepitud vastuvõtulaud ja lugemisaeg.")}</p>
        <p><strong>{txt(t, "urgent.not_emergency", "See ei ole hädaabinumber. Vahetu ohu korral helista 112.")}</strong></p>
        <ul>
          <li><a href="/teenusekaart">{txt(t, "urgent.unavailable.services_link", "Vaata teenusekaarti")}</a></li>
          <li><a href="/eelpoordumised">{txt(t, "urgent.unavailable.pre_inquiry_link", "Koosta eelpöördumine")}</a></li>
        </ul>
      </section>
    );
  }

  async function act(url) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(txt(t, `urgent.errors.${String(payload?.message || "").split(".").pop()}`, txt(t, "urgent.errors.generic", "Toiming ebaõnnestus.")));
      if (payload?.request) setSent(payload.request);
    } catch (actError) {
      setError(actError?.message || txt(t, "urgent.errors.generic", "Toiming ebaõnnestus."));
    } finally {
      setBusy(false);
    }
  }

  function review(event) {
    event.preventDefault();
    setError("");

    // Kriisilukk ENNE valideerimist: eluohtlikus olukorras ei tohi inimene
    // saada veateadet puuduva telefoni kohta.
    if (form.safetyAnswer === true || detectCrisis(form.situationVerbatim)) {
      setStage("emergency");
      return;
    }
    /* SOL-URG-03: vastamata ohuküsimus ei tohi jõuda kinnitusekraanile. Vana
       kontroll vaatas ainult `=== true`, seega `null` libises edasi ja saatmisel
       muutus eituseks. Server ütleb sama asja teist korda — see ei ole dubleerimine,
       vaid see, et liides ei ole kunagi ainus värav. */
    if (form.safetyAnswer !== false) {
      return setError(txt(t, "urgent.errors.safety_answer_required", "Vasta, kas keegi on praegu ohus."));
    }
    if (!form.municipalityId) return setError(txt(t, "urgent.errors.municipality_required", "Vali omavalitsus."));
    if (!form.situationVerbatim.trim()) return setError(txt(t, "urgent.errors.situation_required", "Kirjelda, mis toimub."));
    if (!form.contactName.trim()) return setError(txt(t, "urgent.errors.contact_name_required", "Lisa nimi."));
    if (!form.contactPhone.trim()) return setError(txt(t, "urgent.errors.contact_phone_required", "Lisa telefon."));
    setStage("confirm");
  }

  async function send() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/urgent-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          municipalityId: form.municipalityId,
          situationVerbatim: form.situationVerbatim,
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          // SOL-URG-03: toorelt, mitte `=== true` — server peab nägema teadmatust.
          safetyAnswer: form.safetyAnswer
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (payload?.emergency) {
        setStage("emergency");
        return;
      }
      if (!response.ok) {
        const tail = String(payload?.message || "").split(".").pop();
        throw new Error(txt(t, `urgent.errors.${tail}`, txt(t, "urgent.errors.generic", "Saatmine ebaõnnestus.")));
      }
      setSent(payload?.request || null);
      setStage("sent");
    } catch (sendError) {
      setError(sendError?.message || txt(t, "urgent.errors.generic", "Saatmine ebaõnnestus."));
      setStage("form");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "confirm") {
    return (
      <section aria-labelledby="urgent-confirm-title">
        <h2 id="urgent-confirm-title">{txt(t, "urgent.confirm.title", "Kontrolli enne saatmist")}</h2>
        <DeskCard t={t} desk={selected?.desk} />
        <h3>{txt(t, "urgent.confirm.what_goes", "Mis läheb")}</h3>
        {/* Inimese enda sõnad, muutmata — sama tekst, mille vastuvõtja näeb. */}
        <blockquote>{form.situationVerbatim}</blockquote>
        <p>{form.contactName}</p>
        <p>{form.contactPhone}</p>
        <p><small>{txt(t, "urgent.form.consent_note", "Saatmine ongi sinu nõusolek.")}</small></p>
        {error ? <p role="alert">{error}</p> : null}
        <Button type="button" onClick={() => void send()} disabled={busy}>
          {busy ? txt(t, "urgent.form.submitting", "Saadan...") : txt(t, "urgent.form.submit", "Saada abipalve")}
        </Button>
        <Button type="button" onClick={() => setStage("form")} disabled={busy}>
          {txt(t, "urgent.confirm.back", "Muuda")}
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="urgent-title">
      <h2 id="urgent-title">{txt(t, "urgent.title", "Kiireloomuline abipalve")}</h2>
      <p><strong>{txt(t, "urgent.not_emergency", "See ei ole hädaabinumber. Vahetu ohu korral helista 112.")}</strong></p>
      <p>{txt(t, "urgent.lead", "Kui olukord ei kannata hommikuni, kirjelda see siin oma sõnadega.")}</p>

      <form onSubmit={review}>
        <label>
          <span>{txt(t, "urgent.form.municipality_label", "Kus sa oled?")}</span>
          <select
            value={form.municipalityId}
            onChange={(event) => set("municipalityId", event.target.value)}
          >
            <option value="">{txt(t, "urgent.form.municipality_placeholder", "Vali omavalitsus")}</option>
            {regions.map((region) => (
              <option key={region.municipalityId} value={region.municipalityId}>
                {region.municipalityName}
              </option>
            ))}
          </select>
        </label>

        {selected ? <DeskCard t={t} desk={selected.desk} /> : null}

        {/* Kriisiküsimus seisab vormi ees, mitte lõpus: tema vastus otsustab,
            kas ülejäänud vormi üldse täidetakse. */}
        <fieldset>
          <legend>{txt(t, "urgent.form.safety_label", "Kas keegi on praegu ohus?")}</legend>
          <label>
            <input
              type="radio"
              name="urgent-safety"
              checked={form.safetyAnswer === true}
              onChange={() => {
                set("safetyAnswer", true);
                setStage("emergency");
              }}
            />
            <span>{txt(t, "urgent.form.safety_yes", "Jah")}</span>
          </label>
          <label>
            <input
              type="radio"
              name="urgent-safety"
              checked={form.safetyAnswer === false}
              onChange={() => set("safetyAnswer", false)}
            />
            <span>{txt(t, "urgent.form.safety_no", "Ei")}</span>
          </label>
        </fieldset>

        <label>
          <span>{txt(t, "urgent.form.situation_label", "Mis toimub?")}</span>
          <textarea
            rows={6}
            value={form.situationVerbatim}
            onChange={(event) => set("situationVerbatim", event.target.value)}
          />
          <small>{txt(t, "urgent.form.situation_help", "Kirjuta oma sõnadega. Vastuvõtja näeb sinu teksti täpselt nii, nagu sa selle kirjutasid.")}</small>
        </label>

        <label>
          <span>{txt(t, "urgent.form.contact_name_label", "Sinu nimi")}</span>
          <Input value={form.contactName} onChange={(event) => set("contactName", event.target.value)} />
        </label>

        <label>
          <span>{txt(t, "urgent.form.contact_phone_label", "Telefon, millelt sind kätte saab")}</span>
          <Input
            type="tel"
            value={form.contactPhone}
            onChange={(event) => set("contactPhone", event.target.value)}
          />
        </label>

        {error ? <p role="alert">{error}</p> : null}
        <Button type="submit" disabled={busy}>{txt(t, "urgent.form.submit", "Saada abipalve")}</Button>
      </form>
    </section>
  );
}
