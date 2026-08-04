import { cookies } from "next/headers";

import UrgentRequestForm from "@/components/urgent/UrgentRequestForm";
import { getLocaleFromCookies, getMessagesSync } from "@/lib/i18n";
import { buildLocalizedMetadata } from "@/lib/metadata";

/**
 * SK-V1 — kiireloomuline abipalve.
 *
 * Lehe olemasolu EI TÄHENDA, et rada on kuskil avatud. Nähtavuse otsustab
 * `UrgentRequestForm`, mis küsib serverilt avatud piirkonnad: kui ühtegi
 * seadistatud lauda ei ole, ei ole ka valikut ega vormi, ja leht ütleb selle
 * välja koos sellega, mis asemel olemas on.
 *
 * Nii püsib lubadus ka siis, kui keegi jõuab siia otse-URL-iga: nuppu, mis ei
 * vii kuhugi, siin tekkida ei saa.
 *
 * Avalik nimi on „Kiireloomuline abipalve" (O-SK-7). „Sotsiaalkiirabi" jääb
 * sisemiseks teemakoodiks, sest Eestis tähendab see nimi juba mitut erinevat
 * väljasõidu- ja tugimudelit.
 */

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookies(cookieStore);
  const messages = getMessagesSync(locale);
  const urgent = messages?.urgent || {};
  return buildLocalizedMetadata({
    locale,
    pathname: "/kiireloomuline-abi",
    title: urgent.title || "Kiireloomuline abipalve",
    description: urgent.not_emergency || ""
  });
}

export default function Page() {
  return <UrgentRequestForm />;
}
