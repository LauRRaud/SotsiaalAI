import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import fs from "fs";
const envPath = process.env.NODE_ENV === "production" ? ".env.production" : ".env";
if (fs.existsSync(envPath)) {
  dotenv.config({
    path: envPath,
    quiet: true
  });
}
if (fs.existsSync("rag.env")) {
  dotenv.config({
    path: "rag.env",
    override: false,
    quiet: true
  });
}
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
});
const globalForPrisma = globalThis;
// Iga SQL-päringu logimine ujutab dev-terminali üle (tuhanded read/minutis).
// Sisse ainult käsitsi: PRISMA_LOG_QUERIES=1 npm run dev
const logLevels = process.env.PRISMA_LOG_QUERIES === "1"
  ? ["query", "error", "warn"]
  : process.env.NODE_ENV === "development"
    ? ["error", "warn"]
    : ["error"];
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: logLevels
});
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
export default prisma;
