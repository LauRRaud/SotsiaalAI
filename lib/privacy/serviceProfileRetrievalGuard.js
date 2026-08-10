/**
 * SOL-SPROF-02 — nõusoleku tagasivõtmine peatab retrieval'i KOHE.
 *
 * Kaugkoopia kustutamine on õige lõpplahendus, aga ta on VÕRGUTOIMING: ta võib
 * ebaõnnestuda, aeguda või oodata retry-workerit. Kasutaja tahe ei tohi oodata
 * võõra teenuse kättesaadavust. Seepärast on siin teine, kohalik värav, mis
 * käib IGA otsingutulemuse peal ja loeb tõde meie enda andmebaasist.
 *
 * KAKS ERI ASJA, mida kokku ei aeta:
 *   - `serviceProfileRagRemoval` = koopia PÜSIV eemaldus (mehhanism, järjekord);
 *   - see moodul = LUBA kasutada seda, mis veel alles on (värav, päringuaegne).
 * Esimene on lõplik, teine on kohene. Kumbki üksi ei ole piisav: ilma väravata
 * jääks tagasi võetud profiil vastustesse kuni kustutuse kinnituseni, ilma
 * eemalduseta jääks koopia igaveseks võõrasse teenusesse.
 *
 * FAIL-CLOSED ON SIIN SÕNA-SÕNALT: kui loa kontroll ise ei õnnestu, kaovad KÕIK
 * teenuseprofiili vasted. Kahtluse korral on õige vastus „ei soovita", mitte
 * „soovitan igaks juhuks". Vale suunas eksides oleks värav dekoratsioon.
 */

/* PREFIKSI OMANIK ON SIIN, kõige kergem moodul ahelas. Varem elas sama sõne ka
   `serviceProviderProfiles.js`-is; kaks koopiat tähendab, et prefiksi muutmine
   ühes kohas teeks väravast dekoratsiooni — ta lihtsalt ei tunneks profiile
   enam ära ja laseks KÕIK läbi, vaikselt. Ehitaja ja lugeja peavad olema
   sama tõe kaks otsa. */
const DOC_ID_PREFIX = "service-provider-profile::";

/** `abc` → `service-provider-profile::abc`. Determinist, sest orb peab olema leitav. */
export function serviceProfileRagDocId(profileId) {
  const id = String(profileId || "").trim();
  return id ? `${DOC_ID_PREFIX}${id}` : "";
}

/** Loeb vastest doc-ID, ükskõik millises kolmest kujust RAG ta tagastab. */
export function ragMatchDocId(match) {
  if (!match || typeof match !== "object") return "";
  const raw =
    match.doc_id ||
    match.docId ||
    match.metadata?.doc_id ||
    match.metadata?.docId ||
    "";
  return String(raw || "").trim();
}

/** `service-provider-profile::abc` → `abc`; kõik muu → `""`. */
export function serviceProfileIdFromDocId(docId) {
  const value = String(docId || "").trim();
  if (!value.startsWith(DOC_ID_PREFIX)) return "";
  return value.slice(DOC_ID_PREFIX.length).trim();
}

/**
 * Eemaldab vastete hulgast need teenuseprofiilid, kellel EI OLE praegu kehtivat
 * soovitusluba. Muud vasted lähevad muutumatult edasi.
 *
 * `db` on süstitud (mitte imporditud), et seda moodulit saaks ühiktestis laadida
 * ilma serverikihita — sama põhjus, mis `serviceProfileRagRemoval`-il.
 */
export async function filterRevokedServiceProfileMatches(matches, { db } = {}) {
  const list = Array.isArray(matches) ? matches : [];
  if (!list.length) return list;

  const byProfile = new Map();
  for (const match of list) {
    const profileId = serviceProfileIdFromDocId(ragMatchDocId(match));
    if (profileId) byProfile.set(profileId, true);
  }
  if (!byProfile.size) return list;

  const profileIds = [...byProfile.keys()];
  let allowed = new Set();
  try {
    if (!db?.serviceProviderProfile?.findMany) throw new Error("profile_lookup_unavailable");
    const rows = await db.serviceProviderProfile.findMany({
      where: {
        id: { in: profileIds },
        status: "PUBLISHED",
        assistantRecommendationAllowed: true
      },
      select: { id: true }
    });
    allowed = new Set((rows || []).map((row) => row.id));
  } catch {
    /* FAIL-CLOSED: kontrollimata luba ei ole luba. Tühi hulk tähendab, et kõik
       profiilivasted kukuvad välja. */
    allowed = new Set();
  }

  return list.filter((match) => {
    const profileId = serviceProfileIdFromDocId(ragMatchDocId(match));
    if (!profileId) return true;
    return allowed.has(profileId);
  });
}
