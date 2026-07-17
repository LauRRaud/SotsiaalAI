import { buildWellbeingAggregateDataset } from "./aggregate.js";

const CSV_HEADERS = [
  "metricKey",
  "metricValue",
  "sampleSize",
  "aggregationLevel",
  "exportEligible"
];

export function csvCell(value) {
  const rawText = value == null ? "" : String(value);
  const text = typeof value === "number"
    ? rawText
    : /^[ \t]*[=+\-@]/.test(rawText)
      ? `'${rawText}`
      : rawText;
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function buildWellbeingExportDataset(filters = {}, options = {}) {
  const aggregate = await buildWellbeingAggregateDataset(filters, options);
  return {
    exportType: "wellbeing_aggregate",
    ...aggregate
  };
}

export function exportWellbeingCsv(dataset = {}) {
  const rows = [CSV_HEADERS.join(",")];
  for (const metric of dataset.metrics || []) {
    rows.push(CSV_HEADERS.map((header) => csvCell(metric[header])).join(","));
  }
  return `${rows.join("\n")}\n`;
}

export function exportWellbeingJson(dataset = {}) {
  return JSON.stringify(dataset, null, 2);
}
