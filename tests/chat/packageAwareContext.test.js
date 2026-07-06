import test from "node:test";
import assert from "node:assert/strict";

import { buildPackageAwareContext } from "../../lib/chat/packageAwareContext.js";

test("buildPackageAwareContext creates compact package context and V3.2 trace signals", () => {
  const result = buildPackageAwareContext([
    {
      package_id: "jogeva_vald_service_koduteenus_package",
      canonical_item_id: "jogeva_vald_service_koduteenus",
      package_type: "kov_service",
      title: "Koduteenus",
      municipality_id: "jogeva_vald",
      municipality_name: "Jõgeva vald",
      confidence: "medium",
      missing_sections: ["forms", "contacts", "legal_basis", "fees", "deadlines"],
      sections: {
        description: [
          {
            source_id: "service-info",
            title: "Koduteenus",
            source_type: "kov_service_info",
            evidenceText: "Long source text must not appear."
          }
        ],
        eligibility: [],
        application: [],
        forms: [],
        contacts: [],
        legal_basis: []
      }
    }
  ]);

  assert.equal(result.used, true);
  assert.deepEqual(result.usedPackageIds, ["jogeva_vald_service_koduteenus_package"]);
  assert.deepEqual(result.missingSectionsUsed, ["contacts", "deadlines", "fees", "forms", "legal_basis"]);
  assert.deepEqual(result.packageDisplayedSourceIds, ["service-info"]);
  assert.equal(result.packageAnswerFlags.includes("missing_forms"), true);
  assert.equal(result.contextText.includes("SOURCE PACKAGE 1"), true);
  assert.equal(result.contextText.includes("vormid: missing"), true);
  assert.equal(result.contextText.includes("Long source text"), false);
});

test("buildPackageAwareContext guides condition questions to use confirmed package sections", () => {
  const result = buildPackageAwareContext([
    {
      package_id: "kuusalu_vald_service_koduteenus_package",
      canonical_item_id: "kuusalu_vald_service_koduteenus",
      package_type: "kov_service",
      title: "Koduteenus",
      municipality_id: "kuusalu_vald",
      municipality_name: "Kuusalu vald",
      sections: {
        description: [{ source_id: "kuusalu-koduteenus", title: "Koduteenus", source_type: "kov_service_info" }],
        eligibility: [],
        application: [{ source_id: "kuusalu-koduteenus", title: "Koduteenus", source_type: "kov_service_info" }],
        legal_basis: [{ source_id: "kuusalu-rt-6", title: "Sotsiaalhoolekandelise abi andmise kord Kuusalu vallas § 6 Koduteenus", source_type: "kov_regulation" }],
        forms: [{ source_id: "kuusalu-forms", title: "Taotluste vormid", source_type: "application_form" }]
      },
      source_ids: ["kuusalu-koduteenus", "kuusalu-rt-6", "kuusalu-forms"],
      missing_sections: ["fees", "deadlines"]
    }
  ], {
    query: "Millised on Kuusalu valla koduteenuse tingimused?"
  });

  assert.equal(result.contextText.includes("answer_focus_conditions=use_confirmed_description_eligibility_application_and_legal_basis"), true);
  assert.equal(result.contextText.includes("PACKAGE-AWARE CONDITION QUESTION RULE"), true);
  assert.equal(result.contextText.includes("ära ütle automaatselt, et tingimusi ei saa välja tuua"), true);
  assert.equal(result.contextText.includes("description, application ja legal_basis sektsioonidest"), true);
  assert.equal(result.contextText.includes("Sõnasta piirang usaldust hoidvalt"), true);
  assert.equal(result.contextText.includes("tingimused ei ole piisavalt kinnitatavad"), true);
  assert.equal(result.contextText.includes("kasutatud allikates on teenuse tingimused kirjeldatud üldiselt"), true);
  assert.equal(result.contextText.includes("Ära sea kahtluse alla kinnitatud teenuselehte"), true);
  assert.equal(result.missingSectionsUsed.includes("fees"), false);
  assert.equal(result.missingSectionsUsed.includes("deadlines"), false);
});

