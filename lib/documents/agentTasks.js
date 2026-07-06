export function clientTaskInstruction(task = "LETTER_REQUEST") {
  if (task === "LETTER_REPLY") {
    return "Draft a clear and practical reply to the received letter. Base it only on the user's instruction and the selected source files.";
  }
  if (task === "FILL_FORM") {
    return "Help fill in the selected form or blank. Treat the uploaded files as the working materials for this task: one file may be the form itself and the second file may contain the information that should go into it. If the file is not directly fillable, produce a structured draft the user can copy into the form.";
  }
  return "Draft a clear request or application text that the user can review, edit, and send.";
}
