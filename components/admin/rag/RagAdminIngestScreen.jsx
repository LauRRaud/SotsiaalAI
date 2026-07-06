"use client";

import RagAdminIngestView from "./RagAdminIngestView";
import { useRagAdminController } from "./useRagAdminController";

export default function RagAdminIngestScreen() {
  const controller = useRagAdminController();

  return (
    <div>
      <RagAdminIngestView controller={controller} />
    </div>
  );
}
