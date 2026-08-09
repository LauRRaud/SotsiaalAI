/**
 * JTA-V1 (E2) / SOL-CW-18 — laua koormuspiirid ÜHES KOHAS.
 *
 * MIKS OMAETTE FAIL. Sama arv peab kehtima kolmes kohas: JS-tähtaeg
 * (`withDeadline`), andmebaasi `statement_timeout` (`workbenchDb.js`) ja
 * lepingutest. Kui igaüks kirjutaks oma numbri, läheksid nad esimese muudatusega
 * lahku ja tagajärg oleks VAIKNE — laud lubaks kasutajale 2,5 s, andmebaas
 * laseks päringul edasi joosta, ja täpselt see ongi SOL-CW-18 sisu. Import
 * kummastki suunast tekitaks ringi (`workbench.js` ↔ `workbenchDb.js`), seega
 * konstandid elavad siin.
 */

/**
 * L13 — ÜKS SEKTSIOON, ÜKS TÄHTAEG.
 *
 * SEE ON LUBADUS KASUTAJALE ja seepärast on ta ka ANDMEBAASI eelarve: päring,
 * mis elab üle lubaduse, on täpselt see nähtamatu taustakoormus, mille pärast
 * leid kirjutati.
 */
export const WORKBENCH_SECTION_DEADLINE_MS = 2500;

/**
 * Laua oma ühendustepesa ülempiir.
 *
 * KÜMME = ÜKS SEKTSIOONI KOHTA. Üks laua päring ei pea seega kunagi oma
 * ühendust ootama. Sellest EDASI ta ei kasva: pesa on lauale eraldi (vt
 * `workbenchDb.js`) ja tema ammendumine ei puuduta rakenduse põhipesa. Piir on
 * globaalne, mitte kasutaja kohta — kümme aeglast lauda ei tohi süüa ära
 * andmebaasi ühendusi, mida vajab kõik muu.
 */
export const WORKBENCH_DB_POOL_MAX = 10;

/**
 * Sama kasutaja korraga lennus olevate laua-päringute piir.
 *
 * KAKS, MITTE ÜKS: laud võib olla lahti kahes vahekaardis ja üks neist ei tohi
 * teist tappa. KAKS, MITTE KÜMME: leiu teine pool on „korduvad refresh'id
 * kuhjavad nähtamatu taustakoormuse just tõrke ajal" — tõrke ajal vajutab
 * inimene värskendust rohkem, mitte vähem.
 *
 * PIIR ON PROTSESSI-SISENE ja see on teadlik: jagatud loendur nõuaks Redist või
 * andmebaasi rida, mis ise on koormus, ja mitme instantsi puhul kaitseb iga
 * instants oma ühendustepesa — just teda on vaja kaitsta.
 */
export const WORKBENCH_MAX_CONCURRENT_PER_USER = 2;
