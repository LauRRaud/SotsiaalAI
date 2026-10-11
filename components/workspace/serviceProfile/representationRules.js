/**
 * Asutuse kinnitamise lehe vaate valik: milline väike vaade on ees.
 *
 * Puhas funktsioon, et otsust saaks testida ilma leheta. Järjekord on tähtis: sisselogimine ja
 * õigus enne kõike muud; lingiga tulles otsustab link; ilma lingita otsustab profiili seis.
 *
 *   wait          seanssi või seisu veel loetakse
 *   login         inimene ei ole sisse logitud
 *   forbidden     server keeldus (konto ei ole teenuseosutaja oma)
 *   done          link kinnitati just praegu
 *   confirmed     asutus on juba kinnitatud
 *   link          kehtiv link: üks nupp „Kinnitan"
 *   link_invalid  link ei kehti või ei kuulu sellele kontole; all on vorm uue lingi jaoks
 *   no_profile    profiili või registrikoodi ei ole
 *   request       vorm: saada kinnituslink
 */
export function representationView({ session, loaded, forbidden, hasToken, done, state, link }) {
  if (session === "unauthenticated") return "login";
  if (session !== "authenticated" || !loaded) return "wait";
  if (forbidden) return "forbidden";
  if (done) return "done";
  if (state?.confirmed) return "confirmed";
  if (hasToken && link?.valid) return "link";
  if (!state?.hasProfile || !state?.required) return "no_profile";
  if (hasToken) return "link_invalid";
  return "request";
}
