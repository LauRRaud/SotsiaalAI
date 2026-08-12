/* SOL-WB-06 saba — TÄIENDAV LAHTRISUMMUTUS.
 *
 * MIS PUUDU OLI. Künnis kaitses ainult TERVET koondit: kui valim ületas
 * miinimumgrupi, avaldati iga lahter täpse täisarvuna. Kaheteistkümne inimese
 * aruandes tähendas see, et `risk_event.risk.workplace_violence.count = 1` läks
 * välja täpselt nii — vaataja on tööandja määratud inimene, kes tunneb kõiki oma
 * töötajaid nimepidi, ja tema jaoks on „üks inimene kaheteistkümnest" koos
 * ükskõik millise kõrvalteadmisega tuvastus. Lävend 5 ei puutunud sellesse
 * kordagi: ta mõõdab valimit, mitte lahtrit.
 *
 * KAKS KIHTI, sest üks üksi ei tööta.
 *
 *   1. ESMANE — lahter, mille loendur on 0 < n < künnis, jääb avaldamata.
 *   2. TÄIENDAV — kui perekonna lahtrid liidetakse AVALDATUD üldsummaks, saab
 *      ainsa summutatud lahtri lahutamise teel tagasi arvutada: n = kokku −
 *      avaldatud. Seepärast peab summutatud lahtreid olema vähemalt KAKS ja
 *      nende summa vähemalt künnise jagu. Ilma selleta oleks esimene kiht
 *      dekoratsioon — number oleks vastuses ikka olemas, lihtsalt lahutamise
 *      taga.
 *
 * MIKS TÄIENDAV LAHTER VÕIB OLLA SUUR. Kui väikese lahtri kõrval on ainult üks
 * teine, läheb kinni ka tema, ka siis, kui ta on suur. See on summutuse hind ja
 * ta on teadlik: alternatiiv on avaldada väike lahter või jätta üldsumma
 * avaldamata, ja üldsumma on kogu aruande nimetaja.
 *
 * NULL EI OLE SALADUS. Loendur 0 ütleb „selles rühmas ei ole kedagi" ega
 * kirjelda ühtki inimest, seega ta jääb avaldatuks. Ta kitsendab küll
 * lahutamisvõrrandit, aga just selle vastu käib teine kiht.
 *
 * MITME VALIKUGA PEREKONNAD (koormustegurid, ressursid, riskimarkerid) EI
 * moodusta üldsummat: üks kirje kannab neid mitu, seega ükski avaldatud arv ei
 * ole nende summa. Seal ei ole lahutamisvõrrandit ja teist kihti ei rakendata —
 * esimene kiht üksi on seal täielik kaitse.
 */

function toEntries(counts) {
  const raw = counts instanceof Map ? [...counts.entries()] : [...(counts || [])];
  return raw
    .map(([key, count]) => [String(key), Number(count) || 0])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * Summutab ühe mõõdikuperekonna väikesed lahtrid.
 *
 * @param counts Map või [[võti, loendur]] paarid
 * @param options.minimumGroupSize künnis; lahter alla selle ei ole avaldatav
 * @param options.partitionsPublishedTotal kas lahtrid liituvad avaldatud
 *        üldsummaks — ainult siis on lahutamisrünnak olemas ja teine kiht käib
 * @returns { published, withheldKeys, familyWithheld }
 */
export function suppressSmallCells(counts, options = {}) {
  const minimum = Math.max(1, Math.trunc(Number(options.minimumGroupSize) || 1));
  const partitioned = Boolean(options.partitionsPublishedTotal);
  const entries = toEntries(counts);

  const withheld = new Map();
  for (const [key, count] of entries) {
    if (count > 0 && count < minimum) withheld.set(key, count);
  }

  if (withheld.size === 0) {
    return { published: entries, withheldKeys: [], familyWithheld: false };
  }

  if (partitioned) {
    /* Täiendav summutus: kõige VÄIKSEM ülejäänud lahter läheb esimesena, sest
       ta maksab aruande loetavuses kõige vähem. Kaks tingimust peavad mõlemad
       täituma — kaks lahtrit üksi ei aita, kui nende summa on ise künnisest
       väiksem (siis on mõlemad kitsalt piiratud), ja suur summa ei aita, kui
       kinni on ainult üks lahter (siis on ta lahutatav). */
    const candidates = entries
      .filter(([key, count]) => count > 0 && !withheld.has(key))
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    let withheldSum = [...withheld.values()].reduce((total, value) => total + value, 0);

    while ((withheld.size < 2 || withheldSum < minimum) && candidates.length > 0) {
      const [key, count] = candidates.shift();
      withheld.set(key, count);
      withheldSum += count;
    }

    /* Tingimust ei õnnestunud täita — perekond läheb tervikuna kinni, ka
       nullid. Fail-closed: osaline avaldamine oleks siin täpselt see võrrand,
       mille pärast teine kiht üldse olemas on. */
    if (withheld.size < 2 || withheldSum < minimum) {
      return {
        published: [],
        withheldKeys: entries.map(([key]) => key),
        familyWithheld: true
      };
    }
  }

  return {
    published: entries.filter(([key]) => !withheld.has(key)),
    withheldKeys: [...withheld.keys()].sort((a, b) => a.localeCompare(b)),
    familyWithheld: false
  };
}

/**
 * Koondab perekondade summutuse üheks aruandeks.
 *
 * VÕTMEID avaldatakse ainult SULETUD sõnavaraga perekonnal (signaal): aruanne
 * nimetab niikuinii kõiki kolme signaali, seega puuduv rida on lugejale
 * nähtav ka ilma selle loendita ja tema varjamine oleks vaikimine, mitte
 * kaitse. Avatud sõnavaraga perekonnal (riskimarkerid jms) läheb välja ainult
 * ARV — „kaks lahtrit jäi avaldamata" ei ütle, millised.
 */
export function summarizeCellSuppression(families = [], options = {}) {
  const minimumGroupSize = Math.max(1, Math.trunc(Number(options.minimumGroupSize) || 1));
  const affected = families
    .filter((family) => family.result.withheldKeys.length > 0)
    .map((family) => ({
      family: family.family,
      withheldCellCount: family.result.withheldKeys.length,
      familyWithheld: family.result.familyWithheld,
      ...(family.publishesKeys ? { withheldKeys: [...family.result.withheldKeys] } : {})
    }));

  return {
    minimumGroupSize,
    withheldCellCount: affected.reduce((total, family) => total + family.withheldCellCount, 0),
    families: affected
  };
}
