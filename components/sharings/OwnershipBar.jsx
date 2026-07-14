import styles from "./MySharingsPage.module.css";

export default function OwnershipBar({ visibility, origin, validity, labels }) {
  const items = [
    { key: "visibility", label: labels.visibility, value: visibility },
    { key: "origin", label: labels.origin, value: origin },
    { key: "validity", label: labels.validity, value: validity }
  ];

  return (
    <dl className={styles.ownershipBar}>
      {items.map((item) => (
        <div key={item.key} className={styles.ownershipCell} data-kind={item.key}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
