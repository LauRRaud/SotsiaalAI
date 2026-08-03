"use client";

import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Form from "@/components/ui/Form";
import Input from "@/components/ui/Input";
import { ORGANIZATION_UNIT_TYPES } from "@/lib/org/constants";

import OrgHeader from "./OrgHeader";
import { useOrgApi } from "./useOrgApi";

/** Üksuste puu. Sügavus tuleb serverist (`depth`), mitte kliendi arvutusest. */
export default function OrgStructureClient({ context, initialUnits }) {
  const { t } = useI18n();
  const { call, busy, error } = useOrgApi();
  const [units, setUnits] = useState(initialUnits || []);
  const [name, setName] = useState("");
  const [type, setType] = useState("TEAM");
  const [parentUnitId, setParentUnitId] = useState("");

  const canEdit =
    context?.writable !== false &&
    (context?.capabilities || []).some((grant) => grant.capability === "MEMBER_ADMIN");

  const reload = useCallback(async () => {
    const payload = await call(`/api/org/${context.organization.id}/units`);
    if (payload?.units) setUnits(payload.units);
  }, [call, context.organization.id]);

  const addUnit = useCallback(
    async (event) => {
      event.preventDefault();
      const payload = await call(`/api/org/${context.organization.id}/units`, {
        method: "POST",
        body: { name, type, parentUnitId: parentUnitId || null },
        fallbackKey: "org.errors.unit_create_failed"
      });
      if (payload) {
        setName("");
        setParentUnitId("");
        await reload();
      }
    },
    [call, context.organization.id, name, parentUnitId, reload, type]
  );

  const archive = useCallback(
    async (unitId) => {
      const payload = await call(`/api/org/${context.organization.id}/units/${unitId}`, {
        method: "DELETE",
        fallbackKey: "org.errors.unit_archive_failed"
      });
      if (payload) await reload();
    },
    [call, context.organization.id, reload]
  );

  return (
    <section className="ow-shell">
      <OrgHeader context={context} />

      <div className="ow-card">
        <h2 className="ow-title" style={{ fontSize: "1.125rem" }}>
          {t("org.structure.heading")}
        </h2>
        <p className="ow-subtitle">{t("org.structure.intro")}</p>
        <p className="ow-empty">{t("org.structure.maxDepthHint")}</p>

        {units.length === 0 ? (
          <p className="ow-empty">{t("org.structure.empty")}</p>
        ) : (
          <ul className="ow-tree">
            {units.map((unit) => (
              <li key={unit.id} className="ow-tree__item" data-depth={unit.depth}>
                <span>{unit.name}</span>
                <span className="ow-chip">{t(`org.unitType.${unit.type}`)}</span>
                {canEdit ? (
                  <Button type="button" onClick={() => archive(unit.id)} disabled={busy}>
                    {t("org.structure.archive")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit ? (
        <Form className="ow-card" onSubmit={addUnit}>
          <h2 className="ow-title" style={{ fontSize: "1rem" }}>
            {t("org.structure.add")}
          </h2>
          <div className="ow-grid">
            <label>
              <span className="ow-meta__term">{t("org.structure.name")}</span>
              <Input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                style={{ width: "100%" }}
              />
            </label>
            <label>
              <span className="ow-meta__term">{t("org.structure.type")}</span>
              <Dropdown
                value={type}
                onChange={setType}
                ariaLabel={t("org.structure.type")}
                options={ORGANIZATION_UNIT_TYPES.map((unitType) => ({
                  value: unitType,
                  label: t(`org.unitType.${unitType}`)
                }))}
              />
            </label>
            <label>
              <span className="ow-meta__term">{t("org.structure.parent")}</span>
              <Dropdown
                value={parentUnitId}
                onChange={setParentUnitId}
                ariaLabel={t("org.structure.parent")}
                options={[
                  { value: "", label: t("org.structure.noParent") },
                  ...units
                    .filter((unit) => unit.depth < 3)
                    .map((unit) => ({ value: unit.id, label: unit.name }))
                ]}
              />
            </label>
          </div>
          <div className="ow-actions">
            <Button type="submit" disabled={busy}>
              {t("org.structure.add")}
            </Button>
          </div>
        </Form>
      ) : null}

      {error ? (
        <p className="ow-notice ow-notice--warning" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
