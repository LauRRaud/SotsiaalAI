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
  onRetry,
  onOpenSharings,
  preference = null,
  onPreferenceChange,
  featureEnabled = true
}) {
  const primary = items[0] || null;
  const waiting = items.slice(1);

  if (!featureEnabled) {
    return (
      <section className="workspace-continuity" aria-labelledby="workspace-continuity-title" aria-busy={status === "loading" ? "true" : "false"}>
        <header><div><span aria-hidden="true">↳</span><h2 id="workspace-continuity-title">{text(t, "workspace_continuity.title", "Jätka siit")}</h2></div></header>
        {status === "loading" ? <div className="workspace-continuity-loading" role="status"><span>{text(t, "workspace_continuity.loading", "Koondan sinu pooleliolevaid tegevusi…")}</span></div>
          : status === "error" ? <div className="workspace-continuity-state workspace-continuity-state--error" role="alert"><span>{text(t, "workspace_continuity.error", "Pooleliolevate tegevuste koond ei ole praegu saadaval.")}</span><button type="button" onClick={onRetry}>{text(t, "workspace_continuity.retry", "Proovi uuesti")}</button></div>
            : items.length ? <ol>{items.map((item) => <li key={`${item.kind}:${item.id}`}><button type="button" onClick={() => onOpen?.(item)}><span>{text(t, item.labelKey, item.kind)}</span>{item.date ? <time dateTime={item.date}>{formatDate(item.date, locale)}</time> : null}<span aria-hidden="true">→</span></button></li>)}</ol>
              : <p className="workspace-continuity-state">{text(t, "workspace_continuity.empty", "Hetkel ei ole pooleliolevaid tegevusi.")}</p>}
      </section>
    );
  }

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
        <small>{text(t, "workspace_continuity.focus_hint", "Üks järgmine samm korraga")}</small>
      </header>

      {status === "loading" ? (
        <div className="workspace-continuity-loading" role="status">
          <span>{text(t, "workspace_continuity.loading", "Koondan sinu pooleliolevaid tegevusi…")}</span>
        </div>
      ) : status === "error" ? (
        <div className="workspace-continuity-state workspace-continuity-state--error" role="alert">
          <span>{text(t, "workspace_continuity.error", "Pooleliolevate tegevuste koond ei ole praegu saadaval.")}</span>
          <button type="button" onClick={onRetry}>
            {text(t, "workspace_continuity.retry", "Proovi uuesti")}
          </button>
        </div>
      ) : primary ? (
        <>
          <article className="workspace-continuity-primary">
            <p>{text(t, "workspace_continuity.primary_eyebrow", "Kõige olulisem praegu")}</p>
            <h3>{text(t, primary.labelKey, primary.kind)}</h3>
            {primary.date ? <time dateTime={primary.date}>{formatDate(primary.date, locale)}</time> : null}
            <button type="button" onClick={() => onOpen?.(primary)}>
              {text(t, "workspace_continuity.continue_action", "Jätka")}
              <span aria-hidden="true">→</span>
            </button>
          </article>

          {waiting.length ? (
            <details className="workspace-continuity-waiting">
              <summary>
                {text(t, "workspace_continuity.waiting_title", "Ootab minu tegevust")}
                <span aria-label={text(t, "workspace_continuity.waiting_count", "Ootel tegevuste arv")}>{waiting.length}</span>
              </summary>
              <ol>
                {waiting.map((item) => (
                  <li key={`${item.kind}:${item.id}`}>
                    <button type="button" onClick={() => onOpen?.(item)}>
                      <span>{text(t, item.labelKey, item.kind)}</span>
                      {item.date ? <time dateTime={item.date}>{formatDate(item.date, locale)}</time> : null}
                      <span aria-hidden="true">→</span>
                    </button>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </>
      ) : (
        <div className="workspace-continuity-empty">
          <p>{text(t, "workspace_continuity.empty", "Hetkel ei ole pooleliolevaid tegevusi.")}</p>
          <small>{text(t, "workspace_continuity.empty_hint", "Kõik on praegu järjel.")}</small>
        </div>
      )}

      <div className="workspace-continuity-links">
        <button type="button" onClick={onOpenSharings}>
          <span>{text(t, "workspace_continuity.my_sharings", "Minu jagamised")}</span>
          <small>{text(t, "workspace_continuity.my_sharings_hint", "Vaata aktiivseid jagamisi ja nende kehtivust")}</small>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {preference ? (
        <details className="workspace-continuity-preferences">
          <summary>{text(t, "workspace_continuity.notification_settings", "Teavituste seaded")}</summary>
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
          {preference.status === "error" ? (
            <p role="alert">{text(t, "workspace_continuity.preference_error", "Seadet ei saanud salvestada.")}</p>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}
