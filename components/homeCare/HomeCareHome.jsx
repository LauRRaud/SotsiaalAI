"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrgPart from "@/components/org/OrgPart";
import { CARE_OBSTACLE_KINDS } from "@/lib/homeCare/constants";

import { AllVisitsView, MineView, NextDaysView, ObstacleView, TodayView } from "./day/DayViews";
import { allLine, obstacleButtonKey, showObstacle, splitToday, visitChips, visitLine, visitNotes } from "./day/myDay";
import { HomeDeskView } from "./desk/DeskViews";
import { deskGroups, deskViewer, landingView, viewName } from "./desk/homeCareDesk";
import HomeCareCallNote from "./HomeCareCallNote";
import HomeCareClientForm from "./HomeCareClientForm";
import { keyName, keyWhere } from "./HomeCareKeys";
import { rideText } from "./HomeCareTransport";
import { euroText } from "./HomeCareMoney";
import { useHomeCareObstacle } from "./HomeCareObstacle";
import { minutesLabel } from "./HomeCareDecisionView";
import HomeCareOutbox from "./HomeCareOutbox";
import HomeCareOwnName from "./HomeCareOwnName";
import HomeCareReferrals from "./HomeCareReferrals";
import { planDayLabel } from "./HomeCarePlanView";
import { clientHref, formatTime, homeCareBase, useHomeCareApi } from "./homeCareClient";

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
 * HOOLDAJA PÄEV („Täna", kõik tänased käigud, „Minu käes", takistuse teade,
 * järgmised päevad) on väikesed vaated (./day/). Kliendid, uus klient, „Kuhu
 * suunata" ja oma nimi on veel vanal `hc-*` kihil.
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

  /* Takistuse teade (K3-e): olek ja päringud; vaated on failis ./day/DayViews.jsx. */
  const obstacleState = useHomeCareObstacle({ organizationId, initial: myDay?.obstacle || null });

  /* Käigu rida vaadete jaoks: sõnad reeglitest (./day/myDay.js), vormindajad siit. */
  const visitRow = (visit) => ({
    key: visit.slotId,
    href: clientHref(organizationId, visit.client.id),
    title: `${visit.startTime} ${visit.client.displayName}`,
    line: visitLine(visit, { t, minutes: (value) => minutesLabel(t, value), keyWhere: (place) => keyWhere(t, place), ride: (ride) => rideText(t, ride) }),
    notes: visitNotes(visit, { t, day: planDayLabel }),
    chips: visitChips(visit, { t })
  });

  /* Seadmes ootavad kirjed: laual ja vaates „Täna", sest sinna koduteenus avaneb. */
  const outbox = <HomeCareOutbox ownerId={context.membership?.id || ""} timeZone={timeZone} />;

  /* Avalehe vaade: kest ütleb nime kiirmenüüs, nelja ruuduga nupp viib lauale. */
  const inPart = (body) => (
    <div ref={rootRef}>
      <OrgPart context={context} part="home_care" partLabel={viewName(view, who, { t })} onDesk={() => setView("")}>
        {body}
      </OrgPart>
    </div>
  );
  /* Vaade, mille sisu on veel vanal kihil. */
  const inView = (body) =>
    inPart(
      <section className="hc-shell">
        <h2 className="sr-only" tabIndex={-1} data-step-heading>
          {viewName(view, who, { t })}
        </h2>
        {body}
      </section>
    );

  if (view === "name") {
    /* Nimeta inimene: kolleegid näeksid tema kohal kriipsu, seepärast on vorm kohe ees. */
    return inView(<HomeCareOwnName organizationId={organizationId} initial={ownName} />);
  }

  const visits = myDay?.visits || [];

  if (view === "today") {
    const split = splitToday(visits);
    const nextDays = myDay?.next || [];
    const keys = myDay?.keys || [];
    const money = myDay?.money || [];
    const sent = obstacleState.obstacle;
    return inPart(
      <TodayView
        t={t}
        day={{
          date: myDay?.weekday ? `${t(`home_care.slots.weekdays_long.${myDay.weekday}`)} ${planDayLabel(myDay.today)}` : t("home_care.slots.today_title"),
          count: visits.length ? t("home_care.today.count", { count: visits.length, done: split.done.length }) : ""
        }}
        absent={myDay?.absent ? t("home_care.absences.my_notice") : ""}
        rows={{
          first: split.first ? visitRow(split.first) : null,
          follow: split.follow.map(visitRow),
          /* Üks käik on niigi täies pikkuses ees: rida „Kõik tänased käigud" tuleb alates kahest. */
          all: visits.length > 1 ? { title: t("home_care.today.all_title"), line: allLine(split, { t }) } : null
        }}
        next={nextDays.length ? { title: t("home_care.slots.next_title") } : null}
        mine={
          keys.length || money.length
            ? {
                keys: keys.length ? { title: t("home_care.today.mine_keys", { count: keys.length }), line: keys.map((key) => keyName(t, key)).join(", ") } : null,
                money: money.length ? { title: t("home_care.today.mine_money"), line: euroText(money.reduce((sum, item) => sum + item.balanceCents, 0), locale) } : null
              }
            : null
        }
        obstacle={
          showObstacle({ ...myDay, obstacle: sent })
            ? {
                note: sent
                  ? `${t("home_care.obstacle.sent", { time: formatTime(sent.reportedAt, timeZone), kind: t(`home_care.obstacle.kinds.${sent.kind}`) })} ${t(sent.handled ? "home_care.obstacle.handled_hint" : "home_care.obstacle.sent_hint")}`
                  : "",
                attention: Boolean(sent && !sent.handled),
                error: obstacleState.error,
                button: t(obstacleButtonKey(sent)),
                canReport: Boolean(context.writable),
                canWithdraw: Boolean(context.writable && sent && !sent.handled),
                busy: obstacleState.busy
              }
            : null
        }
        onAll={() => setView("all")}
        onNext={() => setView("next")}
        onMine={() => setView("mine")}
        onObstacle={() => {
          obstacleState.start();
          setView("obstacle");
        }}
        onWithdraw={obstacleState.withdraw}
      >
        {outbox}
      </TodayView>
    );
  }

  if (view === "all") {
    return inPart(<AllVisitsView t={t} rows={visits.map(visitRow)} onBack={() => setView("today")} />);
  }

  if (view === "mine") {
    /* Minu käes olevad võtmed (K4-b) ja kliendiraha (K4-c): rida avab kliendi lehe. */
    return inPart(
      <MineView
        t={t}
        keys={(myDay?.keys || []).map((key) => ({
          id: key.id,
          href: clientHref(organizationId, key.client.id),
          name: keyName(t, key),
          client: key.client.displayName,
          badge: key.clientEnded ? t("home_care.keys.return_badge") : ""
        }))}
        money={(myDay?.money || []).map((item) => ({
          id: item.client.id,
          href: clientHref(organizationId, item.client.id),
          client: item.client.displayName,
          amount: euroText(item.balanceCents, locale)
        }))}
        onBack={() => setView("today")}
      />
    );
  }

  if (view === "obstacle") {
    /* „Mul on takistus" (K3-e): valik ja saatmine; vaade sulgub, kui teade läks teele. */
    return inPart(
      <ObstacleView
        t={t}
        options={CARE_OBSTACLE_KINDS.map((value) => ({ value, label: t(`home_care.obstacle.kinds.${value}`) }))}
        kind={obstacleState.kind}
        onKind={obstacleState.setKind}
        busy={obstacleState.busy}
        error={obstacleState.error}
        onSend={async () => {
          if (await obstacleState.report()) setView("today");
        }}
        onCancel={() => setView("today")}
      />
    );
  }

  if (view === "next") {
    /* Järgmised päevad (K3-d): siit näeb, mis teate „sinu käigud muutusid" taga on. */
    return inPart(
      <NextDaysView
        t={t}
        days={(myDay?.next || []).map((item) => ({
          key: item.day,
          title: `${t(`home_care.slots.weekdays_long.${item.weekday}`)} ${planDayLabel(item.day)}${item.absent ? ` · ${t("home_care.slots.next_absent")}` : ""}`,
          rows: item.visits.map(visitRow)
        }))}
      />
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
