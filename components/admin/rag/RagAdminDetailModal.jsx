"use client";

import Button from "@/components/ui/Button";
import CardTitle from "@/components/ui/CardTitle";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Textarea from "@/components/ui/Textarea";
import DocumentsDropdown from "@/components/documents/DocumentsDropdown";

export default function RagAdminDetailModal({ controller }) {
  const {
    tr,
    detailDoc,
    detailForm,
    setDetailForm,
    audienceSelectOptions,
    closeDetail,
    saveDetail
  } = controller;

  if (!detailDoc) return null;

  return (
    <Modal open={true} onClose={closeDetail} closeOnOverlayClick>
      <div>
        <div>
          <div>
            <CardTitle>{tr("admin.rag.modal.edit_meta")}</CardTitle>
            <div>
              {detailDoc.title || tr("admin.rag.documents.untitled")}
            </div>
          </div>
          <Button variant="linkBrand" size="sm" onClick={closeDetail}>
            {tr("admin.rag.actions.close")}
          </Button>
        </div>
        <div>
          <Input
            value={detailForm.title}
            onChange={event => setDetailForm(form => ({ ...form, title: event.target.value }))}
            size="sm"
          />
          <Textarea
            value={detailForm.description}
            onChange={event => setDetailForm(form => ({ ...form, description: event.target.value }))}
            size="sm"
            rows={3}
          />
          <div>
            <Input
              value={detailForm.authors}
              onChange={event => setDetailForm(form => ({ ...form, authors: event.target.value }))}
              size="sm"
            />
            <Input
              value={detailForm.tags}
              onChange={event => setDetailForm(form => ({ ...form, tags: event.target.value }))}
              size="sm"
            />
          </div>
          <div>
            <Input
              value={detailForm.section}
              onChange={event => setDetailForm(form => ({ ...form, section: event.target.value }))}
              size="sm"
            />
            <Input
              value={detailForm.issueLabel}
              onChange={event => setDetailForm(form => ({ ...form, issueLabel: event.target.value }))}
              size="sm"
            />
            <Input
              value={detailForm.year}
              onChange={event => setDetailForm(form => ({ ...form, year: event.target.value }))}
              size="sm"
            />
          </div>
          <div>
            <Input
              value={detailForm.issueId}
              onChange={event => setDetailForm(form => ({ ...form, issueId: event.target.value }))}
              size="sm"
            />
            <Input
              value={detailForm.journalTitle}
              onChange={event => setDetailForm(form => ({ ...form, journalTitle: event.target.value }))}
              size="sm"
            />
            <Input
              value={detailForm.articleId}
              onChange={event => setDetailForm(form => ({ ...form, articleId: event.target.value }))}
              size="sm"
            />
          </div>
          <div>
            <Input
              value={detailForm.pageRange}
              onChange={event => setDetailForm(form => ({ ...form, pageRange: event.target.value }))}
              size="sm"
            />
            <Input
              value={detailForm.pdf_start_page}
              onChange={event => setDetailForm(form => ({ ...form, pdf_start_page: event.target.value }))}
              size="sm"
            />
          </div>
          <div>
            <DocumentsDropdown
              ariaLabel={tr("admin.rag.document_detail.audience")}
              value={detailForm.audience}
              onChange={nextAudience => setDetailForm(form => ({ ...form, audience: nextAudience }))}
              options={audienceSelectOptions}
            />
            <Input
              value={detailForm.pdf_end_page}
              onChange={event => setDetailForm(form => ({ ...form, pdf_end_page: event.target.value }))}
              size="sm"
            />
            <div>{tr("admin.rag.modal.doc_id")}: {detailDoc.docId || "-"}</div>
            <div>{tr("admin.rag.modal.type")}: {detailDoc.source_type || detailDoc.type || "-"}</div>
            <div>{tr("admin.rag.modal.language")}: {detailDoc.language || "-"}</div>
          </div>
          <div>
            <Button variant="primary" size="sm" onClick={saveDetail}>
              {tr("admin.rag.actions.save")}
            </Button>
            <Button variant="linkBrand" size="sm" onClick={closeDetail}>
              {tr("admin.rag.actions.cancel")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
