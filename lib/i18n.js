import fs from "fs";
import path from "path";
export function getLocaleFromCookies(cookies) {
  const v = cookies?.get?.("NEXT_LOCALE")?.value;
  if (v === "et" || v === "ru" || v === "en") return v;
  return "et";
}
export function getMessagesSync(locale = "et") {
  const messagesRoot = path.join(process.cwd(), "messages");
  const tryFiles = [path.join(messagesRoot, `${locale}.json`), path.join(messagesRoot, locale, "common.json")];
  for (const f of tryFiles) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ f)) {
        const txt = fs.readFileSync(/*turbopackIgnore: true*/ f, "utf8");
        return JSON.parse(txt);
      }
    } catch {}
  }
  if (locale !== "et") return getMessagesSync("et");
  return {};
}
