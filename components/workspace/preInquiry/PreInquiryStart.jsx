"use client";

/**
 * PreInquiryStart — eelpöördumise algus: kolm alustamise viisi kaartidena.
 *
 * Varem olid kolm sisuliselt erinevat teed kolm nuppu, kus pealkiri ja selgitus
 * jooksid üheks tekstiks kokku (kujundusaudit K02). Siin on igaüks omaette
 * kaart: pealkiri ütleb, mida inimene teeb, selgitus ütleb, mis siis juhtub.
 *
 * `options`: [{ id, title, description }]. Kõik kolm on alati valitavad:
 * „Jätkan Teekonnast" viib ilma kaasa tulnud Teekonnata Teekonna lehele, kust
 * eelpöördumist saab alustada (varem oli see valik lihtsalt lukus).
 *
 * Kujundus: PreInquiryStart.module.css.
 */

import ActionCard from "@/components/stage/ActionCard";
import Button from "@/components/ui/Button";

import styles from "./PreInquiryStart.module.css";

/**
 * `mine`: `{ label, onOpen }`, tee pöörduja enda eelpöördumiste loendisse (mustandid ja
 * saadetud). Varem pääses saadetud pöördumise juurde ainult Teekonna kaudu. Nupp seisab
 * pealkirja real paremal: see ei ole neljas viis alustada, vaid tee juba tehtu juurde, ja
 * omaette rida kaartide all ei mahtunud töölaua paneeli ära.
 *
 * `error`: lehe veateade (nt Teekonnast kaasa tulev info ei laadinud). Varem avaekraan seda ei
 * näidanud ja inimene jäi sõnatult algusesse.
 */
export default function PreInquiryStart({ title, lead, options, onStart, mine = null, error = "" }) {
  return (
    <div className={styles.start}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          {mine ? (
            <Button type="button" size="sm" variant="secondary" onClick={mine.onOpen}>
              {mine.label}
            </Button>
          ) : null}
        </div>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
      </header>
      <div className={styles.options} role="group" aria-label={title}>
        {options.map((option) => (
          <ActionCard key={option.id} title={option.title} description={option.description} onClick={() => onStart(option.id)} />
        ))}
      </div>
    </div>
  );
}
