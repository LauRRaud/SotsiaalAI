const et = {
  preparation: {
    title: 'Väidete ja seoste ettevalmistus', prepare: 'Koosta allikast väited ja seosed', preparing: 'Koostan allikapõhist mustandit…',
    explain: 'Dokumendi tekst saadetakse seadistatud mudelile. Saadud väited ja seosed ilmuvad siin koos täpsete allikakohtadega läbivaatamiseks.',
    cost: 'Mudel: {model}. Ühe koostamise kulupiir: {cost} USD.', review: 'Vaata väited, seoste suunad ja allikakohad üle. Jäta sobimatud välja; eemaldatud väitega seotud sõltuvused jäetakse samuti välja.',
    empty: 'Selles koostamises ei saadud allikasse ankurdatud väiteid.', sources: 'Allikakohad', page: 'PDF lk',
    gaps: 'Täpsustamist vajavad sõltuvused', selection: 'Valitud: {cards} väidet ja {dependencies} sõltuvust.',
    confirm: 'Olen valiku ja selle allikakohad üle vaadanud. Salvestatud seosed jäävad kontrollimata otsinguabiks.',
    apply: 'Salvesta valik uue versioonina', applying: 'Salvestan uut versiooni…', all: 'JA', any: 'VÕI', external: 'Teise dokumendi väide',
    disabled: 'Allikapõhine koostamine vajab mudeli ja kulupiiri seadistust.', cap: 'Koostamine ületaks dokumendi või kogu töö kulupiiri. Kontrolli seadistatud mahtu.',
    invalid: 'Koostatud mustandi tekstikoht või seos ei läbinud kontrolli. Mustandit allika uueks versiooniks ei lisatud.',
    stopped: 'Koostamise tulemus vajab kontrolli. Sama töö uut mudelipäringut automaatselt ei tehta.',
    kinds: { assertion: 'Väide', condition: 'Tingimus', exception: 'Erand', definition: 'Määratlus' },
    relations: { MENTIONS: 'Mainib', RELATED_TOPIC: 'Seotud teema', CITES: 'Viitab', DESCRIBES: 'Kirjeldab', REQUIRES: 'Vajab tingimust', EXCEPTION_TO: 'Erand väitele', DEFINES: 'Määratleb', QUALIFIES: 'Täpsustab', SUPERSEDES: 'Asendab' }
  },
  knowledge: 'Allikaga seotud väited ja sõltuvused', claims: 'Väiteid', dependencies: 'Sõltuvusi',
  knowledgeUnreviewed: 'Tekstikohad vastavad PDF-ile. Imporditud väidete ja seoste sisu ei ole veel kinnitatud; indeksi avaldamine seda ei kinnita.',
  knowledgeInvalid: 'Kontrolli väite või seose PDF-lehekülge ja täpset tsitaati. Korduva tsitaadi korral lisa alguspositsioon.',
  title: 'Dokumendi lisamine', subtitle: 'PDF ja kontrollitud metaandmed valitud RAG v2 arenduskorpusesse.',
  pdf: 'PDF-fail', import: 'Impordi metaandmete JSON (valikuline)', prepare: 'Töötle dokumenti', publish: 'Avalda otsingus',
  preparing: 'Loen ja kontrollin dokumenti…', publishing: 'Avaldan indeksit…', loading: 'Kontrollin ligipääsu…',
  use: 'Kinnitan, et avaliku allika kasutamine selles arenduskorpuses on lubatud.',
  ready: 'Dokument on sisse loetud. Kontrolli metaandmeid, hoiatusi ja teksti.', published: 'Otsinguindeks avaldati.',
  empty: 'Vali PDF ja täida metaandmed. Töötlemise tulemus ilmub siia.',
  fields: { document_id: 'Dokumendi tunnus', title: 'Pealkiri', source_type: 'Allika tüüp', language: 'Keel', authors: 'Autorid (üks rea kohta)', year: 'Aasta', tags: 'Märksõnad (üks rea kohta)' },
  extra: 'Muud metaandmed (JSON)', extraHelp: 'Imporditud lisaväljad, näiteks allika staatus ja päritolu, säilivad siin.',
  preview: 'Loodav metadatafail', status: 'Dokumendi ülevaatus', pages: 'PDF-lehti', chunks: 'Tekstiosi', warnings: 'Hoiatusi',
  excerpt: 'Teksti eelvaade', page: 'PDF lk', details: 'Metaandmed ja päritolu', value: 'Väärtus', origin: 'Päritolu',
  error: 'Toiming ebaõnnestus. Sisestus säilis; kontrolli veateadet.', missing: 'Vali PDF, täida kohustuslikud väljad ja kinnita kasutus.',
  disabled: 'Dokumendi lisamine pole selles keskkonnas avatud.', access: 'Selle toimingu jaoks pole kehtivat ligipääsu.',
  invalid: 'Kontrolli PDF-i ja metaandmete vormingut.', changed: 'Allikas või seadistus muutus. Töötle dokument uuesti ja vaata tulemus üle.',
  unavailable: 'Indekseerimise ühendus või seadistus pole valmis. Dokument on säilitatud.',
  stopped: 'Varasem avaldamine jäi pooleli. Uusi mudelipäringuid ei saadeta; administraator peab tulemuse kontrollima.',
  capError: 'Avaldamine ületaks seadistatud kulupiiri.', code: 'Veakood', limit: 'Kogukulu ülempiir', reserved: 'Reserveeritud',
  review: 'Olen kontrollinud metaandmeid, hoiatusi ja teksti ning kinnitan selle versiooni avaldamise.',
  binding: 'Vestluses kasutamiseks tuleb avaldatud indeks siduda piloodi allikavalikuga.',
  downloadPdf: 'Laadi alla PDF', downloadMetadata: 'Laadi alla metaandmed', scope: 'Avaldamise ulatus',
  sources: 'Dokumente', external: 'Uusi vektoripäringuid', reused: 'Taaskasutatavaid vektoreid', expires: 'Ülevaatus aegub',
  indexPending: 'Vektorid on salvestatud. Saad jätkata indeksi avaldamist uute mudelipäringuteta.',
  notPrepared: 'Dokument säilis, kuid indeksi ettevalmistus vajab kontrolli.',
  warningText: {
    layout_coverage_limit: 'Kontrolli teksti lugemisjärjekorda. Tabelid, joonealused märkused ja mitmeveeruline sisu vajavad eraldi ülevaatust.',
    knowledge_import_unreviewed: 'Väidete ja sõltuvuste tekstikohad on seotud PDF-iga, kuid imporditud sisu pole kinnitatud.',
    title_not_matched_in_pdf: 'Pealkirja täpset vastet PDF-i tekstist ei leitud.',
    authors_not_matched_in_pdf: 'Kõiki autorinimesid ei leitud PDF-i tekstist.',
    description_not_verified: 'Kirjeldus aitab otsida; seda pole algallika väitena kontrollitud.',
    publication_year_conflict: 'Metadata aasta ja PDF-ist leitud kuupäev erinevad.',
    pdf_page_range_conflict: 'Metadata leheküljevahemik ja PDF-i tegelik pikkus erinevad.',
    reference_list_not_visible: 'Viidete loend pole selles PDF-is täielikult nähtav.',
    pdf_nul_replaced: 'PDF-i vigased nullmärgid asendati nähtava asendusmärgiga.'
  },
  origins: { metadata: 'Metaandmefail', pdf_text: 'PDF-i tekst', normalization_policy: 'Puudub või pole tuletatud', parser: 'PDF-parser', pdf_metadata: 'PDF-faili omadused', ingest_clock: 'Töötlemise aeg', parser_margin: 'PDF-i servatekst', parser_comparison: 'Võrdlus PDF-i tekstiga', asset_review: 'Allika ülevaatus' }
};
const en = {
  preparation: {
    title: 'Prepare claims and relations', prepare: 'Prepare claims from the source', preparing: 'Preparing a source-anchored draft…',
    explain: 'The document text is sent to the configured model. Claims and relations appear here with exact source passages for review.',
    cost: 'Model: {model}. Maximum cost for one preparation: {cost} USD.', review: 'Review claims, relation directions and source passages. Exclude unsuitable items; relations to excluded claims are also omitted.',
    empty: 'This preparation produced no source-anchored claims.', sources: 'Source passages', page: 'PDF page',
    gaps: 'Dependencies needing clarification', selection: 'Selected: {cards} claims and {dependencies} dependencies.',
    confirm: 'I have reviewed the selection and its source passages. Saved relations remain unverified retrieval aids.',
    apply: 'Save selection as a new version', applying: 'Saving a new version…', all: 'AND', any: 'OR', external: 'Claim in another document',
    disabled: 'Source preparation needs a configured model and spending limit.', cap: 'Preparation would exceed the document or aggregate limit. Check the configured allowance.',
    invalid: 'A draft source passage or relation failed validation. The draft was not added as a new source version.',
    stopped: 'The preparation outcome needs attention. The same model request is not automatically sent again.',
    kinds: { assertion: 'Claim', condition: 'Condition', exception: 'Exception', definition: 'Definition' },
    relations: { MENTIONS: 'Mentions', RELATED_TOPIC: 'Related topic', CITES: 'Cites', DESCRIBES: 'Describes', REQUIRES: 'Requires condition', EXCEPTION_TO: 'Exception to', DEFINES: 'Defines', QUALIFIES: 'Qualifies', SUPERSEDES: 'Supersedes' }
  },
  knowledge: 'Source-anchored claims and dependencies', claims: 'Claims', dependencies: 'Dependencies',
  knowledgeUnreviewed: 'The text anchors match the PDF. Imported claims and relations have not been verified; publishing the index does not verify them.',
  knowledgeInvalid: 'Check the claim or relation page number and exact quotation. For a repeated quotation, add its start offset.',
  title: 'Add a document', subtitle: 'PDF and reviewed metadata for the selected RAG v2 development corpus.',
  pdf: 'PDF file', import: 'Import metadata JSON (optional)', prepare: 'Process document', publish: 'Publish to search',
  preparing: 'Reading and validating…', publishing: 'Publishing the index…', loading: 'Checking access…',
  use: 'I confirm this public source may be used in this development corpus.',
  ready: 'The document was ingested. Review its metadata, warnings and text.', published: 'The search index was published.',
  empty: 'Choose a PDF and complete its metadata. The processing result will appear here.',
  fields: { document_id: 'Document identifier', title: 'Title', source_type: 'Source type', language: 'Language', authors: 'Authors (one per line)', year: 'Year', tags: 'Keywords (one per line)' },
  extra: 'Additional metadata (JSON)', extraHelp: 'Imported additional fields, such as source status and provenance, are preserved here.',
  preview: 'Metadata file to create', status: 'Review document', pages: 'PDF pages', chunks: 'Text chunks', warnings: 'Warnings',
  excerpt: 'Text preview', page: 'PDF page', details: 'Metadata and provenance', value: 'Value', origin: 'Provenance',
  error: 'The action failed. Your input was retained; check the error.', missing: 'Choose a PDF, complete required fields and confirm usage.',
  disabled: 'Document intake is not enabled in this environment.', access: 'You do not have current access to this action.',
  invalid: 'Check the PDF and metadata format.', changed: 'The source or configuration changed. Process and review the document again.',
  unavailable: 'Indexing connections or configuration are not ready. The document was retained.',
  stopped: 'An earlier publication is incomplete. No new model requests are sent; an administrator must inspect the result.',
  capError: 'Publication would exceed the configured cap.', code: 'Error code', limit: 'Total spend cap', reserved: 'Reserved',
  review: 'I reviewed the metadata, warnings and text, and confirm publication of this version.',
  binding: 'The published index must be bound to the pilot source selection before it is used in chat.',
  downloadPdf: 'Download PDF', downloadMetadata: 'Download metadata', scope: 'Publication scope',
  sources: 'Documents', external: 'New embedding requests', reused: 'Reusable vectors', expires: 'Review expires',
  indexPending: 'The vectors were saved. Index publication can resume without new model requests.',
  notPrepared: 'The document was retained, but index preparation needs attention.',
  warningText: {
    layout_coverage_limit: 'Check reading order. Tables, footnotes and multiple columns require separate review.',
    knowledge_import_unreviewed: 'Claims and dependencies are anchored to the PDF, but their imported content has not been verified.',
    title_not_matched_in_pdf: 'The exact title was not found in the PDF text.',
    authors_not_matched_in_pdf: 'Not all author names were found in the PDF text.',
    description_not_verified: 'The description is a search aid; it is not verified source evidence.',
    publication_year_conflict: 'The metadata year differs from the date found in the PDF.',
    pdf_page_range_conflict: 'The metadata page range differs from the actual PDF length.',
    reference_list_not_visible: 'The reference list is not fully visible in this PDF.',
    pdf_nul_replaced: 'Invalid PDF null characters were replaced with visible replacement characters.'
  },
  origins: { metadata: 'Metadata file', pdf_text: 'PDF text', normalization_policy: 'Missing or not inferred', parser: 'PDF parser', pdf_metadata: 'PDF file properties', ingest_clock: 'Processing time', parser_margin: 'PDF margin text', parser_comparison: 'Compared with PDF text', asset_review: 'Source review' }
};
const ru = {
  ...en,
  preparation: {
    title: 'Подготовка утверждений и связей', prepare: 'Подготовить утверждения из источника', preparing: 'Подготовка черновика с привязкой к источнику…',
    explain: 'Текст документа передаётся настроенной модели. Утверждения и связи появятся здесь вместе с точными фрагментами источника для проверки.',
    cost: 'Модель: {model}. Максимальная стоимость одной подготовки: {cost} USD.', review: 'Проверьте утверждения, направления связей и фрагменты источника. Исключите неподходящие элементы; связи с исключёнными утверждениями также будут пропущены.',
    empty: 'В результате этой подготовки не получены утверждения с привязкой к источнику.', sources: 'Фрагменты источника', page: 'Страница PDF',
    gaps: 'Зависимости, требующие уточнения', selection: 'Выбрано: {cards} утверждений и {dependencies} зависимостей.',
    confirm: 'Я просмотрел выборку и её источники. Сохранённые связи останутся непроверенными подсказками для поиска.',
    apply: 'Сохранить выборку как новую версию', applying: 'Сохранение новой версии…', all: 'И', any: 'ИЛИ', external: 'Утверждение в другом документе',
    disabled: 'Для подготовки нужны настроенная модель и лимит расходов.', cap: 'Подготовка превысит лимит документа или общий лимит. Проверьте настройки.',
    invalid: 'Фрагмент источника или связь в черновике не прошли проверку. Черновик не добавлен как новая версия источника.',
    stopped: 'Результат подготовки требует проверки. Повторный запрос к модели для этой работы автоматически не отправляется.',
    kinds: { assertion: 'Утверждение', condition: 'Условие', exception: 'Исключение', definition: 'Определение' },
    relations: { MENTIONS: 'Упоминает', RELATED_TOPIC: 'Связанная тема', CITES: 'Ссылается', DESCRIBES: 'Описывает', REQUIRES: 'Требует условия', EXCEPTION_TO: 'Исключение к', DEFINES: 'Определяет', QUALIFIES: 'Уточняет', SUPERSEDES: 'Заменяет' }
  },
  knowledge: 'Утверждения и зависимости с привязкой к источнику', claims: 'Утверждений', dependencies: 'Зависимостей',
  knowledgeUnreviewed: 'Указанные фрагменты совпадают с PDF. Содержание импортированных утверждений и связей ещё не подтверждено; публикация индекса его не подтверждает.',
  knowledgeInvalid: 'Проверьте страницу PDF и точную цитату утверждения или связи. Для повторяющейся цитаты укажите начальную позицию.',
  title: 'Добавление документа', subtitle: 'PDF и проверенные метаданные для выбранного корпуса RAG v2.',
  pdf: 'Файл PDF', import: 'Импорт метаданных JSON (необязательно)', prepare: 'Обработать документ', publish: 'Опубликовать в поиске',
  preparing: 'Чтение и проверка…', publishing: 'Публикация индекса…', loading: 'Проверка доступа…',
  use: 'Подтверждаю разрешение на использование этого общедоступного источника в данном корпусе.',
  ready: 'Документ загружен. Проверьте метаданные, предупреждения и текст.', published: 'Поисковый индекс опубликован.',
  empty: 'Выберите PDF и заполните метаданные. Результат обработки появится здесь.',
  fields: { document_id: 'Идентификатор документа', title: 'Заголовок', source_type: 'Тип источника', language: 'Язык', authors: 'Авторы (по одному в строке)', year: 'Год', tags: 'Ключевые слова (по одному в строке)' },
  extra: 'Дополнительные метаданные (JSON)', extraHelp: 'Дополнительные поля импорта, включая статус и происхождение источника, сохраняются здесь.',
  preview: 'Создаваемый файл метаданных', status: 'Проверка документа', pages: 'Страниц PDF', chunks: 'Фрагментов', warnings: 'Предупреждений',
  excerpt: 'Предварительный просмотр текста', page: 'Страница PDF', details: 'Метаданные и происхождение', value: 'Значение', origin: 'Происхождение',
  error: 'Действие не выполнено. Введённые данные сохранены; проверьте сообщение.', missing: 'Выберите PDF, заполните обязательные поля и подтвердите использование.',
  disabled: 'Добавление документов в этой среде не включено.', access: 'Нет действующего доступа к этому действию.',
  invalid: 'Проверьте формат PDF и метаданных.', changed: 'Источник или настройки изменились. Обработайте и проверьте документ заново.',
  unavailable: 'Подключения или настройки индексации не готовы. Документ сохранён.',
  stopped: 'Предыдущая публикация не завершена. Новые запросы модели не отправляются; администратор должен проверить результат.',
  capError: 'Публикация превысит установленный лимит.', code: 'Код ошибки', limit: 'Общий лимит расходов', reserved: 'Зарезервировано',
  review: 'Метаданные, предупреждения и текст проверены; подтверждаю публикацию этой версии.',
  binding: 'Для использования в чате опубликованный индекс необходимо связать с выбором источников пилота.',
  downloadPdf: 'Скачать PDF', downloadMetadata: 'Скачать метаданные', scope: 'Объём публикации',
  sources: 'Документов', external: 'Новых запросов векторизации', reused: 'Повторно используемых векторов', expires: 'Срок проверки истекает',
  indexPending: 'Векторы сохранены. Публикацию индекса можно продолжить без новых запросов модели.',
  notPrepared: 'Документ сохранён, но подготовка индекса требует проверки.',
  warningText: {
    layout_coverage_limit: 'Проверьте порядок чтения. Таблицы, сноски и многоколоночный текст требуют отдельной проверки.',
    knowledge_import_unreviewed: 'Утверждения и зависимости привязаны к PDF, но их содержание ещё не подтверждено.',
    title_not_matched_in_pdf: 'Точное совпадение заголовка в тексте PDF не найдено.',
    authors_not_matched_in_pdf: 'Не все имена авторов найдены в тексте PDF.',
    description_not_verified: 'Описание помогает поиску, но не является проверенным свидетельством источника.',
    publication_year_conflict: 'Год в метаданных отличается от даты, найденной в PDF.',
    pdf_page_range_conflict: 'Диапазон страниц в метаданных отличается от фактической длины PDF.',
    reference_list_not_visible: 'Список литературы в этом PDF виден не полностью.',
    pdf_nul_replaced: 'Некорректные нулевые символы PDF заменены видимым символом замены.'
  },
  origins: { metadata: 'Файл метаданных', pdf_text: 'Текст PDF', normalization_policy: 'Отсутствует или не выводится', parser: 'Парсер PDF', pdf_metadata: 'Свойства файла PDF', ingest_clock: 'Время обработки', parser_margin: 'Текст на полях PDF', parser_comparison: 'Сравнение с текстом PDF', asset_review: 'Проверка источника' }
};
export function getRagV2IntakeCopy(locale) { return String(locale).startsWith('et') ? et : String(locale).startsWith('ru') ? ru : en; }
export function intakeErrorText(copy, code) {
  if (/knowledge_preparation_(disabled|not_configured)/.test(code)) return copy.preparation.disabled;
  if (/knowledge_preparation_.*cap/.test(code)) return copy.preparation.cap;
  if (/knowledge_(preparation_)?(anchor|result|text|shape|selection)/.test(code)) return copy.preparation.invalid;
  if (/knowledge_(preparation_)?(outcome|usage|failed)|knowledge_(budget|response)/.test(code)) return copy.preparation.stopped;
  if (code === 'knowledge_draft_changed') return copy.changed;
  if (code.startsWith('knowledge_anchor_')) return copy.knowledgeInvalid;
  if (code === 'rag_v2_admin_disabled') return copy.disabled;
  if (/forbidden|unauthorized|access|job_scope/.test(code)) return copy.access;
  if (/source_changed|plan_changed|superseded|config_expired|job_expired/.test(code)) return copy.changed;
  if (/incomplete|outcome_unknown/.test(code)) return copy.stopped;
  if (/cap_exceeded/.test(code)) return copy.capError;
  if (/connections|price_not|provider_not/.test(code)) return copy.unavailable;
  if (/invalid|too_large|required|not_approved/.test(code)) return copy.invalid;
  return copy.error;
}
