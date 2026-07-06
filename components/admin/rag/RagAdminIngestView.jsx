"use client";

import Button from "@/components/ui/Button";
import CardTitle from "@/components/ui/CardTitle";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import DocumentsDropdown from "@/components/documents/DocumentsDropdown";

import RagAdminAlert from "./RagAdminAlert";

export default function RagAdminIngestView({ controller, showMessage = true }) {
  const {
    tr,
    message,
    resetMessage,
    selftestBusy,
    selftestSteps,
    handleSelftest,
    fetchDocuments,
    loadingList,
    handleUrlSubmit,
    urlFormRef,
    urlTitle,
    setUrlTitle,
    urlDescription,
    setUrlDescription,
    urlTags,
    setUrlTags,
    urlAudience,
    setUrlAudience,
    audienceSelectOptions,
    urlBusy,
    handlePdfMetaSubmit,
    pdfFormRef,
    pdfFileInputRef,
    pdfMetaFileInputRef,
    pdfFileName,
    setPdfFileName,
    pdfMetaFileName,
    setPdfMetaFileName,
    pdfMetaText,
    setPdfMetaText,
    pdfMetaAudience,
    setPdfMetaAudience,
    rtXmlFormRef,
    rtXmlFileInputRef,
    rtXmlFileName,
    setRtXmlFileName,
    rtXmlBusy,
    rtXmlResult,
    handleRtXmlSubmit,
    showMetaGuide,
    setShowMetaGuide,
    handleMetaCheck,
    pdfMetaBusy,
    metaCheck,
    pdfMetaResult,
    articlesDocId,
    setArticlesDocId,
    articlesFileInputRef,
    articlesJsonFileName,
    setArticlesJsonFileName,
    articlesJson,
    setArticlesJson,
    articlesBusy,
    handleArticlesSubmit,
    articlesFormRef,
    articlesResult,
    activeMetaTemplate,
    metaTemplates,
    setActiveMetaTemplateKey,
    activeMetaTemplateContent
  } = controller;

  return (
    <div>
      {showMessage ? <RagAdminAlert message={message} onDismiss={resetMessage} /> : null}

      <div>
        <div>
          <div>
            <div>
              <CardTitle>{tr("admin.rag.ingest.title")}</CardTitle>
              <div>{tr("admin.rag.ingest.subtitle")}</div>
            </div>
            <div>
              <Button
                onClick={handleSelftest}
                disabled={selftestBusy}
              >
                {selftestBusy ? tr("admin.rag.selftest.running") : tr("admin.rag.selftest.run")}
              </Button>
              <Button
                onClick={fetchDocuments}
                disabled={loadingList}
              >
                {loadingList ? tr("admin.common.loading") : tr("admin.common.refresh")}
              </Button>
            </div>
          </div>

          <div>
            <form onSubmit={handleUrlSubmit} ref={urlFormRef}>
                  <label>{tr("admin.rag.ingest.url_section_title")}</label>
                  <Input name="url" placeholder="https://" />
                  <Input
                    value={urlTitle}
                    onChange={event => setUrlTitle(event.target.value)}
                    placeholder={tr("admin.rag.ingest.url_title_placeholder")}
                  />
                  <Textarea
                    value={urlDescription}
                    onChange={event => setUrlDescription(event.target.value)}
                    placeholder={tr("admin.rag.ingest.url_description_placeholder")}
                    rows={2}
                  />
                  <Input
                    value={urlTags}
                    onChange={event => setUrlTags(event.target.value)}
                    placeholder={tr("admin.rag.ingest.url_tags_placeholder")}
                  />
                  <DocumentsDropdown
                    ariaLabel={tr("admin.rag.ingest.url_section_title")}
                    value={urlAudience}
                    onChange={setUrlAudience}
                    options={audienceSelectOptions}
                  />
                  <Button
                    type="submit"
                    disabled={urlBusy}
                  >
                    {urlBusy ? tr("admin.rag.ingest.sending") : tr("admin.rag.ingest.send_url")}
                  </Button>
            </form>

            <form onSubmit={handlePdfMetaSubmit} ref={pdfFormRef}>
                  <label>{tr("admin.rag.ingest.pdf_section_title")}</label>
                  <div>{tr("admin.rag.ingest.pdf_section_note")}</div>
                  <input
                    ref={pdfFileInputRef}
                    name="pdfWithMetaFile"
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={event => setPdfFileName(event.target.files?.[0]?.name || "")}
                  />
                  <div>
                    <Button
                      type="button"
                      onClick={() => pdfFileInputRef.current?.click()}
                    >
                      Vali fail
                    </Button>
                    <span>{pdfFileName || "Pole valitud PDF faili"}</span>
                  </div>
                  <input
                    ref={pdfMetaFileInputRef}
                    name="pdfMetaFile"
                    type="file"
                    accept="application/json"
                    className="sr-only"
                    onChange={event => setPdfMetaFileName(event.target.files?.[0]?.name || "")}
                  />
                  <div>
                    <Button
                      type="button"
                      onClick={() => pdfMetaFileInputRef.current?.click()}
                    >
                      Vali fail
                    </Button>
                    <span>{pdfMetaFileName || "Pole valitud JSON faili"}</span>
                  </div>
                  <Textarea
                    name="pdfMetaText"
                    value={pdfMetaText}
                    onChange={event => setPdfMetaText(event.target.value)}
                    placeholder={tr("admin.rag.ingest.pdf_meta_text_placeholder")}
                    rows={3}
                  />
                  <DocumentsDropdown
                    ariaLabel={tr("admin.rag.ingest.pdf_section_title")}
                    value={pdfMetaAudience}
                    onChange={setPdfMetaAudience}
                    options={audienceSelectOptions}
                  />
                  <div>
                    <Button
                      type="button"
                      onClick={() => setShowMetaGuide(state => !state)}
                      aria-expanded={showMetaGuide}
                      aria-controls="rag-meta-panel"
                    >
                      {showMetaGuide ? tr("admin.rag.meta.hide_templates") : tr("admin.rag.meta.open_templates")}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleMetaCheck}
                    >
                      {tr("admin.rag.meta.check_json")}
                    </Button>
                    <Button
                      type="submit"
                      disabled={pdfMetaBusy}
                    >
                      {pdfMetaBusy ? tr("admin.rag.ingest.sending") : tr("admin.rag.ingest.send_pdf_with_meta")}
                    </Button>
                  </div>
                  {metaCheck ? (
                    <div>
                      {metaCheck.text}
                    </div>
                  ) : null}
                  {pdfMetaResult ? (
                    <div>
                      {pdfMetaResult.fileName ? `${pdfMetaResult.fileName}: ` : ""}
                      {pdfMetaResult.shortRef || pdfMetaResult.docId || tr("admin.rag.common.saved")}
                    </div>
                  ) : null}
            </form>

            <form onSubmit={handleRtXmlSubmit} ref={rtXmlFormRef}>
                  <label>{tr("admin.rag.ingest.rt_xml_section_title")}</label>
                  <div>{tr("admin.rag.ingest.rt_xml_section_note")}</div>
                  <input
                    ref={rtXmlFileInputRef}
                    name="rtXmlFile"
                    type="file"
                    accept=".xml,application/xml,text/xml"
                    className="sr-only"
                    onChange={event => setRtXmlFileName(event.target.files?.[0]?.name || "")}
                  />
                  <div>
                    <Button
                      type="button"
                      onClick={() => rtXmlFileInputRef.current?.click()}
                    >
                      {tr("admin.rag.ingest.choose_rt_xml")}
                    </Button>
                    <span>{rtXmlFileName || tr("admin.rag.ingest.no_rt_xml_selected")}</span>
                  </div>
                  <Button
                    type="submit"
                    disabled={rtXmlBusy}
                  >
                    {rtXmlBusy ? tr("admin.rag.ingest.sending") : tr("admin.rag.ingest.send_rt_xml")}
                  </Button>
                  {rtXmlResult ? (
                    <div>
                      {[
                        rtXmlResult.title,
                        rtXmlResult.actReference ? `RT ${rtXmlResult.actReference}` : "",
                        rtXmlResult.docId ? `docId: ${rtXmlResult.docId}` : "",
                        rtXmlResult.inserted != null ? tr("admin.rag.ingest.rt_xml_chunk_count", { count: rtXmlResult.inserted }) : ""
                      ].filter(Boolean).join(" | ")}
                    </div>
                  ) : null}
            </form>

            <div>
                <div>
                  <div>
                    <div>{tr("admin.rag.articles.title")}</div>
                    <div>{tr("admin.rag.articles.subtitle")}</div>
                  </div>
                  <Button
                    as="a"
                    href="/rag-meta-templates/articles.json"
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                  >
                    {tr("admin.rag.articles.open_template")}
                  </Button>
                </div>
                <form onSubmit={handleArticlesSubmit} ref={articlesFormRef}>
                  <Input
                    name="articlesDocId"
                    value={articlesDocId}
                    onChange={event => setArticlesDocId(event.target.value)}
                    placeholder={tr("admin.rag.articles.doc_id_placeholder")}
                  />
                  <input
                    ref={articlesFileInputRef}
                    name="articlesJsonFile"
                    type="file"
                    accept="application/json"
                    className="sr-only"
                    onChange={event => setArticlesJsonFileName(event.target.files?.[0]?.name || "")}
                  />
                  <div>
                    <Button
                      type="button"
                      onClick={() => articlesFileInputRef.current?.click()}
                    >
                      Vali fail
                    </Button>
                    <span>{articlesJsonFileName || "Pole valitud JSON faili"}</span>
                  </div>
                  <Textarea
                    name="articlesJsonText"
                    value={articlesJson}
                    onChange={event => setArticlesJson(event.target.value)}
                    placeholder={tr("admin.rag.articles.json_placeholder")}
                    rows={5}
                  />
                  <div>
                    <Button
                      type="submit"
                      disabled={articlesBusy}
                    >
                      {articlesBusy ? tr("admin.rag.ingest.sending") : tr("admin.rag.articles.send")}
                    </Button>
                  </div>
                  {articlesResult ? (
                    <div>
                      {articlesResult.count != null
                        ? tr("admin.rag.articles.added_count", { count: articlesResult.count })
                        : tr("admin.rag.articles.added")}
                      {articlesResult.docId ? ` docId: ${articlesResult.docId}` : ""}
                      {articlesResult.inserted?.length ? (
                        <ul>
                          {articlesResult.inserted.slice(0, 4).map((item, index) => (
                            <li key={`${item.title || "article"}-${index}`}>
                              {(item.title || tr("admin.rag.articles.default_article")) +
                                (item.startPage && item.endPage
                                  ? tr("admin.rag.articles.page_range", {
                                      start: item.startPage,
                                      end: item.endPage
                                    })
                                  : "")}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </form>
            </div>

            {Array.isArray(selftestSteps) && selftestSteps.length ? (
              <div>
                <CardTitle>{tr("admin.rag.selftest.results_title")}</CardTitle>
                <ul>
                  {selftestSteps.map((step, index) => (
                    <li key={index}>
                      {step.label || step.step || step.id}: {step.ok ? tr("admin.rag.common.ok") : tr("admin.rag.common.failed")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {showMetaGuide ? (
              <div id="rag-meta-panel">
                <div>
                  <div>
                    <div>{tr("admin.rag.meta.templates_title")}</div>
                    <div>{tr("admin.rag.meta.templates_note")}</div>
                  </div>
                  {activeMetaTemplate ? (
                    <a href={activeMetaTemplate.file} target="_blank" rel="noopener noreferrer" download>
                      {tr("admin.rag.meta.open_json")}
                    </a>
                  ) : null}
                </div>
                <div>
                  <div>
                    <div>{tr("admin.rag.meta.important")}</div>
                    <ul>
                      <li>{tr("admin.rag.meta.important_line_1")}</li>
                      <li>{tr("admin.rag.meta.important_line_2")}</li>
                    </ul>
                  </div>
                  <div>
                    <div>{tr("admin.rag.meta.recommended")}</div>
                    <ul>
                      <li>{tr("admin.rag.meta.recommended_line_1")}</li>
                      <li>{tr("admin.rag.meta.recommended_line_2")}</li>
                      <li>{tr("admin.rag.meta.page_range_or_pdf_pages")}</li>
                      <li>{tr("admin.rag.meta.recommended_line_4")}</li>
                    </ul>
                  </div>
                </div>
                <div>
                  {metaTemplates.map(template => (
                    <button
                      type="button"
                      key={template.key}
                      onClick={() => setActiveMetaTemplateKey(template.key)}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
                <pre>{activeMetaTemplateContent || ""}</pre>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
