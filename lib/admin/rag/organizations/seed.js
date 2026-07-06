const ORGANIZATION_SEED = Object.freeze([
  {
    slug: "lastekaitse-liit",
    displayName: "Eesti Lastekaitse Liit",
    type: "ASSOCIATION",
    focus: "Laste heaolu ja peretoetus",
    county: "Uleriigiline",
    isActive: true,
    officialWebsite: "https://www.lastekaitseliit.ee",
    contactEmail: "info@lastekaitseliit.ee",
    contactPhone: "",
    notes: "Oluline teemaveeb ja partner laste ning perede toetusinfo jaoks.",
    fileCount: 0,
    crawlReadiness: "PLANNED"
  },
  {
    slug: "astangu",
    displayName: "Astangu Kutserehabilitatsiooni Keskus",
    type: "SERVICE_PROVIDER",
    focus: "Puudega inimeste rehabilitatsioon ja teenused",
    county: "Harjumaa",
    isActive: true,
    officialWebsite: "https://www.astangu.ee",
    contactEmail: "astangu@astangu.ee",
    contactPhone: "",
    notes: "Teenuseosutaja, mille sisu voib hiljem vajada eraldi faili- ja ingestivoogu.",
    fileCount: 0,
    crawlReadiness: "PLANNED"
  },
  {
    slug: "sotsiaalkindlustusamet",
    displayName: "Sotsiaalkindlustusamet",
    type: "PUBLIC_BODY",
    focus: "Toetused, teenused ja juhendmaterjalid",
    county: "Uleriigiline",
    isActive: true,
    officialWebsite: "https://www.sotsiaalkindlustusamet.ee",
    contactEmail: "",
    contactPhone: "",
    notes: "Avalik asutus, mille teemalehed voivad olla kas organisatsioonina hallatavad voi dokumentide allikaloogikasse seotud.",
    fileCount: 0,
    crawlReadiness: "PLANNED"
  },
  {
    slug: "peaasi",
    displayName: "Peaasi.ee",
    type: "THEMATIC_SITE",
    focus: "Vaimne tervis",
    county: "Uleriigiline",
    isActive: true,
    officialWebsite: "https://peaasi.ee",
    contactEmail: "",
    contactPhone: "",
    notes: "Oluline teemaveeb, mis voib vajada eraldi teadmistebaasi haldusloogikat.",
    fileCount: 0,
    crawlReadiness: "REVIEW"
  }
]);

export function listOrganizationSeedEntries() {
  return ORGANIZATION_SEED.map(item => ({ ...item }));
}

export function findOrganizationSeedEntry(slug) {
  const normalized = String(slug || "").trim().toLowerCase();
  if (!normalized) return null;
  return ORGANIZATION_SEED.find(item => item.slug === normalized) || null;
}
