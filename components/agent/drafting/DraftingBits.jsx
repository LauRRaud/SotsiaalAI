"use client";

/**
 * Koostamisruumi vaadete ühised tükid: märk, teated, tasulise töö nupp,
 * jalarea märkus ja juhise vaate kuju.
 *
 * Siin on ainult kuju. Olek, päringud ja kõik otsused on failis
 * ../AgentModePage.jsx, reeglid failis ./draftingModel.js.
 *
 * Kujundus: drafting.module.css (siin kõrval).
 */

import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";

import styles from "./drafting.module.css";

/* Loendur ilmub alles piiri lähedal, et see tavalist kirjutamist ei segaks. */
const COUNTER_FROM_LEFT = 300;

/**
 * All hoitud Enter või tühik ei vajuta nuppu uuesti (klahvikordus). Kehtib
 * nuppudele, mis käivitavad tasulise töö või küsivad teist vajutust: muidu
 * läbiks üks liigutus mõlemad astmed.
 */
export const noKeyRepeat = (event) => {
  if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
};

export function Chip({ tone, children }) {
  return (
    <span className={styles.chip} data-tone={tone}>
      {children}
    </span>
  );
}

/**
 * Lehe teated selle vaate sees, mis on parajasti ees. Õnnestumise teade sulgub
 * nupust (kinnitamise teade ka ise); viga jääb ette kuni järgmise tegevuseni.
 * Teate lingid on kas allalaadimised (`href`) või tee teisele lehele
 * (`onClick`: leht küsib teist vajutust, kui tekst on salvestamata).
 */
