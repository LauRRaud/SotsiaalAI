# RAG-QM-P0 privaatsuskindel kvaliteedi baasjoon

Ämbrijaotus põhineb sünteetilisel valimil; produktsiooni-jaotus kinnitamata (Lisa A.3).

## Ulatus

- Ajavahemik: `2026-07-01T00:00:00.000Z` kuni `2026-07-03T00:00:00.000Z` (lõpp välistatud)
- Allikas: `sanitized_fixture`
- Minimaalne avaldatav rühm: `20`
- Andmeräsi: `ac8f12a6d72c2c5b285131e3c4a4ba1aba25e7666a4909835b278e1b92aab92b`

## Ohutud koondloendurid

| Mõõdik | Tulemus |
|---|---:|
| `event_records` | 159 |
| `unique_users` | 40 |
| `rag_trace_records` | 79 |
| `rag_search_records` | 40 |
| `no_external_source_events` | 20 |
| `crisis_detected_events` | 20 |
| `hybrid_trace_records` | 40 |

## Määrad

| Mõõdik | Staatus | Määr |
|---|---|---:|
| `zero_result_search_rate` | reported | 0.5 |
| `no_external_source_rate` | reported | 0.333333 |
| `subset_selected_violation_rate` | reported | 0.253165 |
| `subset_answer_violation_rate` | reported | 0.253165 |
| `selected_without_display_rate` | reported | 0.253165 |
| `package_aware_use_rate` | reported | 0.253165 |
| `crisis_detected_rate` | reported | 0.333333 |

## Mõõdetavusaugud

- `coverage_retrieval_split`: unmeasurable
- `lifecycle_gap_rate`: unmeasurable
- `answer_outcome`: unmeasurable
- `retrieval_latency`: unmeasurable
- `production_bucket_split`: unconfirmed
- `golden_live_run`: not_run

## Kanooniline raportiandmestik

JSON- ja Markdown-väljund on loodud samast valideeritud objektist; allolev plokk on JSON-faili täpne sisu.

