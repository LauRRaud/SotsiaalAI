"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgPart from "@/components/org/OrgPart";

import { HomeDeskView } from "./desk/DeskViews";
import { deskGroups, deskViewer, landingView, viewName } from "./desk/homeCareDesk";
import HomeCareCallNote from "./HomeCareCallNote";
import HomeCareClientForm from "./HomeCareClientForm";
import { keyName, keyWhere } from "./HomeCareKeys";
import { rideText } from "./HomeCareTransport";
import { euroText } from "./HomeCareMoney";
import HomeCareObstacle from "./HomeCareObstacle";
import { minutesLabel } from "./HomeCareDecisionView";
import HomeCareOutbox from "./HomeCareOutbox";
import HomeCareOwnName from "./HomeCareOwnName";
import HomeCareReferrals from "./HomeCareReferrals";
import { planDayLabel } from "./HomeCarePlanView";
import { clientHref, homeCareBase, useHomeCareApi } from "./homeCareClient";

/** Üks käik hooldaja päevas: kellaaeg, klient ja selle päeva erandid (K3-b). */
function MyVisit({ organizationId, visit }) {
  const { t } = useI18n();
  return (
    <li>
      <Link className="hc-client" href={clientHref(organizationId, visit.client.id)} prefetch={false}>
        <span className="hc-client__name">
          {visit.startTime} {visit.client.displayName}
          {visit.done ? (
            <>
              {" "}
              <span className="hc-badge">{t("home_care.slots.done_badge")}</span>
            </>
          ) : null}
          {visit.state === "CANCELLED" ? (
            <>
              {" "}
              <span className="hc-badge hc-badge--warn">{t("home_care.day.states.CANCELLED")}</span>
            </>
          ) : null}
          {visit.covering ? (
            <>
              {" "}
              <span className="hc-badge">{t("home_care.day.covering")}</span>
            </>
          ) : null}
          {visit.change?.timeChanged ? (
            <>
              {" "}
              <span className="hc-badge">{t("home_care.day.changed_time")}</span>
            </>
          ) : null}
        </span>
        <span className="hc-client__meta">
          {[
            minutesLabel(t, visit.plannedMinutes),
            visit.client.address,
            visit.note,
            visit.state === "CANCELLED" && visit.change?.reason ? t(`home_care.day.cancel_reasons.${visit.change.reason}`) : null,
            visit.change?.note,
            /* Võti (K4-b): kui selle kliendi võti ei ole minu käes, siis kelle käes see on. */
            visit.key && !visit.key.held && visit.state !== "CANCELLED" ? keyWhere(t, visit.key) : null,
            /* Sõit (K5-w): kliendil on sel päeval korraldatud sõit, pane ta valmis. */
            visit.ride ? rideText(t, visit.ride) : null
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </Link>
      {/* Kojutulek (K6-f): esimene käik pärast äraolekut. */}
      {visit.homecoming ? <p className="hc-notice">{t("home_care.homecoming.my_line", { date: planDayLabel(visit.homecoming.returnedOn) })}</p> : null}
      {/* Esmakäik (K5-v): klient ei tunne mind; kas talle on teatatud. */}
      {visit.firstVisit ? (
        <p className="hc-notice">
          {t("home_care.first_visit.my_line")}{" "}
          {visit.firstVisit.outcome ? t(`home_care.first_visit.my_outcomes.${visit.firstVisit.outcome}`) : t("home_care.first_visit.my_not_marked")}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Koduteenuse avaleht: LAUD ja avalehe enda vaated.
 *
 * KUJU (11.10, kavandi variant A). Leht oli üks pikk keritav leht, mille
 * keskel seisis 16 lingiga nupurida. Nüüd on koduteenus laud nagu
 * organisatsioon: plaadid kõigi lehtedega, mida inimene näeb. Plaat avab
 * alalehe marsruudi; avalehe enda sisu (tänane päev, kliendid, uus klient,
 * „Kuhu suunata", oma nimi) on laua vaated, mille andmed tulevad avalehe
 * laadimisega kaasa. Kiirmenüü nelja ruuduga nupp viib vaatest lauale ja
 * laualt organisatsiooni lauale (kest `components/org/OrgPart.jsx`).
 *
 * HOOLDAJAL AVANEB „TÄNA", hooldusjuhil laud (`landingView`): hooldaja avab
 * lehe ukse taga ja tänased käigud peavad olema esimese asjana ees.
 *
 * VAADETE SISU on veel vanal `hc-*` kihil: see ühik viis liikumise kiirmenüüsse,
 * vaated ise tehakse väikesteks järgmises ühikus.
 *
 * LINGID KLIENDI LEHELE ON `prefetch={false}`. Kliendi lehe avamine jätab
 * avamislogisse rea; ette laadimine kirjutaks sinna avamisi, mida inimene ei
 * teinud.
 *
 * OTSING näitab ainult nime ja seisu. Meeskonnast väljas oleva kliendi leht
 * küsib avamisel põhjust (asendaja tee).
 *
 * Laua reeglid on failis ./desk/homeCareDesk.js, laua vaade failis ./desk/DeskViews.jsx.
 */
export default function HomeCareHome({ context, initial, unitOptions, myDay = null, referrals = null, setupHint = null, ownName = null }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const organizationId = context.organization.id;
  const timeZone = context.organization.timezone || "Europe/Tallinn";
  const list = useHomeCareApi();
  const search = useHomeCareApi();
  const searchId = useId();
  const rootRef = useRef(null);

  const isCoordinator = Boolean(initial?.isCoordinator);
  const canSearch = Boolean(initial?.canSearch);
  const [clients, setClients] = useState(initial?.clients || []);
  const [showEnded, setShowEnded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);

  const who = useMemo(() => deskViewer({ context, initial, myDay, referrals, ownName }), [context, initial, myDay, referrals, ownName]);
  const groups = useMemo(() => deskGroups(who, { t, organizationId }), [organizationId, t, who]);
  /* Avatud vaade; tühi sõne on laud. */
  const [view, setView] = useState(() => landingView(who));

  /* Nimi sai kirja (leht luges andmed uuesti): nime vormilt edasi sinna, kuhu koduteenus muidu avaneb. */
  const hadNoName = useRef(who.needsName);
  useEffect(() => {
    if (hadNoName.current && !who.needsName) setView((current) => (current === "name" ? landingView(who) : current));
    hadNoName.current = who.needsName;
  }, [who]);

  /* Vaate vahetusel kaob vajutatud plaat: paneel algab ülalt ja fookus läheb
     vaate pealkirjale. Esimesel joonistusel fookust ei võeta. */
  const shown = useRef(null);
  useEffect(() => {
    const first = shown.current === null;
    const moved = shown.current !== view;
    shown.current = view;
    if (first || !moved) return;
    rootRef.current?.closest(".panel-body")?.scrollTo({ top: 0 });
    rootRef.current?.querySelector("[data-step-heading]")?.focus({ preventScroll: true });
  }, [view]);

  /* Tavaline vajutus avab alalehe lehe sees; uue vahekaardi vajutus jääb brauserile. */
  const openTile = useCallback(
    (event, tile) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      router.push(tile.href);
    },
    [router]
  );

  const loadClients = async (ended) => {
    const url = `${homeCareBase(organizationId)}/kliendid${ended ? "?status=ENDED" : ""}`;
    const result = await list.call(url, { fallbackKey: "home_care.errors.list_failed" });
    if (result.ok) {
      setClients(result.data.clients || []);
      setShowEnded(ended);
    }
  };

  const runSearch = async (event) => {
    event.preventDefault();
    const result = await search.call(`${homeCareBase(organizationId)}/kliendid/otsing`, {
      method: "POST",
      body: { q: query },
      fallbackKey: "home_care.errors.search_failed"
    });
    setResults(result.ok ? result.data.clients || [] : null);
  };

  /* Seadmes ootavad kirjed: laual ja vaates „Täna", sest sinna koduteenus avaneb. */
  const outbox = <HomeCareOutbox ownerId={context.membership?.id || ""} timeZone={timeZone} />;

  /* Avalehe vaade vanal kihil: kest ütleb nime kiirmenüüs, nelja ruuduga nupp viib lauale. */
  const inView = (body) => {
    const label = viewName(view, who, { t });
    return (
      <div ref={rootRef}>
        <OrgPart context={context} part="home_care" partLabel={label} onDesk={() => setView("")}>
          <section className="hc-shell">
            <h2 className="sr-only" tabIndex={-1} data-step-heading>
              {label}
            </h2>
            {body}
          </section>
        </OrgPart>
      </div>
    );
  };

  if (view === "name") {
    /* Nimeta inimene: kolleegid näeksid tema kohal kriipsu, seepärast on vorm kohe ees. */
    return inView(<HomeCareOwnName organizationId={organizationId} initial={ownName} />);
  }

  if (view === "today") {
    return inView(
      <>
        {outbox}

        {/* Tänane päev (K3-a): sulle määratud tänased käigud kellaaja järjekorras. */}
        {myDay?.absent ? <p className="hc-notice">{t("home_care.absences.my_notice")}</p> : null}
        {myDay?.visits?.length ? (
          <div className="hc-section">
            <h3 className="hc-section-title">{t("home_care.slots.today_title")}</h3>
            <ul className="hc-list">
              {myDay.visits.map((visit) => (
                <MyVisit key={visit.slotId} organizationId={organizationId} visit={visit} />
              ))}
            </ul>
          </div>
        ) : null}

        {/* Minu käes olevad võtmed (K4-b): ripatsi number, kelle võti ja mille võti. */}
        {myDay?.keys?.length ? (
          <div className="hc-section">
            <h3 className="hc-section-title">{t("home_care.keys.mine_title")}</h3>
            <ul className="hc-list">
              {myDay.keys.map((key) => (
                <li key={key.id}>
                  <Link className="hc-client" href={clientHref(organizationId, key.client.id)} prefetch={false}>
                    <span className="hc-client__name">
                      {keyName(t, key)}
                      {key.clientEnded ? (
                        <>
                          {" "}
                          <span className="hc-badge hc-badge--warn">{t("home_care.keys.return_badge")}</span>
                        </>
                      ) : null}
                    </span>
                    <span className="hc-client__meta">{key.client.displayName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Minu käes olev kliendiraha (K4-c): jääk kliendi kaupa. */}
        {myDay?.money?.length ? (
          <div className="hc-section">
            <h3 className="hc-section-title">{t("home_care.money.mine_title")}</h3>
            <ul className="hc-list">
              {myDay.money.map((item) => (
                <li key={item.client.id}>
                  <Link className="hc-client" href={clientHref(organizationId, item.client.id)} prefetch={false}>
                    <span className="hc-client__name">{item.client.displayName}</span>
                    <span className="hc-client__meta">{euroText(item.balanceCents, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* „Mul on takistus" (K3-e): hooldaja teatab ise, kui tänane päev ei lähe plaani järgi. */}
        {myDay && !myDay.absent && (myDay.obstacle || myDay.visits?.some((visit) => !visit.done && visit.state !== "CANCELLED")) ? (
          <HomeCareObstacle organizationId={organizationId} timeZone={timeZone} initial={myDay.obstacle || null} canReport={Boolean(context.writable)} />
        ) : null}

        {/* Järgmised päevad (K3-d): siit näeb, mis teate „sinu käigud muutusid" taga on. */}
        {myDay?.next?.length ? (
          <div className="hc-section">
            <h3 className="hc-section-title">{t("home_care.slots.next_title")}</h3>
            {myDay.next.map((item) => (
              <div key={item.day}>
                <p className="hc-sub">
                  {t(`home_care.slots.weekdays_long.${item.weekday}`)} {planDayLabel(item.day)}
                  {item.absent ? ` · ${t("home_care.slots.next_absent")}` : ""}
                </p>
                {item.visits.length ? (
                  <ul className="hc-list">
                    {item.visits.map((visit) => (
                      <MyVisit key={visit.slotId} organizationId={organizationId} visit={visit} />
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </>
    );
  }

  if (view === "refer") {
    /* „Kuhu suunata" (K5-c): asutuse loend kohtadest, kuhu inimene suunata, kui küsimus ei ole hooldaja töö. */
    return inView(
      <HomeCareReferrals organizationId={organizationId} initial={referrals?.referrals || []} canEdit={Boolean(context.writable && referrals?.canEditReferrals)} />
    );
  }

  if (view === "add") {
    return inView(
      <div className="hc-section">
        <h3 className="hc-section-title">{t("home_care.client.create_title")}</h3>
        <HomeCareClientForm
          organizationId={organizationId}
          unitOptions={unitOptions}
          onCancel={() => setView("clients")}
          onSaved={(client) => router.push(clientHref(organizationId, client.id))}
        />
      </div>
    );
  }

  if (view === "clients") {
    return inView(
      <>
        {canSearch ? (
          <div className="hc-section">
            <form className="hc-form" onSubmit={runSearch} role="search">
              <div className="hc-field">
                <label className="hc-label" htmlFor={searchId}>
                  {t("home_care.home.search_label")}
                </label>
                <div className="hc-row hc-row--search">
                  <input
                    id={searchId}
                    className="hc-input"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    minLength={2}
                    maxLength={80}
                    autoComplete="off"
                    enterKeyHint="search"
                  />
                  <button className="hc-btn" type="submit" disabled={search.busy || query.trim().length < 2}>
                    {t("home_care.home.search_button")}
                  </button>
                </div>
              </div>
            </form>
            <p className="hc-hint">{t("home_care.home.search_hint")}</p>
            {isCoordinator ? <p className="hc-hint">{t("home_care.home.search_phone_hint")}</p> : null}
            {search.error ? (
              <p className="hc-error" role="alert">
                {search.error}
              </p>
            ) : null}
            {results ? (
              results.length === 0 ? (
                <p className="hc-sub" role="status">
                  {t("home_care.home.search_empty")}
                </p>
              ) : (
                <ul className="hc-list" aria-live="polite">
                  {results.map((client) => (
                    <li key={client.id}>
                      <Link className="hc-client" href={clientHref(organizationId, client.id)} prefetch={false}>
                        <span className="hc-client__name">{client.displayName}</span>
                        <span className="hc-client__meta">
                          {client.status !== "ACTIVE" ? `${t(`home_care.status.${client.status}`)} · ` : ""}
                          {client.matchedRelative
                            ? `${t("home_care.home.matched_relative", {
                                name: client.matchedRelative.relation ? `${client.matchedRelative.name} (${client.matchedRelative.relation})` : client.matchedRelative.name,
                                level: t(`home_care.relatives.levels.${client.matchedRelative.level}`)
                              })}${client.matchedRelative.doubt ? ` · ${t("home_care.home.matched_relative_doubt")}` : ""}`
                            : client.matchedPhone
                              ? t("home_care.home.matched_phone")
                              : client.needsReason
                                ? t("home_care.home.needs_reason")
                                : t("home_care.client.basis.TEAM")}
                        </span>
                      </Link>
                      {/* Kõne märkimine otse tulemusest (K5-o): helistaja järgi leitud kliendil alati, nime
                          järgi leitud kliendil siis, kui tulemusi on vähe. Ainult kliendil, kelle päevikusse
                          vastaja tohib kirjutada. */}
                      {!client.needsReason && (client.matchedRelative || client.matchedPhone || results.length <= 3) ? (
                        <HomeCareCallNote
                          organizationId={organizationId}
                          clientId={client.id}
                          clientName={client.displayName}
                          viewerMembershipId={context.membership?.id || null}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        ) : null}

        <div className="hc-section">
          <div className="hc-row hc-row--between">
            <h3 className="hc-section-title">
              {isCoordinator ? t("home_care.home.all_clients") : t("home_care.home.my_clients")}
              {showEnded ? ` · ${t("home_care.status.ENDED")}` : ""}
            </h3>
            {isCoordinator ? (
              <button className="hc-btn hc-btn--quiet" type="button" onClick={() => loadClients(!showEnded)} disabled={list.busy}>
                {showEnded ? t("home_care.home.show_active") : t("home_care.home.show_ended")}
              </button>
            ) : null}
          </div>
          {list.error ? (
            <p className="hc-error" role="alert">
              {list.error}
            </p>
          ) : null}
          {clients.length === 0 ? (
            <p className="hc-sub">{showEnded ? t("home_care.home.empty_ended") : isCoordinator ? t("home_care.home.empty_coordinator") : t("home_care.home.empty_worker")}</p>
          ) : (
            <ul className="hc-list">
              {clients.map((client) => (
                <li key={client.id}>
                  <Link className="hc-client" href={clientHref(organizationId, client.id)} prefetch={false}>
                    <span className="hc-client__name">
                      {client.displayName}
                      {client.status === "AWAY" ? (
                        <>
                          {" "}
                          <span className="hc-badge hc-badge--warn">{t("home_care.status.AWAY")}</span>
                        </>
                      ) : null}
                      {client.waiting ? (
                        <>
                          {" "}
                          <span className="hc-badge hc-badge--warn">{t("home_care.precondition.badge")}</span>
                        </>
                      ) : null}
                    </span>
                    {client.address || client.statusNote || client.statusReason ? (
                      <span className="hc-client__meta">
                        {[
                          client.address,
                          client.status !== "ACTIVE" && client.statusReason ? t(`home_care.status_reason.${client.status}.${client.statusReason}`) : null,
                          client.status !== "ACTIVE" ? client.statusNote : null
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Uus klient ja klientide toomine tabelist: hooldusjuhile, kui asutus on kirjutatav. */}
        {isCoordinator && context.writable ? (
          <div className="hc-row">
            <Link className="hc-btn hc-btn--link" href={`/org/${organizationId}/koduteenus/sissetoomine`}>
              {t("home_care.import.link")}
            </Link>
            <button className="hc-btn hc-btn--primary" type="button" onClick={() => setView("add")}>
              {t("home_care.home.add_client")}
            </button>
          </div>
        ) : null}

        {/* Nimi on kirjas: vaikne rida vaate lõpus ja tee selle muutmiseks. */}
        {ownName?.complete ? <HomeCareOwnName organizationId={organizationId} initial={ownName} /> : null}
      </>
    );
  }

  return (
    <div ref={rootRef}>
      <OrgPart context={context} part="home_care">
        <HomeDeskView t={t} groups={groups} onOpen={openTile} onView={setView}>
          {/* Laua kohal on ainult see, mis ei või jääda märkamata: seadmes ootavad
              kirjed ja teade, et hooldusjuhti ei ole. */}
          {outbox}
          {/* Hooldusjuhti ei ole üldse: ilma temata ei saa keegi kliente lisada. Omanik saab
              õiguse ise anda, seepärast on tal link lehele „Liikmed". */}
          {setupHint ? (
            <p className="hc-notice">
              {t(`home_care.home.no_coordinator.${setupHint.viewer}`)}
              {setupHint.viewer === "OWNER" ? (
                <>
                  {" "}
                  <Link href={`/org/${organizationId}/liikmed`}>{t("home_care.home.no_coordinator.members_link")}</Link>
                </>
              ) : null}
            </p>
          ) : null}
        </HomeDeskView>
      </OrgPart>
    </div>
  );
}
