"use client";

function text(t, key, fallback) {
  return typeof t === "function" ? t(key, fallback) : fallback;
}

function formatDate(value, locale) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const date = /^\d{4}-\d{2}-\d{2}$/u.test(raw)
    ? new Date(`${raw}T12:00:00.000Z`)
    : new Date(raw);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale || "et", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Tallinn"
  }).format(date);
}

export default function WorkspaceContinuity({
  t,
  locale = "et",
  status = "idle",
  items = [],
  onOpen,
  preference = null,
  onPreferenceChange
}) {
  return (
    <section
      className="workspace-continuity"
      aria-labelledby="workspace-continuity-title"
      aria-busy={status === "loading" ? "true" : "false"}
    >
      <header>
        <div>
          <span aria-hidden="true">↳</span>
          <h2 id="workspace-continuity-title">
            {text(t, "workspace_continuity.title", "Jätka siit")}
          </h2>
        </div>
        <small>{text(t, "workspace_continuity.limit", "Kuni 7 järgmist sammu")}</small>
      </header>

      {preference ? (
        <label className="workspace-continuity-preference">
          <input
            type="checkbox"
            checked={preference.emailEnabled === true}
            disabled={preference.status === "saving"}
            onChange={(event) => onPreferenceChange?.(event.target.checked)}
          />
          <span>
            {text(t, "notifications.email_preference", "Saada valikulised märguanded ka e-postiga")}
            <small>{text(t, "notifications.email_preference_hint", "Kirjad ei sisalda tööobjektide sisu.")}</small>
          </span>
        </label>
      ) : null}

      {status === "loading" ? (
        <div className="workspace-continuity-loading" role="status">
          <span>{text(t, "workspace_continuity.loading", "Koondan sinu pooleliolevaid tegevusi…")}</span>
        </div>
      ) : status === "error" ? (
        <p className="workspace-continuity-state" role="status">
          {text(t, "workspace_continuity.error", "Pooleliolevate tegevuste koond ei ole praegu saadaval.")}
        </p>
      ) : items.length ? (
        <ol>
          {items.map((item) => (
            <li key={`${item.kind}:${item.id}`}>
              <button type="button" onClick={() => onOpen?.(item.href)}>
                <span aria-hidden="true" className="workspace-continuity-fold" />
                <span>{text(t, item.labelKey, item.kind)}</span>
                {item.date ? <time dateTime={item.date}>{formatDate(item.date, locale)}</time> : null}
                <span aria-hidden="true">→</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="workspace-continuity-state">
          {text(t, "workspace_continuity.empty", "Hetkel ei ole pooleliolevaid tegevusi.")}
        </p>
      )}
    </section>
  );
}
