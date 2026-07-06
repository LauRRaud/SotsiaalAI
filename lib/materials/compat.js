export function isMaterialSubmissionSchemaError(error) {
  const message = String(error?.message || error || "")
  return /MaterialSubmission|materialSubmission/i.test(message)
}

export function getMaterialSubmissionSchemaMessage(locale = "et") {
  if (String(locale).toLowerCase().startsWith("ru")) {
    return "Загрузка материалов временно недоступна: схема базы данных на сервере ещё не обновлена."
  }
  if (String(locale).toLowerCase().startsWith("en")) {
    return "Material upload is temporarily unavailable because the server database schema is not updated yet."
  }
  return "Materjalide üleslaadimine on ajutiselt maas, sest serveri andmebaasi skeem pole veel uuendatud."
}
