"use client";

/* Skip-link: avalehel hüppab otse paneelidele (karussell),
 * paneelivaates sisu juurde (brief §7). */

import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function SkipLink() {
  const pathname = usePathname();
  const { t } = useI18n();
  const normalized =
    (String(pathname || "/").split("#")[0].split("?")[0] || "/")
      .replace(/^\/(et|ru|en)(?=\/|$)/, "") || "/";
  const href = normalized === "/" ? "#room-menu" : "#main";
  return (
    <a className="skip-link" href={href}>
      {t("room.skip_to_content")}
    </a>
  );
}
