import { cookies } from "next/headers";

import SubsistenceCalculator from "@/components/benefits/SubsistenceCalculator";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

/**
 * A2 — toimetulekutoetuse eelkalkulaator.
 *
 * Leht on AVALIK ja kontot ei nõua. See ei ole mööndus, vaid selle funktsiooni
 * mõte: inimene, kes kaalub, kas tal võib olla õigus toimetulekutoetusele, on
 * tihti täpselt see, kes ei taha end kuskile kirja panna. Kontonõue oleks siin
 * müür vale koha peal.
 *
 * Turvaline avalikuks tegemiseks on ta konstruktsiooni tõttu, mitte lubaduse
 * tõttu: arvutus käib brauseris, andmeid ei saadeta kuhugi ega salvestata.
 * Server ei näe kunagi kellegi sissetulekut.
 */

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const subsistence = messages?.subsistence || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/toimetulekutoetus",
    title: subsistence.title || "Toimetulekutoetuse eelhinnang",
    description: subsistence.not_a_decision || ""
  });
}

export default function Page() {
  return <SubsistenceCalculator />;
}
