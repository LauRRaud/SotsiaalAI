const RELATION = String.raw`(?:(?:"[^"]+")\s*\.\s*)?"([^"]+)"`;

export function classifyMigrationStatements(sql) {
  const statements = String(sql)
    .replace(/--[^\n]*/g, " ")
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const risks = [];

  for (const statement of statements) {
    const rules = [
      { kind: "nonconcurrent_index", pattern: new RegExp(String.raw`CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!CONCURRENTLY\b)[\s\S]*?\sON\s+${RELATION}`, "i") },
      { kind: "alter_column_type", pattern: new RegExp(String.raw`ALTER\s+TABLE\s+${RELATION}[\s\S]*?ALTER\s+COLUMN[\s\S]*?\sTYPE\s`, "i") },
      { kind: "set_not_null", pattern: new RegExp(String.raw`ALTER\s+TABLE\s+${RELATION}[\s\S]*?ALTER\s+COLUMN[\s\S]*?SET\s+NOT\s+NULL`, "i") },
      { kind: "validate_constraint", pattern: new RegExp(String.raw`ALTER\s+TABLE\s+${RELATION}[\s\S]*?VALIDATE\s+CONSTRAINT`, "i") },
      { kind: "add_constraint", pattern: new RegExp(String.raw`ALTER\s+TABLE\s+${RELATION}[\s\S]*?ADD\s+CONSTRAINT`, "i") },
      { kind: "drop_column", pattern: new RegExp(String.raw`ALTER\s+TABLE\s+${RELATION}[\s\S]*?DROP\s+COLUMN`, "i"), destructive: true },
      { kind: "drop_table", pattern: new RegExp(String.raw`DROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+${RELATION}`, "i"), destructive: true },
      { kind: "data_update", pattern: new RegExp(String.raw`UPDATE\s+${RELATION}`, "i") },
      { kind: "data_delete", pattern: new RegExp(String.raw`DELETE\s+FROM\s+${RELATION}`, "i"), destructive: true }
    ];
    for (const rule of rules) {
      const match = statement.match(rule.pattern);
      if (match) risks.push({ kind: rule.kind, table: match[1], destructive: Boolean(rule.destructive) });
    }
  }
  return risks;
}

export function createdMigrationTables(sql) {
  const pattern = new RegExp(String.raw`CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+${RELATION}`, "gi");
  return [...String(sql).matchAll(pattern)].map((match) => match[1]);
}
