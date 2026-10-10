"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import StepPanel from "@/components/stage/StepPanel";
import Button from "@/components/ui/Button";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import { localizePath } from "@/lib/localizePath";
import { loginHref } from "@/lib/safeNextPath";

import { IDLE_VIEW, createSearchSession, resultKey } from "./searchState";
import styles from "./search.module.css";

function formatDate(value, locale) {
  try { return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)); } catch { return ""; }
}

/* Fookust tohib koodist viia ainult siis, kui see on veel vajutatud nupul või on
   lehelt maha kukkunud (nupp kadus või läks ootamise ajaks kinni). Kes läks
   vahepeal väljale kirjutama, jääb sinna. */
function focusIsFree(pressed) {
  const active = document.activeElement;
  return !active || active === document.body || active === pressed;
}

export default function PersonalSearchPage() {
  const { t, locale } = useI18n();
  /* Kataloog annab puuduva sõna asemel võtme enda: tundmatu liik või seis jääb
     siis näitamata, mitte ei jõua võtmena ekraanile. */
  const word = (key) => {
    const text = t(key);
    return text === key ? "" : text;
  };
  const [query, setQuery] = useState("");
  /* Otsingu käik (mida küsitakse, mis jääb ekraanile) on failis searchState.js:
     leht joonistab selle vaate. Väli on ainult väli: „Näita rohkem” ei loe seda. */
  const [view, setView] = useState(IDLE_VIEW);
  const [session] = useState(() => createSearchSession({ onChange: setView }));
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const moreActionRef = useRef(null);
  const { state, results, hasMore, unavailableKinds, loadingMore, fault, moreFault, announce, appended } = view;

  useEffect(() => () => session.dispose(), [session]);

  /* Viimase lehe järel kaob vajutatud nupp ja fookus kukuks lehelt maha. Pärast
     igat juurde laadimist läheb fookus esimesele uuele reale (või loendile, kui
     uusi ridu ei tulnud): sealt loeb inimene edasi. */
  useEffect(() => {
    const list = listRef.current;
    if (!appended || !list || !focusIsFree(moreActionRef.current)) return;
    const row = appended.firstNewIndex >= 0 ? list.children[appended.firstNewIndex]?.querySelector("a") : null;
    (row || list).focus();
  }, [appended]);

  /* Juurde laadimine ebaõnnestus: tegevus (sama nupp või sisselogimise viide, mis
     tuleb nupu asemele) hoiab fookust, kui see vahepeal lehelt maha kukkus. */
  useEffect(() => {
    if (moreFault && focusIsFree(moreActionRef.current) && document.activeElement !== moreActionRef.current) {
      moreActionRef.current?.focus();
    }
  }, [moreFault]);

  /* Ootamise ajal ei ole nupud päriselt kinni: kinni nupp kaotab mõnes brauseris
     fookuse. Nupp on märgitud hõivatuks ja teist päringut ei saadeta. */
  const onSubmit = (event) => {
    event.preventDefault();
    if (state === "loading") return;
    session.search(query);
  };
  const retry = () => {
    /* Vajutatud nupp kaob koos teatega: fookus läheb väljale. */
    inputRef.current?.focus();
    session.retry();
  };

  const kindWords = (kinds) => kinds.map((kind) => word(`personal_search.kinds.${kind}`)).filter(Boolean).join(", ");
  const faultSentence = (item, more = false) => {
    if (item.kind === "session") return t("api.common.unauthorized");
    if (item.kind === "rate") {
      return item.seconds ? t("personal_search.rate_limited_wait", { seconds: item.seconds }) : t("personal_search.rate_limited");
    }
    return more ? t("personal_search.more_error") : t("personal_search.error");
  };
  const signInHref = localizePath(loginHref("/otsi"), locale);

  /* Seisu rida on alati lehel (ekraanilugeja kuuleb ainult rida, mis oli enne
     olemas). Silmale näidatakse otsimist ja tühja vastust; vastete arv on ainult
     ekraanilugejale, sest silm näeb loendit. */
  let status = "";
  let statusVisible = false;
  if (state === "loading") {
    status = t("personal_search.loading");
    statusVisible = true;
  } else if (state === "empty") {
    status = t("personal_search.empty");
    statusVisible = true;
  } else if (state === "results" && announce) {
    status = announce.append
      ? `${t("personal_search.added", { added: announce.added, count: announce.total })} ${announce.hasMore ? t("personal_search.more_available") : t("personal_search.no_more")}`
      : `${t("personal_search.found", { count: announce.total })}${announce.hasMore ? ` ${t("personal_search.more_available")}` : ""}`;
  }

  /* Lehe nimi on all kiirmenüüs: paneel algab sellega, mida siit otsida saab.
     Leht on lame (üks väli ja selle tulemused), sammulava siin ei ole. */
  return (
    <section className={styles.page} lang={locale}>
      <h1 className="sr-only">{t("personal_search.title")}</h1>
      <StepPanel title={t("personal_search.title")} question={t("personal_search.intro")} lead={t("personal_search.scope")}>
        <div className={styles.stack}>
          <Form role="search" className={styles.search} onSubmit={onSubmit}>
            <div className={styles.field}>
              <Input
                ref={inputRef}
                id="personal-search-query"
                aria-label={t("personal_search.label")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={120}
                autoComplete="off"
              />
            </div>
            <Button type="submit" size="sm" variant="primary" aria-busy={state === "loading" || undefined}>
              {t("personal_search.submit")}
            </Button>
          </Form>
          <p className={statusVisible ? styles.status : "sr-only"} aria-live="polite" aria-atomic="true">
            {status}
          </p>
          {state === "error" && fault ? (
            <div className={styles.fault}>
              <p className={styles.faultText} role="alert">
                {faultSentence(fault)}
              </p>
              {fault.kind === "session" ? (
                <Button as="a" href={signInHref} size="sm" variant="secondary">
                  {t("personal_search.sign_in")}
                </Button>
              ) : (
                <Button type="button" size="sm" variant="secondary" onClick={retry}>
                  {t("personal_search.retry")}
                </Button>
              )}
            </div>
          ) : null}
          {state === "partial-empty" ? (
            /* Ridu ei ole, aga mõni allikas jäi lugemata: „vasteid ei leitud” ei oleks tõsi. */
            <div className={styles.fault}>
              <p className={styles.faultText} role="alert">
                {t("personal_search.partial_empty", { kinds: kindWords(unavailableKinds) })}
              </p>
              <Button type="button" size="sm" variant="secondary" onClick={retry}>
                {t("personal_search.retry")}
              </Button>
            </div>
          ) : null}
          {state === "results" && unavailableKinds.length ? (
            <p className={styles.faultText} role="alert">
              {t("personal_search.partial", { kinds: kindWords(unavailableKinds) })}
            </p>
          ) : null}
          {state === "results" ? (
            <>
              <ol ref={listRef} tabIndex={-1} className={styles.rows} aria-label={t("personal_search.results")}>
                {results.map((item) => {
                  const kind = word(`personal_search.kinds.${item.kind}`);
                  const itemStatus = item.status ? word(`personal_search.status.${String(item.status).toLowerCase()}`) : "";
                  return (
                    <li className={styles.rowItem} key={resultKey(item)}>
                      <a className={styles.row} href={localizePath(item.href, locale)}>
                        {/* Pealkiri on TEKST: sisu tuleb React'i lapsena, mitte HTML-ina. */}
                        <span className={styles.rowTitle}>
                          {item.title || item.excerpt || word(`personal_search.untitled.${item.kind}`) || kind}
                          {/* Pealkirjaga vestlus, mille otsisõna on sõnumis: lõik näitab, kus. */}
                          {item.title && item.excerpt ? <span className={styles.excerpt}>{item.excerpt}</span> : null}
                        </span>
                        <span className={styles.rowMeta}>
                          <span className={styles.kind}>{[kind, itemStatus].filter(Boolean).join(" · ")}</span>
                          <time className={styles.time} dateTime={item.updatedAt || undefined}>
                            {formatDate(item.updatedAt, locale)}
                          </time>
                        </span>
                        <span className={styles.open} aria-hidden="true">
                          ›
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
              {hasMore || moreFault ? (
                /* Sama nupp jääb ka vea korral paigale (silt muutub): fookus ei kao ja uus
                   vajutus küsib sama lehte. */
                <div className={moreFault ? styles.fault : styles.more}>
                  {moreFault ? (
                    <p className={styles.faultText} role="alert">
                      {faultSentence(moreFault, true)}
                    </p>
                  ) : null}
                  {moreFault?.kind === "session" ? (
                    <Button ref={moreActionRef} as="a" href={signInHref} size="sm" variant="secondary">
                      {t("personal_search.sign_in")}
                    </Button>
                  ) : (
                    <Button ref={moreActionRef} type="button" size="sm" variant="secondary" aria-busy={loadingMore || undefined} onClick={session.loadMore}>
                      {loadingMore ? t("personal_search.loading_more") : moreFault ? t("personal_search.retry") : t("personal_search.load_more")}
                    </Button>
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </StepPanel>
    </section>
  );
}