test("buildPackageAwareContext instructs Tallinn district follow-up for district-routed services", () => {
  const result = buildPackageAwareContext([
    {
      package_id: "tallinn_service_koduteenus_package",
      canonical_item_id: "tallinn_service_koduteenus",
      package_type: "kov_service",
      title: "Koduteenus",
      municipality_id: "tallinn",
      municipality_name: "Tallinna linn",
      sections: {
        description: [{ source_id: "tallinn_koduteenus", title: "Koduteenus", source_type: "kov_service_info" }],
        application: [{ source_id: "tallinn_koduteenus", title: "Koduteenus", source_type: "kov_service_info" }],
        legal_basis: [{ source_id: "tallinn-rt", title: "Sotsiaalhoolekandelise abi andmise kord", source_type: "kov_regulation" }],
        contacts: []
      },
      source_ids: ["tallinn_koduteenus", "tallinn-rt"],
      missing_sections: ["contacts"]
    }
  ], {
    query: "Elan Tallinnas. Mis tingimustel saab koduteenust ja millisele õigusaktile see tugineb?"
  });

  assert.equal(result.contextText.includes("konkreetse kontakti valimiseks on vaja linnaosa"), true);
  assert.equal(result.contextText.includes("Ära jäta sellepärast teenuse tingimusi"), true);
  assert.equal(result.contextText.includes("paku vastava linnaosa kontakt"), true);
});

test("buildPackageAwareContext asks for paragraph-level legal detail for social workers", () => {
  const result = buildPackageAwareContext([
    {
      package_id: "tallinn_service_koduteenus_package",
      canonical_item_id: "tallinn_service_koduteenus",
      package_type: "kov_service",
      title: "Koduteenus",
      municipality_id: "tallinn",
      municipality_name: "Tallinna linn",
      sections: {
        description: [{ source_id: "tallinn_koduteenus", title: "Koduteenus", source_type: "kov_service_info" }],
        legal_basis: [{
          source_id: "tallinn-rt-koduteenus",
          title: "Sotsiaalhoolekandelise abi andmise kord § 7 Koduteenus",
          source_type: "kov_regulation"
        }]
      },
      source_ids: ["tallinn_koduteenus", "tallinn-rt-koduteenus"],
      missing_sections: []
    }
  ], {
    query: "Elan Tallinnas. Mis tingimustel saab koduteenust ja millisele õigusaktile see tugineb?",
    role: "SOCIAL_WORKER"
  });

  assert.equal(result.contextText.includes("SPETSIALISTI ÕIGUSVIITE REEGEL"), true);
  assert.equal(result.contextText.includes("nimeta paragrahvinumber ja paragrahvi pealkiri"), true);
  assert.equal(result.contextText.includes("õigusakti tasand"), true);
});

test("buildPackageAwareContext anchors package selection to the requested service", () => {
  const result = buildPackageAwareContext([
    {
      package_id: "alutaguse_vald_service_asendushooldusteenus_package",
      canonical_item_id: "alutaguse_vald_service_asendushooldusteenus",
      package_type: "kov_service",
      title: "Asendushooldusteenus",
      municipality_id: "alutaguse_vald",
      sections: {
        description: [{ source_id: "alutaguse-asendushooldus", title: "Asendushooldusteenus" }],
        legal_basis: [{ source_id: "alutaguse-rt-koduteenus", title: "Sotsiaalhoolekandelise abi andmise kord § 7 Koduteenus" }]
      },
      source_ids: ["alutaguse-asendushooldus"],
      missing_sections: ["forms", "contacts", "legal_basis"]
    },
    {
      package_id: "alutaguse_vald_service_koduteenus_package",
      canonical_item_id: "alutaguse_vald_service_koduteenus",
      package_type: "kov_service",
      title: "Koduteenus",
      municipality_id: "alutaguse_vald",
      sections: {
        description: [{ source_id: "alutaguse-koduteenus", title: "Koduteenus" }]
      },
      source_ids: ["alutaguse-koduteenus"],
      missing_sections: ["forms", "contacts", "legal_basis"]
    },
    {
      package_id: "alutaguse_vald_service_isikliku_abistaja_teenus_package",
      canonical_item_id: "alutaguse_vald_service_isikliku_abistaja_teenus",
      package_type: "kov_service",
      title: "Isikliku abistaja teenus",
      municipality_id: "alutaguse_vald",
      sections: {
        description: [{ source_id: "alutaguse-isiklik-abistaja", title: "Isikliku abistaja teenus" }]
      },
      source_ids: ["alutaguse-isiklik-abistaja"],
      missing_sections: ["forms", "contacts", "legal_basis"]
    }
  ], {
    query: "kas alutaguse vallas pakutakse koduteenuseid?"
  });

  assert.equal(result.used, true);
  assert.deepEqual(result.usedPackageIds, ["alutaguse_vald_service_koduteenus_package"]);
  assert.deepEqual(result.packageDisplayedSourceIds, ["alutaguse-koduteenus"]);
  assert.equal(result.contextText.includes("Koduteenus"), true);
  assert.equal(result.contextText.includes("Asendushooldusteenus"), false);
  assert.equal(result.contextText.includes("Isikliku abistaja teenus"), false);
});

