#!/usr/bin/env node

const startIndex = process.argv.indexOf("--start");
const startValue = startIndex >= 0 ? process.argv[startIndex + 1] : "";
if (!startValue) {
  console.error("Usage: b0-idle-rag-schedule.mjs --start YYYY-MM-DDTHH:mm:ss+03:00");
  process.exitCode = 2;
} else {
  const start = new Date(startValue);
  if (!Number.isFinite(start.getTime())) {
    console.error("Invalid start time");
    process.exitCode = 2;
  } else {
    const offsetsMinutes = [0, 25, 50, 150, 240, 330, 750, 1140, 1530, 2250, 2640, 3030];
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Tallinn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const onCalendar = offsetsMinutes.map(minutes => {
      const value = formatter.format(new Date(start.getTime() + minutes * 60_000)).replace(",", "");
      return "OnCalendar=" + value;
    });
    console.log([
      "[Unit]",
      "Description=Schedule SotsiaalAI B0 idle-RAG measurement",
      "",
      "[Timer]",
      "Unit=sotsiaalai-b0-idle-rag-measure.service",
      "AccuracySec=1s",
      "Persistent=false",
      ...onCalendar,
      "",
      "[Install]",
      "WantedBy=timers.target",
      ""
    ].join("\n"));
  }
}
