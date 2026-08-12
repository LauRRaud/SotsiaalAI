import { buildWellbeingAggregateDataset } from "./aggregate.js";

/* SOL-WB-04: CSV on kõige paljam kuju, mis platvormilt välja läheb — pärast
   avamist on tal ainult veerupealkirjad. Vana kogum andis `metricValue` kõrvale
   ainult `sampleSize` (INIMESTE arvu), seega tabelis oli lugejal täpselt see
   sisend, millest sünnib „100/3 = 3333%". Nimetaja ja analüüsiühik käivad nüüd
   IGA REAGA kaasa: tabelis sorteeritakse ja filtreeritakse, seega päisekommentaar
   või eraldi metaandmete plokk kaoks esimese sortimisega. */
const CSV_HEADERS = [
  "metricKey",
  "metricValue",
  "denominator",
  "sampleSize",
  "analysisUnit",
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
  const analysisUnit =
    dataset.analysisUnit === "latest_per_person" ? "latest_per_person" : "record";
  const rows = [CSV_HEADERS.join(",")];
  for (const metric of dataset.metrics || []) {
    rows.push(
      CSV_HEADERS.map((header) => {
        if (header === "analysisUnit") return csvCell(metric.analysisUnit ?? analysisUnit);
        /* Nimetajata rida on siin see viga: ilma temata jääb `sampleSize` ainsaks
           arvuks, mille vastu `metricValue` jagada annab. */
        if (header === "denominator") {
          return csvCell(metric.denominator ?? dataset.countedRecordCount ?? metric.sampleSize);
        }
        return csvCell(metric[header]);
      }).join(",")
    );
  }
  return `${rows.join("\n")}\n`;
}

export function exportWellbeingJson(dataset = {}) {
  return JSON.stringify(dataset, null, 2);
}
