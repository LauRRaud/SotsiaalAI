import { prisma } from "@/lib/prisma";

const MB = 1024n * 1024n;
const GB = 1024n * MB;

export const USAGE_PLAN_SEEDS = Object.freeze([
  {
    id: "plan_free_v1",
    key: "free",
    name: "Tasuta",
    role: "CLIENT",
    price: "0.00",
    currency: "EUR",
    version: 1,
    entitlements: []
  },
  {
    id: "plan_client_v1",
    key: "client_monthly",
    name: "Pöörduja",
    role: "CLIENT",
    price: "7.99",
    currency: "EUR",
    version: 1,
    entitlements: [
      entitlement("ent_client_chat_v1", "CHAT_ASSISTANT_REPLY", "MONTHLY", 150n, 120n),
      entitlement("ent_client_document_v1", "DOCUMENT_GENERATE", "WEEKLY", 2n),
      entitlement("ent_client_refine_v1", "DOCUMENT_REFINE", "WEEKLY", 6n),
      entitlement("ent_client_analyze_v1", "FILE_ANALYZE", "WEEKLY", 4n),
      entitlement("ent_client_research_v1", "DEEP_RESEARCH_RUN", "MONTHLY", 2n),
      entitlement("ent_client_rag_v1", "RAG_SEARCH", "MONTHLY", 2000n),
      entitlement("ent_client_stt_v1", "STT_SECONDS", "MONTHLY", 900n),
      entitlement("ent_client_tts_v1", "TTS_CHARS", "MONTHLY", 50_000n),
      entitlement("ent_client_storage_v1", "STORAGE_BYTES", "LIFETIME", 50n * MB)
    ]
  },
  {
    id: "plan_social_worker_v1",
    key: "social_worker_monthly",
    name: "Spetsialist",
    role: "SOCIAL_WORKER",
    price: "14.99",
    currency: "EUR",
    version: 1,
    entitlements: [
      entitlement("ent_worker_chat_v1", "CHAT_ASSISTANT_REPLY", "MONTHLY", 360n, 300n),
      entitlement("ent_worker_document_v1", "DOCUMENT_GENERATE", "WEEKLY", 4n),
      entitlement("ent_worker_refine_v1", "DOCUMENT_REFINE", "WEEKLY", 12n),
      entitlement("ent_worker_analyze_v1", "FILE_ANALYZE", "WEEKLY", 10n),
      entitlement("ent_worker_research_v1", "DEEP_RESEARCH_RUN", "MONTHLY", 6n),
      entitlement("ent_worker_rag_v1", "RAG_SEARCH", "MONTHLY", 5000n),
      entitlement("ent_worker_stt_v1", "STT_SECONDS", "MONTHLY", 3600n),
      entitlement("ent_worker_tts_v1", "TTS_CHARS", "MONTHLY", 150_000n),
      entitlement("ent_worker_storage_v1", "STORAGE_BYTES", "LIFETIME", 100n * MB)
    ]
  },
  {
    id: "plan_service_provider_v1",
    key: "service_provider_monthly",
    name: "Teenuseosutaja",
    role: "SERVICE_PROVIDER",
    price: "19.99",
    currency: "EUR",
    version: 1,
    entitlements: [
      entitlement("ent_provider_chat_v1", "CHAT_ASSISTANT_REPLY", "MONTHLY", 750n, 600n),
      entitlement("ent_provider_document_v1", "DOCUMENT_GENERATE", "WEEKLY", 8n),
      entitlement("ent_provider_refine_v1", "DOCUMENT_REFINE", "WEEKLY", 24n),
      entitlement("ent_provider_analyze_v1", "FILE_ANALYZE", "WEEKLY", 20n),
      entitlement("ent_provider_research_v1", "DEEP_RESEARCH_RUN", "MONTHLY", 12n),
      entitlement("ent_provider_rag_v1", "RAG_SEARCH", "MONTHLY", 10_000n),
      entitlement("ent_provider_stt_v1", "STT_SECONDS", "MONTHLY", 7200n),
      entitlement("ent_provider_tts_v1", "TTS_CHARS", "MONTHLY", 300_000n),
      entitlement("ent_provider_storage_v1", "STORAGE_BYTES", "LIFETIME", 150n * MB)
    ]
  },
  {
    id: "plan_admin_internal_v1",
    key: "admin_internal",
    name: "Admin internal",
    role: "ADMIN",
    price: "0.00",
    currency: "EUR",
    version: 1,
    entitlements: [
      entitlement("ent_admin_chat_v1", "CHAT_ASSISTANT_REPLY", "MONTHLY", 5000n, 4000n),
      entitlement("ent_admin_document_v1", "DOCUMENT_GENERATE", "WEEKLY", 200n),
      entitlement("ent_admin_refine_v1", "DOCUMENT_REFINE", "WEEKLY", 600n),
      entitlement("ent_admin_analyze_v1", "FILE_ANALYZE", "WEEKLY", 500n),
      entitlement("ent_admin_research_v1", "DEEP_RESEARCH_RUN", "MONTHLY", 100n),
      entitlement("ent_admin_rag_v1", "RAG_SEARCH", "MONTHLY", 50_000n),
      entitlement("ent_admin_stt_v1", "STT_SECONDS", "MONTHLY", 36_000n),
      entitlement("ent_admin_tts_v1", "TTS_CHARS", "MONTHLY", 1_000_000n),
      entitlement("ent_admin_storage_v1", "STORAGE_BYTES", "LIFETIME", 10n * GB)
    ]
  }
]);

function entitlement(id, metric, period, hardLimit, softLimit = null) {
  return Object.freeze({ id, metric, period, hardLimit, softLimit, enabled: true });
}

export async function seedUsagePlans(db = prisma) {
  let entitlementCount = 0;

  for (const plan of USAGE_PLAN_SEEDS) {
    const savedPlan = await db.planDefinition.upsert({
      where: { key_version: { key: plan.key, version: plan.version } },
      create: {
        id: plan.id,
        key: plan.key,
        name: plan.name,
        role: plan.role,
        price: plan.price,
        currency: plan.currency,
        version: plan.version,
        active: true
      },
      update: {
        name: plan.name,
        role: plan.role,
        price: plan.price,
        currency: plan.currency,
        active: true
      }
    });

    for (const item of plan.entitlements) {
      await db.planEntitlement.upsert({
        where: {
          planDefinitionId_metric: {
            planDefinitionId: savedPlan.id,
            metric: item.metric
          }
        },
        create: {
          ...item,
          planDefinitionId: savedPlan.id
        },
        update: {
          enabled: item.enabled,
          softLimit: item.softLimit,
          hardLimit: item.hardLimit,
          period: item.period
        }
      });
      entitlementCount += 1;
    }
  }

  return {
    planCount: USAGE_PLAN_SEEDS.length,
    entitlementCount
  };
}
