"use client";

/**
 * GlassModal — kompaktne klaasmodaal (kujundusreeglid §2).
 * Sama klaas ja koht mis karusselli fookuskaardil: kaart avaneb
 * sisuks (nagu login). × ja Esc sisse ehitatud; väljaklikk sulgeb.
 * Katet ega hägu EI ole — ruum jääb nähtavale (tellija otsus).
 */

import { useId } from "react";
import CloseIcon from "@/components/brand/icons/CloseIcon";
import IconButton from "@/components/glass/IconButton";
import { useI18n } from "@/components/i18n/I18nProvider";
import Modal from "@/components/ui/Modal";

export default function GlassModal({ open, onClose, title, children }) {
  const { t } = useI18n();
  const titleId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      className="glass-modal-layer"
      contentClassName="glass-modal-shell"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : t("common.dialog", "Dialoog")}
    >
      <IconButton
        aria-label={t("common.close", "Sulge")}
        layoutClassName="glass-modal-close"
        onClick={onClose}
      >
        <CloseIcon aria-hidden="true" />
      </IconButton>
      {title ? <h2 id={titleId} className="glass-modal-title">{title}</h2> : null}
      <div className="glass-modal-body">{children}</div>
    </Modal>
  );
}