export function Notices({ t, notice }) {
  if (!notice?.ok && !notice?.error) return null;
  return (
    <div className={styles.notices}>
      {notice.ok ? (
        /* `aria-live`, mitte status-roll: paneeli üldkiht joonistab iga
           status-rolliga elemendi oma värvi ja veeristega. */
        <p className={styles.notice} data-tone="ok" aria-live="polite">
          <span>{notice.ok}</span>
          <span className={styles.noticeActions}>
            {(notice.links || []).map((link) =>
              link.href ? (
                <a key={link.key} className={styles.textLink} href={link.href}>
                  {link.label}
                </a>
              ) : (
                <button key={link.key} type="button" className={styles.textButton} onClick={link.onClick}>
                  {link.label}
                </button>
              )
            )}
            {notice.onClose ? (
              <button type="button" className={styles.textButton} onClick={notice.onClose}>
                {t("common.close")}
              </button>
            ) : null}
          </span>
        </p>
      ) : null}
      {notice.error ? (
        <p className={styles.notice} data-tone="risk" role="alert">
          {notice.error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Tasulise töö nupp (koostamine, täiendamine, transkript, kokkuvõte).
 *
 * Tasuline töö käivitub ainult selle nupu vajutusest. Klahvikordus ei vajuta;
 * topeltklõpsu ja pooleli päringu jätab vahele leht (`runPaid`). `glow`: nupu
 * läige on ainult ees oleval vaatel (lava hoiab kõik vaated lehel ja brauser
 * lubab läikepindu piiratud arvu).
 */
export function PaidButton({ glow, disabled, onPress, children }) {
  return (
    <Button type="button" size="sm" variant="primary" glow={glow} disabled={disabled} onKeyDown={noKeyRepeat} onClick={onPress}>
      {children}
    </Button>
  );
}

/** Tegevusrea nupud kirjeldusest: `href` teeb lingi (allalaadimine), muidu nupp. */
export function ActionButtons({ actions, glow }) {
  return (actions || []).map((action) =>
    action.href ? (
      <Button key={action.key} as="a" href={action.href} size="sm" variant={action.variant || "secondary"}>
        {action.label}
      </Button>
    ) : (
      <Button
        key={action.key}
        type="button"
        size="sm"
        variant={action.variant || "secondary"}
        glow={action.variant === "primary" ? glow : undefined}
        disabled={action.disabled}
        /* Teist vajutust küsiv nupp: klahvikordus ei tohi mõlemat astet läbida. */
        onKeyDown={noKeyRepeat}
        onClick={action.onClick}
      >
        {action.label}
      </Button>
    )
  );
}

/**
 * Vaate jalarea märkus: tee tagasi (heli rajalt koostamise juurde), lause (mis
 * puudub, mis käib, mida teine vajutus teeb) ja tee vaatesse, kus puuduvat saab
 * lisada. Tühja märkuse korral ei joonista midagi.
 */
export function footNote({ back, text, go } = {}) {
  if (!back && !text && !go) return "";
  return (
    <span className={styles.footNote}>
      {back ? (
        <button type="button" className={styles.textButton} aria-label={back.label} onClick={back.onClick}>
          ‹ {back.text}
        </button>
      ) : null}
      {text ? <span>{text}</span> : null}
      {go ? (
        <button type="button" className={styles.textButton} onClick={go.onClick}>
          {go.label} ›
        </button>
      ) : null}
    </span>
  );
}

/**
 * Isikuandmete kontrolli küsimus enne tasulist tööd: sama samm, mille vestluse
 * sisestusriba tegi enne saatmist. Valikud tulevad lehelt; „saada maskeeritult”
 * ja „saada siiski” jätkavad sama tööd, seega kehtib neile sama klahvikorduse
 * reegel mis tasulise töö nupule.
 */
function PrivacyPrompt({ prompt, glow }) {
  if (!prompt) return null;
  return (
    <div className={styles.privacy} role="alert">
      <p className={styles.privacyTitle}>{prompt.title}</p>
      <p className={styles.privacyText}>{prompt.text}</p>
      {prompt.findings ? <p className={styles.meta}>{prompt.findings}</p> : null}
      <div className={styles.buttons}>
        {prompt.choices.map((choice) => (
          <Button
            key={choice.key}
            type="button"
            size="sm"
            variant={choice.primary ? "primary" : "secondary"}
            glow={choice.primary ? glow : undefined}
            onKeyDown={noKeyRepeat}
            onClick={choice.onPress}
          >
            {choice.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Juhise vaate kuju: üks tekstiväli ja üks tasulise töö nupp. Sama kuju kannab
 * koostamise juhist ja mustandi täiendamise juhist.
 *
 * Väli ei lähe töö ajaks lukku (lukustamine viiks fookuse ära); pooleli töö ajal
 * on nupp väljas ja selle kõrval on „Peata”. `prompt.privacy` on isikuandmete
 * kontrolli küsimus, `prompt.chips` lühike rida sellest, millest ja mida
 * koostatakse.
 */
export function PromptPanel({ t, title, lead, notice, prompt, glow }) {
  const length = String(prompt.value || "").length;
  const showCounter = prompt.limit && length >= prompt.limit - COUNTER_FROM_LEFT;
  return (
    <StepPanel
      title={title}
      lead={lead}
      note={prompt.note}
      actions={
        <>
          {prompt.stop ? (
            <Button type="button" size="sm" variant="secondary" onClick={prompt.stop.onPress}>
              {prompt.stop.label}
            </Button>
          ) : null}
          <PaidButton glow={glow} disabled={prompt.disabled} onPress={prompt.onPress}>
            {prompt.action}
          </PaidButton>
        </>
      }
    >
      <div className={styles.stack}>
        <Notices t={t} notice={notice} />
        <div className={styles.prompt}>
          <TextAreaField label={prompt.label} labelHidden rows={prompt.rows || 6} maxLength={prompt.limit} value={prompt.value} onChange={prompt.onChange} />
          {showCounter ? (
            <span className={styles.counter} aria-live="polite">
              {length}/{prompt.limit}
            </span>
          ) : null}
        </div>
        {prompt.chips?.length ? (
          <div className={styles.line}>
            {prompt.chips.map((chip) => (
              <Chip key={chip.key} tone="quiet">
                {chip.text}
              </Chip>
            ))}
          </div>
        ) : null}
        <PrivacyPrompt prompt={prompt.privacy} glow={glow} />
      </div>
    </StepPanel>
  );
}
