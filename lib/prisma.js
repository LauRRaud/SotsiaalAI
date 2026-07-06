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
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
});
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
export default prisma;
