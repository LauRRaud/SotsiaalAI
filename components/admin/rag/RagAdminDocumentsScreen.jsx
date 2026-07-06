"use client";

import RagAdminDocumentsView from "./RagAdminDocumentsView";
import { useRagAdminController } from "./useRagAdminController";

export default function RagAdminDocumentsScreen() {
  const controller = useRagAdminController();

  return (
    <div>
      <RagAdminDocumentsView controller={controller} />
    </div>
  );
}
