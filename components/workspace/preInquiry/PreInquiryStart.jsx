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

import styles from "./PreInquiryStart.module.css";

export default function PreInquiryStart({ title, lead, options, onStart }) {
  return (
    <div className={styles.start}>
      <header className={styles.head}>
        <h1 className={styles.title}>{title}</h1>
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
