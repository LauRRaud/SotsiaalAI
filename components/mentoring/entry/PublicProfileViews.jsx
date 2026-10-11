"use client";

/**
 * Mentori profiili vaated: kes ta on, tutvustus ja mentorluse taotlus.
 *
 * MIKS. Leht oli üks veerg tumeda kaardi sees: nimi, tutvustus, kogemus, sildid
 * ja kohe selle all taotluse vorm. Nüüd on kolm osa sammulaval:
 *  - `AboutView`    nimi, amet ja organisatsioon, valdkonnad, teemad, keeled, vormid
 *  - `StoryView`    tutvustus ja kogemus (pikk tekst, reavahetused jäävad alles)
 *  - `RequestView`  taotlus: tekst ja „Esita taotlus”; või lause, miks taotleda ei saa
 *
 * ESTA andmebaasist pärit kirjel taotluse osa ei ole: tema juurde viib link
 * ESTA lehele.
 *
 * Siin on ainult kuju. Andmed, päringud ja olek on failis
 * ../MentorProfilePublicPage.jsx; profiili jaotab osadeks ./entryRows.js.
 *
 * Kujundus: entry.module.css (siin kõrval).
 */

import StepPanel from "@/components/stage/StepPanel";
import TextAreaField from "@/components/stage/TextAreaField";
import Button from "@/components/ui/Button";

import { Chip, LinkCard, Notice, TextLink } from "./EntryParts";
import styles from "./entry.module.css";

/** Kes mentor on. `onRequest` viib taotluse osa juurde; `externalLink` on ESTA kirjel. */
export function AboutView({ t, heading, sub, chip, groups, note, externalLink, onRequest, backHref }) {
  return (
    <StepPanel
      title={t("mentoring.profile_public.views.about.title")}
      question={heading}
      lead={sub || undefined}
      actions={
        onRequest ? (
          <Button type="button" variant="primary" onClick={onRequest}>
            {t("mentoring.profile_public.request_title")}
          </Button>
        ) : undefined
      }
    >
      <div className={styles.stack}>
        <p className={styles.line}>
          <Chip tone={chip.tone}>{chip.text}</Chip>
        </p>
        {groups.length ? (
          <div className={styles.groups}>
            {groups.map((group) => (
              <section key={group.key} className={styles.group}>
                <h4 className={styles.groupTitle}>{group.title}</h4>
                <ul className={styles.tags}>
                  {group.items.map((item, index) => (
                    <li key={`${index}-${item}`} className={styles.tag}>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}
        {externalLink ? (
          <LinkCard
            external
            href={externalLink}
            title={t("mentoring.home.view_external_profile")}
            description={t("mentoring.profile_public.external_help")}
            newTabText={t("mentoring.labels.opens_new_tab")}
          />
        ) : null}
        <p className={styles.small}>{note}</p>
        <TextLink href={backHref}>{t("mentoring.labels.back_to_mentoring")}</TextLink>
      </div>
    </StepPanel>
  );
}

/** Tutvustus ja kogemus mentori enda sõnadega. */
export function StoryView({ t, bio, experience }) {
  return (
    <StepPanel title={t("mentoring.profile_public.views.story.title")}>
      <div className={styles.stack}>
        {bio ? <p className={styles.text}>{bio}</p> : null}
        {experience ? (
          <section className={styles.section}>
            <h4 className={styles.groupTitle}>{t("mentoring.profile_public.experience")}</h4>
            <p className={styles.text}>{experience}</p>
          </section>
        ) : null}
      </div>
    </StepPanel>
  );
}

/**
 * Taotlus. `mode`: `form` (saab taotleda), `sent` (taotlus läks teele) või
 * `full` (mentor ei võta praegu uusi taotlusi vastu).
 */
export function RequestView({ t, mode, message, onMessage, maxLength, busy, note, onSubmit, backHref }) {
  if (mode !== "form") {
    return (
      <StepPanel title={t("mentoring.profile_public.views.request.title")}>
        <div className={styles.stack}>
          {mode === "sent" ? (
            <Notice text={t("mentoring.profile_public.request_sent")} tone="ok" />
          ) : (
            <p className={styles.quiet}>{t("mentoring.profile_public.capacity_full_note")}</p>
          )}
          <TextLink href={backHref}>{t("mentoring.labels.back_to_mentoring")}</TextLink>
        </div>
      </StepPanel>
    );
  }
  return (
    <StepPanel
      title={t("mentoring.profile_public.views.request.title")}
      lead={t("mentoring.profile_public.request_help")}
      note={note}
      actions={
        <Button type="button" variant="primary" disabled={busy || !message.trim()} onClick={onSubmit}>
          {t("mentoring.profile_public.request_submit")}
        </Button>
      }
    >
      <TextAreaField
        label={t("mentoring.profile_public.request_message")}
        hint={t("mentoring.profile_public.no_client_data")}
        value={message}
        rows={5}
        maxLength={maxLength}
        disabled={busy}
        onChange={onMessage}
      />
    </StepPanel>
  );
}
