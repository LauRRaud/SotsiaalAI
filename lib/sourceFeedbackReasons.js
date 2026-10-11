// Allika veateate põhjused ja märkuse pikkus: üks loend serverile (lib/sourceFeedback.js) ja allikate paneelile
// (components/alalehed/chat/ChatSourcesPanel.jsx). Iga põhjuse lause on kataloogis võtmega chat.sources.report_<põhjus>.
export const SOURCE_FEEDBACK_CATEGORIES = Object.freeze([
  "outdated",
  "wrong_content",
  "broken_link",
  "wrong_source",
  "other"
]);
export const SOURCE_FEEDBACK_NOTE_MAX = 500;
