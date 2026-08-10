-- SOL-DOC-09: salvestatud analüüsi loomine ja kustutamine kutsusid auditit, aga kaardis ei olnud
-- neile ühtegi action'it, seega ei jäänud DocumentAudit tabelisse ühtki rida. Kaks uut väärtust
-- annavad neile oma jälje, mida saab eristada retentionist ja puuduvast objektist.
ALTER TYPE "DocumentAuditAction" ADD VALUE IF NOT EXISTS 'ANALYSIS_SAVE';
ALTER TYPE "DocumentAuditAction" ADD VALUE IF NOT EXISTS 'ANALYSIS_DELETE';