```json
{
  "schema_version": "rag-qm-p0-baseline-v1",
  "generated_at": "2026-07-15T12:00:00.000Z",
  "interval": {
    "from": "2026-07-01T00:00:00.000Z",
    "to": "2026-07-03T00:00:00.000Z",
    "semantics": "from_inclusive_to_exclusive"
  },
  "source": "sanitized_fixture",
  "privacy_notice": "Ämbrijaotus põhineb sünteetilisel valimil; produktsiooni-jaotus kinnitamata (Lisa A.3).",
  "used_fields": [
    "ChatLog.event",
    "ChatLog.createdAt",
    "ChatLog.role",
    "ChatLog.userId (COUNT DISTINCT only)",
    "rag_trace.retrieved_count",
    "rag_trace.selected_context_count",
    "rag_trace.selected_source_count",
    "rag_trace.answer_source_count",
    "rag_trace.displayed_source_count",
    "rag_trace.filtered_out_source_count",
    "rag_trace.displayed_sources_subset_of_selected",
    "rag_trace.displayed_sources_subset_of_answer",
    "rag_trace.package_aware_answering_used",
    "rag_trace.query_plan.mode",
    "rag_trace.retrieval_trace_level",
    "rag_trace.rag_risk_level",
    "rag_trace.retrievers_used",
    "rag_trace.hybrid_retrieval.merge_strategy.strategy",
    "rag_trace.hybrid_retrieval.channel_counts",
    "rag_search.ragMatchCount",
    "rag_search.chosenGroupCount",
    "rag_search.retrieversUsed",
    "rag_search.ragRiskLevel",
    "rag_search.queryPlanMode",
    "chat_no_external_sources.messageLength",
    "chat_no_external_sources.ragRiskLevel"
  ],
  "privacy": {
    "minimum_group_size": 20,
    "output_validated": true,
    "temp_files_created": 0,
    "raw_conversations_read": 0,
    "database_writes": 0,
    "external_services_used": 0
  },
  "metrics": {
    "counts": [
      {
        "metric": "event_records",
        "measurement": {
          "status": "reported",
          "count": 159,
          "minimum_group_size": 20
        }
      },
      {
        "metric": "unique_users",
        "measurement": {
          "status": "reported",
          "count": 40,
          "minimum_group_size": 20
        }
      },
      {
        "metric": "rag_trace_records",
        "measurement": {
          "status": "reported",
          "count": 79,
          "minimum_group_size": 20
        }
      },
      {
        "metric": "rag_search_records",
        "measurement": {
          "status": "reported",
          "count": 40,
          "minimum_group_size": 20
        }
      },
      {
        "metric": "no_external_source_events",
        "measurement": {
          "status": "reported",
          "count": 20,
          "minimum_group_size": 20
        }
      },
      {
        "metric": "crisis_detected_events",
        "measurement": {
          "status": "reported",
          "count": 20,
          "minimum_group_size": 20
        }
      },
      {
        "metric": "hybrid_trace_records",
        "measurement": {
          "status": "reported",
          "count": 40,
          "minimum_group_size": 20
        }
      }
    ],
    "rates": [
      {
        "metric": "zero_result_search_rate",
        "status": "reported",
        "numerator": {
          "status": "reported",
          "count": 20,
          "minimum_group_size": 20
        },
        "denominator": {
          "status": "reported",
          "count": 40,
          "minimum_group_size": 20
        },
        "rate": 0.5
      },
      {
        "metric": "no_external_source_rate",
        "status": "reported",
        "numerator": {
          "status": "reported",
          "count": 20,
          "minimum_group_size": 20
        },
        "denominator": {
          "status": "reported",
          "count": 60,
          "minimum_group_size": 20
        },
        "rate": 0.333333
      },
      {
        "metric": "subset_selected_violation_rate",
        "status": "reported",
        "numerator": {
          "status": "reported",
          "count": 20,
          "minimum_group_size": 20
        },
        "denominator": {
          "status": "reported",
          "count": 79,
          "minimum_group_size": 20
        },
        "rate": 0.253165
      },
      {
        "metric": "subset_answer_violation_rate",
        "status": "reported",
        "numerator": {
          "status": "reported",
          "count": 20,
          "minimum_group_size": 20
        },
        "denominator": {
          "status": "reported",
          "count": 79,
          "minimum_group_size": 20
        },
        "rate": 0.253165
      },
      {
        "metric": "selected_without_display_rate",
        "status": "reported",
        "numerator": {
          "status": "reported",
          "count": 20,
          "minimum_group_size": 20
        },
        "denominator": {
          "status": "reported",
          "count": 79,
          "minimum_group_size": 20
        },
        "rate": 0.253165
      },
      {
        "metric": "package_aware_use_rate",
        "status": "reported",
        "numerator": {
          "status": "reported",
          "count": 20,
          "minimum_group_size": 20
        },
        "denominator": {
          "status": "reported",
          "count": 79,
          "minimum_group_size": 20
        },
        "rate": 0.253165
      },
      {
        "metric": "crisis_detected_rate",
        "status": "reported",
        "numerator": {
          "status": "reported",
          "count": 20,
          "minimum_group_size": 20
        },
        "denominator": {
          "status": "reported",
          "count": 60,
          "minimum_group_size": 20
        },
        "rate": 0.333333
      }
    ],
    "numeric_summaries": [
      {
        "metric": "retrieved_count",
        "status": "reported",
        "records": {
          "status": "reported",
          "count": 79,
          "minimum_group_size": 20
        },
        "total": 199,
        "average": 2.518987
      },
      {
        "metric": "selected_context_count",
        "status": "reported",
        "records": {
          "status": "reported",
          "count": 79,
          "minimum_group_size": 20
        },
        "total": 99,
        "average": 1.253165
      },
      {
        "metric": "selected_source_count",
        "status": "reported",
        "records": {
          "status": "reported",
          "count": 79,
          "minimum_group_size": 20
        },
        "total": 99,
        "average": 1.253165
      },
      {
        "metric": "answer_source_count",
        "status": "reported",
        "records": {
          "status": "reported",
          "count": 79,
          "minimum_group_size": 20
        },
        "total": 59,
        "average": 0.746835
      },
      {
        "metric": "displayed_source_count",
        "status": "reported",
        "records": {
          "status": "reported",
          "count": 79,
          "minimum_group_size": 20
        },
        "total": 59,
        "average": 0.746835
      },
      {
        "metric": "filtered_out_source_count",
        "status": "reported",
        "records": {
          "status": "reported",
          "count": 79,
          "minimum_group_size": 20
        },
        "total": 20,
        "average": 0.253165
      },
      {
        "metric": "rag_match_count",
        "status": "reported",
        "records": {
          "status": "reported",
          "count": 40,
          "minimum_group_size": 20
        },
        "total": 60,
        "average": 1.5
      },
      {
        "metric": "chosen_group_count",
        "status": "reported",
        "records": {
          "status": "reported",
          "count": 40,
          "minimum_group_size": 20
        },
        "total": 40,
        "average": 1
      },
      {
        "metric": "message_length",
        "status": "reported",
        "records": {
          "status": "reported",
          "count": 20,
          "minimum_group_size": 20
        },
        "total": 480,
        "average": 24
      }
    ],
    "distributions": [
      {
        "dimension": "events",
        "groups": [
          {
            "value": "chat_no_external_sources",
            "measurement": {
              "status": "reported",
              "count": 20,
              "minimum_group_size": 20
            }
          },
          {
            "value": "crisis_detected",
            "measurement": {
              "status": "reported",
              "count": 20,
              "minimum_group_size": 20
            }
          },
          {
            "value": "rag_search",
            "measurement": {
              "status": "reported",
              "count": 40,
              "minimum_group_size": 20
            }
          },
          {
            "value": "rag_trace",
            "measurement": {
              "status": "reported",
              "count": 79,
              "minimum_group_size": 20
            }
          }
        ]
      },
      {
        "dimension": "event_roles",
        "groups": [
          {
            "value": "CLIENT",
            "measurement": {
              "status": "reported",
              "count": 80,
              "minimum_group_size": 20
            }
          },
          {
            "value": "SOCIAL_WORKER",
            "measurement": {
              "status": "reported",
              "count": 60,
              "minimum_group_size": 20
            }
          },
          {
            "value": "SYNTHETIC_RARE",
            "measurement": {
              "status": "suppressed",
              "count": null,
              "minimum_group_size": 20
            }
          }
        ]
      },
      {
        "dimension": "trace_planner_modes",
        "groups": [
          {
            "value": "legal_exact",
            "measurement": {
              "status": "reported",
              "count": 20,
              "minimum_group_size": 20
            }
          },
          {
            "value": "life_situation_guidance",
            "measurement": {
              "status": "reported",
              "count": 20,
              "minimum_group_size": 20
            }
          },
          {
            "value": "overview_synthesis",
            "measurement": {
              "status": "reported",
              "count": 20,
              "minimum_group_size": 20
            }
          },
          {
            "value": "rare_mode",
            "measurement": {
              "status": "suppressed",
              "count": null,
              "minimum_group_size": 20
            }
          }
        ]
      },
      {
        "dimension": "search_planner_modes",
        "groups": [
          {
            "value": "legal_exact",
            "measurement": {
              "status": "reported",
              "count": 20,
              "minimum_group_size": 20
            }
          },
          {
            "value": "life_situation_guidance",
            "measurement": {
              "status": "reported",
              "count": 20,
              "minimum_group_size": 20
            }
          }
        ]
      },
      {
        "dimension": "trace_risk_levels",
        "groups": [
          {
            "value": "high",
            "measurement": {
              "status": "reported",
              "count": 20,
              "minimum_group_size": 20
            }
          },
          {
            "value": "medium",
            "measurement": {
              "status": "reported",
              "count": 40,
              "minimum_group_size": 20
            }
          },
          {
            "value": "rare",
            "measurement": {
              "status": "suppressed",
              "count": null,
              "minimum_group_size": 20
            }
          }
        ]
      },
      {
        "dimension": "search_risk_levels",
        "groups": [
          {
            "value": "high",
            "measurement": {
              "status": "reported",
              "count": 20,
              "minimum_group_size": 20
            }
          },
          {
            "value": "medium",
            "measurement": {
              "status": "reported",
              "count": 20,
              "minimum_group_size": 20
            }
          }
        ]
      },
      {
        "dimension": "no_source_risk_levels",
        "groups": [
          {
            "value": "low",
            "measurement": {
              "status": "reported",
              "count": 20,
              "minimum_group_size": 20
            }
          }
        ]
      },
      {
        "dimension": "trace_retrievers",
        "groups": [
          {
            "value": "bm25",
            "measurement": {
              "status": "reported",
              "count": 40,
              "minimum_group_size": 20
            }
          },
          {
            "value": "dense",
            "measurement": {
              "status": "reported",
              "count": 60,
              "minimum_group_size": 20
            }
          },
          {
            "value": "rare_channel",
            "measurement": {
              "status": "suppressed",
              "count": null,
              "minimum_group_size": 20
            }
          }
        ]
      },
      {
        "dimension": "search_retrievers",
        "groups": [
          {
            "value": "bm25",
            "measurement": {
              "status": "reported",
              "count": 20,
              "minimum_group_size": 20
            }
          },
          {
            "value": "dense",
            "measurement": {
              "status": "reported",
              "count": 40,
              "minimum_group_size": 20
            }
          }
        ]
      },
      {
        "dimension": "retrieval_trace_levels",
        "groups": [
          {
            "value": "retrieved_candidates",
            "measurement": {
              "status": "reported",
              "count": 60,
              "minimum_group_size": 20
            }
          },
          {
            "value": "selected_context_sources",
            "measurement": {
              "status": "suppressed",
              "count": null,
              "minimum_group_size": 20
            }
          }
        ]
      },
      {
        "dimension": "hybrid_strategies",
        "groups": [
          {
            "value": "weighted_hybrid_rrf",
            "measurement": {
              "status": "reported",
              "count": 40,
              "minimum_group_size": 20
            }
          }
        ]
      },
      {
        "dimension": "hybrid_channels",
        "groups": [
          {
            "value": "bm25",
            "measurement": {
              "status": "reported",
              "count": 40,
              "minimum_group_size": 20
            }
          },
          {
            "value": "dense",
            "measurement": {
              "status": "reported",
              "count": 40,
              "minimum_group_size": 20
            }
          }
        ]
      },
      {
        "dimension": "days",
        "groups": [
          {
            "value": "2026-07-01",
            "measurement": {
              "status": "reported",
              "count": 60,
              "minimum_group_size": 20
            }
          },
          {
            "value": "2026-07-02",
            "measurement": {
              "status": "reported",
              "count": 99,
              "minimum_group_size": 20
            }
          }
        ]
      }
    ]
  },
  "classification": {
    "status": "not_run",
    "golden_37": "not_run",
    "catalog_35": "not_run",
    "allowed_reference_count": 72,
    "bucket_distribution": null
  },
  "coverage_gaps": [
    {
      "metric": "coverage_retrieval_split",
      "status": "unmeasurable"
    },
    {
      "metric": "lifecycle_gap_rate",
      "status": "unmeasurable"
    },
    {
      "metric": "answer_outcome",
      "status": "unmeasurable"
    },
    {
      "metric": "retrieval_latency",
      "status": "unmeasurable"
    },
    {
      "metric": "production_bucket_split",
      "status": "unconfirmed"
    },
    {
      "metric": "golden_live_run",
      "status": "not_run"
    }
  ],
  "integrity": {
    "data_sha256": "ac8f12a6d72c2c5b285131e3c4a4ba1aba25e7666a4909835b278e1b92aab92b"
  }
}
```
