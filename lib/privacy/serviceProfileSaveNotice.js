/**
 * SOL-SPROF-02 — SALVESTUS EI OLE SAMA MIS EEMALDUS.
 *
 * Kui kasutaja võtab soovitusloa tagasi või peidab profiili, jätkub serveris
 * kaugkoopia kustutamine. Kuni see ei ole kinnitatud, kannab
 * `ragMetadata.syncStatus` väärtust `pending_removal` — ja tingimusteta
 * „salvestatud" oleks siis pool tõde: kasutaja arvaks, et tema andmed on
 * assistendist juba kadunud, kuigi kustutus alles käib.
 *
 * Otsus elab JSX-ist väljas, sest teda peab saama mõõta ilma Reactita. Tagastab
 * tõlkevõtme koos varutekstiga; sõnastuse valib kutsuja sõnastik.
 */

export function serviceProfileSaveNoticeKey(profile) {
  const syncStatus = String(profile?.ragMetadata?.syncStatus || "").trim();

  if (syncStatus === "pending_removal") {
    return {
      key: "workspace_feature_pages.service_profile.save_success_removal_pending",
      fallback: "Teenuseprofiil salvestati. Assistendi koopia eemaldamine on pooleli ja lõpetatakse automaatselt."
    };
  }

  /* `failed` tuleb sünkroonimise erindist. Ta EI tähenda, et salvestus kukkus —
     profiil on kirjas —, aga assistendi koopia ei ole kasutaja uue valikuga
     kooskõlas. Kasutaja peab seda teadma, muidu ta ei tea ka, et tagasi tulla. */
  if (syncStatus === "failed") {
    return {
      key: "workspace_feature_pages.service_profile.save_success_assistant_sync_failed",
      fallback: "Teenuseprofiil salvestati, aga assistendi koopia uuendamine ebaõnnestus. Proovime automaatselt uuesti."
    };
  }

  return {
    key: "workspace_feature_pages.service_profile.save_success",
    fallback: "Teenuseprofiil salvestati."
  };
}
