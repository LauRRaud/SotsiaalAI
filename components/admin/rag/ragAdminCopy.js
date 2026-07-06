function isEstonian(locale) {
  return String(locale || "").toLowerCase().startsWith("et");
}

export function getRagAdminCopy(locale) {
  if (isEstonian(locale)) {
    return {
      heading: "RAG",
      subtitle: "Halda teadmistebaasi dokumente, sisestusvooge, KOV-e ja organisatsioone ühes admin-keskkonnas.",
      nav: {
        home: "Töölaud",
        documents: "Dokumendid",
        ingest: "Sisestus",
        kov: "KOV",
        organizations: "Organisatsioonid",
        sourcePackages: "Lähtepaketid"
      },
      landing: {
        title: "Töölaud",
        subtitle: "Halda RAG teadmistebaasi nelja põhisuuna kaudu: dokumentide haldus, käsitsi sisestus, kohalike omavalitsuste erihaldus ja organisatsioonide erihaldus.",
        cards: [
          {
            href: "/admin/rag/documents",
            title: "Dokumendid",
            body: "Laiem dokumentide haldusala registri, allikaloogika ja dokumentidega seotud seadistuste jaoks.",
            cta: "Ava dokumentide haldus"
          },
          {
            href: "/admin/rag/ingest",
            title: "Sisestus",
            body: "Käsitsi sisestuse töölaud URL-ide, PDF-ide, metaandmete, artiklite ja muude allikavoogude jaoks.",
            cta: "Ava sisestus"
          },
          {
            href: "/admin/rag/kov",
            title: "KOV haldus",
            body: "Halda kohalike omavalitsuste linke, failide seisu ja valmisolekut järgmisteks sammudeks. Korje toimub praegu väljaspool platvormi.",
            cta: "Ava KOV admin"
          },
          {
            href: "/admin/rag/organizations",
            title: "Organisatsioonid",
            body: "Halda MTÜ-sid, sihtasutusi, teenuseosutajaid, partnereid ja olulisi teemaveebe eraldi admin-vaates.",
            cta: "Ava organisatsioonid"
          },
          {
            href: "/admin/rag/source-packages",
            title: "Lähtepaketid",
            body: "Vaata SourcePackage'i hetktõmmiseid, puuduvaid jaotisi ja ülevaatuse seisu.",
            cta: "Ava lähtepaketid"
          }
        ],
        notesTitle: "Märkused",
        notes: [
          "Backend endpointid jäävad samaks ja kõik route'id kasutavad olemasolevat /api/rag proxy kihti.",
          "Documents vaade keskendub registrile ja detailvaatele.",
          "Sisestuse vaade koondab kõik allikavood ja metaandmete mallid ühte kohta."
        ]
      },
      pages: {
        documents: {
          title: "Dokumentide haldus",
          subtitle: "Dokumentide register, allikaloogika ja dokumendihalduse seaded peavad siia mahtuma ühe laiema haldusala osadena."
        },
        ingest: {
          title: "Sisestuse töölaud",
          subtitle: "Käsitsi sisestuse töölaud URL-ide, PDF-ide, artiklite ja muude allikavoogude jaoks."
        },
        kov: {
          title: "KOV haldus",
          subtitle: "Halda käsitsi kogutud KOV andmeid, linke, failide seisu ja valmisolekut järgmisteks sammudeks."
        },
        organizations: {
          title: "Organisatsioonide haldus",
          subtitle: "Halda organisatsioone, teenuseosutajaid, partnereid ja olulisi veebiallikaid eraldi RAG admini põhiosana."
        },
        sourcePackages: {
          title: "Lähtepakettide ülevaatus",
          subtitle: "Vaata salvestatud SourcePackage'i hetktõmmiseid, ülevaatuse märke ja vajalikke toiminguid."
        }
      },
      kov: {
        searchPlaceholder: "Otsi KOV nime, slugi või märksõna järgi"
      }
    };
  }

  return {
    heading: "RAG",
      subtitle: "Manage documents, ingest flows, municipalities, and organizations in one admin workspace.",
    nav: {
      home: "Workspace",
      documents: "Documents",
      ingest: "Ingest",
      kov: "Municipal",
      organizations: "Organizations",
      sourcePackages: "Source packages"
    },
      landing: {
        title: "Workspace",
        subtitle: "Manage the RAG knowledge base through four core areas: document management, manual ingest, municipal admin, and organization admin.",
      cards: [
        {
          href: "/admin/rag/documents",
          title: "Documents",
          body: "A broader document management area for the registry, source logic, and document-related settings.",
          cta: "Open documents"
        },
        {
          href: "/admin/rag/ingest",
          title: "Ingest",
          body: "Manual ingest workspace for URLs, PDF plus metadata, article imports, and related tools.",
          cta: "Open ingest"
        },
        {
          href: "/admin/rag/kov",
          title: "Municipal admin",
          body: "Manage municipality links, file status, and next-step readiness for manually collected datasets. Collection still happens outside the platform.",
          cta: "Open municipal admin"
        },
        {
          href: "/admin/rag/organizations",
          title: "Organizations",
          body: "Manage NGOs, foundations, service providers, partners, and important thematic websites in a dedicated admin area.",
          cta: "Open organizations"
        },
        {
          href: "/admin/rag/source-packages",
          title: "Source packages",
          body: "Review SourcePackage snapshots, missing sections, and review status.",
          cta: "Open source packages"
        }
      ],
      notesTitle: "Notes",
      notes: [
        "Backend endpoints stay unchanged and all routes continue to use the existing /api/rag proxy layer.",
        "The documents view focuses on the registry and detail workflow.",
        "The ingest view brings all upload flows and metadata templates into one place."
      ]
    },
    pages: {
      documents: {
        title: "Document management",
        subtitle: "This area should grow beyond a registry into source logic and document-management settings."
      },
      ingest: {
        title: "Ingest workspace",
        subtitle: "Manual workspace for bringing new sources into RAG through the existing ingest flows."
      },
      kov: {
        title: "Municipal admin",
        subtitle: "Manage manually collected municipal data, links, file status, and readiness for the next steps."
      },
      organizations: {
        title: "Organization admin",
        subtitle: "Manage organizations, service providers, partners, and important source websites as a separate RAG admin domain."
      },
      sourcePackages: {
        title: "SourcePackage review",
        subtitle: "Inspect persisted SourcePackage snapshots, review flags, and minimal review actions."
      }
    },
    kov: {
      searchPlaceholder: "Search by municipality name, slug, or keyword"
    }
  };
}
