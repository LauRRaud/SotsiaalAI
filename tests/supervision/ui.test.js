import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * SUP-P10 UI olekulepingud (Q2.6 + Q2.10). Testid käivad ANDMELEPINGU ja
 * PRIVAATSUSMÄRGISTE vastu, mitte visuaali vastu (repo muster: lähtekoodi
 * lepingutestid, vt tests/covision/completedCasesClientContract.test.js).
 * Visuaal ja brauserikäitumine jäävad NOT_PROVEN-iks kuni käsitsi-QA-ni.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const COMPONENTS = "components/supervision";
const home = read(`${COMPONENTS}/SupervisionHomePage.jsx`);
const create = read(`${COMPONENTS}/SupervisionCreatePage.jsx`);
const shell = read(`${COMPONENTS}/SupervisionProcessPage.jsx`);
const invited = read(`${COMPONENTS}/SupervisionInvitedCard.jsx`);
const contract = read(`${COMPONENTS}/ContractPanel.jsx`);
const eeskamber = read(`${COMPONENTS}/EeskamberPanel.jsx`);
const share = read(`${COMPONENTS}/SupervisionSharePage.jsx`);
const meetings = read(`${COMPONENTS}/MeetingsPanel.jsx`);
const summaries = read(`${COMPONENTS}/SummariesPanel.jsx`);
const kapp = read(`${COMPONENTS}/KappPanel.jsx`);
const closePage = read(`${COMPONENTS}/SupervisionClosePage.jsx`);
const outcome = read(`${COMPONENTS}/SupervisionOutcomePage.jsx`);
const client = read(`${COMPONENTS}/supervisionClient.js`);
const css = read(`${COMPONENTS}/SupervisionPage.module.css`);

test("Q2.6: kõik kümme vaadet on marsruudina olemas", () => {
  for (const route of [
    "app/supervisioon/page.jsx",
    "app/supervisioon/uus/page.jsx",
    "app/supervisioon/[id]/page.jsx",
    "app/supervisioon/[id]/jaga/page.jsx",
    "app/supervisioon/[id]/sulge/page.jsx",
    "app/supervisioon/valjundid/page.jsx",
    "app/supervisioon/valjundid/[outcomeId]/page.jsx"
  ]) {
    assert.ok(existsSync(join(root, route)), `${route} peab olema olemas`);
  }
});

