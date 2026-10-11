// Vastuse tagasiside põhjused ja märkuse pikkus: üks loend serverile (lib/answerFeedback.js) ja vestluse kaardile
// (components/alalehed/chat/AnswerFeedbackCard.jsx). Iga põhjuse lause on kataloogis võtmega
// chat.answer_feedback.reason_<põhjus>.
export const ANSWER_FEEDBACK_CATEGORIES = Object.freeze([
  "unanswered",
  "wrong_or_outdated",
  "unclear",
  "other"
]);
export const ANSWER_FEEDBACK_NOTE_MAX = 500;