test("buildPackageAwareContext does not push missing form contact text for service existence questions", () => {
  const result = buildPackageAwareContext([
    {
      package_id: "alutaguse_vald_service_koduteenus_package",
      canonical_item_id: "alutaguse_vald_service_koduteenus",
      package_type: "kov_service",
      title: "Koduteenus",
      municipality_id: "alutaguse_vald",
      sections: {
        description: [{ source_id: "alutaguse-koduteenus", title: "Koduteenus", source_type: "kov_service_info" }],
        application: [{ source_id: "alutaguse-koduteenus", title: "Koduteenus", source_type: "kov_service_info" }],
        forms: [],
        contacts: [],
        legal_basis: []
      },
      source_ids: ["alutaguse-koduteenus"],
      missing_sections: ["forms", "contacts", "legal_basis", "fees", "deadlines"]
    }
  ], {
    query: "kas alutaguse vallas on olemas koduteenus?"
  });

  assert.deepEqual(result.missingSectionsUsed, []);
  assert.equal(result.contextText.includes("vormid: missing"), false);
  assert.equal(result.contextText.includes("kontaktid: missing"), false);
  assert.equal(result.contextText.includes("missing_sections_relevant_to_question=none"), true);
});

test("buildPackageAwareContext keeps missing form contact text for application questions", () => {
  const result = buildPackageAwareContext([
    {
      package_id: "alutaguse_vald_service_koduteenus_package",
      canonical_item_id: "alutaguse_vald_service_koduteenus",
      package_type: "kov_service",
      title: "Koduteenus",
      municipality_id: "alutaguse_vald",
      sections: {
        description: [{ source_id: "alutaguse-koduteenus", title: "Koduteenus", source_type: "kov_service_info" }],
        forms: [],
        contacts: []
      },
      source_ids: ["alutaguse-koduteenus"],
      missing_sections: ["forms", "contacts"]
    }
  ], {
    query: "kuidas alutaguse vallas koduteenust taotleda?"
  });

  assert.deepEqual(result.missingSectionsUsed, ["contacts", "forms"]);
  assert.equal(result.contextText.includes("vormid: missing"), true);
  assert.equal(result.contextText.includes("kontaktid: missing"), true);
});

test("buildPackageAwareContext exposes confirmed form URLs for answer text", () => {
  const formUrl = "https://www.alutagusevald.ee/sites/default/files/documents/2026-02/Avaldus%20teenuse%20taotlemiseks%20abivajaduse%20korral%20%282%29.docx";
  const result = buildPackageAwareContext([
    {
      package_id: "alutaguse_vald_service_koduteenus_package",
      canonical_item_id: "alutaguse_vald_service_koduteenus",
      package_type: "kov_service",
      title: "Koduteenus",
      municipality_id: "alutaguse_vald",
      sections: {
        description: [{ source_id: "alutaguse-koduteenus", title: "Koduteenus", source_type: "kov_service_info" }],
        application: [{ source_id: "alutaguse-koduteenus", title: "Koduteenus", source_type: "kov_service_info" }],
        forms: [{
          source_id: "alutaguse_vald_form_teenuse_taotlus_pdf",
          title: "Avaldus teenuse taotlemiseks abivajaduse korral",
          source_type: "application_form",
          resource_type: "form",
          url: formUrl
        }],
        contacts: []
      },
      source_ids: ["alutaguse-koduteenus", "alutaguse_vald_form_teenuse_taotlus_pdf"],
      missing_sections: ["contacts", "fees", "deadlines"]
    }
  ], {
    query: "kas alutaguse vallas pakutakse koduteenust?"
  });

  assert.equal(result.contextText.includes("Avaldus teenuse taotlemiseks abivajaduse korral"), true);
  assert.equal(result.contextText.includes(`url=${formUrl}`), true);
  assert.equal(result.contextText.includes("Kui forms sektsioonis on vormi URL"), true);
  assert.equal(result.contextText.includes("answer_focus=availability,service_content,legal_basis,application,forms,contacts"), true);
  assert.equal(result.contextText.includes("Teenuse olemasolu küsimuses anna kohe tervikvastus"), true);
  assert.equal(result.contextText.includes("Ära lõpeta vastust lubadusega"), true);
});
