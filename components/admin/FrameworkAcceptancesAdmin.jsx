"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import CardTitle from "@/components/ui/CardTitle";
import Panel from "@/components/ui/Panel";
import DocumentsDropdown from "@/components/documents/DocumentsDropdown";
import { useI18n } from "@/components/i18n/I18nProvider";
import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

const DAY_OPTIONS = [30, 90, 365, 3650];

function toLocaleTag(locale) {
  const normalized = String(locale || "en").toLowerCase();
  if (normalized.startsWith("et")) return "et-EE";
  if (normalized.startsWith("ru")) return "ru-RU";
  return "en-US";
}

function formatCount(value, localeTag) {
  try {
    return new Intl.NumberFormat(localeTag).format(Number(value || 0));
  } catch {
    return String(Number(value || 0));
  }
}

function formatDate(value, localeTag) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat(localeTag, {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function MobileField({ label, value }) {
  return (
    <div>
      <div>{label}</div>
      <div>{value || "-"}</div>
    </div>
  );
}

export default function FrameworkAcceptancesAdmin() {
  const { locale, t } = useI18n();
  const localeTag = useMemo(() => toLocaleTag(locale), [locale]);
  const dayOptions = useMemo(
    () =>
      DAY_OPTIONS.map(value => ({
        value: String(value),
        label:
          value === 3650
            ? t("admin.framework_acceptances.period_all", "All available")
            : t("admin.framework_acceptances.period_days", "{days} days").replace("{days}", String(value))
      })),
    [t]
  );
  const [query, setQuery] = useState("");
  const [days, setDays] = useState(365);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [signedDownloads, setSignedDownloads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchItems = useCallback(
    async (signal, searchValue = query, dayValue = days) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          locale,
          limit: "100",
          days: String(dayValue)
        });
        if (String(searchValue || "").trim()) params.set("q", String(searchValue).trim());
        const res = await fetch(`/api/admin/framework-acceptances?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          headers: {
            "x-ui-locale": locale
          },
          signal
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          throw new Error(resolveApiMessage(data, t, "admin.framework_acceptances.load_failed"));
        }
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.total || 0));
        setSignedDownloads(Number(data?.signedDownloads || 0));
      } catch (err) {
        if (err?.name === "AbortError") return;
        setError(String(err?.message || t("admin.framework_acceptances.load_failed", "Failed to load framework acceptances.")));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [days, locale, query, t]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchItems(controller.signal, query, days);
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [days, fetchItems, query]);

  const shownSignedDownloads = useMemo(
    () => items.filter(item => item?.signedDocumentDownloadedAt).length,
    [items]
  );

  return (
    <div>
      <Panel as="section" variant="secondary" padding="sm">
        <div>
          <div>
            <CardTitle as="h2">
              {t("admin.framework_acceptances.title", "Framework acceptances")}
            </CardTitle>
            <p>
              {t(
                "admin.framework_acceptances.subtitle",
                "Admin audit view for worker-use framework confirmations created during registration."
              )}
            </p>
          </div>

          <div>
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t(
                "admin.framework_acceptances.search_placeholder",
                "Search by email, user ID, version or framework key"
              )}
            />
            <DocumentsDropdown
              ariaLabel={t("admin.framework_acceptances.period", "Period")}
              value={String(days)}
              onChange={nextValue => setDays(Number(nextValue) || 365)}
              options={dayOptions}
            />
            <Button
              type="button"
              onClick={() => fetchItems(undefined, query, days)}
            >
              {loading
                ? t("admin.framework_acceptances.refreshing", "Refreshing...")
                : t("buttons.refresh", "Refresh")}
            </Button>
          </div>

          {error ? <div>{error}</div> : null}

          <div>
            <div>
              <div>{t("admin.framework_acceptances.stats.total", "Total matches")}</div>
              <div>{formatCount(total, localeTag)}</div>
              <div>
                {t("admin.framework_acceptances.stats.period", "Within selected period")}
              </div>
            </div>
            <div>
              <div>{t("admin.framework_acceptances.stats.shown", "Shown in list")}</div>
              <div>{formatCount(items.length, localeTag)}</div>
              <div>
                {t("admin.framework_acceptances.stats.current_page", "Current query result")}
              </div>
            </div>
            <div>
              <div>
                {t("admin.framework_acceptances.stats.signed_downloads", "Framework agreement download recorded")}
              </div>
              <div>{formatCount(signedDownloads, localeTag)}</div>
              <div>
                {t("admin.framework_acceptances.stats.shown_signed", "Shown now: {count}")
                  .replace("{count}", formatCount(shownSignedDownloads, localeTag))}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel as="section" variant="secondary" padding="sm">
        <div>
          <div>
            <CardTitle as="h2">
              {t("admin.framework_acceptances.table_title", "Acceptance records")}
            </CardTitle>
            <div>
              {loading
                ? t("admin.common.loading_data", "Loading...")
                : t("admin.framework_acceptances.results_count", "{count} records").replace(
                    "{count}",
                    formatCount(items.length, localeTag)
                  )}
            </div>
          </div>

          <div className="max-[1180px]:hidden">
            <div>
              <table>
                <thead>
                  <tr>
                    <th>{t("admin.framework_acceptances.columns.time", "Time")}</th>
                    <th>{t("admin.framework_acceptances.columns.user", "User")}</th>
                    <th>{t("admin.framework_acceptances.columns.role", "Role")}</th>
                    <th>{t("admin.framework_acceptances.columns.framework", "Framework")}</th>
                    <th>{t("admin.framework_acceptances.columns.downloads", "Open / signed")}</th>
                    <th>{t("admin.framework_acceptances.columns.document", "Document record")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6}>
                        {t("admin.common.loading_data", "Loading...")}
                      </td>
                    </tr>
                  ) : items.length ? (
                    items.map(item => (
                      <tr key={item.id}>
                        <td>
                          <div>{formatDate(item.acceptedAt, localeTag)}</div>
                          <div>{item.id}</div>
                        </td>
                        <td>
                          <div>{item.userEmail || "-"}</div>
                          <div>{item.userId}</div>
                        </td>
                        <td>{item.roleAtAcceptance || "-"}</td>
                        <td>
                          <div>
                            <span>{item.frameworkKey}</span>
                            <span>{item.frameworkVersion}</span>
                          </div>
                          <div>
                            {item.acceptanceType} / {item.acceptanceSource}
                          </div>
                        </td>
                        <td>
                          <div>
                            {t("admin.framework_acceptances.columns.opened", "Opened")}:{" "}
                            {formatDate(item.reviewDocumentOpenedAt, localeTag)}
                          </div>
                          <div>
                            {t("admin.framework_acceptances.columns.signed", "Framework agreement download")}:{" "}
                            {formatDate(item.signedDocumentDownloadedAt, localeTag)}
                          </div>
                        </td>
                        <td>
                          <div>{item.document?.title || "-"}</div>
                          <div>{item.document?.id || "-"}</div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        {t("admin.framework_acceptances.empty", "No framework acceptances found.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="hidden max-[1180px]:grid">
            {loading ? (
              <div>{t("admin.common.loading_data", "Loading...")}</div>
            ) : items.length ? (
              items.map(item => (
                <article key={item.id}>
                  <div>
                    <div>{item.userEmail || item.userId}</div>
                    <div>
                      {formatDate(item.acceptedAt, localeTag)}
                    </div>
                  </div>
                  <div>
                    <MobileField
                      label={t("admin.framework_acceptances.columns.role", "Role")}
                      value={item.roleAtAcceptance || "-"}
                    />
                    <MobileField
                      label={t("admin.framework_acceptances.columns.framework", "Framework")}
                      value={`${item.frameworkKey} / ${item.frameworkVersion}`}
                    />
                    <MobileField
                      label={t("admin.framework_acceptances.columns.opened", "Opened")}
                      value={formatDate(item.reviewDocumentOpenedAt, localeTag)}
                    />
                    <MobileField
                      label={t("admin.framework_acceptances.columns.signed", "Framework agreement download")}
                      value={formatDate(item.signedDocumentDownloadedAt, localeTag)}
                    />
                    <MobileField
                      label={t("admin.framework_acceptances.columns.document", "Document record")}
                      value={item.document?.title || "-"}
                    />
                    <MobileField
                      label={t("admin.framework_acceptances.columns.id", "Acceptance ID")}
                      value={item.id}
                    />
                  </div>
                </article>
              ))
            ) : (
              <div>{t("admin.framework_acceptances.empty", "No framework acceptances found.")}</div>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
