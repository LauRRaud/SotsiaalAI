"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import Button from "@/components/ui/Button";
import { DashboardInfoTrigger } from "@/components/ui/DashboardInfoOverlay";
import { SubpageHeader } from "@/components/ui/SubpageHeader";
import { localizePath } from "@/lib/localizePath";
import { WELLBEING_INFO_ID, wellbeingTools } from "@/lib/wellbeingTools";
import HardCaseWorkflow from "./HardCaseWorkflow";
import InterruptionsWorkflow from "./InterruptionsWorkflow";
import OverviewWorkflow from "./OverviewWorkflow";
import QuickCheckWorkflow from "./QuickCheckWorkflow";
import RecoveryWorkflow from "./RecoveryWorkflow";
import RoleBoundariesWorkflow from "./RoleBoundariesWorkflow";
import StarterSupportWorkflow from "./StarterSupportWorkflow";
import WorkplaceViolenceWorkflow from "./WorkplaceViolenceWorkflow";
import WorkBoundariesWorkflow from "./WorkBoundariesWorkflow";
import WorkProcessesWorkflow from "./WorkProcessesWorkflow";

const CHAT_WORKSPACE_RESTORE_STORAGE_KEY = "__SOTSIAALAI_CHAT_WORKSPACE_RESTORE__";
const WORKSPACE_SUBPAGE_ENTRY_STORAGE_KEY = "__SOTSIAALAI_WORKSPACE_SUBPAGE_ENTRY__";

function markChatWorkspaceRestore() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      CHAT_WORKSPACE_RESTORE_STORAGE_KEY,
      JSON.stringify({
        ts: Date.now(),
        workspace: true,
        suppressOpenTransition: true,
        source: "wellbeing"
      })
    );
  } catch {}
}

function consumeWorkspaceSubpageEntry(expectedPath) {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(WORKSPACE_SUBPAGE_ENTRY_STORAGE_KEY);
    if (!raw) return false;
    window.sessionStorage.removeItem(WORKSPACE_SUBPAGE_ENTRY_STORAGE_KEY);
    const parsed = JSON.parse(raw);
    const ts = Number(parsed?.ts || 0);
    const fresh = Number.isFinite(ts) && Date.now() - ts < 30 * 60 * 1000;
    return fresh && parsed?.source === "workspace" && parsed?.path === expectedPath;
  } catch {
    try {
      window.sessionStorage.removeItem(WORKSPACE_SUBPAGE_ENTRY_STORAGE_KEY);
    } catch {}
    return false;
  }
}

export default function WellbeingPage({ activeTool = null, locale = "et" }) {
  const router = useRouter();
  const { t } = useI18n();
  const activeTitle = activeTool?.title || t("chat.workspace.wellbeing_page.title", "Tööheaolu");
  const infoId = activeTool?.infoId || WELLBEING_INFO_ID;

  const navigate = useCallback((path) => {
    router.push(localizePath(path, locale));
  }, [locale, router]);

  const handleBack = useCallback(() => {
    if (activeTool) {
      navigate("/tooheaolu");
      return;
    }
    markChatWorkspaceRestore();
    if (consumeWorkspaceSubpageEntry("/tooheaolu")) {
      router.back();
      return;
    }
    navigate("/vestlus?workspace=1");
  }, [activeTool, navigate, router]);

  return (
    <div>
      <section
        role="region"
        aria-labelledby="wellbeing-title"
      >
        <div>
          <SubpageHeader
            onBack={handleBack}
            backAriaLabel={t("chat.workspace.wellbeing_page.back_label", "Tagasi")}
            titleId="wellbeing-title"
            /* Ülevaade (tööriistade menüü) = pealkirjata nagu Töölaud (tellija
               07.07). Pealkiri jääb ekraanilugejale (sr-only). Üksik-tööriista
               vaates (activeTool) pealkiri kuvatakse tavaliselt. */
            headerClassName={activeTool ? undefined : "sr-only"}
            rightSlot={
              <DashboardInfoTrigger
                infoId={infoId}
                title={activeTitle}
                label={
                  activeTool
                    ? t("chat.workspace.wellbeing_page.tool_info_label", "Ava tööriista info")
                    : t("chat.workspace.wellbeing_page.info_label", "Ava Tööheaolu info")
                }
              />
            }
          >
            {activeTitle}
          </SubpageHeader>

          {activeTool?.id === "quick-check" ? (
            <QuickCheckWorkflow onNavigate={navigate} />
          ) : activeTool?.id === "overview" ? (
            <OverviewWorkflow />
          ) : activeTool?.id === "hard-case" ? (
            <HardCaseWorkflow onNavigate={navigate} />
          ) : activeTool?.id === "workplace-violence" ? (
            <WorkplaceViolenceWorkflow onNavigate={navigate} />
          ) : activeTool?.id === "recovery" ? (
            <RecoveryWorkflow onNavigate={navigate} />
          ) : activeTool?.id === "work-boundaries" ? (
            <WorkBoundariesWorkflow onNavigate={navigate} />
          ) : activeTool?.id === "interruptions" ? (
            <InterruptionsWorkflow onNavigate={navigate} />
          ) : activeTool?.id === "work-processes" ? (
            <WorkProcessesWorkflow onNavigate={navigate} />
          ) : activeTool?.id === "role-boundaries" ? (
            <RoleBoundariesWorkflow onNavigate={navigate} />
          ) : activeTool?.id === "starter-support" ? (
            <StarterSupportWorkflow onNavigate={navigate} />
          ) : activeTool ? (
            <div>
              <section>
                <h2>{activeTool.title}</h2>
                <p>{activeTool.description}</p>
                <p>
                  {t("chat.workspace.wellbeing_page.placeholder", "Töövoog lisandub järgmises etapis.")}
                </p>
                <Button
                  type="button"
                  onClick={() => navigate("/tooheaolu")}
                >
                  {t("chat.workspace.wellbeing_page.back_to_workspace", "Tagasi Tööheaolu tööruumi")}
                </Button>
              </section>
            </div>
          ) : (
            <div
              className="workspace-dashboard-grid"
              aria-label={t("chat.workspace.wellbeing_page.tools_label", "Tööheaolu tööriistad")}
            >
              {wellbeingTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  className="workspace-dashboard-card"
                  onClick={() => navigate(tool.route)}
                  aria-label={`${tool.title}. ${tool.description}`}
                >
                  <span>{tool.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
