SET lock_timeout = '5s';
SET statement_timeout = '30s';
ALTER TYPE "UsageMetric" ADD VALUE IF NOT EXISTS 'AI_COST_NANO_EUR';
