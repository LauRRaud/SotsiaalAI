SET lock_timeout = '5s';
SET statement_timeout = '30s';
-- Already-incurred provider cost must remain recordable above the cap. Admissions still
-- use the atomic used + reserved + amount <= hardLimit predicate. Other metrics retain it here too.
ALTER TABLE "UsageBucket" DROP CONSTRAINT "UsageBucket_usage_check",
  ADD CONSTRAINT "UsageBucket_usage_check" CHECK (
    "used" >= 0 AND "reserved" >= 0 AND
    ("metric" = 'AI_COST_NANO_EUR' OR "used" + "reserved" <= "hardLimit")
  ) NOT VALID;
ALTER TABLE "UsageBucket" VALIDATE CONSTRAINT "UsageBucket_usage_check";
