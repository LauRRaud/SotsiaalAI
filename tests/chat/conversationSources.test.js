import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeSources
} from "../../components/chat/utils/sources.js";

import {
  collectConversationSources,
  collectLatestAnswerSources
} from "../../components/chat/hooks/useConversationSources.js";

test("source panel collectors prefer displayed_sources over legacy sources", () => {
  const messages = [
    {
      role: "user",
      text: "Kuidas taotleda koduteenust Tartus?"
    },
    {
      role: "assistant",
      text: "Koduteenuse taotlemiseks pöördu Tartu linna poole.",
      displayed_sources: [
        {
          id: "tartu-koduteenus",
          title: "Koduteenus",
          sourceType: "rag:kov_service_info",
          url: "https://tartu.ee/koduteenus"
        }
      ],
      sources: [
        {
          id: "retrieved-noise",
          title: "Koduteenuse üldine artikkel",
          sourceType: "rag:journal_article",
          url: "https://example.test/artikkel"
        }
      ]
    }
  ];

  const conversationSources = collectConversationSources(messages);
  const latestSources = collectLatestAnswerSources(messages);

  assert.equal(conversationSources.length, 1);
  assert.equal(latestSources.length, 1);
  assert.equal(conversationSources[0].key, "tartu-koduteenus");
  assert.equal(latestSources[0].key, "tartu-koduteenus");
});

test("source panel collectors keep known RAG source types without urls", () => {
  const messages = [
    {
      role: "user",
      text: "Mis on koduteenuse õiguslik alus?"
    },
    {
      role: "assistant",
      text: "Koduteenuse õiguslik alus tuleb sotsiaalhoolekande seadusest.",
      displayed_sources: [
        {
          source_id: "shs-koduteenus",
          title: "Sotsiaalhoolekande seadus",
          source_type: "national_law"
        },
        {
          source_id: "tartu-koduteenus",
          title: "Koduteenus",
          sourceType: "kov_service_info"
        }
      ]
    }
  ];

  const conversationSources = collectConversationSources(messages);
  const latestSources = collectLatestAnswerSources(messages);

  assert.equal(conversationSources.length, 2);
  assert.equal(latestSources.length, 2);
  assert.deepEqual(conversationSources.map(source => source.key), [
    "shs-koduteenus",
    "tartu-koduteenus"
  ]);
});

test("source panel collectors keep municipality_kov sources without urls", () => {
  const normalizedSources = normalizeSources([
    {
      id: "viljandi-municipality-kov-koduteenus",
      title: "Koduteenus",
      source_type: "municipality_kov"
    }
  ]);

  const latestSources = collectLatestAnswerSources([
    {
      role: "user",
      text: "viljandi vallas pakutakse koduteenust?"
    },
    {
      role: "assistant",
      text: "Jah, Viljandi vallas pakutakse koduteenust.",
      sources: normalizedSources
    }
  ]);

  assert.equal(latestSources.length, 1);
  assert.equal(latestSources[0].key, "viljandi-municipality-kov-koduteenus");
});

test("source panel collectors expose canonical and official URL aliases", () => {
  const latestSources = collectLatestAnswerSources([
    {
      role: "user",
      text: "Kas Kuusalu vallas pakutakse koduteenust?"
    },
    {
      role: "assistant",
      text: "Jah, Kuusalu vallas pakutakse koduteenust.",
      displayed_sources: [
        {
          source_id: "kuusalu-koduteenus",
          title: "Koduteenus",
          source_type: "kov_service_info",
          url_canonical: "https://www.kuusalu.ee/koduteenus"
        },
        {
          source_id: "kuusalu-contact",
          title: "Kontakt",
          source_type: "contact_page",
          officialUrl: "https://www.kuusalu.ee/kontakt"
        },
        {
          source_id: "organization-astangu",
          title: "Astangu Kutserehabilitatsiooni Keskus",
          source_type: "organization_profile",
          official_website: "https://www.astangu.ee"
        }
      ]
    }
  ]);

  assert.equal(latestSources.length, 3);
  assert.deepEqual(latestSources.map(source => source.allUrls[0]), [
    "https://www.kuusalu.ee/koduteenus",
    "https://www.kuusalu.ee/kontakt",
    "https://www.astangu.ee"
  ]);
});

test("source panel collectors separate latest answer from whole conversation", () => {
  const messages = [
    {
      role: "user",
      text: "Mida räägib AI artikkel?"
    },
    {
      role: "assistant",
      text: "Artikkel räägib tehisintellekti kasutamisest sotsiaaltöös.",
      displayed_sources: [
        {
          source_id: "ai-article",
          title: "Tehisintellekt sotsiaaltöös",
          source_type: "journal_article"
        }
      ]
    },
    {
      role: "user",
      text: "Kuidas Jõgeva vallas koduteenust taotleda?"
    },
    {
      role: "assistant",
      text: "Koduteenust saab taotleda sotsiaalabi taotluse blanketil.",
      displayed_sources: [
        {
          source_id: "jogeva-koduteenus",
          title: "Koduteenus",
          source_type: "kov_service_info"
        }
      ]
    }
  ];

  const conversationSources = collectConversationSources(messages);
  const latestSources = collectLatestAnswerSources(messages);

  assert.deepEqual(conversationSources.map(source => source.key), [
    "ai-article",
    "jogeva-koduteenus"
  ]);
  assert.deepEqual(latestSources.map(source => source.key), [
    "jogeva-koduteenus"
  ]);
});

test("source panel collectors still exclude uploaded document sources", () => {
  const messages = [
    {
      role: "assistant",
      text: "Faili põhjal...",
      displayed_sources: [
        {
          title: "Kasutaja fail",
          fileName: "juhtum.pdf",
          sourceType: "upload"
        },
        {
          source_id: "methodology",
          title: "Metoodikajuhend",
          source_type: "methodology_guide"
        }
      ]
    }
  ];

  const conversationSources = collectConversationSources(messages, {
    fileName: "juhtum.pdf"
  });

  assert.equal(conversationSources.length, 1);
  assert.equal(conversationSources[0].key, "methodology");
});

test("normalizeSources preserves source focus ids for follow-up retrieval", () => {
  const normalized = normalizeSources([
    {
      source_id: "source-ai-2025",
      doc_id: "doc-ai-2025",
      document_id: "document-ai-2025",
      chunk_id: "chunk-ai-001",
      canonical_item_id: "article-ai-2025",
      title: "Tehisintellekt sotsiaaltöös",
      source_type: "journal_article"
    }
  ]);

  assert.equal(normalized[0].key, "source-ai-2025");
  assert.equal(normalized[0].source_id, "source-ai-2025");
  assert.equal(normalized[0].doc_id, "doc-ai-2025");
  assert.equal(normalized[0].document_id, "document-ai-2025");
  assert.equal(normalized[0].chunk_id, "chunk-ai-001");
  assert.equal(normalized[0].canonical_item_id, "article-ai-2025");
});