test("navigeerimisleping: viis `?ala=` ankrut on püsivad ja kest kannab igaüht", () => {
  for (const area of ["kontrakt", "eeskamber", "kohtumised", "kokkuvotted", "kapp"]) {
    assert.match(client, new RegExp(`"${area}"`), `ankur ${area} peab olema lepingus`);
  }
  // Kest loeb ala URL-ist ja kirjutab selle URL-i tagasi (otselingitav olek).
  assert.match(shell, /useSearchParams\(\)/);
  assert.match(shell, /searchParams\.get\("ala"\)/);
  assert.match(shell, /params\.set\("ala", next\)/);
  assert.match(shell, /router\.push\(/);
  // Iga ala renderdab oma paneeli.
  for (const panel of ["ContractPanel", "EeskamberPanel", "MeetingsPanel", "SummariesPanel", "KappPanel"]) {
    assert.match(shell, new RegExp(`<${panel}`), `${panel} peab olema kestas seotud`);
  }
});

test("`?summary=` süvalink jõuab kokkuvõtete vaatesse (U2 jätkamise siht)", () => {
  assert.match(shell, /searchParams\.get\("summary"\)/);
  assert.match(shell, /selectedSummaryId=\{summaryId\}/);
  assert.match(summaries, /selectedSummaryId/);
  assert.match(summaries, /scrollIntoView/);
});

test("privaatsusmärgis on PÜSIELEMENT eeskambris, läves, kapis ja isiklikus pakis", () => {
  // Eeskamber: märgis nii ala kohal kui IGA kirje juures (M6 = omanik-only).
  assert.match(eeskamber, /<PrivacyBadge scope="private" \/>[\s\S]*<PrivacyBadge scope="private" \/>/);
  // Lävi: märgis ütleb, kes pärast jagamist näevad.
  assert.match(share, /scope=\{audience === "SUPERVISOR_ONLY" \? "supervisor" : "process"\}/);
  // Kapp ja isiklik pakk kannavad püsivuse/privaatsuse märgist.
  assert.match(kapp, /<PrivacyBadge scope="persistent" \/>/);
  assert.match(outcome, /<PrivacyBadge scope="private" \/>/);
  // Kutsutu näeb, et ta EI ole veel liige.
  assert.match(invited, /<PrivacyBadge scope="invited" \/>/);
});

test("jagamise eelvaade näitab TÄPSELT manifesti välju ja on kaheastmeline", () => {
  // Server lubab shareTopic'is ainult need võtmed (topics.js allowlist).
  assert.match(share, /body: \{ title: shareTitle, body: item\.body, audience, sourcePrivateItemId: item\.id \}/);
  // KRIITILINE: eelvaade näitab TÄPSELT saadetavat pealkirja. Pealkirjata
  // kirjel tuletatakse see sisust — tuletus tohib elada AINULT ühes kohas,
  // muidu näeks kasutaja tühja välja ja jagaks tegelikult muud.
  assert.match(share, /const shareTitle = useMemo\(/);
  assert.match(share, /\{shareTitle\}<\/p>/);
  // Eelvaade kuvab needsamad väljad + kes näevad.
  assert.match(share, /supervision\.eeskamber\.titleLabel/);
  assert.match(share, /supervision\.eeskamber\.bodyLabel/);
  assert.match(share, /supervision\.share\.audienceLabel/);
  assert.match(share, /supervision\.share\.willSee/);
  // Kaheastmelisus: eelvaade → kinnitus; jagamine käivitub alles teises astmes.
  assert.match(share, /useState\("preview"\)/);
  assert.match(share, /setStep\("confirm"\)/);
  assert.match(share, /onClick=\{share\}/);
  // Nimeline saajate loend, mitte üldine „osalejad".
  assert.match(share, /audienceNames/);
});

test("OS† (kinnitamata kontraktiversioon) saab jagamisel selgituse, mitte üldise vea", () => {
  assert.match(share, /supervision\.errors\.contract_not_accepted/);
  assert.match(share, /supervision\.share\.notReady/);
});

test("SUP-03: superviisorile pakutakse Q2 järgi jagamisrada", () => {
  // UI juhindub capabilities'ist ning serializer lubab nii SV kui kehtiva OS-i.
  assert.match(eeskamber, /canShare = Boolean\(process\.capabilities\?\.canShareTopic\)/);
  assert.match(eeskamber, /canShare && !item\.sharedTopicId/);
  const serializers = read("lib/supervision/serializers.js");
  assert.match(serializers, /canShareTopic: \(isSv \|\| \(isOs && hasValidAcceptance\)\) && open/);
});

test("sulgemise eelvaade: kaks eristatud tulpa + topeltkinnitus + üldistatud pealkiri", () => {
  assert.match(closePage, /supervision\.close\.willDelete/);
  assert.match(closePage, /supervision\.close\.willKeep/);
  assert.match(css, /\.purgeCol/);
  assert.match(css, /\.keepCol/);
  // Loend, mitte lause: kõik kolm kustuvat ja kolm jäävat liiki on nimetatud.
  for (const key of ["sharedTopics", "draftSummaries", "meetingNotes"]) {
    assert.match(closePage, new RegExp(`supervision\\.close\\.${key}`));
  }
  for (const key of ["approvedSummaries", "meetingFacts", "privateItems"]) {
    assert.match(closePage, new RegExp(`supervision\\.close\\.${key}`));
  }
  // Topeltkinnitus: esimene klikk ainult avab kinnituse, teine sulgeb.
  assert.match(closePage, /setConfirming\(true\)/);
  assert.match(closePage, /confirming \?/);
  assert.match(closePage, /onClick=\{close\}/);
  // Üldistatud pealkiri on KOHUSTUSLIK (server nõuab, UI ei luba tühja).
  assert.match(closePage, /disabled=\{saving \|\| !generalizedTitle\.trim\(\)\}/);
  assert.match(closePage, /generalizedTitle: title/);
  assert.match(closePage, /expectedVersion: process\.version/);
});

test("sulgemise 409-d on ERISTATUD: ootel kokkuvõtted vs juba suletud", () => {
  assert.match(closePage, /supervision\.errors\.pending_summaries/);
  assert.match(closePage, /supervision\.errors\.already_closed/);
  // Ootel kokkuvõtted annavad OTSELINGID nende juurde.
  assert.match(closePage, /pendingIds\.map/);
  assert.match(closePage, /ala=kokkuvotted&summary=/);
  // Juba suletud → suuna suletud vaatesse, mitte veateate taha.
  assert.match(closePage, /router\.replace/);
});

test("suletud vaade kannab purgeReport arve ja viib isikliku paki juurde", () => {
  assert.match(shell, /supervision\.closed\.banner/);
  assert.match(shell, /supervision\.closed\.purged/);
  assert.match(shell, /topics: process\.closure\.purgeReport\.sharedTopics/);
  assert.match(shell, /supervision\.closed\.openPack/);
  // M12 pakk on privaatne ega tule protsessi vastusega — eraldi päring.
  assert.match(shell, /\/api\/supervision\/outcomes/);
});

test("CAS: iga muutev toiming saadab expectedVersion'i", () => {
  assert.match(contract, /expectedVersion: process\.version/);
  assert.match(eeskamber, /expectedVersion: editing\.version/);
  assert.match(meetings, /expectedVersion: meeting\.version/);
  assert.match(summaries, /expectedVersion: summary\.version/);
});

test("olekuleping: laadimine / viga / 409 / tühi on igas vaates kaetud", () => {
  const views = { home, create, shell, invited, contract, eeskamber, share, meetings, summaries, kapp, closePage, outcome };
  // Laadimine + veaolek nendes vaadetes, mis ise laevad.
  for (const [name, src] of Object.entries({ home, shell, eeskamber, share, closePage, outcome })) {
    assert.match(src, /supervision\.common\.loading/, `${name}: laadimisolek puudub`);
  }
  // Tühi-olek seal, kus loend võib olla tühi.
  assert.match(home, /supervision\.home\.emptyTitle/);
  assert.match(eeskamber, /supervision\.eeskamber\.empty/);
  assert.match(meetings, /supervision\.meetings\.empty/);
  assert.match(summaries, /supervision\.summaries\.empty/);
  assert.match(kapp, /supervision\.kapp\.empty/);
  // 409 on OMA olek, mitte üldine viga.
  for (const [name, src] of Object.entries({ shell, contract, eeskamber, meetings, summaries, invited })) {
    assert.match(src, /conflictReload|isConflict/, `${name}: 409-käsitlus puudub`);
  }
  // Ükski vaade ei tohi kasutada toorest alert'i olekute näitamiseks.
  for (const [name, src] of Object.entries(views)) {
    assert.doesNotMatch(src, /window\.alert\(/, `${name}: alert() ei ole olekuleping`);
  }
});

test("401/404 saavad ühetaolise sõnastuse jagatud kliendikihist", () => {
  assert.match(client, /status === 401.*\n?.*supervision\.common\.loginRequired/);
  assert.match(client, /status === 404.*\n?.*supervision\.common\.notFound/);
  // Iga laadiv vaade kasutab seda kihti, mitte oma sõnastust.
  for (const [name, src] of Object.entries({ home, shell, eeskamber, share, closePage, outcome })) {
    assert.match(src, /supervisionMessage\(/, `${name}: peab kasutama jagatud sõnastust`);
  }
});

test("grandi puudumine on SELGITUS, mitte tühi viga (vaade 2)", () => {
  assert.match(create, /status === 403/);
  assert.match(create, /supervision\.create\.grantRequired/);
});

test("HELD ja kustutamine küsivad kinnitust enne pöördumatut sammu", () => {
  assert.match(meetings, /window\.confirm\(t\("supervision\.meetings\.heldConfirm"\)\)/);
  assert.match(eeskamber, /window\.confirm\(t\("supervision\.eeskamber\.deleteConfirm"\)\)/);
  assert.match(summaries, /window\.confirm\(t\("supervision\.summaries\.discardConfirm"\)\)/);
  assert.match(summaries, /`discard:\$\{summary\.id\}`,[\s\S]*"DELETE"/);
  assert.match(summaries, /\["DRAFT", "PENDING_APPROVAL"\]\.includes\(summary\.status\)/);
});

test("SUPERSEDED kontraktil puudub aktiveerimisnupp ja lahkumine nõuab kahte sammu", () => {
  assert.match(contract, /version\.status === "DRAFT"/);
  assert.match(shell, /capabilities\?\.canLeave/);
  assert.match(shell, /leaveConfirming/);
  assert.match(shell, /supervision\.leave\.confirmHint/);
  assert.match(shell, /\/api\/supervision\/participations\/\$\{encodeURIComponent\(participationId\)\}\/leave/);
});

test("SUP-11/SUP-12: täielik retention-manifest ja nähtavusepõhine kokkuvõttepoll", () => {
  for (const key of ["contractVersions", "contractAcceptances", "auditTrail", "closureFacts", "personalOutcomes"]) {
    assert.match(closePage, new RegExp(`supervision\\.close\\.${key}`), `retention-rida ${key} puudub`);
  }
  assert.match(shell, /area !== SUPERVISION_AREAS\.KOKKUVOTTED \|\| isClosed/);
  assert.match(shell, /document\.visibilityState !== "visible"/);
  assert.match(shell, /window\.setInterval/);
  assert.match(shell, /document\.addEventListener\("visibilitychange"/);
  assert.match(shell, /window\.clearInterval/);
  assert.match(shell, /document\.removeEventListener\("visibilitychange"/);
});

test("ligipääsetavus: reduced-motion, live-region ja klaviatuurifookus on kaetud", () => {
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  for (const [name, src] of Object.entries({ home, shell, eeskamber, share, closePage })) {
    assert.match(src, /aria-live="polite"/, `${name}: live-region puudub`);
  }
  // Sakid on päris nupud (klaviatuuriga kasutatavad), mitte klikitavad div'id.
  assert.match(shell, /<button[\s\S]*type="button"/);
  assert.match(shell, /aria-current=\{area === key \? "page" : undefined\}/);
});

test("UI EI impordi privaatserializer'it ega puutu supervisiooni teksti RAG-i", () => {
  const all = [home, create, shell, invited, contract, eeskamber, share, meetings, summaries, kapp, closePage, outcome];
  for (const src of all) {
    assert.doesNotMatch(src, /serializersPrivate/);
    assert.doesNotMatch(src, /\/api\/rag|embedding|ingest/i);
  }
});
