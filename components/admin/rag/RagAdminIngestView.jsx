"use client";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Form from "@/components/ui/Form";
import DocumentsDropdown from "@/components/documents/DocumentsDropdown";

import RagAdminAlert from "./RagAdminAlert";

/* Sisestuse töölaud võrgustikuna: URL ja PDF+meta kõrvuti, RT XML ja
   artiklid teisel real — mitte enam üks lehepikkune vormitorn. */
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
    <div className="ra-shell-flow">
      {showMessage ? <RagAdminAlert message={message} onDismiss={resetMessage} /> : null}

      <div className="ra-card">
        <div className="ra-card-head">
          <div>
            <h2 className="ra-card-title">{tr("admin.rag.ingest.title")}</h2>
            <p className="ra-card-sub">{tr("admin.rag.ingest.subtitle")}</p>
          </div>
          <div className="ra-actions">
            <Button onClick={handleSelftest} disabled={selftestBusy}>
              {selftestBusy ? tr("admin.rag.selftest.running") : tr("admin.rag.selftest.run")}
            </Button>
            <Button onClick={fetchDocuments} disabled={loadingList}>
              {loadingList ? tr("admin.common.loading") : tr("admin.common.refresh")}
            </Button>
            <Button
              type="button"
              onClick={() => setShowMetaGuide(state => !state)}
              aria-expanded={showMetaGuide}
              aria-controls="rag-meta-panel"
            >
              {showMetaGuide ? tr("admin.rag.meta.hide_templates") : tr("admin.rag.meta.open_templates")}
            </Button>
          </div>
        </div>
      </div>

      {Array.isArray(selftestSteps) && selftestSteps.length ? (
        <div className="ra-card">
          <h2 className="ra-card-title">{tr("admin.rag.selftest.results_title")}</h2>
          <div className="ra-chiprow">
            {selftestSteps.map((step, index) => (
              <span key={index} className="ra-chip" data-tone={step.ok ? "ok" : "err"}>
                {step.label || step.step || step.id}: {step.ok ? tr("admin.rag.common.ok") : tr("admin.rag.common.failed")}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {showMetaGuide ? (
        <div id="rag-meta-panel" className="ra-card">
          <div className="ra-card-head">
            <div>
              <h2 className="ra-card-title">{tr("admin.rag.meta.templates_title")}</h2>
              <p className="ra-card-sub">{tr("admin.rag.meta.templates_note")}</p>
            </div>
            {activeMetaTemplate ? (
              <Button as="a" href={activeMetaTemplate.file} target="_blank" rel="noopener noreferrer" download>
                {tr("admin.rag.meta.open_json")}
              </Button>
            ) : null}
          </div>
          <div className="ra-grid">
            <div className="ra-col-6">
              <div className="ra-label">{tr("admin.rag.meta.important")}</div>
              <ul>
                <li>{tr("admin.rag.meta.important_line_1")}</li>
                <li>{tr("admin.rag.meta.important_line_2")}</li>
              </ul>
            </div>
            <div className="ra-col-6">
              <div className="ra-label">{tr("admin.rag.meta.recommended")}</div>
              <ul>
                <li>{tr("admin.rag.meta.recommended_line_1")}</li>
                <li>{tr("admin.rag.meta.recommended_line_2")}</li>
                <li>{tr("admin.rag.meta.page_range_or_pdf_pages")}</li>
                <li>{tr("admin.rag.meta.recommended_line_4")}</li>
              </ul>
            </div>
          </div>
          <div className="ra-chiprow">
            {metaTemplates.map(template => (
              <button
                type="button"
                className="ra-chip"
                data-checked={activeMetaTemplate?.key === template.key ? "true" : "false"}
                key={template.key}
                onClick={() => setActiveMetaTemplateKey(template.key)}
              >
                {template.label}
              </button>
            ))}
          </div>
          <pre className="ra-pre">{activeMetaTemplateContent || ""}</pre>
        </div>
      ) : null}

      <div className="ra-grid">
        <div className="ra-col-6">
          <Form onSubmit={handleUrlSubmit} ref={urlFormRef} className="ra-card ra-form">
            <label className="ra-card-title">{tr("admin.rag.ingest.url_section_title")}</label>
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
            <div className="ra-actions">
              <Button type="submit" disabled={urlBusy}>
                {urlBusy ? tr("admin.rag.ingest.sending") : tr("admin.rag.ingest.send_url")}
              </Button>
            </div>
          </Form>
        </div>

        <div className="ra-col-6">
          <Form onSubmit={handlePdfMetaSubmit} ref={pdfFormRef} className="ra-card ra-form">
            <label className="ra-card-title">{tr("admin.rag.ingest.pdf_section_title")}</label>
            <p className="ra-card-sub">{tr("admin.rag.ingest.pdf_section_note")}</p>
            <input
              ref={pdfFileInputRef}
              name="pdfWithMetaFile"
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={event => setPdfFileName(event.target.files?.[0]?.name || "")}
            />
            <div className="ra-filepick">
              <Button type="button" onClick={() => pdfFileInputRef.current?.click()}>
                Vali PDF
              </Button>
              <span className="ra-filepick-name">{pdfFileName || "Pole valitud PDF faili"}</span>
            </div>
            <input
              ref={pdfMetaFileInputRef}
              name="pdfMetaFile"
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={event => setPdfMetaFileName(event.target.files?.[0]?.name || "")}
            />
            <div className="ra-filepick">
              <Button type="button" onClick={() => pdfMetaFileInputRef.current?.click()}>
                Vali JSON
              </Button>
              <span className="ra-filepick-name">{pdfMetaFileName || "Pole valitud JSON faili"}</span>
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
            <div className="ra-actions">
              <Button type="button" onClick={handleMetaCheck}>
                {tr("admin.rag.meta.check_json")}
              </Button>
              <Button type="submit" disabled={pdfMetaBusy}>
                {pdfMetaBusy ? tr("admin.rag.ingest.sending") : tr("admin.rag.ingest.send_pdf_with_meta")}
              </Button>
            </div>
            {metaCheck ? <div className="ra-status">{metaCheck.text}</div> : null}
            {pdfMetaResult ? (
              <div className="ra-status">
                {pdfMetaResult.fileName ? `${pdfMetaResult.fileName}: ` : ""}
                {pdfMetaResult.shortRef || pdfMetaResult.docId || tr("admin.rag.common.saved")}
              </div>
            ) : null}
          </Form>
        </div>

        <div className="ra-col-6">
          <Form onSubmit={handleRtXmlSubmit} ref={rtXmlFormRef} className="ra-card ra-form">
            <label className="ra-card-title">{tr("admin.rag.ingest.rt_xml_section_title")}</label>
            <p className="ra-card-sub">{tr("admin.rag.ingest.rt_xml_section_note")}</p>
            <input
              ref={rtXmlFileInputRef}
              name="rtXmlFile"
              type="file"
              accept=".xml,application/xml,text/xml"
              className="sr-only"
              onChange={event => setRtXmlFileName(event.target.files?.[0]?.name || "")}
            />
            <div className="ra-filepick">
              <Button type="button" onClick={() => rtXmlFileInputRef.current?.click()}>
                {tr("admin.rag.ingest.choose_rt_xml")}
              </Button>
              <span className="ra-filepick-name">{rtXmlFileName || tr("admin.rag.ingest.no_rt_xml_selected")}</span>
            </div>
            <div className="ra-actions">
              <Button type="submit" disabled={rtXmlBusy}>
                {rtXmlBusy ? tr("admin.rag.ingest.sending") : tr("admin.rag.ingest.send_rt_xml")}
              </Button>
            </div>
            {rtXmlResult ? (
              <div className="ra-status">
                {[
                  rtXmlResult.title,
                  rtXmlResult.actReference ? `RT ${rtXmlResult.actReference}` : "",
                  rtXmlResult.docId ? `docId: ${rtXmlResult.docId}` : "",
                  rtXmlResult.inserted != null ? tr("admin.rag.ingest.rt_xml_chunk_count", { count: rtXmlResult.inserted }) : ""
                ].filter(Boolean).join(" | ")}
              </div>
            ) : null}
          </Form>
        </div>

        <div className="ra-col-6">
          <div className="ra-card">
            <div className="ra-card-head">
              <div>
                <h2 className="ra-card-title">{tr("admin.rag.articles.title")}</h2>
                <p className="ra-card-sub">{tr("admin.rag.articles.subtitle")}</p>
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
            <Form onSubmit={handleArticlesSubmit} ref={articlesFormRef} className="ra-form">
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
              <div className="ra-filepick">
                <Button type="button" onClick={() => articlesFileInputRef.current?.click()}>
                  Vali fail
                </Button>
                <span className="ra-filepick-name">{articlesJsonFileName || "Pole valitud JSON faili"}</span>
              </div>
              <Textarea
                name="articlesJsonText"
                value={articlesJson}
                onChange={event => setArticlesJson(event.target.value)}
                placeholder={tr("admin.rag.articles.json_placeholder")}
                rows={5}
              />
              <div className="ra-actions">
                <Button type="submit" disabled={articlesBusy}>
                  {articlesBusy ? tr("admin.rag.ingest.sending") : tr("admin.rag.articles.send")}
                </Button>
              </div>
              {articlesResult ? (
                <div className="ra-status">
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
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
