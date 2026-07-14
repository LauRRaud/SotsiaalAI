function translate(t, key, vars, fallback) {
  if (typeof t !== "function") return fallback;
  return vars ? t(key, vars, fallback) : t(key, fallback);
}

export function serviceAvailabilityAgeText(t, availability = {}) {
  const days = Number(availability?.ageDays);
  if (!Number.isFinite(days) || !availability?.checkedAt) {
    return translate(t, "service_availability.age.unknown", null, "Kinnitamise aeg teadmata");
  }
  if (days === 0) return translate(t, "service_availability.age.today", null, "Kinnitatud täna");
  if (days === 1) return translate(t, "service_availability.age.yesterday", null, "Kinnitatud eile");
  if (days < 14) {
    return translate(t, "service_availability.age.days", { count: days }, `Kinnitatud ${days} päeva tagasi`);
  }
  const weeks = Math.floor(days / 7);
  return translate(t, "service_availability.age.weeks", { count: weeks }, `Kinnitatud ${weeks} nädalat tagasi`);
}

export function serviceAvailabilityPresentation(t, availability = {}) {
  const status = availability?.status || "unknown";
  const freshness = availability?.freshness || "unknown";
  const definitions = {
    accepting: {
      icon: "✓",
      label: translate(t, "service_availability.status.accepting", null, "Võtab uusi pöördumisi vastu"),
      tone: "positive"
    },
    waitlist: {
      icon: "◷",
      label: translate(t, "service_availability.status.waitlist", null, "Ooteajaga vastuvõtt"),
      tone: "waiting"
    },
    not_accepting: {
      icon: "!",
      label: translate(t, "service_availability.status.not_accepting", null, "Praegu uusi pöördumisi vastu ei võta"),
      tone: "warning"
    },
    unknown: {
      icon: "?",
      label: translate(t, "service_availability.status.unknown", null, "Kättesaadavus kinnitamata"),
      tone: "neutral"
    }
  };
  const base = definitions[status] || definitions.unknown;
  const warning = freshness === "stale"
    ? translate(t, "service_availability.warning.stale", null, "Info võib olla aegunud. Küsi teenuseosutajalt üle.")
    : freshness === "unknown"
      ? translate(t, "service_availability.warning.unknown", null, "Kättesaadavuse infot ei ole veel kinnitatud. Küsi enne pöördumist üle.")
      : status === "not_accepting"
        ? translate(t, "service_availability.warning.not_accepting", null, "Teenus jääb leitavaks, kuid uusi pöördumisi praegu vastu ei võeta.")
        : "";
  return {
    ...base,
    ageText: serviceAvailabilityAgeText(t, availability),
    warning,
    description: availability?.description || "",
    freshness
  };
}
