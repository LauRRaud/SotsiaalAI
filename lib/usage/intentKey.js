/**
 * KLIENDI KAVATSUSE VÕTI (SOL-DOC-01).
 *
 * MIS PUUDUS. Agendi klient ei saatnud genereerimise ega refinement'i payload'is
 * ühtegi `idempotencyKey` välja, ja adapter tegi puuduva võtme asemel iga kord uue
 * UUID-i. Seetõttu ei olnud ÜHELGI korduskatsel seost eelmise katsega: kadunud
 * vastuse või katkenud võrgu järel tekkis uus reservatsioon, uus tasu ja uus
 * mustand — kaks ühikut ja kaks rida ühe kavatsuse eest.
 *
 * MIS SIIN ON. Võti elab kliendis nii kaua, kuni kavatsus on lahendatud:
 *
 *  - sama sisendiga (sama allkiri) uus katse = KORDUS → sama võti. Server annab
 *    tagasi juba loodud mustandi ega võta teist tasu;
 *  - muutunud sisend = UUS kavatsus → uus võti;
 *  - õnnestumise järel võti kustutatakse, seega TAHTLIK sama sisendiga uus jooks
 *    (kasutaja tahab teist varianti) saab uue võtme ja on aus uus töö.
 *
 * Funktsioonid on puhtad ja võtmeloome on süstitav, seega kogu see loogika on
 * mõõdetav ilma React-i, brauseri ja `crypto` olemasoluta.
 */

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === "object") {
    return Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableValue(value[key])
        return acc
      }, {})
  }
  return value
}

/**
 * Kavatsuse allkiri: sama sisend annab sama sõne ka siis, kui väljade järjekord
 * objektis erineb. `undefined` väljad jäetakse välja, sest `JSON.stringify` viskab
 * nad niikuinii minema ja muidu sõltuks allkiri sellest, kas väli oli kirjutatud.
 */
export function buildIntentSignature(payload) {
  return JSON.stringify(stableValue(payload ?? null))
}

export function mintIntentKey() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/**
 * @param previous `{ signature, key } | null` — eelmine lahendamata kavatsus.
 * @param signature praeguse päringu allkiri.
 * @param mint võtmeloome (süstitav).
 * @returns `{ signature, key }` — sama objekt, kui tegu on kordusega.
 */
export function resolveIntentKey(previous, signature, mint = mintIntentKey) {
  if (previous && previous.key && previous.signature === signature) return previous
  return { signature, key: mint() }
}
