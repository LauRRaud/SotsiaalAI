/**
 * Kolm fakti ühe jagamise kohta: kes näeb, kust see tuli ja kui kaua kehtib.
 *
 * Varem oli see kolme lahtriga kast iga kirje kaardi sees (kast kastis ja iga
 * kirje kolm rida kõrgem). Nüüd on faktid nimetuse ja väärtuse paarid ühes
 * reas, mis murdub ainult siis, kui laiust ei jätku. Sõnastus ja järjekord on
 * samad: „kes näeb" on esimene ja teistest selgem.
 *
 * Kujundus: desk/sharings.module.css.
 */

import styles from "./desk/sharings.module.css";

export default function OwnershipBar({ visibility, origin, validity, labels }) {
  const items = [
    { key: "visibility", label: labels.visibility, value: visibility },
    { key: "origin", label: labels.origin, value: origin },
    { key: "validity", label: labels.validity, value: validity }
  ];

  return (
    <dl className={styles.facts}>
      {items.map((item) => (
        <div key={item.key} className={styles.fact} data-kind={item.key}>
          <dt className={styles.factLabel}>{item.label}</dt>
          <dd className={styles.factValue}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
