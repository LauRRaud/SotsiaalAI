"use client";

import Button from "@/components/ui/Button";

export default function KovEmptyState({ et, hasActiveFilters, onReset }) {
  return (
    <div className="ra-empty">
      <div className="ra-td-main">
        {et ? "Uhtegi KOV-i ei leitud" : "No municipalities found"}
      </div>
      <div>
        {hasActiveFilters
          ? et
            ? "Praegused filtrid ei anna tulemusi. Proovi otsingut laiendada voi nulli filtrid."
            : "The current filters return no rows. Try broadening the search or reset the filters."
          : et
            ? "KOV admini kirjed puuduvad. Pusimudel peaks need olemasolevast nimekirjast ette looma."
            : "Municipality admin records are missing. The persistent model should seed them from the municipality list."}
      </div>
      {hasActiveFilters ? (
        <div className="ra-actions" style={{ justifyContent: "center", marginTop: "0.7rem" }}>
          <Button variant="primary" size="xs" onClick={onReset}>
            {et ? "Nulli filtrid" : "Reset filters"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
