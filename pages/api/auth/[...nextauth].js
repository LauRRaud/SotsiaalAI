import NextAuthImport from "next-auth";
import { authConfig } from "@/auth";
const NextAuth = NextAuthImport?.default ?? NextAuthImport;
export const authOptions = authConfig;
export const config = {
  runtime: "nodejs"
};
export default NextAuth(authOptions);