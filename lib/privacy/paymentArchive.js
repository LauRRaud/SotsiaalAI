import { randomBytes } from "node:crypto"

/**
 * SOL-PAY-09 — MAKSEKIRJE PEAB ELAMA MAKSJAST KAUEM.
 *
 * MIS OLI. `Payment.userId` oli `onDelete: Cascade`, seega konto kustutamine
 * viis makseajaloo kohe kaasa — kuigi `lib/retention.js` hoiab makseid seitse
 * aastat JA privaatsustingimuste punkt 7.9 lubab kasutajale sedasama:
 * „minimaalne makse- ja raamatupidamisalune kirje säilib kuni 7 aastat või
 * kauem, kui kohaldatav seadus seda nõuab". See tekst on tootmises väljas.
 *
 * See ei olnud tingimuste ja koodi vastuolu, vaid KOODI JA KOODI oma:
 * säilituskäik tegi õiget asja ja võõrvõtme reegel võttis selle vaikselt tagasi.
 * Andmebaasi tasand võitis teenusekihi ilma ühegi logireata.
 *
 * MIS SIIN ON. Enne `user.delete`-i külmutatakse maksja read: seos katkeb
 * (`SetNull`), aga rida jääb ja kannab minimaalset koosseisu, mille järgi
 * raamatupidamine saab tehingu tuvastada. `archivedAt` on ainus aus eristaja
 * „maksja kustutatud" ja „seost ei olnud kunagi" vahel.
 *
 * KOOSSEIS ON SIIN, ÜHES KOHAS. Raamatupidamise seaduse § 7 nõuab aega, summat,
 * poolt ja majanduslikku sisu. Aeg, summa, valuuta, staatus ja teenusepakkuja
 * viide on real niikuinii olemas; siin lisandub see, mis muidu kaoks koos
 * kasutajaga. Kui jurist või raamatupidaja täpsustab miinimumi, muutub
 * `PAYMENT_ARCHIVE_FIELDS` ja selle mooduli sisu — mitte laiali kustutusrada.
 *
 * MIDA SIIN TEADLIKULT EI OLE. Paketi INIMLOETAVAT nime ei külmutata:
 * „supervisioonipakett" tõendaks seitse aastat, et see inimene oli
 * supervisioonis, ja sisemine tootekood kannab sama majandusliku sisu ilma
 * selle tagajärjeta. `BillingMethod` ja `Subscription` kaskaadivad edasi —
 * makseviis on krediit (kasutatav token), mille säilitamine oleks HALVEM kui
 * kustutamine, ja tellimus ei ole algdokument. Algdokument on maksekirje.
 */

export const PAYMENT_ARCHIVE_FIELDS = Object.freeze([
  "archivedAt",
  "archivedPayerRef",
  "archivedPlanCode"
])

/**
 * Pseudonüüm, mis seob ühe inimese maksed omavahel ilma teda tuvastamata.
 *
 * Juhuslik, mitte tuletatud: HMAC kasutaja ID-st oleks nõudnud võtit, ja võti
 * on asi, mis lekib, roteerub ja puudub testkeskkonnas. Juhuslik viide on
 * konstruktsiooni järgi tagasi arvutamatu ka siis, kui kogu andmebaas lekib.
 * Grupeerimine säilib, sest sama kustutus kirjutab sama viite kõigile ridadele.
 */
export function generateArchivedPayerRef() {
  return `payer_${randomBytes(16).toString("base64url")}`
}

/**
 * Külmutab ühe kasutaja maksekirjed. Kutsutakse kustutuse tehingu SEES ja ENNE
 * `user.delete`-i — pärast seda ei ole enam kedagi, kelle read üles leida.
 *
 * Idempotentne: juba külmutatud rida (`archivedAt` täidetud) jääb puutumata,
 * sest kordus tähendaks uut pseudonüümi ja ühe inimese maksed laguneksid
 * omavahel seostamatuks.
 */
export async function archiveUserPaymentsWithin(tx, { userId, now = new Date() } = {}) {
  if (!tx?.payment?.findMany || !userId) {
    return { archived: 0, payerRef: null }
  }

  const payments = await tx.payment.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, subscription: { select: { plan: true } } }
  })

  if (payments.length === 0) {
    return { archived: 0, payerRef: null }
  }

  const payerRef = generateArchivedPayerRef()
  let archived = 0

  for (const payment of payments) {
    /* Plaanikood loetakse SIIN, mitte hiljem: `Subscription` kaskaadib koos
       kasutajaga ja pärast `user.delete`-i ei ole teda enam kuskilt küsida.
       Ilma tellimuseta makse (nt sponsorkutse) kannab oma majanduslikku sisu
       `kind` väljal, mis jääb reale niikuinii. */
    const planCode = payment.subscription?.plan || null
    const written = await tx.payment.updateMany({
      where: { id: payment.id, archivedAt: null },
      data: {
        archivedAt: now,
        archivedPayerRef: payerRef,
        archivedPlanCode: planCode
      }
    })
    archived += Number(written?.count || 0)
  }

  return { archived, payerRef }
}
